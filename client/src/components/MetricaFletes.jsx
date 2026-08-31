import { useEffect, useRef, useState } from 'react';
// Métrica de Fletes (Logística): kilos y viajes propios contra fleteros mes a mes, de dónde sale
// la diferencia por proveedor, la evaluación económica de los fletes valorizados contra el índice
// de FADEEAC y el INDEC, y la incidencia del precio del gasoil en el gasto.
// Datos de «2026 Consumo de combustible.xlsx» + tools/indices-externos.json.
import html from '../dashboards/metrica-fletes.html?raw';

export default function MetricaFletes() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1200);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Métrica de Fletes" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
