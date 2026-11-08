const express = require('express');
const { pool, fnConsultar, fnUsarDatosLocales } = require('../config/db');
const { fnVerificarToken, fnExigirRol } = require('../middleware/auth');

const router = express.Router();

const ramosLocales = [
  { id_ramo: 1, id_categoria: 1, nombre: 'Ramo de Amor', codigo: 'RAM-001', descripcion: 'Ramo romántico con rosas y tulipanes.', precio: 32, costo_empaque: 3.5, imagen: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d', activo: 1 },
  { id_ramo: 2, id_categoria: 1, nombre: 'Bouquet Clásico', codigo: 'RAM-002', descripcion: 'Arreglo clásico para regalar en cualquier ocasión.', precio: 28, costo_empaque: 2.8, imagen: 'https://raw.githubusercontent.com/josuevega2895r-art/TELEPATHY-FLORISTERIA/master/web/public/images/bouquet-clasico.png', activo: 1 },
  { id_ramo: 3, id_categoria: 5, nombre: 'Caja de regalo', codigo: 'COM-001', descripcion: 'Complemento para entrega premium.', precio: 12, costo_empaque: 1.5, imagen: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac', es_complemento: 1, stock: 25, activo: 1 }
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
      let lista = ramosLocales.filter((ramo) => ramo.activo).map((ramo) => ({ ...ramo, disponible: true }));
      const { categoria, precioMin, precioMax } = req.query;
      if (categoria) lista = lista.filter((ramo) => String(ramo.id_categoria) === String(categoria));
      if (precioMin) lista = lista.filter((ramo) => Number(ramo.precio) >= Number(precioMin));
      if (precioMax) lista = lista.filter((ramo) => Number(ramo.precio) <= Number(precioMax));
      return res.json(lista);
    }

    const { categoria, precioMin, precioMax } = req.query;
    let sql = `SELECT r.*, c.nombre AS categoria_nombre,
      CASE
        WHEN r.es_complemento = 1 THEN r.stock > 0
        ELSE NOT EXISTS (
          SELECT 1 FROM receta_ramos rr JOIN flores f ON f.id_flor = rr.id_flor
          WHERE rr.id_ramo = r.id_ramo AND f.stock < rr.cantidad
        )
      END AS disponible
      FROM ramos r LEFT JOIN categorias c ON c.id_categoria = r.id_categoria WHERE r.activo = 1`;
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
    if (fnUsarDatosLocales()) {
      const ramo = ramosLocales.find((item) => item.id_ramo === Number(req.params.id) && item.activo);
      if (!ramo) return res.status(404).json({ error: 'Ramo no encontrado.' });
      return res.json({ ...ramo, receta: [] });
    }
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
    const { nombre, codigo, descripcion, precio, idCategoria, costoEmpaque = 0, imagen = '', receta = [], esComplemento = false, stock = null } = req.body;

    if (!nombre || !codigo || !Number.isFinite(Number(precio)) || Number(precio) <= 0
      || !Array.isArray(receta) || receta.some((item) => !Number.isInteger(Number(item.idFlor)) || Number(item.idFlor) <= 0 || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0)) {
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
        es_complemento: Number(Boolean(esComplemento)),
        stock: esComplemento ? Number(stock || 0) : null,
        activo: 1
      };
      ramosLocales.push(ramo);
      return res.status(201).json({ mensaje: 'Ramo creado correctamente.', id_ramo: ramo.id_ramo, ramo });
    }

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [insertado] = await conexion.execute(
        'INSERT INTO ramos (id_categoria, nombre, codigo, descripcion, precio, costo_empaque, imagen, es_complemento, stock, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [idCategoria || null, nombre.trim(), codigo.trim(), descripcion || '', Number(precio), Number(costoEmpaque), imagen, Number(Boolean(esComplemento)), esComplemento ? Number(stock || 0) : null]
      );
      for (const item of receta) {
        await conexion.execute('INSERT INTO receta_ramos (id_ramo, id_flor, cantidad) VALUES (?, ?, ?)', [insertado.insertId, Number(item.idFlor), Number(item.cantidad)]);
      }
      await conexion.commit();
      return res.status(201).json({ mensaje: 'Ramo creado correctamente.', id_ramo: insertado.insertId });
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El código de producto ya existe.' });
    return res.status(500).json({ error: 'No se pudo crear el ramo.' });
  }
});

router.put('/ramos/:id', fnVerificarToken, fnExigirRol('administrador'), async (req, res) => {
  const { nombre, codigo, descripcion = '', precio, idCategoria = null, costoEmpaque = 0, imagen = '', receta = [] } = req.body;
  if (!String(nombre || '').trim() || !String(codigo || '').trim() || !Number.isFinite(Number(precio)) || Number(precio) <= 0
    || !Array.isArray(receta) || receta.some((item) => !Number.isInteger(Number(item.idFlor)) || Number(item.idFlor) <= 0 || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0)) {
    return res.status(400).json({ error: 'Los datos del ramo o de su receta no son válidos.' });
  }
  try {
    if (fnUsarDatosLocales()) {
      const ramo = ramosLocales.find((item) => item.id_ramo === Number(req.params.id));
      if (!ramo) return res.status(404).json({ error: 'Ramo no encontrado.' });
      if (ramosLocales.some((item) => item.id_ramo !== ramo.id_ramo && item.codigo.toLowerCase() === codigo.trim().toLowerCase())) {
        return res.status(409).json({ error: 'El código de producto ya existe.' });
      }
      Object.assign(ramo, { nombre: nombre.trim(), codigo: codigo.trim(), descripcion, precio: Number(precio), id_categoria: idCategoria, costo_empaque: Number(costoEmpaque), imagen });
      return res.json({ mensaje: 'Ramo actualizado.', ramo });
    }
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [resultado] = await conexion.execute(
        'UPDATE ramos SET id_categoria = ?, nombre = ?, codigo = ?, descripcion = ?, precio = ?, costo_empaque = ?, imagen = ? WHERE id_ramo = ?',
        [idCategoria, nombre.trim(), codigo.trim(), descripcion, Number(precio), Number(costoEmpaque), imagen, req.params.id]
      );
      if (!resultado.affectedRows) {
        await conexion.rollback();
        return res.status(404).json({ error: 'Ramo no encontrado.' });
      }
      await conexion.execute('DELETE FROM receta_ramos WHERE id_ramo = ?', [req.params.id]);
      for (const item of receta) {
        await conexion.execute('INSERT INTO receta_ramos (id_ramo, id_flor, cantidad) VALUES (?, ?, ?)', [req.params.id, Number(item.idFlor), Number(item.cantidad)]);
      }
      await conexion.commit();
      return res.json({ mensaje: 'Ramo actualizado.' });
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El código de producto ya existe.' });
    console.error('Error actualizando ramo:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudo actualizar el ramo.' });
  }
});

router.patch('/ramos/:id/activo', fnVerificarToken, fnExigirRol('administrador'), async (req, res) => {
  if (![0, 1, false, true].includes(req.body.activo)) return res.status(400).json({ error: 'El valor activo debe ser verdadero o falso.' });
  try {
    if (fnUsarDatosLocales()) {
      const ramo = ramosLocales.find((item) => item.id_ramo === Number(req.params.id));
      if (!ramo) return res.status(404).json({ error: 'Ramo no encontrado.' });
      ramo.activo = Number(Boolean(req.body.activo));
      return res.json({ mensaje: 'Disponibilidad del ramo actualizada.' });
    }
    const [resultado] = await pool.execute('UPDATE ramos SET activo = ? WHERE id_ramo = ?', [Number(Boolean(req.body.activo)), req.params.id]);
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Ramo no encontrado.' });
    return res.json({ mensaje: 'Disponibilidad del ramo actualizada.' });
  } catch (error) {
    console.error('Error cambiando disponibilidad del ramo:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudo actualizar el ramo.' });
  }
});

module.exports = router;
module.exports.ramosLocales = ramosLocales;
