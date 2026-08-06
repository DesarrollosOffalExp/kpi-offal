import { useEffect } from 'react';

/** Overlay para ver un elemento ampliado en pantalla grande. Cierra con Esc,
 *  clic en el fondo o el botón ✕. */
export default function Modal({ titulo, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titulo}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
