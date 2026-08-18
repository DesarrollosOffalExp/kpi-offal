import { useEffect, useRef, useState } from 'react';
// Dashboard de Monitoreo de Barras (Fábrica de Hielo): página autocontenida embebida
// en un iframe aislado. Detalle por proveedor de tambores (barras estimadas vs. usadas,
// promedio por tambor y costo por kilo). Datos de NUEVO MONITOREO DE BARRAS.xlsx.
import barrasHtml from '../dashboards/monitoreo-barras.html?raw';

export default function MonitoreoBarras() {
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
    <iframe
      ref={ref}
      title="Monitoreo de Barras"
      srcDoc={barrasHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
