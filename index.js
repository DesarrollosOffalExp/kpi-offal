const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const auth = require('./middlewares/auth');
const { getKpis, graphConfigurado } = require('./services/kpiSource');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3006;

// Cabeceras de seguridad. CSP off (uno mal puesto deja la pantalla en blanco);
// no forzamos políticas cross-origin para no romper fuentes/imágenes externas.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ credentials: true }));
app.use(express.json());

// Frontend compilado (React).
app.use(express.static(path.join(__dirname, 'client/dist')));

// Health check público para el probe del App Service.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', fuente: graphConfigurado() ? 'graph' : 'mock' });
});

// GET /api/me — identidad de la persona (para el chip de usuario del navbar).
app.get('/api/me', auth, (req, res) => {
  res.json({
    nombre: req.user.Nombre,
    email: req.user.Email,
    rol: req.user.rol,
    registrado: req.user.registrado,
  });
});

// GET /api/kpis — datos del tablero (Excel vía Graph, o mock).
// ?forzar=1 saltea la cache (para el botón "Actualizar").
app.get('/api/kpis', auth, async (req, res) => {
  try {
    const data = await getKpis({ forzar: req.query.forzar === '1' });
    res.json(data);
  } catch (err) {
    console.error('[KPI] /api/kpis error:', err.message);
    res.status(500).json({ mensaje: 'No se pudieron cargar los indicadores.' });
  }
});

// SPA fallback.
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('El frontend aún no fue compilado. Ejecute: npm run client:build');
  }
});

app.listen(PORT, () => {
  console.log(`📊 Tablero KPI Offal en http://localhost:${PORT}`);
  console.log(`   Fuente de datos: ${graphConfigurado() ? 'Microsoft Graph (Excel real)' : 'MOCK (datos de ejemplo)'}`);
});
