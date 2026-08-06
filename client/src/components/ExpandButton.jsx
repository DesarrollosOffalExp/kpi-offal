/** Botón para ampliar un elemento (KPI o gráfico) a pantalla grande. */
export default function ExpandButton({ onClick }) {
  return (
    <button className="expand-btn" onClick={onClick} aria-label="Ampliar" title="Ver en grande">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    </button>
  );
}
