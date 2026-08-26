// Compras · serie semanal de requisiciones, vencidas por semana de origen y el
// desglose de las sin tratar por fecha de aprobación.
// La cuenta de cada dato está en tools/fuentes.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');

// Feriados que caen en día hábil y acortan la semana de Compras.
const FERIADOS = ['2026-08-17'];

exports.actualizar = async function ({ leer, escribir, log, dry, util }) {
  const { num, txt } = util;
  const wb = leer('Archivo a trabajar.xlsx');

  /* ═══ serie semanal (hoja KPI) ═══ */
  log('· Serie semanal');
  const filas = wb.filas('KPI');
  // La hoja repite la misma tabla varias veces; vale el bloque que además trae
  // las columnas Q (Total REQ Tratadas) y R (Observaciones).
  let inicio = -1;
  filas.forEach((r, i) => {
    if (!r) return;
    const q = txt(r[16]), rr = txt(r[17]);
    if (/total req/i.test(q || '') && /observaci/i.test(rr || '')) inicio = i + 1;
  });
  if (inicio < 0) throw new Error('hoja KPI: no encuentro el bloque con Total REQ Tratadas y Observaciones');
  // los dos bloques traen el encabezado partido de distinta forma: se arranca
  // en la primera fila que ya tiene número de semana.
  while (inicio < filas.length && num((filas[inicio] || [])[8]) == null) inicio++;
  const weeks = [];
  for (let i = inicio; i < filas.length; i++) {
    const r = filas[i]; if (!r || num(r[8]) == null) break;
    weeks.push({
      antVenc: num(r[0]) ?? 0, antSinVenc: num(r[1]) ?? 0, reqSem: num(r[2]) ?? 0, tratadas: num(r[3]) ?? 0,
      rechazadas: num(r[4]) ?? 0, anuladas: num(r[5]) ?? 0, sinTratarSem: num(r[6]) ?? 0,
      totalSinTratar: num(r[7]) ?? 0, sem: num(r[8]), totalVenc: num(r[9]) ?? 0,
      vencNuevas: num(r[10]) ?? 0, vencViejas: num(r[11]) ?? 0, porVencer: num(r[12]) ?? 0,
      enPlazo: num(r[13]) ?? 0, totalPend: num(r[14]) ?? 0, urgentes: num(r[15]) ?? 0,
      // la observación conserva sus saltos de línea: se muestra tal cual
      totalTratadas: num(r[16]), obs: r[17] == null ? '' : String(r[17]).trim(),
    });
  }
  const W = weeks[weeks.length - 1];
  const serie = { weeks, ultima: W.sem };
  const antes = util.actual('client/src/dashboards/compras-pendientes.html', 'DATA');
  if (antes) {
    const iguales = antes.weeks.every(v => {
      const n = weeks.find(x => x.sem === v.sem);
      return n && JSON.stringify(v) === JSON.stringify(n);
    });
    log('   ' + (iguales ? '✓ las semanas ya cargadas dan igual' : '! cambió alguna semana ya cargada'));
    log('   ' + antes.weeks.length + ' → ' + weeks.length + ' semanas · S' + W.sem +
      ': pendientes ' + W.totalPend + ' · sin tratar ' + W.sinTratarSem + ' · vencidas ' + W.totalVenc);
  }
  escribir('client/src/dashboards/compras-pendientes.html', 'DATA', serie);
  escribir('client/src/dashboards/compras-actividad.html', 'DATA', serie);

  /* ═══ vencidas por semana de origen (dinámica de la misma hoja) ═══ */
  log('· Vencidas por semana de origen');
  {
    let cab = -1;
    for (let i = inicio; i < filas.length; i++) {
      const r = filas[i] || [];
      if (txt(r[0]) === 'Semana' && /^cuenta/i.test(txt(r[2]) || '')) { cab = i; break; }
    }
    if (cab < 0) throw new Error('hoja KPI: no encuentro la dinámica de vencidas por semana');
    const venc = []; let total = null;
    for (let i = cab + 1; i < filas.length; i++) {
      const r = filas[i] || [];
      if (/^total general/i.test(txt(r[0]) || '')) { total = num(r[2]); break; }
      if (num(r[0]) == null) break;
      venc.push({ sem: num(r[0]), n: num(r[2]) });
    }
    log('   ' + venc.length + ' semanas de origen · total ' + total +
      (total === W.totalVenc ? ' (= vencidas de la semana ' + W.sem + ')' : ' ! no coincide con las ' + W.totalVenc + ' vencidas de la semana'));
    escribir('client/src/dashboards/compras-vencidas.html', 'DATA', { latestSem: W.sem, total, weeks: venc });
  }

  /* ═══ sin tratar de la semana, por fecha de aprobación ═══ */
  log('· Sin tratar por fecha de aprobación');
  {
    const R = wb.objetos('BASE Req Vencidas');
    const sin = R.filter(r => typeof r['Número'] === 'number' && r['Semana'] === W.sem && r['Estado'] === 'Aprobada/o');
    const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const fechas = sin.filter(r => r['Fecha Aprobación'] instanceof Date).map(r => r['Fecha Aprobación']);
    if (!fechas.length) { log('   la semana ' + W.sem + ' no tiene requisiciones aprobadas sin tratar'); return; }
    const lunes = new Date(Math.min(...fechas.map(d => d.getTime())));
    lunes.setHours(0, 0, 0, 0);
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const habiles = [];
    for (let k = 0; k < 5; k++) {
      const d = new Date(lunes); d.setDate(lunes.getDate() + k);
      if (!FERIADOS.includes(iso(d))) habiles.push(iso(d));
    }
    const diasParaTratar = f => { const k = habiles.indexOf(iso(f)); return k < 0 ? 0 : habiles.length - k; };
    const porDia = {};
    sin.forEach(r => {
      const f = r['Fecha Aprobación'];
      const k = f instanceof Date ? iso(f) : 'sin-fecha';
      if (!porDia[k]) porDia[k] = {
        fecha: k, dia: f instanceof Date ? DIA[f.getDay()] : '—', n: 0, urgentes: 0,
        habil: f instanceof Date && habiles.includes(k), dias: f instanceof Date ? diasParaTratar(f) : null, rubros: {},
      };
      const g = porDia[k]; g.n++;
      if (String(r['Columna1'] || '').toLowerCase() === 'urgente') g.urgentes++;
      const ru = txt(r['Rubros']) || 'Sin rubro';
      g.rubros[ru] = (g.rubros[ru] || 0) + 1;
    });
    const dias = Object.values(porDia).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    dias.forEach(d => { d.rubros = Object.entries(d.rubros).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ k, v })); });
    const total = sin.length;
    const compradores = {};
    sin.forEach(r => { const c = txt(r['Comprador Asignado']) || 'Sin asignar'; compradores[c] = (compradores[c] || 0) + 1; });
    const ST = {
      sem: W.sem, total,
      urgentes: sin.filter(r => String(r['Columna1'] || '').toLowerCase() === 'urgente').length,
      lunes: iso(lunes), habiles, feriados: FERIADOS, dias,
      promDias: Math.round(dias.reduce((a, d) => a + (d.dias || 0) * d.n, 0) / total * 100) / 100,
      unDiaOMenos: dias.filter(d => (d.dias || 0) <= 1).reduce((a, d) => a + d.n, 0),
      fueraSemana: dias.filter(d => !d.habil).reduce((a, d) => a + d.n, 0),
      pico: dias.slice().sort((a, b) => b.n - a.n)[0],
      rubros: [], compradores: Object.entries(compradores).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })),
      obs: W.obs,
    };
    const ru = {};
    sin.forEach(r => { const k = txt(r['Rubros']) || 'Sin rubro'; ru[k] = (ru[k] || 0) + 1; });
    ST.rubros = Object.entries(ru).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ k, v }));
    log('   ' + total + ' sin tratar · ' + habiles.length + ' días hábiles (feriados: ' + (FERIADOS.join(', ') || 'ninguno') + ')');
    dias.forEach(d => log('     ' + d.dia.padEnd(10) + String(d.n).padStart(4) + '  ' + (d.habil ? d.dias + ' día(s) para tratar' : 'fuera de la semana hábil')));
    escribir('client/src/dashboards/compras-pendientes.html', 'ST', ST, { decl: 'var' });
  }

  /* ═══ tarjetas del sector en mockData ═══ */
  log('· Tarjetas de Compras (mockData)');
  {
    const p = path.join(RAIZ, 'services/mockData.js');
    let s = fs.readFileSync(p, 'utf8');
    const ini = s.indexOf('const COMPRAS = {'), fin = s.indexOf('\n};', ini);
    let b = s.slice(ini, fin);
    const set = (id, v) => {
      const re = new RegExp("(\\{ id: '" + id + "'[^}]*?valor: )(-?[\\d.]+|null)");
      if (!re.test(b)) throw new Error('mockData: no encuentro el kpi ' + id);
      b = b.replace(re, '$1' + v);
    };
    set('pendientes', W.totalPend); set('sin_tratar', W.sinTratarSem); set('vencidas', W.totalVenc);
    set('total_sin_tratar', W.totalSinTratar); set('ant_vencidas', W.antVenc);
    set('ant_sin_vencer', W.antSinVenc); set('requis_semana', W.reqSem); set('tratadas', W.tratadas);
    b = b.replace(/desglose: \[\{ nombre: 'Nuevas', valor: \d+ \}, \{ nombre: 'Viejas', valor: \d+ \}\]/,
      "desglose: [{ nombre: 'Nuevas', valor: " + W.vencNuevas + " }, { nombre: 'Viejas', valor: " + W.vencViejas + " }]");
    b = b.replace(/datos: \[\{ nombre: 'Por vencer', valor: \d+ \}, \{ nombre: 'En plazo', valor: \d+ \}, \{ nombre: 'Vencidas', valor: \d+ \}\]/,
      "datos: [{ nombre: 'Por vencer', valor: " + W.porVencer + " }, { nombre: 'En plazo', valor: " + W.enPlazo + " }, { nombre: 'Vencidas', valor: " + W.totalVenc + " }]");
    b = b.replace(/datos: \[\{ nombre: 'Ingresadas', valor: \d+ \}, \{ nombre: 'Tratadas', valor: \d+ \}, \{ nombre: 'Sin tratar', valor: \d+ \}, \{ nombre: 'Rechazadas', valor: \d+ \}, \{ nombre: 'Anuladas', valor: \d+ \}\]/,
      "datos: [{ nombre: 'Ingresadas', valor: " + W.reqSem + " }, { nombre: 'Tratadas', valor: " + W.tratadas + " }, { nombre: 'Sin tratar', valor: " + W.sinTratarSem + " }, { nombre: 'Rechazadas', valor: " + W.rechazadas + " }, { nombre: 'Anuladas', valor: " + W.anuladas + " }]");
    b = b.replace(/periodo: '[^']*'/, "periodo: 'semana " + W.sem + "'");
    log('   periodo: semana ' + W.sem);
    if (!dry) fs.writeFileSync(p, s.slice(0, ini) + b + s.slice(fin));
  }
};
