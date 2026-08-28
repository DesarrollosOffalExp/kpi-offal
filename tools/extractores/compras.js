// Compras · serie semanal de requisiciones, vencidas por semana de origen y el
// desglose de las sin tratar por fecha de aprobación.
// La cuenta de cada dato está en tools/fuentes.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const NL_ = String.fromCharCode(10);

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

    // El detalle sale de la hoja "Vencidas", que es la tabla que arma Power
    // Query. La dinámica de la hoja KPI puede haber quedado de una corrida
    // anterior: si los totales no dan, mandan las filas de la tabla.
    const hv = wb.filas('Vencidas');
    const fEnc = hv.findIndex(r => r && txt(r[0]) === 'Número');
    if (fEnc < 0) throw new Error('hoja Vencidas: no encuentro el encabezado');
    const ev = (hv[fEnc] || []).map(v => txt(v) || '');
    const cv = n => ev.findIndex(x => x.toLowerCase() === n.toLowerCase());
    const V = {
      num: cv('Número'), emi: cv('Emision'), ent: cv('Entrega'), cod: cv('Código'),
      mat: cv('Descripción Material Ampliada'), rub: cv('Rubros'), saldo: cv('Saldo'),
      cant: cv('Cantidad'), usr: cv('Usuario'), est: cv('Estado'), apr: cv('Fecha Aprobación'),
      comp: cv('Comprador Asignado'), sem: cv('Semana'), sinOc: cv('s/ OC'),
    };
    const dmy2 = f => f instanceof Date
      ? String(f.getUTCDate()).padStart(2, '0') + '/' + String(f.getUTCMonth() + 1).padStart(2, '0') + '/' + f.getUTCFullYear() : '';
    const reqs = [];
    for (let i = fEnc + 1; i < hv.length; i++) {
      const r = hv[i]; if (!r || r[V.num] == null) continue;
      reqs.push({
        num: String(r[V.num]).trim(),
        sem: num(r[V.sem]),
        emision: dmy2(r[V.emi]), entrega: dmy2(r[V.ent]), aprob: dmy2(r[V.apr]),
        cod: txt(r[V.cod]) || '', mat: txt(r[V.mat]) || '', rubro: txt(r[V.rub]) || '(sin rubro)',
        saldo: num(r[V.saldo]), cant: num(r[V.cant]),
        usuario: txt(r[V.usr]) || '', estado: txt(r[V.est]) || '',
        comprador: txt(r[V.comp]) || '', diasSinOc: num(r[V.sinOc]),
      });
    }
    // las semanas y el total salen de la tabla, no de la dinámica
    const porSem = {};
    reqs.forEach(x => { if (x.sem != null) porSem[x.sem] = (porSem[x.sem] || 0) + 1; });
    const weeks = Object.keys(porSem).map(Number).sort((a, b) => a - b)
      .map(sem => ({ sem, n: porSem[sem], reqs: reqs.filter(x => x.sem === sem) }));
    const totalTabla = reqs.length;
    if (total !== totalTabla)
      log('   ! la dinámica de la hoja KPI dice ' + total + ' y la tabla Vencidas trae ' + totalTabla +
        ' requisiciones: mandan las de la tabla');
    log('   detalle: ' + totalTabla + ' requisiciones en ' + weeks.length + ' semanas de origen');

    /* histórico: se guarda una foto por corrida, para poder mirar la evolución */
    const fh = path.join(RAIZ, 'tools', 'historico-vencidas.json');
    let hist = { _comentario: 'Una foto por corrida de las vencidas que trae la hoja Vencidas. Lo escribe tools/extractores/compras.js; no se edita a mano.', fotos: [] };
    try { hist = JSON.parse(fs.readFileSync(fh, 'utf8')); } catch (e) { }
    const clave = 'S' + W.sem;
    const foto = {
      semana: W.sem, tomada: new Date().toISOString().slice(0, 10),
      total: totalTabla, porSemanaOrigen: porSem, numeros: reqs.map(x => x.num),
    };
    const iy = hist.fotos.findIndex(f => f.semana === W.sem);
    if (iy >= 0) {
      const antes = hist.fotos[iy];
      if (antes.total !== foto.total || JSON.stringify(antes.numeros) !== JSON.stringify(foto.numeros))
        log('   histórico: se rehace la foto de la ' + clave + ' (' + antes.total + ' → ' + foto.total + ')');
      hist.fotos[iy] = foto;
    } else {
      hist.fotos.push(foto);
      log('   histórico: nueva foto ' + clave + ' · ' + hist.fotos.length + ' semanas guardadas');
    }
    hist.fotos.sort((a, b) => a.semana - b.semana);
    if (!dry) fs.writeFileSync(fh, JSON.stringify(hist, null, 2) + NL_);

    escribir('client/src/dashboards/compras-vencidas.html', 'DATA', {
      latestSem: W.sem, total: totalTabla, totalDinamica: total, weeks,
      historico: hist.fotos.map(f => ({ semana: f.semana, total: f.total })),
    });
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

  /* ═════════ Órdenes de compra · demoradas, informe y sin entrega ═════════ */
  // Todo sale de la hoja Reporte, que es la consulta cruda a Sifab. La hoja
  // "Demoradas" del mismo libro NO se usa: quedó desactualizada y no trae las
  // órdenes nuevas.
  log('· Órdenes de compra');
  {
    const XLSX = require('xlsx');
    const oc = leer('Ordenes de Compra actualizable (version 1).xlsm');
    const R = XLSX.utils.sheet_to_json(
      XLSX.readFile(oc.ruta, { cellDates: true, sheets: ['Reporte'] }).Sheets['Reporte'],
      { header: 1, raw: true, defval: null, blankrows: false });
    const enc = (R[0] || []).map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim());
    const col = n => {
      const i = enc.findIndex(v => v.toLowerCase() === n.toLowerCase());
      if (i < 0) throw new Error('hoja Reporte: falta la columna "' + n + '"');
      return i;
    };
    const K = {
      oc: col('Número OC'), prov: col('Razón Social Proveedor'), rubro: col('Rubro'),
      item: col('Item Nro'), mat: col('Descripción del Material'), req: col('Nro. de Requisición'),
      cant: col('Cantidad Solicitada'), pend: col('Cantidad Pendiente'),
      est: col('Estado'), estIt: col('Estado del Item'), comp: col('Comprador Asignado'),
      ent: col('Fecha Entrega'), rec: col('Fecha Recepción VE'), obs: col('Texto Variable Observaciones'),
    };
    const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
    const ene1 = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));
    const dmy = f => String(f.getUTCDate()).padStart(2, '0') + '/' + String(f.getUTCMonth() + 1).padStart(2, '0') + '/' + f.getUTCFullYear();
    const limpio = v => String(v == null ? '' : v).replace(/\r/g, '').replace(/\n+/g, ' · ').replace(/\s+/g, ' ').trim();
    const viva = e => /aprobad|emitid/i.test(String(e || ''));

    /* --- 1) demoradas: pendiente, sin recibir, vencida y del año en curso --- */
    const dem = [], sinEnt = [];
    let recibidos = 0, pendientes = 0, totalOt = 0, totalLate = 0;
    const byYear = {}, mesesAll = {}, rubrosAll = {}, provAll = {};
    for (let i = 1; i < R.length; i++) {
      const r = R[i]; if (!r) continue;
      const ent = r[K.ent], rec = r[K.rec];
      const pend = typeof r[K.pend] === 'number' ? r[K.pend] : 0;
      const fila = {
        prov: limpio(r[K.prov]), rubro: limpio(r[K.rubro]) || '(sin rubro)',
        oc: limpio(r[K.oc]), item: limpio(r[K.item]), mat: limpio(r[K.mat]),
        req: limpio(r[K.req]), cant: typeof r[K.cant] === 'number' ? r[K.cant] : null,
        pend, estItem: limpio(r[K.estIt]), comprador: limpio(r[K.comp]),
        obs: limpio(r[K.obs]),
      };
      // informe de puntualidad: sólo las que ya se recibieron
      if (ent instanceof Date && rec instanceof Date) {
        recibidos++;
        const tarde = rec > ent;
        const a = rec.getUTCFullYear(), m = rec.getUTCMonth() + 1;
        const ym = a + '-' + String(m).padStart(2, '0');
        if (tarde) totalLate++; else totalOt++;
        const y = byYear[a] = byYear[a] || { ot: 0, late: 0, meses: Array.from({ length: 12 }, (_, k) => ({ m: k + 1, ot: 0, late: 0 })) };
        y[tarde ? 'late' : 'ot']++; y.meses[m - 1][tarde ? 'late' : 'ot']++;
        const mm = mesesAll[ym] = mesesAll[ym] || { ym, ot: 0, late: 0 }; mm[tarde ? 'late' : 'ot']++;
        const ru = rubrosAll[fila.rubro] = rubrosAll[fila.rubro] || { k: fila.rubro, ot: 0, late: 0 }; ru[tarde ? 'late' : 'ot']++;
        const pv = provAll[fila.prov] = provAll[fila.prov] || { k: fila.prov, ot: 0, late: 0 }; pv[tarde ? 'late' : 'ot']++;
        continue;
      }
      if (!(ent instanceof Date) || rec instanceof Date || pend <= 0 || !viva(r[K.est])) continue;
      pendientes++;
      const dias = Math.round((ent - hoy) / 86400000);
      const f = Object.assign({ fEntrega: dmy(ent), fRecep: '', dias }, fila);
      sinEnt.push(f);                                  // toda OC pendiente de entrega
      if (ent < hoy && ent >= ene1) dem.push(f);        // vencida y del año en curso
    }

    /* --- demoradas, agrupadas por proveedor y rubro --- */
    const gr = {};
    dem.forEach(it => {
      const k = it.prov + '||' + it.rubro;
      const a = gr[k] = gr[k] || { prov: it.prov, rubro: it.rubro, totalItems: 0, dias: 0, items: [] };
      a.totalItems++; a.items.push(it);
    });
    const groups = Object.keys(gr).map(k => {
      const a = gr[k];
      a.items.sort((x, y) => x.dias - y.dias);
      a.dias = a.items[0].dias; a.itemsReconstruidos = a.items.length;
      return a;
    }).sort((a, b) => a.dias - b.dias);
    const dDem = 'client/src/dashboards/compras-demoradas.html';
    const vDem = util.actual(dDem, 'DATA');
    if (vDem) log('   demoradas: ' + vDem.totalItems + ' → ' + dem.length + ' ítems · ' +
      vDem.totalGrupos + ' → ' + groups.length + ' grupos · peor ' + (groups[0] ? groups[0].dias : 0) + ' días');
    escribir(dDem, 'DATA', {
      generado: dmy(hoy), totalItems: dem.length, totalGrupos: groups.length,
      peorDias: groups.length ? groups[0].dias : 0,
      totalProveedores: new Set(dem.map(i => i.prov)).size,
      detalleReconstruido: dem.length, groups,
    });

    /* --- 2) informe de puntualidad --- */
    const ordena = o => Object.values(o).map(x => Object.assign({}, x, { total: x.ot + x.late }))
      .sort((a, b) => b.total - a.total);
    const dInf = 'client/src/dashboards/compras-informe.html';
    const vInf = util.actual(dInf, 'DATA');
    if (vInf) log('   informe: ' + vInf.recibidos + ' → ' + recibidos + ' recibidos · ' +
      vInf.pendientes + ' → ' + pendientes + ' pendientes · a tiempo ' + vInf.totalOt + ' → ' + totalOt);
    escribir(dInf, 'DATA', {
      generado: dmy(hoy), hoy: hoy.toISOString().slice(0, 10),
      recibidos, pendientes, totalOt, totalLate,
      years: Object.keys(byYear).map(Number).sort((a, b) => a - b), byYear,
      mesesAll: Object.values(mesesAll).sort((a, b) => a.ym < b.ym ? -1 : 1),
      rubrosAll: ordena(rubrosAll).slice(0, 20), provAll: ordena(provAll).slice(0, 20),
    });

    /* --- 3) sin entrega: todo lo pendiente, vencido o no --- */
    const gs = {};
    sinEnt.forEach(it => {
      const k = it.prov + '||' + it.rubro;
      const a = gs[k] = gs[k] || { prov: it.prov, rubro: it.rubro, items: [], totalItems: 0, promDias: 0 };
      a.items.push(it); a.totalItems++;
    });
    const grupos = Object.keys(gs).map(k => {
      const a = gs[k];
      a.items.sort((x, y) => x.dias - y.dias);
      a.promDias = Math.round(a.items.reduce((s, x) => s + x.dias, 0) / a.items.length);
      a.vencidos = a.items.filter(x => x.dias < 0).length;
      return a;
    }).sort((a, b) => b.totalItems - a.totalItems || a.promDias - b.promDias);
    const dSin = 'client/src/dashboards/compras-sin-entrega.html';
    const vSin = util.actual(dSin, 'DATA');
    // la hoja "sin entrega" trae su propio total, para control
    const hs = oc.filas('sin entrega');
    const fTot = hs.find(r => r && /^total$/i.test(String(r[0] || '').trim()));
    const totalHoja = fTot ? (typeof fTot[2] === 'number' ? fTot[2] : null) : null;
    if (totalHoja != null && totalHoja !== sinEnt.length)
      log('   ! la hoja "sin entrega" totaliza ' + totalHoja + ' ítems y de Reporte salen ' + sinEnt.length);
    log('   sin entrega: ' + sinEnt.length + ' ítems en ' + grupos.length + ' grupos · ' +
      sinEnt.filter(x => x.dias < 0).length + ' ya vencidos' + (vSin ? ' (antes ' + vSin.totalItems + ')' : ''));
    escribir(dSin, 'DATA', {
      generado: dmy(hoy), totalItems: sinEnt.length, totalGrupos: grupos.length,
      totalProveedores: new Set(sinEnt.map(i => i.prov)).size,
      vencidos: sinEnt.filter(x => x.dias < 0).length,
      porVencer: sinEnt.filter(x => x.dias >= 0).length,
      totalHoja, grupos,
    });
  }
};
