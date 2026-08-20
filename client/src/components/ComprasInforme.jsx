import { useEffect, useRef, useState } from 'react';
// Informe de Recepción (Compras): dashboard ejecutivo en tiempo vs. fuera de plazo.
// Compara Fecha de Entrega (col AX) con Fecha de Recepción (col BI) de la hoja «Reporte».
// Fuente: «Ordenes de Compra actualizable (version 1).xlsm» (SharePoint · Compras).
import html from '../dashboards/compras-informe.html?raw';

export default function ComprasInforme() {
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
    <iframe ref={ref} title="Informe de Recepción" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
