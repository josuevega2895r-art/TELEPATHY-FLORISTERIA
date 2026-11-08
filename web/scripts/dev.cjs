'use strict';

const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const webDirectory = path.resolve(__dirname, '..');
const backendDirectory = path.resolve(webDirectory, '..', 'backend');
const vitePackageJson = require.resolve('vite/package.json', { paths: [webDirectory] });
const viteCliPath = path.join(path.dirname(vitePackageJson), 'bin', 'vite.js');
const apiHealthUrl = 'http://127.0.0.1:4000/api/salud';
const apiStartupTimeoutMs = 30000;
const apiCheckIntervalMs = 500;

let backendProcess = null;
let viteProcess = null;
let isShuttingDown = false;
let apiRestartDelayMs = 1000;

async function fnApiDisponible() {
  try {
    const response = await fetch(apiHealthUrl, {
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json();
    return response.ok && data.status === 'ok';
  } catch {
    return false;
  }
}

function fnPuertoApiOcupado() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 4000 });
    let terminado = false;
    const fnCompletar = (ocupado) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      resolve(ocupado);
    };

    socket.once('connect', () => fnCompletar(true));
    socket.once('timeout', () => fnCompletar(true));
    socket.once('error', (error) => {
      if (terminado) return;
      if (error.code === 'ECONNREFUSED') {
        fnCompletar(false);
        return;
      }
      terminado = true;
      socket.destroy();
      reject(error);
    });
    socket.setTimeout(1000);
  });
}

function fnEsperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fnDetener(exitCode, sourceProcess = null) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.exitCode = exitCode;

  for (const child of [backendProcess, viteProcess]) {
    if (child && child !== sourceProcess && child.exitCode === null && !child.killed) {
      child.kill();
    }
  }
}

function fnSupervisarVite(child) {
  child.on('error', (error) => {
    console.error(`No se pudo iniciar Vite: ${error.message}`);
    fnDetener(1, child);
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    console.error(`Vite finalizó inesperadamente (${signal || `código ${code}`}).`);
    fnDetener(code || 1, child);
  });
}

async function fnIniciarBackend() {
  if (backendProcess && backendProcess.exitCode === null) return true;
  if (await fnPuertoApiOcupado()) {
    if (await fnApiDisponible()) return true;
    console.error('El puerto 4000 está ocupado, pero la API no responde; se esperará sin iniciar un proceso duplicado.');
    return false;
  }
  if (await fnApiDisponible()) return true;

  console.log('Iniciando la API con la configuración de backend/.env...');
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDirectory,
    stdio: 'inherit'
  });
  backendProcess = child;

  child.on('error', (error) => {
    console.error(`No se pudo iniciar la API: ${error.message}`);
    if (backendProcess === child) backendProcess = null;
  });

  child.on('exit', (code, signal) => {
    if (backendProcess === child) backendProcess = null;
    if (!isShuttingDown) {
      console.error(`La API finalizó inesperadamente (${signal || `código ${code}`}).`);
    }
  });
  return true;
}

async function fnEsperarApi(timeoutMs = apiStartupTimeoutMs, detenerSiBackendFalla = false) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !isShuttingDown) {
    if (await fnApiDisponible()) return true;
    if (detenerSiBackendFalla && !backendProcess) return false;
    await fnEsperar(apiCheckIntervalMs);
  }
  return false;
}

async function fnSupervisarApi() {
  while (!isShuttingDown) {
    await fnEsperar(1000);
    if (isShuttingDown) return;
    if (await fnApiDisponible()) {
      apiRestartDelayMs = 1000;
      continue;
    }

    console.error('La API no responde; se intentará reiniciar el backend.');
    if (!(await fnIniciarBackend())) {
      await fnEsperar(apiRestartDelayMs);
      apiRestartDelayMs = Math.min(apiRestartDelayMs * 2, 30000);
      continue;
    }

    if (await fnEsperarApi(10000)) continue;
    if (isShuttingDown) return;

    console.error(`La API sigue sin responder; nuevo intento en ${apiRestartDelayMs / 1000} s.`);
    await fnEsperar(apiRestartDelayMs);
    apiRestartDelayMs = Math.min(apiRestartDelayMs * 2, 30000);
  }
}

async function fnIniciarDesarrollo() {
  if (!(await fnApiDisponible())) {
    const inicioPermitido = await fnIniciarBackend();

    if (!inicioPermitido || !(await fnEsperarApi(apiStartupTimeoutMs, true))) {
      if (!isShuttingDown) {
        console.error('La API no respondió en el puerto 4000 después de 30 segundos.');
        fnDetener(1);
      }
      return;
    }
  } else {
    console.log('Usando la API que ya está activa en el puerto 4000.');
  }

  if (isShuttingDown) return;

  viteProcess = spawn(
    process.execPath,
    [viteCliPath, ...process.argv.slice(2)],
    {
      cwd: webDirectory,
      stdio: 'inherit'
    }
  );
  fnSupervisarVite(viteProcess);
  fnSupervisarApi();
}

process.on('SIGINT', () => fnDetener(130));
process.on('SIGTERM', () => fnDetener(143));

fnIniciarDesarrollo().catch((error) => {
  console.error(`No se pudo iniciar el entorno de desarrollo: ${error.message}`);
  fnDetener(1);
});
