// Logística · disponibilidad de flota, necesidad de tambores, consumo de gasoil,
// costo por frigorífico, stock de hiel, matriz y métrica de costo, y el resumen
// del presupuesto. La cuenta de cada dato está en tools/fuentes.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');

const MES_AB = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// "Tractores" → "Tractor", "Bateas" → "Batea"
function singular(n) {
  const x = String(n).trim();
  if (/^bateas$/i.test(x)) return 'Batea';
  if (/^chasis$/i.test(x)) return 'Chasis';
  return x.replace(/es$/i, '').replace(/s$/i, '');
}

const MES_LG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// semana ISO de una fecha, y el lunes/domingo de una semana ISO
const isoSem = f => {
  const t = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
const rangoISO = (n, anio) => {
  const j4 = new Date(Date.UTC(anio, 0, 4));
  const lun1 = new Date(j4.getTime() - ((j4.getUTCDay() + 6) % 7) * 86400000);
  const lun = new Date(lun1.getTime() + (n - 1) * 7 * 86400000);
  const ene1 = new Date(Date.UTC(anio, 0, 1));
  return { lun: lun < ene1 ? ene1 : lun, dom: new Date(lun.getTime() + 6 * 86400000) };
};

exports.actualizar = async function ({ leer, escribir, log, util }) {
  const { num, txt } = util;
  const XLSX = require('xlsx');
  const hoy = new Date();
  const fl = d => d.getUTCDate() + ' ' + MES_AB[d.getUTCMonth()];
  const r1 = v => +(v.toFixed(1));
  const r2 = v => +(v.toFixed(2));

  /* ═════════════ necesidad de tambores ═════════════ */
  log('· Necesidad de tambores');
  {
    const wb = leer('NECESIDAD DE TAMBORES PARA OPERAR 2026.xlsx');
    const destino = 'client/src/dashboards/necesidad-tambores.html';
    const viejo = util.actual(destino, 'DATA');

    // 1) una hoja por semana, numerada "01".."35". Cada día es un bloque de
    //    cuatro columnas (ENV / REC / MARC / S.MARC) y el matadero va en la B.
    const armarSemana = hoja => {
      const f = wb.filas(hoja);
      const fEnc = f.findIndex(r => r && r.some(v => /^ENV\.?$/i.test(String(v == null ? '' : v).trim())));
      if (fEnc < 0) return null;
      const cols = [];
      (f[fEnc] || []).forEach((v, j) => { if (/^ENV\.?$/i.test(String(v == null ? '' : v).trim())) cols.push(j); });
      const frigos = [];
      for (let i = fEnc + 1; i < f.length; i++) {
        const r = f[i]; if (!r) continue;
        const n = txt(r[1]); if (!n || /^total/i.test(n)) continue;
        let env = 0, rec = 0;
        cols.forEach(j => { env += num(r[j]) || 0; rec += num(r[j + 1]) || 0; });
        // el que no movió nada esa semana no entra
        if (!env && !rec) continue;
        frigos.push({ f: n, env, rec, dif: rec - env });
      }
      const suma = k => frigos.reduce((a, x) => a + x[k], 0);
      return { wk: hoja, num: +hoja, frigos, totEnv: suma('env'), totRec: suma('rec'), totDif: suma('dif') };
    };
    const hojas = wb.hojas.filter(h => /^\d{1,2}$/.test(h.trim())).sort((a, b) => +a - +b);
    const weeks = hojas.map(armarSemana).filter(w => w && w.frigos.length);

    if (viejo) {
      const dif = viejo.weeks.filter(v => {
        const n = weeks.find(x => x.wk === v.wk);
        return !n || JSON.stringify(v.frigos) !== JSON.stringify(n.frigos);
      });
      log('   ' + (dif.length ? '~ cambiaron en la planilla ' + dif.length + ' semana(s): S' + dif.map(d => d.wk).join(', S')
        : '✓ las ' + viejo.weeks.length + ' semanas ya cargadas dan igual'));
      log('   ' + viejo.weeks.length + ' → ' + weeks.length + ' semanas · última S' + weeks[weeks.length - 1].wk);
    }

    // 2) stock por frigorífico: hoja Consolidado, columna "Stock en Frigorifico"
    const con = wb.filas('Consolidado');
    const fEnc = con.findIndex(r => r && r.some(v => /stock en frigorif/i.test(String(v == null ? '' : v))));
    if (fEnc < 0) throw new Error('Consolidado: no encuentro la columna "Stock en Frigorifico"');
    const colStock = (con[fEnc] || []).findIndex(v => /stock en frigorif/i.test(String(v == null ? '' : v)));
    const limpio = n => n.replace(/\s*\([^)]*\)\s*/g, '').replace(/\s+/g, ' ').trim();
    const lugarDe = {};
    const stock = [];
    for (let i = fEnc + 1; i < con.length; i++) {
      const r = con[i]; if (!r) continue;
      const n = txt(r[1]); if (!n) continue;
      const lugar = txt(r[2]) || '';
      lugarDe[limpio(n).toUpperCase()] = lugar;
      const v = num(r[colStock]);
      if (v == null) continue;
      stock.push({ f: limpio(n), stock: v, lugar });
    }

    // 3) a debitar: el primer bloque de RECLAMO DEUDA, de mayor a menor
    const rec = wb.filas('RECLAMO DEUDA');
    const fCab = rec.findIndex(r => r && /frigorifico/i.test(String(r[0] || '')) && /debitar/i.test(String(r[1] || '')));
    if (fCab < 0) throw new Error('RECLAMO DEUDA: no encuentro el encabezado');
    const debito = [];
    let totalHoja = null;
    for (let i = fCab + 1; i < rec.length; i++) {
      const r = rec[i]; if (!r) continue;
      const n = txt(r[0]), v = num(r[1]);
      if (!n) { if (v != null && /total/i.test(String(r[2] || ''))) { totalHoja = v; break; } continue; }
      if (v == null) continue;
      debito.push({ f: limpio(n), debito: v, lugar: lugarDe[limpio(n).toUpperCase()] || '' });
    }
    debito.sort((a, b) => b.debito - a.debito);
    const sumaDeb = debito.reduce((a, x) => a + x.debito, 0);
    if (totalHoja != null && totalHoja !== sumaDeb)
      log('   ! RECLAMO DEUDA: la hoja totaliza ' + totalHoja + ' y los ítems suman ' + sumaDeb);

    const deudaTotal = stock.reduce((a, x) => a + x.stock, 0);
    if (viejo) {
      if (viejo.deudaTotal !== deudaTotal) log('   tambores en frigoríficos: ' + viejo.deudaTotal.toLocaleString('es-AR') + ' → ' + deudaTotal.toLocaleString('es-AR'));
      if (viejo.debito.length !== debito.length || JSON.stringify(viejo.debito) !== JSON.stringify(debito))
        log('   a debitar: ' + viejo.debito.reduce((a, x) => a + x.debito, 0) + ' → ' + sumaDeb + ' tambores en ' + debito.length + ' frigoríficos');
    }
    escribir(destino, 'DATA', { deudaTotal, stock, debito, weeks });

    /* --- 4) el consolidado: la matriz de frigorífico × semana --- */
    // Cada celda es la diferencia de esa semana (recibidos − enviados). La hoja
    // la trae calculada; acá se rehace desde las hojas semanales y se controla
    // contra la hoja, que puede haber quedado de una corrida anterior.
    {
      const encC = con[fEnc] || [];
      const colsSem = [];
      encC.forEach((v, j) => {
        const m = String(v == null ? '' : v).trim().match(/^s\.?\s*(\d+)$/i);
        if (m) colsSem.push({ j, sem: +m[1] });
      });
      const colDe = re => encC.findIndex(v => re.test(String(v == null ? '' : v).replace(/\s+/g, ' ').trim()));
      const cAnt = colDe(/^Año\s*\d{4}$/i);                      // arrastre del año anterior
      const cSaldo = colDe(/^saldo$/i);
      const cAct = encC.reduce((a, v, j) => /^Año\s*\d{4}$/i.test(String(v == null ? '' : v).trim()) ? j : a, -1);
      const colsDeb = []; encC.forEach((v, j) => { if (/^debito$/i.test(String(v == null ? '' : v).trim())) colsDeb.push(j); });

      // Los cortes del consolidado. Si cambian, se tocan acá y en fuentes.json.
      const TRAMOS = { cierre1: 20, segDesde: 21, segHasta: 32, arqueo: 33, actDesde: 34 };
      const porSem = {}; weeks.forEach(w => { porSem[+w.wk] = w; });
      const clave = n => limpio(n).toUpperCase();
      let iguales = 0, distintas = 0;
      const filasC = [];
      for (let i = fEnc + 1; i < con.length; i++) {
        const r = con[i]; if (!r) continue;
        const nom = txt(r[1]); if (!nom) continue;
        const n = limpio(nom);
        const celdas = colsSem.map(c => {
          const hoja = num(r[c.j]);
          const w = porSem[c.sem];
          const f = w && w.frigos.find(x => clave(x.f) === clave(n));
          const calc = f ? f.dif : null;
          if (hoja != null && calc != null) { if (hoja === calc) iguales++; else distintas++; }
          return {
            sem: c.sem, v: calc != null ? calc : hoja,
            env: f ? f.env : null, rec: f ? f.rec : null,
            hoja, difHoja: (hoja != null && calc != null && hoja !== calc) ? hoja : null,
          };
        });
        const sumaEntre = (a, b) => celdas.reduce((t, c) => (c.sem >= a && c.sem <= b && c.v != null) ? t + c.v : t, 0);
        const conDato = (a, b) => celdas.filter(c => c.sem >= a && c.sem <= b && c.v != null).length;
        const stockFrig = num(r[colStock]);
        const anio = cAct >= 0 && cAct !== cAnt ? num(r[cAct]) : null;
        filasC.push({
          f: n, nombreHoja: nom, lugar: txt(r[2]) || '',
          anterior: cAnt >= 0 ? num(r[cAnt]) : null,
          debitos: colsDeb.map((j, k) => ({ n: k + 1, v: num(r[j]) })).filter(x => x.v != null),
          // tramo 1: hasta el primer débito, la cuenta se cerró en cero
          cerrado1: { hasta: TRAMOS.cierre1, suma: sumaEntre(1, TRAMOS.cierre1), semanas: conDato(1, TRAMOS.cierre1),
            debito: (num(r[colsDeb[0]]) != null ? num(r[colsDeb[0]]) : null) },
          // tramo 2: seguimiento, es la columna saldo
          saldo: cSaldo >= 0 ? num(r[cSaldo]) : null,
          saldoCalc: sumaEntre(TRAMOS.segDesde, TRAMOS.segHasta),
          semanasSeg: conDato(TRAMOS.segDesde, TRAMOS.segHasta),
          // tramo 3: el arqueo, que no se cuenta
          arqueo: { sem: TRAMOS.arqueo, v: (celdas.find(c => c.sem === TRAMOS.arqueo) || {}).v,
            debito: (colsDeb[1] != null && num(r[colsDeb[1]]) != null ? num(r[colsDeb[1]]) : null) },
          // tramo 4: de la semana siguiente al arqueo en adelante, es Año 2026
          anio, anioCalc: sumaEntre(TRAMOS.actDesde, 99), semanasAct: conDato(TRAMOS.actDesde, 99),
          stock: stockFrig,
          // lo que el frigorífico tiene más lo que quedó a favor o en contra
          stockFinal: (stockFrig == null && anio == null) ? null : (stockFrig || 0) + (anio || 0),
          celdas,
        });
      }
      const malSaldo = filasC.filter(x => x.saldo != null && x.saldo !== x.saldoCalc).length;
      const malAnio = filasC.filter(x => x.anio != null && x.anio !== x.anioCalc).length;
      log('   consolidado: ' + filasC.length + ' frigoríficos × ' + colsSem.length + ' semanas · ' +
        iguales + ' celdas dan igual que la hoja' + (distintas ? ' · ! ' + distintas + ' no' : ''));
      log('   saldo = suma S' + TRAMOS.segDesde + '–S' + TRAMOS.segHasta + ': ' +
        (malSaldo ? '! no cierra en ' + malSaldo : 'cierra en los ' + filasC.filter(x => x.saldo != null).length) +
        ' · Año en curso = suma S' + TRAMOS.actDesde + '+: ' +
        (malAnio ? '! no cierra en ' + malAnio : 'cierra en los ' + filasC.filter(x => x.anio != null).length));
      escribir('client/src/dashboards/consolidado-tambores.html', 'DATA', {
        generado: hoy.toISOString().slice(0, 10),
        semanas: colsSem.map(c => c.sem),
        tramos: TRAMOS,
        filas: filasC, iguales, distintas,
        deudaTotal, stock,
      });
    }
  }

  /* ═════════════ consumo de gasoil ═════════════ */
  log('· Consumo de gasoil');
  {
    const wb = leer('2026 Consumo de combustible.xlsx');
    const destino = 'client/src/dashboards/consumo-gasoil.html';
    const viejo = util.actual(destino, 'DATA');

    // litros por semana: la carga cruda de surtidor. "Maestro" es la patente de
    // mantenimiento/taller: se separa de los camiones.
    const g = wb.filas('GasOil 2026');
    const enc = (g[0] || []).map(v => String(v == null ? '' : v).trim().toLowerCase());
    const cSem = enc.indexOf('semana'), cVol = enc.indexOf('volumen'), cTipo = enc.indexOf('tipo unidad'), cAnio = enc.indexOf('año'), cFec = enc.indexOf('fecha/hora');
    if (cSem < 0 || cVol < 0 || cTipo < 0) throw new Error('GasOil 2026: faltan las columnas Semana / Volumen / Tipo Unidad');
    const anioBase = 2026;
    const acum = {};
    g.slice(1).forEach(r => {
      if (!r) return;
      const s = num(r[cSem]); if (s == null) return;
      if (cAnio >= 0 && num(r[cAnio]) != null && num(r[cAnio]) !== anioBase) return;
      const v = num(r[cVol]) || 0;
      const a = acum[s] = acum[s] || { tot: 0, mant: 0 };
      a.tot += v;
      if (/^maestro$/i.test(String(r[cTipo] || '').trim())) a.mant += v;
    });
    // kilómetros: la tabla dinámica "KM  X  KPI", Nº SEM → distancia recorrida
    const km = {};
    wb.filas('KM  X  KPI').forEach(r => { if (r && num(r[0]) != null && num(r[1]) != null) km[r[0]] = r[1]; });

    const semanas = Object.keys(acum).map(Number).sort((a, b) => a - b).map(s => {
      const a = acum[s], k = km[s] || 0, cam = r2(a.tot - a.mant);
      const w = rangoISO(s, anioBase);
      return {
        sem: 'SEM ' + s, semN: s, desde: fl(w.lun), hasta: fl(w.dom),
        consCam: cam, consMant: r2(a.mant), consTot: r2(a.tot),
        km: r2(k), lt100: k ? r2(cam / k * 100) : 0,
      };
    });
    if (viejo) {
      const dif = viejo.semanas.filter(v => JSON.stringify(v) !== JSON.stringify(semanas.find(x => x.semN === v.semN)));
      log('   ' + (dif.length ? '~ cambiaron en la planilla ' + dif.length + ' semana(s): S' + dif.map(d => d.semN).join(', S')
        : '✓ las ' + viejo.semanas.length + ' semanas ya cargadas dan igual'));
      log('   ' + viejo.semanas.length + ' → ' + semanas.length + ' semanas · última S' + semanas[semanas.length - 1].semN);
    }
    escribir(destino, 'DATA', { semanas, ultima: semanas[semanas.length - 1].semN });
  }

  /* ═════════════ costo por frigorífico ═════════════ */
  log('· Costo por frigorífico');
  {
    const wb = leer('2026 Consumo de combustible.xlsx');
    const destino = 'client/src/dashboards/costo-frigorifico.html';
    const viejo = util.actual(destino, 'DATA');
    const f = wb.filas('Costo Frigo');
    // la hoja tiene UNA sola semana por vez: el número está arriba de todo
    const sem = (() => {
      for (let i = 0; i < 6; i++) { const v = num((f[i] || [])[1]); if (v != null) return v; }
      return null;
    })();
    if (sem == null) throw new Error('Costo Frigo: no encuentro el número de semana');
    const fEnc = f.findIndex(r => r && /proveedor/i.test(String(r[0] || '')));
    if (fEnc < 0) throw new Error('Costo Frigo: no encuentro el encabezado');
    // las horas son horas de Excel: hay que leerlas crudas para pasarlas a h:mm
    const raw = XLSX.utils.sheet_to_json(
      XLSX.readFile(wb.ruta, { cellDates: false }).Sheets['Costo Frigo'],
      { header: 1, raw: true, defval: null, blankrows: true });
    const hm = v => {
      if (typeof v !== 'number') return '';
      const t = Math.round(v * 24 * 60);
      return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    };
    const hms = v => {
      if (typeof v !== 'number') return '';
      const t = Math.round(v * 24 * 3600);
      return Math.floor(t / 3600) + ':' + String(Math.floor(t % 3600 / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    };
    const frigos = [];
    for (let i = fEnc + 1; i < f.length; i++) {
      const r = f[i], rr = raw[i] || []; if (!r) continue;
      const prov = txt(r[0]); if (!prov || /^total/i.test(prov)) continue;
      const kgs = num(r[9]) || 0, valorViajes = num(r[10]) || 0;
      frigos.push({
        prov, kms: num(r[1]) || 0, hsRec: hm(rr[3]), excedTotal: hms(rr[5]),
        valorPorViaje: Math.round(num(r[7]) || 0), viajes: num(r[8]) || 0,
        kgs: Math.round(kgs), valorViajes: Math.round(valorViajes),
        xkg: kgs ? r2(valorViajes / kgs) : 0,
      });
    }
    const suma = k => frigos.reduce((a, x) => a + (x[k] || 0), 0);
    const total = { kms: null, hsRec: '', excedTotal: '', valorPorViaje: null, viajes: suma('viajes'), kgs: suma('kgs'), valorViajes: suma('valorViajes'), xkg: suma('kgs') ? r2(suma('valorViajes') / suma('kgs')) : 0 };
    const weeks = (viejo ? viejo.weeks.filter(w => w.semana !== sem) : []).concat([{ semana: sem, frigos, total }])
      .sort((a, b) => a.semana - b.semana);
    if (viejo) {
      const habia = viejo.weeks.some(w => w.semana === sem);
      log('   ' + (habia ? '~ se rehizo la S' + sem : '+ se sumó la S' + sem) + ' · ' + frigos.length + ' proveedores · ' +
        suma('kgs').toLocaleString('es-AR') + ' kg');
      log('   ' + viejo.weeks.length + ' → ' + weeks.length + ' semanas · la hoja guarda una sola semana por vez');
    }
    escribir(destino, 'DATA', { weeks, ultima: weeks[weeks.length - 1].semana });
  }

  /* ═════════════ disponibilidad de flota ═════════════ */
  log('· Disponibilidad de flota');
  {
    const wb = leer('Indicador disponibilidad de flota 2026.xlsx');
    const destino = 'client/src/dashboards/disponibilidad-flota.html';
    const viejo = util.actual(destino, 'DATA');

    // padrón: bloques separados por filas en blanco. El último bloque útil es el
    // de las unidades fuera de servicio; el de "vender" no cuenta.
    const d = wb.filas('Disponibilidad de flota');
    const fEnc = d.findIndex(r => r && /^dominio$/i.test(String(r[1] || '').trim()));
    if (fEnc < 0) throw new Error('Disponibilidad de flota: no encuentro el encabezado Dominio');
    // La tabla de arriba del padrón dice cuántas unidades hay de cada tipo:
    // "Tractores (17)", "Toritos (5)"… Los bloques del padrón vienen en ese
    // mismo orden, y de ahí sale el tipo de cada unidad.
    const tipos = [];
    for (let i = 0; i < fEnc; i++) {
      const r = d[i] || [];
      const m = String(txt(r[1]) || '').match(/^(.+?)\s*\((\d+)\)\s*$/);
      if (m && num(r[5]) != null) tipos.push({ nombre: singular(m[1]), n: +m[2] });
    }
    const bloques = []; let act = null;
    for (let i = fEnc + 1; i < d.length; i++) {
      const r = d[i] || [];
      const dom = txt(r[1]);
      if (!dom) { if (act && act.length) { bloques.push(act); act = null; } continue; }
      if (/^dominio|^domio/i.test(dom)) break;      // empieza otra tabla más abajo
      act = act || [];
      // la columna "Tipo Unidad" en realidad trae una observación cuando no es
      // ni tractor ni batea: se guarda como obs y el tipo sale del bloque
      act.push({ dom, modelo: txt(r[2]) || '', marca: txt(r[3]) || '', tipo: '',
        obs: txt(r[4]) || '', asig: r[5] == null ? '' : String(r[5]).trim() });
    }
    if (act && act.length) bloques.push(act);
    // a cada bloque se le pone el tipo cuyo total coincide con su tamaño
    const libres = tipos.slice();
    bloques.forEach(b => {
      const k = libres.findIndex(t => t.n === b.length);
      if (k < 0) return;
      const t = libres.splice(k, 1)[0];
      b.forEach(u => { u.tipo = t.nombre; });
    });
    // en la columna "Tipo Unidad" a veces escribieron el tipo y no una
    // observación: en ese caso no aporta nada y se descarta
    const nombresTipo = tipos.map(t => t.nombre.toLowerCase());
    [].concat.apply([], bloques).forEach(u => {
      const o = (u.obs || '').toLowerCase().replace(/es$/, '').replace(/s$/, '');
      if (!u.obs || nombresTipo.indexOf(o) >= 0 || o === u.tipo.toLowerCase()) u.obs = '';
    });
    const utiles = bloques.filter(b => !b.every(u => /vender/i.test(u.modelo)));
    if (utiles.length < 2) throw new Error('Disponibilidad de flota: no distingo el bloque de fuera de servicio');
    const fueraServicio = utiles[utiles.length - 1];
    const disponibles = [].concat(...utiles.slice(0, -1));
    const total = disponibles.length;

    // detalle semanal: BASE DE DATOS, una fila por unidad y día fuera de servicio
    const b = wb.filas('BASE DE DATOS');
    const fB = b.findIndex(r => r && /^fecha$/i.test(String(r[0] || '').trim()));
    if (fB < 0) throw new Error('BASE DE DATOS: no encuentro el encabezado FECHA');
    const porSem = {};
    for (let i = fB + 1; i < b.length; i++) {
      const r = b[i]; if (!r || !(r[0] instanceof Date)) continue;
      const dom = txt(r[1]); if (!dom) continue;
      const w = isoSem(r[0]);
      const a = porSem[w] = porSem[w] || { min: r[0], max: r[0], u: {} };
      if (r[0] < a.min) a.min = r[0]; if (r[0] > a.max) a.max = r[0];
      const u = a.u[dom] = a.u[dom] || { dom, tipo: txt(r[2]) || '', obs: txt(r[3]) || '', destino: txt(r[4]) || '', dias: 0 };
      u.dias++;                        // una fila = un día parado
    }
    const weeks = Object.keys(porSem).map(Number).sort((a, b) => a - b).map(w => {
      const a = porSem[w];
      const unidades = Object.values(a.u).sort((x, y) => x.dom.localeCompare(y.dom, 'es'));
      const paradas = unidades.length, disp = total - paradas;
      return {
        week: w, label: 'Sem ' + w, desde: fl(a.min), hasta: fl(a.max),
        total, paradas, disponibles: disp, dispPct: r1(disp / total * 100), unidades,
      };
    });
    if (viejo) {
      if (viejo.total !== total) log('   el padrón pasó de ' + viejo.total + ' a ' + total + ' unidades disponibles');
      if (viejo.fueraServicio.length !== fueraServicio.length) log('   dados de baja: ' + viejo.fueraServicio.length + ' → ' + fueraServicio.length);
      const tiposHallados = [...new Set(disponibles.map(u => u.tipo).filter(Boolean))];
      const faltan = disponibles.filter(u => !u.tipo).length;
      log('   tipos de unidad: ' + tiposHallados.map(t => t + ' ' + disponibles.filter(u => u.tipo === t).length).join(' · ') +
        (faltan ? ' · ! ' + faltan + ' sin tipo' : ''));
      const dif = viejo.weeks.filter(v => JSON.stringify(v) !== JSON.stringify(weeks.find(x => x.week === v.week)));
      log('   ' + (dif.length ? '~ cambiaron en la planilla ' + dif.length + ' semana(s): S' + dif.map(x => x.week).join(', S')
        : '✓ las ' + viejo.weeks.length + ' semanas ya cargadas dan igual'));
      log('   ' + viejo.weeks.length + ' → ' + weeks.length + ' semanas · última S' + weeks[weeks.length - 1].week +
        ' (hasta el ' + weeks[weeks.length - 1].hasta + ')');
    }
    escribir(destino, 'DATA', { total, disponibles, fueraServicio, weeks });
  }

  /* ═════════════ stock de hiel ═════════════ */
  log('· Stock de hiel');
  {
    // el nombre lleva el mes adentro: se toma el más nuevo de la carpeta
    const carpeta = path.dirname(leer('2026 Consumo de combustible.xlsx').ruta);
    const cand = fs.readdirSync(carpeta)
      .filter(f => /^STOCK HIEL .+\.xlsx$/i.test(f))
      .map(f => ({ f, t: fs.statSync(path.join(carpeta, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!cand.length) throw new Error('no encuentro ningún "STOCK HIEL <mes> 2026.xlsx" en ' + carpeta);
    const wb = leer(cand[0].f.replace(/\s*\(\d+\)\.xlsx$/i, '.xlsx'));
    const destino = 'client/src/dashboards/stock-hiel.html';
    const viejo = util.actual(destino, 'DATA');
    const clave = d => d.toISOString().slice(0, 10);

    // ingresos: una fila por bin recibido (hoja ING-MOV)
    const im = wb.filas('ING-MOV');
    const fIng = im.findIndex(r => r && /fecha carga de datos/i.test(String(r[2] || '')));
    if (fIng < 0) throw new Error('ING-MOV: no encuentro el encabezado');
    const ing = {};
    for (let i = fIng + 1; i < im.length; i++) {
      const r = im[i]; if (!r || !(r[2] instanceof Date)) continue;
      const a = ing[clave(r[2])] = ing[clave(r[2])] || { h: 0, ad: 0 };
      a.h += num(r[9]) || 0;          // J = HIEL
      a.ad += num(r[11]) || 0;        // L = ADITIVO
    }
    // salidas: una fila por bin despachado (hoja SALIDAS)
    const sa = wb.filas('SALIDAS');
    const fSal = sa.findIndex(r => r && /^bins$/i.test(String(r[0] || '').trim()));
    if (fSal < 0) throw new Error('SALIDAS: no encuentro el encabezado BINS');
    const sal = {};
    for (let i = fSal + 1; i < sa.length; i++) {
      const r = sa[i]; if (!r || !(r[1] instanceof Date)) continue;
      const a = sal[clave(r[1])] = sal[clave(r[1])] || { s: 0 };
      a.s += num(r[4]) || 0;          // E = SALIDAS
    }

    // El despacho en sí está en la hoja STOCK, en el bloque de la derecha: ahí
    // van la pesada de balanza, el número de ticket y el remito, cargados una
    // sola vez por despacho (en la fila del primer bin que sale). La hoja
    // SALIDAS no los tiene: termina en la columna I, que es el subtotal del día.
    const st = wb.filas('STOCK');
    const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toUpperCase();
    const fSt = st.findIndex(r => r && r.some(v => norm(v) === 'PESADA'));
    if (fSt < 0) throw new Error('STOCK: no encuentro el encabezado con PESADA');
    // Ojo: la fila de encabezado trae los mismos títulos dos veces. Primero el
    // detalle (una fila por bin despachado) y más a la derecha un resumen por
    // día que se carga a mano. Nos quedamos con el primero, que es el original.
    const COLS_ST = { FECHA: 'fecha', SALIDAS: 'sal', PESADA: 'pes', REMITO: 'remito' };
    const cSt = {}, cRes = {};
    st[fSt].forEach((v, j) => {
      const n = norm(v);
      const k = COLS_ST[n] || (/^N.? ?TICKET$/.test(n) ? 'ticket' : null);
      if (!k) return;
      if (cSt[k] == null) cSt[k] = j; else if (cRes[k] == null) cRes[k] = j;
    });
    ['fecha', 'sal', 'pes', 'ticket', 'remito'].forEach(k => {
      if (cSt[k] == null) throw new Error('STOCK: falta la columna ' + k + ' en el encabezado de despachos');
    });
    const desp = {};
    for (let i = fSt + 1; i < st.length; i++) {
      const r = st[i];
      if (!r || !(r[cSt.fecha] instanceof Date) || num(r[cSt.sal]) == null) continue;
      const a = desp[clave(r[cSt.fecha])] = desp[clave(r[cSt.fecha])] || { s: 0, pes: 0, ticket: '', remito: '' };
      a.s += num(r[cSt.sal]) || 0;
      a.pes += num(r[cSt.pes]) || 0;
      if (txt(r[cSt.ticket])) a.ticket = txt(r[cSt.ticket]);
      if (txt(r[cSt.remito])) a.remito = txt(r[cSt.remito]);
    }
    // las dos hojas tienen que contar las mismas salidas
    const desacuerdo = Object.keys(sal).filter(k => Math.abs((sal[k].s || 0) - ((desp[k] || {}).s || 0)) > 0.5);
    if (desacuerdo.length) log('   ! SALIDAS y STOCK no coinciden en ' + desacuerdo.join(', '));

    // El resumen por día de la derecha repite pesada, ticket y remito. Está
    // cargado a mano, así que puede diferir del detalle: mostramos el detalle y
    // avisamos de la diferencia en vez de elegir en silencio.
    if (cRes.fecha != null && cRes.pes != null) {
      const dif = [];
      for (let i = fSt + 1; i < st.length; i++) {
        const r = st[i]; if (!r || !(r[cRes.fecha] instanceof Date)) continue;
        const k = clave(r[cRes.fecha]), d0 = desp[k]; if (!d0) continue;
        const pr = num(r[cRes.pes]);
        if (pr != null && Math.abs(pr - d0.pes) > 0.5) dif.push(k.slice(5) + ' detalle ' + d0.pes + ' vs resumen ' + pr);
        const tr = txt(r[cRes.ticket]), rr = txt(r[cRes.remito]);
        if (tr && d0.ticket && tr !== d0.ticket) dif.push(k.slice(5) + ' ticket ' + d0.ticket + ' vs ' + tr);
        if (rr && d0.remito && rr !== d0.remito) dif.push(k.slice(5) + ' remito ' + d0.remito + ' vs ' + rr);
      }
      if (dif.length) log('   ! el resumen de la hoja no coincide con el detalle: ' + dif.join(' · '));
    }

    // el mes del tablero es el de la mayoría de los movimientos
    const cuenta = {};
    Object.keys(ing).concat(Object.keys(sal)).forEach(k => { const m = +k.slice(5, 7); cuenta[m] = (cuenta[m] || 0) + 1; });
    const mes = +Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
    const anio = +Object.keys(ing).concat(Object.keys(sal)).sort()[0].slice(0, 4);

    // el detalle arranca el último día del mes anterior (el sobrante) y llega
    // hasta el fin de mes
    const desde = new Date(Date.UTC(anio, mes - 1, 0));
    const hasta = new Date(Date.UTC(anio, mes, 0));
    const rows = []; let saldo = 0;
    for (let d = new Date(desde); d <= hasta; d = new Date(d.getTime() + 86400000)) {
      const k = clave(d), i = ing[k] || { h: 0, ad: 0 }, o = sal[k] || { s: 0 };
      const p = desp[k] || { pes: 0, ticket: '', remito: '' };
      saldo += i.h + i.ad - o.s;
      rows.push({
        fecha: k, fl: fl(d), semana: isoSem(d), dow: d.getUTCDay(),
        ingreso: r1(i.h), aditivo: r1(i.ad), salidas: r1(o.s), pesada: r1(p.pes),
        ticket: p.ticket || '', remito: p.remito || '', saldo,
      });
    }
    const delMes = rows.filter(r => +r.fecha.slice(5, 7) === mes);
    const totIng = Math.round(delMes.reduce((a, r) => a + r.ingreso + r.aditivo, 0));
    const totSal = Math.round(delMes.reduce((a, r) => a + r.salidas, 0));
    const conMov = rows.filter(r => r.ingreso || r.aditivo || r.salidas);
    const ultimo = conMov[conMov.length - 1];
    const salidasMes = delMes.filter(r => r.salidas > 0);

    if (viejo) {
      log('   mes ' + MES_LG[mes - 1] + ' · último movimiento el ' + ultimo.fl +
        (viejo.ultimo && viejo.ultimo.fl !== ultimo.fl ? ' (antes ' + viejo.ultimo.fl + ')' : ''));
      log('   ingresos ' + viejo.totIng.toLocaleString('es-AR') + ' → ' + totIng.toLocaleString('es-AR') +
        ' · salidas ' + viejo.totSal.toLocaleString('es-AR') + ' → ' + totSal.toLocaleString('es-AR') +
        ' · saldo ' + Math.round(ultimo.saldo).toLocaleString('es-AR'));
    }
    escribir(destino, 'DATA', { ultimo, mes, totIng, totSal, rows, salidasMes });
  }

  /* ═════════════ matriz y métrica de costo ═════════════ */
  log('· Matriz y métrica de costo');
  {
    const wb = leer('2026 Consumo de combustible.xlsx');
    // Las filas de "Gastos" están rotuladas y van de la columna B (enero) a la M
    // (diciembre). Varias son fórmulas que hoy dan #REF! porque dependen de una
    // tabla dinámica rota: esas se rehacen con la misma cuenta de la planilla.
    const ws = XLSX.readFile(wb.ruta, { cellDates: true }).Sheets['Gastos'];
    const F = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const fEnc = F.findIndex(r => r && /^items$/i.test(String(r[0] || '').trim()));
    if (fEnc < 0) throw new Error('Gastos: no encuentro la fila ITEMS');
    const fDolar = (() => { for (let i = fEnc - 1; i >= 0; i--) if (num((F[i] || [])[1]) != null) return i; return -1; })();
    const doce = i => Array.from({ length: 12 }, (_, k) => (i < 0 ? null : num((F[i] || [])[k + 1])));
    const rotulo = re => F.findIndex((r, i) => i > fEnc && r && re.test(String(r[0] || '')));
    const bajo = (desde, re) => F.findIndex((r, i) => i > desde && r && re.test(String(r[0] || '')));

    const fProp = rotulo(/^TOTAL DEL MES PROPIO/i);
    const fFlet = rotulo(/^TOTAL DEL MES FLETES/i);
    const fLav = rotulo(/^TOTAL DEL MES LAVADO/i);
    const iProp = rotulo(/^DESCARGA PROPIOS/i);

    const dolar = doce(fDolar);
    const logTotal = doce(rotulo(/^TOTAL DEL MES LOGIST/i));
    const lavTotal = doce(fLav);
    const tallTotal = doce(rotulo(/^TOTAL DEL MES TALLER/i));
    const genTotal = doce(rotulo(/^TOTAL DEL MES- COSTO/i));
    const genSinFlet = doce(rotulo(/^TOTAL DEL MES - FLET/i));

    // Kilos netos descargados: la fila de la planilla es una tabla dinámica rota
    // (#REF!), así que se rehacen sumando la hoja ResumenKgs por mes.
    const kg = new Array(12).fill(0);
    wb.filas('ResumenKgs').forEach(r => { if (r && r[0] instanceof Date) kg[r[0].getUTCMonth()] += num(r[4]) || 0; });
    const fNeta = rotulo(/^DESCARGA KG NETA/i);
    const netaHoja = doce(fNeta);
    let descNeta = netaHoja, rehecha = false;
    if (netaHoja.every(v => v == null)) { descNeta = kg.map(v => v ? Math.round(v) : null); rehecha = true; }

    // las derivadas, con la misma cuenta que tienen las fórmulas de la hoja
    // un mes en cero es un mes que todavía no se cargó: no genera ratio
    const porKg = a => a.map((v, i) => !v || !descNeta[i] ? null : r2(v / descNeta[i]));
    const usdTon = a => a.map((v, i) => !v || !descNeta[i] || !dolar[i] ? null : r2(v / descNeta[i] * 1000 / dolar[i]));
    const pesoTon = a => a.map((v, i) => !v || !descNeta[i] ? null : Math.round(v / (descNeta[i] / 1000)));

    const viejoD = util.actual('client/src/dashboards/matriz-costo-logistica.html', 'D_RAW') || {};
    const D = {
      dolar,
      indec: viejoD.indec || [],            // el índice INDEC no está en este libro
      descProd: doce(rotulo(/^DESCARGA PRODUCCION/i)),
      descNeta,
      descProp: doce(iProp),
      descFlet: doce(rotulo(/^DESCARGA FLETES/i)),
      propTotal: doce(fProp),
      propKg: doce(bajo(fProp, /^COSTO \$ X KGS/i)),
      propUsd: doce(bajo(fProp, /^COSTO USD X TONS/i)),
      fletTotal: doce(fFlet),
      fletKg: doce(bajo(fFlet, /^COSTO \$ X KGS/i)),
      fletUsd: doce(bajo(fFlet, /^COSTO USD X TONS/i)),
      logTotal,
      logKg: porKg(logTotal),
      logUsd: usdTon(logTotal),
      lavTotal,
      lavPor: doce(bajo(fLav, /^COSTO \$ X LAVADO$/i)),
      lavUsdLav: doce(bajo(fLav, /^COSTO \$ X LAVADO USD/i)),
      lavCant: doce(bajo(fLav, /^CANTIDAD DE LAVADOS/i)),
      lavUsdTon: usdTon(lavTotal),
      tallTotal,
      tallUsd: usdTon(tallTotal),
      genTotal,
      genSinFlet,
      usdSinFlet: usdTon(genSinFlet),
      usdTonDesc: usdTon(genTotal),
      pesoTonDesc: pesoTon(genTotal),
      pesoTonProd: doce(rotulo(/^TOTAL \$ X TONS PROD/i)),
      // Las filas «% Kgs Propios» y «% Kgs Fletes» de la hoja dividen por un
      // segundo bloque de descargas que no cierra consigo mismo: propios más
      // fletes no da la neta, y los dos porcentajes no suman 100 %. Se calculan
      // acá sobre el bloque principal, que es el que alimenta todo lo demás.
      pctPropiosHoja: doce(rotulo(/^% Kgs Poropios/i)),
      pctFletesHoja: doce(rotulo(/^% Kgs Fletes/i)),
      ajusteIndec: viejoD.ajusteIndec || [],
      pctIndec: viejoD.pctIndec || [],
    };
    // recortar cada serie a lo que tiene dato
    const RAW = {};
    Object.keys(D).forEach(k => {
      const a = D[k] || [];
      let u = -1; a.forEach((v, i) => { if (v != null) u = i; });
      RAW[k] = a.slice(0, u + 1);
    });
    // el porcentaje se calcula, no se lee
    RAW.pctPropios = RAW.descProp.map((v, i) => (v == null || !RAW.descNeta[i]) ? null : v / RAW.descNeta[i]);
    RAW.pctFletes = RAW.descFlet.map((v, i) => (v == null || !RAW.descNeta[i]) ? null : v / RAW.descNeta[i]);
    {
      const malos = [];
      RAW.pctPropios.forEach((v, i) => {
        const h = (RAW.pctPropiosHoja || [])[i];
        if (v != null && h != null && Math.abs(v - h) > 0.005) malos.push(MES_LG[i] + ' ' + r1(h * 100) + '% → ' + r1(v * 100) + '%');
      });
      if (malos.length) log('   % de kilos propios: la hoja divide por un bloque que no cierra · corregido en ' + malos.join(', '));
    }
    delete RAW.pctPropiosHoja; delete RAW.pctFletesHoja;
    const cur = RAW.genTotal.length - 1;

    // ajuste por INDEC: proyección del mes anterior y diferencia contra el real
    const idx = RAW.indec || [];
    RAW.ajusteIndec = RAW.pesoTonDesc.map((v, i) => i === 0 ? 0
      : (RAW.pesoTonDesc[i - 1] == null || idx[i] == null ? null : Math.round(RAW.pesoTonDesc[i - 1] * (1 + idx[i]))));
    RAW.pctIndec = RAW.pesoTonDesc.map((v, i) => i === 0 || v == null || !RAW.ajusteIndec[i] ? (i === 0 ? null : null)
      : Math.round((v - RAW.ajusteIndec[i]) / RAW.ajusteIndec[i] * 10000) / 10000);

    if (viejoD.genTotal) {
      const antes = viejoD.genTotal.length;
      const movidas = Object.keys(RAW).filter(k => (viejoD[k] || []).length &&
        JSON.stringify((viejoD[k] || []).slice(0, Math.min(antes, RAW[k].length))) !== JSON.stringify(RAW[k].slice(0, Math.min(antes, RAW[k].length))));
      log('   ' + (movidas.length ? '~ se movieron ' + movidas.length + ' serie(s): ' + movidas.slice(0, 6).join(', ') + (movidas.length > 6 ? '…' : '')
        : '✓ las series ya cargadas dan igual'));
      log('   ' + antes + ' → ' + RAW.genTotal.length + ' meses · último ' + MES_LG[cur] +
        (rehecha ? ' · kilos netos rehechos desde ResumenKgs (la fila de la hoja da #REF!)' : ''));
    }
    escribir('client/src/dashboards/matriz-costo-logistica.html', 'D_RAW', RAW);

    /* ---- métrica de costo: el $ por tonelada descargada contra el INDEC ---- */
    {
      const destino = 'client/src/dashboards/metrica-costo.html';
      const M = util.actual(destino, 'DATA');
      if (M) {
        // La métrica se mide en dólares: el $/ton se pasa a USD con el dólar del
        // mes y la comparación se hace sobre esa serie. El ajustado sigue siendo
        // el mes anterior por la inflación del INDEC, sólo que en USD.
        const serie = RAW.pesoTonDesc, usd = RAW.dolar;
        const ib = M.indecByMonth || {};
        const data = [];
        const r2 = v => Math.round(v * 100) / 100;
        for (let i = 1; i < serie.length; i++) {
          const real = serie[i], prev = serie[i - 1], ind = ib[i + 1];
          const dol = usd[i], dolPrev = usd[i - 1];
          if (real == null || prev == null || ind == null || !dol || !dolPrev) continue;
          const proy = Math.round(prev * (1 + ind));
          const realUsd = r2(real / dol), prevUsd = r2(prev / dolPrev);
          const proyUsd = r2(prevUsd * (1 + ind));
          data.push({
            mes: MES_LG[i], mNum: i + 1,
            real, prevReal: prev, proy, indec: ind, gapPct: r1((real - proy) / proy * 100),
            dolar: dol, dolarPrev: dolPrev, varDolar: r1((dol - dolPrev) / dolPrev * 100),
            realUsd, prevRealUsd: prevUsd, proyUsd, gapUsd: r1((realUsd - proyUsd) / proyUsd * 100),
          });
        }
        // Con qué explicar cada mes: el volumen movido, los días en que se
        // descargó, de qué está hecho el gasto, y qué hicieron los índices de
        // afuera. Con eso el tablero puede abrir la brecha en volumen y precio.
        const diasMes = m => new Date(Date.UTC(2026, m, 0)).getUTCDate();
        const opPorMes = (function () {
          // días distintos con al menos una descarga, de la hoja ResumenKgs
          const rk = wb.filas('ResumenKgs'), dias = {};
          for (let i = 1; i < rk.length; i++) {
            const r = rk[i]; if (!r || !(r[0] instanceof Date)) continue;
            const m = r[0].getUTCMonth();
            (dias[m] = dias[m] || {})[r[0].toISOString().slice(0, 10)] = 1;
          }
          const o = {}; Object.keys(dias).forEach(m => { o[m] = Object.keys(dias[m]).length; });
          return o;
        })();
        const gasoilPorMes = (function () {
          // nuestro precio por litro, ponderado por los litros de cada compra
          const g = wb.filas('PRECIO GASOIL'), o = {};
          for (let i = 1; i < g.length; i++) {
            const r = g[i]; if (!r || !(r[1] instanceof Date)) continue;
            const lt = num(r[5]), pr = num(r[9]);
            if (!lt || pr == null) continue;
            const m = r[1].getUTCMonth();
            const a = o[m] = o[m] || { lt: 0, imp: 0 };
            a.lt += lt; a.imp += lt * pr;
          }
          const p = {}; Object.keys(o).forEach(m => { p[m] = r1(o[m].imp / o[m].lt); });
          return p;
        })();
        const tarifaConstante = (function () {
          // variación de tarifa a ruta constante: sólo las rutas (transportista +
          // destino) que aparecen en los dos meses, ponderadas por sus viajes.
          // Es lo único comparable contra un índice: saca el cambio de mezcla.
          const kf = wb.filas('KG-FLETES-DESCRIMINADO 2026'), porMes = {};
          for (let i = 2; i < kf.length; i++) {
            const r = kf[i]; if (!r || !(r[1] instanceof Date)) continue;
            const tar = num(r[5]); if (tar == null) continue;
            const m = r[1].getUTCMonth(), k = txt(r[2]) + ' || ' + txt(r[3]);
            const a = porMes[m] = porMes[m] || {};
            const ru = a[k] = a[k] || { v: 0, t: 0 };
            ru.v++; ru.t += tar;
          }
          const o = {};
          Object.keys(porMes).forEach(m => {
            const A = porMes[m - 1], B = porMes[m]; if (!A) return;
            let peso = 0, acum = 0;
            Object.keys(B).forEach(k => {
              if (!A[k] || !A[k].t) return;
              acum += ((B[k].t / B[k].v) / (A[k].t / A[k].v)) * B[k].v; peso += B[k].v;
            });
            if (peso) o[m] = r1((acum / peso - 1) * 100) / 100;
          });
          return o;
        })();
        // los índices de afuera (FADEEAC, gasoil oficial) no salen de ningún Excel
        const EXT = (function () {
          try { return JSON.parse(fs.readFileSync(path.join(RAIZ, 'tools', 'indices-externos.json'), 'utf8')); }
          catch (e) { log('   (sin tools/indices-externos.json: la métrica va sin FADEEAC ni gasoil oficial)'); return null; }
        })();
        const ofByMes = {};
        if (EXT) (EXT.gasoilOficial.serie || []).forEach(x => {
          const p = String(x.mes).split('-'); if (p[0] === '2026') ofByMes[+p[1] - 1] = x.precio;
        });
        // ── viajes: de ResumenKgs, que es la fuente de viajes ──
        const viajesPorMes = (function () {
          const rk = wb.filas('ResumenKgs'), o = {};
          for (let i = 1; i < rk.length; i++) {
            const r = rk[i]; if (!r || !(r[0] instanceof Date)) continue;
            const m = r[0].getUTCMonth();
            const prop = /propio/i.test(String(r[7] || ''));
            const a = o[m] = o[m] || { prop: 0, flet: 0, kgProp: 0, kgFlet: 0 };
            a[prop ? 'prop' : 'flet']++;
            a[prop ? 'kgProp' : 'kgFlet'] += (num(r[4]) || 0);
          }
          return o;
        })();
        // ── valor del viaje: de KG-FLETES, y sólo para eso ──
        const valorViaje = (function () {
          const kf = wb.filas('KG-FLETES-DESCRIMINADO 2026'), o = {};
          for (let i = 2; i < kf.length; i++) {
            const r = kf[i]; if (!r || !(r[1] instanceof Date)) continue;
            const m = r[1].getUTCMonth(), a = o[m] = o[m] || { v: 0, t: 0 };
            a.v++; a.t += (num(r[5]) || 0);
          }
          const p = {}; Object.keys(o).forEach(m => { p[m] = { viajes: o[m].v, total: Math.round(o[m].t), medio: Math.round(o[m].t / o[m].v) }; });
          return p;
        })();
        // ── kilómetros y litros consumidos, para el variable de propios ──
        const kmLt = (function () {
          const g = util.actual('client/src/dashboards/consumo-gasoil.html', 'DATA');
          const o = {};
          if (!g || !g.semanas) return o;
          g.semanas.forEach(w => {
            const ab = String(w.desde || '').split(' ')[1];
            const m = MES_AB.indexOf(ab); if (m < 0) return;
            const a = o[m] = o[m] || { km: 0, lt: 0 };
            a.km += (w.km || 0); a.lt += (w.consCam || 0);
          });
          return o;
        })();
        // ── el desfasaje de facturación ──
        // Cada archivo mensual de Presupuesto trae el detalle de facturas de
        // fletes. Si la glosa nombra un mes distinto al del archivo, ese importe
        // está cargado fuera de su mes. Con eso se puede pasar a devengado.
        const desfase = (function () {
          const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
          const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
          const o = {};
          for (let m = 0; m < 12; m++) {
            let w;
            try { w = leer('GERENCIA DE OPERACIONES ' + String(m + 1).padStart(2, '0') + '2026.xlsx'); }
            catch (e) { continue; }
            const hoja = w.hojas.find(x => /flete/i.test(x));
            if (!hoja) { o[m] = { hayDetalle: false }; continue; }
            const d = w.filas(hoja);
            const fh = d.findIndex(r => r && r.some(v => norm(v) === 'código centro costo'));
            if (fh < 0) { o[m] = { hayDetalle: false }; continue; }
            const col = re => d[fh].findIndex(v => re.test(norm(v)));
            const cImp = col(/^neto item moneda pesos$/), cGl = col(/^descripc[oó]n material$/),
              cPr = col(/^proveedor$/), cCe = col(/^código centro costo$/);
            if (cImp < 0) { o[m] = { hayDetalle: false }; continue; }
            const a = o[m] = { hayDetalle: true, total: 0, deOtros: 0, porMes: {}, detalle: [] };
            for (let i = fh + 1; i < d.length; i++) {
              const r = d[i]; if (!r || typeof r[cImp] !== 'number') continue;
              if (cCe >= 0 && txt(r[cCe]) && !/^log$/i.test(txt(r[cCe]))) continue;   // sólo logística
              const imp = -r[cImp];
              a.total += imp;
              const gl = String(cGl >= 0 ? (r[cGl] || '') : '').trim();
              const k = MESES.findIndex(y => gl.toUpperCase().indexOf(y) >= 0);
              if (k >= 0 && k !== m) {
                a.deOtros += imp;
                a.porMes[k] = (a.porMes[k] || 0) + imp;
                a.detalle.push({ mes: k, imp: Math.round(imp), prov: String(cPr >= 0 ? (r[cPr] || '') : '').trim(), glosa: gl });
              }
            }
            a.total = Math.round(a.total); a.deOtros = Math.round(a.deOtros);
            Object.keys(a.porMes).forEach(k => { a.porMes[k] = Math.round(a.porMes[k]); });
          }
          return o;
        })();
        // lo que sale de un mes: lo suyo que quedó cargado en otro
        const saleDe = {};
        Object.keys(desfase).forEach(m => {
          const a = desfase[m]; if (!a.hayDetalle) return;
          Object.keys(a.porMes).forEach(k => { saleDe[k] = (saleDe[k] || 0) + a.porMes[k]; });
        });
        // Un mes se puede corregir del todo si tiene su propio detalle; si no lo
        // tiene, lo único que se sabe es lo suyo que apareció cargado en otro mes.
        // Eso alcanza para una corrección parcial, que hay que mostrar como tal.
        const ajusteMes = m => {
          const a = desfase[m];
          const entra = (a && a.hayDetalle) ? (a.deOtros || 0) : 0;
          const sale = saleDe[m] || 0;
          if (!a || !a.hayDetalle) return sale ? { v: sale, parcial: true } : null;
          return { v: -entra + sale, parcial: false };
        };
        const nDesf = Object.keys(desfase).filter(m => desfase[m].hayDetalle).length;
        log('   facturas de fletes: detalle en ' + nDesf + ' mes(es) · corridas de mes ' +
          Object.keys(desfase).filter(m => desfase[m].deOtros).map(m => MES_LG[m] + ' ' + Math.round(desfase[m].deOtros / 1e6) + 'M').join(', '));

        data.forEach((d, k) => {
          const i = d.mNum - 1, j = i - 1;
          const ton = RAW.genTotal[i] / RAW.pesoTonDesc[i], tonPrev = RAW.genTotal[j] / RAW.pesoTonDesc[j];
          d.ton = Math.round(ton); d.tonPrev = Math.round(tonPrev);
          d.costo = Math.round(RAW.genTotal[i]); d.costoPrev = Math.round(RAW.genTotal[j]);
          d.diasMes = diasMes(d.mNum); d.diasMesPrev = diasMes(d.mNum - 1);
          d.diasOp = opPorMes[i] || null; d.diasOpPrev = opPorMes[j] || null;
          d.comp = [
            { l: 'Propios', v: Math.round(RAW.propTotal[i]), p: Math.round(RAW.propTotal[j]) },
            { l: 'Fletes', v: Math.round(RAW.fletTotal[i]), p: Math.round(RAW.fletTotal[j]) },
            { l: 'Lavadero', v: Math.round(RAW.lavTotal[i]), p: Math.round(RAW.lavTotal[j]) },
            { l: 'Taller', v: Math.round(RAW.tallTotal[i]), p: Math.round(RAW.tallTotal[j]) },
          ];
          d.gasoil = gasoilPorMes[i] != null && gasoilPorMes[j] != null
            ? { precio: gasoilPorMes[i], prev: gasoilPorMes[j], varPct: r1((gasoilPorMes[i] / gasoilPorMes[j] - 1) * 100) } : null;
          d.gasoilOf = ofByMes[i] != null && ofByMes[j] != null
            ? { precio: ofByMes[i], prev: ofByMes[j], varPct: r1((ofByMes[i] / ofByMes[j] - 1) * 100) } : null;
          d.tarifaRuta = tarifaConstante[i] != null ? r1(tarifaConstante[i] * 100) : null;
          d.fadeeac = EXT ? {
            general: r1((EXT.fadeeac.variacionMensual.costoGeneral[i] || 0) * 100),
            combustible: r1((EXT.fadeeac.variacionMensual.combustible[i] || 0) * 100),
          } : null;

          // el volumen, abierto en viajes: propios y fleteros se analizan distinto
          const vj = viajesPorMes[i] || {}, vjP = viajesPorMes[j] || {};
          d.viajes = {
            prop: vj.prop || null, flet: vj.flet || null,
            propPrev: vjP.prop || null, fletPrev: vjP.flet || null,
            tonProp: vj.kgProp ? Math.round(vj.kgProp / 1000) : null,
            tonFlet: vj.kgFlet ? Math.round(vj.kgFlet / 1000) : null,
            tonPropPrev: vjP.kgProp ? Math.round(vjP.kgProp / 1000) : null,
            tonFletPrev: vjP.kgFlet ? Math.round(vjP.kgFlet / 1000) : null,
          };
          d.valorViaje = valorViaje[i] ? { medio: valorViaje[i].medio, total: valorViaje[i].total, viajes: valorViaje[i].viajes } : null;
          d.valorViajePrev = valorViaje[j] ? { medio: valorViaje[j].medio, total: valorViaje[j].total, viajes: valorViaje[j].viajes } : null;
          d.km = kmLt[i] ? Math.round(kmLt[i].km) : null; d.kmPrev = kmLt[j] ? Math.round(kmLt[j].km) : null;
          d.litros = kmLt[i] ? Math.round(kmLt[i].lt) : null; d.litrosPrev = kmLt[j] ? Math.round(kmLt[j].lt) : null;
          d.lavados = RAW.lavCant ? RAW.lavCant[i] : null; d.lavadosPrev = RAW.lavCant ? RAW.lavCant[j] : null;

          // el devengado: cada factura en el mes que le corresponde
          const ajO = ajusteMes(i), ajPrevO = ajusteMes(j);
          const aj = ajO ? ajO.v : null, ajPrev = ajPrevO ? ajPrevO.v : null;
          d.desfase = {
            hayDetalle: !!(desfase[i] && desfase[i].hayDetalle),
            hayDetallePrev: !!(desfase[j] && desfase[j].hayDetalle),
            deOtros: desfase[i] && desfase[i].hayDetalle ? desfase[i].deOtros : null,
            sale: saleDe[i] || 0,
            detalle: desfase[i] && desfase[i].hayDetalle ? desfase[i].detalle : [],
            ajuste: aj, ajustePrev: ajPrev,
            parcial: !!(ajO && ajO.parcial) || !!(ajPrevO && ajPrevO.parcial),
            mesSinDetalle: [(desfase[i] && desfase[i].hayDetalle) ? null : MES_LG[i],
              (desfase[j] && desfase[j].hayDetalle) ? null : MES_LG[j]].filter(Boolean),
          };
          if (aj != null && ajPrev != null) {
            const cDev = d.costo + aj, cDevPrev = d.costoPrev + ajPrev;
            const uDev = cDev / d.ton / d.dolar, uDevPrev = cDevPrev / d.tonPrev / d.dolarPrev;
            const proyDev = uDevPrev * (1 + d.indec);
            d.dev = {
              costo: Math.round(cDev), costoPrev: Math.round(cDevPrev),
              fletes: Math.round(((RAW.fletTotal || [])[i] || 0) + aj),
              fletesPrev: Math.round(((RAW.fletTotal || [])[j] || 0) + ajPrev),
              realUsd: Math.round(uDev * 100) / 100, prevRealUsd: Math.round(uDevPrev * 100) / 100,
              proyUsd: Math.round(proyDev * 100) / 100,
              gapUsd: r1((uDev / proyDev - 1) * 100),
            };
          } else d.dev = null;
        });

        const u = data[data.length - 1];
        const nuevo = Object.assign({}, M, {
          unidad: 'USD / ton descargada',
          janReal: serie[0], janRealUsd: usd[0] ? Math.round(serie[0] / usd[0] * 100) / 100 : null,
          dolar: usd.slice(0, serie.length), data,
          resumen: Object.assign({}, M.resumen, { meses: undefined, arriba: undefined, abajo: undefined, promGap: undefined,
            ultimoMes: u.mes, ultimoReal: u.realUsd, ultimoProy: u.proyUsd, ultimoGap: u.gapUsd,
            ultimoRealPeso: u.real, ultimoProyPeso: u.proy, ultimoGapPeso: u.gapPct,
            nMeses: data.length,
            mesesSobre: data.filter(d => d.gapUsd > 0.5).length,
            mesesBajo: data.filter(d => d.gapUsd < -0.5).length,
            mesesEnLinea: data.filter(d => Math.abs(d.gapUsd) <= 0.5).length,
            gapProm: r1(data.reduce((a, d) => a + d.gapUsd, 0) / data.length),
            gapPromPeso: r1(data.reduce((a, d) => a + d.gapPct, 0) / data.length),
          }),
        });
        log('   métrica en USD: ' + M.data.length + ' → ' + data.length + ' meses · último ' + u.mes +
          ' · real USD ' + u.realUsd + ' vs ajustado ' + u.proyUsd + ' (brecha ' + u.gapUsd + '%' +
          ' · en pesos ' + u.gapPct + '%)');
        escribir(destino, 'DATA', nuevo);
      }
    }
  }

  /* ═════════════ presupuesto de logística ═════════════ */
  log('· Presupuesto de Logística');
  {
    const wb = leer('PRESUPUESTO LOGISTICA.xlsx');
    const destino = 'client/src/dashboards/presupuesto-logistica.html';
    const viejo = util.actual(destino, 'RESUMEN');
    const r = wb.filas('RESUMEN');
    const fEnc = r.findIndex(x => x && /^gerencia$/i.test(String(x[0] || '').trim()));
    if (fEnc < 0) throw new Error('RESUMEN: no encuentro el encabezado Gerencia');
    const cols = [];
    (r[fEnc] || []).forEach((v, j) => { if (v instanceof Date) cols.push({ j, mes: MES_LG[v.getUTCMonth()] }); });
    const grupos = [];
    for (let i = fEnc + 1; i < r.length; i++) {
      const x = r[i]; if (!x) continue;
      const g = txt(x[2]); if (!g || /^total/i.test(g)) break;
      grupos.push({ g, vals: cols.map(c => num(x[c.j])) });
    }
    const RESUMEN = { meses: cols.map(c => c.mes), grupos };
    if (viejo) {
      log('   ' + viejo.meses.length + ' → ' + RESUMEN.meses.length + ' meses (hasta ' + RESUMEN.meses[RESUMEN.meses.length - 1] + ')');
      const dif = viejo.grupos.filter(v => {
        const n = grupos.find(x => x.g === v.g);
        return !n || JSON.stringify(v.vals.slice(0, viejo.meses.length)) !== JSON.stringify(n.vals.slice(0, viejo.meses.length));
      });
      log('   ' + (dif.length ? '~ cambiaron ' + dif.length + ' grupo(s): ' + dif.map(x => x.g).join(', ')
        : '✓ los ' + viejo.grupos.length + ' grupos ya cargados dan igual'));
    }
    escribir(destino, 'RESUMEN', RESUMEN);

    // ── los dos últimos meses, contados de nuevo desde el detalle de viajes ──
    // El anexo del Excel trae los viajes cargados a mano. Acá se cuentan desde
    // KG-FLETES-DESCRIMINADO, que tiene el viaje y lo que se pagó por él, y se
    // valoriza la diferencia de dos formas: a la tarifa media de cada mes.
    const nMes = RESUMEN.meses.length;
    if (nMes >= 2) {
      const mB = MES_LG.indexOf(RESUMEN.meses[nMes - 1]);
      const mA = MES_LG.indexOf(RESUMEN.meses[nMes - 2]);
      const comb = leer('2026 Consumo de combustible.xlsx');
      const kf = comb.filas('KG-FLETES-DESCRIMINADO 2026');
      const dest = {};
      for (let i = 2; i < kf.length; i++) {
        const x = kf[i]; if (!x || !(x[1] instanceof Date)) continue;
        const m = x[1].getUTCMonth(); if (m !== mA && m !== mB) continue;
        const k = (txt(x[3]) || '(sin destino)').replace(/\s+/g, ' ');
        const t = num(x[5]) || 0;
        const a = dest[k] = dest[k] || { d: k, vA: 0, iA: 0, vB: 0, iB: 0 };
        if (m === mA) { a.vA++; a.iA += t; } else { a.vB++; a.iB += t; }
      }
      const filasV = Object.keys(dest).sort().map(k => {
        const a = dest[k];
        const pA = a.vA ? a.iA / a.vA : (a.vB ? a.iB / a.vB : 0);
        const pB = a.vB ? a.iB / a.vB : pA;
        return Object.assign(a, {
          difV: a.vB - a.vA, difI: Math.round(a.iB - a.iA),
          precioA: Math.round(pA), precioB: Math.round(pB),
          valA: Math.round((a.vB - a.vA) * pA), valB: Math.round((a.vB - a.vA) * pB),
        });
      });
      const sum = k => filasV.reduce((t, f) => t + (f[k] || 0), 0);
      // La diferencia de importe se parte en dos: cuántos viajes más se hicieron
      // (valorizados a la tarifa vieja) y cuánto cambió el precio por viaje.
      const VIAJES = {
        mesA: MES_LG[mA], mesB: MES_LG[mB],
        filas: filasV,
        totVA: sum('vA'), totVB: sum('vB'), totIA: Math.round(sum('iA')), totIB: Math.round(sum('iB')),
        difV: sum('difV'), difI: Math.round(sum('difI')),
        valorizadoA: Math.round(sum('valA')), valorizadoB: Math.round(sum('valB')),
        efectoPrecio: Math.round(sum('difI') - sum('valA')),
        // contra qué se puede contrastar
        gastosA: null, gastosB: null,
      };
      const DM = util.actual('client/src/dashboards/matriz-costo-logistica.html', 'D_RAW') || {};
      if (DM.fletTotal) { VIAJES.gastosA = Math.round(DM.fletTotal[mA]); VIAJES.gastosB = Math.round(DM.fletTotal[mB]); }
      log('   viajes ' + VIAJES.mesA + '→' + VIAJES.mesB + ': ' + VIAJES.totVA + ' → ' + VIAJES.totVB +
        ' (' + (VIAJES.difV > 0 ? '+' : '') + VIAJES.difV + ') · facturado ' +
        (VIAJES.difI > 0 ? '+' : '') + Math.round(VIAJES.difI / 1e6) + ' M · valorizado a tarifa de ' +
        VIAJES.mesA + ' ' + Math.round(VIAJES.valorizadoA / 1e6) + ' M');
      escribir(destino, 'VIAJES', VIAJES);

      // ── el presupuesto contra la matriz de costo, mes a mes ──
      // Los dos miran el mismo gasto: si no dan igual hay que poder decir por qué.
      const gr = n => (RESUMEN.grupos.find(x => x.g === n) || { vals: [] }).vals;
      const FLEp = gr('FLETES');
      const propios = RESUMEN.meses.map((_, i) => RESUMEN.grupos
        .filter(x => x.g !== 'FLETES')
        .reduce((t, x) => t + (x.vals[i] || 0), 0));
      // el transporte de colgado / sebo está en la hoja Gastos y explica el resto
      const gsRows = comb.filas('Gastos');
      const fCol = gsRows.findIndex(x => x && /COLGADO ?\/ ?SEBO IMPORTE/i.test(String(x[0] || '')));
      const colgado = RESUMEN.meses.map((_, i) => fCol >= 0 ? (num(gsRows[fCol][i + 1]) || 0) : 0);
      const CONCIL = RESUMEN.meses.map((m, i) => {
        const pf = FLEp[i] || 0, mf = (DM.fletTotal || [])[i] || 0;
        const pp = propios[i] || 0, mp = (DM.propTotal || [])[i] || 0;
        return {
          mes: m,
          fletesPres: Math.round(pf), fletesMatriz: Math.round(mf), fletesDif: Math.round(pf - mf),
          colgado: Math.round(colgado[i]),
          propiosPres: Math.round(pp), propiosMatriz: Math.round(mp), propiosDif: Math.round(pp - mp),
          totalPres: Math.round(pp + pf), totalMatriz: Math.round(mp + mf),
        };
      });
      const cierra = CONCIL.filter(c => Math.abs(c.fletesDif - c.colgado) < 1 && Math.abs(c.propiosDif) < 1).length;
      log('   presupuesto vs matriz: ' + cierra + ' de ' + CONCIL.length + ' meses cierran' +
        (cierra < CONCIL.length ? ' · revisar ' + CONCIL.filter(c => !(Math.abs(c.fletesDif - c.colgado) < 1 && Math.abs(c.propiosDif) < 1)).map(c => c.mes).join(', ') : ''));
      escribir(destino, 'CONCIL', CONCIL);
    }
  }
};
