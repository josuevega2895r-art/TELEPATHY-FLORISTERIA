const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'telephaty-dev-secret';

function fnVerificarToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Sesión no válida. Inicia sesión nuevamente.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

function fnExigirRol(rolRequerido) {
  return (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== rolRequerido) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
    }
    next();
  };
}

module.exports = {
  fnVerificarToken,
  fnExigirRol,
  JWT_SECRET
};
