import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS, ejeStyle, tooltipStyle } from './theme';

/**
 * Distribución del sector: dona (participación) o barras (comparativa).
 * `dist` = { titulo, tipo: 'donut'|'bar', datos: [{ nombre, valor }] }.
 */
export default function DistribChart({ dist }) {
  if (!dist?.datos?.length) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{dist.titulo}</h3>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          {dist.tipo === 'donut' ? (
            <PieChart>
              <Pie
                data={dist.datos}
                dataKey="valor"
                nameKey="nombre"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                stroke="#111a2f"
                strokeWidth={2}
              >
                {dist.datos.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          ) : (
            <BarChart data={dist.datos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#233149" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nombre" {...ejeStyle} />
              <YAxis {...ejeStyle} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                {dist.datos.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {dist.tipo === 'donut' && (
        <div className="leyenda">
          {dist.datos.map((d, i) => (
            <span className="leyenda-item" key={i}>
              <span className="leyenda-punto" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              {d.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
