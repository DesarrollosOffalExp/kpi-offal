import { useEffect, useRef, useState } from 'react';
// Dashboard de Movimiento de Pallets (Fábrica de Hielo): página autocontenida
// embebida en un iframe aislado. Cada hoja del Excel es una semana; se muestra la
// última con selector de semana, buscador y ordenamiento. Vite la inyecta como ?raw.
import palletsHtml from '../dashboards/movimiento-pallets.html?raw';

export default function MovimientoPallets() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1200);
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
      title="Movimiento de Pallets"
      srcDoc={palletsHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
