import { useEffect, useRef, useState } from 'react';
// El dashboard de Matriz de Costo es una página autocontenida (HTML+CSS+JS+SVG).
// Se embebe tal cual, aislada en un iframe, para que su estilo no choque con el
// del tablero y sin necesidad de una URL aparte. Vite la inyecta como string (?raw).
import matrizHtml from '../dashboards/matriz-costo-logistica.html?raw';

/**
 * Matriz de Costo de Logística (reemplaza la tabla anterior de ese subtab).
 * El iframe reporta su alto real por postMessage y acá lo ajustamos, así no
 * queda scroll interno ni recortes al abrir/cerrar los acordeones.
 */
export default function MatrizCostoLogistica() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1400);

  useEffect(() => {
    function onMsg(e) {
      if (!ref.current) return;
      if (e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) {
        setAlto(e.data.alto + 8);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <iframe
      ref={ref}
      title="Matriz de Costo · Logística"
      srcDoc={matrizHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
