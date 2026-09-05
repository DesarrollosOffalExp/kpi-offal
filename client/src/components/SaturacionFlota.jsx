import { useEffect, useRef, useState } from 'react';
// Saturación de Flota (Logística). Dos vistas del mismo dato: los indicadores del
// período y el informe día por día del último mes, que es donde se ve la
// asignación unidad por unidad.
import indicadoresHtml from '../dashboards/saturacion-flota.html?raw';
import diarioHtml from '../dashboards/saturacion-diario.html?raw';

const VISTAS = [
  { id: 'indicadores', lbl: 'Indicadores', titulo: 'Saturación de Flota', html: indicadoresHtml },
  { id: 'diario', lbl: 'Informe diario', titulo: 'Informe Diario de Flota', html: diarioHtml },
];

export default function SaturacionFlota({ onSub }) {
  const ref = useRef(null);
  const [vista, setVista] = useState('indicadores');
  // Cada vista tiene su alto; si se comparte, al cambiar de solapa queda un hueco
  // o se corta hasta que el iframe vuelve a avisar.
  const [altos, setAltos] = useState({});
  const actual = VISTAS.find(v => v.id === vista) || VISTAS[0];

  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) {
        setAltos(a => (a[vista] === e.data.alto + 8 ? a : { ...a, [vista]: e.data.alto + 8 }));
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [vista]);

  useEffect(() => { onSub?.(actual.lbl); }, [vista, onSub, actual.lbl]);

  return (
    <>
      <nav className="subtabs" style={{ marginBottom: 16, paddingBottom: 12 }}>
        {VISTAS.map(v => (
          <button key={v.id} className={`subtab ${v.id === vista ? 'on' : ''}`}
            onClick={() => setVista(v.id)}>{v.lbl}</button>
        ))}
      </nav>
      <iframe key={actual.id} ref={ref} title={actual.titulo} srcDoc={actual.html}
        style={{ width: '100%', height: altos[vista] || 1400, border: 'none', background: 'transparent', display: 'block' }} />
    </>
  );
}
