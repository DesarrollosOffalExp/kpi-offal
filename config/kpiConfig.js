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
    // las columnas A→O de esa fila. El cuadro va de A a O, hasta la fila 34.
    sheet: 'COMPRAS',
    sector: 'Compras',
    modo: 'ultimaSemana',
    columnaSemana: 'I',                 // número de semana
    columnas: { desde: 'A', hasta: 'O' },
    filas: { desde: 5, hasta: 34 },     // el cuadro llega hasta la fila 34
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

  {
    // FÁBRICA DE HIELO: tabla semanal completa (se sobrescribe cada semana). Los
    // KPIs salen de la fila RESUMEN (fila 106) y los gráficos de las filas diarias
    // (Lun→Dom, en filas 93,95,…,105 con filas en blanco intercaladas → se filtran).
    sheet: 'FABRICA DE HIELO',
    sector: 'Fábrica de Hielo',
    periodoCell: 'A89',                 // "SEMANA 31"
    // La hoja tiene 3 bloques → se agrupan con `grupo` para mostrarlos separados.
    kpis: [
      // --- Productividad (RESUMEN, fila 106) ---
      { id: 'barras', grupo: 'Productividad', titulo: 'Barras producidas', unidad: '', formato: 'numero', sentido: 'up', tipo: 'valor', valor: { cell: 'D106' },
        info: 'Barras de hielo producidas en la semana (total). (FABRICA DE HIELO, resumen col. D)' },
      { id: 'prod_dia', grupo: 'Productividad', titulo: 'Productividad Hombre/Barra Día', unidad: '', formato: 'numero', sentido: 'up', tipo: 'valor', valor: { cell: 'E106' },
        info: 'Productividad: barras por persona en la semana (barras / personal). (resumen col. E)' },
      { id: 'prod_hs', grupo: 'Productividad', titulo: 'Productividad Hom/Barra Hs', unidad: '', formato: 'numero', sentido: 'up', tipo: 'valor', valor: { cell: 'G106' },
        info: 'Productividad: barras por hora de máquina (barras / horas). (resumen col. G)' },
      { id: 'consumo', grupo: 'Productividad', titulo: 'Consumo', unidad: '', formato: 'numero', sentido: 'down', tipo: 'valor', valor: { cell: 'H106' },
        info: 'Consumo total de la semana. (FABRICA DE HIELO, resumen col. H)' },
      { id: 'horas', grupo: 'Productividad', titulo: 'Horas trabajadas', unidad: '', formato: 'numero', sentido: 'up', tipo: 'valor', valor: { cell: 'F106' },
        info: 'Horas de máquina trabajadas en la semana (total). (resumen col. F)' },
      // --- Stock de pallets (STOCK FINAL, fila 84; semana anterior) ---
      { id: 'pallets_nd', grupo: 'Stock de pallets', titulo: 'Pallets no devueltos', unidad: '', formato: 'numero', sentido: 'down', tipo: 'valor', valor: { cell: 'E84' },
        desglose: [{ nombre: 'Enviados sem', cell: 'C84' }, { nombre: 'Recibidos sem', cell: 'D84' }],
        info: 'Pallets entregados a frigoríficos que aún no fueron devueltos (deuda de pallets). Corresponde a la semana anterior (sem. 30). (FABRICA DE HIELO, STOCK FINAL col. E; Enviados col. C, Recibidos col. D)' },
      // --- Monitoreo de barras (TOTALES) ---
      // ⚠️ FILAS A CONFIRMAR: falta el screenshot con números de fila de este bloque
      // para fijar los rangos exactos (fila TOTALES y filas de proveedores). Columnas
      // mapeadas: A=Proveedor, B=kilos, H=Barras Enviadas, K=Barras Usadas, L=Prom.Estimado,
      // M=Prom.Enviados. Hoy vive en mock; se cablea al confirmar filas.
    ],
    graficos: [
      { tipo: 'bar', grupo: 'Productividad', titulo: 'Barras por día', info: 'Producción diaria de barras de hielo en la semana.',
        categorias: { range: 'A93:A105' }, valores: { range: 'D93:D105' } },
      { tipo: 'bar', grupo: 'Productividad', titulo: 'Consumo por día', info: 'Consumo diario en la semana.',
        categorias: { range: 'A93:A105' }, valores: { range: 'H93:H105' } },
      { tipo: 'bar', grupo: 'Stock de pallets', horizontal: true, titulo: 'Pallets no devueltos por frigorífico', info: 'Frigoríficos con más pallets sin devolver (top 10, semana anterior).',
        categorias: { range: 'A56:A83' }, valores: { range: 'E56:E83' }, top: 10 },
    ],
  },

  {
    // LOGÍSTICA: hoja con 6 bloques DISTINTOS, cada uno con su mecánica:
    //   1. Matriz de Costo    → mensual (el mes está en la fila 19); se toma el último mes.
    //   2. Disponibilidad de Flota → semanal (nuevo arriba); tabla por tipo de unidad.
    //   3. Cuenta de Tambores → semanal, cuadro completo (stock por matadero).
    //   4. Consumo de Gasoil  → semanal, cuadro completo (serie por semana, KG/LT).
    //   5. Costo por Frigorífico → semanal, cuadro completo (por proveedor).
    //   6. Lavado de Camiones → semanal (camiones/hs/operarios).
    // Se muestran agrupados en secciones (grupo). ⚠️ RANGOS A CONFIRMAR: los
    // screenshots recibidos están muy alejados para leer las celdas exactas de
    // cada bloque. Hoy Logística vive en mock/demo con los valores legibles; para
    // cablear el Excel real falta un screenshot por bloque con números de fila/columna.
    // Hasta entonces se marca pendiente para que el lector no intente rangos inválidos.
    sheet: 'LOGISTICA',
    sector: 'Logística',
    pendiente: true,
  },

  {
    // SISTEMAS: misma mecánica que COMPRAS (una fila = la última semana), pero en
    // columnas L→AA y con el número de semana en la columna T. Son tickets.
    sheet: 'SISTEMAS',
    sector: 'Sistemas',
    modo: 'ultimaSemana',
    columnaSemana: 'T',
    filas: { desde: 8, hasta: 60 },
    columnas: { desde: 'L', hasta: 'AA' },
    kpis: [
      { id: 'tickets_semana', titulo: 'Tickets de la Semana', col: 'N', formato: 'numero', sentido: 'up',
        info: 'Tickets ingresados en la semana. (SISTEMAS, columna N)' },
      { id: 'tratados', titulo: 'Tickets Tratados', col: 'O', formato: 'numero', sentido: 'up',
        info: 'Tickets resueltos o gestionados en la semana. (SISTEMAS, columna O)' },
      { id: 'pendientes', titulo: 'Tickets Pendientes', col: 'R', formato: 'numero', sentido: 'down',
        info: 'Tickets que quedaron pendientes en la semana. (SISTEMAS, columna R)' },
      { id: 'abiertos', titulo: 'Total de Abiertos', col: 'S', formato: 'numero', sentido: 'down',
        info: 'Total de tickets abiertos. (SISTEMAS, columna S)' },
      { id: 'vencidas', titulo: 'Total Vencidas', col: 'U', formato: 'numero', sentido: 'down',
        info: 'Tickets vencidos (pasaron su plazo de atención). (SISTEMAS, columna U)' },
      { id: 'por_vencer', titulo: 'En término por vencer', col: 'X', formato: 'numero', sentido: 'down',
        info: 'Tickets en término, próximos a vencer. (SISTEMAS, columna X)' },
    ],
    graficos: [
      { tipo: 'bar', titulo: 'Gestión de la semana', info: 'Flujo de tickets de la última semana: ingresados, tratados y pendientes.',
        columnas: [{ nombre: 'Ingresados', col: 'N' }, { nombre: 'Tratados', col: 'O' }, { nombre: 'Pendientes', col: 'R' }] },
    ],
  },
];

// Orden de los sectores en el tablero.
const ORDEN_SECTORES = HOJAS.map((h) => h.sector);

module.exports = { HOJAS, ORDEN_SECTORES };
