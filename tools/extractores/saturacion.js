// Saturación de flota · cuánto le pedimos a la flota contra lo que puede dar.
//
// Cruza dos fuentes que hasta ahora no se hablaban:
//   · HOJA DE RUTA - TRANSPORTE.xlsx, hoja «Respuestas» — el form que carga
//     tráfico por cada viaje: qué tractor sale, a qué destino, qué semi lleva y
//     qué semi trae. La hoja NO acumula: guarda una ventana y el resto se
//     archiva en la base, así que se leen todas las copias que haya en las
//     carpetas y se unen por Id de formulario.
//   · el tablero de Disponibilidad de Flota — el padrón de unidades y, semana a
//     semana, cuáles están paradas. Es el denominador: la capacidad real. Por eso
//     este grupo se corre DESPUÉS de «logistica».
//
// La regla de planificación es un viaje por unidad por día. Chasis y balancines
// pueden hacer más, pero la regla se toma pareja para poder comparar.
const fs = require('fs');
const path = require('path');

const DESTINO = 'client/src/dashboards/saturacion-flota.html';

/* ── utilidades ── */
const placa = s => String(s == null ? '' : s).toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, '');
const iso = d => d instanceof Date ? d.toISOString().slice(0, 10) : null;
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const r2 = v => v == null ? null : Math.round(v * 100) / 100;
const prom = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
const pctil = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i)); };
const dif = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const habil = f => { const w = new Date(f + 'T00:00:00Z').getUTCDay(); return w >= 1 && w <= 5; };
const semanaISO = f => { const t = new Date(f + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7); };

exports.actualizar = async function ({ escribir, log, util, carpetas }) {
const XLSX = require('xlsx');

/* Todas las copias de la hoja de ruta: cada una cubre un período distinto. */
const ARCHIVOS = [];
carpetas.forEach(d => fs.readdirSync(d).forEach(f => {
  if (!/^hoja de ruta - transporte.*\.xlsx$/i.test(f)) return;
  const ruta = path.join(d, f);
  // En Descargas hay copias que el navegador guardó como HTML con nombre .xlsx:
  // no se pueden abrir y no vale la pena tumbar la corrida por eso.
  try { XLSX.readFile(ruta, { sheetRows: 1 }); ARCHIVOS.push(ruta); }
  catch (e) { log('   · salteo ' + f + ': no es un xlsx legible'); }
}));
if (!ARCHIVOS.length) throw new Error('no encuentro ningún «HOJA DE RUTA - TRANSPORTE.xlsx» en ' + carpetas.join(' ni en '));
const leerConst = (destino, nombre) => {
  const v = util.actual(destino, nombre);
  if (!v) throw new Error(destino + ': no pude leer ' + nombre);
  return v;
};

const GRUPO = t => /tractor/i.test(t) ? 'Tractor' : /chasis|balanc/i.test(t) ? 'Chasis/Balancín'
  : /batea/i.test(t) ? 'Batea' : /semi/i.test(t) ? 'Semi' : /torito/i.test(t) ? 'Torito' : 'Otro';
// Lo que tracciona contra lo que se arrastra. La batea es remolque, aunque
// alguna vez aparezca cargada en la columna de patente.
const TRACCION = new Set(['Tractor', 'Chasis/Balancín']);
const REMOLQUE = new Set(['Semi', 'Batea']);

/* ═══ 1 · el padrón de unidades ═══ */
const TIPO = new Map();
ARCHIVOS.forEach(f => {
  const wb = XLSX.readFile(f, { cellDates: true });
  if (!wb.Sheets['Base']) return;
  XLSX.utils.sheet_to_json(wb.Sheets['Base'], { header: 1, raw: true, defval: null, blankrows: false })
    .slice(1).forEach(r => { if (r[0]) TIPO.set(placa(r[0]), String(r[1] || '').trim()); });
});
const FLOTA = leerConst('client/src/dashboards/disponibilidad-flota.html', 'DATA');
FLOTA.disponibles.forEach(u => { if (!TIPO.has(placa(u.dom))) TIPO.set(placa(u.dom), u.tipo); });
const PADRON = [...TIPO.keys()];

/* ── patentes mal tipeadas ────────────────────────────────────────────────
   El form las escribe a mano: hay transposiciones (AG525VN por AG252VN),
   dígitos de más (HMH2555) y texto pegado (SPW094FEDERAL). Se corrigen contra
   el padrón por distancia de edición, y sólo cuando hay un único candidato:
   con dos o más se deja como está y se lista en calidad del dato. */
function edicion(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const CACHE = new Map(), CORREGIDAS = new Map();
function normalizar(p) {
  if (!p || TIPO.has(p)) return p || '';
  if (CACHE.has(p)) return CACHE.get(p);
  let r = p;
  const pref = PADRON.find(x => p.startsWith(x) && p.length > x.length);
  if (pref) r = pref;
  else for (const dist of [1, 2]) {
    const c = PADRON.filter(x => edicion(p, x) <= dist);
    if (c.length === 1) { r = c[0]; break; }
    if (c.length > 1) break;
  }
  if (r !== p) CORREGIDAS.set(p, r);
  CACHE.set(p, r);
  return r;
}

/* ═══ 2 · las hojas de ruta ═══ */
const HR = new Map();
ARCHIVOS.forEach(f => {
  const wb = XLSX.readFile(f, { cellDates: true });
  const hoja = wb.SheetNames.find(s => /respuesta/i.test(s));
  if (!hoja) return;
  const R = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: null, blankrows: false });
  const enc = R[0].map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase());
  const c = n => enc.findIndex(v => v === n);
  const K = { id: c('id'), fe: c('fecha'), pat: c('patente'), des: c('destino'), lle: c('semi lleva'), tra: c('semi trae') };
  R.slice(1).forEach(r => {
    if (!r || r[K.id] == null) return;
    const fecha = iso(r[K.fe]); if (!fecha) return;
    HR.set(r[K.id], {
      id: r[K.id], fecha, sem: semanaISO(fecha),
      pat: normalizar(placa(r[K.pat])), lleva: normalizar(placa(r[K.lle])), trae: normalizar(placa(r[K.tra])),
      des: String(r[K.des] || '').replace(/\s+/g, ' ').trim().toUpperCase(),
    });
  });
});
const L = [...HR.values()].sort((a, b) => a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : a.id - b.id));
if (!L.length) throw new Error('no hay hojas de ruta para leer');

/* ═══ 3 · capacidad: la flota disponible, semana a semana ═══ */
const ROSTER = {};
FLOTA.disponibles.forEach(u => { const g = GRUPO(u.tipo); ROSTER[g] = (ROSTER[g] || 0) + 1; });
const DISP = new Map();
FLOTA.weeks.forEach(w => {
  const par = {}; w.unidades.forEach(u => { const g = GRUPO(u.tipo); par[g] = (par[g] || 0) + 1; });
  const d = {}; Object.keys(ROSTER).forEach(g => { d[g] = ROSTER[g] - (par[g] || 0); });
  DISP.set(w.week, { label: w.label, par, d });
});
const ultimaSem = FLOTA.weeks[FLOTA.weeks.length - 1];
const capT = s => { const x = DISP.get(s); return x ? (x.d['Tractor'] || 0) + (x.d['Chasis/Balancín'] || 0) : null; };
const capS = s => { const x = DISP.get(s); return x ? (x.d['Semi'] || 0) + (x.d['Batea'] || 0) : null; };

/* ═══ 4 · rotación de semis: de que sale a que vuelve ═══ */
const eventos = new Map();
L.forEach(h => {
  // La batea es remolque como el semi: sale, se queda en el destino y vuelve.
  const push = (p, t) => { if (!p || !REMOLQUE.has(GRUPO(TIPO.get(p) || ''))) return;
    if (!eventos.has(p)) eventos.set(p, []); eventos.get(p).push({ f: h.fecha, t, des: h.des }); };
  push(h.lleva, 'sale'); push(h.trae, 'vuelve');
});
// Un ciclo sólo vale si TODOS los días hábiles entre la salida y el regreso
// tienen hoja de ruta. Si en el medio hay un tramo que ningún archivo cubre, la
// diferencia de fechas no mide rotación: mide el agujero. Un semi que salió el
// 13/06 y "vuelve" el 01/09 no estuvo 80 días afuera, es que no hay datos de
// julio ni agosto.
const conDato = new Set(L.map(h => h.fecha));
const cruzaHueco = (a, b) => {
  for (let t = new Date(a + 'T00:00:00Z'); t < new Date(b + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)) {
    const k = t.toISOString().slice(0, 10);
    if (habil(k) && !conDato.has(k)) return true;
  }
  return false;
};
const CICLOS = [], DESCARTADOS = [];
eventos.forEach((lista, p) => {
  lista.sort((a, b) => a.f < b.f ? -1 : 1);
  let abierta = null;
  lista.forEach(e => {
    if (e.t === 'sale') { if (!abierta) abierta = e; }
    else if (abierta) {
      const c = { p, sale: abierta.f, vuelve: e.f, dias: dif(abierta.f, e.f), des: abierta.des };
      if (cruzaHueco(c.sale, c.vuelve)) DESCARTADOS.push(c); else CICLOS.push(c);
      abierta = null;
    }
  });
});
const diasFuera = CICLOS.map(c => c.dias);

/* ═══ 5 · el día a día ═══ */
const fechas = [...new Set(L.map(h => h.fecha))].sort();
// Un semi ocupa flota desde que sale hasta que vuelve; el mismo día cuenta.
const ocupados = new Map();
CICLOS.forEach(c => {
  for (let t = new Date(c.sale + 'T00:00:00Z'); t <= new Date(c.vuelve + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)) {
    const k = t.toISOString().slice(0, 10);
    if (!ocupados.has(k)) ocupados.set(k, new Set());
    ocupados.get(k).add(c.p);
  }
});
const DIAS = fechas.map(f => {
  const dia = L.filter(h => h.fecha === f);
  const tracc = new Set(), semis = new Set();
  let salidas = 0;
  dia.forEach(h => {
    if (h.pat && TRACCION.has(GRUPO(TIPO.get(h.pat) || ''))) tracc.add(h.pat);
    [h.lleva, h.trae].forEach(p => { if (p && REMOLQUE.has(GRUPO(TIPO.get(p) || ''))) semis.add(p); });
    if (h.lleva && REMOLQUE.has(GRUPO(TIPO.get(h.lleva) || ''))) salidas++;
  });
  const sem = semanaISO(f), ct = capT(sem), cs = capS(sem);
  return {
    f, sem, dow: new Date(f + 'T00:00:00Z').getUTCDay(), habil: habil(f),
    viajes: dia.length, tracc: tracc.size, semis: semis.size, salidas,
    fuera: (ocupados.get(f) || new Set()).size,
    capT: ct, capS: cs,
    satT: ct ? r1(100 * dia.length / ct) : null,      // viajes contra la regla de 1 por unidad
    usoT: ct ? r1(100 * tracc.size / ct) : null,      // unidades que salieron
    satS: cs ? r1(100 * semis.size / cs) : null,      // semis movidos
    ocuS: cs ? r1(100 * (ocupados.get(f) || new Set()).size / cs) : null,  // semis fuera de planta
  };
});
const HAB = DIAS.filter(d => d.habil);

/* ═══ 6 · por unidad ═══ */
const uso = new Map();
const tocar = (p, campo, fecha) => {
  if (!p) return;
  if (!uso.has(p)) uso.set(p, { p, g: GRUPO(TIPO.get(p) || 'Otro'), viajes: 0, sale: 0, vuelve: 0, dias: new Set() });
  const v = uso.get(p); v[campo]++; v.dias.add(fecha);
};
L.forEach(h => { tocar(h.pat, 'viajes', h.fecha); tocar(h.lleva, 'sale', h.fecha); tocar(h.trae, 'vuelve', h.fecha); });
const nHab = HAB.length;
const UNIDADES = [...uso.values()].map(v => ({
  p: v.p, g: v.g, viajes: v.viajes, sale: v.sale, vuelve: v.vuelve, dias: v.dias.size,
  porDia: r2(v.viajes / v.dias.size), ocupacion: r1(100 * v.dias.size / fechas.length),
})).sort((a, b) => (b.viajes + b.sale + b.vuelve) - (a.viajes + a.sale + a.vuelve));
const OCIOSAS = PADRON.filter(p => !uso.has(p)).map(p => ({ p, g: GRUPO(TIPO.get(p)) }))
  .filter(u => u.g !== 'Torito' && u.g !== 'Otro');

/* ═══ 7 · destinos ═══ */
const dest = new Map();
L.forEach(h => {
  if (!h.des) return;
  if (!dest.has(h.des)) dest.set(h.des, { d: h.des, viajes: 0, ciclos: [] });
  dest.get(h.des).viajes++;
});
CICLOS.forEach(c => { if (dest.has(c.des)) dest.get(c.des).ciclos.push(c.dias); });
const DESTINOS = [...dest.values()].map(x => ({
  d: x.d, viajes: x.viajes, ciclos: x.ciclos.length,
  rot: x.ciclos.length ? r2(prom(x.ciclos)) : null,
  // semis que el destino tiene retenidos en un día cualquiera: el día de salida
  // también ocupa, por eso el +1.
  semisDia: x.ciclos.length ? r2(prom(x.ciclos.map(v => v + 1)) * x.ciclos.length / fechas.length) : null,
})).sort((a, b) => b.viajes - a.viajes);

/* ═══ 8 · viajes por unidad-día, contra la regla ═══ */
const unidadDia = new Map();
L.forEach(h => { if (!h.pat) return; const k = h.fecha + '|' + h.pat; unidadDia.set(k, (unidadDia.get(k) || 0) + 1); });
const REGLA = { Tractor: {}, 'Chasis/Balancín': {}, Batea: {} };
unidadDia.forEach((n, k) => {
  const g = GRUPO(TIPO.get(k.split('|')[1]) || '');
  if (!REGLA[g]) return;
  const cubo = n >= 5 ? '5+' : String(n);
  REGLA[g][cubo] = (REGLA[g][cubo] || 0) + 1;
});

/* ═══ 9 · el paquete ═══ */
const meses = {};
HAB.forEach(d => { const m = d.f.slice(0, 7); (meses[m] = meses[m] || []).push(d); });
const MESES = Object.entries(meses).map(([m, a]) => ({
  m, dias: a.length, viajes: a.reduce((x, y) => x + y.viajes, 0),
  viajesDia: r1(prom(a.map(x => x.viajes))), satT: r1(prom(a.map(x => x.satT))),
  usoT: r1(prom(a.map(x => x.usoT))), satS: r1(prom(a.map(x => x.satS))), ocuS: r1(prom(a.map(x => x.ocuS))),
}));

const huecos = (() => {
  const hay = new Set(fechas), falta = [];
  for (let t = new Date(fechas[0] + 'T00:00:00Z'); t <= new Date(fechas[fechas.length - 1] + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)) {
    const k = t.toISOString().slice(0, 10);
    if (habil(k) && !hay.has(k)) falta.push(k);
  }
  return falta;
})();
const sinPadron = {};
L.forEach(h => [h.pat, h.lleva, h.trae].forEach(p => { if (p && !TIPO.has(p)) sinPadron[p] = (sinPadron[p] || 0) + 1; }));

const DATA = {
  meta: {
    desde: fechas[0], hasta: fechas[fechas.length - 1], dias: fechas.length, habiles: nHab,
    hojas: L.length, archivos: ARCHIVOS.length, corte: new Date().toISOString().slice(0, 10),
    semanaFlota: ultimaSem.label,
  },
  roster: ROSTER,
  capacidad: { tracc: r1(prom(HAB.map(d => d.capT))), semis: r1(prom(HAB.map(d => d.capS))) },
  resumen: {
    viajesDia: r1(prom(HAB.map(d => d.viajes))), viajesMax: Math.max(...HAB.map(d => d.viajes)),
    satT: r1(prom(HAB.map(d => d.satT))), usoT: r1(prom(HAB.map(d => d.usoT))),
    satS: r1(prom(HAB.map(d => d.satS))), ocuS: r1(prom(HAB.map(d => d.ocuS))),
    diasSobre100T: HAB.filter(d => d.satT > 100).length, diasSobre100S: HAB.filter(d => d.ocuS > 100).length,
    salidasDia: r1(prom(HAB.map(d => d.salidas))),
  },
  rotacion: {
    n: CICLOS.length, prom: r2(prom(diasFuera)), p50: pctil(diasFuera, .5), p90: pctil(diasFuera, .9),
    max: Math.max(...diasFuera),
    dist: [0, 1, 2, 3, 4, 5, 6, 7].map(d => ({ d: d === 7 ? '7+' : String(d), n: diasFuera.filter(x => d === 7 ? x >= 7 : x === d).length })),
  },
  dias: DIAS, meses: MESES, unidades: UNIDADES, ociosas: OCIOSAS, destinos: DESTINOS, regla: REGLA,
  calidad: {
    corregidas: [...CORREGIDAS.entries()], sinPadron, huecos,
    ciclosDescartados: DESCARTADOS.length,
    ciclosAbiertos: [...eventos.entries()].filter(([, l]) => l.filter(e => e.t === 'sale').length !== l.filter(e => e.t === 'vuelve').length).length,
  },
};

escribir(DESTINO, 'DATA', DATA);
log('hojas de ruta: ' + L.length + ' · ' + DATA.meta.desde + ' a ' + DATA.meta.hasta + ' · ' + fechas.length + ' días (' + nHab + ' hábiles)');
log('roster: ' + JSON.stringify(ROSTER));
log('capacidad media: tracción ' + DATA.capacidad.tracc + ' · semis ' + DATA.capacidad.semis);
log('viajes por día hábil: ' + DATA.resumen.viajesDia + ' (max ' + DATA.resumen.viajesMax + ')');
log('saturación tracción ' + DATA.resumen.satT + '% · uso de unidades ' + DATA.resumen.usoT + '%');
log('semis movidos ' + DATA.resumen.satS + '% · semis fuera de planta ' + DATA.resumen.ocuS + '%');
log('días sobre 100%: tracción ' + DATA.resumen.diasSobre100T + '/' + nHab + ' · semis ' + DATA.resumen.diasSobre100S + '/' + nHab);
log('ciclos descartados por cruzar un hueco de datos: ' + DESCARTADOS.length);
log('rotación de semis: ' + DATA.rotacion.prom + ' días (mediana ' + DATA.rotacion.p50 + ', p90 ' + DATA.rotacion.p90 + ', max ' + DATA.rotacion.max + ') sobre ' + DATA.rotacion.n + ' ciclos');
log('unidades sin un solo movimiento: ' + (OCIOSAS.map(u => u.p + ' (' + u.g + ')').join(', ') || '—'));
if (CORREGIDAS.size) log('patentes corregidas: ' + CORREGIDAS.size);
if (Object.keys(sinPadron).length) log('! patentes sin padrón: ' + JSON.stringify(sinPadron));
if (huecos.length) log('! ' + huecos.length + ' día(s) hábil(es) sin hoja de ruta en el rango');


};
