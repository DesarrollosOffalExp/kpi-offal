import { useEffect, useRef, useState } from 'react';
// Dashboard de Pendientes y Vencidas (Compras): página autocontenida embebida en un iframe.
// Tarjetas de la última semana + comparativo de vencidas/pendientes por semana con observaciones.
// Datos de «Archivo a trabajar.xlsx», hoja KPI (primera tabla).
import html from '../dashboards/compras-pendientes.html?raw';

export default function ComprasPendientes() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1100);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Pendientes y Vencidas" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
