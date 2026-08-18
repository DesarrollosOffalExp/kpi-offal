// Cuadro de "KPIs asignados" por sector (hoja del archivo KPI Gerencia de Operaciones).
// Muestra objetivos, KPI/métrica, meta y el seguimiento mensual, tal cual la planilla.
function pctNum(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^-?\d+(?:[.,]\d+)?\s*%$/);
  if (!m) return null;
  return parseFloat(s.replace('%', '').replace(',', '.'));
}
function celClase(v, meta) {
  const nv = pctNum(v), nm = pctNum(meta);
  if (nv == null || nm == null) return '';
  return nv >= nm ? 'cobj-ok' : 'cobj-bajo';
}
function celTxt(v) {
  if (v == null || v === '') return <span className="cobj-dash">–</span>;
  if (/^n\/?a$/i.test(v)) return <span className="cobj-na">N/A</span>;
  return v;
}

export default function CuadroObjetivos({ data }) {
  if (!data || !data.filas) return null;
  const { persona, total, meses, filas, promedio } = data;
  return (
    <div className="cobj">
      <style>{`
        .cobj{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px 18px;}
        .cobj h3{font-size:15px;font-weight:800;margin:0 0 3px;color:var(--text);}
        .cobj .cobj-sub{font-size:11.5px;color:var(--muted);margin:0 0 12px;}
        .cobj-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;}
        .cobj table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px;}
        .cobj thead th{position:sticky;top:0;z-index:2;background:var(--panel-2,#0e1e28);color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;text-align:center;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;}
        .cobj thead th.izq{text-align:left;}
        .cobj thead th.meta{color:#fff;}
        .cobj tbody td{padding:9px 12px;border-bottom:1px solid var(--line);text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text);}
        .cobj tbody td.izq{text-align:left;white-space:normal;color:var(--text);font-weight:600;}
        .cobj tbody td.kpi{text-align:left;white-space:normal;color:var(--muted);font-weight:500;min-width:240px;max-width:360px;}
        .cobj tbody td.num{color:var(--muted-2,#667d89);font-weight:700;text-align:center;}
        .cobj tbody td.meta{color:#fff;font-weight:800;}
        .cobj tbody tr:last-child td{border-bottom:none;}
        .cobj tbody tr:hover td{background:rgba(255,255,255,.02);}
        .cobj .cobj-ok{background:rgba(34,227,155,.14);color:#22e39b;font-weight:700;}
        .cobj .cobj-bajo{background:rgba(255,77,103,.14);color:#ff4d67;font-weight:700;}
        .cobj .cobj-na{color:var(--muted-2,#667d89);}
        .cobj .cobj-dash{color:var(--muted-2,#667d89);}
        .cobj tr.cobj-prom td{border-top:2px solid var(--line-2,#2c414d);background:var(--panel-3,#162b37);font-weight:800;color:#fff;}
      `}</style>
      <h3>KPIs asignados · {persona || '—'}</h3>
      <p className="cobj-sub">Seguimiento mensual 2026 · total objetivos asignados: {total}. Verde = cumple la meta, rojo = por debajo.</p>
      <div className="cobj-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="izq">Objetivo</th>
              <th className="izq">KPI / Métrica</th>
              <th className="meta">Meta</th>
              {meses.map((m) => <th key={m}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td className="num">{f.n}</td>
                <td className="izq">{f.objetivo}</td>
                <td className="kpi">{f.kpi}</td>
                <td className="meta">{f.meta || '—'}</td>
                {f.vals.map((v, j) => (
                  <td key={j} className={celClase(v, f.meta)}>{celTxt(v)}</td>
                ))}
              </tr>
            ))}
            {promedio && (
              <tr className="cobj-prom">
                <td className="num"></td>
                <td className="izq">Promedio general</td>
                <td className="kpi"></td>
                <td className="meta"></td>
                {promedio.map((v, j) => <td key={j}>{celTxt(v)}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
