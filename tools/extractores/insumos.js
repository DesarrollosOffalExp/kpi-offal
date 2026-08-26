// Insumos · productividad de armado de cajas, productividad de cerrado de cajas
// y eficiencia de materiales. La cuenta de cada dato está en tools/fuentes.json.

// Cajas por minuto que se le pide a cada formadora. No están en la planilla:
// son el objetivo contra el que se calcula el índice (real ÷ ideal).
const IDEAL = { 1: 16, 2: 25, 3: 16, 4: 19 };

// Lunes de la semana ISO <n> de <anio>, y el domingo que la cierra.
function semanaISO(n, anio) {
  const j4 = new Date(Date.UTC(anio, 0, 4));
  const lun1 = new Date(j4.getTime() - ((j4.getUTCDay() + 6) % 7) * 86400000);
  const lun = new Date(lun1.getTime() + (n - 1) * 7 * 86400000);
  return { lun, dom: new Date(lun.getTime() + 6 * 86400000) };
}

const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

exports.actualizar = async function ({ leer, escribir, log, util }) {
  const { num, txt } = util;
  const XLSX = require('xlsx');
  const hoy = new Date();
  const dmU = d => String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
  const dmL = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  const serie = n => new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  const r1 = v => +(v.toFixed(1));
  const r2 = v => +(v.toFixed(2));
  const r3 = v => +(v.toFixed(3));   // medio para arriba, como redondea la planilla
  const r4 = v => +(v.toFixed(4));

  /* ═══════════ productividad de armado de cajas ═══════════ */
  log('· Productividad de armado de cajas');
  {
    const destino = 'client/src/dashboards/productividad-armado.html';
    const viejo = util.actual(destino, 'DATA');
    // el tablero guarda el ideal por formadora en DATA.ideal: manda esa
    const ideales = (viejo && viejo.ideal) || IDEAL;
    const wb = leer('Indicadores Insumos - 2026.xlsx');
    // Las horas son una hora de Excel (fracción de día): se leen crudas, no como fecha.
    const raw = XLSX.readFile(wb.ruta, { cellDates: false });
    const hoja = 'Prod. Armado de Cajas';
    if (!raw.Sheets[hoja]) throw new Error('no existe la hoja ' + JSON.stringify(hoja));
    const filas = XLSX.utils.sheet_to_json(raw.Sheets[hoja], { header: 1, raw: true, defval: null, blankrows: false });
    const enc = (filas[0] || []).map(v => txt(v));
    // F = "Total de tiempo" = horas armando − tiempo en falla. Es la que vale.
    if (!/total de tiempo/i.test(enc[5] || '')) throw new Error('la columna F ya no es "Total de tiempo" sino ' + JSON.stringify(enc[5]));
    if (!/semana/i.test(enc[7] || '')) throw new Error('la columna H ya no es "Semana" sino ' + JSON.stringify(enc[7]));

    const porSem = new Map();
    filas.slice(1).forEach(r => {
      if (!r) return;
      const sem = num(r[7]), form = num(r[1]), cajas = num(r[2]);
      if (sem == null || form == null || cajas == null) return;
      const horas = (num(r[5]) || 0) * 24;
      const turno = /noche/i.test(String(r[6] || '')) ? 'noche' : 'dia';
      const fecha = num(r[0]);
      if (!porSem.has(sem)) porSem.set(sem, { sem, min: fecha, max: fecha, acum: {} });
      const S = porSem.get(sem);
      if (fecha != null) { if (fecha < S.min) S.min = fecha; if (fecha > S.max) S.max = fecha; }
      ['general', turno].forEach(t => {
        const k = t + '|' + form;
        const a = S.acum[k] = S.acum[k] || { f: form, horas: 0, cajas: 0 };
        a.horas += horas; a.cajas += cajas;
      });
    });

    // Por formadora: ch = cajas ÷ horas; real = ch ÷ 60 (cajas por minuto);
    // ind = real ÷ ideal. La fila Total suma cajas, horas, ch, real e ideales
    // sin redondear antes, y recién ahí redondea.
    const FORMS = Object.keys(ideales).map(Number).sort((a, b) => a - b);
    const IDEAL_TOT = FORMS.reduce((a, f) => a + ideales[f], 0);
    const armar = (S, t) => {
      // siempre las cuatro formadoras: la que no trabajó esa semana va en cero
      let tc = 0, th = 0, tch = 0, tr = 0;
      const out = FORMS.map(f => {
        const a = S.acum[t + '|' + f] || { horas: 0, cajas: 0 };
        const ch = a.horas ? a.cajas / a.horas : 0, real = ch / 60;
        tc += a.cajas; th += a.horas; tch += ch; tr += real;
        return { f, horas: r3(a.horas), cajas: a.cajas, ch: Math.round(ch), real: r2(real), ideal: ideales[f], ind: r4(real / ideales[f]) };
      });
      // el ideal del total es el de las cuatro formadoras, trabajen o no
      out.push({ f: 'Total', horas: r3(th), cajas: tc, ch: Math.round(tch), real: r2(tr), ideal: IDEAL_TOT, ind: r4(tr / IDEAL_TOT) });
      return out;
    };

    const weeks = [...porSem.values()].sort((a, b) => a.sem - b.sem)
      // sólo semanas cerradas: la planilla ya trae filas de la semana en curso
      .filter(S => semanaISO(S.sem, serie(S.max).getUTCFullYear()).dom < hoy)
      .map(S => ({
        sem: S.sem, desde: dmU(serie(S.min)), hasta: dmU(serie(S.max)),
        general: armar(S, 'general'), dia: armar(S, 'dia'), noche: armar(S, 'noche'),
      }));
    const abiertas = [...porSem.keys()].filter(s => !weeks.some(w => w.sem === s));
    if (abiertas.length) log('   (queda afuera la semana en curso: S' + abiertas.join(', S') + ')');

    if (viejo) {
      // sólo interesa lo que se ve: cajas, ch, real e ind. Las horas se comparan
      // con tolerancia porque son una suma de fracciones de día.
      const visible = w => JSON.stringify(['general', 'dia', 'noche'].map(t => (w[t] || []).map(e => [e.f, e.cajas, e.ch, e.real, e.ideal, e.ind])));
      const dif = [], redondeo = [];
      viejo.weeks.forEach(v => {
        const n = weeks.find(x => x.sem === v.sem);
        if (!n || visible(v) !== visible(n) || v.desde !== n.desde || v.hasta !== n.hasta) { dif.push(v.sem); return; }
        if (JSON.stringify(v) !== JSON.stringify(n)) redondeo.push(v.sem);
      });
      log('   ' + (dif.length ? '! cambiaron ' + dif.length + ' semana(s): S' + dif.join(', S')
        : '✓ las ' + viejo.weeks.length + ' semanas ya cargadas dan igual'));
      if (redondeo.length) log('   · sólo el redondeo de horas se mueve en S' + redondeo.join(', S') + ' (≤0,001 h, no cambia ningún indicador)');
      const u = weeks[weeks.length - 1];
      log('   ' + viejo.weeks.length + ' → ' + weeks.length + ' semanas · última S' + u.sem + ' (' + u.desde + ' al ' + u.hasta + ')');
    }
    escribir(destino, 'DATA', Object.assign({}, viejo, { weeks, ultima: weeks[weeks.length - 1].sem }));
  }

  /* ═══════════ productividad de cerrado de cajas ═══════════ */
  log('· Productividad de cerrado de cajas');
  {
    const wb = leer('Picos de empaque TPM x 10 Min.xlsx');
    const comp = wb.filas('Comparativo_Semanal');
    const fIni = comp.findIndex(r => r && txt(r[0]) === 'Inicio');
    const fFin = comp.findIndex(r => r && txt(r[0]) === 'Fin');
    const fMaq = comp.findIndex(r => r && txt(r[0]) === 'Máquina');
    if (fIni < 0 || fFin < 0 || fMaq < 0) throw new Error('Comparativo_Semanal: no encuentro las filas Inicio/Fin/Máquina');
    // La hoja deja armado todo el año con ceros: sólo entran las semanas cerradas.
    const cols = [];
    (comp[fMaq] || []).forEach((v, j) => {
      const m = String(v == null ? '' : v).match(/semana\s*(\d+)/i);
      const ini = comp[fIni][j], fin = comp[fFin][j];
      if (m && ini instanceof Date && fin instanceof Date && fin < hoy) cols.push({ j, sem: +m[1], ini, fin });
    });
    if (!cols.length) throw new Error('Comparativo_Semanal: ninguna semana cerrada');
    const maqs = [];
    for (let i = fMaq + 1; i < comp.length; i++) {
      const n = txt(comp[i] && comp[i][0]);
      if (!n || /^total$/i.test(n)) break;
      maqs.push({ n, fila: i });
    }
    // El pico es el máximo de unidades en un intervalo de 10 minutos de la semana.
    const d0 = XLSX.utils.sheet_to_json(XLSX.readFile(wb.ruta, { cellDates: true }).Sheets['Datos_0'], { raw: true, defval: null });
    const pico = {};
    d0.forEach(r => {
      const maq = txt(r['Máquina']), p = r['Período'], u = num(r['Unidades']);
      if (!maq || !(p instanceof Date) || u == null) return;
      const c = cols.find(c => p >= c.ini && p < new Date(c.fin.getTime() + 86400000));
      if (!c) return;
      const k = c.sem + '|' + maq;
      if (!pico[k] || u > pico[k].u) pico[k] = { u, f: p };
    });

    const destino = 'client/src/dashboards/productividad-cerrado.html';
    const viejo = util.actual(destino, 'DATA');
    // cajas por minuto que se le pide al conjunto de cerradoras
    const estandar = (viejo && viejo.estandar) || 72;
    const fTot = comp.find(r => r && /^total$/i.test(txt(r[0]) || ''));

    const semanas = cols.map(c => {
      const maquinas = maqs.map(m => {
        const p = pico[c.sem + '|' + m.n];
        return {
          maq: m.n, total: num(comp[m.fila][c.j]) || 0,
          peak: p ? p.u : 0, pfecha: p ? dmL(p.f) : '',
          phora: p ? String(p.f.getHours()).padStart(2, '0') + ':' + String(p.f.getMinutes()).padStart(2, '0') : '',
        };
      });
      const total = maquinas.reduce((a, m) => a + m.total, 0);
      if (fTot && num(fTot[c.j]) != null && num(fTot[c.j]) !== total)
        log('   ! S' + c.sem + ': la fila TOTAL de la hoja dice ' + fTot[c.j] + ' y las máquinas suman ' + total);
      // el pico viene por intervalo de 10 minutos: ÷10 lo pasa a cajas por minuto
      const sumPeakMin = r1(maquinas.reduce((a, m) => a + m.peak, 0) / 10);
      return { sem: c.sem, ini: dmL(c.ini), fin: dmL(c.fin), maquinas, total, kpi: r4(sumPeakMin / estandar), sumPeakMin };
    });

    // máximo mensual por máquina, dentro del período que cubren estas semanas
    const desdeT = cols[0].ini.getTime(), hastaT = cols[cols.length - 1].fin.getTime() + 86400000;
    const porMes = {};
    d0.forEach(r => {
      const maq = txt(r['Máquina']), p = r['Período'], u = num(r['Unidades']);
      if (!maq || !(p instanceof Date) || u == null) return;
      if (p.getTime() < desdeT || p.getTime() >= hastaT) return;
      const k = p.getMonth() + '|' + maq;
      if (!porMes[k] || u > porMes[k].u) porMes[k] = { u, f: p };
    });
    const meses = [...new Set(Object.keys(porMes).map(k => +k.split('|')[0]))].sort((a, b) => a - b);
    const maxMes = {
      meses: meses.map(m => MES[m]),
      rows: maqs.map(m => {
        const vals = meses.map(mi => {
          const p = porMes[mi + '|' + m.n];
          return { mes: MES[mi], peak: p ? p.u : 0, fecha: p ? dmL(p.f) : '' };
        });
        return { maq: m.n, vals, maxTot: Math.max(...vals.map(v => v.peak)) };
      }),
      total: meses.map(mi => {
        const sumMin = r1(maqs.reduce((a, m) => a + ((porMes[mi + '|' + m.n] || {}).u || 0), 0) / 10);
        return { mes: MES[mi], sumMin, kpi: r4(sumMin / estandar) };
      }),
    };

    if (viejo) {
      const dif = viejo.semanas.filter(v => JSON.stringify(v) !== JSON.stringify(semanas.find(x => x.sem === v.sem)));
      log('   ' + (dif.length ? '! cambiaron ' + dif.length + ' semana(s): S' + dif.map(d => d.sem).join(', S')
        : '✓ las ' + viejo.semanas.length + ' semanas ya cargadas dan igual'));
      const u = semanas[semanas.length - 1];
      log('   ' + viejo.semanas.length + ' → ' + semanas.length + ' semanas · última S' + u.sem + ' (' + u.ini + ' al ' + u.fin + ')');
      (viejo.maxMes ? viejo.maxMes.total : []).forEach((t, i) => {
        const n = maxMes.total.find(x => x.mes === t.mes);
        if (n && n.sumMin !== t.sumMin) log('   · máximo de ' + t.mes + ': ' + t.sumMin + ' → ' + n.sumMin + ' cajas/min');
      });
    }
    escribir(destino, 'DATA', {
      semanas, semanasData: semanas.map(s => s.sem), maxMes,
      estandar, totalPeriodo: semanas.reduce((a, s) => a + s.total, 0),
    });
  }

  /* ═══════════ eficiencia de materiales ═══════════ */
  log('· Eficiencia de materiales');
  {
    const wb = leer('Indicadores Insumos - 2026.xlsx');
    const rows = wb.filas('KPIs');
    const fila = t => rows.find(r => r && txt(r[2]) && new RegExp(t, 'i').test(txt(r[2])));
    const rec = fila('eficiencia en la rec'), ent = fila('eficiencia en la ent');
    if (!rec || !ent) throw new Error('hoja KPIs: no encuentro las filas de eficiencia');
    // Los meses arrancan en la columna E (Enero).
    const destino = 'client/src/dashboards/eficiencia-materiales.html';
    const R = util.actual(destino, 'R'), E = util.actual(destino, 'E');
    let cambios = 0, nuevos = 0;
    [[R, rec, 'recepción'], [E, ent, 'entrega']].forEach(([obj, f, nom]) => {
      if (!obj) return;
      obj.meses.forEach((m, i) => {
        const v = num(f[4 + i]);
        if (v != null && Math.abs(m.efic - r4(v)) > 0.0005) {
          log('   ' + nom + ' ' + m.mesNom + ': ' + m.efic + ' → ' + r4(v)); m.efic = r4(v); cambios++;
        }
      });
      for (let i = obj.meses.length; i < 12; i++) if (num(f[4 + i]) != null) nuevos++;
    });
    if (!cambios) log('   ✓ los ' + R.meses.length + ' meses cargados dan igual que la hoja KPIs');
    if (nuevos) log('   ! la hoja ya tiene ' + nuevos + ' valor(es) de un mes nuevo: el detalle (horas, total, egresos) todavía se carga a mano');
    else log('   sin meses nuevos: la hoja llega hasta ' + R.meses[R.meses.length - 1].mesNom);
    if (cambios) { escribir(destino, 'R', R); escribir(destino, 'E', E); }

    // Las mismas dos series alimentan las tarjetas del sector en el mock del
    // backend. Se rehacen enteras: son los meses que la hoja ya tiene cargados.
    const ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hasta = ABR.findIndex((_, i) => num(rec[4 + i]) == null && num(ent[4 + i]) == null);
    const n = hasta < 0 ? 12 : hasta;
    const pct = (f, i) => r2((num(f[4 + i]) || 0) * 100);
    const mock = 'services/mockData.js';
    const antes = util.actual(mock, 'MESES') || [];
    escribir(mock, 'MESES', ABR.slice(0, n));
    escribir(mock, 'RECEPCION', Array.from({ length: n }, (_, i) => pct(rec, i)));
    escribir(mock, 'ENTREGA', Array.from({ length: n }, (_, i) => pct(ent, i)));
    log('   mockData: series de ' + antes.length + ' → ' + n + ' meses (hasta ' + ABR[n - 1] + ')');
  }
};
