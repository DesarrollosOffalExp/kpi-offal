// Presentación gerencial · Gerencia de Gestión.
// Sale del PowerPoint que la Gerencia arma cada corte: "Tablero de Control
// General - Corte <fecha>.pptx", en SharePoint · Gerencia de Gestión.
//
// Un .pptx es un zip de XML. No hace falta una librería nueva: el módulo CFB que
// ya trae `xlsx` lo abre. De ahí salen dos cosas:
//   · los GRÁFICOS (ppt/charts/chartN.xml), que tienen las series con sus
//     categorías y valores — son los números de verdad, no una imagen;
//   · el TEXTO de cada diapositiva (ppt/slides/slideN.xml), de donde salen los
//     comentarios, el plan de acción y los porcentajes de desvío que la Gerencia
//     escribe a mano.
//
// El orden de los gráficos no es estable entre cortes, así que NO se los toma por
// número: cada uno se reconoce por el nombre de sus series y por sus categorías.
// Si un corte nuevo cambia la forma, la corrida lo avisa en vez de cargar
// cualquier cosa.

const fs = require('fs');
const path = require('path');

const DESTINO = 'client/src/dashboards/gestion-presentacion.html';
const PATRON = /^Tablero de Control General.*\.pptx$/i;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const txt = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
const desescapar = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
// El archivo escribe los millones como "MM" (el eje de los gráficos usa #,##0,," MM").
const M = v => (v / 1e6).toFixed(1).replace('.', ',') + ' MM';

/* ═══════════════════ abrir el pptx ═══════════════════════════════════════ */

/** Devuelve { 'ppt/charts/chart1.xml': '<xml…>', … } leyendo el zip con CFB. */
function abrirPptx(ruta) {
  const XLSX = require('xlsx');
  const cfb = XLSX.CFB.read(fs.readFileSync(ruta), { type: 'buffer' });
  const partes = {};
  cfb.FullPaths.forEach((p, i) => {
    const rel = p.replace(/^Root Entry\//, '');
    // Los .rels de cada diapositiva dicen qué gráficos cuelgan de ella: es lo que
    // ata cada gerencia a SUS dos gráficos y no al que venga en el orden del zip.
    if (!/^ppt\/(charts\/chart\d+\.xml|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels)$/.test(rel)) return;
    const c = cfb.FileIndex[i] && cfb.FileIndex[i].content;
    if (c) partes[rel] = Buffer.from(c).toString('utf8');
  });
  return partes;
}

/** Los párrafos de texto de una diapositiva, en orden. */
function parrafos(xml) {
  return xml.split('<a:p>').slice(1)
    .map(b => desescapar([...b.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1]).join('')).trim())
    .filter(Boolean);
}

/** Las series de un gráfico: [{ nombre, cats:[…], vals:[…] }]. */
function series(xml) {
  const puntos = (bloque, tag) => {
    const m = bloque.match(new RegExp('<c:' + tag + '>([\\s\\S]*?)</c:' + tag + '>'));
    if (!m) return [];
    const a = [];
    [...m[1].matchAll(/<c:pt idx="(\d+)"[^>]*>\s*<c:v>([\s\S]*?)<\/c:v>/g)]
      .forEach(x => { a[+x[1]] = desescapar(x[2]); });
    return a;
  };
  return xml.split('<c:ser>').slice(1).map(b => ({
    nombre: desescapar((b.match(/<c:tx>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>/) || [, ''])[1]).trim(),
    cats: puntos(b, 'cat'),
    vals: puntos(b, 'val').map(v => v === '' || v == null ? null : +v),
  }));
}
const titulo = xml => desescapar([...((xml.match(/<c:title>[\s\S]*?<\/c:title>/) || [''])[0])
  .matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m => m[1]).join('')).trim();

/* ═══════════════════ lectura ═════════════════════════════════════════════ */

const num = s => {
  const m = txt(s).replace(/\./g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? +m[0] : null;
};

/** Las cinco gerencias, en el orden en que están en la presentación. Cada una
 *  tiene dos gráficos: la serie mensual (Presupuesto/Gasto/Desvío) y la apertura
 *  por sector, que se reconoce por el título. */
const GERENCIAS = [
  { clave: 'Mantenimiento', titulo: 'Gerencia de Mantenimiento' },
  { clave: 'Operaciones', titulo: 'Gerencia de Operaciones' },
  { clave: 'Producción, SHE y medio ambiente', titulo: 'Gerencia de Produccion' },
  { clave: 'Calidad', titulo: 'Gerencia de Calidad' },
  { clave: 'RRHH', titulo: 'Gerencia de RRHH' },
];

function archivo(dirs) {
  const c = [];
  dirs.forEach(d => fs.readdirSync(d).forEach(f => {
    if (PATRON.test(f) && !/^~\$/.test(f)) c.push({ p: path.join(d, f), f, t: fs.statSync(path.join(d, f)).mtimeMs });
  }));
  if (!c.length) return null;
  c.sort((a, b) => b.t - a.t);           // el corte más nuevo
  return c[0];
}

async function actualizar({ escribir, log, util, descargas, carpetas }) {
  const dirs = carpetas && carpetas.length ? carpetas : [descargas];
  const arch = archivo(dirs);
  if (!arch) { log('   ! no encuentro ningún "Tablero de Control General ….pptx"'); return; }
  log('   presentación: ' + arch.f);

  const partes = abrirPptx(arch.p);
  const charts = Object.keys(partes).filter(k => k.includes('/charts/'));
  const slides = Object.keys(partes).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
  log('   ' + slides.length + ' diapositivas · ' + charts.length + ' gráficos');

  const todos = charts.map(k => ({ k, tit: titulo(partes[k]), ser: series(partes[k]) }));
  /** Los gráficos que cuelgan de una diapositiva, según su .rels. */
  const graficosDe = slide => {
    const rels = partes['ppt/slides/_rels/' + path.basename(slide) + '.rels'] || '';
    return [...rels.matchAll(/charts\/(chart\d+)\.xml/g)]
      .map(m => todos.find(g => g.k === 'ppt/charts/' + m[1] + '.xml')).filter(Boolean);
  };
  /** Busca un gráfico por título o por los nombres de sus series. */
  const buscar = (pred, queEs) => {
    const g = todos.find(pred);
    if (!g) log('   ! no encuentro el gráfico de ' + queEs);
    return g;
  };
  const porSerie = (...noms) => g => noms.every(n => g.ser.some(s => s.nombre.toLowerCase().includes(n)));
  const porTitulo = t => g => g.tit.toLowerCase().includes(t.toLowerCase());

  /* --- portada y KPIs, que se repiten en todas las diapositivas --- */
  const texto = slides.map(s => parrafos(partes[s]));
  const corte = (texto[0] || []).find(t => /corte/i.test(t)) || '';

  // La tabla de KPI aparece igual en varias diapositivas: KPI / Actual / Target /
  // Mes / Acumulado prom. / Mensual y después las filas de a cuatro.
  let kpis = [];
  for (const p of texto) {
    const i = p.indexOf('Mensual');
    if (i < 0 || !p.includes('KPI')) continue;
    const resto = p.slice(i + 1);
    for (let j = 0; j + 3 < resto.length + 1; j += 4) {
      const [k, a, b, c] = resto.slice(j, j + 4);
      // La tabla termina donde arranca el plan de acción: los KPI son etiquetas
      // cortas con tres números al lado, no oraciones.
      if (!k || a == null || /^Plan de Acci/i.test(k) || k.length > 34) break;
      kpis.push({ kpi: k, mes: a, acum: b, target: c });
    }
    if (kpis.length) break;
  }
  log('   KPI del corte: ' + (kpis.map(k => k.kpi + ' ' + k.mes).join(' · ') || '(no los encontré)'));

  // "PROM. +1,4%" al pie del gráfico de presupuesto vs real, y la NOTA del recupero.
  const plano = texto.flat();
  const promVar = (plano.find(t => /^PROM\./i.test(t)) || '').replace(/^PROM\.\s*/i, '');
  const nota = plano.find(t => /^NOTA:/i.test(t)) || '';
  // Las seis tarjetas del recupero: la etiqueta y, en el párrafo siguiente, el
  // valor en USD/Tn. Se leen de la diapositiva del recupero, la única que las tiene.
  const tarjetas = [];
  const slRec = texto.find(x => x.some(t => /^Recupero sin Capex/i.test(t))) || [];
  for (let k = 0; k < slRec.length - 1; k++) {
    const et = slRec[k], val = slRec[k + 1];
    if (!/^(gasto|recupero total|saldo final)/i.test(et)) continue;
    if (!/USD/i.test(val)) continue;
    tarjetas.push({ l: et, v: val });
  }

  // El plan general vive en la diapositiva de KPI. Se descartan los títulos de los
  // gráficos, que en el XML quedan sueltos como un párrafo más y si no se cuelan
  // al final de la lista. Se suma el título del macro, que es una imagen y por eso
  // no figura entre los gráficos.
  const titulos = new Set(todos.map(g => (g.tit || '').trim().toLowerCase()).filter(Boolean));
  try {
    const mg = require('../macro-gestion.json');
    [mg.anual, mg.bienal].forEach(g => g && g.titulo && titulos.add(g.titulo.trim().toLowerCase()));
  } catch (e) {}
  const slPlan = texto.find(p => p.includes('Plan de Acción')) || [];
  const planGeneral = slPlan.slice(slPlan.indexOf('Plan de Acción') + 1)
    .filter(t => t.length > 25 && !/^KPI$|^Actual$|^Target$/.test(t))
    .filter(t => !titulos.has(t.trim().toLowerCase()));

  /* --- gráficos generales --- */
  const gPvR = buscar(porSerie('presupuesto', 'gasto real'), 'Presupuesto vs Real');
  const gCosto = buscar(porTitulo('Sin Capex'), 'Costo x Tn sin capex');
  const gCapex = buscar(porTitulo('Con Capex'), 'Costo x Tn con capex');
  const gUsd = buscar(porTitulo('USD por tonelada'), 'USD por tonelada');
  const gTn = ['Menudencia', 'Carne', 'Ctas ctes frescos', 'Super']
    .map(t => ({ t, g: todos.find(porTitulo(t + ' mensual')) }));

  const meses = (gPvR && gPvR.ser[0] ? gPvR.ser[0].cats : MESES.slice(0, 7)).filter(Boolean);
  const serie = (g, i) => g && g.ser[i] ? g.ser[i].vals.slice(0, meses.length).map(util.r2) : [];
  /** Igual, pero para las series que vienen como fracción y se muestran en %. */
  const pct = (g, i) => g && g.ser[i]
    ? g.ser[i].vals.slice(0, meses.length).map(v => v == null ? null : util.r2(v * 100)) : [];

  /* --- una sección por gerencia --- */
  const gerencias = GERENCIAS.map((G, idx) => {
    // la diapositiva cuyo primer párrafo es el nombre de la gerencia
    const iSlide = texto.findIndex(t => t[0] && t[0].toLowerCase().startsWith(G.clave.slice(0, 9).toLowerCase()));
    const p = iSlide >= 0 ? texto[iSlide] : [];
    const trasComentarios = p.indexOf('Comentarios');
    const iPlan = p.indexOf('Plan de Acción');
    // Los comentarios van entre "Comentarios" y "Plan de Acción": si no se corta ahí,
    // los puntos del plan se repiten también como comentario.
    const comentarios = trasComentarios >= 0
      ? p.slice(trasComentarios + 1, iPlan > trasComentarios ? iPlan : undefined)
        .filter(t => t.length > 40).slice(0, 3) : [];
    // El plan es lo que sigue a "Plan de Acción", menos las cifras que la
    // diapositiva dibuja al costado (el peso sobre PB y su alerta), que van en
    // su propio lugar y si no aparecen dos veces.
    const plan = iPlan >= 0 ? p.slice(iPlan + 1)
      .filter(t => t.length > 15 && !/peso sobre PB|clase mundial|Alerta/i.test(t)) : [];
    const buscarEn = re => p.find(t => re.test(t)) || '';
    // Viene como "-6,90%/ Mes" en unas diapositivas y "+10,42%" en otras.
    const desvioMes = buscarEn(/^[+-]?\d+[,.]\d+%/).replace(/\s*\/\s*Mes\s*$/i, '');
    const acumulado = buscarEn(/^Acumulado/);
    const monto = buscarEn(/^AR\$/);
    const peso = buscarEn(/peso sobre PB/i);
    const alerta = buscarEn(/clase mundial|Alerta/i);

    // Los dos gráficos salen de la propia diapositiva: el de la serie mensual (el
    // que trae "Desvío %") y el de la apertura, que es el titulado. Antes se los
    // tomaba por orden de aparición en el zip y cada gerencia terminaba con la
    // serie de la siguiente.
    const propios = iSlide >= 0 ? graficosDe(slides[iSlide]) : [];
    const gSerie = propios.find(g => g.ser.some(s => /desv/i.test(s.nombre)));
    const gSect = propios.find(g => /^gerencia de/i.test(g.tit)) || todos.find(porTitulo(G.titulo));
    if (!gSerie) log('   ! ' + G.clave + ': no encuentro su serie mensual');
    if (!gSect) log('   ! ' + G.clave + ': no encuentro su apertura por sector');

    const sectores = gSect
      ? (gSect.ser.find(s => /diferencia/i.test(s.nombre)) || gSect.ser[gSect.ser.length - 1])
      : null;
    // La cifra que la Gerencia escribe a mano en la tarjeta (AR$ …MM) tiene que
    // dar lo mismo que el último mes del gráfico. Cuando no da, es el archivo el
    // que no cierra consigo mismo: se avisa y se muestran las dos.
    let aviso = '';
    if (gSerie && monto) {
      const ultimo = gSerie.ser[1] && gSerie.ser[0]
        ? gSerie.ser[1].vals[meses.length - 1] - gSerie.ser[0].vals[meses.length - 1] : null;
      const escrito = num(monto.replace(/AR\$/i, ''));
      if (ultimo != null && escrito != null && Math.abs(ultimo / 1e6 - escrito) > 1) {
        aviso = 'La tarjeta dice ' + monto + ' y el gráfico da ' + M(ultimo) + '.';
        log('   ! ' + G.clave + ': ' + aviso);
      }
    }
    return {
      nom: G.clave, aviso,
      desvioMes, acumulado, monto, peso, alerta, comentarios, plan,
      serie: gSerie ? {
        presup: serie(gSerie, 0), gasto: serie(gSerie, 1),
        // El desvío viene como fracción (0,069). Se guarda ya en porcentaje: con
        // util.r2 sobre la fracción quedaba -0,07 y la ventana mostraba -7,00%
        // donde la filmina dice -6,90%.
        desvio: pct(gSerie, 2), promedio: gSerie.ser[3] ? util.r2(gSerie.ser[3].vals.find(v => v != null) * 100) : null,
        promLbl: gSerie.ser[3] ? gSerie.ser[3].nombre : '',
      } : null,
      sectores: sectores ? sectores.cats.map((c, i) => ({ s: c, v: util.r2(sectores.vals[i]) }))
        .filter(x => x.s && x.v != null).sort((a, b) => b.v - a.v) : [],
    };
  });

  const DATA = {
    archivo: arch.f, corte, meses, kpis, planGeneral, promVar, nota, tarjetas,
    // El gráfico macro de la presentación es una imagen sin datos: sus números
    // se cargan a mano en tools/macro-gestion.json.
    macro: (() => { try { return require('../macro-gestion.json'); } catch (e) { return null; } })(),
    pvr: gPvR ? {
      presup: serie(gPvR, 0), real: serie(gPvR, 1),
      dif: serie(gPvR, 2), varPct: pct(gPvR, 3),
    } : null,
    // La segunda serie del gráfico de costo son las toneladas totales dibujadas
    // en escala 1:10 para que entren con los USD/tn. Se devuelven en toneladas.
    costo: gCosto ? {
      sinCapex: serie(gCosto, 0),
      conCapex: gCapex ? serie(gCapex, 0) : [],
      toneladas: serie(gCosto, 1).map(v => v == null ? null : util.r2(v * 10)),
    } : null,
    usd: gUsd ? {
      gasto: serie(gUsd, 0), rec1: serie(gUsd, 1), rec2: serie(gUsd, 2), total: serie(gUsd, 3),
    } : null,
    toneladas: gTn.filter(x => x.g).map(x => ({ nom: x.t, vals: serie(x.g, 0) })),
    gerencias,
  };

  escribir(DESTINO, 'DATA', DATA);
  log('   corte: "' + corte + '" · ' + meses.length + ' meses · ' + gerencias.length + ' gerencias · ' +
    tarjetas.length + ' tarjetas de recupero' + (promVar ? ' · prom. variación ' + promVar : ''));
  if (!DATA.macro) log('   ! falta tools/macro-gestion.json: la sección de presión macroeconómica queda vacía');
  gerencias.forEach(g => log('     ' + g.nom.padEnd(34) + (g.desvioMes || '—').padEnd(9) +
    (g.sectores.length + ' sectores').padEnd(13) + (g.serie ? 'serie ok' : '! sin serie mensual')));
}

module.exports = { actualizar };
