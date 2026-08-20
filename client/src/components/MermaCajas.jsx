import { useEffect, useRef, useState } from 'react';
// Merma de Cajas (Insumos): planchas utilizadas vs. cajas producidas por tipo de caja y mes,
// con selector de mes y evolución del KPI total. Fórmulas replicadas de la hoja 2.
// Datos de «Indicadores Insumos - 2026.xlsx» (Consumos Depósito + Producción).
import html from '../dashboards/merma-cajas.html?raw';

export default function MermaCajas() {
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
    <iframe ref={ref} title="Merma de Cajas" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
