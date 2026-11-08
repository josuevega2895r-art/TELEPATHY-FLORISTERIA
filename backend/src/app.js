const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const businessRoutes = require('./routes/businessRoutes');
const specRoutes = require('./routes/specRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/salud', (req, res) => {
  res.json({ status: 'ok', servicio: 'telephaty-api', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', businessRoutes);
app.use('/api', specRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

module.exports = app;
