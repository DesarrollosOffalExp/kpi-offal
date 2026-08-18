import { useEffect, useRef, useState } from 'react';
// Dashboard de Necesidad de Tambores (Logística): página autocontenida embebida en un
// iframe. Enviado vs. recibido por frigorífico y semana, débitos y deuda total.
// Datos de «NECESIDAD DE TAMBORES PARA OPERAR 2026.xlsx».
import tamboresHtml from '../dashboards/necesidad-tambores.html?raw';

export default function NecesidadTambores() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1300);
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
      srcDoc={tamboresHtml}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }}
    />
  );
}
