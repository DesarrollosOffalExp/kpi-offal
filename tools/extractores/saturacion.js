// Saturación de flota · la motriz y los semis se miden con reglas distintas.
//
// Fuentes:
//   · HOJA DE RUTA - TRANSPORTE.xlsx, hoja «Respuestas» — el form que carga
//     tráfico por cada viaje: qué unidad motriz sale, a qué destino, qué semi
//     lleva y qué semi trae. La hoja NO acumula: guarda una ventana y el resto se
//     archiva en la base (controletiquetas → transporte.HojasRuta), así que se
//     leen todas las copias que haya en las carpetas y se unen por Id.
//   · Disponibilidad de Flota — qué unidades están paradas cada semana. Es lo que
//     descuenta de la capacidad, por eso este grupo va DESPUÉS de «logistica».
//
// ── Las reglas del sector, que son las que hacen que el número signifique algo ──
//
//   · El SEMI sí tiene la regla de un viaje por día: vuelve cargado y se descarga
//     esa noche o al día siguiente. Si se descarga tarde puede llegar a salir para
//     los cambios de la noche, pero es la excepción.
//   · El TRACTOR no tiene esa regla. Su regla es otra: sale con un vacío y vuelve
//     con un lleno. Al soltar la unidad queda libre y encadena otro viaje.
//   · Salvo en los viajes DEDICADOS, donde el tractor se queda con su unidad y
//     vuelve con ella: las bateas de sebo (Swift, Refinería, Grabya) y los viajes
//     de Arre Beef/Ramallo y Hugues. Ahí el tractor no encadena.
//   · El CHASIS y el BALANCÍN son unidad completa: siempre van y vuelven con lo
//     mismo, así que para ellos la regla de un viaje por día sí aplica.
//   · Los TORITOS son de patio: mueven adentro y sólo salen por fuerza mayor. No
//     cuentan como capacidad de viaje.
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

/* ── el padrón, como lo pasó Logística el 05/09/2026 ──────────────────────
   Es la referencia: distingue chasis de balancín y marca las unidades fuera de
   servicio, cosas que el indicador de disponibilidad no separa. Lo que aparece
   en una hoja de ruta y no está acá se cuenta aparte, como motriz de afuera. */
const PADRON = {};
const cargar = (tipo, lista) => lista.split(/\s+/).filter(Boolean).forEach(p => { PADRON[placa(p)] = tipo; });
cargar('Tractor', 'AC555VG AC555VL AC581KP IZH428 AC555VK AC555VJ AC555VI AC555VH JNA841 MXC711 NGY770 AG252VM AG252VL AG252VK AG252VN AG252VJ');
cargar('Torito', 'GGL938 IHZ209 IHZ210 HMH278 IHZ211');
cargar('Chasis', 'DAY315 DLI931 JEQ393 SLW322 SIK946 LZG119');
cargar('Balancín', 'BMS047 HXU959');
cargar('Semi', 'AB186BC AB186BD AC356EE AC356EF AC356EG AC356EI AC356EJ AC356EK AE865GG AE865GF '
  + 'AH532BY AH532BZ AH546GA AH546GB AH546GC CMR938 FKP957 HMH249 HMH252 HMH255 HRV058 IHZ227 IHZ228 '
  + 'IHZ284 IHZ285 IKO413 IKO414 IKO415 IKO416 IMO536 IND595 JAP922 JNS092 JNS094 KWT404 KWT406 '
  + 'LMD345 LMD346 MWP509 MXC712 MXC713 MXC715 NIJ630 NIJ632 POG190 SPW094');
cargar('Batea', 'AC427IU AD064DJ AE145FT AG390LR');
cargar('Fuera de servicio', 'POG191 POG192 POG193 POG194 POG195 POG196 POG197 POG198 POG199 POG200 POG201 '
  + 'SVH709 TQZ126 URF470 CAE845 AA121JE');

const MOTRIZ = new Set(['Tractor', 'Chasis', 'Balancín']);
const REMOLQUE = new Set(['Semi', 'Batea']);
const grupo = p => PADRON[p] || null;
const esMotriz = p => MOTRIZ.has(grupo(p));
const esRemolque = p => REMOLQUE.has(grupo(p));

/* Destinos donde el tractor se queda con su unidad, según el sector. Sirve para
   contrastar la regla declarada contra lo que muestra el dato. */
const DEDICADO_DECLARADO = /SWIFT|REFINERIA|GRABYA|ARRE\s*BEEF|RAMALLO|HUGUE|HUGHE/i;

exports.actualizar = async function ({ escribir, log, util, carpetas }) {
  const XLSX = require('xlsx');

  /* ═══ 1 · las hojas de ruta ═══ */
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

  /* ── patentes mal tipeadas ──────────────────────────────────────────────
     El form las escribe a mano: hay transposiciones (AG525VN por AG252VN),
     dígitos de más (HMH2555) y texto pegado (SPW094FEDERAL). Se corrigen contra
     el padrón por distancia de edición y sólo cuando hay un único candidato. */
  const CLAVES = Object.keys(PADRON);
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
    if (!p || PADRON[p]) return p || '';
    if (CACHE.has(p)) return CACHE.get(p);
    let r = p;
    const pref = CLAVES.find(x => p.startsWith(x) && p.length > x.length);
    if (pref) r = pref;
    else for (const dist of [1, 2]) {
      const c = CLAVES.filter(x => edicion(p, x) <= dist);
      if (c.length === 1) { r = c[0]; break; }
      if (c.length > 1) break;
    }
    if (r !== p) CORREGIDAS.set(p, r);
    CACHE.set(p, r);
    return r;
  }

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
      const lleva = normalizar(placa(r[K.lle])), trae = normalizar(placa(r[K.tra]));
      HR.set(r[K.id], {
        id: r[K.id], fecha, sem: semanaISO(fecha), pat: normalizar(placa(r[K.pat])), lleva, trae,
        des: String(r[K.des] || '').replace(/\s+/g, ' ').trim().toUpperCase(),
        // El tractor se queda con su unidad cuando la lleva y la trae de vuelta.
        tipo: (!lleva || !trae) ? 'incompleto' : (lleva === trae ? 'dedicado' : 'intercambio'),
      });
    });
  });
  const L = [...HR.values()].sort((a, b) => a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : a.id - b.id));
  if (!L.length) throw new Error('no hay hojas de ruta para leer');
  const fechas = [...new Set(L.map(h => h.fecha))].sort();

  /* ═══ 2 · capacidad: el padrón menos lo que está parado ═══ */
  const FLOTA = util.actual('client/src/dashboards/disponibilidad-flota.html', 'DATA');
  if (!FLOTA) throw new Error('no pude leer DATA de disponibilidad-flota.html');
  const ROSTER = {};
  Object.values(PADRON).forEach(t => { ROSTER[t] = (ROSTER[t] || 0) + 1; });
  const capBase = { motriz: (ROSTER['Tractor'] || 0) + (ROSTER['Chasis'] || 0) + (ROSTER['Balancín'] || 0),
    tractor: ROSTER['Tractor'] || 0, chasis: (ROSTER['Chasis'] || 0) + (ROSTER['Balancín'] || 0),
    remolque: (ROSTER['Semi'] || 0) + (ROSTER['Batea'] || 0) };
  const DISP = new Map();
  FLOTA.weeks.forEach(w => {
    let pTractor = 0, pChasis = 0, pRem = 0;
    w.unidades.forEach(u => {
      const g = grupo(normalizar(placa(u.dom)));
      if (g === 'Tractor') pTractor++;
      else if (g === 'Chasis' || g === 'Balancín') pChasis++;
      else if (REMOLQUE.has(g)) pRem++;
    });
    DISP.set(w.week, { label: w.label,
      tractor: capBase.tractor - pTractor, chasis: capBase.chasis - pChasis,
      motriz: capBase.motriz - pTractor - pChasis, remolque: capBase.remolque - pRem,
      paradas: { tractor: pTractor, chasis: pChasis, remolque: pRem } });
  });
  const cap = (s, k) => { const x = DISP.get(s); return x ? x[k] : null; };

  /* Semanas del período en que cada unidad figura parada en el indicador de
     disponibilidad. Sin esto, una unidad que no hizo viajes porque está rota
     parece una unidad ociosa, y es lo contrario: ya está descontada de la
     capacidad. */
  const semanasHR = [...new Set(L.map(h => h.sem))];
  const PARADA_SEM = new Map();
  FLOTA.weeks.filter(w => semanasHR.includes(w.week)).forEach(w => {
    w.unidades.forEach(u => {
      const p = normalizar(placa(u.dom));
      if (!PARADA_SEM.has(p)) PARADA_SEM.set(p, { semanas: 0, obs: '', destino: '' });
      const v = PARADA_SEM.get(p); v.semanas++;
      if (u.obs) v.obs = u.obs;
      if (u.destino) v.destino = u.destino;
    });
  });
  const PARADA_EN = new Map();   // patente → set de semanas en que figura parada
  FLOTA.weeks.forEach(w => w.unidades.forEach(u => {
    const p = normalizar(placa(u.dom));
    if (!PARADA_EN.has(p)) PARADA_EN.set(p, new Set());
    PARADA_EN.get(p).add(w.week);
  }));
  // Días del período en que la unidad NO figuraba parada: es contra esto que hay
  // que mirar si se usó, no contra el calendario.
  const diasDisponibles = p => { const par = PARADA_EN.get(p); return par ? fechas.filter(f => !par.has(semanaISO(f))).length : fechas.length; };
  const semParada = p => (PARADA_SEM.get(p) || { semanas: 0 }).semanas;
  const semDisponible = p => semanasHR.length - semParada(p);

  /* ═══ 3 · rotación de los remolques ═══
     Un ciclo sólo vale si todos los días hábiles entre la salida y el regreso
     tienen hoja de ruta: si en el medio hay un tramo que ningún archivo cubre, la
     diferencia de fechas no mide rotación, mide el agujero. */
  const conDato = new Set(fechas);
  const cruzaHueco = (a, b) => {
    for (let t = new Date(a + 'T00:00:00Z'); t < new Date(b + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)) {
      const k = t.toISOString().slice(0, 10);
      if (habil(k) && !conDato.has(k)) return true;
    }
    return false;
  };
  const eventos = new Map();
  L.forEach(h => {
    const push = (p, t) => { if (!p || !esRemolque(p)) return;
      if (!eventos.has(p)) eventos.set(p, []); eventos.get(p).push({ f: h.fecha, t, des: h.des }); };
    push(h.lleva, 'sale'); push(h.trae, 'vuelve');
  });
  const CICLOS = []; let descartados = 0;
  eventos.forEach((lista, p) => {
    lista.sort((a, b) => a.f < b.f ? -1 : 1);
    let abierta = null;
    lista.forEach(e => {
      if (e.t === 'sale') { if (!abierta) abierta = e; }
      else if (abierta) {
        const c = { p, sale: abierta.f, vuelve: e.f, dias: dif(abierta.f, e.f), des: abierta.des };
        if (cruzaHueco(c.sale, c.vuelve)) descartados++; else CICLOS.push(c);
        abierta = null;
      }
    });
  });
  const diasFuera = CICLOS.map(c => c.dias);
  const ocupados = new Map();
  CICLOS.forEach(c => {
    for (let t = new Date(c.sale + 'T00:00:00Z'); t <= new Date(c.vuelve + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1)) {
      const k = t.toISOString().slice(0, 10);
      if (!ocupados.has(k)) ocupados.set(k, new Set());
      ocupados.get(k).add(c.p);
    }
  });

  /* ═══ 4 · el día a día ═══ */
  const DIAS = fechas.map(f => {
    const dia = L.filter(h => h.fecha === f);
    const tractores = new Set(), chasis = new Set(), afuera = new Set(), salidas = new Set();
    let ded = 0, inter = 0, incompl = 0, dedTractor = 0, interTractor = 0, viajesFuera = 0;
    dia.forEach(h => {
      const g = grupo(h.pat);
      if (g === 'Tractor') tractores.add(h.pat);
      else if (g === 'Chasis' || g === 'Balancín') chasis.add(h.pat);
      else if (h.pat && !PADRON[h.pat]) { afuera.add(h.pat); viajesFuera++; }
      if (h.tipo === 'dedicado') { ded++; if (g === 'Tractor') dedTractor++; }
      else if (h.tipo === 'intercambio') { inter++; if (g === 'Tractor') interTractor++; }
      else incompl++;
      if (h.lleva && esRemolque(h.lleva)) salidas.add(h.lleva);
    });
    const sem = semanaISO(f);
    const cT = cap(sem, 'tractor'), cC = cap(sem, 'chasis'), cR = cap(sem, 'remolque');
    const fueraPlanta = (ocupados.get(f) || new Set()).size;
    return {
      f, sem, dow: new Date(f + 'T00:00:00Z').getUTCDay(), habil: habil(f),
      viajes: dia.length, ded, inter, incompl, dedTractor, interTractor,
      tractores: tractores.size, chasis: chasis.size, afuera: afuera.size, viajesFuera,
      salidas: salidas.size, fueraPlanta,
      capT: cT, capC: cC, capR: cR,
      usoT: cT ? r1(100 * tractores.size / cT) : null,          // tractores propios que salieron
      usoC: cC ? r1(100 * chasis.size / cC) : null,             // chasis y balancines que salieron
      satR: cR ? r1(100 * salidas.size / cR) : null,            // regla del semi: un viaje por día
      ocuR: cR ? r1(100 * fueraPlanta / cR) : null,             // semis fuera de planta
      viajesPorTractor: tractores.size ? r2((dedTractor + interTractor) / tractores.size) : null,
    };
  });
  const HAB = DIAS.filter(d => d.habil);
  const nHab = HAB.length;

  /* ═══ 5 · cuántos tractores hacen falta ═══
     El dedicado ata el tractor: en un día donde sólo hace dedicados hace 1,5. El
     intercambio lo libera: en un día donde sólo intercambia hace 1,8. Con esos
     dos rendimientos medidos se puede convertir la demanda del día en tractores. */
  const td = new Map();
  L.filter(h => h.habil !== false && habil(h.fecha) && grupo(h.pat) === 'Tractor').forEach(h => {
    const k = h.fecha + '|' + h.pat;
    if (!td.has(k)) td.set(k, { d: 0, e: 0 });
    const v = td.get(k);
    if (h.tipo === 'dedicado') v.d++; else if (h.tipo === 'intercambio') v.e++;
  });
  const soloE = [...td.values()].filter(v => v.d === 0 && v.e > 0);
  const soloD = [...td.values()].filter(v => v.e === 0 && v.d > 0);
  const rendInter = prom(soloE.map(v => v.e)) || 1;
  const rendDed = prom(soloD.map(v => v.d)) || 1;
  const necesarios = d => (d.dedTractor / rendDed) + (d.interTractor / rendInter);
  HAB.forEach(d => { d.tractoresNec = r2(necesarios(d)); d.satMotriz = d.capT ? r1(100 * necesarios(d) / d.capT) : null; });

  /* ═══ 6 · unidades ═══ */
  const uso = new Map();
  const tocar = (p, campo, fecha, tipo) => {
    if (!p) return;
    if (!uso.has(p)) uso.set(p, { p, g: grupo(p) || 'Fuera del padrón', viajes: 0, ded: 0, inter: 0, sale: 0, vuelve: 0, dias: new Set() });
    const v = uso.get(p); v[campo]++; v.dias.add(fecha);
    if (campo === 'viajes' && tipo) { if (tipo === 'dedicado') v.ded++; else if (tipo === 'intercambio') v.inter++; }
  };
  L.forEach(h => { tocar(h.pat, 'viajes', h.fecha, h.tipo); tocar(h.lleva, 'sale', h.fecha); tocar(h.trae, 'vuelve', h.fecha); });
  const UNIDADES = [...uso.values()].map(v => ({
    p: v.p, g: v.g, viajes: v.viajes, ded: v.ded, inter: v.inter, sale: v.sale, vuelve: v.vuelve,
    dias: v.dias.size, porDia: v.viajes ? r2(v.viajes / v.dias.size) : null,
    ocupacion: r1(100 * v.dias.size / fechas.length),
    semParada: semParada(v.p), semTotal: semanasHR.length,
    diasDisp: diasDisponibles(v.p), usoDias: r1(100 * v.dias.size / (diasDisponibles(v.p) || 1)),
  })).sort((a, b) => (b.viajes + b.sale + b.vuelve) - (a.viajes + a.sale + a.vuelve));
  // Sin movimiento hay dos casos distintos y no se pueden mezclar: la unidad que
  // estuvo parada todas las semanas —ya descontada de la capacidad, no es un
  // problema de uso— y la que estuvo disponible y aun así no salió.
  const sinMover = Object.keys(PADRON)
    .filter(p => !uso.has(p) && PADRON[p] !== 'Fuera de servicio' && PADRON[p] !== 'Torito')
    .map(p => ({ p, g: PADRON[p], semParada: semParada(p), semDisp: semDisponible(p),
      motivo: (PARADA_SEM.get(p) || {}).destino || (PARADA_SEM.get(p) || {}).obs || '' }));
  const OCIOSAS = sinMover.filter(u => u.semDisp > 0);
  const PARADAS_TODO = sinMover.filter(u => u.semDisp <= 0);
  const TORITOS = Object.keys(PADRON).filter(p => PADRON[p] === 'Torito')
    .map(p => ({ p, viajes: uso.has(p) ? uso.get(p).viajes : 0 }));
  const EXTERNOS = UNIDADES.filter(u => u.g === 'Fuera del padrón' && u.viajes > 0);

  /* ═══ 7 · destinos ═══ */
  const dest = new Map();
  L.forEach(h => {
    if (!h.des) return;
    if (!dest.has(h.des)) dest.set(h.des, { d: h.des, viajes: 0, ded: 0, inter: 0, ciclos: [] });
    const v = dest.get(h.des); v.viajes++;
    if (h.tipo === 'dedicado') v.ded++; else if (h.tipo === 'intercambio') v.inter++;
  });
  CICLOS.forEach(c => { if (dest.has(c.des)) dest.get(c.des).ciclos.push(c.dias); });
  const DESTINOS = [...dest.values()].map(x => ({
    d: x.d, viajes: x.viajes, ded: x.ded, inter: x.inter,
    modo: x.ded > x.inter ? 'dedicado' : x.inter > 0 ? 'intercambio' : 'sin dato',
    declarado: DEDICADO_DECLARADO.test(x.d),
    ciclos: x.ciclos.length, rot: x.ciclos.length ? r2(prom(x.ciclos)) : null,
    // remolques que el destino tiene retenidos en un día cualquiera; el día de
    // salida también ocupa, por eso el +1
    inmoviliza: x.ciclos.length ? r2(prom(x.ciclos.map(v => v + 1)) * x.ciclos.length / fechas.length) : null,
  })).sort((a, b) => b.viajes - a.viajes);

  /* ═══ 8 · distribuciones ═══ */
  const cuboSemi = {};
  const sd = new Map();
  L.filter(h => habil(h.fecha) && h.lleva && esRemolque(h.lleva)).forEach(h => {
    const k = h.fecha + '|' + h.lleva; sd.set(k, (sd.get(k) || 0) + 1);
  });
  sd.forEach(n => { const c = n >= 3 ? '3+' : String(n); cuboSemi[c] = (cuboSemi[c] || 0) + 1; });
  const cuboChasis = {};
  const cd = new Map();
  L.filter(h => habil(h.fecha) && (grupo(h.pat) === 'Chasis' || grupo(h.pat) === 'Balancín')).forEach(h => {
    const k = h.fecha + '|' + h.pat; cd.set(k, (cd.get(k) || 0) + 1);
  });
  cd.forEach(n => { const c = n >= 3 ? '3+' : String(n); cuboChasis[c] = (cuboChasis[c] || 0) + 1; });
  const cuboTractor = { soloInter: {}, soloDed: {}, mixto: [...td.values()].filter(v => v.d > 0 && v.e > 0).length };
  soloE.forEach(v => { const c = v.e >= 5 ? '5+' : String(v.e); cuboTractor.soloInter[c] = (cuboTractor.soloInter[c] || 0) + 1; });
  soloD.forEach(v => { const c = v.d >= 4 ? '4+' : String(v.d); cuboTractor.soloDed[c] = (cuboTractor.soloDed[c] || 0) + 1; });

  /* ═══ 9 · el paquete ═══ */
  const meses = {};
  HAB.forEach(d => { const m = d.f.slice(0, 7); (meses[m] = meses[m] || []).push(d); });
  const MESES = Object.entries(meses).map(([m, a]) => ({
    m, dias: a.length, viajes: a.reduce((x, y) => x + y.viajes, 0),
    viajesDia: r1(prom(a.map(x => x.viajes))),
    satMotriz: r1(prom(a.map(x => x.satMotriz))), usoT: r1(prom(a.map(x => x.usoT))),
    satR: r1(prom(a.map(x => x.satR))), ocuR: r1(prom(a.map(x => x.ocuR))),
    ded: r1(prom(a.map(x => x.ded))), inter: r1(prom(a.map(x => x.inter))),
    viajesFuera: r1(prom(a.map(x => x.viajesFuera))),
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
  L.forEach(h => [h.pat, h.lleva, h.trae].forEach(p => { if (p && !PADRON[p]) sinPadron[p] = (sinPadron[p] || 0) + 1; }));
  const declarados = L.filter(h => DEDICADO_DECLARADO.test(h.des));

  /* ═══ el embudo: de la flota total al parque que realmente se puede usar ═══
     Es la cuenta que hay que ver antes de cualquier porcentaje: si el
     denominador es el padrón entero, la saturación siempre parece baja. */
  const ultW = FLOTA.weeks[FLOTA.weeks.length - 1];
  const paradasUlt = g => ultW.unidades.filter(u => {
    const t = grupo(normalizar(placa(u.dom)));
    return g === 'motriz' ? (t === 'Tractor' || t === 'Chasis' || t === 'Balancín') : REMOLQUE.has(t);
  });
  const usadasSet = g => { const S = new Set();
    UNIDADES.forEach(u => { const esMot = u.g === 'Tractor' || u.g === 'Chasis' || u.g === 'Balancín';
      if (g === 'motriz' ? (esMot && u.viajes > 0) : (REMOLQUE.has(u.g) && (u.sale > 0 || u.vuelve > 0))) S.add(u.p); });
    return S; };
  const delPadron = g => Object.keys(PADRON).filter(p => g === 'motriz' ? MOTRIZ.has(PADRON[p]) : REMOLQUE.has(PADRON[p]));
  const EMBUDO = ['motriz', 'remolque'].map(g => {
    const total = delPadron(g), usadas = usadasSet(g);
    const nuncaSalio = total.filter(p => !usadas.has(p));
    return {
      g,
      padron: total.length,
      fueraServicio: Object.keys(PADRON).filter(p => PADRON[p] === 'Fuera de servicio').length,
      paradasUlt: paradasUlt(g).length,
      dispUlt: total.length - paradasUlt(g).length,
      paradasProm: r1(prom(HAB.map(d => (g === 'motriz' ? (capBase.motriz - d.capT - d.capC) : (capBase.remolque - d.capR))))),
      dispProm: r1(prom(HAB.map(d => (g === 'motriz' ? (d.capT + d.capC) : d.capR)))),
      // Un remolque que está en el frigorífico está en uso aunque hoy no salga:
      // por eso del lado del remolque se cuenta el que está fuera de planta.
      usadasProm: r1(prom(HAB.map(d => (g === 'motriz' ? (d.tractores + d.chasis) : d.fueraPlanta)))),
      salidasProm: g === 'remolque' ? r1(prom(HAB.map(d => d.salidas))) : null,
      nuncaSalio: nuncaSalio.map(p => ({ p, g: PADRON[p], semParada: semParada(p), diasDisp: diasDisponibles(p),
        motivo: (PARADA_SEM.get(p) || {}).destino || (PARADA_SEM.get(p) || {}).obs || '' })),
      detenidas: paradasUlt(g).map(u => ({ p: normalizar(placa(u.dom)), obs: u.destino || u.obs || '', dias: u.dias })),
    };
  });

  const DATA = {
    meta: {
      desde: fechas[0], hasta: fechas[fechas.length - 1], dias: fechas.length, habiles: nHab,
      hojas: L.length, archivos: ARCHIVOS.length, corte: new Date().toISOString().slice(0, 10),
      semanaFlota: FLOTA.weeks[FLOTA.weeks.length - 1].label,
    },
    padron: ROSTER, capBase, embudo: EMBUDO, semanaUlt: ultW.label,
    capacidad: { tractor: r1(prom(HAB.map(d => d.capT))), chasis: r1(prom(HAB.map(d => d.capC))), remolque: r1(prom(HAB.map(d => d.capR))) },
    resumen: {
      viajesDia: r1(prom(HAB.map(d => d.viajes))), viajesMax: Math.max(...HAB.map(d => d.viajes)),
      dedDia: r1(prom(HAB.map(d => d.ded))), interDia: r1(prom(HAB.map(d => d.inter))), incomplDia: r1(prom(HAB.map(d => d.incompl))),
      tractoresDia: r1(prom(HAB.map(d => d.tractores))), chasisDia: r1(prom(HAB.map(d => d.chasis))),
      usoT: r1(prom(HAB.map(d => d.usoT))), usoC: r1(prom(HAB.map(d => d.usoC))),
      satMotriz: r1(prom(HAB.map(d => d.satMotriz))), tractoresNec: r1(prom(HAB.map(d => d.tractoresNec))),
      satR: r1(prom(HAB.map(d => d.satR))), ocuR: r1(prom(HAB.map(d => d.ocuR))),
      salidasDia: r1(prom(HAB.map(d => d.salidas))), fueraPlantaDia: r1(prom(HAB.map(d => d.fueraPlanta))),
      diasSobreMotriz: HAB.filter(d => d.satMotriz > 100).length, diasSobreR: HAB.filter(d => d.ocuR > 100).length,
      viajesFueraDia: r1(prom(HAB.map(d => d.viajesFuera))),
      viajesFueraTotal: L.filter(h => h.pat && !PADRON[h.pat]).length,
      rendInter: r2(rendInter), rendDed: r2(rendDed),
    },
    rotacion: {
      n: CICLOS.length, prom: r2(prom(diasFuera)), p50: pctil(diasFuera, .5), p90: pctil(diasFuera, .9),
      max: diasFuera.length ? Math.max(...diasFuera) : null, descartados,
      dist: [0, 1, 2, 3, 4, 5, 6, 7].map(d => ({ d: d === 7 ? '7+' : String(d), n: diasFuera.filter(x => d === 7 ? x >= 7 : x === d).length })),
    },
    reglaSemi: cuboSemi, reglaChasis: cuboChasis, reglaTractor: cuboTractor,
    dias: DIAS, meses: MESES, unidades: UNIDADES, ociosas: OCIOSAS, paradasTodo: PARADAS_TODO,
    semanasPeriodo: semanasHR.length, toritos: TORITOS, externos: EXTERNOS,
    destinos: DESTINOS,
    validacion: {
      declarados: declarados.length,
      declaradosDedicados: declarados.filter(h => h.tipo === 'dedicado').length,
      declaradosIntercambio: declarados.filter(h => h.tipo === 'intercambio').length,
      dedicadosNoDeclarados: L.filter(h => h.tipo === 'dedicado' && !DEDICADO_DECLARADO.test(h.des)).length,
    },
    calidad: { corregidas: [...CORREGIDAS.entries()], sinPadron, huecos },
  };

  escribir(DESTINO, 'DATA', DATA);

  log('hojas de ruta: ' + L.length + ' · ' + DATA.meta.desde + ' a ' + DATA.meta.hasta + ' · ' + fechas.length + ' días (' + nHab + ' hábiles)');
  log('padrón: ' + JSON.stringify(ROSTER));
  EMBUDO.forEach(e => log('   ' + e.g.padEnd(9) + ': padrón ' + e.padron + ' · parados hoy ' + e.paradasUlt
    + ' → utilizables ' + e.dispUlt + '  |  promedio del período: ' + e.dispProm + ' utilizables, ' + e.usadasProm
    + ' usadas (' + r1(100 * e.usadasProm / e.dispProm) + '%)' + (e.nuncaSalio.length ? ' · nunca salieron ' + e.nuncaSalio.length : '')));
  log('viajes por día hábil: ' + DATA.resumen.viajesDia + ' → ' + DATA.resumen.dedDia + ' dedicados + ' + DATA.resumen.interDia + ' de intercambio');
  log('motriz: ' + DATA.resumen.tractoresDia + ' tractores por día de ' + DATA.capacidad.tractor + ' disponibles (uso ' + DATA.resumen.usoT + '%)');
  log('   necesarios por la carga del día: ' + DATA.resumen.tractoresNec + ' → saturación ' + DATA.resumen.satMotriz + '% · '
    + DATA.resumen.diasSobreMotriz + '/' + nHab + ' días por encima del 100%');
  log('   rendimiento medido: ' + DATA.resumen.rendInter + ' intercambios o ' + DATA.resumen.rendDed + ' dedicados por tractor-día');
  log('   motriz de afuera del padrón: ' + DATA.resumen.viajesFueraTotal + ' viajes (' + DATA.resumen.viajesFueraDia + ' por día)');
  log('semis: ' + DATA.resumen.salidasDia + ' salidas por día de ' + DATA.capacidad.remolque + ' disponibles (regla de 1 viaje: ' + DATA.resumen.satR + '%)');
  log('   fuera de planta: ' + DATA.resumen.fueraPlantaDia + ' por día → ocupación ' + DATA.resumen.ocuR + '% · ' + DATA.resumen.diasSobreR + '/' + nHab + ' días sobre el 100%');
  log('   cumplimiento de la regla: ' + JSON.stringify(cuboSemi) + ' salidas por semi-día');
  log('rotación: ' + DATA.rotacion.prom + ' días (mediana ' + DATA.rotacion.p50 + ', p90 ' + DATA.rotacion.p90 + ') sobre ' + DATA.rotacion.n + ' ciclos · ' + descartados + ' descartados');
  log('validación de la regla: ' + DATA.validacion.declaradosDedicados + '/' + DATA.validacion.declarados + ' de los destinos declarados van dedicados, ' + DATA.validacion.declaradosIntercambio + ' con intercambio');
  if (PARADAS_TODO.length) log('sin movimiento pero paradas todo el período (ya descontadas): '
    + PARADAS_TODO.map(u => u.p).join(', '));
  if (OCIOSAS.length) log('! disponibles y sin un solo movimiento: '
    + OCIOSAS.map(u => u.p + ' (' + u.g + ', ' + u.semDisp + ' de ' + semanasHR.length + ' semanas disponible)').join(', '));
  else log('no hay unidades disponibles sin movimiento');
  if (CORREGIDAS.size) log('patentes corregidas: ' + CORREGIDAS.size);
  if (huecos.length) log('! ' + huecos.length + ' día(s) hábil(es) sin hoja de ruta en el rango');
};
