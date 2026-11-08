const cron = require('node-cron');
const { pool } = require('../config/db');

/**
 * Nombre: fnEjecutarAlertasDiarias
 * Descripcion: Genera avisos de inventario, pedidos próximos y fechas especiales.
 * Funcionamiento: Ejecuta consultas parametrizadas y evita duplicar avisos del mismo día por usuario.
 * Retorna: Una promesa que finaliza cuando termina el lote.
 */
async function fnEjecutarAlertasDiarias() {
  const [flores] = await pool.execute(
    `SELECT id_flor, nombre FROM flores WHERE stock <= stock_minimo`
  );
  for (const flor of flores) {
    const mensaje = `Stock bajo de ${flor.nombre}. Revisa el inventario.`;
    await pool.execute(
      `INSERT INTO notificaciones (id_usuario, tipo, mensaje)
       SELECT u.id_usuario, 'inventario', ?
       FROM usuarios u
       WHERE u.rol = 'administrador' AND u.activo = 1
         AND NOT EXISTS (
           SELECT 1 FROM notificaciones n
           WHERE n.id_usuario = u.id_usuario AND n.tipo = 'inventario'
             AND n.mensaje = ? AND DATE(n.fecha) = CURDATE()
         )`,
      [mensaje, mensaje]
    );
  }

  const [pedidos] = await pool.execute(
    `SELECT p.id_pedido, p.id_usuario, p.nombre_destinatario
     FROM pedidos p
     WHERE p.estado = 'P'
       AND TIMESTAMP(p.fecha_entrega, p.hora_desde) BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 HOUR)`
  );
  for (const pedido of pedidos) {
    const mensaje = `El pedido PED-${pedido.id_pedido} está programado en menos de 3 horas y aún no inicia.`;
    await pool.execute(
      `INSERT INTO notificaciones (id_usuario, id_pedido, tipo, mensaje)
       SELECT u.id_usuario, ?, 'pedido', ? FROM usuarios u
       WHERE u.rol = 'administrador' AND u.activo = 1
         AND NOT EXISTS (
           SELECT 1 FROM notificaciones n
           WHERE n.id_usuario = u.id_usuario AND n.id_pedido = ?
             AND n.tipo = 'pedido' AND n.mensaje = ? AND DATE(n.fecha) = CURDATE()
         )`,
      [pedido.id_pedido, mensaje, pedido.id_pedido, mensaje]
    );
  }

  const [fechas] = await pool.execute(
    `SELECT f.id_usuario, f.descripcion, f.fecha, f.dias_aviso
     FROM fechas_especiales f
     WHERE f.recordar = 1
       AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL f.dias_aviso DAY), '%m-%d') = DATE_FORMAT(f.fecha, '%m-%d')`
  );
  for (const fecha of fechas) {
    const mensaje = `Se acerca tu fecha especial: ${fecha.descripcion}.`;
    await pool.execute(
      `INSERT INTO notificaciones (id_usuario, tipo, mensaje)
       SELECT ?, 'fecha_especial', ?
       WHERE NOT EXISTS (
         SELECT 1 FROM notificaciones n
         WHERE n.id_usuario = ? AND n.tipo = 'fecha_especial'
           AND n.mensaje = ? AND DATE(n.fecha) = CURDATE()
       )`,
      [fecha.id_usuario, mensaje, fecha.id_usuario, mensaje]
    );
  }
}

/**
 * Nombre: fnProgramarAlertasDiarias
 * Descripcion: Programa la ejecución diaria de las alertas de negocio.
 * Funcionamiento: Usa node-cron en la zona horaria de El Salvador y registra fallos explícitamente.
 * Retorna: La tarea cron iniciada.
 */
function fnProgramarAlertasDiarias() {
  return cron.schedule('0 7 * * *', () => {
    fnEjecutarAlertasDiarias().catch((error) => {
      console.error('No se pudieron generar las alertas diarias:', error.code, error.message);
    });
  }, { timezone: 'America/El_Salvador' });
}

module.exports = { fnEjecutarAlertasDiarias, fnProgramarAlertasDiarias };
