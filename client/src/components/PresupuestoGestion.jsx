import { useEffect, useRef, useState } from 'react';
// Dashboard de Presupuesto de la Gerencia de Gestión: página autocontenida embebida
// en un iframe. Presupuestado vs. gasto real, con un mes analizado por carpeta de
// SharePoint (Gerencia de Gestión / <mes>). Hoy en análisis: julio.
import presupuestoHtml from '../dashboards/presupuesto-gestion.html?raw';

export default function PresupuestoGestion() {
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
    <iframe ref={ref} title="Presupuesto Gestión" srcDoc={presupuestoHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
