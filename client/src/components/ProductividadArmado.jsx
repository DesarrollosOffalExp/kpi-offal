import { useEffect, useRef, useState } from 'react';
// Productividad de Armado de Cajas (Insumos): índice cajas/hora vs. ideal por formadora y turno,
// por semana, con selector de semana y comparativo semanal + capacidad por formadora.
// Datos de «Indicadores Insumos - 2026.xlsx» (hoja Prod. Armado de Cajas · fórmulas de la hoja 1).
import html from '../dashboards/productividad-armado.html?raw';

export default function ProductividadArmado() {
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
    <iframe ref={ref} title="Productividad de Armado de Cajas" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
