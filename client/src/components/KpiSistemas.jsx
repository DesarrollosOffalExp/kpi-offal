import { useEffect, useRef, useState } from 'react';
// Dashboard de KPI de Sistemas (tickets), página autocontenida embebida en un
// iframe aislado para no chocar estilos con el tablero y sin URL aparte.
import sistemasHtml from '../dashboards/kpi-sistemas.html?raw';

export default function KpiSistemas({ onSub }) {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1400);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
      // Sistemas navega por dentro: avisa qué sección está activa para que la
      // navbar la muestre al scrollear, igual que los sectores con sub-pestañas.
      if (e.data && e.data.tipo === 'sub' && typeof e.data.sub === 'string') onSub?.(e.data.sub);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onSub]);
  return (
    <iframe
      ref={ref}
      title="KPI de Sistemas"
      srcDoc={sistemasHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
