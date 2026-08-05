/**
 * Configuración del mapeo del Excel de KPIs → modelo del tablero.
 *
 * ⚠️ Esta configuración asume una CONVENCIÓN de armado del Excel. Cuando tengamos
 * la estructura real del KPI.xlsx, se ajusta acá (idealmente sin tocar código):
 *
 * Convención asumida (una hoja por SECTOR):
 *   - Fila 1 = encabezados. Debe incluir, en algún orden, las columnas:
 *       "KPI"     → nombre del indicador
 *       "Unidad"  → % | t | h | $ | días | (vacío)
 *       "Meta"    → objetivo (número, opcional)
 *       "Sentido" → "up" si más alto es mejor, "down" si más bajo es mejor
 *     y luego UNA COLUMNA POR PERÍODO (ej. Ene, Feb, Mar, ...) con los valores.
 *   - Cada fila siguiente = un KPI.
 *   - El nombre de la hoja se usa como nombre del sector (salvo alias abajo).
 *
 * Si el Excel real tiene otra forma, se cambia mapearUsedRange() en kpiSource.js.
 */

// Orden en el que se muestran los sectores (los que no figuren van al final).
const ORDEN_SECTORES = ['Producción', 'Calidad', 'Logística', 'Compras', 'RRHH', 'Comercial'];

// Hojas a ignorar (portada, notas, tablas auxiliares, etc.).
const HOJAS_IGNORADAS = ['Portada', 'Índice', 'Indice', 'Notas', 'Config'];

// Alias opcional: nombre de hoja → nombre de sector a mostrar.
const ALIAS_SECTOR = {
  Prod: 'Producción',
  Cal: 'Calidad',
  Log: 'Logística',
};

// Nombres de columnas aceptados para cada campo (case-insensitive).
const COLUMNAS = {
  kpi: ['kpi', 'indicador', 'nombre'],
  unidad: ['unidad', 'um', 'u.m.'],
  meta: ['meta', 'objetivo', 'target'],
  sentido: ['sentido', 'direccion', 'dirección'],
};

module.exports = { ORDEN_SECTORES, HOJAS_IGNORADAS, ALIAS_SECTOR, COLUMNAS };
