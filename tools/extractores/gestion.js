// Presupuesto · Gerencia de Gestión. Sale de DOS archivos de SharePoint ·
// Gerencia de Gestión / <mes>. La cuenta de cada dato está en tools/fuentes.json.
//
//   1. "INFO <MES> <AÑO> …"            → servicios, fletes y materiales
//   2. "COSTOS Mano de Obra <mes> <año>" → mano de obra propia y eventual
//
// El primero cambió de forma en la "nueva presentación" de julio 2026:
//   antes  "presupuesto <mes> <año>.xlsx"  · 5 hojas (Hoja1..Hoja5)
//   ahora  "INFO <MES> <AÑO> …"            · 2 hojas, SERVICIOS y MATERIALES
// Se leen las dos formas. Las columnas se mapean POR NOMBRE DE ENCABEZADO y no
// por posición: la nueva presentación insertó una columna en el medio y corrió
// todo lo que sigue.
//
// Criterios de corte, que son lo que hace que el mes cierre con los presupuestos
// de sector:
//   · SERVICIOS  → el centro de costo es la DENOMINACIÓN, y el mes sale del
//     "Periodo Devengado Manual", no del devengado del ERP. Esa columna manual es
//     la que reimputa al mes de la operación las facturas que llegan después:
//     ningún fletero factura por mes, todos facturan a semana vencida.
//   · MATERIALES → sólo las filas con "Centro Costo Destino": el gasto es de
//     quien consume, no de quien tiene el material en el almacén.

const fs = require('fs');
const path = require('path');

const DESTINO = 'client/src/dashboards/presupuesto-gestion.html';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Grupo de costo, con el mismo vocabulario que los presupuestos de los sectores.
const GRUPOS = ['MO PROPIA', 'MO EVENTUAL', 'FLETES', 'SERVICIOS', 'MATERIAL'];
// Servicios públicos se sacó de las cuentas de todos los sectores: la electricidad
// y el gas se analizan aparte. Las filas del ERP que caen acá no se suman a nada.
const FUERA = 'SERVICIOS PUBLICOS';
const G_MOP = 0, G_MOE = 1;

// Los ajustes de inventario, cuando venían, casi nunca traían centro destino.
const SIN_CENTRO = '(sin centro)';

// Por debajo de esto el tablero muestra un guión igual: no vale la pena publicarlo,
// y una fila entera de guiones se lee como un error.
const MINIMO = 50000;

// Cada archivo llama distinto al mismo centro de costo. Los nombres que no se
// pueden deducir de los propios archivos van acá, o el presupuestado no encuentra
// con quién cruzarse. Lo que sobra no molesta: un alias que nadie usa se ignora.
const ALIAS = {
  ADM: ['ADMINISTRACION DE PLANTA', 'ADMINISTRACION Y FINANZAS'],
  ANP: ['ALMACEN NO PRODUCTIVOS', 'PAÑOL'],
  CONG: ['CONGELADO', 'CONGELADOS'],
  DESC: ['DESCARGA', 'DESCARGA MENUDENCIAS'],
  ING: ['INGENIERIA Y PROYECTOS', 'OBRAS Y PROYECTOS'],
  MA: ['MEDIO AMBIENTE', 'PLANTA DE EFLUENTES'],
  MCAR: ['MENUCAR'],
  MEN: ['PRODUCCION DE MENUDENCIAS', 'MENUDENCIAS'],
  SEH: ['SEGURIDAD E HIGIENE', 'HIGIENE, SEGURIDAD Y MEDIO AMBIENTE'],
};

/* ═══════════════════ mano de obra ═══════════════════════════════════════════
 * Las columnas las definió la Gerencia de Gestión por LETRA DE EXCEL. Son las
 * que suman: los subtotales de la planilla (G, P, AK, AO, Y) quedan afuera a
 * propósito, y cada corrida verifica que sigan siendo subtotales.
 * Ojo con Y: viene en la lista original de MO eventual, pero es el total de
 * R+T+V+W+X. Sumarla duplicaba 1.491,6 M de los 3.015,5 M. Se excluye, y con eso
 * OFFAL + EVENTUAL da exactamente la columna AS (TOTAL FINAL) de la planilla.
 */
const MO_OFFAL = ['E', 'F', 'J', 'M', 'N', 'O', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AL', 'AM', 'AN'];
const MO_EVENTUAL = ['R', 'T', 'V', 'W', 'X', 'Z'];
const MO_SUBTOTAL_EVENTUAL = { col: 'Y', partes: ['R', 'T', 'V', 'W', 'X'] };
const MO_TOTAL = 'AS';
// Dos columnas se llaman las dos "TOTAL" (el importe de las horas al 50 y al
// 100). Se renombran para que el desglose se pueda leer.
const MO_RENOMBRE = { J: 'Horas al 50%', M: 'Horas al 100%' };
// Layout de referencia: si un mes no lo cumple, no se lee (las hojas de 2025
// tienen otro orden de columnas y las letras significarían otra cosa).
const MO_LAYOUT = {
  E: 'TOTAL BDT', F: 'LINEA 2', N: 'PLUS PRODUCCION', O: 'CHANGAS OPERARIOS',
  R: 'La Telecristal', T: 'HORAS L2 $', V: 'CHANGAS $', W: 'PRESENTISMO',
  X: 'PLUS DESCARGA', Y: 'TOTAL LA TELECRISTAL', Z: 'CONSULTORES',
  AA: 'ENGANCHE Y DESENGANCHE', AJ: 'SUELDO FIJO CHOFERES', AL: 'AJUSTES',
  AN: 'LIQUIDACION FINAL', AS: 'TOTAL FINAL',
};

/** Rubro + subrubro → grupo de costo. Los subrubros mandan sobre el rubro, y la
 *  hoja de la que viene la fila manda sobre los dos.
 *
 *  `servicios` es true para las filas de la hoja SERVICIOS de la nueva
 *  presentación: ahí todo lo que no sea flete es un servicio facturado, aunque el
 *  rubro se llame como un material. El caso es REP (REPARADO), que existe en las
 *  DOS hojas: las reparaciones de camiones que Taller factura afuera están en
 *  SERVICIOS y son servicios; los repuestos que salen del almacén están en
 *  MATERIALES y son material. Mapearlo sólo por rubro le pasaba 41,2 M de Taller
 *  y 1,6 M de Sistemas de un grupo al otro. */
function grupoDe(rubro, subrubro, servicios) {
  if (rubro === 'SER') {
    if (subrubro === '2642') return 'MO PROPIA';
    if (subrubro === '2617') return 'MO EVENTUAL';
    if (subrubro === '2635') return 'FLETES';
    if (subrubro === '2696' || subrubro === '2697') return FUERA;
    return 'SERVICIOS';
  }
  if (rubro === 'FLE') return 'FLETES';
  return servicios ? 'SERVICIOS' : 'MATERIAL';
}

const txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
/** Los importes vienen a veces como texto con coma decimal ("12342723,700000"). */
function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
/** El ERP escribe el gasto en negativo. El tablero lo muestra en positivo. */
const gasto = v => -num(v);
const M = v => (v / 1e6).toFixed(1) + ' M';
/** "07/2026" venga como texto o como fecha. */
function periodo(v) {
  if (v instanceof Date) return String(v.getUTCMonth() + 1).padStart(2, '0') + '/' + v.getUTCFullYear();
  const s = txt(v);
  return /^\d{2}\/\d{4}$/.test(s) ? s : '';
}
const etiquetaDe = p => MESES[+p.slice(0, 2) - 1] + ' ' + p.slice(3);

function acum(mapa, clave, campo, valor) {
  if (!mapa[clave]) mapa[clave] = { nt: 0, con: 0, aju: 0, mo: 0 };
  mapa[clave][campo] += valor;
}
const total = o => o.nt + o.con + o.aju + o.mo;

/** Busca en la carpeta de descargas el archivo más nuevo que matchee alguno de
 *  los patrones, entendiendo "más nuevo" por el mes que nombra. */
function archivoDelMes(dirs, patrones, queEs) {
  const c = [];
  dirs.forEach(dir => fs.readdirSync(dir).forEach(f => {
    if (/^~\$/.test(f)) return;
    for (const re of patrones) {
      const m = f.match(re);
      if (!m) continue;
      c.push({
        nombre: f.replace(/\s*\(\d+\)(\.xlsx)$/i, '$1'),
        orden: m[2] + String(MESES.findIndex(x => x.toLowerCase() === m[1].toLowerCase()) + 1).padStart(2, '0'),
        t: fs.statSync(path.join(dir, f)).mtimeMs,
      });
      return;
    }
  }));
  if (!c.length) throw new Error('no encuentro ningún archivo de ' + queEs + ' en ' + dirs.join(' ni en '));
  c.sort((a, b) => a.orden.localeCompare(b.orden) || a.t - b.t);
  return c[c.length - 1].nombre;
}

const MES_RE = '(' + MESES.join('|') + ')';
const PATRONES_GASTO = [
  new RegExp('^INFO ' + MES_RE + ' (\\d{4})\\b.*\\.xlsx$', 'i'),
  new RegExp('^presupuesto ' + MES_RE + ' (\\d{4})(?: \\(\\d+\\))?\\.xlsx$', 'i'),
];
const PATRONES_MO = [new RegExp('^COSTOS Mano de Obra ' + MES_RE + ' (\\d{4})\\b.*\\.xlsx$', 'i')];

/** Todos los archivos de gasto que haya, uno por mes, del más viejo al más nuevo.
 *  Cada mes analizado es una carpeta propia en SharePoint; leerlos todos es lo
 *  que permite comparar un mes contra el anterior. */
function archivosDeGasto(dirs) {
  const porMes = {};
  dirs.forEach(dir => fs.readdirSync(dir).forEach(f => {
    if (/^~\$/.test(f)) return;
    for (let p = 0; p < PATRONES_GASTO.length; p++) {
      const m = f.match(PATRONES_GASTO[p]);
      if (!m) continue;
      const i = MESES.findIndex(x => x.toLowerCase() === m[1].toLowerCase());
      const clave = m[2] + String(i + 1).padStart(2, '0');
      const cand = { nombre: f.replace(/\s*\(\d+\)(\.xlsx)$/i, '$1'), clave, etiqueta: MESES[i] + ' ' + m[2], p };
      // Si un mes tiene las dos presentaciones —en Descargas quedó el archivo
      // viejo de julio— gana la nueva, que es el primer patrón. A igual
      // presentación, la copia de nombre más corto (la que no dice "(2)").
      const ya = porMes[clave];
      if (!ya || cand.p < ya.p || (cand.p === ya.p && cand.nombre.length < ya.nombre.length)) porMes[clave] = cand;
      return;
    }
  }));
  return Object.keys(porMes).sort().map(k => porMes[k]);
}

/** Encuentra la fila de encabezados —la primera que tenga todas las etiquetas
 *  pedidas— y devuelve un lector de celdas por nombre de columna. Así el archivo
 *  puede agregar o correr columnas sin romper nada. */
function tabla(filas, obligatorias) {
  const norm = s => txt(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const busca = obligatorias.map(norm);
  for (let i = 0; i < Math.min(filas.length, 12); i++) {
    const cab = (filas[i] || []).map(norm);
    if (busca.every(b => cab.includes(b))) {
      const idx = {};
      cab.forEach((c, j) => { if (c && !(c in idx)) idx[c] = j; });
      return {
        datos: filas.slice(i + 1),
        col: nombre => {
          const k = norm(nombre), j = idx[k];
          if (j === undefined) throw new Error('no encuentro la columna "' + nombre + '"');
          return r => r[j];
        },
        tiene: nombre => norm(nombre) in idx,
      };
    }
  }
  throw new Error('no encuentro el encabezado con ' + JSON.stringify(obligatorias));
}

/** El período que domina una lista: es el mes que analiza el archivo. */
function mesDominante(valores) {
  const c = {};
  valores.forEach(v => { const p = periodo(v); if (p) c[p] = (c[p] || 0) + 1; });
  const orden = Object.entries(c).sort((a, b) => b[1] - a[1]);
  if (!orden.length) throw new Error('no encuentro el período del archivo');
  return orden[0][0];
}

/* ═══════════════════ lectura de la mano de obra ══════════════════════════ */

/** Lee una hoja mensual del archivo de mano de obra. Devuelve, por centro de
 *  costo, el importe de cada columna del desglose. Sólo el PRIMER bloque de la
 *  hoja: abajo vienen otros dos con la misma lista de CECOs (uno en cero y otro
 *  con las diferencias) que no son gasto del mes. */
function leerHojaMO(ws, XLSX, log, nombreHoja) {
  const cel = (r, L) => { const c = ws[L + r]; return c ? c.v : null; };
  const val = (r, L) => { const v = cel(r, L); return typeof v === 'number' ? v : 0; };

  let hr = null;
  for (let r = 1; r <= 8; r++) if (/^ceco$/i.test(txt(cel(r, 'B')))) { hr = r; break; }
  if (!hr) return null;

  // Las letras sólo significan lo que se espera si el layout es el de 2026.
  const distintas = Object.entries(MO_LAYOUT).filter(([L, t]) => txt(cel(hr, L)).toUpperCase() !== t.toUpperCase());
  if (distintas.length) {
    log('   · ' + nombreHoja + ': otro orden de columnas (' + distintas.length + ' distintas) — se saltea');
    return null;
  }

  const filas = [];
  for (let r = hr + 1; r <= hr + 300; r++) {
    const b = txt(cel(r, 'B'));
    if (!b || /^total/i.test(b)) break;   // fin del primer bloque
    filas.push(r);
  }

  const titulo = L => MO_RENOMBRE[L] || txt(cel(hr, L));
  const centros = {};
  filas.forEach(r => {
    const cc = txt(cel(r, 'B'));
    const nom = txt(cel(r, 'C')) || cc;
    if (!centros[cc]) centros[cc] = { nom, items: {} };
    [...MO_OFFAL, ...MO_EVENTUAL].forEach(L => { centros[cc].items[L] = (centros[cc].items[L] || 0) + val(r, L); });
  });

  const sum = Ls => filas.reduce((a, r) => a + Ls.reduce((s, L) => s + val(r, L), 0), 0);
  return {
    centros, titulo,
    offal: sum(MO_OFFAL),
    eventual: sum(MO_EVENTUAL),
    subtotal: sum([MO_SUBTOTAL_EVENTUAL.col]),
    partesSubtotal: sum(MO_SUBTOTAL_EVENTUAL.partes),
    totalPlanilla: sum([MO_TOTAL]),
  };
}

/* ═══════════════════ presupuestado ═══════════════════════════════════════
 * El gasto real sale de los archivos de Gestión; el PRESUPUESTADO sale de otro
 * lado: "Gerencia de Operaciones <MM><AAAA>.xlsx", un archivo por mes, hoja de
 * resumen. Es el mismo archivo del que el grupo "presupuesto" saca las acciones
 * correctivas. De ahí sale también a qué GERENCIA pertenece cada sector.
 *
 * La hoja cambia de nombre todos los meses —DESVIOS ANALIZADOS, PARTIDA
 * PRESUPUESTARIA FEBRERO, RESUMEN, Resumen Gerencia— así que se busca por
 * contenido: la fila que tiene "Gerencia" y "GRUPO".
 */
// El archivo vive en la misma carpeta que el del gasto: Gestión / Presupuesto
// <mes>. Ojo de NO tomar el del gasto ("INFO <MES> <AÑO> …"), que empieza igual.
const PATRON_PRESUP = /^INFO PRESUPUESTADO .*\.xlsx$/i;

/** La hoja de resumen y su fila de encabezado, buscadas por contenido. */
function hojaResumen(xl) {
  for (const n of xl.hojas) {
    const f = xl.filas(n);
    const i = f.findIndex(r => (r || []).some(c => txt(c).toLowerCase() === 'gerencia')
      && (r || []).some(c => txt(c).toUpperCase() === 'GRUPO'));
    if (i >= 0) return { filas: f, cabecera: i, hoja: n };
  }
  return null;
}

function leerPresupuestado(carpetas, leer, log, util, alias) {
  // nombre del centro de costo → código. Se usan TODOS los nombres con que se lo
  // vio: el archivo de gasto le dice "DESCARGA MENUDENCIAS" y el de mano de obra
  // "DESCARGA", y el presupuestado puede usar cualquiera de los dos.
  const codigoDe = {};
  Object.entries(alias).forEach(([cc, noms]) => {
    codigoDe[cc.toUpperCase()] = cc;
    noms.forEach(n => { codigoDe[txt(n).toUpperCase()] = cc; });
  });

  const cands = [];
  carpetas.forEach(d => fs.readdirSync(d).forEach(f => {
    if (PATRON_PRESUP.test(f) && !/^~\$/.test(f)) cands.push(f);
  }));
  if (!cands.length) {
    log('   ! sin presupuestado: falta "INFO PRESUPUESTADO … .xlsx" en ' + carpetas.join(' ni en '));
    return null;
  }
  // con varias copias gana la de nombre más corto: la que no tiene "(2)"
  const archivo = cands.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];

  let xl; try { xl = leer(archivo); } catch (e) { log('   ! presupuestado: ' + e.message); return null; }
  const h = hojaResumen(xl);
  if (!h) { log('   ! presupuestado ' + archivo + ': no encuentro la hoja con Gerencia + GRUPO'); return null; }

  // Las columnas de mes se detectan por el encabezado, que viene como fecha
  // ("2026-07-01") o como texto ("PRESUPUESTADO 07/2026"). Las de gasto real, si
  // están, se ignoran: el real sale de los archivos de Gestión.
  //
  // Sólo se toma el PRIMER bloque contiguo de meses: a la derecha del año hay un
  // segundo juego de columnas ("PARTIDAS AJUSTADAS", CODIGO y otros doce meses)
  // que es un anexo de trabajo, no el presupuesto. Por eso se corta apenas
  // aparece una columna que no es un mes.
  const cab = h.filas[h.cabecera] || [];
  const mesDeCabecera = c => {
    if (c instanceof Date) return String(c.getUTCMonth() + 1).padStart(2, '0') + '/' + c.getUTCFullYear();
    if (typeof c === 'number' && c > 40000) {
      const d = new Date(Date.UTC(1899, 11, 30) + c * 86400000);
      return String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
    }
    const t = txt(c);
    if (/gasto\s*real/i.test(t)) return null;
    const m = t.match(/(\d{2})\/(\d{4})/);
    return m ? m[1] + '/' + m[2] : null;
  };
  const columnas = [];
  for (let j = 3; j < cab.length; j++) {
    const mes = mesDeCabecera(cab[j]);
    if (mes) columnas.push({ j, mes });
    else if (columnas.length) break;
  }
  if (!columnas.length) { log('   ! presupuestado ' + archivo + ': no reconozco ninguna columna de mes'); return null; }
  columnas.sort((a, b) => a.mes.slice(3).localeCompare(b.mes.slice(3)) || a.mes.localeCompare(b.mes));
  const meses = columnas.map(c => ({ mes: c.mes, etiqueta: etiquetaDe(c.mes) }));

  const filas = [], gerenciaDe = {}, soloPresupuesto = {};
  let n = 0;
  h.filas.slice(h.cabecera + 1).forEach(r => {
    const ger = txt(r[0]), nom = txt(r[1]), gru = txt(r[2]).toUpperCase();
    if (!ger || !nom || GRUPOS.indexOf(gru) < 0) return;
    // Un sector con partida pero sin gasto también hay que mostrarlo: un
    // presupuesto sin ejecutar es una desviación como cualquier otra.
    let cc = codigoDe[nom.toUpperCase()];
    if (!cc) { cc = nom; soloPresupuesto[cc] = nom; }
    gerenciaDe[cc] = ger;
    columnas.forEach((c, mi) => {
      // El presupuestado viene en negativo como todo el resto; se muestra en positivo.
      const v = typeof r[c.j] === 'number' ? Math.abs(r[c.j]) : 0;
      if (v < 1) return;
      filas.push([mi, cc, GRUPOS.indexOf(gru), util.r2(v)]);
      n++;
    });
  });
  const solos = Object.keys(soloPresupuesto);
  if (solos.length) log('   · presupuestado: ' + solos.join(', ') + ' tiene(n) partida pero no gasto cargado');
  log('   · presupuestado: ' + archivo + ' · hoja "' + h.hoja + '" · ' + meses.length + ' meses · ' + n + ' celdas');

  // Gerencias con sus sectores, para el selector del tablero.
  const porGerencia = {};
  Object.entries(gerenciaDe).forEach(([cc, g]) => { (porGerencia[g] = porGerencia[g] || []).push(cc); });
  const gerencias = Object.entries(porGerencia)
    .map(([nom, ccs]) => ({ nom, ccs: ccs.sort() }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return { archivo, meses, filas, gerencias, gerenciaDe, soloPresupuesto };
}

/* ═══════════════════ cruce contra los presupuestos de sector ═════════════
 * Cada sector tiene su propia ventana de Presupuesto, alimentada por su propio
 * archivo. Este cruce compara, grupo por grupo, lo que muestra cada una contra
 * lo que Gestión imputa a su centro de costo, y explica de dónde sale cada
 * diferencia. Los números salen de los tableros ya escritos, así que compara
 * exactamente lo que la persona ve en pantalla.
 */
const SECTORES = [
  { nom: 'Insumos', cc: 'AIN', tablero: 'client/src/dashboards/presupuesto-insumos.html', cte: 'RESUMEN', det: 'DETALLE' },
  { nom: 'Compras', cc: 'COMP', tablero: 'client/src/dashboards/presupuesto-compras.html', cte: 'RESUMEN', det: 'DETALLE' },
  { nom: 'Fábrica de Hielo', cc: 'HIE', tablero: 'client/src/dashboards/presupuesto.html', cte: 'RESUMEN', det: 'DETALLE' },
  { nom: 'Logística', cc: 'LOG', tablero: 'client/src/dashboards/presupuesto-logistica.html', cte: 'RESUMEN', det: 'DETALLE' },
  { nom: 'Sistemas', cc: 'SIS', tablero: 'client/src/dashboards/kpi-sistemas.html', cte: 'P_RES', det: 'P_DET' },
  { nom: 'Taller', cc: 'TALL', tablero: 'client/src/dashboards/presupuesto-taller.html', cte: 'RESUMEN', det: 'DETALLE' },
  { nom: 'Lavadero de Camiones', cc: 'LAVC', tablero: 'client/src/dashboards/presupuesto-lavadero.html', cte: 'RESUMEN', det: 'DETALLE' },
];

// Causas conocidas, con el importe que explican. Se escriben acá y no en el
// tablero para que queden al lado de la cuenta que las produce.
const CAUSAS = [
  {
    cc: 'LOG', grupo: 'MO PROPIA',
    causa: 'La ventana de Logística toma la mano de obra propia de la línea GASTOS DE PERSONAL PROPIO del ERP, ' +
      'que en Logística ya incluye a los consultores, y además muestra esos mismos consultores como MO eventual. ' +
      'Los cuenta dos veces. Gestión los separa con el archivo de costos: propia y consultores.',
    lado: 'sector',
  },
];

/** Cruza un mes contra los presupuestos de sector, en las dos medidas:
 *  lo PRESUPUESTADO y el GASTO REAL. El real del sector sale de su RESUMEN y el
 *  presupuestado de su DETALLE, que es la hoja del mes. Del lado de Gestión los
 *  dos salen de lo que ya está armado, así que se compara exactamente lo que se
 *  ve en pantalla. */
function cruzarMes(util, mesEtiqueta, realDe, presDe, log) {
  const corto = mesEtiqueta.split(' ')[0];
  const salida = [];
  SECTORES.forEach(s => {
    let R = null, D = null;
    try { R = util.actual(s.tablero, s.cte); } catch (e) { R = null; }
    try { D = util.actual(s.tablero, s.det); } catch (e) { D = null; }
    if (!R || !Array.isArray(R.meses) || !Array.isArray(R.grupos)) {
      log('   · cruce: no puedo leer ' + s.cte + ' de ' + s.tablero.split('/').pop());
      return;
    }
    const i = R.meses.indexOf(corto);
    if (i < 0) { log('   · cruce ' + corto + ': ' + s.nom + ' no tiene ese mes'); return; }

    // Los tableros guardan el gasto en positivo o en negativo según el archivo
    // del que salen; para comparar vale el importe.
    const realSec = {}, presSec = {};
    R.grupos.forEach(g => { realSec[g.g] = Math.abs(g.vals[i] || 0); });
    ((D && D[corto] && D[corto].grupos) || []).forEach(g => { presSec[g.g] = Math.abs(g.presup || 0); });
    const realGes = realDe(s.cc), presGes = presDe(s.cc);

    const filas = GRUPOS.map(g => {
      const rS = util.r2(realSec[g] || 0), rG = util.r2(realGes[g] || 0);
      const pS = util.r2(presSec[g] || 0), pG = util.r2(presGes[g] || 0);
      if ([rS, rG, pS, pG].every(v => Math.abs(v) < MINIMO)) return null;
      const dR = util.r2(rG - rS), dP = util.r2(pG - pS);
      const c = Math.abs(dR) >= MINIMO ? CAUSAS.find(x => x.cc === s.cc && x.grupo === g) : null;
      return { g, presSector: pS, presGestion: pG, difPres: dP,
        sector: rS, gestion: rG, dif: dR, causa: c ? c.causa : null, lado: c ? c.lado : null };
    }).filter(Boolean);

    const sum = k => util.r2(filas.reduce((a, f) => a + f[k], 0));
    const tS = sum('sector'), tG = sum('gestion'), tPS = sum('presSector'), tPG = sum('presGestion');
    const sinExplicar = filas.filter(f => Math.abs(f.dif) >= MINIMO && !f.causa);
    if (sinExplicar.length) log('   ! cruce ' + corto + ' · ' + s.nom + ': ' + sinExplicar.map(f => f.g + ' ' + M(f.dif)).join(', ') + ' sin explicación cargada');
    salida.push({
      nom: s.nom, cc: s.cc, filas,
      tPresSector: tPS, tPresGestion: tPG, difPres: util.r2(tPG - tPS),
      tSector: tS, tGestion: tG, dif: util.r2(tG - tS),
    });
  });
  return salida;
}

/* ═══════════════════ extractor ══════════════════════════════════════════ */

async function actualizar({ leer, escribir, log, util, descargas, carpetas }) {
  const XLSX = require('xlsx');
  const dirs = carpetas && carpetas.length ? carpetas : [descargas];

  /* ---- 1. los meses que hay ---------------------------------------------- */
  // Cada mes es una carpeta propia de SharePoint con su archivo de gasto. Se
  // leen todos los que estén: el más nuevo es el mes analizado y el anterior
  // queda para comparar.
  const archivos = archivosDeGasto(dirs);
  if (!archivos.length) throw new Error('no encuentro ningún archivo de gasto ("INFO <MES> <AÑO> …" ni "presupuesto <mes> <año>")');
  log('   meses con archivo de gasto: ' + archivos.map(a => a.etiqueta).join(', '));

  // Diccionarios compartidos por todos los meses.
  const nombreCC = {}, codigoDe = {}, aliasCC = {};
  const alias = (cc, nom) => { (aliasCC[cc] = aliasCC[cc] || new Set()).add(txt(nom) || cc); };
  Object.entries(ALIAS).forEach(([cc, noms]) => noms.forEach(n => alias(cc, n)));
  const porNombre = nom => codigoDe[txt(nom).toUpperCase()] || txt(nom);

  const meses = [];      // uno por mes leído
  const celdas = {};     // "mesIdx|cc|grupo|ítem" → {nt,con,aju,mo}
  const docs = {};       // un nivel más: "mesIdx|cc|grupo|ítem|comprobante|quién" → importe

  archivos.forEach(a => {
    const xl = leer(a.nombre);
    const mi = meses.length;
    const nueva = !xl.hojas.includes('Hoja1');
    // La hoja de materiales se llamó MATERIALES en julio y MATERIAL en junio.
    const hojaMat = xl.hojas.find(h => /^material(es)?$/i.test(h)) || 'Hoja4';
    const hojaSer = xl.hojas.find(h => /^servicios?$/i.test(h)) || 'Hoja1';

    const noTrans = tabla(xl.filas(hojaSer),
      ['Código Centro Costo', 'Denominación', 'Descripción Rubro', 'Neto Item Moneda Pesos']);
    const consumos = tabla(xl.filas(hojaMat),
      ['Código Rubro', 'Centro Costo Destino', 'Precio Total Pesos']);
    const ajustes = nueva ? null : tabla(xl.filas('Hoja2'),
      ['Código Rubro', 'Centro costo Destino', 'Precio Total Pesos']);

    // El mes sale del devengado manual, que reimputa al mes de la operación las
    // facturas que llegan después. La columna se llamó "Periodo Devengado
    // Manual" en julio y "DEVENGADO MANUAL" en junio.
    const colManual = ['Periodo Devengado Manual', 'DEVENGADO MANUAL'].find(n => noTrans.tiene(n));
    const colMes = noTrans.col(colManual || 'Periodo Devengado');
    const mes = mesDominante(noTrans.datos.map(colMes));
    const etiqueta = etiquetaDe(mes);
    log('\n   ' + etiqueta + ' · ' + xl.ruta.split(/[\\/]/).pop());
    log('     hojas ' + hojaSer + ' + ' + hojaMat + ' · mes por ' + (colManual || 'Periodo Devengado'));

    const ccCod = noTrans.col('Código Centro Costo'), ccNom = noTrans.col('Denominación');
    noTrans.datos.forEach(r => {
      const cod = txt(ccCod(r)), nom = txt(ccNom(r));
      if (cod && nom && cod !== nom && /^[A-Z]{1,6}$/.test(cod)) {
        codigoDe[nom.toUpperCase()] = cod;
        if (!nombreCC[cod]) nombreCC[cod] = nom;
        alias(cod, nom);
      }
    });

    const propio = { nt: 0, con: 0, aju: 0, mo: 0 };
    const fuera = {};   // lo que cae en el grupo excluido, sólo para poder informarlo
    const sumar = (cc, grupo, det, campo, v) => {
      if (grupo === FUERA) { fuera[campo] = (fuera[campo] || 0) + v; return; }
      const k = cc || SIN_CENTRO;
      if (!nombreCC[k]) nombreCC[k] = k;
      alias(k, nombreCC[k]);
      propio[campo] += v;
      const key = mi + '|' + k + '|' + grupo + '|' + det;
      if (!celdas[key]) celdas[key] = { nt: 0, con: 0, aju: 0, mo: 0 };
      celdas[key][campo] += v;
    };
    // Un nivel más abajo: el comprobante que forma cada ítem, para poder abrir
    // la diferencia contra el mes anterior hasta la factura. La clave usa el
    // MISMO ítem que `sumar`, o los dos niveles no se encuentran.
    const documento = (cc, grupo, det, etiqueta, quien, v) => {
      const k = (cc || SIN_CENTRO) + '|' + grupo + '|' + det + '|' + txt(etiqueta) + '|' + txt(quien);
      const key = mi + '|' + k;
      docs[key] = (docs[key] || 0) + v;
    };

    {
      const rub = noTrans.col('Código Rubro'), sub = noTrans.col('Código Sub Rubro');
      const subN = noTrans.col('Descripción Sub Rubro'), rubN = noTrans.col('Descripción Rubro');
      const imp = noTrans.col('Neto Item Moneda Pesos');
      const todas = noTrans.datos.filter(r => txt(ccNom(r)));
      const delMes = todas.filter(r => periodo(colMes(r)) === mes);
      if (todas.length !== delMes.length) log('     · servicios: ' + (todas.length - delMes.length) + ' de ' + todas.length + ' filas no son de ' + etiqueta);
      const cTipo=noTrans.tiene('Tipo Comprobante')?noTrans.col('Tipo Comprobante'):null;
      const cLetra=noTrans.tiene('Letra')?noTrans.col('Letra'):null;
      const cNro=noTrans.tiene('Nro. Comprobante')?noTrans.col('Nro. Comprobante'):null;
      const cProv=noTrans.tiene('Proveedor')?noTrans.col('Proveedor'):null;
      delMes.forEach(r => {
        const cc=porNombre(ccNom(r)), g=grupoDe(txt(rub(r)), txt(sub(r)), nueva), det=txt(subN(r)) || txt(rubN(r)), v=gasto(imp(r));
        sumar(cc, g, det, 'nt', v);
        const comp=[cTipo&&txt(cTipo(r)), cLetra&&txt(cLetra(r)), cNro&&txt(cNro(r))].filter(Boolean).join(' ');
        documento(cc, g, det, comp || '(sin comprobante)', cProv?txt(cProv(r)):'', v);
      });
    }
    {
      const rub = consumos.col('Código Rubro'), sub = consumos.col('Código Subrubro');
      const subN = consumos.col('Subrubro'), rubN = consumos.col('Rubro');
      const dest = consumos.col('Centro Costo Destino'), imp = consumos.col('Precio Total Pesos');
      const todas = consumos.datos.filter(r => txt(rub(r)));
      const conDestino = todas.filter(r => txt(dest(r)));
      if (todas.length !== conDestino.length) log('     · materiales: ' + (todas.length - conDestino.length) + ' de ' + todas.length + ' filas sin centro de costo destino');
      const mDesc=consumos.tiene('Descripción Material')?consumos.col('Descripción Material'):null;
      const mOrig=consumos.tiene('Centro Costo Origen')?consumos.col('Centro Costo Origen'):null;
      conDestino.forEach(r => {
        const cc=txt(dest(r)), g=grupoDe(txt(rub(r)), txt(sub(r))), det=txt(subN(r)) || txt(rubN(r)), v=gasto(imp(r));
        sumar(cc, g, det, 'con', v);
        documento(cc, g, det, mDesc?txt(mDesc(r)):'(sin material)', mOrig?('almacén '+txt(mOrig(r))):'', v);
      });
    }
    if (ajustes) {
      const rub = ajustes.col('Código Rubro'), subN = ajustes.col('Subrubro'), rubN = ajustes.col('Rubro');
      const dest = ajustes.col('Centro costo Destino'), imp = ajustes.col('Precio Total Pesos');
      ajustes.datos.filter(r => txt(rub(r))).forEach(r =>
        sumar(txt(dest(r)), grupoDe(txt(rub(r)), txt(rub(r))), txt(subN(r)) || txt(rubN(r)), 'aju', gasto(imp(r))));
    }

    // Control: la tabla dinámica de consumos por centro que la propia hoja de
    // materiales trae al costado, sin encabezado.
    let suyo = 0;
    xl.filas(hojaMat).forEach(r => {
      const et = txt(r[r.length - 3]);
      if (et && /^[A-Z]{2,5}$/.test(et)) suyo += gasto(r[r.length - 1]);
    });
    if (suyo && Math.abs((propio.con - suyo) / suyo) > 0.005) log('     ! materiales: el detalle da ' + M(propio.con) + ' y el total del archivo ' + M(suyo));
    else if (suyo) log('     ✓ materiales: ' + M(propio.con) + ' — cierra contra el total del archivo');
    else log('     · materiales: ' + M(propio.con) + ' — el archivo no trae total de control');

    const dejado = Object.values(fuera).reduce((x, y) => x + y, 0);
    if (Math.abs(dejado) >= MINIMO) log('     · ' + FUERA + ': ' + M(dejado) + ' fuera de las cuentas, por decisión');
    meses.push({ mes, etiqueta, archivo: a.nombre, presentacion: nueva ? 'nueva' : 'vieja', propio, sumar });
  });

  /* ---- 2. mano de obra ---------------------------------------------------- */
  // Un solo archivo con una hoja por mes: sirve para todos los meses leídos.
  let archivoMO = null;
  try { archivoMO = archivoDelMes(dirs, PATRONES_MO, 'mano de obra ("COSTOS Mano de Obra <mes> <año>")'); }
  catch (e) { log('\n   ! ' + e.message + ' — el tablero queda sin mano de obra'); }
  if (archivoMO) {
    const rutaMO = leer(archivoMO).ruta;
    log('\n   mano de obra: ' + rutaMO.split(/[\\/]/).pop());
    const wbMO = XLSX.readFile(rutaMO, { cellDates: true });
    meses.forEach(m => {
      const nm = MESES[+m.mes.slice(0, 2) - 1] + '-' + m.mes.slice(5);
      const hoja = wbMO.SheetNames.find(s => s.trim().toUpperCase() === nm.toUpperCase());
      if (!hoja) { log('     ! ' + m.etiqueta + ': no encuentro la hoja "' + nm + '"'); return; }
      const d = leerHojaMO(wbMO.Sheets[hoja], XLSX, log, hoja);
      if (!d) return;
      if (Math.abs(d.subtotal - d.partesSubtotal) > 1)
        log('     ! ' + m.etiqueta + ': ' + MO_SUBTOTAL_EVENTUAL.col + ' dejó de ser el subtotal de ' + MO_SUBTOTAL_EVENTUAL.partes.join('+'));
      const suma = d.offal + d.eventual;
      if (d.totalPlanilla && Math.abs(suma - d.totalPlanilla) / d.totalPlanilla > 0.005)
        log('     ! ' + m.etiqueta + ': el desglose da ' + M(suma) + ' y la columna ' + MO_TOTAL + ' ' + M(d.totalPlanilla));
      else log('     ✓ ' + m.etiqueta + ': ' + M(suma) + ' — cierra contra la columna ' + MO_TOTAL);
      Object.entries(d.centros).forEach(([cc, c]) => {
        // El archivo de MO es el único que nombra a los centros que sólo
        // aparecen como código en el de gasto (COMP, LAVC…).
        if (!nombreCC[cc] || nombreCC[cc] === cc) nombreCC[cc] = c.nom;
        alias(cc, c.nom);
        MO_OFFAL.forEach(L => { if (c.items[L]) m.sumar(cc, 'MO PROPIA', d.titulo(L), 'mo', c.items[L]); });
        MO_EVENTUAL.forEach(L => { if (c.items[L]) m.sumar(cc, 'MO EVENTUAL', d.titulo(L), 'mo', c.items[L]); });
      });
    });
  }

  /* ---- 3. presupuestado y gerencias --------------------------------------- */
  const pres = leerPresupuestado(dirs, leer, log, util, aliasCC);
  const ultimo = meses[meses.length - 1];
  if (pres) {
    const i = pres.meses.findIndex(m => m.mes === ultimo.mes);
    const tot = i < 0 ? 0 : pres.filas.filter(f => f[0] === i).reduce((a, f) => a + f[3], 0);
    log('   ✓ presupuestado: ' + pres.meses.length + ' meses · ' + pres.gerencias.length + ' gerencia(s) · ' +
      pres.gerencias.reduce((a, g) => a + g.ccs.length, 0) + ' sectores · ' + M(tot) + ' en ' + ultimo.etiqueta);
  }

  /* ---- 4. payload --------------------------------------------------------- */
  // Una fila por celda con movimiento: [mes, centro, grupo, ítem, nt, con, aju, mo].
  // Formato posicional a propósito: con nombres de campo el literal se iba a más
  // del doble, y el tablero es el único que lo lee.
  const filas = Object.entries(celdas)
    .map(([k, v]) => {
      const [mi, cc, g, det] = k.split('|');
      return [+mi, cc, GRUPOS.indexOf(g), det, util.r2(v.nt), util.r2(v.con), util.r2(v.aju), util.r2(v.mo)];
    })
    .filter(f => f[2] >= 0 && Math.abs(f[4] + f[5] + f[6] + f[7]) >= 1)
    .sort((a, b) => a[0] - b[0] || a[2] - b[2] || (b[4] + b[5] + b[6] + b[7]) - (a[4] + a[5] + a[6] + a[7]));

  // Catálogo de centros: los que tuvieron gasto en algún mes, más los que sólo
  // tienen partida presupuestaria (un presupuesto sin ejecutar es una desviación).
  const conGasto = {};
  filas.forEach(f => { conGasto[f[1]] = (conGasto[f[1]] || 0) + f[4] + f[5] + f[6] + f[7]; });
  const lista = Object.keys(conGasto)
    .filter(cc => Math.abs(conGasto[cc]) >= MINIMO)
    .map(cc => ({ cc, nom: nombreCC[cc] || cc }))
    .sort((a, b) => conGasto[b.cc] - conGasto[a.cc]);
  if (pres) Object.keys(pres.soloPresupuesto || {}).forEach(cc => {
    if (!lista.some(x => x.cc === cc)) lista.push({ cc, nom: pres.soloPresupuesto[cc] });
  });
  const vivos = new Set(lista.map(x => x.cc));
  const filasVivas = filas.filter(f => vivos.has(f[1]));

  // Un nivel más abajo: [mes, centro, grupo, ítem, comprobante, quién, importe].
  // Los fletes de Logística NO se publican: se analizan por viaje y por tonelada
  // en la ventana Métrica de Fletes, no factura por factura (ningún fletero
  // factura por mes, así que la factura suelta no dice nada). La mano de obra
  // tampoco tiene: sale de un modelo de costo, no de comprobantes.
  const comprobantes = Object.entries(docs)
    .map(([k, v]) => {
      const [mi2, cc, g, det, doc, quien] = k.split('|');
      return [+mi2, cc, GRUPOS.indexOf(g), det, doc, quien, util.r2(v)];
    })
    .filter(f => vivos.has(f[1]) && f[2] >= 0 && Math.abs(f[6]) >= 1)
    .filter(f => !(f[1] === 'LOG' && GRUPOS[f[2]] === 'FLETES'))
    .sort((a, b) => a[0] - b[0] || Math.abs(b[6]) - Math.abs(a[6]));

  // Un cruce por mes leído, para poder mirar junio igual que julio.
  const cruce = meses.map((m, mIdx) => cruzarMes(util, m.etiqueta,
    cc => {
      const r = {};
      filasVivas.filter(f => f[0] === mIdx && f[1] === cc).forEach(f => {
        const g = GRUPOS[f[2]];
        r[g] = (r[g] || 0) + f[4] + f[5] + f[6] + f[7];
      });
      return r;
    },
    cc => {
      const r = {};
      if (!pres) return r;
      const pm = pres.meses.findIndex(x => x.mes === m.mes);
      if (pm < 0) return r;
      pres.filas.filter(f => f[0] === pm && f[1] === cc).forEach(f => {
        r[GRUPOS[f[2]]] = (r[GRUPOS[f[2]]] || 0) + f[3];
      });
      return r;
    }, log));

  const DATA = {
    meses: meses.map(m => ({
      mes: m.mes, etiqueta: m.etiqueta, archivo: m.archivo, presentacion: m.presentacion,
      compon: { nt: util.r2(m.propio.nt), con: util.r2(m.propio.con), aju: util.r2(m.propio.aju), mo: util.r2(m.propio.mo) },
      total: util.r2(m.propio.nt + m.propio.con + m.propio.aju + m.propio.mo),
    })),
    i: meses.length - 1,
    grupos: GRUPOS,
    centros: lista,
    filas: filasVivas,
    docs: comprobantes,
    cruce,
    pres,
  };

  const viejo = util.actual(DESTINO, 'DATA');
  if (viejo && viejo.centros && viejo.meses && viejo.meses.length === DATA.meses.length)
    util.comparar('centros', viejo.centros, lista, 'cc');
  else if (viejo && viejo.centros) log('   · cambió la cantidad de meses: no se compara contra lo ya cargado');
  escribir(DESTINO, 'DATA', DATA);
  DATA.meses.forEach(m => log('   ' + m.etiqueta + ': ' + M(m.total)));
  log('   ' + lista.length + ' centros · ' + filasVivas.length + ' celdas · ' + comprobantes.length + ' comprobantes en ' + meses.length + ' meses');
}

module.exports = { actualizar };
