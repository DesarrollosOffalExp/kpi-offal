import { useEffect, useRef, useState } from 'react';
// Presentación Gerencial: réplica del "Tablero de Control General" que la Gerencia
// de Gestión arma en PowerPoint cada corte. Página autocontenida en un iframe.
import presentacionHtml from '../dashboards/gestion-presentacion.html?raw';

export default function GestionPresentacion() {
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
    <iframe ref={ref} title="Presentación Gerencial" srcDoc={presentacionHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
