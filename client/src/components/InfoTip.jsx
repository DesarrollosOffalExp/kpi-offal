/**
 * Ícono de ayuda ⓘ con tooltip al hover / focus. Explica al usuario final qué
 * significa un dato. Accesible por teclado (tabIndex + focus-within en CSS).
 */
export default function InfoTip({ text }) {
  return (
    <span className="info">
      <span className="info-btn" tabIndex={0} role="button" aria-label={`Ayuda: ${text}`}>i</span>
      <span className="tip" role="tooltip">{text}</span>
    </span>
  );
}
