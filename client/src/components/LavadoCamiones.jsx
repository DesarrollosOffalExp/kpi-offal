import { useEffect, useRef, useState } from 'react';
// Lavado de Camiones (Logística). La ventana tiene tres vistas de la misma base
// —el form de control de lavado— y navega por dentro, como Sistemas: el tablero
// para mirar el dato, el informe para leer la conclusión y el cuadro de KPI para
// seguirlo semana a semana.
import tableroHtml from '../dashboards/lavado-camiones.html?raw';
import informeHtml from '../dashboards/lavado-informe.html?raw';
import kpiHtml from '../dashboards/lavado-kpi.html?raw';

const VISTAS = [
  { id: 'tablero', lbl: 'Tablero', titulo: 'Lavado de Camiones', html: tableroHtml },
  { id: 'informe', lbl: 'Informe del sector', titulo: 'Informe del Lavadero', html: informeHtml },
  { id: 'kpi', lbl: 'KPI del Lavadero', titulo: 'KPI del Lavadero', html: kpiHtml },
];

export default function LavadoCamiones({ onSub }) {
  const ref = useRef(null);
  const [vista, setVista] = useState('tablero');
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

  // La navbar del tablero muestra en qué sección está parado el usuario.
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
