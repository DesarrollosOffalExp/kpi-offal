// Logística · disponibilidad de flota, necesidad de tambores, consumo de gasoil,
// costo por frigorífico, stock de hiel, matriz y métrica de costo, y el resumen
// del presupuesto. La cuenta de cada dato está en tools/fuentes.json.
const fs = require('fs');
const path = require('path');

const MES_AB = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
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
        frigos.push({ f: n, env, rec, dif: env - rec });
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
    const bloques = []; let act = null;
    for (let i = fEnc + 1; i < d.length; i++) {
      const r = d[i] || [];
      const dom = txt(r[1]);
      if (!dom) { if (act && act.length) { bloques.push(act); act = null; } continue; }
      if (/^dominio|^domio/i.test(dom)) break;      // empieza otra tabla más abajo
      act = act || [];
      act.push({ dom, modelo: txt(r[2]) || '', marca: txt(r[3]) || '', tipo: txt(r[4]) || '', asig: r[5] == null ? '' : String(r[5]).trim() });
    }
    if (act && act.length) bloques.push(act);
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
      if (viejo.fueraServicio.length !== fueraServicio.length) log('   fuera de servicio: ' + viejo.fueraServicio.length + ' → ' + fueraServicio.length);
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
      const a = sal[clave(r[1])] = sal[clave(r[1])] || { s: 0, pes: 0, ticket: '', remito: '' };
      a.s += num(r[4]) || 0;          // E = SALIDAS
      if (num(r[8]) != null) a.pes += num(r[8]);   // I = SUMA SALIDAS [KG] (lo pesado)
      if (txt(r[9])) a.ticket = txt(r[9]);
      if (txt(r[10])) a.remito = txt(r[10]);
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
      const k = clave(d), i = ing[k] || { h: 0, ad: 0 }, o = sal[k] || { s: 0, pes: 0, ticket: '', remito: '' };
      saldo += i.h + i.ad - o.s;
      rows.push({
        fecha: k, fl: fl(d), semana: isoSem(d), dow: d.getUTCDay(),
        ingreso: r1(i.h), aditivo: r1(i.ad), salidas: r1(o.s), pesada: r1(o.pes),
        ticket: o.ticket || '', remito: o.remito || '', saldo,
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
      pctPropios: doce(rotulo(/^% Kgs Poropios/i)),
      pctFletes: doce(rotulo(/^% Kgs Fletes/i)),
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
        const serie = RAW.pesoTonDesc;
        const ib = M.indecByMonth || {};
        const data = [];
        for (let i = 1; i < serie.length; i++) {
          const real = serie[i], prev = serie[i - 1], ind = ib[i + 1];
          if (real == null || prev == null || ind == null) continue;
          const proy = Math.round(prev * (1 + ind));
          data.push({ mes: MES_LG[i], mNum: i + 1, real, prevReal: prev, proy, indec: ind, gapPct: r1((real - proy) / proy * 100) });
        }
        const u = data[data.length - 1];
        const nuevo = Object.assign({}, M, {
          janReal: serie[0], data,
          resumen: Object.assign({}, M.resumen, { meses: undefined, arriba: undefined, abajo: undefined, promGap: undefined,
            ultimoMes: u.mes, ultimoReal: u.real, ultimoProy: u.proy, ultimoGap: u.gapPct,
            nMeses: data.length,
            mesesSobre: data.filter(d => d.gapPct > 0.5).length,
            mesesBajo: data.filter(d => d.gapPct < -0.5).length,
            mesesEnLinea: data.filter(d => Math.abs(d.gapPct) <= 0.5).length,
            gapProm: r1(data.reduce((a, d) => a + d.gapPct, 0) / data.length),
          }),
        });
        log('   métrica: ' + M.data.length + ' → ' + data.length + ' meses · último ' + u.mes +
          ' · real ' + u.real.toLocaleString('es-AR') + ' vs proyectado ' + u.proy.toLocaleString('es-AR'));
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
  }
};
