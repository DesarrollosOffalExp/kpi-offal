import { useEffect, useRef, useState } from 'react';
// Dashboard de Presupuesto de Insumos: página autocontenida embebida en un iframe.
// Presupuestado vs. gasto real por grupo, con selector de mes. Datos de PRESUPUESTO INSUMOS.xlsx.
import presupuestoHtml from '../dashboards/presupuesto-insumos.html?raw';

export default function PresupuestoInsumos() {
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
    <iframe ref={ref} title="Presupuesto Insumos" srcDoc={presupuestoHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
