import { useEffect, useMemo, useRef, useState } from 'react';
// Objetivos estratégicos de la Gerencia de Operaciones.
//   modo "gerencia" → todas las áreas, una debajo de la otra (pestaña Objetivos).
//   modo "sector"   → sólo el área desde la que se abre.
// En los dos casos, cada dato del cuadro abre el desglose de los KPI / métrica
// que carga el sector (2 o 3 por objetivo) y que, ponderados por su peso,
// forman el número del objetivo.
// Fuente: «KPI_GerencinadeOperaciones_2026.xlsx», hojas «ObjetivosMensuales» y
// «Carga Mensual KPI» (SharePoint · Gerencia de Operaciones / Objetivos).
import html from '../dashboards/objetivos-estrategicos.html?raw';

export default function ObjetivosEstrategicos({ modo = 'gerencia', area }) {
  const ref = useRef(null);
  const [alto, setAlto] = useState(modo === 'sector' ? 1400 : 2200);

  // La configuración se inyecta en el documento antes de su script, así el
  // tablero ya arranca en el modo correcto (con postMessage habría un parpadeo).
  const doc = useMemo(
    () => html.replace('<!--CONF-->', `<script>window.__CONF__=${JSON.stringify({ modo, area })}</script>`),
    [modo, area],
  );

  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.data && e.data.tipo === 'matriz-alto' && Number.isFinite(e.data.alto)) setAlto(e.data.alto + 8);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Al cambiar el ancho el contenido se reacomoda: se le pide que se re-mida.
  // Se escucha también el resize de la ventana porque el ResizeObserver depende
  // del ciclo de render y no corre si la pestaña no está pintando.
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
    <iframe ref={ref} title="Objetivos estratégicos" srcDoc={doc}
      style={{ width: '100%', height: alto, border: 'none', background: 'transparent', display: 'block' }} />
  );
}
