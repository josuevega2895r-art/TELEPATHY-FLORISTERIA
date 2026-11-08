function fnValidarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function fnValidarTelefono(telefono) {
  return /^\d{8,10}$/.test(telefono);
}

function fnValidarFechaEntrega(fecha, hora) {
  if (!fecha || !hora) return false;
  const fechaEntrega = new Date(`${fecha}T${hora}:00`);
  const ahora = new Date();
  const diferenciaHoras = (fechaEntrega - ahora) / (1000 * 60 * 60);
  return diferenciaHoras >= 2;
}

module.exports = {
  fnValidarCorreo,
  fnValidarTelefono,
  fnValidarFechaEntrega
};
