/**
 * KPIs de "Lavado de Camiones" (Logística) leídos EN VIVO desde SQL.
 *
 * Fuente: base compartida `controletiquetas`, esquema `lavados` (lo que carga el
 * módulo Control de Lavados). Replica la lógica de su ReporteService.cs:
 *   - Camiones lavados = lavados finalizados de tipo Camión (Tipo=0) en la semana ISO.
 *   - Horas de lavado  = suma del tiempo de proceso (Desatraco − InicioAtraco).
 *   - Operarios        = operarios DISTINTOS que trabajaron esa semana (de nómina activa).
 *
 * Usa el MISMO pool mssql que el padrón `acceso` (config/db.js): misma instancia
 * Azure SQL, sin credenciales nuevas. Si no hay pool o algo falla, devuelve null
 * y el tablero mantiene los valores previos (mock/Graph). Nunca lanza.
 */
const { poolPromise, sql } = require('../config/db');

async function obtenerLavadoCamiones() {
  const pool = await poolPromise;
  if (!pool) return null; // sin DB configurada (dev local) → el tablero usa el mock

  // (A) Última semana ISO con datos: camiones + horas (proceso total y neta).
  const resumen = await pool.request().query(`
    WITH base AS (
      SELECT
        YEAR(Fecha)                               AS Anio,
        DATEPART(ISO_WEEK, Fecha)                 AS Semana,
        DATEDIFF(SECOND, InicioAtraco, Desatraco) AS SegProceso,
        DATEDIFF(SECOND, InicioLavado, FinLavado) AS SegNeto
      FROM lavados.Lavados
      WHERE Estado = 'Finalizado' AND Tipo = 0
        AND InicioAtraco IS NOT NULL AND Desatraco IS NOT NULL
        AND InicioLavado IS NOT NULL AND FinLavado IS NOT NULL
    ),
    ult AS (
      SELECT TOP 1 Anio, Semana
      FROM base GROUP BY Anio, Semana
      ORDER BY Anio DESC, Semana DESC
    )
    SELECT
      u.Anio, u.Semana,
      COUNT(*)                                        AS Camiones,
      CAST(SUM(b.SegProceso) / 3600.0 AS DECIMAL(10,1)) AS HorasProceso,
      CAST(SUM(b.SegNeto)    / 3600.0 AS DECIMAL(10,1)) AS HorasNetas
    FROM base b
    JOIN ult u ON b.Anio = u.Anio AND b.Semana = u.Semana
    GROUP BY u.Anio, u.Semana;
  `);
  const r = resumen.recordset[0];
  if (!r) return null;

  // (B) Operarios distintos que trabajaron esa semana.
  const ops = await pool.request()
    .input('anio', sql.Int, r.Anio)
    .input('sem', sql.Int, r.Semana)
    .query(`
      SELECT COUNT(DISTINCT o.Nombre) AS Trabajaron
      FROM lavados.Lavados l
      JOIN lavados.LavadoOperarios o ON o.LavadoId = l.Id
      WHERE l.Estado = 'Finalizado' AND l.Tipo = 0
        AND YEAR(l.Fecha) = @anio AND DATEPART(ISO_WEEK, l.Fecha) = @sem;
    `);
  const operariosTrabajaron = ops.recordset[0]?.Trabajaron ?? null;

  // (C) Nómina activa (el "de N"). La columna Activo puede no existir → se ignora.
  let operariosActivos = null;
  try {
    const nom = await pool.request().query(
      `SELECT COUNT(*) AS Activos FROM lavados.Operarios WHERE Activo = 1;`
    );
    operariosActivos = nom.recordset[0]?.Activos ?? null;
  } catch { /* sin columna Activo: dejamos la nómina en null */ }

  return {
    anio: r.Anio,
    semana: r.Semana,
    camiones: r.Camiones,
    horasProceso: r.HorasProceso,
    horasNetas: r.HorasNetas,
    operariosTrabajaron,
    operariosActivos,
  };
}

/**
 * Parcha en `data` (resultado de getKpis) los 3 KPIs de Lavado de Camiones del
 * sector Logística con los valores en vivo. No hace nada si no hay datos SQL.
 */
async function enriquecerLavadoCamiones(data) {
  try {
    const lav = await obtenerLavadoCamiones();
    if (!lav) return;
    const log = data?.sectores?.find((s) => s.key === 'logística');
    if (!log || !Array.isArray(log.kpis)) return;

    const set = (id, patch) => {
      const k = log.kpis.find((x) => x.id === id);
      if (k) Object.assign(k, patch);
    };

    set('camiones_lav', { valor: lav.camiones });
    // "Horas de lavado" = proceso total (con atraco/desatraco). Si gerencia lo
    // define como neto, cambiar a lav.horasNetas.
    set('hs_lavado', { valor: Math.round(lav.horasProceso) });
    if (lav.operariosTrabajaron != null) {
      const patch = { valor: lav.operariosTrabajaron };
      if (lav.operariosActivos != null) patch.desglose = [{ nombre: 'Por nómina', valor: lav.operariosActivos }];
      set('operarios', patch);
    }

    // Actualiza la etiqueta del sub-tab con la semana real.
    const nuevo = `Lavado de Camiones · Sem ${lav.semana}`;
    log.kpis.forEach((k) => {
      if (typeof k.grupo === 'string' && k.grupo.startsWith('Lavado de Camiones')) k.grupo = nuevo;
    });
    data.lavadoEnVivo = true;
  } catch (e) {
    console.error('[KPI] lavado de camiones SQL falló, mantengo valores previos:', e.message);
  }
}

module.exports = { obtenerLavadoCamiones, enriquecerLavadoCamiones };
