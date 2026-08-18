import { useEffect, useRef, useState } from 'react';
// Dashboard de Productividad de Barras (Fábrica de Hielo): página autocontenida embebida.
// KPIs + detalle diario (consumo/producción/hom-hs) + tendencia histórica interactiva.
// Datos de PRODUCTIVIDAD BARRAS.xlsx (hojas RESUMEN e HISTORICO).
import prodHtml from '../dashboards/productividad-barras.html?raw';

export default function ProductividadBarras() {
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
    <iframe ref={ref} title="Productividad de Barras" srcDoc={prodHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
