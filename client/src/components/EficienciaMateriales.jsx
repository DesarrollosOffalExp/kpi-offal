import { useEffect, useRef, useState } from 'react';
// Eficiencia de Materiales (Insumos): recepción (hoja 5) + entrega (hoja 7) de materiales,
// tarjetas por mes seleccionable, tablas y gráficos de eficiencia mes a mes.
// Datos de «Indicadores Insumos - 2026.xlsx».
import html from '../dashboards/eficiencia-materiales.html?raw';

export default function EficienciaMateriales() {
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
    <iframe ref={ref} title="Eficiencia de Materiales" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
