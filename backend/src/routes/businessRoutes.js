const express = require('express');
const { pool, fnConsultar, fnUsarDatosLocales } = require('../config/db');
const { fnVerificarToken, fnExigirRol } = require('../middleware/auth');
const { ramosLocales } = require('./catalogRoutes');

const router = express.Router();
const pedidosLocales = [];
let siguientePedidoLocal = 2000;
let siguienteSolicitudLocal = 3000;

const floresLocales = [
  { id_flor: 1, nombre: 'Rosas', unidad: 'tallos', stock: 12, stock_minimo: 15 },
  { id_flor: 2, nombre: 'Tulipanes', unidad: 'tallos', stock: 8, stock_minimo: 10 },
  { id_flor: 3, nombre: 'Orquídeas', unidad: 'tallos', stock: 20, stock_minimo: 15 }
];

router.get('/pedidos', fnVerificarToken, async (req, res) => {
  try {
    if (fnUsarDatosLocales()) {
      const lista = req.usuario.rol === 'administrador'
        ? pedidosLocales
        : pedidosLocales.filter((pedido) => pedido.id_usuario === req.usuario.id);
      return res.json(lista);
    }

    const filtroUsuario = req.usuario.rol === 'administrador' ? '' : 'WHERE p.id_usuario = ?';
    const parametros = req.usuario.rol === 'administrador' ? [] : [req.usuario.id];
    const pedidos = await fnConsultar(
      `SELECT p.id_pedido, p.fecha_pedido, p.fecha_entrega, p.hora_desde, p.total, p.estado, p.metodo_pago,
        p.nombre_destinatario AS cliente, u.nombre AS comprador_nombre, u.apellidos AS comprador_apellidos,
        u.correo AS comprador_correo, GROUP_CONCAT(CONCAT(r.nombre, ' x', d.cantidad) ORDER BY r.nombre SEPARATOR ', ') AS producto,
        MAX(r.nombre) AS nombre_producto, MAX(r.codigo) AS codigo_producto,
        MAX(d.precio_unitario) AS precio_unitario, SUM(d.cantidad) AS cantidad
       FROM pedidos p
       LEFT JOIN detalle_pedidos d ON d.id_pedido = p.id_pedido
       LEFT JOIN ramos r ON r.id_ramo = d.id_ramo
       LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
       ${filtroUsuario}
       GROUP BY p.id_pedido, u.nombre, u.apellidos, u.correo
       ORDER BY p.fecha_pedido DESC`,
      parametros
    );
    const estados = { P: 'Pendiente', R: 'En preparación', C: 'En camino', E: 'Entregado', X: 'Cancelado' };
    const pedidosNormalizados = pedidos.map((pedido) => ({
      ...pedido,
      codigo: `PED-${pedido.id_pedido}`,
      estado: estados[pedido.estado] || pedido.estado,
      factura: {
        numeroFactura: `FAC-${pedido.id_pedido}`,
        codigoPedido: `PED-${pedido.id_pedido}`,
        codigoProducto: pedido.codigo_producto,
        nombreProducto: pedido.nombre_producto,
        precioUnitario: Number(pedido.precio_unitario),
        cantidad: Number(pedido.cantidad),
        fechaEntrega: pedido.fecha_entrega,
        metodoPago: pedido.metodo_pago,
        compradorNombre: [pedido.comprador_nombre, pedido.comprador_apellidos].filter(Boolean).join(' '),
        compradorCorreo: pedido.comprador_correo,
        total: Number(pedido.total)
      }
    }));
    const filtroSolicitud = req.usuario.rol === 'administrador' ? '' : 'WHERE id_usuario = ?';
    const solicitudes = await fnConsultar(
      `SELECT id_solicitud, codigo, fecha_solicitud, fecha_entrega, ocasion, descripcion, presupuesto,
        estado, nombre_destinatario AS cliente
       FROM solicitudes_personalizadas ${filtroSolicitud}
       ORDER BY fecha_solicitud DESC`,
      parametros
    );
    const solicitudesNormalizadas = solicitudes.map((solicitud) => ({
      id_pedido: `sol-${solicitud.id_solicitud}`,
      codigo: solicitud.codigo,
      cliente: solicitud.cliente,
      producto: `Ramo personalizado · ${solicitud.ocasion}`,
      descripcion: solicitud.descripcion,
      fecha_entrega: solicitud.fecha_entrega,
      fecha_pedido: solicitud.fecha_solicitud,
      presupuesto: solicitud.presupuesto,
      total: 0,
      estado: solicitud.estado,
      tipo: 'personalizado'
    }));
    return res.json([...pedidosNormalizados, ...solicitudesNormalizadas]);
  } catch (error) {
    console.error('Error cargando pedidos:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudieron cargar los pedidos.' });
  }
});

router.post('/pedidos/personalizados', fnVerificarToken, async (req, res) => {
  if (req.usuario.rol !== 'cliente') {
    return res.status(403).json({ error: 'Esta opción está disponible para cuentas de cliente.' });
  }

  const { ocasion, descripcion, presupuesto, fechaEntrega, destinatario } = req.body;
  const presupuestoNumero = presupuesto === '' || presupuesto == null ? null : Number(presupuesto);
  if (!ocasion || !descripcion?.trim() || descripcion.trim().length > 600 || !fechaEntrega || !destinatario?.trim() || (presupuestoNumero !== null && (!Number.isFinite(presupuestoNumero) || presupuestoNumero <= 0))) {
    return res.status(400).json({ error: 'Completa ocasión, descripción, destinatario y fecha. El presupuesto debe ser mayor que cero.' });
  }

  try {
    if (fnUsarDatosLocales()) {
      const idSolicitud = siguienteSolicitudLocal++;
      const solicitud = {
        id_pedido: `sol-${idSolicitud}`,
        codigo: `PER-${idSolicitud}`,
        id_usuario: req.usuario.id,
        cliente: destinatario.trim(),
        producto: `Ramo personalizado · ${ocasion}`,
        descripcion: descripcion.trim(),
        ocasion,
        fecha_entrega: fechaEntrega,
        presupuesto: presupuestoNumero,
        total: 0,
        estado: 'Solicitud recibida',
        tipo: 'personalizado'
      };
      pedidosLocales.unshift(solicitud);
      return res.status(201).json({ mensaje: 'Solicitud enviada correctamente.', solicitud });
    }

    const codigoSolicitud = `PER-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const [insertado] = await pool.execute(
      `INSERT INTO solicitudes_personalizadas
        (id_usuario, codigo, ocasion, descripcion, presupuesto, fecha_entrega, nombre_destinatario)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.usuario.id, codigoSolicitud, ocasion, descripcion.trim(), presupuestoNumero, fechaEntrega, destinatario.trim()]
    );
    const solicitud = {
      id_pedido: `sol-${insertado.insertId}`,
      codigo: codigoSolicitud,
      cliente: destinatario.trim(),
      producto: `Ramo personalizado · ${ocasion}`,
      descripcion: descripcion.trim(),
      ocasion,
      fecha_entrega: fechaEntrega,
      presupuesto: presupuestoNumero,
      total: 0,
      estado: 'Solicitud recibida',
      tipo: 'personalizado'
    };
    return res.status(201).json({ mensaje: 'Solicitud enviada correctamente.', solicitud });
  } catch (error) {
    console.error('Error creando solicitud personalizada:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudo enviar la solicitud personalizada.' });
  }
});

router.post('/pedidos', fnVerificarToken, async (req, res) => {
  const { idRamo, cantidad, fechaEntrega, horaEntrega, destinatario, telefono, direccion, dedicatoria = '', metodoPago, compradorNombre } = req.body;
  const cantidadNumero = Number(cantidad);
  const idRamoNumero = Number(idRamo);

  if (!idRamoNumero || !Number.isInteger(cantidadNumero) || cantidadNumero < 1 || !fechaEntrega || !horaEntrega || !destinatario || !telefono || !direccion || !['efectivo', 'transferencia', 'tarjeta'].includes(metodoPago)) {
    return res.status(400).json({ error: 'Completa los datos del pedido con valores válidos.' });
  }

  try {
    if (fnUsarDatosLocales()) {
      const ramo = ramosLocales.find((item) => item.id_ramo === idRamoNumero && item.activo);
      if (!ramo) return res.status(404).json({ error: 'El producto seleccionado no está disponible.' });

      const idPedido = siguientePedidoLocal++;
      const codigoPedido = `PED-${idPedido}`;
      const subtotal = Number(ramo.precio) * cantidadNumero;
      const pedido = {
        id_pedido: idPedido,
        codigo: codigoPedido,
        id_usuario: req.usuario.id,
        cliente: destinatario.trim(),
        producto: `${ramo.nombre} x${cantidadNumero}`,
        cantidad: cantidadNumero,
        fecha_entrega: fechaEntrega,
        hora_desde: horaEntrega,
        total: subtotal,
        metodo_pago: metodoPago,
        direccion_entrega: direccion.trim(),
        dedicatoria: dedicatoria.trim(),
        estado: 'Pendiente'
      };
      const factura = {
        numeroFactura: `FAC-${idPedido}`,
        codigoPedido,
        codigoProducto: ramo.codigo,
        nombreProducto: ramo.nombre,
        precioUnitario: Number(ramo.precio),
        cantidad: cantidadNumero,
        fechaEntrega,
        metodoPago,
        compradorNombre: compradorNombre || req.usuario.nombre || 'Cliente',
        compradorCorreo: req.usuario.correo,
        total: subtotal
      };
      pedido.factura = factura;
      pedidosLocales.unshift(pedido);
      return res.status(201).json({ mensaje: 'Pedido creado correctamente.', pedido, factura });
    }

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const [ramos] = await conexion.execute('SELECT id_ramo, nombre, codigo, precio FROM ramos WHERE id_ramo = ? AND activo = 1 LIMIT 1', [idRamoNumero]);
      if (!ramos.length) {
        await conexion.rollback();
        return res.status(404).json({ error: 'El producto seleccionado no está disponible.' });
      }

      const ramo = ramos[0];
      const subtotal = Number(ramo.precio) * cantidadNumero;
      const [insertado] = await conexion.execute(
        `INSERT INTO pedidos
          (id_usuario, tipo_entrega, fecha_entrega, hora_desde, hora_hasta, nombre_destinatario, telefono_destinatario,
           direccion_entrega, dedicatoria, subtotal, descuento, costo_envio, total, metodo_pago, estado)
         VALUES (?, 'domicilio', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'P')`,
        [req.usuario.id, fechaEntrega, horaEntrega, horaEntrega, destinatario.trim(), telefono.trim(), direccion.trim(), dedicatoria.trim(), subtotal, subtotal, metodoPago]
      );
      await conexion.execute('INSERT INTO detalle_pedidos (id_pedido, id_ramo, cantidad, precio_unitario) VALUES (?, ?, ?, ?)', [insertado.insertId, ramo.id_ramo, cantidadNumero, ramo.precio]);
      await conexion.commit();
      const codigoPedido = `PED-${insertado.insertId}`;
      const factura = {
        numeroFactura: `FAC-${insertado.insertId}`,
        codigoPedido,
        codigoProducto: ramo.codigo,
        nombreProducto: ramo.nombre,
        precioUnitario: Number(ramo.precio),
        cantidad: cantidadNumero,
        fechaEntrega,
        metodoPago,
        compradorNombre: compradorNombre || req.usuario.nombre || 'Cliente',
        compradorCorreo: req.usuario.correo,
        total: subtotal
      };
      return res.status(201).json({
        mensaje: 'Pedido creado correctamente.',
        pedido: {
          id_pedido: insertado.insertId,
          codigo: codigoPedido,
          cliente: destinatario,
          producto: `${ramo.nombre} x${cantidadNumero}`,
          fecha_entrega: fechaEntrega,
          hora_desde: horaEntrega,
          direccion_entrega: direccion,
          total: subtotal,
          estado: 'Pendiente'
        },
        factura
      });
    } catch (error) {
      console.error('Error creando pedido:', error.code, error.message);
      try { await conexion.rollback(); } catch (_) {}
      throw error;
    } finally {
      conexion.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo crear el pedido.' });
  }
});

router.get('/inventario', fnVerificarToken, fnExigirRol('administrador'), async (req, res) => {
  try {
    if (fnUsarDatosLocales()) return res.json(floresLocales);
    const flores = await fnConsultar('SELECT id_flor, nombre, unidad, stock, stock_minimo FROM flores ORDER BY nombre');
    return res.json(flores);
  } catch (error) {
    console.error('Error cargando inventario:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudo cargar el inventario.' });
  }
});

router.patch('/inventario/:id', fnVerificarToken, fnExigirRol('administrador'), async (req, res) => {
  const stock = Number(req.body.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'El stock debe ser un número entero igual o mayor que cero.' });
  }

  if (fnUsarDatosLocales()) {
    const flor = floresLocales.find((item) => item.id_flor === Number(req.params.id));
    if (!flor) return res.status(404).json({ error: 'Producto de inventario no encontrado.' });
    flor.stock = stock;
    return res.json({ mensaje: 'Inventario actualizado.', flor });
  }

  try {
    const [resultado] = await pool.execute('UPDATE flores SET stock = ? WHERE id_flor = ?', [stock, req.params.id]);
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Producto de inventario no encontrado.' });
    return res.json({ mensaje: 'Inventario actualizado.' });
  } catch (error) {
    console.error('Error actualizando inventario:', error.code, error.message);
    return res.status(500).json({ error: 'No se pudo actualizar el inventario.' });
  }
});

module.exports = router;