// Paleta y estilos compartidos de los gráficos (Recharts trabaja con colores
// concretos, no con variables CSS, así que se declaran acá alineados a la
// identidad navy + índigo del ecosistema Offal).

export const CHART_COLORS = ['#818cf8', '#26b6d9', '#a5b4fc', '#f59e0b', '#34d399', '#f472b6'];

export const ejeStyle = {
  stroke: '#8a97ad',
  tick: { fill: '#8a97ad', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: '#233149' },
};

export const tooltipStyle = {
  contentStyle: {
    background: '#111a2f',
    border: '1px solid #233149',
    borderRadius: 10,
    color: '#e8edf5',
    fontSize: 13,
  },
  labelStyle: { color: '#8a97ad', marginBottom: 4 },
  itemStyle: { color: '#e8edf5' },
  cursor: { fill: 'rgba(129,140,248,0.08)' },
};
