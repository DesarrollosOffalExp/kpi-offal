import { useEffect, useRef, useState } from 'react';
// Dashboard de Actividad de la Semana (Compras): página autocontenida embebida en un iframe.
// Tarjetas de flujo de requisiciones + composición de pendientes y evolución de vencidas.
// Datos de «Archivo a trabajar.xlsx», hoja KPI (primera tabla).
import html from '../dashboards/compras-actividad.html?raw';

export default function ComprasActividad() {
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
    <iframe ref={ref} title="Actividad de la Semana" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
