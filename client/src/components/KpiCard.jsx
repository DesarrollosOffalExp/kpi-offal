import InfoTip from './InfoTip';
import ExpandButton from './ExpandButton';

function fmt(valor, formato, unidad) {
  if (valor == null || Number.isNaN(valor)) return '—';
  if (formato === 'porcentaje') return `${redondear(valor)}%`;
  if (formato === 'moneda') return `$ ${valor.toLocaleString('es-AR')}`;
  const n = valor.toLocaleString('es-AR');
  return unidad ? `${n} ${unidad}` : n;
}
const redondear = (v) => Math.round(v * 10) / 10;

function Sparkline({ serie }) {
  const vals = serie.map((s) => s.valor).filter((v) => !Number.isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const W = 90, H = 28;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - (v - min) / span * H).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--info)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Tarjeta de un KPI. Muestra siempre la META (objetivo) del indicador, un ícono ⓘ
 * con la ayuda, y un botón para ampliarlo a pantalla grande. Soporta serie temporal
 * (valor + variación + histórico) o valor único con desglose (ej. por turno).
 */
export default function KpiCard({ kpi, onExpand }) {
  const tieneSerie = Array.isArray(kpi.serie) && kpi.serie.length > 0;
  const actual = tieneSerie ? kpi.serie[kpi.serie.length - 1].valor : kpi.valor ?? null;

  let variacion = null, bueno = null;
  if (tieneSerie && kpi.serie.length > 1) {
    const previo = kpi.serie[kpi.serie.length - 2].valor;
    if (previo !== 0) {
      variacion = ((actual - previo) / Math.abs(previo)) * 100;
      const subio = variacion >= 0;
      bueno = kpi.sentido === 'down' ? !subio : subio;
    }
  }

  const metaOk = kpi.meta != null && actual != null
    ? (kpi.sentido === 'down' ? actual <= kpi.meta : actual >= kpi.meta) : null;

  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-titulo">{kpi.titulo}{kpi.info && <InfoTip text={kpi.info} />}</span>
        <div className="kpi-acciones">
          {metaOk != null && <span className={`kpi-meta-badge ${metaOk ? 'ok' : 'off'}`}>{metaOk ? '✓ meta' : 'bajo meta'}</span>}
          <ExpandButton onClick={() => onExpand({ kind: 'kpi', kpi })} />
        </div>
      </div>

      <div className="kpi-valor">{fmt(actual, kpi.formato, kpi.unidad)}</div>

      {kpi.meta != null && (
        <div className="kpi-meta-row">
          <span className="kpi-meta-label">Meta</span>
          <span className="kpi-meta-val">{fmt(kpi.meta, kpi.formato, kpi.unidad)}</span>
        </div>
      )}

      <div className="kpi-foot">
        {variacion != null ? (
          <>
            <span className={`kpi-var ${bueno ? 'up' : 'down'}`}>{variacion >= 0 ? '▲' : '▼'} {Math.abs(redondear(variacion))}%</span>
            <span className="kpi-var-lbl">vs. período anterior</span>
            <span className="kpi-spark"><Sparkline serie={kpi.serie} /></span>
          </>
        ) : kpi.desglose?.length ? (
          <div className="desglose">
            {kpi.desglose.map((d) => (
              <span className="desglose-chip" key={d.nombre}>{d.nombre} <b>{fmt(d.valor, kpi.formato, kpi.unidad)}</b></span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
