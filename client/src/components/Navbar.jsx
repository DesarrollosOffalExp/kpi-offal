import { useState } from 'react';
import { PORTAL_URL, LOGOUT_URL } from '../api';

// Iniciales para el avatar (Nombre Apellido → NA).
function iniciales(nombre, email) {
  if (nombre) {
    const p = nombre.trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" />
  </svg>
);

/**
 * Barra de navegación unificada del ecosistema Offal:
 * logo en círculo blanco, título, botón "Inicio" → portal, y chip de usuario
 * con menú de "Cerrar sesión". Misma disposición que las otras apps (paleta navy).
 */
export default function Navbar({ usuario, contexto }) {
  const [abierto, setAbierto] = useState(false);
  const nombre = usuario?.nombre || usuario?.email || 'Usuario';
  const alTope = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="brand" href={PORTAL_URL} title="Ir al portal Offal">
          <span className="brand-badge"><img src="/logo.png" alt="Offal" /></span>
          <span className="brand-mark">Offal <span className="brand-sub">· Tablero KPI</span></span>
        </a>

        {/* Dónde estás parado. Sólo aparece cuando las pestañas quedaron
            arriba de la pantalla; al volver al tope se saca. */}
        {contexto && (
          <div className="nav-ctx" aria-label="Ubicación actual">
            <button className="nav-ctx-chip on" onClick={alTope} title="Volver a las pestañas">
              {contexto.sector}
            </button>
            {contexto.sub && (
              <>
                <span className="nav-ctx-sep" aria-hidden="true">›</span>
                <button className="nav-ctx-chip" onClick={alTope} title="Volver a las pestañas">
                  {contexto.sub}
                </button>
              </>
            )}
          </div>
        )}

        <div className="nav-right">
          <a className="nav-btn" href={PORTAL_URL} title="Volver al portal">
            <IconHome /><span className="nav-btn-txt">Inicio</span>
          </a>

          <div className="user-wrap">
            <button className="user" onClick={() => setAbierto((v) => !v)}>
              <span className="avatar">{iniciales(usuario?.nombre, usuario?.email)}</span>
              <span className="user-meta">
                <span className="user-name">{nombre}</span>
                {usuario?.rol && <span className="user-rol">{usuario.rol}</span>}
              </span>
              <span className="user-caret">▾</span>
            </button>
            {abierto && (
              <>
                <div className="menu-backdrop" onClick={() => setAbierto(false)} />
                <div className="user-menu">
                  <div className="user-menu-head">
                    <span className="user-menu-name">{nombre}</span>
                    {usuario?.email && <span className="user-menu-mail">{usuario.email}</span>}
                  </div>
                  <a className="user-menu-item" href={LOGOUT_URL}>Cerrar sesión</a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
