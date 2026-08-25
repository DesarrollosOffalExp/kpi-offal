#!/usr/bin/env node
// Rehace los datos embebidos de los tableros desde los Excel de SharePoint.
// Uso:  node tools/actualizar.js <grupo> [--dir <carpeta>] [--dry]
// Los grupos y la trazabilidad de cada dato están en tools/fuentes.json.
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const FUENTES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fuentes.json'), 'utf8'));

const args = process.argv.slice(2);
const grupo = args.find(a => !a.startsWith('--'));
const dry = args.includes('--dry');
const dirArg = args.indexOf('--dir');
const DESCARGAS = dirArg >= 0 ? args[dirArg + 1] : FUENTES.descargas;

const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Busca un archivo en la carpeta de descargas tolerando los sufijos del
 *  navegador —"archivo (2).xlsx"— y los espacios de más. Devuelve el más nuevo. */
function buscar(nombre) {
  const base = norm(nombre).replace(/\.xlsx?$/, '');
  const cand = fs.readdirSync(DESCARGAS)
    .filter(f => /\.xlsx?$/i.test(f))
    .filter(f => norm(f).replace(/\.xlsx?$/, '').replace(/\s*\(\d+\)$/, '') === base)
    .map(f => ({ f, t: fs.statSync(path.join(DESCARGAS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!cand.length) throw new Error('no encuentro "' + nombre + '" en ' + DESCARGAS);
  return path.join(DESCARGAS, cand[0].f);
}

/** Lee un xlsx y devuelve helpers de hoja. */
function leer(nombre) {
  const XLSX = require('xlsx');
  const ruta = buscar(nombre);
  const wb = XLSX.readFile(ruta, { cellDates: true });
  return {
    ruta, hojas: wb.SheetNames,
    // filas de una hoja como matriz; acepta nombre exacto o predicado
    filas(hoja) {
      const n = typeof hoja === 'function' ? wb.SheetNames.find(hoja) : hoja;
      const ws = wb.Sheets[n];
      if (!ws) throw new Error(path.basename(ruta) + ': no existe la hoja ' + JSON.stringify(hoja));
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    },
    objetos(hoja) {
      const ws = wb.Sheets[hoja];
      if (!ws) throw new Error(path.basename(ruta) + ': no existe la hoja ' + JSON.stringify(hoja));
      return XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
    },
  };
}

/** Reemplaza `const <nombre>= …;` dentro de un tablero, conservando el resto. */
function escribir(destino, nombre, valor, { re } = {}) {
  const p = path.join(RAIZ, destino);
  let s = fs.readFileSync(p, 'utf8');
  const patron = re || new RegExp('const ' + nombre + '\\s*=\\s*[\\[{][\\s\\S]*?[\\]}]\\s*;');
  const m = s.match(patron);
  if (!m) throw new Error(destino + ': no encuentro la constante ' + nombre);
  const nuevo = 'const ' + nombre + '=' + JSON.stringify(valor) + ';';
  if (dry) { console.log('   [dry] ' + destino + ' · ' + nombre + ' quedaría en ' + nuevo.length + ' bytes'); return; }
  fs.writeFileSync(p, s.replace(m[0], nuevo));
}

const log = (...a) => console.log(...a);

/* ---------- utilidades que comparten los extractores ---------- */
const util = {
  num: v => typeof v === 'number' ? v : null,
  r2: v => v == null ? null : Math.round(v * 100) / 100,
  txt: v => v == null ? null : String(v).replace(/\s+/g, ' ').trim() || null,
  dmy(v) {
    if (v instanceof Date) return String(v.getDate()).padStart(2, '0') + '/' + String(v.getMonth() + 1).padStart(2, '0') + '/' + v.getFullYear();
    if (typeof v === 'number' && v > 40000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
    }
    return v == null || v === '' ? '' : String(v);
  },
  /** Lee la constante que hoy tiene el tablero, para poder comparar. */
  actual(destino, nombre) {
    const s = fs.readFileSync(path.join(RAIZ, destino), 'utf8');
    const m = s.match(new RegExp('const ' + nombre + '\\s*=\\s*([\\[{][\\s\\S]*?[\\]}])\\s*;'));
    return m ? new Function('return ' + m[1])() : null;
  },
  /** Avisa si algo que ya estaba cargado dejó de dar igual. */
  comparar(nombreCorto, viejo, nuevo, clave) {
    if (!viejo) return;
    let distintos = 0;
    viejo.forEach(v => {
      const n = nuevo.find(x => x[clave] === v[clave]);
      if (!n) { log('   ! ' + nombreCorto + ': ya no está ' + v[clave]); distintos++; return; }
      if (JSON.stringify(v) !== JSON.stringify(n)) { log('   ! ' + nombreCorto + ': cambió ' + v[clave]); distintos++; }
    });
    if (!distintos) log('   ✓ ' + nombreCorto + ': lo que ya estaba cargado da igual');
  },
};

/* ---------- main ---------- */
const grupos = FUENTES.grupos;
if (!grupo || !grupos[grupo]) {
  console.log('Uso: node tools/actualizar.js <grupo> [--dir <carpeta>] [--dry]\n');
  console.log('Grupos:');
  Object.keys(grupos).forEach(g => {
    console.log('  ' + g.padEnd(16) + grupos[g].carpeta);
    grupos[g].fuentes.forEach(f => console.log('      · ' + f.id.padEnd(26) + f.archivo));
  });
  console.log('\nLa cuenta de cada dato está en tools/fuentes.json.');
  process.exit(grupo ? 1 : 0);
}

const g = grupos[grupo];
console.log('Grupo ' + grupo + ' · SharePoint / ' + g.carpeta);
console.log('Archivos desde: ' + DESCARGAS + (dry ? '  (dry-run)' : '') + '\n');

let ext;
try { ext = require('./extractores/' + g.extractor); }
catch (e) {
  console.log('Todavía no está escrito el extractor "' + g.extractor + '".');
  console.log('Las fuentes de este grupo, con su cuenta, están descritas en tools/fuentes.json:');
  g.fuentes.forEach(f => console.log('  · ' + f.id + ' ← ' + f.archivo + (f.hojas ? ' · hoja(s) ' + JSON.stringify(f.hojas) : '')));
  process.exit(1);
}

ext.actualizar({ leer, escribir, log, dry, util, fuentes: g.fuentes })
  .then(() => console.log('\nListo.' + (dry ? ' (no se escribió nada)' : '')))
  .catch(e => { console.error('\nError: ' + e.message); process.exit(1); });
