import { useEffect, useRef, useState } from 'react';
// Dashboard de Consumo de Gasoil (Logística): página autocontenida embebida en un iframe.
// Consumo semanal (camiones, mantenimiento, total), km y litros/100km, con comparativo
// semana por semana. Datos de 2026 Consumo de combustible.xlsx (hoja 2026 Cálculo).
import gasoilHtml from '../dashboards/consumo-gasoil.html?raw';

export default function ConsumoGasoil() {
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
    <iframe ref={ref} title="Consumo de Gasoil" srcDoc={gasoilHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
