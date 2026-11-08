function fnValidarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function fnValidarTelefono(telefono) {
  return /^\+503\d{8}$/.test(String(telefono || ''));
}

function fnValidarFechaEntrega(fecha, hora) {
  if (!fecha || !hora) return false;
  const coincidenciaFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha));
  const coincidenciaHora = /^(\d{2}):(\d{2})$/.exec(String(hora));
  if (!coincidenciaFecha || !coincidenciaHora) return false;
  const [, anio, mes, dia] = coincidenciaFecha;
  const [, horas, minutos] = coincidenciaHora;
  if (Number(horas) > 23 || Number(minutos) > 59 || hora < '08:00' || hora > '20:00') return false;
  const fechaEntrega = new Date(Number(anio), Number(mes) - 1, Number(dia), Number(horas), Number(minutos));
  if (fechaEntrega.getFullYear() !== Number(anio) || fechaEntrega.getMonth() !== Number(mes) - 1 || fechaEntrega.getDate() !== Number(dia)) return false;
  const ahora = new Date();
  const diferenciaHoras = (fechaEntrega - ahora) / (1000 * 60 * 60);
  return diferenciaHoras >= 2;
}

module.exports = {
  fnValidarCorreo,
  fnValidarTelefono,
  fnValidarFechaEntrega
};
