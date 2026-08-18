import { useEffect, useRef, useState } from 'react';
// Dashboard de Disponibilidad de Flota (Logística): página autocontenida embebida en un
// iframe. Disponibilidad por semana, evolución, y detalle de unidades paradas (BASE DE
// DATOS). Datos de «Indicador disponibilidad de flota 2026.xlsx».
import flotaHtml from '../dashboards/disponibilidad-flota.html?raw';

export default function DisponibilidadFlota() {
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
    <iframe
      ref={ref}
      title="Disponibilidad de Flota"
      srcDoc={flotaHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
