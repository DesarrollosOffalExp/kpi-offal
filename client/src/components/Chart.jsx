import { Fragment, useState } from 'react';
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
  const [tip, setTip] = useState(null);
  if (g.tipo === 'tabla') {
    // La tabla admite dos formas:
    //   · plana:      g.filas = [[celda,...], ...]
    //   · por grupos: g.secciones = [{ label, cat, filas:[[...]] }, ...]
    // Los grupos pintan un identificador de color tenue por sección (estilo
    // Matriz de Costo del Excel, pero sobrio) vía la clase cat-<cat>.
    // g.filaTips (alineado a g.filas) muestra un detalle al pasar el mouse.
    const secciones = g.secciones || [{ filas: g.filas || [] }];
    const cols = g.columnas.length;
    return (
      <>
        <div className="tabla-kpi-wrap">
          <table className={`tabla-kpi ${g.wrap ? 'wrap' : ''}`}>
            <thead>
              <tr>{g.columnas.map((c, i) => <th key={i} className={i === 0 ? '' : 'num'}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {secciones.map((sec, si) => (
                <Fragment key={si}>
                  {sec.label && (
                    <tr className={`sec-head cat-${sec.cat || 'neutral'}`}>
                      <td colSpan={cols}>{sec.label}</td>
                    </tr>
                  )}
                  {sec.filas.map((f, ri) => {
                    const esTotal = /^total/i.test(String(f[0]));
                    const tipTxt = g.filaTips ? g.filaTips[ri] : null;
                    const cls = [sec.cat ? `cat-${sec.cat}` : '', esTotal ? 'tot' : '', tipTxt ? 'con-tip' : ''].filter(Boolean).join(' ');
                    return (
                      <tr key={ri} className={cls}
                        onMouseMove={tipTxt ? (e) => setTip({ text: tipTxt, x: e.clientX, y: e.clientY }) : undefined}
                        onMouseLeave={tipTxt ? () => setTip(null) : undefined}>
                        {f.map((c, ci) => <td key={ci} className={ci === 0 ? '' : 'num'}>{c}</td>)}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {tip && <div className="tabla-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.text}</div>}
      </>
    );
  }
  if (g.tipo === 'line') {
    const data = g.periodos.map((p, i) => {
      const row = { periodo: p };
      g.series.forEach((s) => { row[s.nombre] = s.datos[i]; });
      return row;
    });
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#23353f" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="periodo" {...ejeStyle} />
          <YAxis {...ejeStyle} domain={['auto', 'auto']} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#8ba0ab' }} />
          {g.series.map((s, i) => (
            <Line key={s.nombre} type="monotone" dataKey={s.nombre} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (g.horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={g.datos} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#23353f" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" {...ejeStyle} />
          <YAxis type="category" dataKey="nombre" width={100} {...ejeStyle} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="valor" radius={[0, 5, 5, 0]}>
            {g.datos.map((_, i) => <Cell key={i} fill={CHART_COLORS[0]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={g.datos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#23353f" strokeDasharray="3 3" vertical={false} />
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
