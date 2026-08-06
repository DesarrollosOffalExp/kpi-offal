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

const DIAS_ABBR = { lunes: 'Lun', martes: 'Mar', 'miércoles': 'Mié', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', 'sábado': 'Sáb', sabado: 'Sáb', domingo: 'Dom' };

function etiqueta(v) {
  const s = String(v ?? '').trim();
  const m = MESES_ABBR[s.toLowerCase()];
  if (m) return m;
  const d = DIAS_ABBR[s.toLowerCase()];
  if (d) return d;
  const sem = s.match(/S\s*(\d+)/i); // "Máx S 23" → "S23"
  if (sem) return 'S' + sem[1];
  return s;
}

// Letra de columna Excel → índice 0-based ("A"→0, "R"→17, "L"→11, "AA"→26).
function colIdx(s) {
  let n = 0;
  for (const ch of String(s).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
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
      kpis.push({ id: k.id, titulo: k.titulo, unidad: k.unidad, formato: k.formato, sentido: k.sentido, meta: k.meta, valor, desglose, info: k.info, ...(k.grupo ? { grupo: k.grupo } : {}) });
      continue;
    }
    const periodos = (await rango(k.periodos.range)).map(etiqueta);
    const valores = (await rango(k.valores.range)).map((v) => normalizarValor(v, k.formato));
    const serie = periodos
      .map((p, i) => ({ periodo: p, valor: valores[i] }))
      .filter((pt) => pt.periodo !== '' && pt.valor != null);
    kpis.push({ id: k.id, titulo: k.titulo, unidad: k.unidad, formato: k.formato, sentido: k.sentido, meta: k.meta, serie, info: k.info, ...(k.grupo ? { grupo: k.grupo } : {}) });
  }

  // Gráficos: pueden derivar de los KPIs (por id, ej. INSUMOS) o leer sus propios
  // rangos (ej. FÁBRICA DE HIELO: series diarias de una tabla semanal).
  const porId = new Map(kpis.map((k) => [k.id, k]));
  async function construirGrafico(g) {
    if (g.desde) { // derivado de KPIs ya leídos
      if (g.tipo === 'line') {
        const fuentes = (Array.isArray(g.desde) ? g.desde : [g.desde]).map((id) => porId.get(id)).filter(Boolean);
        return { tipo: 'line', titulo: g.titulo, info: g.info,
          periodos: fuentes[0]?.serie.map((p) => p.periodo) || [],
          series: fuentes.map((k) => ({ nombre: k.titulo, datos: k.serie.map((p) => p.valor) })) };
      }
      const k = porId.get(g.desde);
      return { tipo: 'bar', titulo: g.titulo, info: g.info, datos: (k?.serie || []).map((p) => ({ nombre: p.periodo, valor: p.valor })) };
    }
    if (g.tipo === 'line') { // rangos propios
      const labels = (await rango(g.periodos.range)).map(etiqueta);
      const series = [];
      for (const s of g.series) series.push({ nombre: s.nombre, vals: (await rango(s.valores.range)).map((v) => normalizarValor(v, 'numero')) });
      const keep = labels.map((l, i) => (l !== '' ? i : -1)).filter((i) => i >= 0);
      return { tipo: 'line', titulo: g.titulo, info: g.info,
        periodos: keep.map((i) => labels[i]),
        series: series.map((s) => ({ nombre: s.nombre, datos: keep.map((i) => s.vals[i]) })) };
    }
    const cats = (await rango(g.categorias.range)).map(etiqueta);
    const vals = (await rango(g.valores.range)).map((v) => normalizarValor(v, 'numero'));
    let datos = [];
    cats.forEach((c, i) => { if (c !== '') datos.push({ nombre: c, valor: vals[i] }); });
    if (g.top) datos = datos.filter((d) => d.valor != null).sort((a, b) => b.valor - a.valor).slice(0, g.top);
    return { tipo: 'bar', titulo: g.titulo, info: g.info, datos, ...(g.horizontal ? { horizontal: true } : {}) };
  }
  const graficos = [];
  for (const g of hoja.graficos || []) { const gr = await construirGrafico(g); if (g.grupo) gr.grupo = g.grupo; graficos.push(gr); }

  let periodo;
  if (hoja.periodoCell) {
    const raw = String((await celda(hoja.periodoCell)) ?? '').trim();
    const m = raw.match(/semana\s*(\d+)/i);
    periodo = m ? `Semana ${m[1]}` : raw || undefined;
  }

  return { key: hoja.sector.toLowerCase().replace(/\s+/g, '-'), nombre: hoja.sector, estado: 'ok', ...(periodo ? { periodo } : {}), kpis, graficos };
}

// ---- Lectura de una hoja en modo "última semana" (una sola fila) ----
// Cada fila es una semana; se toma la de la ÚLTIMA semana (máx. de columnaSemana)
// y se leen las columnas A→R de esa fila. Es una foto, no una serie.
async function leerUltimaSemana(hoja, base, token) {
  async function rango(address) {
    const r = await gget(`${base}/worksheets('${encodeURIComponent(hoja.sheet)}')/range(address='${address}')?$select=values`, token);
    return aplanar(r.values);
  }

  const col = hoja.columnaSemana;
  const semanas = await rango(`${col}${hoja.filas.desde}:${col}${hoja.filas.hasta}`);
  let idx = -1, maxSem = -Infinity;
  semanas.forEach((v, i) => { const n = Number(v); if (v !== '' && v != null && !Number.isNaN(n) && n > maxSem) { maxSem = n; idx = i; } });
  if (idx < 0) throw new Error(`${hoja.sheet}: no encontré semanas en la columna ${col}.`);

  const fila = hoja.filas.desde + idx;
  const desde = hoja.columnas?.desde || 'A';
  const hasta = hoja.columnas?.hasta || 'R';
  const valores = await rango(`${desde}${fila}:${hasta}${fila}`);
  const baseIdx = colIdx(desde);
  const valCol = (letra) => valores[colIdx(letra) - baseIdx]; // relativo a la 1ª columna

  const kpis = hoja.kpis.map((k) => {
    const base_ = { id: k.id, titulo: k.titulo, unidad: k.unidad || '', formato: k.formato, sentido: k.sentido, meta: k.meta ?? null, info: k.info };
    base_.valor = normalizarValor(valCol(k.col), k.formato);
    if (k.desglose) base_.desglose = k.desglose.map((d) => ({ nombre: d.nombre, valor: normalizarValor(valCol(d.col), k.formato) }));
    return base_;
  });

  const graficos = (hoja.graficos || []).map((g) => ({
    tipo: 'bar', titulo: g.titulo, info: g.info,
    datos: g.columnas.map((c) => ({ nombre: c.nombre, valor: normalizarValor(valCol(c.col), 'numero') })),
  }));

  return { key: hoja.sector.toLowerCase().replace(/\s+/g, '-'), nombre: hoja.sector, estado: 'ok', periodo: `Semana ${maxSem}`, kpis, graficos };
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
    sectores.push(hoja.modo === 'ultimaSemana' ? await leerUltimaSemana(hoja, base, token) : await leerHoja(hoja, base, token));
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
