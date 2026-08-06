/**
 * Fuente de datos del tablero.
 *
 * Si están las credenciales de Microsoft Graph + la URL del archivo, lee el
 * KPI.xlsx del SharePoint POR RANGOS EXPLÍCITOS (los declarados en kpiConfig.HOJAS)
 * y lo mapea al modelo del tablero. Si falta cualquier cosa (o Graph falla), cae a
 * datos MOCK — así el tablero siempre responde.
 *
 * No usa librerías de Graph: pide el token por client-credentials y llama a la API
 * REST de Excel de Graph con fetch (Node 18+). Cada rango se lee con
 * .../worksheets('HOJA')/range(address='P7:P18')?$select=values — devuelve los
 * valores como matriz JSON, sin parsear el .xlsx.
 */
const { construirMock } = require('./mockData');
const { HOJAS, ORDEN_SECTORES } = require('../config/kpiConfig');

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
const ttlMs = () => (parseInt(process.env.KPI_CACHE_TTL_SECONDS || '300', 10) || 300) * 1000;

// ---- Token de aplicación (client credentials) ----
async function obtenerToken() {
  const url = `https://login.microsoftonline.com/${process.env.GRAPH_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: process.env.GRAPH_CLIENT_ID,
    client_secret: process.env.GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`Token Graph falló (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

function encodeShareUrl(shareUrl) {
  const b64 = Buffer.from(shareUrl).toString('base64');
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

async function gget(path, token) {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph GET ${path} (${res.status}): ${await res.text()}`);
  return res.json();
}

// ---- Helpers de normalización ----
const MESES_ABBR = { enero: 'Ene', febrero: 'Feb', marzo: 'Mar', abril: 'Abr', mayo: 'May', junio: 'Jun',
  julio: 'Jul', agosto: 'Ago', septiembre: 'Sep', octubre: 'Oct', noviembre: 'Nov', diciembre: 'Dic' };

function etiqueta(v) {
  const s = String(v ?? '').trim();
  const m = MESES_ABBR[s.toLowerCase()];
  if (m) return m;
  const sem = s.match(/S\s*(\d+)/i); // "Máx S 23" → "S23"
  if (sem) return 'S' + sem[1];
  return s;
}

// Aplana la matriz de un rango a un array 1D (fila o columna).
function aplanar(values) {
  if (!Array.isArray(values)) return [];
  if (values.length === 1) return values[0];           // rango horizontal
  return values.map((fila) => (Array.isArray(fila) ? fila[0] : fila)); // vertical
}

function normalizarValor(v, formato) {
  if (v === '' || v == null) return null;
  let n = Number(v);
  if (Number.isNaN(n)) return null;
  if (formato === 'porcentaje' && Math.abs(n) <= 1.5) n = n * 100; // Graph devuelve fracción
  return Math.round(n * 100) / 100;
}

// ---- Lectura de una hoja ----
async function leerHoja(hoja, base, token) {
  async function rango(address) {
    const r = await gget(`${base}/worksheets('${encodeURIComponent(hoja.sheet)}')/range(address='${address}')?$select=values`, token);
    return aplanar(r.values);
  }
  async function celda(address) {
    const v = await rango(address);
    return v[0];
  }

  const kpis = [];
  for (const k of hoja.kpis) {
    if (k.tipo === 'valor') {
      const valor = normalizarValor(await celda(k.valor.cell), k.formato);
      const desglose = [];
      for (const d of k.desglose || []) desglose.push({ nombre: d.nombre, valor: normalizarValor(await celda(d.cell), k.formato) });
      kpis.push({ id: k.id, titulo: k.titulo, unidad: k.unidad, formato: k.formato, sentido: k.sentido, meta: k.meta, valor, desglose, info: k.info });
      continue;
    }
    const periodos = (await rango(k.periodos.range)).map(etiqueta);
    const valores = (await rango(k.valores.range)).map((v) => normalizarValor(v, k.formato));
    const serie = periodos
      .map((p, i) => ({ periodo: p, valor: valores[i] }))
      .filter((pt) => pt.periodo !== '' && pt.valor != null);
    kpis.push({ id: k.id, titulo: k.titulo, unidad: k.unidad, formato: k.formato, sentido: k.sentido, meta: k.meta, serie, info: k.info });
  }

  // Gráficos derivados de los KPIs ya leídos (por id).
  const porId = new Map(kpis.map((k) => [k.id, k]));
  const graficos = (hoja.graficos || []).map((g) => {
    if (g.tipo === 'line') {
      const fuentes = g.desde.map((id) => porId.get(id)).filter(Boolean);
      const periodos = fuentes[0]?.serie.map((p) => p.periodo) || [];
      return { tipo: 'line', titulo: g.titulo, info: g.info, periodos,
        series: fuentes.map((k) => ({ nombre: k.titulo, datos: k.serie.map((p) => p.valor) })) };
    }
    const k = porId.get(g.desde);
    return { tipo: 'bar', titulo: g.titulo, info: g.info, datos: (k?.serie || []).map((p) => ({ nombre: p.periodo, valor: p.valor })) };
  });

  return { key: hoja.sector.toLowerCase().replace(/\s+/g, '-'), nombre: hoja.sector, estado: 'ok', kpis, graficos };
}

async function leerDesdeGraph() {
  const token = await obtenerToken();
  const share = encodeShareUrl(process.env.KPI_FILE_SHARE_URL);
  const item = await gget(`/shares/${share}/driveItem?$select=id,parentReference,name`, token);
  const base = `/drives/${item.parentReference.driveId}/items/${item.id}/workbook`;

  const sectores = [];
  for (const hoja of HOJAS) {
    if (hoja.pendiente) {
      sectores.push({ key: hoja.sector.toLowerCase().replace(/\s+/g, '-'), nombre: hoja.sector, estado: 'pendiente', kpis: [], graficos: [] });
      continue;
    }
    sectores.push(await leerHoja(hoja, base, token));
  }
  sectores.sort((a, b) => ORDEN_SECTORES.indexOf(a.nombre) - ORDEN_SECTORES.indexOf(b.nombre));
  return { origen: 'graph', actualizado: new Date().toISOString(), archivo: item.name, sectores };
}

/**
 * Devuelve los datos del tablero (con cache). Nunca lanza: ante cualquier problema
 * con Graph, cae a mock y lo señala en el campo `origen`.
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
