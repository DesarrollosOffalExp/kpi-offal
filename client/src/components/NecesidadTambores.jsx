import { useEffect, useMemo, useRef, useState } from 'react';
// Dashboard de Necesidad de Tambores (Logística): página autocontenida embebida en un
// iframe. Enviado vs. recibido por frigorífico y semana, débitos y deuda total.
// Debajo del detalle de la semana va el consolidado, en un iframe anidado para que
// las dos páginas no se pisen los estilos ni las variables.
// Datos de «NECESIDAD DE TAMBORES PARA OPERAR 2026.xlsx».
import tamboresHtml from '../dashboards/necesidad-tambores.html?raw';
import consolidadoHtml from '../dashboards/consolidado-tambores.html?raw';

export default function NecesidadTambores() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1300);
  const html = useMemo(() => {
    const esc = consolidadoHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const marco = '<iframe id="fcons" title="Consolidado de tambores" srcdoc="' + esc + '"></iframe>';
    return tamboresHtml.replace('<!--CONSOLIDADO-->', () => marco);
  }, []);
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
      title="Necesidad de Tambores"
      srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
