import { useEffect, useRef, useState } from 'react';
// Precios de Compras (Objetivo 1): precio real de cada material contra el precio de
// diciembre 2025 dolarizado y ajustado mes a mes por inflación.
// Fuente: hoja «sifab» de «OBJETIVOS RESUMEN DE INFORME.xlsx» (SharePoint · Compras),
// que es la consulta en crudo de líneas de OC (fecha, cantidad, precio, moneda, estado).
import html from '../dashboards/compras-precios.html?raw';

export default function ComprasPrecios() {
  const ref = useRef(null);
  const [alto, setAlto] = useState(1600);
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Al cambiar el ancho, el contenido del iframe se reacomoda y cambia de alto.
  // El ResizeObserver de adentro no avisa de forma confiable en las dos
  // direcciones, así que el ancho se vigila acá y se le pide que se re-mida.
  // Se escucha además el resize de la ventana: el ResizeObserver depende del
  // ciclo de render y no corre si la pestaña no está pintando.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ancho = Math.round(el.getBoundingClientRect().width);
    let t;
    const medir = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const nuevo = Math.round(el.getBoundingClientRect().width);
        if (nuevo === ancho) return;
        ancho = nuevo;
        el.contentWindow?.postMessage({ tipo: 'medir-alto' }, '*');
      }, 120);
    };
    window.addEventListener('resize', medir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (ro) ro.observe(el);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', medir);
      if (ro) ro.disconnect();
    };
  }, []);
  return (
    <iframe ref={ref} title="Precios de Compras · real vs ajustado" srcDoc={html}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
