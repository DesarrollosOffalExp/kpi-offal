// Lavado de Camiones · el form «Control de Lavado de Camiones» y sus exportaciones.
//
// La carga la hace el operario en un formulario: por cada unidad marca atraco,
// inicio y fin de lavado y desatraco, quiénes lavaron y una observación. De ahí
// salen dos archivos posibles, y el extractor toma los dos:
//
//   · reporte-lavados-AAAAMMDD-HHMM.xlsx  — la exportación de la app de lavados,
//     hoja «Detalle». Viene en dos formatos: el de circuito camión (con dársena,
//     frigorífico, tambores y las cuatro marcas de tiempo) y el de «todos», más
//     corto, que suma las tareas (hielo, varias) pero sólo trae inicio y fin de
//     lavado. Cada exportación es una foto de un período, así que se unen todas
//     y gana el registro más completo.
//   · Registro de lavadero.xlsx — la descarga cruda del form. Se usa como
//     respaldo: aporta los registros que ninguna exportación tenga.
//
// El costo no está en el form: sale del presupuesto del sector (mano de obra
// propia, eventual y material) y de la matriz de costo. Se leen de sus propios
// tableros, que mantienen los extractores «presupuesto» y «logistica».
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');

/* ── formas de leer un tiempo ──────────────────────────────────────────────
   Las exportaciones traen "H:MM:SS"; el form crudo, la fracción de día de
   Excel. Todo se lleva a segundos. */
function seg(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 2 ? null : Math.round(v * 86400);
  const s = String(v).trim();
  let m = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = s.match(/^(\d+):(\d{2})$/);
  if (m) return +m[1] * 3600 + +m[2] * 60;
  return null;
}
const placa = s => String(s || '').replace(/\s+/g, '').toUpperCase();
const listaOps = s => String(s || '').split(/[,;]/).map(x => x.replace(/\s+/g, ' ').trim().toUpperCase()).filter(Boolean);

/* ── rangos aceptables ─────────────────────────────────────────────────────
   Un lavado de menos de dos minutos es un registro mal cerrado y uno de más de
   dos horas es una unidad que quedó atracada por otra cosa (carga de tambores,
   parada de comida). Se dejan afuera de los promedios y se cuentan aparte, en
   calidad del dato. */
const CICLO_MIN = 120, CICLO_MAX = 7200, NETO_MIN = 60, NETO_MAX = 7200;

/* ── clasificación de las observaciones ───────────────────────────────────
   El campo es texto libre, pero se repite: son las pérdidas del proceso. El
   orden importa, gana la primera que coincide. */
const CLASES = [
  { k: 'repaso', lbl: 'Repaso / relavado', re: /repas/i, tipo: 'bad' },
  { k: 'fondo', lbl: 'Lavado a fondo o cepillado', re: /fondo|complet|cepill|sepill/i, tipo: 'info' },
  { k: 'hielo', lbl: 'Personal desviado a fábrica de hielo', re: /f[áa]brica de hielo|al hielo|hiel del semi/i, tipo: 'bad' },
  { k: 'tambores', lbl: 'Espera por tambores', re: /tambor|bines/i, tipo: 'amber' },
  { k: 'vacia', lbl: 'Unidad vacía ocupando la dársena', re: /vac[ií]/i, tipo: 'amber' },
  { k: 'comida', lbl: 'Parada por comida o descanso', re: /comer|comida|almorz|descanso/i, tipo: 'amber' },
  { k: 'chofer', lbl: 'Falta de chofer para desatracar', re: /ch[oó]fer/i, tipo: 'bad' },
  { k: 'rotura', lbl: 'Rotura de la unidad', re: /rompi|rotur|se rompi/i, tipo: 'bad' },
  { k: 'lavadero', lbl: 'Limpieza del lavadero / supervisión', re: /limpi|supervis/i, tipo: 'info' },
];
const clasificar = t => {
  const s = String(t || '').trim();
  if (!s) return null;
  if (/^[A-Z]{2,3}\s?\d{3}\s?[A-Z]{0,2}$/i.test(s.replace(/\s+/g, ' '))) return null;   // es una patente, no una observación
  const c = CLASES.find(c => c.re.test(s));
  return c ? c.k : 'otra';
};

/* Fecha en dd/mm/aaaa, venga como texto o como serial de Excel. */
const dmy = v => {
  if (typeof v !== 'number') return String(v == null ? '' : v).trim();
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
};

/* La misma unidad, el mismo día y a la misma hora de inicio es el mismo lavado,
   lo traiga la exportación de la app o la descarga cruda del form. Sin esta
   clave los dos orígenes se duplican, porque la marca temporal viene con
   distinta precisión en cada uno. */
const clave = (fecha, unidad, iniSeg, ts) =>
  fecha + '|' + placa(unidad) + '|' + (iniSeg == null ? 't' + ts : Math.round(iniSeg / 60));

exports.actualizar = async function ({ escribir, log, util, carpetas }) {
  const XLSX = require('xlsx');
  const { r2 } = util;

  /* ═══ 1 · juntar todas las exportaciones ═══ */
  const archivos = [];
  carpetas.forEach(d => {
    fs.readdirSync(d).forEach(f => {
      if (/^reporte-lavados.*\.xlsx$/i.test(f)) archivos.push({ p: path.join(d, f), tipo: 'app', f });
      else if (/^registro de lavadero.*\.xlsx$/i.test(f)) archivos.push({ p: path.join(d, f), tipo: 'form', f });
    });
  });
  if (!archivos.length) throw new Error('no encuentro ningún «reporte-lavados-*.xlsx» ni «Registro de lavadero.xlsx» en ' + carpetas.join(' ni en '));
  archivos.forEach(a => { a.t = fs.statSync(a.p).mtimeMs; });
  archivos.sort((a, b) => a.t - b.t);           // el más nuevo pisa al más viejo

  const regs = new Map();
  let leidosApp = 0, leidosForm = 0;

  for (const a of archivos) {
    if (a.tipo === 'app') {
      const wb = XLSX.readFile(a.p, { cellDates: false });
      const hoja = wb.SheetNames.find(s => /detalle/i.test(s));
      if (!hoja) continue;
      const R = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: null, blankrows: false });
      const enc = (R[0] || []).map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim());
      const c = n => enc.indexOf(n);
      const rico = c('Inicio Atraco') >= 0;                       // formato circuito camión
      const K = {
        ts: c('Marca temporal'), fe: c('Fecha'), tu: c('Turno'), tipo: c('Tipo'),
        uni: rico ? c('Patente') : c('Equipo/Patente'), dar: c('Dársena'), fri: c('Frigorífico'),
        tam: c('Tambores'), pal: c('Pallets'), ops: c('Operarios'),
        d1: c('Atraco→Lavado'), d2: c('Lavado'), d3: c('Fin→Desatraco'), to: c('Total'), ini: c('Inicio Lavado'),
        se: c('Semana'), nu: c('Op. usados'), inc: c('Incidencias'), es: c('Estado'),
      };
      R.slice(1).forEach(r => {
        if (!r || !r[K.ts]) return;
        const uni = String(r[K.uni] || '').replace(/\s+/g, ' ').trim();
        const ops = listaOps(r[K.ops]);
        const reg = {
          ts: String(r[K.ts]).trim(), fecha: String(r[K.fe] || '').trim(), turno: String(r[K.tu] || '').trim(),
          tipo: K.tipo >= 0 ? String(r[K.tipo] || '').trim() || 'Camion' : 'Camion',
          unidad: uni, darsena: K.dar >= 0 ? String(r[K.dar] || '').trim() : '',
          frig: K.fri >= 0 ? String(r[K.fri] || '').trim() : '',
          tambores: K.tam >= 0 ? (+r[K.tam] || 0) : 0, pallets: K.pal >= 0 ? (+r[K.pal] || 0) : 0,
          ops, atraco: K.d1 >= 0 ? seg(r[K.d1]) : null, lavado: K.d2 >= 0 ? seg(r[K.d2]) : null,
          desat: K.d3 >= 0 ? seg(r[K.d3]) : null, total: seg(r[K.to]),
          sem: +r[K.se] || null, nop: (+r[K.nu] || ops.length || 1),
          inc: String(r[K.inc] || '').replace(/\s+/g, ' ').trim(),
          estado: K.es >= 0 ? String(r[K.es] || '').trim() : 'Finalizado', rico,
        };
        const key = clave(reg.fecha, uni, K.ini >= 0 ? seg(r[K.ini]) : null, reg.ts);
        const prev = regs.get(key);
        if (!prev || (rico && !prev.rico)) regs.set(key, reg);       // el formato completo manda
        leidosApp++;
      });
    } else {
      // descarga cruda del form: los tiempos vienen como fracción de día
      const wb = XLSX.readFile(a.p, { cellDates: false });
      const hoja = wb.SheetNames.find(s => /^respuestas de formulario/i.test(s)) || wb.SheetNames.find(s => /^form_responses$/i.test(s));
      if (!hoja) continue;
      const R = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: null, blankrows: false });
      const enc = (R[0] || []).map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim());
      const c = n => enc.findIndex(v => v.toLowerCase() === n.toLowerCase());
      const cOps = enc.map((v, i) => /^seleccionar operario/i.test(v) ? i : -1).filter(i => i >= 0);
      const K = {
        ts: c('Marca temporal'), fe: c('Fecha'), tu: c('Turno'), uni: c('Patente de Unidad'),
        d1: c('Atraco a Inicio lavado'), d2: c('Inicio lavado a fin lavado'), d3: c('Fin de lavado a Desatraco'),
        to: c('Tiempo total de lavado'), se: c('Semana'), nu: c('Operarios usados'), ini: c('Hora inicio de lavado'),
        inc: c('Incidencias genrales') >= 0 ? c('Incidencias genrales') : c('Incidencias generales'),
      };
      R.slice(1).forEach(r => {
        if (!r || !r[K.ts]) return;
        const uni = String(r[K.uni] || '').replace(/\s+/g, ' ').trim();
        // La columna puede venir numerada (un operario por columna) o única con
        // los nombres separados por coma; en los dos casos hay que abrirla.
        const ops = [...new Set(cOps.flatMap(i => listaOps(r[i])))];
        const ts = dmy(r[K.ts]);
        // La fecha la escribe el operario y a veces le erra el mes; la marca
        // temporal la pone el sistema. Si difieren en más de dos días, manda la
        // marca temporal.
        let fecha = dmy(r[K.fe]);
        if (typeof r[K.fe] === 'number' && typeof r[K.ts] === 'number'
          && Math.abs(Math.round(r[K.fe]) - Math.round(r[K.ts])) > 2) fecha = ts;
        const key = clave(fecha, uni, K.ini >= 0 ? seg(r[K.ini]) : null, ts);
        if (regs.has(key)) return;                                    // ya lo trajo una exportación
        regs.set(key, {
          ts, fecha, turno: String(r[K.tu] || '').trim(), tipo: 'Camion',
          unidad: uni, darsena: '', frig: '', tambores: 0, pallets: 0, ops,
          atraco: seg(r[K.d1]), lavado: seg(r[K.d2]), desat: seg(r[K.d3]), total: seg(r[K.to]),
          sem: +r[K.se] || null, nop: (+r[K.nu] || ops.length || 1),
          inc: K.inc >= 0 ? String(r[K.inc] || '').replace(/\s+/g, ' ').trim() : '',
          estado: 'Finalizado', rico: r[K.d1] != null,
        });
        leidosForm++;
      });
    }
  }

  const L = [...regs.values()].filter(r => r.fecha && r.sem);
  const ord = f => f.split('/').reverse().join('');
  L.sort((a, b) => ord(a.fecha) === ord(b.fecha) ? (a.ts < b.ts ? -1 : 1) : (ord(a.fecha) < ord(b.fecha) ? -1 : 1));
  log('· ' + archivos.length + ' archivo(s) · ' + leidosApp + ' filas de exportación + ' + leidosForm + ' del form crudo → ' + L.length + ' registros únicos');

  /* ═══ 2 · medidas ═══ */
  const esCam = r => /cami/i.test(r.tipo);
  const cam = L.filter(esCam), tar = L.filter(r => !esCam(r));
  const hh = r => (r.total || 0) * (r.nop || 1);
  const prom = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const pctil = (a, p) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  const cicloOk = r => r.total != null && r.total >= CICLO_MIN && r.total <= CICLO_MAX;
  const netoOk = r => r.lavado != null && r.lavado >= NETO_MIN && r.lavado <= NETO_MAX;
  const camOk = cam.filter(cicloOk);
  const netos = cam.filter(netoOk);
  const completos = netos.filter(r => r.atraco != null && r.desat != null && cicloOk(r));

  const semanas = [...new Set(L.map(r => r.sem))].sort((a, b) => a - b);
  const SEM = semanas.map(s => {
    const l = L.filter(r => r.sem === s), c = l.filter(esCam), t = l.filter(r => !esCam(r));
    const cOk = c.filter(cicloOk), nOk = c.filter(netoOk), comp = c.filter(r => r.atraco != null && cicloOk(r));
    const dias = [...new Set(l.map(r => r.fecha))];
    const ops = new Set(); l.forEach(r => r.ops.forEach(o => ops.add(o)));
    const fechas = dias.slice().sort((a, b) => ord(a) < ord(b) ? -1 : 1);
    return {
      s, desde: fechas[0], hasta: fechas[fechas.length - 1], dias: dias.length,
      cam: c.length, tar: t.length, hh: r2(l.reduce((a, r) => a + hh(r), 0) / 3600),
      hhCam: r2(c.reduce((a, r) => a + hh(r), 0) / 3600),
      ciclo: cOk.length ? Math.round(prom(cOk.map(r => r.total))) : null,
      neto: nOk.length ? Math.round(prom(nOk.map(r => r.lavado))) : null,
      atraco: comp.length ? Math.round(prom(comp.map(r => r.atraco))) : null,
      desat: comp.length ? Math.round(prom(comp.filter(r => r.desat != null).map(r => r.desat))) : null,
      ops: ops.size, opProm: r2(prom(c.map(r => r.nop || 1))),
      camDia: r2(c.length / dias.length),
      compl: comp.length,
    };
  });

  const DIAS = [...new Set(L.map(r => r.fecha))].sort((a, b) => ord(a) < ord(b) ? -1 : 1).map(f => {
    const l = L.filter(r => r.fecha === f), c = l.filter(esCam);
    const [d, m, y] = f.split('/').map(Number);
    const cOk = c.filter(cicloOk);
    return {
      f, s: l[0].sem, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
      cam: c.length, tar: l.length - c.length, hh: r2(l.reduce((a, r) => a + hh(r), 0) / 3600),
      ciclo: cOk.length ? Math.round(prom(cOk.map(r => r.total))) : null,
    };
  });

  const TURNOS = [...new Set(L.map(r => r.turno))].filter(Boolean).map(t => {
    const l = L.filter(r => r.turno === t), c = l.filter(esCam);
    const cOk = c.filter(cicloOk), nOk = c.filter(netoOk);
    const ops = new Set(); l.forEach(r => r.ops.forEach(o => ops.add(o)));
    return {
      t, cam: c.length, tar: l.length - c.length, hh: r2(l.reduce((a, r) => a + hh(r), 0) / 3600),
      ciclo: cOk.length ? Math.round(prom(cOk.map(r => r.total))) : null,
      neto: nOk.length ? Math.round(prom(nOk.map(r => r.lavado))) : null,
      ops: ops.size, opProm: r2(prom(c.map(r => r.nop || 1))),
    };
  }).sort((a, b) => b.cam - a.cam);

  const BINS = [[0, 600, '< 10 min'], [600, 1200, '10 a 20'], [1200, 1800, '20 a 30'], [1800, 2400, '30 a 40'],
    [2400, 3000, '40 a 50'], [3000, 3600, '50 a 60'], [3600, 5400, '1 a 1½ h'], [5400, 1e9, '+ de 1½ h']];
  const histo = (vals) => BINS.map(([lo, hi, l]) => ({ l, n: vals.filter(v => v >= lo && v < hi).length }));

  const sA = prom(completos.map(r => r.atraco)), sL = prom(completos.map(r => r.lavado)), sD = prom(completos.map(r => r.desat));
  const CICLO = {
    n: camOk.length, nComp: completos.length,
    atraco: Math.round(sA), lavado: Math.round(sL), desat: Math.round(sD),
    prom: Math.round(prom(camOk.map(r => r.total))),
    p50: Math.round(pctil(camOk.map(r => r.total), .5)), p90: Math.round(pctil(camOk.map(r => r.total), .9)),
    netoProm: Math.round(prom(netos.map(r => r.lavado))),
    netoP50: Math.round(pctil(netos.map(r => r.lavado), .5)), netoP90: Math.round(pctil(netos.map(r => r.lavado), .9)),
    cv: r2(Math.sqrt(prom(netos.map(r => (r.lavado - prom(netos.map(x => x.lavado))) ** 2))) / prom(netos.map(r => r.lavado))),
    pctVA: r2(100 * sL / (sA + sL + sD)),
    histCiclo: histo(camOk.map(r => r.total)), histNeto: histo(netos.map(r => r.lavado)),
  };

  const OPS = (() => {
    const m = new Map();
    L.forEach(r => r.ops.forEach(o => {
      const v = m.get(o) || { n: o, lav: 0, tar: 0, hh: 0, dias: new Set(), turnos: {} };
      if (esCam(r)) v.lav++; else v.tar++;
      v.hh += r.total || 0; v.dias.add(r.fecha);
      if (r.turno) v.turnos[r.turno] = (v.turnos[r.turno] || 0) + 1;
      m.set(o, v);
    }));
    return [...m.values()].map(v => ({
      n: v.n, lav: v.lav, tar: v.tar, hh: r2(v.hh / 3600), dias: v.dias.size,
      prom: v.lav + v.tar ? Math.round(v.hh / (v.lav + v.tar)) : null,
      porDia: r2((v.lav + v.tar) / v.dias.size),
      turno: Object.entries(v.turnos).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    })).sort((a, b) => (b.lav + b.tar) - (a.lav + a.tar));
  })();

  // los nombres de los frigoríficos vienen escritos de varias formas
  const claveFrig = s => String(s).toUpperCase().replace(/[.,]/g, '').replace(/\bS\s*A\s*(I?C?I?F?)\b/g, 'SA')
    .replace(/FRIGOR[IÍ]FICO/g, '').replace(/COMPA[ÑN][IÍ]A/g, 'CIA').replace(/\s+/g, ' ').trim();
  const FRIG = (() => {
    const m = new Map();
    cam.filter(r => r.frig).forEach(r => {
      const k = claveFrig(r.frig);
      const v = m.get(k) || { n: r.frig.replace(/\s+/g, ' ').trim(), lav: 0, seg: 0, nSeg: 0, tam: 0 };
      v.lav++; v.tam += r.tambores || 0;
      if (cicloOk(r)) { v.seg += r.total; v.nSeg++; }
      m.set(k, v);
    });
    return [...m.values()].map(v => ({ n: v.n, lav: v.lav, tam: v.tam, prom: v.nSeg ? Math.round(v.seg / v.nSeg) : null }))
      .sort((a, b) => b.lav - a.lav);
  })();

  const INC = (() => {
    const m = new Map();
    L.forEach(r => {
      const k = clasificar(r.inc); if (!k) return;
      const v = m.get(k) || { k, n: 0, seg: 0, textos: new Map() };
      v.n++; v.seg += r.total || 0;
      v.textos.set(r.inc, (v.textos.get(r.inc) || 0) + 1);
      m.set(k, v);
    });
    return [...m.values()].map(v => {
      const c = CLASES.find(c => c.k === v.k);
      return {
        k: v.k, lbl: c ? c.lbl : 'Otras observaciones', tipo: c ? c.tipo : 'info', n: v.n,
        hh: r2(v.seg / 3600),
        ej: [...v.textos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => ({ t, n })),
      };
    }).sort((a, b) => b.n - a.n);
  })();

  /* detalle compacto para la tabla interactiva */
  const DET = L.map(r => [r.fecha, r.turno, r.tipo, r.unidad, r.frig, r.ops.join(', '),
    r.atraco, r.lavado, r.desat, r.total, r.sem, r.nop, r.inc]);

  const fueraRango = cam.filter(r => r.total != null && !cicloOk(r))
    .map(r => ({ f: r.fecha, u: r.unidad, ciclo: r.total, neto: r.lavado, nop: r.nop, inc: r.inc }))
    .sort((a, b) => b.ciclo - a.ciclo);
  const netoRaro = cam.filter(r => r.lavado != null && r.lavado > NETO_MAX)
    .map(r => ({ f: r.fecha, u: r.unidad, neto: r.lavado, ciclo: r.total, inc: r.inc }));

  const CAL = {
    sinFrig: cam.filter(r => !r.frig).length, conFrig: cam.filter(r => r.frig).length,
    sinCiclo: cam.filter(r => r.atraco == null).length,
    fueraRango, netoRaro,
    diasSinCarga: (() => {                              // días hábiles del período sin ningún registro
      const [d0, m0, y0] = DIAS[0].f.split('/').map(Number);
      const [d1, m1, y1] = DIAS[DIAS.length - 1].f.split('/').map(Number);
      const hay = new Set(DIAS.map(x => x.f)), falta = [];
      for (let t = Date.UTC(y0, m0 - 1, d0); t <= Date.UTC(y1, m1 - 1, d1); t += 86400000) {
        const dt = new Date(t); if (dt.getUTCDay() === 0) continue;    // el domingo no se lava
        const f = String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '/' + dt.getUTCFullYear();
        if (!hay.has(f)) falta.push(f);
      }
      return falta;
    })(),
  };

  /* ═══ 3 · el costo, de los tableros que ya lo mantienen ═══ */
  const RES = util.actual('client/src/dashboards/presupuesto-lavadero.html', 'RESUMEN');
  const MAT = util.actual('client/src/dashboards/matriz-costo-logistica.html', 'D_RAW');
  const grupo = g => (RES.grupos.find(x => x.g === g) || { vals: [] }).vals;
  const COSTO = {
    meses: RES.meses,
    material: grupo('MATERIAL'), moEventual: grupo('MO EVENTUAL'), moPropia: grupo('MO PROPIA'),
    total: RES.meses.map((_, i) => (grupo('MATERIAL')[i] || 0) + (grupo('MO EVENTUAL')[i] || 0) + (grupo('MO PROPIA')[i] || 0)),
    cantMatriz: MAT.lavCant, porLavado: MAT.lavPor, usdLavado: MAT.lavUsdLav, usdTon: MAT.lavUsdTon,
    dolar: MAT.dolar, general: MAT.genTotal,
  };

  /* horas-hombre y lavados por mes calendario, con lo que el form llegó a cubrir */
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const POR_MES = (() => {
    const m = new Map();
    L.forEach(r => {
      const k = +r.fecha.split('/')[1] - 1;
      const v = m.get(k) || { mes: MESES[k], i: k, cam: 0, tar: 0, seg: 0, hh: 0, dias: new Set() };
      if (esCam(r)) v.cam++; else v.tar++;
      v.hh += hh(r); v.seg += r.total || 0; v.dias.add(r.fecha);
      m.set(k, v);
    });
    return [...m.values()].sort((a, b) => a.i - b.i).map(v => ({
      mes: v.mes, i: v.i, cam: v.cam, tar: v.tar, dias: v.dias.size,
      hh: r2(v.hh / 3600), camDia: r2(v.cam / v.dias.size), hhDia: r2(v.hh / 3600 / v.dias.size),
      costo: COSTO.total[v.i] != null ? COSTO.total[v.i] : null,
    }));
  })();

  const DATA = {
    meta: {
      desde: DIAS[0].f, hasta: DIAS[DIAS.length - 1].f, dias: DIAS.length,
      semanas, registros: L.length, camiones: cam.length, tareas: tar.length,
      hh: r2(L.reduce((a, r) => a + hh(r), 0) / 3600),
      hhCam: r2(cam.reduce((a, r) => a + hh(r), 0) / 3600),
      hhTar: r2(tar.reduce((a, r) => a + hh(r), 0) / 3600),
      // La misma gente lava camiones y hace tareas; separar la hora hombre por
      // tipo es lo que muestra cuánto del sector no es lavar camiones.
      hhTipo: [...new Set(L.map(r => r.tipo))].map(t => ({
        t, n: L.filter(r => r.tipo === t).length,
        hh: r2(L.filter(r => r.tipo === t).reduce((a, r) => a + hh(r), 0) / 3600),
      })).sort((a, b) => b.hh - a.hh),
      operarios: new Set(L.flatMap(r => r.ops)).size,
      archivos: archivos.length,
      corte: new Date().toISOString().slice(0, 10),
    },
    sem: SEM, dias: DIAS, turnos: TURNOS, ciclo: CICLO, ops: OPS, frig: FRIG, inc: INC,
    det: DET, calidad: CAL, costo: COSTO, porMes: POR_MES,
  };

  log('   ' + DATA.meta.registros + ' registros · ' + DATA.meta.camiones + ' camiones + ' + DATA.meta.tareas + ' tareas · '
    + DATA.meta.desde + ' a ' + DATA.meta.hasta + ' (sem ' + semanas[0] + '–' + semanas[semanas.length - 1] + ')');
  log('   ciclo medio ' + Math.round(CICLO.prom / 60) + ' min · lavado neto ' + Math.round(CICLO.netoProm / 60) + ' min · '
    + CICLO.pctVA + '% del ciclo es lavado · ' + DATA.meta.hh + ' hs hombre');
  if (CAL.fueraRango.length) log('   ! ' + CAL.fueraRango.length + ' registro(s) fuera de rango, excluidos de los promedios');
  if (CAL.diasSinCarga.length) log('   ! ' + CAL.diasSinCarga.length + ' día(s) hábil(es) del período sin ningún registro');

  escribir('client/src/dashboards/lavado-camiones.html', 'DATA', DATA);
  escribir('client/src/dashboards/lavado-informe.html', 'DATA', DATA);
  escribir('client/src/dashboards/lavado-kpi.html', 'DATA', DATA);
};
