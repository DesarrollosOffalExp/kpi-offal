import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { CHART_COLORS, ejeStyle, tooltipStyle } from './charts/theme';

/**
 * Renderiza un gráfico del tablero (línea multi-serie o barras) a la altura dada.
 * Se usa tanto en la grilla del sector como ampliado en el modal.
 *   g.tipo 'line' → { periodos, series:[{nombre, datos}] }
 *   g.tipo 'bar'  → { datos:[{nombre, valor}] }
 */
export default function Chart({ g, height = 260 }) {
  if (g.tipo === 'line') {
    const data = g.periodos.map((p, i) => {
      const row = { periodo: p };
      g.series.forEach((s) => { row[s.nombre] = s.datos[i]; });
      return row;
    });
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#233149" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="periodo" {...ejeStyle} />
          <YAxis {...ejeStyle} domain={['auto', 'auto']} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#8a97ad' }} />
          {g.series.map((s, i) => (
            <Line key={s.nombre} type="monotone" dataKey={s.nombre} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={g.datos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#233149" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="nombre" {...ejeStyle} />
        <YAxis {...ejeStyle} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="valor" radius={[5, 5, 0, 0]}>
          {g.datos.map((_, i) => <Cell key={i} fill={CHART_COLORS[0]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
