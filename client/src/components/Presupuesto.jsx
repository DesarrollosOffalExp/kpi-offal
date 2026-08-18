import { useEffect, useRef, useState } from 'react';
// Dashboard de Presupuesto (Fábrica de Hielo): página autocontenida embebida en un
// iframe aislado. Presupuestado vs. gasto real por grupo, con selector de mes.
// Datos de PRESUPUESTO.xlsx (hoja por mes + RESUMEN).
import presupuestoHtml from '../dashboards/presupuesto.html?raw';

export default function Presupuesto() {
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
    <iframe
      ref={ref}
      title="Presupuesto"
      srcDoc={presupuestoHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
