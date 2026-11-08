const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { fnConsultar, fnEjecutar, fnUsarDatosLocales } = require('../config/db');

const router = express.Router();
const usuariosLocales = [];

const fnGenerarToken = (usuario) => jwt.sign({
  id: usuario.id_usuario,
  rol: usuario.rol,
  correo: usuario.correo,
  nombre: usuario.nombre,
  apellidos: usuario.apellidos
}, JWT_SECRET, { expiresIn: '8h' });

const usuarioLocal = {
  id_usuario: 1,
  nombre: 'Admin',
  apellidos: 'Sistema',
  correo: 'admin@telephaty.com',
  rol: 'administrador',
  contrasena: bcrypt.hashSync('12345678', 10)
};

router.post('/registro', async (req, res) => {
  try {
    const { nombre, apellidos, telefono, correo, direccion, contrasena, tipoCliente = 'persona' } = req.body;

    if (!nombre || !apellidos || !telefono || !correo || !contrasena) {
      return res.status(400).json({ error: 'Faltan datos obligatorios para el registro.' });
    }

    const telefonoCompleto = String(telefono).trim();
    if (!/^\+503\d{8}$/.test(telefonoCompleto)) {
      return res.status(400).json({ error: 'El teléfono debe incluir +503 y 8 dígitos.' });
    }

    if (String(contrasena).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    if (fnUsarDatosLocales()) {
      const correoNormalizado = correo.trim().toLowerCase();
      const existente = correoNormalizado === usuarioLocal.correo || usuariosLocales.some((usuario) => usuario.correo === correoNormalizado);
      if (existente) {
        return res.status(409).json({ error: 'El correo ya está registrado.' });
      }

      const usuario = {
        id_usuario: Date.now(),
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefonoCompleto,
        correo: correoNormalizado,
        direccion: direccion || '',
        rol: 'cliente',
        contrasena: await bcrypt.hash(contrasena, 10)
      };
      usuariosLocales.push(usuario);
      const respuestaUsuario = { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellidos: usuario.apellidos, correo: usuario.correo, rol: usuario.rol };
      return res.status(201).json({ mensaje: 'Usuario registrado correctamente.', token: fnGenerarToken(usuario), usuario: respuestaUsuario });
    }

    const existente = await fnConsultar('SELECT id_usuario FROM usuarios WHERE correo = ? LIMIT 1', [correo]);
    if (existente.length > 0) {
      return res.status(409).json({ error: 'El correo ya está registrado.' });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    const codigo = `USR-${Date.now().toString().slice(-5)}`;

    const resultado = await fnEjecutar(
      'INSERT INTO usuarios (codigo, nombre, apellidos, telefono, correo, direccion, contrasena, tipo_cliente, rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [codigo, nombre, apellidos, telefonoCompleto, correo, direccion || '', contrasenaHash, tipoCliente, 'cliente']
    );

    const usuario = { id_usuario: resultado.insertId, nombre, apellidos, correo, rol: 'cliente' };
    return res.status(201).json({ mensaje: 'Usuario registrado correctamente.', token: fnGenerarToken(usuario), usuario });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo registrar el usuario.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    if (fnUsarDatosLocales()) {
      const correoNormalizado = correo.trim().toLowerCase();
      const usuario = correoNormalizado === usuarioLocal.correo
        ? usuarioLocal
        : usuariosLocales.find((item) => item.correo === correoNormalizado);
      const valido = usuario && (await bcrypt.compare(contrasena, usuario.contrasena));
      if (!valido) {
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
      }

      const payload = { id: usuario.id_usuario, rol: usuario.rol, correo: usuario.correo, nombre: usuario.nombre, apellidos: usuario.apellidos };
      return res.json({ token: jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }), usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellidos: usuario.apellidos, rol: usuario.rol, correo: usuario.correo } });
    }

    const usuarios = await fnConsultar('SELECT * FROM usuarios WHERE correo = ? AND activo = 1 LIMIT 1', [correo]);
    if (!usuarios.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const usuario = usuarios[0];
    const valido = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!valido) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const payload = { id: usuario.id_usuario, rol: usuario.rol, correo: usuario.correo, nombre: usuario.nombre, apellidos: usuario.apellidos };
    return res.json({ token: jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }), usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, apellidos: usuario.apellidos, rol: usuario.rol, correo: usuario.correo } });
  } catch (error) {
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

module.exports = router;
