// Paleta y estilos compartidos de los gráficos (Recharts trabaja con colores
// concretos, no con variables CSS, así que se declaran acá alineados a la
// identidad unificada Offal: teal oscuro + rojo de marca + cian).

export const CHART_COLORS = ['#26b6d9', '#c7163a', '#5fcbe6', '#e11f46', '#f5a623', '#2f9e6e'];

export const ejeStyle = {
  stroke: '#8ba0ab',
  tick: { fill: '#8ba0ab', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: '#23353f' },
};

export const tooltipStyle = {
  contentStyle: {
    background: '#12242f',
    border: '1px solid #23353f',
    borderRadius: 10,
    color: '#eef2f5',
    fontSize: 13,
  },
  labelStyle: { color: '#8ba0ab', marginBottom: 4 },
  itemStyle: { color: '#eef2f5' },
  cursor: { fill: 'rgba(199,22,58,0.08)' },
};
