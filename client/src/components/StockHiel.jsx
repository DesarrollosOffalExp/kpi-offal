import { useEffect, useRef, useState } from 'react';
// Dashboard de Stock de Hiel (Logística): página autocontenida embebida en un iframe.
// Libro diario de stock (ingresos, aditivo, salidas, saldo) con filtro por fecha y salidas
// del mes. Datos de STOCK HIEL AGOSTO 2026.xlsx (hoja STOCK, tabla desde W8).
import stockHtml from '../dashboards/stock-hiel.html?raw';

export default function StockHiel() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1000);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Stock de Hiel" srcDoc={stockHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
