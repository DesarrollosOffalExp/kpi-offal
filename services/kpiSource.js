/**
 * Fuente de datos del tablero.
 *
 * Si están las credenciales de Microsoft Graph + la URL del archivo, lee el
 * KPI.xlsx del SharePoint y lo mapea al modelo del tablero. Si falta cualquier
 * cosa (o Graph falla), cae a datos MOCK — así el tablero siempre responde.
 *
 * No usa librerías de Graph: pide el token por client-credentials y llama a la
 * API REST de Excel de Graph con fetch (Node 18+). La API devuelve el rango usado
 * de cada hoja como matriz de valores JSON — no hace falta parsear el .xlsx.
 */
const { construirMock, PERIODOS } = require('./mockData');
const { HOJAS_IGNORADAS, ALIAS_SECTOR, ORDEN_SECTORES, COLUMNAS } = require('../config/kpiConfig');

const GRAPH = 'https://graph.microsoft.com/v1.0';

function graphConfigurado() {
  return !!(
    process.env.GRAPH_TENANT_ID &&
    process.env.GRAPH_CLIENT_ID &&
    process.env.GRAPH_CLIENT_SECRET &&
    process.env.KPI_FILE_SHARE_URL
  );
}

// ---- Cache en memoria ----
let cache = { data: null, ts: 0 };
function ttlMs() {
  return (parseInt(process.env.KPI_CACHE_TTL_SECONDS || '300', 10) || 300) * 1000;
}

// ---- Token de aplicación (client credentials) ----
async function obtenerToken() {
  const url = `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: process.env.GRAPH_CLIENT_ID,
    client_secret: process.env.GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token Graph falló (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

// La URL de compartir se codifica al formato "u!" que entiende /shares.
function encodeShareUrl(shareUrl) {
  const b64 = Buffer.from(shareUrl).toString('base64');
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

async function gget(path, token) {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph GET ${path} (${res.status}): ${await res.text()}`);
  return res.json();
}

// ---- Mapeo de una hoja (usedRange.values) → { nombre, kpis, distribucion } ----
// Aplica la convención descrita en config/kpiConfig.js. Ajustar acá cuando se
// conozca la estructura real del Excel.
function indiceColumna(encabezados, alias) {
  const low = encabezados.map((h) => String(h ?? '').trim().toLowerCase());
  for (const a of alias) {
    const i = low.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
}

function mapearHoja(nombreHoja, values) {
  if (!values || values.length < 2) return null;
  const encabezados = values[0];
  const iKpi = indiceColumna(encabezados, COLUMNAS.kpi);
  if (iKpi === -1) return null; // no parece una hoja de KPIs

  const iUnidad = indiceColumna(encabezados, COLUMNAS.unidad);
  const iMeta = indiceColumna(encabezados, COLUMNAS.meta);
  const iSentido = indiceColumna(encabezados, COLUMNAS.sentido);

  // Las columnas de período son las que no son campos conocidos y tienen encabezado.
  const camposConocidos = new Set([iKpi, iUnidad, iMeta, iSentido].filter((i) => i !== -1));
  const colsPeriodo = [];
  encabezados.forEach((h, i) => {
    if (!camposConocidos.has(i) && String(h ?? '').trim() !== '') colsPeriodo.push({ i, nombre: String(h).trim() });
  });

  const kpis = values.slice(1)
    .filter((fila) => String(fila[iKpi] ?? '').trim() !== '')
    .map((fila, idx) => {
      const unidad = iUnidad !== -1 ? String(fila[iUnidad] ?? '').trim() : '';
      return {
        id: `${nombreHoja}-${idx}`.toLowerCase().replace(/\s+/g, '-'),
        titulo: String(fila[iKpi]).trim(),
        unidad,
        formato: unidad === '%' ? 'porcentaje' : unidad === '$' ? 'moneda' : 'numero',
        sentido: iSentido !== -1 && String(fila[iSentido]).trim().toLowerCase().startsWith('d') ? 'down' : 'up',
        meta: iMeta !== -1 && fila[iMeta] !== '' && fila[iMeta] != null ? Number(fila[iMeta]) : null,
        serie: colsPeriodo.map((c) => ({ periodo: c.nombre, valor: Number(fila[c.i]) })),
      };
    });

  if (!kpis.length) return null;
  return { key: nombreHoja.toLowerCase().replace(/\s+/g, '-'), nombre: ALIAS_SECTOR[nombreHoja] || nombreHoja, kpis, distribucion: null };
}

async function leerDesdeGraph() {
  const token = await obtenerToken();
  const share = encodeShareUrl(process.env.KPI_FILE_SHARE_URL);

  // driveItem del archivo compartido.
  const item = await gget(`/shares/${share}/driveItem?$select=id,parentReference,name`, token);
  const driveId = item.parentReference.driveId;
  const itemId = item.id;
  const base = `/drives/${driveId}/items/${itemId}/workbook`;

  const hojas = (await gget(`${base}/worksheets?$select=name`, token)).value || [];
  const sectores = [];
  for (const h of hojas) {
    if (HOJAS_IGNORADAS.includes(h.name)) continue;
    const rango = await gget(
      `${base}/worksheets('${encodeURIComponent(h.name)}')/usedRange(valuesOnly=true)?$select=values`,
      token
    );
    const mapeado = mapearHoja(h.name, rango.values);
    if (mapeado) sectores.push(mapeado);
  }
  if (!sectores.length) throw new Error('El Excel no devolvió hojas de KPIs reconocibles.');

  ordenarSectores(sectores);
  const periodos = sectores[0]?.kpis[0]?.serie.map((s) => s.periodo) || PERIODOS;
  return { origen: 'graph', actualizado: new Date().toISOString(), archivo: item.name, periodos, sectores };
}

function ordenarSectores(sectores) {
  sectores.sort((a, b) => {
    const ia = ORDEN_SECTORES.indexOf(a.nombre);
    const ib = ORDEN_SECTORES.indexOf(b.nombre);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/**
 * Devuelve los datos del tablero (con cache). Nunca lanza: ante cualquier
 * problema con Graph, cae a mock y lo señala en el campo `origen`.
 */
async function getKpis({ forzar = false } = {}) {
  if (!forzar && cache.data && Date.now() - cache.ts < ttlMs()) return cache.data;

  let data;
  if (graphConfigurado()) {
    try {
      data = await leerDesdeGraph();
    } catch (err) {
      console.error('[KPI] Graph falló, usando mock:', err.message);
      data = { ...construirMock(), origen: 'mock', aviso: 'No se pudo leer el Excel; mostrando datos de ejemplo.' };
    }
  } else {
    data = construirMock();
  }

  cache = { data, ts: Date.now() };
  return data;
}

module.exports = { getKpis, graphConfigurado };
