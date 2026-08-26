// Fábrica de Hielo · movimiento de pallets, productividad, monitoreo de barras
// y el consumo de sal del presupuesto. La cuenta de cada dato está en
// tools/fuentes.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');

exports.actualizar = async function ({ leer, escribir, log, dry, util }) {
  const { num, r2 } = util;

  /* ═══ movimiento de pallets ═══ */
  log('· Movimiento de pallets');
  {
    const wb = leer('MOVIMIENTO DE PALLETS.xlsx');
    const semanas = wb.hojas.map(hoja => {
      const filas = wb.filas(hoja);
      const data = []; let stockFinal = null;
      filas.forEach(r => {
        if (!r) return;
        const f = util.txt(r[0]);
        if (!f || /frigorif|resultado|^total/i.test(f)) return;
        // el total de la semana es esta fila de la planilla, no la suma
        if (/stock\s*final/i.test(f)) { stockFinal = { deuda: num(r[1]) || 0, env: num(r[2]) || 0, rec: num(r[3]) || 0, nd: num(r[4]) || 0 }; return; }
        if (num(r[1]) == null && num(r[2]) == null && num(r[3]) == null) return;
        data.push({ f, deuda: num(r[1]) || 0, env: num(r[2]) || 0, rec: num(r[3]) || 0, nd: num(r[4]) || 0 });
      });
      return { sem: hoja.replace(/\s+/g, ' ').trim().toLowerCase().replace(/(\d)(de )/g, '$1 $2'), data, total: stockFinal || { deuda: 0, env: 0, rec: 0, nd: 0 } };
    });
    const destino = 'client/src/dashboards/movimiento-pallets.html';
    util.comparar('pallets', util.actual(destino, 'WEEKS'), semanas, 'sem');
    log('   ' + semanas.length + ' semanas · última: ' + semanas[semanas.length - 1].sem);
    escribir(destino, 'WEEKS', semanas);
  }

  /* ═══ productividad de barras ═══ */
  log('· Productividad de barras');
  {
    const wb = leer('PRODUCTIVIDAD BARRAS.xlsx');
    const CAP = t => t.charAt(0) + t.slice(1).toLowerCase();
    const dias = []; let resumen = null;
    wb.filas('RESUMEN').forEach(r => {
      if (!r || !r[0]) return;
      const d = util.txt(r[0]);
      if (/^resumen$/i.test(d)) { resumen = { personal: num(r[2]), prod: num(r[3]), horas: num(r[5]), homHs: r2(num(r[6])), consumo: num(r[7]) }; return; }
      if (!/^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)$/i.test(d)) return;
      if (num(r[3]) == null && num(r[5]) == null) return;          // día sin cargar
      dias.push({
        dia: CAP(d), fecha: r[1] instanceof Date ? r[1].toISOString().slice(0, 10) : String(r[1] || ''),
        personal: num(r[2]) || 0, prod: num(r[3]) || 0, homDia: r2(num(r[4])) || 0,
        horas: num(r[5]) || 0, homHs: r2(num(r[6])) || 0, consumo: num(r[7]) || 0,
      });
    });
    const historico = [];
    wb.filas('HISTORICO').forEach(r => { if (r && num(r[0]) != null && num(r[1]) != null) historico.push({ semana: num(r[0]), promedio: num(r[1]) }); });
    const DATA = {
      kpis: { homHs: resumen.homHs, barrasProd: resumen.prod, barrasCons: resumen.consumo, promPersonas: resumen.personal },
      dias, historico,
    };
    const destino = 'client/src/dashboards/productividad-barras.html';
    const viejo = util.actual(destino, 'DATA');
    if (viejo) log('   kpis: ' + JSON.stringify(viejo.kpis) + '  →  ' + JSON.stringify(DATA.kpis));
    log('   ' + dias.length + ' días · histórico hasta la semana ' + historico[historico.length - 1].semana);
    escribir(destino, 'DATA', DATA);
  }

  /* ═══ monitoreo de barras · suma las semanas que falten ═══ */
  log('· Monitoreo de barras');
  {
    const destino = 'client/src/dashboards/monitoreo-barras.html';
    const SEM = util.actual(destino, 'SEMANAS') || [];
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    // "15 al 21 de agosto" -> orden comparable, para no volver a levantar semanas
    // viejas que quedaron sueltas en la carpeta de descargas.
    const orden = etq => {
      const m = etq.match(/(\d+)\s*al\s*(\d+)\s*de\s*([a-záéíóú]+)/i);
      if (!m) return -1;
      const mes = MESES.findIndex(x => x.startsWith(m[3].toLowerCase().slice(0, 4)));
      return mes < 0 ? -1 : mes * 100 + (+m[2]);
    };
    const etiqueta = f => (f.match(/DEL\s*(.+?)(?:\s+DEL\s+\d{4})?\s*\.xlsx$/i) || [, f])[1]
      .replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ').replace(/\.+$/, '').trim().toLowerCase();
    const yaEstan = new Set(SEM.map(s => s.label));
    const carpeta = path.dirname(leer('MOVIMIENTO DE PALLETS.xlsx').ruta);
    const archivos = fs.readdirSync(carpeta)
      .filter(f => /^MONITOREO DE BARRAS/i.test(f) && /\.xlsx$/i.test(f));
    // si hay varias copias de la misma semana ("… (1).xlsx"), vale la más nueva
    const porEtiqueta = new Map();
    archivos.forEach(f => {
      const e = etiqueta(f); if (orden(e) < 0) return;
      const t = fs.statSync(path.join(carpeta, f)).mtimeMs;
      if (!porEtiqueta.has(e) || t > porEtiqueta.get(e).t) porEtiqueta.set(e, { f, t });
    });

    // Arma una semana a partir de su archivo. Es la misma cuenta para una semana
    // nueva y para volver a revisar una que ya estaba cargada.
    const armarSemana = f => {
      // se abre por ruta y no con leer(): el nombre puede traer el sufijo "(1)"
      // que le agrega el navegador, y leer() busca por nombre normalizado.
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(path.join(carpeta, f), { cellDates: true });
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null, blankrows: true });
      const data = [], crudo = { kilos: 0, barrasEst: 0, barrasEnv: 0 };
      let filaTotal = null;
      for (let i = 2; i < filas.length; i++) {
        const r = filas[i]; if (!r) continue;
        const prov = util.txt(r[3]);
        if (prov && /total/i.test(prov)) { filaTotal = r; continue; }
        if (!prov || num(r[4]) == null) continue;
        crudo.kilos += num(r[4]) || 0; crudo.barrasEst += num(r[9]) || 0; crudo.barrasEnv += num(r[11]) || 0;
        const barrasEst = Math.round(num(r[9]) || 0), barrasEnv = Math.round(num(r[11]) || 0);
        data.push({
          prov, kilos: Math.round(num(r[4])), viajes: num(r[2]) || 0, kgsTambor: r2(num(r[6])),
          tachosEst: Math.round(num(r[7]) || 0), tachosEnv: Math.round(num(r[8]) || 0),
          barrasEst, barrasEnv, barrasUsadas: Math.round(num(r[14]) || 0),
          difEnvEst: barrasEnv - barrasEst, difBarras: Math.round(num(r[10]) || 0),
          promEst: r2(num(r[18])), promEnv: r2(num(r[19])), costoKg: r2(num(r[23])),
          valorBarra: Math.round(num(r[21]) || 0), barrasVend: Math.round(num(r[12]) || 0),
          devol: Math.round(num(r[13]) || 0), stockAnt: Math.round(num(r[16]) || 0),
          remont: /remont/i.test(String(r[5] || '')), enfriar: Math.round(num(r[15]) || 0),
          stock: Math.round(num(r[17]) || 0), id: 'p' + (data.length + 1),
        });
      }
      const suma = k => data.reduce((a, d) => a + (d[k] || 0), 0);
      // El total es la suma de los valores que se ven en la tabla, no el redondeo
      // de la suma cruda: si no, la columna no cierra en pantalla y la tarjeta
      // "Dif. barras" deja de dar con "estimadas − usadas".
      const total = {
        kilos: suma('kilos'), viajes: suma('viajes'), kgsTambor: null,
        tachosEst: suma('tachosEst'), tachosEnv: suma('tachosEnv'), barrasEst: suma('barrasEst'),
        barrasEnv: suma('barrasEnv'), barrasUsadas: suma('barrasUsadas'),
        difEnvEst: suma('barrasEnv') - suma('barrasEst'), difBarras: suma('difBarras'),
        promEst: r2(suma('barrasEst') / (suma('tachosEst') || 1)), promEnv: r2(suma('barrasEnv') / (suma('tachosEnv') || 1)),
        costoKg: null, valorBarra: 0, barrasVend: suma('barrasVend'), devol: suma('devol'),
        stockAnt: suma('stockAnt'), enfriar: suma('enfriar'), stock: suma('stock'),
      };
      // Control contra la fila TOTAL de la planilla. Se tolera el arrastre del
      // redondeo por proveedor (unas pocas unidades); más que eso es otra cosa.
      if (filaTotal) [['kilos', 4, total.kilos, 5], ['barrasEst', 9, total.barrasEst, 5], ['barrasEnv', 11, total.barrasEnv, 5]]
        .forEach(([k, col, calc, tol]) => {
          const v = num(filaTotal[col]);
          if (v != null && Math.abs(Math.round(v) - calc) > tol)
            log('   ! ' + etiqueta(f) + ': la fila TOTAL dice ' + k + ' = ' + Math.round(v).toLocaleString('es-AR') + ' y da ' + calc.toLocaleString('es-AR'));
        });
      // la etiqueta sale del nombre del archivo: "… DEL 15 AL 21 DE AGOSTO"
      return { label: etiqueta(f), archivo: f.replace(/\s*\(\d+\)\.xlsx$/i, '.xlsx'), data, total };
    };

    let cambios = 0;
    // 1) las semanas ya cargadas se rehacen y se comparan: la planilla de una
    //    semana se sigue corrigiendo después de cerrada.
    SEM.forEach((vieja, i) => {
      const cand = porEtiqueta.get(vieja.label);
      if (!cand) return;
      const rehecha = armarSemana(cand.f);
      if (JSON.stringify(vieja) === JSON.stringify(rehecha)) return;
      const dt = (a, b, k) => (a.total[k] || 0) !== (b.total[k] || 0)
        ? k + ' ' + (a.total[k] || 0).toLocaleString('es-AR') + ' → ' + (b.total[k] || 0).toLocaleString('es-AR') : null;
      const detalle = ['kilos', 'barrasEst', 'barrasEnv', 'barrasUsadas', 'stock', 'viajes']
        .map(k => dt(vieja, rehecha, k)).filter(Boolean);
      log('   ~ ' + vieja.label + ': cambió el archivo · ' +
        (vieja.data.length !== rehecha.data.length ? vieja.data.length + ' → ' + rehecha.data.length + ' proveedores · ' : '') +
        (detalle.length ? detalle.join(' · ') : 'sólo detalle por proveedor'));
      SEM[i] = rehecha; cambios++;
    });

    // 2) y se suman las semanas que todavía no estaban
    const ultima = SEM.length ? orden(SEM[SEM.length - 1].label) : -1;
    const nuevos = [...porEtiqueta.values()].map(v => v.f)
      .filter(f => !yaEstan.has(etiqueta(f)) && orden(etiqueta(f)) > ultima)
      .sort((a, b) => orden(etiqueta(a)) - orden(etiqueta(b)));
    nuevos.forEach(f => {
      const sem = armarSemana(f);
      SEM.push(sem); cambios++;
      log('   + ' + sem.label + ' · ' + sem.data.length + ' proveedores · ' + sem.total.kilos.toLocaleString('es-AR') + ' kg');
    });
    if (!cambios) log('   sin cambios (' + SEM.length + ' semanas, última: ' + (SEM.length ? SEM[SEM.length - 1].label : '—') + ')');
    else log('   ' + SEM.length + ' semanas cargadas · última: ' + SEM[SEM.length - 1].label);
    if (cambios) escribir(destino, 'SEMANAS', SEM);
  }

  /* ═══ consumo de sal (va dentro de RESUMEN del presupuesto) ═══ */
  log('· Consumo de sal');
  {
    const wb = leer('CONSUMO DE SAL.xlsx');
    const anio = wb.hojas.find(h => /^\d{4}$/.test(h.trim())) || '2026';
    const porMes = {};
    wb.filas(anio).forEach(r => {
      if (!r || !(r[0] instanceof Date) || r[0].getFullYear() !== +anio.trim()) return;
      const c = num(r[2]); if (c == null) return;
      porMes[r[0].getMonth()] = (porMes[r[0].getMonth()] || 0) + c;
    });
    const destino = 'client/src/dashboards/presupuesto.html';
    const p = path.join(RAIZ, destino);
    let s = fs.readFileSync(p, 'utf8');
    const R = JSON.parse(s.match(/const RESUMEN=(\{[\s\S]*?\});/)[1]);
    const nuevos = R.meses.map((m, i) => porMes[i] == null ? null : Math.round(porMes[i]));
    R.meses.forEach((m, i) => { if (R.consumoSal[i] !== nuevos[i]) log('   ' + m + ': ' + R.consumoSal[i] + ' → ' + nuevos[i]); });
    const extra = Object.keys(porMes).map(Number).filter(i => i >= R.meses.length);
    if (extra.length) log('   (el archivo ya tiene ' + extra.length + ' mes(es) más, pero el presupuesto llega hasta ' + R.meses[R.meses.length - 1] + ')');
    R.consumoSal = nuevos;
    if (!dry) fs.writeFileSync(p, s.replace(/const RESUMEN=\{[\s\S]*?\};/, 'const RESUMEN=' + JSON.stringify(R) + ';'));
  }
};
