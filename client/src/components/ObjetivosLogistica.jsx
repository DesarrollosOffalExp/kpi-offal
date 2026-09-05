import { useEffect, useRef, useState } from 'react';
// Seguimiento de los KPI asignados a Logística: el cuadro del sector con los
// valores calculados mes a mes, y cada valor abre su propia justificación.
import html from '../dashboards/objetivos-logistica.html?raw';

export default function ObjetivosLogistica() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(900);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Seguimiento de KPI · Logística" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
