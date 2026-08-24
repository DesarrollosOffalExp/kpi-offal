// Selector de ventanas dentro de una sub-pestaña (ej. Objetivo, Órdenes demoradas).
// Los estilos viven en index.css (.ventanas / .ventana) para no repetirlos.
export default function Ventanas({ items, activa, onCambiar, etiqueta }) {
  if (!items || items.length < 2) return null;
  return (
    <div className="ventanas" role="tablist" aria-label={etiqueta}>
      {items.map((v) => (
        <button
          key={v.key}
          role="tab"
          aria-selected={activa === v.key}
          className={`ventana ${activa === v.key ? 'on' : ''}`}
          onClick={() => onCambiar(v.key)}
        >
          {v.nombre}
          {v.hint && <small>{v.hint}</small>}
        </button>
      ))}
    </div>
  );
}
