import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CHART_COLORS, ejeStyle, tooltipStyle } from './theme';

/**
 * Evolución mensual de los KPIs del sector, REBASADOS a índice 100 en el primer
 * período. Así se comparan indicadores con unidades distintas (%, toneladas,
 * horas) en un mismo gráfico: 100 = valor inicial, >100 subió, <100 bajó.
 */
export default function TrendChart({ periodos, kpis }) {
  if (!kpis?.length || !periodos?.length) return null;

  const data = periodos.map((p, i) => {
    const row = { periodo: p };
    kpis.forEach((k) => {
      const base = k.serie?.[0]?.valor;
      const v = k.serie?.[i]?.valor;
      if (base && v != null && !Number.isNaN(v)) row[k.titulo] = Math.round((v / base) * 1000) / 10;
    });
    return row;
  });

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Evolución mensual</h3>
        <span className="panel-sub">Índice base 100 (primer período)</span>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#233149" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="periodo" {...ejeStyle} />
            <YAxis {...ejeStyle} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8a97ad' }} />
            {kpis.map((k, i) => (
              <Line
                key={k.id}
                type="monotone"
                dataKey={k.titulo}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
