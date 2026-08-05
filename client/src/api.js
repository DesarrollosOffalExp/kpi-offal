// Llama a la API del tablero. En producción, Easy Auth ya puso la cabecera de
// identidad; en dev, el backend simula el usuario (DEV_EMAIL).

// URL del portal Offal (botón "Inicio" del navbar). Se puede sobreescribir por
// entorno de build (VITE_PORTAL_URL) si el portal toma dominio propio.
export const PORTAL_URL =
  import.meta.env.VITE_PORTAL_URL || 'https://offal-hsb3c0gebjgbfmae.eastus-01.azurewebsites.net';

// URL de Easy Auth (Entra ID) para cerrar sesión.
export const LOGOUT_URL = '/.auth/logout?post_logout_redirect_uri=/';

export async function getMe() {
  const res = await fetch('/api/me', { credentials: 'include' });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Sin sesión / sin permiso');
    err.code = res.status === 403 ? 'NO_PERM' : 'NO_AUTH';
    throw err;
  }
  if (!res.ok) throw new Error('No se pudo verificar la identidad.');
  return res.json();
}

export async function getKpis({ forzar = false } = {}) {
  const res = await fetch(`/api/kpis${forzar ? '?forzar=1' : ''}`, { credentials: 'include' });
  if (!res.ok) throw new Error('No se pudieron cargar los indicadores.');
  return res.json();
}
