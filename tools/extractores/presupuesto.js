// Presupuesto · acciones correctivas por sector y los anexos de Fletes
// (Logística) y Servicios (Sistemas).
// La cuenta de cada dato está en tools/fuentes.json.
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');

// Centro de costo de la planilla → tablero de presupuesto del sector.
const MAPA = [
  ['ALMACEN INSUMOS', 'client/src/dashboards/presupuesto-insumos.html'],
  ['COMPRAS', 'client/src/dashboards/presupuesto-compras.html'],
  ['CONGELADO', 'client/src/dashboards/presupuesto-congelado.html'],
  ['FABRICA DE HIELO', 'client/src/dashboards/presupuesto.html'],
  ['LAVADERO DE CAMIONES', 'client/src/dashboards/presupuesto-lavadero.html'],
  ['LOGISTICA', 'client/src/dashboards/presupuesto-logistica.html'],
  ['TALLER', 'client/src/dashboards/presupuesto-taller.html'],
  ['SISTEMAS', 'client/src/dashboards/kpi-sistemas.html'],
];

/** El archivo del mes más nuevo de la carpeta de descargas. */
function archivoDelMes(dir) {
  const c = fs.readdirSync(dir)
    .filter(f => /^gerencia de operaciones \d{6}.*\.xlsx$/i.test(f))
    .map(f => ({ f, mes: f.match(/(\d{2})(\d{4})/), t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .filter(x => x.mes)
    .sort((a, b) => (a.mes[2] + a.mes[1]).localeCompare(b.mes[2] + b.mes[1]) || a.t - b.t);
  if (!c.length) throw new Error('no encuentro ningún "Gerencia de Operaciones MMAAAA.xlsx"');
  const u = c[c.length - 1];
  // se devuelve el nombre canónico: leer() ya tolera los sufijos del navegador
  return { nombre: u.f.replace(/\s*\(\d+\)(\.xlsx)$/i, '$1'), mes: u.mes[1] + '/' + u.mes[2] };
}

exports.actualizar = async function ({ leer, escribir, log, dry, util }) {
  const { num, txt } = util;
  const DESC = path.dirname(leer('KPI sistemas.xlsx').ruta.replace(/[^\\/]+$/, 'x'));
  const { nombre, mes } = archivoDelMes(DESC);
  log('Archivo del mes: ' + nombre + '  (' + mes + ')\n');
  const wb = leer(nombre);
  const GR = ['MATERIAL', 'SERVICIOS', 'FLETES', 'SERVICIOS PUBLICOS', 'MO EVENTUAL', 'MO PROPIA'];

  /* ═══ acciones correctivas ═══ */
  log('· Acciones correctivas');
  const acciones = {};
  // La hoja de resumen cambia de nombre todos los meses: se busca por contenido.
  wb.hojas.forEach(h => {
    wb.filas(h).forEach(r => {
      if (!r) return;
      const sec = txt(r[1]);
      if (!sec || sec === 'Descripcion del centro de costo') return;
      if (!GR.includes((txt(r[2]) || '').toUpperCase())) return;
      const accion = r[8] == null ? null : String(r[8]).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
      if (!accion) return;
      const lista = acciones[sec] = acciones[sec] || [];
      if (lista.some(a => a.grupo === txt(r[2]))) return;
      lista.push({
        grupo: txt(r[2]), presup: r[3] == null ? null : Math.abs(r[3]),
        real: r[4] == null ? null : Math.abs(r[4]), dif: num(r[5]),
        accion, fecha: util.dmy(r[9]) || null, resp: txt(r[10]),
      });
    });
  });
  MAPA.forEach(([sector, destino]) => {
    const acc = acciones[sector] || [];
    log('   ' + sector.padEnd(22) + acc.length + ' acción(es) · ' + path.basename(destino));
    if (!fs.existsSync(path.join(RAIZ, destino))) { log('     ! no existe ' + destino); return; }
    escribir(destino, 'ACC', acc, { decl: 'var' });
    if (!dry) {
      const p = path.join(RAIZ, destino);
      let s = fs.readFileSync(p, 'utf8');
      s = s.replace(/ACC_MES\s*=\s*'[^']*'/, "ACC_MES='" + mes + "'");
      fs.writeFileSync(p, s);
    }
  });

  /* ═══ anexo de fletes (Logística) ═══ */
  if (wb.hojas.some(h => /fletes/i.test(h))) {
    log('· Anexo de fletes');
    const hoja = wb.hojas.find(h => /fletes/i.test(h) && /log/i.test(h)) || wb.hojas.find(h => /fletes/i.test(h));
    const fl = { cab: [], filas: [], total: null, extra: [] };
    wb.filas(hoja).forEach(r => {
      if (!r) return;
      const a = txt(r[0]);
      if (a === 'Etiquetas de fila') { fl.cab = [txt(r[1]), txt(r[2])]; return; }
      if (a === 'Total general') { fl.total = { jun: num(r[1]), jul: num(r[2]), tot: num(r[3]), dif: num(r[4]), imp: num(r[6]) }; return; }
      if (a && num(r[3]) != null) fl.filas.push({ n: a, jun: num(r[1]), jul: num(r[2]), tot: num(r[3]), dif: num(r[4]), precio: num(r[5]), imp: num(r[6]) });
      // las dos líneas del pie no tienen etiqueta de fila
      const et = txt(r[5]);
      if (!a && et && num(r[6]) != null) fl.extra.push({ k: et, v: num(r[6]) });
    });
    log('   ' + fl.filas.length + ' frigoríficos · ' + (fl.total ? fl.total.dif + ' viajes de diferencia · $ ' + Math.round(fl.total.imp).toLocaleString('es-AR') : '—'));
    escribir('client/src/dashboards/presupuesto-logistica.html', 'FL', fl, { decl: 'var' });
  } else log('· Anexo de fletes: el archivo del mes no lo trae');

  /* ═══ anexo de servicios (Sistemas) ═══ */
  if (wb.hojas.some(h => /servicios sistemas/i.test(h))) {
    log('· Anexo de servicios');
    const hoja = wb.hojas.find(h => /servicios sistemas/i.test(h));
    const rows = wb.filas(hoja);
    const serv = { cab: (rows[0] || []).map(txt).filter(Boolean), filas: [] };
    rows.slice(1).forEach(r => {
      if (!r || !txt(r[0])) return;
      serv.filas.push({
        emp: txt(r[0]), serv: txt(r[1]), un: txt(r[2]), cant: r[3] == null ? null : r[3],
        forma: txt(r[4]), mes: txt(r[5]), jun: txt(r[6]), jul: txt(r[7]), ago: txt(r[8]), obs: txt(r[9]),
      });
    });
    const sinUlt = serv.filas.filter(f => !f.jul || f.jul === '-').length;
    log('   ' + serv.filas.length + ' proveedores · ' + sinUlt + ' sin comprobante en el mes');
    escribir('client/src/dashboards/kpi-sistemas.html', 'SERV', serv, { decl: 'var' });
  } else log('· Anexo de servicios: el archivo del mes no lo trae');
};
