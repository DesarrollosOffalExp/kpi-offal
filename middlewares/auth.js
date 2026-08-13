const { poolPromise, sql } = require('../config/db');
require('dotenv').config();

// Clave de la app en el padrón central (acceso.Permisos.App).
const APP_KEY = 'kpi';

// Login de desarrollo: simula una identidad cuando NO hay Easy Auth delante.
// SOLO se activa con el flag explícito ALLOW_DEV_LOGIN=true — nunca por el hecho
// de "no estar en producción". Así, si en Azure falta una variable, la app NO
// suplanta a nadie: devuelve 401. En producción esta variable no debe existir.
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === 'true';

/**
 * Identidad vía Azure Easy Auth (Entra ID) + rol en el padrón central.
 *
 * Easy Auth reenvía el email ya autenticado en 'x-ms-client-principal-name'.
 * Se cruza contra acceso.Usuarios (identidad) y acceso.Permisos (rol en 'kpi').
 *
 * - En desarrollo simula un usuario real (DEV_EMAIL) para ver el padrón de verdad.
 * - Si KPI_REQUIRE_PERMISSION=true, sin permiso 'kpi' se devuelve 403 (lista blanca,
 *   igual que las otras apps). Mientras la app 'kpi' no esté cargada en el padrón,
 *   dejar la variable en false para no bloquear el desarrollo.
 */

/**
 * Los invitados (B2B) de Entra pueden llegar identificados como
 *   "persona_dominio.com#EXT#@offal.onmicrosoft.com"
 * en vez de su correo real. Reconstruimos el correo original para cruzarlo con
 * el padrón. Devuelve null si el email no tiene forma de invitado.
 */
function correoDeInvitado(email) {
  const i = email.indexOf('#EXT#');
  if (i === -1) return null;
  const base = email.slice(0, i); // persona_dominio.com
  const guion = base.lastIndexOf('_'); // el último "_" era la arroba
  return guion === -1 ? null : `${base.slice(0, guion)}@${base.slice(guion + 1)}`;
}

module.exports = async function auth(req, res, next) {
  const email =
    req.headers['x-ms-client-principal-name'] ||
    (ALLOW_DEV_LOGIN ? process.env.DEV_EMAIL : null);

  if (!email) {
    return res.status(401).json({ mensaje: 'No autenticado por Azure Easy Auth.' });
  }

  const exigirPermiso = process.env.KPI_REQUIRE_PERMISSION === 'true';

  try {
    const pool = await poolPromise;

    // Sin base (modo mock / desarrollo temprano): se entra como identidad-solo.
    if (!pool) {
      if (exigirPermiso) {
        return res.status(503).json({ mensaje: 'Padrón no disponible.' });
      }
      req.user = { UsuarioId: null, Email: email, Nombre: null, rol: null, registrado: false };
      return next();
    }

    const alterno = correoDeInvitado(email);
    const result = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .input('alterno', sql.NVarChar, alterno || email)
      .input('app', sql.NVarChar, APP_KEY)
      .query(`
        SELECT u.UsuarioId, u.Email, u.Nombre, p.Rol
        FROM acceso.Usuarios u
        LEFT JOIN acceso.Permisos p
          ON p.UsuarioId = u.UsuarioId AND p.App = @app
        WHERE u.Activo = 1 AND u.Email IN (@email, @alterno)
      `);

    const u = result.recordset[0];

    if (exigirPermiso && (!u || !u.Rol)) {
      return res.status(403).json({ mensaje: 'No tenés permiso para ver el tablero de KPIs.' });
    }

    req.user = u
      ? { UsuarioId: u.UsuarioId, Email: u.Email, Nombre: u.Nombre, rol: u.Rol || null, registrado: true }
      : { UsuarioId: null, Email: email, Nombre: null, rol: null, registrado: false };

    next();
  } catch (err) {
    console.error('[KPI/Auth] Error:', err.message);
    return res.status(500).json({ mensaje: 'Error en la verificación de identidad.' });
  }
};
