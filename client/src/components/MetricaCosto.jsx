import { useEffect, useRef, useState } from 'react';
// Métrica de Costo (Logística): $/ton descargada real mes a mes vs. proyección por inflación (INDEC),
// con conclusión de la evolución. Datos de «2026 Consumo de combustible.xlsx», hoja Gastos.
import html from '../dashboards/metrica-costo.html?raw';

export default function MetricaCosto() {
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
    <iframe ref={ref} title="Métrica de Costo" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
