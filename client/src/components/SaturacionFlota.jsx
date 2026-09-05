import { useEffect, useRef, useState } from 'react';
// Saturación de Flota (Logística): los viajes de la hoja de ruta contra la flota
// que Disponibilidad de Flota da por disponible, separando lo que tracciona de
// lo que se arrastra.
import html from '../dashboards/saturacion-flota.html?raw';

export default function SaturacionFlota() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1400);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Saturación de Flota" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
