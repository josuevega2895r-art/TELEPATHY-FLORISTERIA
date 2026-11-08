require('dotenv').config();
const mysql = require('mysql2/promise');

const { MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE } = process.env;

const cfg = {
  host: MYSQLHOST || '127.0.0.1',
  port: Number(MYSQLPORT || 3306),
  user: MYSQLUSER || 'root',
  password: MYSQLPASSWORD || 'root',
  database: MYSQLDATABASE || 'telephaty',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const pool = mysql.createPool(cfg);

function fnUsarDatosLocales() {
  return process.env.NODE_ENV === 'test'
    || (process.env.NODE_ENV !== 'production' && !MYSQLHOST && !MYSQLUSER && !MYSQLPASSWORD && !MYSQLDATABASE);
}

async function fnConsultar(query, params = []) {
  if (fnUsarDatosLocales()) {
    return [];
  }
  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('DB error (consulta):', error.code, error.message);
    throw error;
  }
}

async function fnEjecutar(query, params = []) {
  if (fnUsarDatosLocales()) {
    return { insertId: Date.now() };
  }
  try {
    const [result] = await pool.execute(query, params);
    return result;
  } catch (error) {
    console.error('DB error (ejecución):', error.code, error.message);
    throw error;
  }
}

module.exports = {
  pool,
  fnConsultar,
  fnEjecutar,
  cfg,
  fnUsarDatosLocales
};