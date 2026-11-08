const express = require('express');
const { pool, fnUsarDatosLocales } = require('../config/db');
const { fnVerificarToken, fnExigirRol } = require('../middleware/auth');
const { floresLocales } = require('./businessRoutes');

const router = express.Router();
const fnAdmin = [fnVerificarToken, fnExigirRol('administrador')];
const fnCliente = [fnVerificarToken, fnExigirRol('cliente')];
const fnAutenticado = fnVerificarToken;

/**
 * Nombre: fnResponderError
 * Descripcion: Convierte errores de las rutas en respuestas JSON seguras.
 * Funcionamiento: Registra el detalle en el servidor y devuelve el mensaje y estado definidos.
 * Retorna: Una respuesta HTTP.
 */
function fnResponderError(res, error, mensaje = 'No se pudo completar la operación.') {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error('Error en API:', error.code, error.message);
  return res.status(500).json({ error: mensaje });
}

/**
 * Nombre: fnExigirBaseDatos
 * Descripcion: Evita operaciones ficticias cuando el backend está en modo local de respaldo.
 * Funcionamiento: Lanza un error 503 si la operación requiere MySQL.
 * Retorna: Nada o lanza un error HTTP controlado.
 */
function fnExigirBaseDatos() {
  if (fnUsarDatosLocales()) {
    const error = new Error('Esta operación requiere una conexión MySQL configurada.');
    error.status = 503;
    throw error;
  }
}

/**
 * Nombre: fnCrearNotificacion
 * Descripcion: Inserta una notificación ligada a un usuario y, opcionalmente, a un pedido.
 * Funcionamiento: Usa parámetros SQL y permite formar parte de la transacción que llama la función.
 * Retorna: Nada.
 */
async function fnCrearNotificacion(conexion, usuarioId, pedidoId, tipo, mensaje) {
  await conexion.execute(
    'INSERT INTO notificaciones (id_usuario, id_pedido, tipo, mensaje) VALUES (?, ?, ?, ?)',
    [usuarioId || null, pedidoId || null, tipo, mensaje]
  );
}

/**
 * Nombre: fnTransaccion
 * Descripcion: Ejecuta operaciones de negocio que modifican varias tablas en una transacción.
 * Funcionamiento: Abre una conexión, confirma el trabajo exitoso y revierte cualquier error.
 * Retorna: El resultado de la operación recibida.
 */
async function fnTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

router.get('/zonas', fnAutenticado, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [zonas] = await pool.execute('SELECT id_zona, nombre, costo_envio, tiempo_estimado_min FROM zonas_entrega ORDER BY id_zona');
    return res.json(zonas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudieron consultar las zonas.');
  }
});

router.get('/pedidos/:id', fnAutenticado, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [pedidos] = await pool.execute(
      `SELECT p.*, e.id_entrega, e.id_repartidor, e.fecha_hora_salida, e.fecha_hora_entrega,
        e.recibido_por, e.foto_confirmacion, e.observaciones
       FROM pedidos p LEFT JOIN entregas e ON e.id_pedido = p.id_pedido
       WHERE p.id_pedido = ? AND (? = 'administrador' OR p.id_usuario = ?) LIMIT 1`,
      [req.params.id, req.usuario.rol, req.usuario.id]
    );
    if (!pedidos.length) return res.status(404).json({ error: 'Pedido no encontrado.' });
    const [detalle] = await pool.execute(
      `SELECT d.id_ramo, r.nombre, r.codigo, d.cantidad, d.precio_unitario
       FROM detalle_pedidos d JOIN ramos r ON r.id_ramo = d.id_ramo WHERE d.id_pedido = ?`,
      [req.params.id]
    );
    return res.json({ ...pedidos[0], detalle });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo consultar el pedido.');
  }
});

router.patch('/pedidos/:id/estado', ...fnAdmin, async (req, res) => {
  const estado = String(req.body.estado || '').toUpperCase();
  if (!['P', 'R', 'C', 'E', 'X'].includes(estado)) return res.status(400).json({ error: 'El estado del pedido no es válido.' });
  try {
    fnExigirBaseDatos();
    await fnTransaccion(async (conexion) => {
      const [pedidos] = await conexion.execute('SELECT * FROM pedidos WHERE id_pedido = ? FOR UPDATE', [req.params.id]);
      if (!pedidos.length) {
        const error = new Error('Pedido no encontrado.');
        error.status = 404;
        throw error;
      }
      const pedido = pedidos[0];
      if (pedido.estado === 'X' || pedido.estado === 'E') {
        const error = new Error('No se puede cambiar el estado de un pedido finalizado.');
        error.status = 409;
        throw error;
      }
      const estadosSiguientes = {
        P: 'R',
        R: pedido.tipo_entrega === 'tienda' ? 'E' : 'C',
        C: 'E'
      };
      if (estadosSiguientes[pedido.estado] !== estado) {
        const error = new Error('El pedido debe avanzar de Pendiente a En preparación, En camino y Entregado, en ese orden.');
        error.status = 409;
        throw error;
      }
      if (estado === 'R') {
        const [receta] = await conexion.execute(
          `SELECT rr.id_flor, SUM(rr.cantidad * d.cantidad) AS cantidad_requerida, MAX(f.stock) AS stock
           FROM detalle_pedidos d JOIN ramos r ON r.id_ramo = d.id_ramo
           JOIN receta_ramos rr ON rr.id_ramo = r.id_ramo
           JOIN flores f ON f.id_flor = rr.id_flor WHERE d.id_pedido = ?
           GROUP BY rr.id_flor FOR UPDATE`,
          [req.params.id]
        );
        const [complementos] = await conexion.execute(
          `SELECT r.id_ramo, d.cantidad, r.stock FROM detalle_pedidos d
           JOIN ramos r ON r.id_ramo = d.id_ramo WHERE d.id_pedido = ? AND r.es_complemento = 1 FOR UPDATE`,
          [req.params.id]
        );
        if (receta.some((flor) => Number(flor.stock) < Number(flor.cantidad_requerida))
          || complementos.some((ramo) => Number(ramo.stock) < Number(ramo.cantidad))) {
          const error = new Error('No hay inventario suficiente para preparar este pedido.');
          error.status = 409;
          throw error;
        }
        for (const flor of receta) {
          await conexion.execute('UPDATE flores SET stock = stock - ? WHERE id_flor = ?', [flor.cantidad_requerida, flor.id_flor]);
        }
        for (const ramo of complementos) {
          await conexion.execute('UPDATE ramos SET stock = stock - ? WHERE id_ramo = ?', [ramo.cantidad, ramo.id_ramo]);
        }
      }
      if (estado === 'C' && pedido.tipo_entrega === 'domicilio') {
        const [entregas] = await conexion.execute('SELECT id_repartidor FROM entregas WHERE id_pedido = ? FOR UPDATE', [req.params.id]);
        if (!entregas.length || !entregas[0].id_repartidor) {
          const error = new Error('Asigna un repartidor antes de enviar el pedido.');
          error.status = 409;
          throw error;
        }
        await conexion.execute('UPDATE entregas SET fecha_hora_salida = COALESCE(fecha_hora_salida, NOW()) WHERE id_pedido = ?', [req.params.id]);
      }
      if (estado === 'E') {
        if (!req.body.recibidoPor || !String(req.body.recibidoPor).trim()) {
          const error = new Error('Indica quién recibió el pedido.');
          error.status = 400;
          throw error;
        }
        await conexion.execute(
          `INSERT INTO entregas (id_pedido, fecha_hora_entrega, recibido_por, foto_confirmacion)
           VALUES (?, NOW(), ?, ?) ON DUPLICATE KEY UPDATE fecha_hora_entrega = NOW(),
           recibido_por = VALUES(recibido_por), foto_confirmacion = COALESCE(VALUES(foto_confirmacion), foto_confirmacion)`,
          [req.params.id, String(req.body.recibidoPor).trim(), req.body.fotoConfirmacion || null]
        );
      }
      await conexion.execute('UPDATE pedidos SET estado = ? WHERE id_pedido = ?', [estado, req.params.id]);
      await fnCrearNotificacion(conexion, pedido.id_usuario, pedido.id_pedido, 'pedido', `El estado de tu pedido cambió a ${estado}.`);
    });
    return res.json({ mensaje: 'Estado del pedido actualizado.', estado });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo actualizar el estado del pedido.');
  }
});

router.patch('/pedidos/:id/cancelar', fnAutenticado, async (req, res) => {
  const motivo = String(req.body.motivo || '').trim();
  try {
    fnExigirBaseDatos();
    await fnTransaccion(async (conexion) => {
      const [pedidos] = await conexion.execute('SELECT * FROM pedidos WHERE id_pedido = ? FOR UPDATE', [req.params.id]);
      if (!pedidos.length || (req.usuario.rol !== 'administrador' && pedidos[0].id_usuario !== req.usuario.id)) {
        const error = new Error('Pedido no encontrado.');
        error.status = 404;
        throw error;
      }
      const pedido = pedidos[0];
      if (pedido.estado !== 'P' && req.usuario.rol !== 'administrador') {
        const error = new Error('Solo puedes cancelar pedidos pendientes.');
        error.status = 403;
        throw error;
      }
      if (['E', 'X'].includes(pedido.estado)) {
        const error = new Error('No se puede cancelar un pedido finalizado.');
        error.status = 409;
        throw error;
      }
      if (pedido.estado !== 'P' && req.usuario.rol === 'administrador' && !motivo) {
        const error = new Error('Indica el motivo de cancelación para registrar las flores usadas como merma.');
        error.status = 400;
        throw error;
      }
      if (['R', 'C'].includes(pedido.estado)) {
        const [flores] = await conexion.execute(
          `SELECT rr.id_flor, rr.cantidad * d.cantidad AS cantidad
           FROM detalle_pedidos d JOIN receta_ramos rr ON rr.id_ramo = d.id_ramo
           WHERE d.id_pedido = ?`,
          [req.params.id]
        );
        for (const flor of flores) {
          await conexion.execute(
            'INSERT INTO mermas (id_flor, id_pedido, cantidad, motivo) VALUES (?, ?, ?, ?)',
            [flor.id_flor, req.params.id, flor.cantidad, motivo.slice(0, 100)]
          );
        }
      }
      await conexion.execute('UPDATE pedidos SET estado = ?, motivo_cancelacion = ? WHERE id_pedido = ?', ['X', motivo || null, req.params.id]);
      await fnCrearNotificacion(conexion, pedido.id_usuario, pedido.id_pedido, 'pedido', 'Tu pedido fue cancelado.');
    });
    return res.json({ mensaje: 'Pedido cancelado.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo cancelar el pedido.');
  }
});

router.patch('/pedidos/:id/pago', ...fnAdmin, async (req, res) => {
  const metodo = req.body.metodoPago;
  if (!['efectivo', 'transferencia', 'tarjeta'].includes(metodo)) return res.status(400).json({ error: 'El método de pago no es válido.' });
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute('UPDATE pedidos SET pagado = 1, metodo_pago = ? WHERE id_pedido = ?', [metodo, req.params.id]);
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Pedido no encontrado.' });
    return res.json({ mensaje: 'Pago registrado.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo registrar el pago.');
  }
});

router.get('/entregas', ...fnAdmin, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [entregas] = await pool.execute(
      `SELECT e.*, p.fecha_entrega, p.hora_desde, p.nombre_destinatario, p.direccion_entrega,
        p.telefono_destinatario, p.estado, p.id_usuario
       FROM entregas e JOIN pedidos p ON p.id_pedido = e.id_pedido
       WHERE p.tipo_entrega = 'domicilio' AND p.fecha_entrega >= CURDATE() AND p.estado IN ('P','R','C')
       ORDER BY p.fecha_entrega, p.hora_desde`
    );
    return res.json(entregas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudieron consultar las entregas.');
  }
});

router.patch('/entregas/:id', ...fnAdmin, async (req, res) => {
  const campos = ['idRepartidor', 'fechaHoraSalida', 'fechaHoraEntrega', 'recibidoPor', 'fotoConfirmacion', 'observaciones'];
  if (!campos.some((campo) => Object.hasOwn(req.body, campo))) return res.status(400).json({ error: 'Indica al menos un dato de entrega para actualizar.' });
  try {
    fnExigirBaseDatos();
    const [entregas] = await pool.execute('SELECT id_entrega FROM entregas WHERE id_entrega = ?', [req.params.id]);
    if (!entregas.length) return res.status(404).json({ error: 'Entrega no encontrada.' });
    await pool.execute(
      `UPDATE entregas SET id_repartidor = COALESCE(?, id_repartidor),
       fecha_hora_salida = COALESCE(?, fecha_hora_salida),
       fecha_hora_entrega = COALESCE(?, fecha_hora_entrega),
       recibido_por = COALESCE(?, recibido_por),
       foto_confirmacion = COALESCE(?, foto_confirmacion),
       observaciones = COALESCE(?, observaciones) WHERE id_entrega = ?`,
      [req.body.idRepartidor ?? null, req.body.fechaHoraSalida ?? null, req.body.fechaHoraEntrega ?? null,
        req.body.recibidoPor ?? null, req.body.fotoConfirmacion ?? null, req.body.observaciones ?? null, req.params.id]
    );
    return res.json({ mensaje: 'Entrega actualizada.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo actualizar la entrega.');
  }
});

router.get('/flores', ...fnAdmin, async (req, res) => {
  try {
    if (fnUsarDatosLocales()) return res.json(floresLocales);
    fnExigirBaseDatos();
    const [flores] = await pool.execute(
      'SELECT id_flor, id_proveedor, nombre, unidad, stock, stock_minimo, costo_unitario, dias_vida FROM flores ORDER BY nombre'
    );
    return res.json(flores);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo consultar el inventario de flores.');
  }
});

router.post(['/flores', '/inventario'], ...fnAdmin, async (req, res) => {
  const { nombre, unidad = 'tallo', stock = 0, idProveedor = null, diasVida = 7 } = req.body;
  const stockMinimo = req.body.stockMinimo ?? req.body.stock_minimo ?? 20;
  const costoUnitario = req.body.costoUnitario ?? req.body.costo_unitario;
  if (!String(nombre || '').trim() || !Number.isInteger(Number(stock)) || Number(stock) < 0
    || !Number.isInteger(Number(stockMinimo)) || Number(stockMinimo) < 0
    || !Number.isFinite(Number(costoUnitario)) || Number(costoUnitario) < 0) {
    return res.status(400).json({ error: 'Nombre, existencias, mínimo y costo unitario deben ser válidos.' });
  }
  try {
    if (fnUsarDatosLocales()) {
      const flor = {
        id_flor: Math.max(...floresLocales.map((item) => item.id_flor), 0) + 1,
        nombre: String(nombre).trim(),
        unidad,
        stock: Number(stock),
        stock_minimo: Number(stockMinimo),
        costo_unitario: Number(costoUnitario),
        id_proveedor: idProveedor
      };
      floresLocales.push(flor);
      return res.status(201).json({ mensaje: 'Flor creada.', id_flor: flor.id_flor, flor });
    }
    fnExigirBaseDatos();
    const [resultado] = await pool.execute(
      'INSERT INTO flores (id_proveedor, nombre, unidad, stock, stock_minimo, costo_unitario, dias_vida) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [idProveedor, String(nombre).trim(), unidad, Number(stock), Number(stockMinimo), Number(costoUnitario), Number(diasVida)]
    );
    return res.status(201).json({ mensaje: 'Flor creada.', id_flor: resultado.insertId });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo crear la flor.');
  }
});

router.put('/flores/:id', ...fnAdmin, async (req, res) => {
  const { nombre, unidad, stock, stockMinimo, costoUnitario, idProveedor, diasVida } = req.body;
  try {
    if (fnUsarDatosLocales()) {
      const flor = floresLocales.find((item) => item.id_flor === Number(req.params.id));
      if (!flor) return res.status(404).json({ error: 'Flor no encontrada.' });
      Object.assign(flor, {
        nombre: nombre ?? flor.nombre,
        unidad: unidad ?? flor.unidad,
        stock: stock ?? flor.stock,
        stock_minimo: stockMinimo ?? flor.stock_minimo,
        costo_unitario: costoUnitario ?? flor.costo_unitario,
        id_proveedor: idProveedor ?? flor.id_proveedor,
        dias_vida: diasVida ?? flor.dias_vida
      });
      return res.json({ mensaje: 'Flor actualizada.', flor });
    }
    fnExigirBaseDatos();
    const [actual] = await pool.execute('SELECT * FROM flores WHERE id_flor = ?', [req.params.id]);
    if (!actual.length) return res.status(404).json({ error: 'Flor no encontrada.' });
    const flor = actual[0];
    const valores = {
      nombre: nombre ?? flor.nombre, unidad: unidad ?? flor.unidad, stock: stock ?? flor.stock,
      stockMinimo: stockMinimo ?? flor.stock_minimo, costoUnitario: costoUnitario ?? flor.costo_unitario,
      idProveedor: idProveedor ?? flor.id_proveedor, diasVida: diasVida ?? flor.dias_vida
    };
    if (!String(valores.nombre).trim() || !Number.isInteger(Number(valores.stock)) || Number(valores.stock) < 0
      || !Number.isInteger(Number(valores.stockMinimo)) || Number(valores.stockMinimo) < 0
      || !Number.isFinite(Number(valores.costoUnitario)) || Number(valores.costoUnitario) < 0) {
      return res.status(400).json({ error: 'Los datos de la flor no son válidos.' });
    }
    await pool.execute(
      'UPDATE flores SET id_proveedor = ?, nombre = ?, unidad = ?, stock = ?, stock_minimo = ?, costo_unitario = ?, dias_vida = ? WHERE id_flor = ?',
      [valores.idProveedor, valores.nombre, valores.unidad, valores.stock, valores.stockMinimo, valores.costoUnitario, valores.diasVida, req.params.id]
    );
    return res.json({ mensaje: 'Flor actualizada.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo actualizar la flor.');
  }
});

router.post('/mermas', ...fnAdmin, async (req, res) => {
  const cantidad = Number(req.body.cantidad);
  const florId = Number(req.body.idFlor);
  const motivo = String(req.body.motivo || '').trim();
  if (!Number.isInteger(florId) || florId <= 0 || !Number.isInteger(cantidad) || cantidad <= 0 || !motivo) {
    return res.status(400).json({ error: 'Flor, cantidad y motivo válidos son obligatorios.' });
  }
  try {
    if (fnUsarDatosLocales()) {
      const flor = floresLocales.find((item) => item.id_flor === florId);
      if (!flor) return res.status(404).json({ error: 'Flor no encontrada.' });
      if (Number(flor.stock) < cantidad) return res.status(409).json({ error: 'La cantidad de merma supera las existencias.' });
      flor.stock = Number(flor.stock) - cantidad;
      return res.status(201).json({ mensaje: 'Merma registrada.' });
    }
    fnExigirBaseDatos();
    const idMerma = await fnTransaccion(async (conexion) => {
      const [flores] = await conexion.execute('SELECT stock FROM flores WHERE id_flor = ? FOR UPDATE', [florId]);
      if (!flores.length) {
        const error = new Error('Flor no encontrada.');
        error.status = 404;
        throw error;
      }
      if (Number(flores[0].stock) < cantidad) {
        const error = new Error('La cantidad de merma supera las existencias.');
        error.status = 409;
        throw error;
      }
      await conexion.execute('UPDATE flores SET stock = stock - ? WHERE id_flor = ?', [cantidad, florId]);
      const [insertado] = await conexion.execute('INSERT INTO mermas (id_flor, cantidad, motivo) VALUES (?, ?, ?)', [florId, cantidad, motivo.slice(0, 100)]);
      return insertado.insertId;
    });
    return res.status(201).json({ mensaje: 'Merma registrada.', id_merma: idMerma });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo registrar la merma.');
  }
});

router.get('/ramos/:id/resenas', async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [resenas] = await pool.execute(
      `SELECT re.id_resena, re.id_ramo, re.fecha, re.calificacion, re.comentario, u.nombre
       FROM resenas re JOIN usuarios u ON u.id_usuario = re.id_usuario
       WHERE re.id_ramo = ? AND re.visible = 1 ORDER BY re.fecha DESC`,
      [req.params.id]
    );
    return res.json(resenas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudieron consultar las reseñas.');
  }
});

router.post('/resenas', fnAutenticado, async (req, res) => {
  const ramoId = Number(req.body.idRamo);
  const calificacion = Number(req.body.calificacion);
  if (req.usuario.rol !== 'cliente') return res.status(403).json({ error: 'Solo los clientes pueden crear reseñas.' });
  if (!Number.isInteger(ramoId) || ramoId <= 0 || !Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ error: 'El ramo y la calificación entre 1 y 5 son obligatorios.' });
  }
  try {
    fnExigirBaseDatos();
    const [compras] = await pool.execute(
      `SELECT p.id_pedido FROM pedidos p JOIN detalle_pedidos d ON d.id_pedido = p.id_pedido
       WHERE p.id_usuario = ? AND p.estado = 'E' AND d.id_ramo = ? LIMIT 1`,
      [req.usuario.id, ramoId]
    );
    if (!compras.length) return res.status(403).json({ error: 'Solo puedes reseñar ramos de pedidos entregados.' });
    const [insertado] = await pool.execute(
      'INSERT INTO resenas (id_usuario, id_ramo, calificacion, comentario) VALUES (?, ?, ?, ?)',
      [req.usuario.id, ramoId, calificacion, String(req.body.comentario || '').trim().slice(0, 500) || null]
    );
    return res.status(201).json({ mensaje: 'Reseña creada.', id_resena: insertado.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya calificaste este ramo.' });
    return fnResponderError(res, error, 'No se pudo crear la reseña.');
  }
});

router.patch('/resenas/:id/visible', ...fnAdmin, async (req, res) => {
  if (![0, 1, false, true].includes(req.body.visible)) return res.status(400).json({ error: 'El valor visible debe ser verdadero o falso.' });
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute('UPDATE resenas SET visible = ? WHERE id_resena = ?', [Number(Boolean(req.body.visible)), req.params.id]);
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Reseña no encontrada.' });
    return res.json({ mensaje: 'Visibilidad de reseña actualizada.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo actualizar la reseña.');
  }
});

router.get('/fechas-especiales', ...fnCliente, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [fechas] = await pool.execute(
      'SELECT id_fecha, descripcion, fecha, dias_aviso, recordar FROM fechas_especiales WHERE id_usuario = ? ORDER BY fecha',
      [req.usuario.id]
    );
    return res.json(fechas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudieron consultar las fechas especiales.');
  }
});

router.post('/fechas-especiales', ...fnCliente, async (req, res) => {
  const descripcion = String(req.body.descripcion || '').trim();
  const diasAviso = Number(req.body.diasAviso ?? 7);
  if (!descripcion || !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.fecha || '')) || !Number.isInteger(diasAviso) || diasAviso < 0 || diasAviso > 365) {
    return res.status(400).json({ error: 'Descripción, fecha y días de aviso válidos son obligatorios.' });
  }
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute(
      'INSERT INTO fechas_especiales (id_usuario, descripcion, fecha, dias_aviso, recordar) VALUES (?, ?, ?, ?, ?)',
      [req.usuario.id, descripcion.slice(0, 100), req.body.fecha, diasAviso, req.body.recordar === false ? 0 : 1]
    );
    return res.status(201).json({ mensaje: 'Fecha especial guardada.', id_fecha: resultado.insertId });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo guardar la fecha especial.');
  }
});

router.delete('/fechas-especiales/:id', ...fnCliente, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute('DELETE FROM fechas_especiales WHERE id_fecha = ? AND id_usuario = ?', [req.params.id, req.usuario.id]);
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Fecha especial no encontrada.' });
    return res.json({ mensaje: 'Fecha especial eliminada.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo eliminar la fecha especial.');
  }
});

router.get('/notificaciones', fnAutenticado, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [notificaciones] = await pool.execute(
      'SELECT id_notificacion, id_pedido, tipo, mensaje, leida, fecha FROM notificaciones WHERE id_usuario = ? ORDER BY fecha DESC LIMIT 100',
      [req.usuario.id]
    );
    return res.json(notificaciones);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudieron consultar las notificaciones.');
  }
});

router.patch('/notificaciones/:id/leida', fnAutenticado, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute('UPDATE notificaciones SET leida = 1 WHERE id_notificacion = ? AND id_usuario = ?', [req.params.id, req.usuario.id]);
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Notificación no encontrada.' });
    return res.json({ mensaje: 'Notificación marcada como leída.' });
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo actualizar la notificación.');
  }
});

router.get('/reportes/ventas', ...fnAdmin, async (req, res) => {
  const periodo = req.query.periodo;
  const intervalos = { mensual: 'MONTH', trimestral: 'QUARTER', anual: 'YEAR' };
  if (!intervalos[periodo]) return res.status(400).json({ error: 'El periodo debe ser mensual, trimestral o anual.' });
  const agrupacion = {
    mensual: "DATE_FORMAT(fecha_pedido, '%Y-%m')",
    trimestral: "CONCAT(YEAR(fecha_pedido), '-T', QUARTER(fecha_pedido))",
    anual: 'YEAR(fecha_pedido)'
  }[periodo];
  try {
    fnExigirBaseDatos();
    const [filas] = await pool.execute(
      `SELECT ${agrupacion} AS periodo, COUNT(*) AS pedidos, SUM(total) AS ventas
       FROM pedidos WHERE estado = 'E' AND fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 1 ${intervalos[periodo]})
       GROUP BY ${agrupacion} ORDER BY periodo`
    );
    return res.json(filas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo generar el reporte de ventas.');
  }
});

router.get('/reportes/top-ramos', ...fnAdmin, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [filas] = await pool.execute(
      `SELECT r.id_ramo, r.nombre, SUM(d.cantidad) AS unidades, SUM(d.cantidad * d.precio_unitario) AS ventas
       FROM detalle_pedidos d JOIN pedidos p ON p.id_pedido = d.id_pedido
       JOIN ramos r ON r.id_ramo = d.id_ramo WHERE p.estado = 'E'
       GROUP BY r.id_ramo, r.nombre ORDER BY unidades DESC LIMIT 10`
    );
    return res.json(filas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo generar el reporte de ramos.');
  }
});

router.get('/reportes/categorias', ...fnAdmin, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [filas] = await pool.execute(
      `SELECT c.id_categoria, c.nombre, SUM(d.cantidad) AS unidades, SUM(d.cantidad * d.precio_unitario) AS ventas
       FROM detalle_pedidos d JOIN pedidos p ON p.id_pedido = d.id_pedido
       JOIN ramos r ON r.id_ramo = d.id_ramo JOIN categorias c ON c.id_categoria = r.id_categoria
       WHERE p.estado = 'E' GROUP BY c.id_categoria, c.nombre ORDER BY ventas DESC`
    );
    return res.json(filas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo generar el reporte por categorías.');
  }
});

router.get('/reportes/mermas', ...fnAdmin, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [filas] = await pool.execute(
      `SELECT f.id_flor, f.nombre, SUM(m.cantidad) AS cantidad, m.motivo, DATE(m.fecha) AS fecha
       FROM mermas m JOIN flores f ON f.id_flor = m.id_flor
       WHERE (? IS NULL OR m.fecha >= ?) GROUP BY f.id_flor, f.nombre, m.motivo, DATE(m.fecha)
       ORDER BY fecha DESC`,
      [req.query.desde || null, req.query.desde || null]
    );
    return res.json(filas);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudo generar el reporte de mermas.');
  }
});

router.get('/empleados', ...fnAdmin, async (req, res) => {
  try {
    fnExigirBaseDatos();
    const [empleados] = await pool.execute(
      `SELECT e.id_empleado, e.id_cargo, e.id_usuario, e.nombre, e.apellido, e.correo, e.telefono, e.dui,
        e.direccion, c.cargo, c.salario FROM empleados e LEFT JOIN cargos c ON c.id_cargo = e.id_cargo ORDER BY e.nombre`
    );
    return res.json(empleados);
  } catch (error) {
    return fnResponderError(res, error, 'No se pudieron consultar los empleados.');
  }
});

router.post('/empleados', ...fnAdmin, async (req, res) => {
  const { idCargo = null, idUsuario = null, nombre, apellido, correo, telefono = null, dui, direccion = null } = req.body;
  if (!String(nombre || '').trim() || !String(apellido || '').trim() || !String(correo || '').trim() || !String(dui || '').trim()) {
    return res.status(400).json({ error: 'Nombre, apellido, correo y DUI son obligatorios.' });
  }
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute(
      'INSERT INTO empleados (id_cargo, id_usuario, nombre, apellido, correo, telefono, dui, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [idCargo, idUsuario, nombre.trim(), apellido.trim(), correo.trim().toLowerCase(), telefono, dui.trim(), direccion]
    );
    return res.status(201).json({ mensaje: 'Empleado creado.', id_empleado: resultado.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario ya está vinculado a otro empleado.' });
    return fnResponderError(res, error, 'No se pudo crear el empleado.');
  }
});

router.put('/empleados/:id', ...fnAdmin, async (req, res) => {
  const { idCargo = null, idUsuario = null, nombre, apellido, correo, telefono = null, dui, direccion = null } = req.body;
  if (!String(nombre || '').trim() || !String(apellido || '').trim() || !String(correo || '').trim() || !String(dui || '').trim()) {
    return res.status(400).json({ error: 'Nombre, apellido, correo y DUI son obligatorios.' });
  }
  try {
    fnExigirBaseDatos();
    const [resultado] = await pool.execute(
      `UPDATE empleados SET id_cargo = ?, id_usuario = ?, nombre = ?, apellido = ?, correo = ?,
       telefono = ?, dui = ?, direccion = ? WHERE id_empleado = ?`,
      [idCargo, idUsuario, nombre.trim(), apellido.trim(), correo.trim().toLowerCase(), telefono, dui.trim(), direccion, req.params.id]
    );
    if (!resultado.affectedRows) return res.status(404).json({ error: 'Empleado no encontrado.' });
    return res.json({ mensaje: 'Empleado actualizado.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El usuario ya está vinculado a otro empleado.' });
    return fnResponderError(res, error, 'No se pudo actualizar el empleado.');
  }
});

module.exports = router;
