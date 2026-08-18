import { useEffect, useRef, useState } from 'react';
// Dashboard de Costo por Frigorífico (Logística): página autocontenida embebida en un iframe.
// Costo de transporte por frigorífico ($ x Kg) con comparativo entre frigoríficos.
// Datos de 2026 Consumo de combustible.xlsx (hoja Costo Frigo).
import cfHtml from '../dashboards/costo-frigorifico.html?raw';

export default function CostoFrigorifico() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1000);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Costo por Frigorífico" srcDoc={cfHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
