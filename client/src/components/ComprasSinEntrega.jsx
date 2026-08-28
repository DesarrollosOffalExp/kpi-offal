import { useEffect, useRef, useState } from 'react';
// Sin entrega (Compras): órdenes de compra vivas con ítems todavía pendientes de
// entrega, agrupadas por proveedor y rubro, con el detalle al hacer clic.
// Datos de la hoja Reporte de «Ordenes de Compra actualizable (version 1).xlsm».
import html from '../dashboards/compras-sin-entrega.html?raw';

export default function ComprasSinEntrega() {
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
    <iframe ref={ref} title="Órdenes sin entrega" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
