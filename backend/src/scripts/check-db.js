const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { pool, fnUsarDatosLocales } = require('../config/db');

async function fnVerificarConexion() {
  if (fnUsarDatosLocales()) {
    throw new Error('No hay variables MYSQL configuradas; la aplicación usaría el modo local.');
  }

  const conexion = await pool.getConnection();
  try {
    const [filas] = await conexion.query('SELECT 1 AS conectado, DATABASE() AS base_actual');
    console.log('Conexión MySQL: OK');
    console.log(`Base seleccionada: ${filas[0].base_actual}`);
  } finally {
    conexion.release();
  }
}

fnVerificarConexion()
  .catch((error) => {
    console.error(`Conexión MySQL: ERROR (${error.code || 'sin configuración'})`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());