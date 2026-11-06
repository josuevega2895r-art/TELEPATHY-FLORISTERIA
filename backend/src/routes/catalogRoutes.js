const express = require('express');
const { fnConsultar, fnEjecutar, fnUsarDatosLocales } = require('../config/db');
const { fnVerificarToken, fnExigirRol } = require('../middleware/auth');

const router = express.Router();

const ramosLocales = [
  { id_ramo: 1, id_categoria: 1, nombre: 'Ramo de Amor', codigo: 'RAM-001', descripcion: 'Ramo romántico con rosas y tulipanes.', precio: 32, costo_empaque: 3.5, imagen: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d', activo: 1 },
  { id_ramo: 2, id_categoria: 1, nombre: 'Bouquet Clásico', codigo: 'RAM-002', descripcion: 'Arreglo clásico para regalar en cualquier ocasión.', precio: 28, costo_empaque: 2.8, imagen: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551', activo: 1 },
  { id_ramo: 3, id_categoria: 5, nombre: 'Caja de regalo', codigo: 'COM-001', descripcion: 'Complemento para entrega premium.', precio: 12, costo_empaque: 1.5, imagen: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac', activo: 1 }
];

router.get('/categorias', async (req, res) => {
  try {
    if (fnUsarDatosLocales()) {
      return res.json([
        { id_categoria: 1, nombre: 'Amor' },
        { id_categoria: 2, nombre: 'Cumpleaños' },
        { id_categoria: 3, nombre: 'Condolencias' },
        { id_categoria: 4, nombre: 'Corporativo' },
        { id_categoria: 5, nombre: 'Complementos' }
      ]);
    }

    const categorias = await fnConsultar('SELECT * FROM categorias ORDER BY nombre');
    return res.json(categorias);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener las categorías.' });
  }
});

router.get('/ramos', async (req, res) => {
  try {
    if (fnUsarDatosLocales()) {
      let lista = [...ramosLocales];
      const { categoria, precioMin, precioMax } = req.query;
      if (categoria) lista = lista.filter((ramo) => String(ramo.id_categoria) === String(categoria));
      if (precioMin) lista = lista.filter((ramo) => Number(ramo.precio) >= Number(precioMin));
      if (precioMax) lista = lista.filter((ramo) => Number(ramo.precio) <= Number(precioMax));
      return res.json(lista);
    }

    const { categoria, precioMin, precioMax } = req.query;
    let sql = 'SELECT r.*, c.nombre AS categoria_nombre FROM ramos r LEFT JOIN categorias c ON c.id_categoria = r.id_categoria WHERE r.activo = 1';
    const params = [];

    if (categoria) {
      sql += ' AND r.id_categoria = ?';
      params.push(categoria);
    }

    if (precioMin) {
      sql += ' AND r.precio >= ?';
      params.push(precioMin);
    }

    if (precioMax) {
      sql += ' AND r.precio <= ?';
      params.push(precioMax);
    }

    sql += ' ORDER BY r.precio ASC';
    const ramos = await fnConsultar(sql, params);
    return res.json(ramos);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo consultar el catálogo.' });
  }
});

router.get('/ramos/:id', async (req, res) => {
  try {
    const ramo = await fnConsultar('SELECT * FROM ramos WHERE id_ramo = ? LIMIT 1', [req.params.id]);
    if (!ramo.length) {
      return res.status(404).json({ error: 'Ramo no encontrado.' });
    }
    const receta = await fnConsultar('SELECT rr.*, f.nombre AS flor_nombre FROM receta_ramos rr JOIN flores f ON f.id_flor = rr.id_flor WHERE rr.id_ramo = ?', [req.params.id]);
    return res.json({ ...ramo[0], receta });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo obtener el detalle del ramo.' });
  }
});

router.post('/ramos', fnVerificarToken, fnExigirRol('administrador'), async (req, res) => {
  try {
    const { nombre, codigo, descripcion, precio, idCategoria, costoEmpaque = 0, imagen = '' } = req.body;

    if (!nombre || !codigo || !precio) {
      return res.status(400).json({ error: 'Nombre, código y precio son obligatorios.' });
    }

    if (fnUsarDatosLocales()) {
      if (ramosLocales.some((ramo) => ramo.codigo.toLowerCase() === codigo.trim().toLowerCase())) {
        return res.status(409).json({ error: 'El código de producto ya existe.' });
      }
      const ramo = {
        id_ramo: Math.max(...ramosLocales.map((item) => item.id_ramo), 0) + 1,
        id_categoria: idCategoria || null,
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        descripcion: descripcion || '',
        precio: Number(precio),
        costo_empaque: Number(costoEmpaque),
        imagen,
        activo: 1
      };
      ramosLocales.push(ramo);
      return res.status(201).json({ mensaje: 'Ramo creado correctamente.', id_ramo: ramo.id_ramo, ramo });
    }

    const insertado = await fnEjecutar('INSERT INTO ramos (id_categoria, nombre, codigo, descripcion, precio, costo_empaque, imagen, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', [idCategoria || null, nombre, codigo, descripcion || '', Number(precio), Number(costoEmpaque), imagen]);
    return res.status(201).json({ mensaje: 'Ramo creado correctamente.', id_ramo: insertado.insertId });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo crear el ramo.' });
  }
});

module.exports = router;
module.exports.ramosLocales = ramosLocales;
