// Objetivos estratégicos de la gerencia y las métricas de Sistemas.
// La cuenta de cada dato está en tools/fuentes.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const ARCHIVO = 'KPI_GerencinadeOperaciones_2026.xlsx';

const MES = ['nov-25', 'dic-25', 'ene-26', 'feb-26', 'mar-26', 'abr-26', 'may-26', 'jun-26', 'jul-26', 'ago-26', 'sept-26', 'oct-26', 'nov-26', 'dic-26'];
const M12 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const KEY = { 'Insumos': 'insumos', 'Compras': 'compras', 'Logistica': 'logística', 'Fabrica de Hielo': 'fábrica-de-hielo', 'Sistemas': 'sistemas', 'TODOS': 'todos' };
const NOM = { 'Logistica': 'Logística', 'Fabrica de Hielo': 'Fábrica de Hielo' };

exports.actualizar = async function ({ leer, escribir, log, dry, util }) {
  const { num, txt } = util;
  const wb = leer(ARCHIVO);
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const val = v => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return { t: 'n', v };
    const s = String(v).trim();
    if (!s) return null;
    if (/^n\/?a$/i.test(s)) return { t: 'na' };
    return { t: 's', v: s };
  };
  const r6 = x => x == null ? null : Math.round(x * 1e6) / 1e6;

  /* ═══ objetivos estratégicos de todas las áreas ═══ */
  log('· Objetivos estratégicos');
  const objetivos = [];
  wb.filas('ObjetivosMensuales').slice(2).forEach((r, i) => {
    if (!r || !r[1]) return;
    objetivos.push({
      id: 'O' + (i + 1), obj: txt(r[1]), area: NOM[txt(r[2])] || txt(r[2]) || '',
      areaKey: KEY[txt(r[2])] || norm(r[2]), resp: txt(r[3]) || '',
      meta: val(r[4]), vals: MES.slice(0, 12).map((m, k) => val(r[5 + k])),
      prom: val(r[17]), vsMeta: val(r[18]), estado: txt(r[19]), kpis: [],
    });
  });
  wb.filas('Carga Mensual KPI').slice(2).forEach(r => {
    if (!r || !r[2] || !r[1]) return;
    const k = {
      n: r[0], kpi: txt(r[2]), area: NOM[txt(r[3])] || txt(r[3]) || '',
      peso: typeof r[5] === 'number' ? (r[5] > 1 ? r[5] / 100 : r[5]) : null,
      vals: M12.map((m, j) => val(r[7 + j])), prom: val(r[19]), estado: txt(r[21]),
    };
    // el KPI del área TODOS es transversal: se asigna a ese objetivo en cada área
    const destinos = norm(r[3]) === 'todos'
      ? objetivos.filter(x => norm(x.obj) === norm(r[1]))
      : objetivos.filter(x => norm(x.obj) === norm(r[1]) && norm(x.area) === norm(k.area));
    if (!destinos.length) log('   ! KPI sin objetivo: ' + k.kpi.slice(0, 50));
    destinos.forEach(o => o.kpis.push(Object.assign({}, k)));
  });
  // sentido: se deduce del veredicto de la planilla; si no alcanza, por la meta
  objetivos.forEach(o => {
    let s = null;
    if (o.meta && o.meta.t === 'n' && o.prom && o.prom.t === 'n' && o.estado) {
      const logrado = o.estado.indexOf('No logrado') < 0 && o.estado.indexOf('✅') >= 0;
      s = (o.prom.v >= o.meta.v) === logrado ? 'up' : 'down';
    }
    o.sentido = s || (o.meta && o.meta.t === 'n' && o.meta.v >= 0.5 ? 'up' : 'down');
    // el número compuesto: promedio ponderado por peso sobre los KPI con valor
    o.comp = M12.map((m, i) => {
      let sw = 0, sv = 0, n = 0;
      o.kpis.forEach(k => {
        const v = k.vals[i];
        if (!v || v.t !== 'n' || k.peso == null) return;
        sw += k.peso; sv += v.v * k.peso; n++;
      });
      return sw > 0 ? { v: r6(sv / sw), n, peso: r6(sw) } : null;
    });
    const con = o.comp.filter(Boolean);
    o.compProm = con.length ? r6(con.reduce((a, c) => a + c.v, 0) / con.length) : null;
    o.pesoTotal = r6(o.kpis.reduce((a, k) => a + (k.peso || 0), 0));
  });
  const areas = [...new Set(objetivos.map(o => o.area))].filter(a => a && a !== 'TODOS');
  log('   ' + objetivos.length + ' objetivos · ' + areas.length + ' áreas · ' +
    objetivos.reduce((a, o) => a + o.kpis.length, 0) + ' KPI asignados');
  objetivos.forEach(o => {
    const p = o.vals.map((c, i) => c && c.t === 'n' ? i : -1).filter(i => i >= 0);
    if (p.length) log('     ' + o.area.padEnd(18) + 'hasta ' + M12[p[p.length - 1]] + ' · ' + o.kpis.length + ' KPI');
  });

  const salida = {
    meta: { archivo: ARCHIVO, hojas: 'ObjetivosMensuales + Carga Mensual KPI', origen: 'SharePoint · Gerencia de Operaciones / Objetivos' },
    MESES: M12, areas, objetivos,
  };
  // el tablero lleva el JSON en un <script type="application/json" id="ds">
  const destino = 'client/src/dashboards/objetivos-estrategicos.html';
  const p = path.join(RAIZ, destino);
  let s = fs.readFileSync(p, 'utf8');
  const m = s.match(/(<script type="application\/json" id="ds">)([\s\S]*?)(<\/script>)/);
  if (!m) throw new Error(destino + ': no encuentro el bloque de datos');
  const viejo = JSON.parse(m[2]);
  salida.meta.generado = viejo.meta.generado;
  if (dry) log('   [dry] ' + destino + ' quedaría en ' + JSON.stringify(salida).length + ' bytes');
  else fs.writeFileSync(p, s.replace(m[0], m[1] + JSON.stringify(salida) + m[3]));

  /* ═══ métricas de Sistemas (hoja del sector) ═══ */
  log('· Métricas de Sistemas');
  {
    const rows = wb.filas('Sistemas');
    const pc = v => typeof v === 'number' ? Math.round(v * 1000) / 10 : null;
    const filas = [];
    for (let i = 3; i <= 6; i++) {
      const r = rows[i]; if (!r || !r[2]) continue;
      filas.push({
        n: r[0], obj: txt(r[1]), kpi: txt(r[2]), meta: pc(r[4]),
        vals: M12.map((m, k) => pc(r[5 + k])), prom: pc(r[17]),
        estado: txt(r[18]) ? txt(r[18]).replace(/[✅❌]/g, '').trim() : null,
      });
    }
    const promedio = M12.map((m, k) => pc(rows[7][5 + k]));
    const base = [], inf = [];
    for (let i = 19; i < 32; i++) {
      const r = rows[i];
      if (r && r[1] === 2026 && typeof r[2] === 'number') base.push({ m: r[2], ok: r[4] || 0, e: r[5] || 0, t: r[6] || 0 });
      if (r && /^\d{4}-\d{2}/.test(txt(r[11]) || '')) inf.push({ m: Number(txt(r[11]).slice(5, 7)), ok: r[12] || 0, e: r[13] || 0, t: r[14] || 0 });
    }
    const OBJ = {
      agente: (txt(rows[0][0]) || '').replace(/^KPIs ASIGNADOS\s*—\s*/i, '').split('SEGUIMI')[0].trim() || 'Nicolas Gutierrez',
      meses: M12, hastaMes: promedio.reduce((a, v, i) => v == null ? a : i, 0),
      filas, promedio, base, inf,
    };
    log('   ' + filas.length + ' métricas · promedio del área hasta ' + M12[OBJ.hastaMes] + ' = ' + promedio[OBJ.hastaMes] + '%');
    escribir('client/src/dashboards/kpi-sistemas.html', 'OBJ', OBJ);
  }
};
