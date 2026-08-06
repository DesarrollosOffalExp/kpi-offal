/**
 * Mapeo del Excel de KPIs → modelo del tablero, POR RANGOS EXPLÍCITOS.
 *
 * El KPI.xlsx no es una tabla simple: cada pestaña tiene varios bloques en
 * posiciones fijas y se refresca semana a semana sobre las MISMAS celdas. Por eso
 * el mapeo declara, para cada indicador, el rango exacto (notación A1) de donde se
 * leen las etiquetas de período y los valores. Cuando cambie el Excel, se ajusta acá.
 *
 * Estructura de cada KPI:
 *   id, titulo, unidad, formato ('porcentaje'|'numero'|'moneda'), sentido ('up'|'down'), meta
 *   info        → texto de ayuda que se muestra al usuario (ícono ⓘ)
 *   periodicidad→ 'mensual' | 'semanal'
 *   periodos    → { range } con las etiquetas (ej. meses en K7:K18)
 *   valores     → { range } con los valores (ej. % en P7:P18)
 *   -- o, para un indicador de valor único (sin serie): --
 *   tipo:'valor', valor:{ cell }, desglose:[{ nombre, cell }]
 *
 * Nota Graph: al leer con valuesOnly, los porcentajes vienen como fracción (0.9974).
 * kpiSource los normaliza a 0-100 cuando el formato es 'porcentaje'.
 */

const HOJAS = [
  {
    sheet: 'INSUMOS',
    sector: 'Insumos',
    kpis: [
      {
        id: 'recepcion', titulo: 'Eficiencia en Recepción', unidad: '%', formato: 'porcentaje',
        sentido: 'up', meta: 100, periodicidad: 'mensual',
        periodos: { range: 'K7:K18' }, valores: { range: 'P7:P18' },
        info: 'Recepciones de materiales sin error sobre el total del mes. 100% = ninguna recepción con error. (Hoja INSUMOS, columna P — mensual)',
      },
      {
        id: 'entrega', titulo: 'Eficiencia en Entrega', unidad: '%', formato: 'porcentaje',
        sentido: 'up', meta: 99, periodicidad: 'mensual',
        periodos: { range: 'R7:R18' }, valores: { range: 'U7:U18' },
        info: 'Egresos sin diferencias sobre el total de egresos del mes. Más alto es mejor. (Hoja INSUMOS, columna U — mensual)',
      },
      {
        id: 'formadoras', titulo: 'Cumplimiento de Formadoras', unidad: '%', formato: 'porcentaje',
        sentido: 'up', meta: 100, periodicidad: 'semanal',
        periodos: { range: 'B105:J105' }, valores: { range: 'B111:J111' },
        info: 'Máximo de producción de las formadoras respecto del estándar (72 cajas), por semana. 100% = alcanzó el estándar. (Hoja INSUMOS, fila 111 — semanal)',
      },
      {
        id: 'productividad', titulo: 'Productividad de armado de cajas', unidad: '%', formato: 'porcentaje',
        sentido: 'up', meta: 100, tipo: 'valor',
        valor: { cell: 'G14' },
        desglose: [{ nombre: 'Día', cell: 'G22' }, { nombre: 'Noche', cell: 'G30' }],
        info: 'Índice de armado: cajas por hora reales vs. ideal por formadora, en la semana en curso. Con desglose por turno. (Hoja INSUMOS)',
      },
    ],
    graficos: [
      { tipo: 'line', titulo: 'Eficiencia mensual', info: 'Recepción vs. entrega de materiales, mes a mes.', desde: ['recepcion', 'entrega'] },
      { tipo: 'bar', titulo: 'Cumplimiento de formadoras por semana', info: 'KPI semanal de las formadoras vs. estándar (72 cajas).', desde: 'formadoras' },
    ],
  },

  {
    // COMPRAS se lee distinto: NO es una serie. Cada fila es una semana; se toma
    // SOLO la fila de la ÚLTIMA semana cargada (máximo de la columna I) y se leen
    // las columnas A→R de esa fila. Es la foto de la semana en curso.
    sheet: 'COMPRAS',
    sector: 'Compras',
    modo: 'ultimaSemana',
    columnaSemana: 'I',                 // número de semana
    filas: { desde: 5, hasta: 120 },    // rango donde viven las filas semanales
    kpis: [
      { id: 'requis_semana', titulo: 'Requis de la Semana', col: 'C', formato: 'numero', sentido: 'up',
        info: 'Requisiciones de compra ingresadas en la semana. (COMPRAS, columna C)' },
      { id: 'tratadas', titulo: 'Requis Tratadas', col: 'D', formato: 'numero', sentido: 'up',
        info: 'Requisiciones gestionadas / resueltas en la semana. (COMPRAS, columna D)' },
      { id: 'sin_tratar', titulo: 'Requis sin Tratar', col: 'G', formato: 'numero', sentido: 'down',
        info: 'Requisiciones de la semana que quedaron sin gestionar. (COMPRAS, columna G)' },
      { id: 'pendientes', titulo: 'Total Pendientes', col: 'O', formato: 'numero', sentido: 'down',
        info: 'Total de requisiciones pendientes al cierre de la semana. (COMPRAS, columna O)' },
      { id: 'vencidas', titulo: 'Total Vencidas', col: 'J', formato: 'numero', sentido: 'down',
        desglose: [{ nombre: 'Nuevas', col: 'K' }, { nombre: 'Viejas', col: 'L' }],
        info: 'Requisiciones vencidas (pasaron su plazo), con desglose entre nuevas y viejas. (COMPRAS, columna J; K nuevas / L viejas)' },
      { id: 'urgentes', titulo: 'Urgentes', col: 'P', formato: 'numero', sentido: 'down',
        info: 'Requisiciones urgentes pendientes. (COMPRAS, columna P)' },
    ],
    graficos: [
      { tipo: 'bar', titulo: 'Gestión de la semana', info: 'Flujo de requisiciones de la última semana: ingresadas, tratadas y las que quedaron.',
        columnas: [{ nombre: 'Ingresadas', col: 'C' }, { nombre: 'Tratadas', col: 'D' }, { nombre: 'Sin tratar', col: 'G' }, { nombre: 'Rechazadas', col: 'E' }, { nombre: 'Anuladas', col: 'F' }] },
      { tipo: 'bar', titulo: 'Composición de pendientes', info: 'De qué se componen los pendientes de la última semana.',
        columnas: [{ nombre: 'Por vencer', col: 'M' }, { nombre: 'En plazo', col: 'N' }, { nombre: 'Vencidas', col: 'J' }] },
    ],
  },

  // Pendientes: se completan cuando lleguen las pestañas correspondientes.
  { sheet: 'FABRICA DE HIELO', sector: 'Fábrica de Hielo', pendiente: true },
  { sheet: 'LOGISTICA', sector: 'Logística', pendiente: true },
  { sheet: 'SISTEMAS', sector: 'Sistemas', pendiente: true },
];

// Orden de los sectores en el tablero.
const ORDEN_SECTORES = HOJAS.map((h) => h.sector);

module.exports = { HOJAS, ORDEN_SECTORES };
