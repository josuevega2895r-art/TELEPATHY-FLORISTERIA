const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { pool } = require('../config/db');

async function fnGuardarAdministrador() {
  const correo = (process.env.ADMIN_EMAIL || 'admin@telephaty.com').trim().toLowerCase();
  const contrasena = process.env.ADMIN_PASSWORD || '12345678';
  const hash = await bcrypt.hash(contrasena, 10);
  const [usuarios] = await pool.execute('SELECT id_usuario FROM usuarios WHERE correo = ? LIMIT 1', [correo]);

  if (usuarios.length) {
    await pool.execute(
      'UPDATE usuarios SET nombre = ?, apellidos = ?, rol = ?, activo = 1, contrasena = ? WHERE id_usuario = ?',
      ['Admin', 'Sistema', 'administrador', hash, usuarios[0].id_usuario]
    );
  } else {
    await pool.execute(
      `INSERT INTO usuarios (codigo, nombre, apellidos, telefono, correo, direccion, contrasena, tipo_cliente, rol, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'persona', 'administrador', 1)`,
      [`ADM-${Date.now()}`, 'Admin', 'Sistema', '70000001', correo, 'San Salvador', hash]
    );
  }

  console.log(`Administrador guardado en MySQL: ${correo}`);
}

fnGuardarAdministrador()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());