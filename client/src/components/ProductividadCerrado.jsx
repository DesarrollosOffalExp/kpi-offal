import { useEffect, useRef, useState } from 'react';
// Productividad en Cerrado de Cajas (Insumos): cajas cerradas por las Bestpack, por semana y máquina,
// picos de producción y máximos por máquina y mes. Réplica de Comparativo_Semanal desde Datos_0.
// Datos de «Picos de empaque TPM x 10 Min.xlsx».
import html from '../dashboards/productividad-cerrado.html?raw';

export default function ProductividadCerrado() {
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
    <iframe ref={ref} title="Productividad en Cerrado de Cajas" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
