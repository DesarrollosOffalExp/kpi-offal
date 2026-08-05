// Formatea un número según el tipo de KPI.
function fmt(valor, formato, unidad) {
  if (valor == null || Number.isNaN(valor)) return '—';
  if (formato === 'porcentaje') return `${redondear(valor)}%`;
  if (formato === 'moneda') return `$ ${valor.toLocaleString('es-AR')}`;
  const n = valor.toLocaleString('es-AR');
  return unidad ? `${n} ${unidad}` : n;
}
function redondear(v) {
  return Math.round(v * 10) / 10;
}

// Sparkline minimalista (SVG propio, sin dependencias) para el mini-histórico.
function Sparkline({ serie, color }) {
  const vals = serie.map((s) => s.valor).filter((v) => !Number.isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 120;
  const H = 32;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / span) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Tarjeta de un KPI: valor actual, variación vs. período anterior (coloreada
 * según el sentido del indicador), meta y mini-histórico.
 */
export default function KpiCard({ kpi }) {
  const serie = kpi.serie || [];
  const actual = serie.length ? serie[serie.length - 1].valor : null;
  const previo = serie.length > 1 ? serie[serie.length - 2].valor : null;

  let variacion = null;
  let bueno = null;
  if (actual != null && previo != null && previo !== 0) {
    variacion = ((actual - previo) / Math.abs(previo)) * 100;
    const subio = variacion >= 0;
    bueno = kpi.sentido === 'down' ? !subio : subio;
  }

  const metaOk =
    kpi.meta != null && actual != null
      ? kpi.sentido === 'down'
        ? actual <= kpi.meta
        : actual >= kpi.meta
      : null;

  const color = 'var(--primary-bright)';

  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-titulo">{kpi.titulo}</span>
        {metaOk != null && (
          <span className={`kpi-meta-badge ${metaOk ? 'ok' : 'off'}`}>
            {metaOk ? '✓ meta' : 'bajo meta'}
          </span>
        )}
      </div>

      <div className="kpi-valor">{fmt(actual, kpi.formato, kpi.unidad)}</div>

      <div className="kpi-foot">
        {variacion != null ? (
          <span className={`kpi-var ${bueno ? 'up' : 'down'}`}>
            {variacion >= 0 ? '▲' : '▼'} {Math.abs(redondear(variacion))}%
          </span>
        ) : (
          <span className="kpi-var neutro">—</span>
        )}
        {kpi.meta != null && <span className="kpi-meta">meta {fmt(kpi.meta, kpi.formato, kpi.unidad)}</span>}
        <span className="kpi-spark"><Sparkline serie={serie} color={color} /></span>
      </div>
    </div>
  );
}
