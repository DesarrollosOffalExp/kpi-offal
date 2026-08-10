import Chart from './Chart';
import InfoTip from './InfoTip';
import ExpandButton from './ExpandButton';

/** Renderiza los gráficos declarados por el sector (líneas y barras),
 *  cada uno con ⓘ de ayuda y botón para ampliar. */
export default function SectorCharts({ graficos, onExpand }) {
  if (!graficos?.length) return null;
  return (
    <div className="charts-grid">
      {graficos.map((g, i) => (
        <div className={`panel ${g.tipo === 'tabla' ? 'panel-full' : ''}`} key={i}>
          <div className="panel-head">
            <h3>{g.titulo}{g.info && <InfoTip text={g.info} />}</h3>
            <ExpandButton onClick={() => onExpand({ kind: 'grafico', grafico: g })} />
          </div>
          <div className="chart"><Chart g={g} height={260} /></div>
        </div>
      ))}
    </div>
  );
}
