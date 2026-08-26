// Sistemas · serie semanal de tickets, tickets abiertos y corte por agente.
// La cuenta de cada dato está en tools/fuentes.json.
exports.actualizar = async function ({ leer, escribir, log, util }) {
  const { num } = util;
  const destino = 'client/src/dashboards/kpi-sistemas.html';
  const wb = leer('KPI sistemas.xlsx');

  /* ═══ serie semanal (hoja KPI) ═══ */
  log('· Serie semanal');
  {
    const WK = [], D = { abiertos: [], vencidas: [], sinVencer: [], tickets: [], tratados: [], pendientes: [] };
    wb.filas('KPI').forEach(r => {
      if (!r) return;
      const sem = num(r[8]);                                  // I = Semana
      if (sem == null || num(r[7]) == null) return;           // H = Total de Abiertos
      WK.push(sem);
      D.abiertos.push(num(r[7]) || 0);
      D.vencidas.push(num(r[0]) || 0);
      D.sinVencer.push(num(r[1]) || 0);
      D.tickets.push(num(r[2]) || 0);
      D.tratados.push(num(r[3]) || 0);
      D.pendientes.push(num(r[6]) || 0);
    });
    const viejoWK = util.actual(destino, 'WK') || [];
    const viejoD = util.actual(destino, 'D');
    if (viejoD) {
      const iguales = viejoWK.every((w, i) => Object.keys(D).every(k => viejoD[k][i] === D[k][i]));
      log('   ' + (iguales ? '✓ las semanas ya cargadas dan igual' : '! cambió alguna semana ya cargada'));
    }
    const u = WK.length - 1;
    log('   ' + viejoWK.length + ' → ' + WK.length + ' semanas · S' + WK[u] +
      ': abiertos ' + D.abiertos[u] + ' · vencidas ' + D.vencidas[u] + ' · ingresados ' + D.tickets[u] +
      ' · tratados ' + D.tratados[u] + ' · pendientes ' + D.pendientes[u]);
    escribir(destino, 'WK', WK);
    escribir(destino, 'D', D);
  }

  /* ═══ tickets abiertos (hoja Open) ═══ */
  log('· Tickets abiertos');
  let abiertos = 0;
  {
    const OPEN = [];
    wb.filas('Open').slice(1).forEach(r => {
      if (!r || r[1] == null) return;
      OPEN.push({
        t: String(r[1]), ag: util.txt(r[10]) || 'Sin asignar', sol: util.txt(r[5]) || '',
        a: util.txt(r[8]) || '', fc: util.dmy(r[2]), vm: util.dmy(r[3]) || '-',
        vd: util.dmy(r[4]), sm: num(r[33]) || 0,                // AH = Sin Movimiento
      });
    });
    abiertos = OPEN.length;
    const viejo = util.actual(destino, 'OPEN') || [];
    log('   ' + viejo.length + ' → ' + OPEN.length + ' tickets' +
      (OPEN.some(o => o.ag === 'Sin asignar') ? ' (hay tickets sin colaborador asignado)' : ''));
    escribir(destino, 'OPEN', OPEN);
  }

  /* ═══ por agente (hoja resumen) ═══ */
  log('· Por agente');
  {
    // El nombre del colaborador aparece sólo en la primera fila de su grupo y
    // arrastra hacia abajo; las filas "Total <agente>" cierran cada grupo.
    let ag = null; const g = {}, tot = {};
    wb.filas('resumen').slice(1).forEach(r => {
      if (!r) return;
      const a = util.txt(r[0]) || '';
      if (/^total general/i.test(a)) return;
      if (/^total /i.test(a)) { tot[a.replace(/^total\s+/i, '')] = r[6]; return; }
      if (a) ag = a;
      const asunto = util.txt(r[1]);
      if (ag && asunto) (g[ag] = g[ag] || []).push(asunto);
    });
    const OPERADORES = Object.keys(g).map(n => ({ n, v: g[n].length, tickets: g[n] }))
      .sort((a, b) => b.v - a.v || a.n.localeCompare(b.n));
    OPERADORES.forEach(o => { if (tot[o.n] != null && tot[o.n] !== o.v) log('   ! ' + o.n + ': conté ' + o.v + ' y la hoja dice ' + tot[o.n]); });
    const suma = OPERADORES.reduce((a, o) => a + o.v, 0);
    const D = util.actual(destino, 'D'), WK = util.actual(destino, 'WK');
    const kpi = D && WK ? D.abiertos[WK.length - 1] : null;
    log('   ' + OPERADORES.length + ' agentes · ' + suma + ' tickets' +
      (kpi != null ? (suma === kpi ? ' (= Total de Abiertos)' : ' · el KPI de la semana marca ' + kpi + ', la diferencia son los tickets sin asignar de la hoja Open (' + abiertos + ')') : ''));
    escribir(destino, 'OPERADORES', OPERADORES);
  }
};
