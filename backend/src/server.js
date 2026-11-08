const app = require('./app');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Telephaty API escuchando en http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`No se pudo iniciar la API: el puerto ${PORT} ya está ocupado. Detén el otro proceso o usa un puerto distinto.`);
    process.exit(1);
  }

  console.error('No se pudo iniciar la API:', error.message);
  process.exit(1);
});
