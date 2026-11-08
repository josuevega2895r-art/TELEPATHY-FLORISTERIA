const express = require('express');
const { pool, fnConsultar, fnUsarDatosLocales } = require('../config/db');
const { fnVerificarToken, fnExigirRol } = require('../middleware/auth');
const { ramosLocales } = require('./catalogRoutes');

const router = express.Router();
const pedidosLocales = [];
let siguientePedidoLocal = 2000;
let siguienteSolicitudLocal = 3000;

const floresLocales = [
  { id_flor: 1, nombre: 'Rosa', unidad: 'tallo', stock: 120, stock_minimo: 20 },
  { id_flor: 2, nombre: 'Tulipán', unidad: 'tallo', stock: 60, stock_minimo: 20 },
  { id_flor: 3, nombre: 'Girasol', unidad: 'tallo', stock: 80, stock_minimo: 15 },
  { id_flor: 4, nombre: 'Orquídea', unidad: 'tallo', stock: 40, stock_minimo: 10 }
];

/**
 * Nombre: fnValidarFechaHoraEntrega
 * Descripcion: Valida la anticipación mínima y el horario de una entrega.
 * Funcionamiento: Acepta fechas futuras con al menos dos horas de anticipación y hora entre 08:00 y 20:00.
 * Retorna: true si la fecha y hora cumplen RS-02.
 */
function fnValidarFechaHoraEntrega(fecha, hora) {
  const coincidenciaFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha));
  const coincidenciaHora = /^(\d{2}):(\d{2})$/.exec(String(hora));
  if (!coincidenciaFecha || !coincidenciaHora || hora < '08:00' || hora > '20:00') return false;
  const [, anio, mes, dia] = coincidenciaFecha;
  const [, horasDia, minutos] = coincidenciaHora;
  if (Number(horasDia) > 23 || Number(minutos) > 59) return false;
  const fechaHora = new Date(Number(anio), Number(mes) - 1, Number(dia), Number(horasDia), Number(minutos));
  if (fechaHora.getFullYear() !== Number(anio) || fechaHora.getMonth() !== Number(mes) - 1 || fechaHora.getDate() !== Number(dia)) return false;
  const horasAnticipacion = (fechaHora.getTime() - Date.now()) / 3600000;
  return Number.isFinite(horasAnticipacion) && horasAnticipacion >= 2;
}

router.get('/pedidos', fnVerificarToken, async (req, res) => {
  try {
    if (fnUsarDatosLocales()) {
      let lista = req.usuario.rol === 'administrador'
        ? pedidosLocales
        : pedidosLocales.filter((pedido) => pedido.id_usuario === req.usuario.id);
      if (req.query.estado) {
        const nombresEstados = { P: 'Pendiente', R: 'En preparación', C: 'En camino', E: 'Entregado', X: 'Cancelado' };
        lista = lista.filter((pedido) => pedido.estado === req.query.estado || pedido.estado === nombresEstados[req.query.estado]);
      }
      if (req.query.fecha) lista = lista.filter((pedido) => String(pedido.fecha_entrega).startsWith(String(req.query.fecha)));
      return res.json(lista);
    }

    const condiciones = [];
    const parametros = [];
    if (req.usuario.rol !== 'administrador') {
      condiciones.push('p.id_usuario = ?');
      parametros.push(req.usuario.id);
    }
    if (req.query.estado) {
      if (!['P', 'R', 'C', 'E', 'X'].includes(req.query.estado)) return res.status(400).json({ error: 'El filtro de estado no es válido.' });
      condiciones.push('p.estado = ?');
      parametros.push(req.query.estado);
    }
    if (req.query.fecha) {
      condiciones.push('p.fecha_entrega = ?');
      parametros.push(req.query.fecha);
    }
    const filtroUsuario = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const pedidos = await fnConsultar(
      `SELECT p.id_pedido, p.fecha_pedido, p.fecha_entrega, p.hora_desde, p.total, p.estado, p.metodo_pago, p.tipo_entrega,
        p.nombre_destinatario AS cliente, u.nombre AS comprador_nombre, u.apellidos AS comprador_apellidos,
        u.correo AS comprador_correo, GROUP_CONCAT(CONCAT(r.nombre, ' x', d.cantidad) ORDER BY r.nombre SEPARATOR ', ') AS producto,
        MAX(r.nombre) AS nombre_producto, MAX(r.codigo) AS codigo_producto,
        MAX(d.precio_unitario) AS precio_unitario, SUM(d.cantidad) AS cantidad,
        MAX(e.id_entrega) AS id_entrega, MAX(e.id_repartidor) AS id_repartidor
       FROM pedidos p
       LEFT JOIN detalle_pedidos d ON d.id_pedido = p.id_pedido
       LEFT JOIN ramos r ON r.id_ramo = d.id_ramo
       LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
       LEFT JOIN entregas e ON e.id_pedido = p.id_pedido
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
    const parametrosSolicitud = req.usuario.rol === 'administrador' ? [] : [req.usuario.id];
    const solicitudes = await fnConsultar(
      `SELECT id_solicitud, codigo, fecha_solicitud, fecha_entrega, ocasion, descripcion, presupuesto,
        estado, nombre_destinatario AS cliente
       FROM solicitudes_personalizadas ${filtroSolicitud}
       ORDER BY fecha_solicitud DESC`,
      parametrosSolicitud
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
    const conexion = await pool.getConnection();
    let insertado;
    try {
      await conexion.beginTransaction();
      [insertado] = await conexion.execute(
        `INSERT INTO solicitudes_personalizadas
          (id_usuario, codigo, ocasion, descripcion, presupuesto, fecha_entrega, nombre_destinatario)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.usuario.id, codigoSolicitud, ocasion, descripcion.trim(), presupuestoNumero, fechaEntrega, destinatario.trim()]
      );
      await conexion.execute(
        `INSERT INTO notificaciones (id_usuario, tipo, mensaje)
         SELECT id_usuario, 'pedido', ? FROM usuarios WHERE rol = 'administrador' AND activo = 1`,
        [`Nueva solicitud personalizada ${codigoSolicitud}.`]
      );
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
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
  const { idRamo, cantidad, fechaEntrega, horaEntrega, destinatario, telefono, direccion, dedicatoria = '', metodoPago, compradorNombre, idZona, tipoEntrega = 'domicilio' } = req.body;
  const cantidadNumero = Number(cantidad);
  const idRamoNumero = Number(idRamo);

  if (!Number.isInteger(idRamoNumero) || idRamoNumero <= 0 || !Number.isInteger(cantidadNumero) || cantidadNumero < 1 || !fechaEntrega || !horaEntrega
    || typeof destinatario !== 'string' || !destinatario.trim() || typeof telefono !== 'string' || !telefono.trim()
    || !['efectivo', 'transferencia', 'tarjeta'].includes(metodoPago)
    || !['domicilio', 'tienda'].includes(tipoEntrega) || (tipoEntrega === 'domicilio' && !direccion)) {
    return res.status(400).json({ error: 'Completa los datos del pedido con valores válidos.' });
  }
  if (!fnValidarFechaHoraEntrega(fechaEntrega, horaEntrega)) {
    return res.status(400).json({ error: 'La entrega debe programarse con al menos 2 horas de anticipación, entre 08:00 y 20:00.' });
  }

  try {
    if (fnUsarDatosLocales()) {
      const ramo = ramosLocales.find((item) => item.id_ramo === idRamoNumero && item.activo);
      if (!ramo) return res.status(404).json({ error: 'El producto seleccionado no está disponible.' });
      const activosCliente = pedidosLocales.filter((pedido) => pedido.id_usuario === req.usuario.id && ['Pendiente', 'En preparación', 'En camino'].includes(pedido.estado)).length;
      if (activosCliente >= 5) return res.status(409).json({ error: 'No puedes tener más de 5 pedidos activos al mismo tiempo.' });
      if (tipoEntrega === 'domicilio' && idZona != null && ![1, 2].includes(Number(idZona))) {
        return res.status(400).json({ error: 'Selecciona una zona de domicilio válida.' });
      }

      const receta = ramo.id_ramo === 1 ? [{ id_flor: 1, cantidad: 10 }, { id_flor: 2, cantidad: 5 }]
        : ramo.id_ramo === 2 ? [{ id_flor: 1, cantidad: 8 }, { id_flor: 3, cantidad: 6 }] : [];
      if (receta.some((item) => (floresLocales.find((flor) => flor.id_flor === item.id_flor)?.stock || 0) < item.cantidad * cantidadNumero)) {
        return res.status(409).json({ error: 'Agotado temporalmente: no hay flores suficientes para este ramo.' });
      }
      if (Number(ramo.es_complemento) && Number(ramo.stock) < cantidadNumero) {
        return res.status(409).json({ error: 'Agotado temporalmente: no hay existencias suficientes.' });
      }

      const idPedido = siguientePedidoLocal++;
      const codigoPedido = `PED-${idPedido}`;
      const subtotal = Number(ramo.precio) * cantidadNumero;
      const primerPedido = !pedidosLocales.some((pedido) => pedido.id_usuario === req.usuario.id);
      const descuento = primerPedido ? Number((subtotal * 0.1).toFixed(2)) : 0;
      const costoEnvio = tipoEntrega === 'tienda' ? 0 : Number(idZona) === 2 ? 5 : Number(idZona) === 3 ? 0 : 3;
      if (tipoEntrega === 'domicilio' && Number(idZona) === 3) {
        return res.status(400).json({ error: 'Selecciona una zona de domicilio válida; el retiro en tienda no admite envío.' });
      }
      const total = Number((subtotal - descuento + costoEnvio).toFixed(2));
      const pedido = {
        id_pedido: idPedido,
        codigo: codigoPedido,
        id_usuario: req.usuario.id,
        cliente: destinatario.trim(),
        producto: `${ramo.nombre} x${cantidadNumero}`,
        cantidad: cantidadNumero,
        fecha_entrega: fechaEntrega,
        hora_desde: horaEntrega,
        subtotal,
        descuento,
        costo_envio: costoEnvio,
        total,
        metodo_pago: metodoPago,
        direccion_entrega: String(direccion || '').trim(),
        dedicatoria: String(dedicatoria || '').trim(),
        id_empleado: req.usuario.rol === 'administrador' ? 1 : null,
        tipo_entrega: tipoEntrega,
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
        total
      };
      pedido.factura = factura;
      pedidosLocales.unshift(pedido);
      return res.status(201).json({ mensaje: 'Pedido creado correctamente.', pedido, factura });
    }

    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.execute('SELECT id_usuario FROM usuarios WHERE id_usuario = ? FOR UPDATE', [req.usuario.id]);
      const [activos] = await conexion.execute(
        "SELECT COUNT(*) AS cantidad FROM pedidos WHERE id_usuario = ? AND estado IN ('P','R','C')",
        [req.usuario.id]
      );
      if (Number(activos[0].cantidad) >= 5) {
        await conexion.rollback();
        return res.status(409).json({ error: 'No puedes tener más de 5 pedidos activos al mismo tiempo.' });
      }
      const [anteriores] = await conexion.execute('SELECT COUNT(*) AS cantidad FROM pedidos WHERE id_usuario = ?', [req.usuario.id]);
      let idEmpleado = null;
      if (req.usuario.rol === 'administrador') {
        const [empleados] = await conexion.execute('SELECT id_empleado FROM empleados WHERE id_usuario = ? LIMIT 1', [req.usuario.id]);
        if (!empleados.length) {
          await conexion.rollback();
          return res.status(409).json({ error: 'El administrador debe estar vinculado a un empleado para registrar pedidos.' });
        }
        idEmpleado = empleados[0].id_empleado;
      }
      const [ramos] = await conexion.execute(
        'SELECT id_ramo, nombre, codigo, precio, es_complemento, stock FROM ramos WHERE id_ramo = ? AND activo = 1 LIMIT 1 FOR UPDATE',
        [idRamoNumero]
      );
      if (!ramos.length) {
        await conexion.rollback();
        return res.status(404).json({ error: 'El producto seleccionado no está disponible.' });
      }

      const ramo = ramos[0];
      const subtotal = Number(ramo.precio) * cantidadNumero;
      const descuento = Number(anteriores[0].cantidad) === 0 ? Number((subtotal * 0.1).toFixed(2)) : 0;
      const [zonas] = await conexion.execute(
        tipoEntrega === 'tienda'
          ? "SELECT id_zona, nombre, costo_envio FROM zonas_entrega WHERE nombre = 'Retiro en tienda' LIMIT 1"
          : 'SELECT id_zona, nombre, costo_envio FROM zonas_entrega WHERE id_zona = ? LIMIT 1',
        tipoEntrega === 'tienda' ? [] : [idZona || 1]
      );
      if (!zonas.length) {
        await conexion.rollback();
        return res.status(400).json({ error: 'La zona de entrega seleccionada no existe.' });
      }
      const zona = zonas[0];
      if (tipoEntrega === 'domicilio' && String(zona.nombre || '').toLowerCase() === 'retiro en tienda') {
        await conexion.rollback();
        return res.status(400).json({ error: 'Selecciona una zona de domicilio válida; el retiro en tienda no admite envío.' });
      }
      const [receta] = await conexion.execute(
        `SELECT f.id_flor, f.stock, rr.cantidad * ? AS cantidad_requerida
         FROM receta_ramos rr JOIN flores f ON f.id_flor = rr.id_flor WHERE rr.id_ramo = ? FOR UPDATE`,
        [cantidadNumero, idRamoNumero]
      );
      if (receta.some((flor) => Number(flor.stock) < Number(flor.cantidad_requerida))) {
        await conexion.rollback();
        return res.status(409).json({ error: 'Agotado temporalmente: no hay flores suficientes para este ramo.' });
      }
      if (Number(ramo.es_complemento) && Number(ramo.stock) < cantidadNumero) {
        await conexion.rollback();
        return res.status(409).json({ error: 'Agotado temporalmente: no hay existencias suficientes.' });
      }
      const costoEnvio = Number(zona.costo_envio);
      const total = Number((subtotal - descuento + costoEnvio).toFixed(2));
      const idZonaPedido = zona.id_zona;
      const [insertado] = await conexion.execute(
        `INSERT INTO pedidos
          (id_usuario, id_empleado, id_zona, tipo_entrega, fecha_entrega, hora_desde, hora_hasta, nombre_destinatario, telefono_destinatario,
           direccion_entrega, dedicatoria, subtotal, descuento, costo_envio, total, metodo_pago, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'P')`,
        [req.usuario.id, idEmpleado, idZonaPedido, tipoEntrega, fechaEntrega, horaEntrega, horaEntrega, destinatario.trim(), telefono.trim(),
          tipoEntrega === 'tienda' ? null : String(direccion).trim(), String(dedicatoria || '').trim(), subtotal, descuento, costoEnvio, total, metodoPago]
      );
      await conexion.execute('INSERT INTO detalle_pedidos (id_pedido, id_ramo, cantidad, precio_unitario) VALUES (?, ?, ?, ?)', [insertado.insertId, ramo.id_ramo, cantidadNumero, ramo.precio]);
      if (tipoEntrega === 'domicilio') {
        await conexion.execute('INSERT INTO entregas (id_pedido) VALUES (?)', [insertado.insertId]);
      }
      await conexion.execute(
        `INSERT INTO notificaciones (id_usuario, id_pedido, tipo, mensaje)
         SELECT id_usuario, ?, 'pedido', ? FROM usuarios WHERE rol = 'administrador' AND activo = 1`,
        [insertado.insertId, `Nuevo pedido PED-${insertado.insertId} recibido.`]
      );
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
        total
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
          subtotal,
          descuento,
          costo_envio: costoEnvio,
          total,
          estado: 'Pendiente'
        },
        factura
      });
    } catch (error) {
      console.error('Error creando pedido:', error.code, error.message);
      try { await conexion.rollback(); } catch (rollbackError) {
        console.error('Error revirtiendo pedido:', rollbackError.code, rollbackError.message);
      }
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
module.exports.floresLocales = floresLocales;