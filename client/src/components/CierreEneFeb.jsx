import { useEffect, useRef, useState } from 'react';
// Cierre Enero–Febrero (Logística): enero con su mano de obra propia, que no
// estaba cargada, y la comparación con febrero abierta por drivers.
// Datos de «presupuesto enero 2026 detallado.xlsx» + «2026 Consumo de combustible.xlsx».
import html from '../dashboards/cierre-ene-feb.html?raw';

export default function CierreEneFeb() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1400);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <iframe ref={ref} title="Cierre Enero–Febrero" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
