import { useEffect, useRef, useState } from 'react';
// Órdenes Demoradas (Compras): tabla agrupada por proveedor+rubro con detalle expandible.
// Resumen tomado de la hoja «Demoradas»; detalle reconstruido desde «Reporte».
// Fuente: «Ordenes de Compra actualizable (version 1).xlsm» (SharePoint · Compras).
import html from '../dashboards/compras-demoradas.html?raw';

export default function ComprasDemoradas() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(760);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Órdenes Demoradas" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
