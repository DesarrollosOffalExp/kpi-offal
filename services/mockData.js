// Datos de EJEMPLO del tablero, con la estructura REAL de la pestaña INSUMOS
// (tomados de los rangos declarados en config/kpiConfig.js). Se usan cuando faltan
// las credenciales de Graph. La forma de estos objetos ES el contrato que consume
// el frontend: cuando se conecte el Excel real, kpiSource devuelve esta estructura.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
const SEMANAS = ['S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31'];
const serie = (periodos, vals) => periodos.map((p, i) => ({ periodo: p, valor: vals[i] }));

// Series base (reutilizadas por KPIs y gráficos).
const RECEPCION = [100, 100, 100, 100, 100, 100];
const ENTREGA = [99.74, 99.63, 97.82, 97.91, 99.47, 99.57];
// Cerramiento por Bestpack (Cerradoras): KPI semanal vs. estándar (72) — fila 111.
const CERRAMIENTO = [65, 70, 73, 78, 66, 73, 64, 67, 76];
// Máximos de producción por semana, por máquina (Bestpack 1/2/3).
const BP1 = [165, 184, 182, 199, 146, 198, 161, 187, 190];
const BP2 = [149, 161, 179, 199, 165, 150, 151, 147, 195];
const BP3 = [152, 168, 168, 164, 164, 177, 146, 145, 161];
// Producción total por semana (comparativo semanal, todas las máquinas). Histórico.
const PROD_HIST_SEM = ['S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29'];
const PROD_HIST = [131151, 104523, 108596, 124286, 125108, 105281, 100126];

const INSUMOS = {
  key: 'insumos', nombre: 'Insumos', estado: 'ok', layout: 'stacked', objetivoPendiente: true,
  kpis: [
    // Principal (lo pidió gerencia): productividad de armado de cajas, con turno.
    { id: 'productividad', titulo: 'Productividad de armado de cajas', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      valor: 89, desglose: [{ nombre: 'Día', valor: 89 }, { nombre: 'Noche', valor: 89 }],
      info: 'Índice de armado: cajas por hora reales vs. ideal por formadora, semana en curso. Es el dato PRINCIPAL. (Hoja INSUMOS)' },
    { id: 'cerramiento', titulo: 'Cerramiento por Bestpack', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      serie: serie(SEMANAS, CERRAMIENTO),
      info: 'Cierre de cajas de las cerradoras (Bestpack) vs. estándar (72), por semana. Antes figuraba como "formadoras". (Hoja INSUMOS, fila 111)' },
    { id: 'recepcion', titulo: 'Eficiencia en Recepción', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      serie: serie(MESES, RECEPCION),
      info: 'Recepciones de materiales sin error sobre el total del mes. (Hoja INSUMOS, columna P — mensual)' },
    { id: 'entrega', titulo: 'Eficiencia en Entrega', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 99,
      serie: serie(MESES, ENTREGA),
      info: 'Egresos sin diferencias sobre el total de egresos del mes. (Hoja INSUMOS, columna U — mensual)' },
  ],
  graficos: [
    { tipo: 'bar', titulo: 'Cerrado por Bestpack — última semana', info: 'Máximo de producción de la última semana (S31) por máquina.',
      datos: [{ nombre: 'Bestpack 1', valor: 190 }, { nombre: 'Bestpack 2', valor: 195 }, { nombre: 'Bestpack 3', valor: 161 }] },
    { tipo: 'line', titulo: 'Máximos por Bestpack por semana', info: 'Comparativo semana a semana de la producción máxima de cada Bestpack.',
      periodos: SEMANAS, series: [{ nombre: 'Bestpack 1', datos: BP1 }, { nombre: 'Bestpack 2', datos: BP2 }, { nombre: 'Bestpack 3', datos: BP3 }] },
    { tipo: 'line', titulo: 'Producción por semana (histórico)', info: 'Producción total de armado de cajas, semana a semana. (Comparativo semanal por máquina — total.)',
      periodos: PROD_HIST_SEM, series: [{ nombre: 'Producción', datos: PROD_HIST }] },
    { tipo: 'line', titulo: 'Eficiencia mensual', info: 'Recepción vs. entrega de materiales, mes a mes.',
      periodos: MESES, series: [{ nombre: 'Recepción', datos: RECEPCION }, { nombre: 'Entrega', datos: ENTREGA }] },
  ],
};

// COMPRAS: foto de la última semana cargada (Semana 31). Valores tomados de la
// fila de la semana 31, columnas A→R de la hoja COMPRAS.
const COMPRAS = {
  key: 'compras', nombre: 'Compras', estado: 'ok', periodo: 'Semana 31', layout: 'stacked', objetivoPendiente: true,
  kpis: [
    // 1er conjunto: entender de dónde nace el total de pendientes.
    { id: 'pendientes', grupo: 'Pendientes y vencidos', titulo: 'Total Pendientes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 51,
      info: 'Total de requisiciones pendientes al cierre de la semana. (COMPRAS, columna O)' },
    { id: 'sin_tratar', grupo: 'Pendientes y vencidos', titulo: 'Requis sin Tratar', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 32,
      info: 'Requisiciones de la semana que quedaron sin gestionar. (COMPRAS, columna G)' },
    { id: 'vencidas', grupo: 'Pendientes y vencidos', titulo: 'Total Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      desglose: [{ nombre: 'Nuevas', valor: 6 }, { nombre: 'Viejas', valor: 11 }],
      info: 'Requisiciones vencidas (pasaron su plazo), con desglose entre nuevas y viejas. (COMPRAS, columna J; K nuevas / L viejas)' },
    { id: 'ant_vencidas', grupo: 'Pendientes y vencidos', titulo: 'Anteriores Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Requisiciones vencidas que vienen de semanas anteriores. (COMPRAS, columna A)' },
    { id: 'ant_sin_vencer', grupo: 'Pendientes y vencidos', titulo: 'Anteriores Sin Vencer', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 2,
      info: 'Requisiciones de semanas anteriores que aún no vencieron. (COMPRAS, columna B)' },
    // 2do conjunto: actividad de la semana.
    { id: 'requis_semana', grupo: 'Actividad de la semana', titulo: 'Requis de la Semana', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 137,
      info: 'Requisiciones de compra ingresadas en la semana. (COMPRAS, columna C)' },
    { id: 'tratadas', grupo: 'Actividad de la semana', titulo: 'Requis Tratadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 97,
      info: 'Requisiciones gestionadas / resueltas en la semana. (COMPRAS, columna D)' },
  ],
  graficos: [
    { tipo: 'bar', grupo: 'Pendientes y vencidos', titulo: 'Composición de pendientes', info: 'De qué se componen los pendientes de la última semana.',
      datos: [{ nombre: 'Por vencer', valor: 19 }, { nombre: 'En plazo', valor: 15 }, { nombre: 'Vencidas', valor: 17 }] },
    { tipo: 'bar', grupo: 'Actividad de la semana', titulo: 'Gestión de la semana', info: 'Flujo de requisiciones de la última semana: ingresadas, tratadas y las que quedaron.',
      datos: [{ nombre: 'Ingresadas', valor: 137 }, { nombre: 'Tratadas', valor: 97 }, { nombre: 'Sin tratar', valor: 32 }, { nombre: 'Rechazadas', valor: 1 }, { nombre: 'Anuladas', valor: 7 }] },
    // 3er conjunto: vencidas por semana (tendencia). El "desglose por antigüedad"
    // exacto que pidió gerencia necesita un dato adicional (ver notas).
    { tipo: 'line', grupo: 'Vencidas por semana', titulo: 'Vencidas por semana', info: 'Requisiciones vencidas registradas cada semana (tendencia).',
      periodos: ['S22', 'S23', 'S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31'],
      series: [{ nombre: 'Vencidas', datos: [34, 43, 106, 102, 95, 26, 35, 15, 17, 17] }] },
  ],
};

// FÁBRICA DE HIELO: productividad de la semana (tabla semanal que se sobrescribe).
// KPIs de la fila RESUMEN; gráficos de las filas diarias. Datos de la Semana 31.
const HIELO = {
  key: 'fábrica-de-hielo', nombre: 'Fábrica de Hielo', estado: 'ok', periodo: 'Semana 31', objetivoPendiente: true,
  kpis: [
    // --- Productividad ---
    { id: 'barras', grupo: 'Productividad', titulo: 'Barras producidas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 30680,
      info: 'Barras de hielo producidas en la semana (total). (FABRICA DE HIELO, resumen col. D)' },
    { id: 'prod_dia', grupo: 'Productividad', titulo: 'Productividad Hombre/Barra Día', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 1278,
      info: 'Productividad: barras por persona en la semana (barras / personal). (resumen col. E)' },
    { id: 'prod_hs', grupo: 'Productividad', titulo: 'Productividad Hom/Barra Hs', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 34,
      info: 'Productividad: barras por hora de máquina (barras / horas). (resumen col. G)' },
    { id: 'consumo', grupo: 'Productividad', titulo: 'Consumo', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 35085,
      info: 'Consumo total de la semana. (FABRICA DE HIELO, resumen col. H)' },
    { id: 'horas', grupo: 'Productividad', titulo: 'Horas trabajadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 899,
      info: 'Horas de máquina trabajadas en la semana (total). (resumen col. F)' },
    // --- Stock de pallets ---
    { id: 'pallets_nd', grupo: 'Stock de pallets', titulo: 'Pallets no devueltos', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 2102,
      desglose: [{ nombre: 'Enviados sem', valor: 313 }, { nombre: 'Recibidos sem', valor: 310 }],
      info: 'Pallets entregados a frigoríficos que aún no fueron devueltos (deuda de pallets). Corresponde a la semana anterior (sem. 30). (FABRICA DE HIELO, STOCK FINAL col. E; Enviados col. C, Recibidos col. D)' },
    // --- Monitoreo de barras (TOTALES de la semana) ---
    { id: 'kilos', grupo: 'Monitoreo de barras', titulo: 'Kilos procesados', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 2821979,
      info: 'Kilos totales recibidos de los proveedores en la semana. (MONITOREO DE BARRAS, TOTALES col. kilos)' },
    { id: 'barras_env', grupo: 'Monitoreo de barras', titulo: 'Barras enviadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 29358,
      info: 'Total de barras de hielo enviadas a los proveedores en la semana. (TOTALES, Barras Enviadas)' },
    { id: 'barras_usadas', grupo: 'Monitoreo de barras', titulo: 'Barras usadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 28649,
      info: 'Barras efectivamente usadas (enviadas − vendidas − devolución). (TOTALES, Barras Usadas)' },
    { id: 'promedio', grupo: 'Monitoreo de barras', titulo: 'Promedio barras/tambor', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 1.63,
      desglose: [{ nombre: 'Estimado', valor: 1.67 }, { nombre: 'Enviado', valor: 1.63 }],
      info: 'Promedio de barras por tambor. Se compara el estimado vs. el enviado. (TOTALES, promedios)' },
  ],
  graficos: [
    { tipo: 'bar', grupo: 'Productividad', titulo: 'Barras por día', info: 'Producción diaria de barras de hielo en la semana.',
      datos: [{ nombre: 'Lun', valor: 5920 }, { nombre: 'Mar', valor: 5920 }, { nombre: 'Mié', valor: 4040 }, { nombre: 'Jue', valor: 5920 }, { nombre: 'Vie', valor: 5920 }, { nombre: 'Sáb', valor: 2960 }] },
    { tipo: 'bar', grupo: 'Productividad', titulo: 'Consumo por día', info: 'Consumo diario en la semana.',
      datos: [{ nombre: 'Lun', valor: 7205 }, { nombre: 'Mar', valor: 7335 }, { nombre: 'Mié', valor: 6725 }, { nombre: 'Jue', valor: 6520 }, { nombre: 'Vie', valor: 1530 }, { nombre: 'Sáb', valor: 5770 }] },
    { tipo: 'bar', grupo: 'Stock de pallets', horizontal: true, titulo: 'Pallets no devueltos por frigorífico', info: 'Frigoríficos con más pallets sin devolver (top 10, semana anterior).',
      datos: [{ nombre: 'Congelados', valor: 363 }, { nombre: 'Supermercado', valor: 285 }, { nombre: 'Runfo', valor: 273 }, { nombre: 'Gorina', valor: 172 }, { nombre: 'Rioplat.', valor: 171 }, { nombre: 'Cordoba', valor: 111 }, { nombre: 'Frigolar', valor: 99 }, { nombre: 'Federal', valor: 90 }, { nombre: 'Cocarsa', valor: 88 }, { nombre: 'Faraon', valor: 86 }] },
    { tipo: 'bar', grupo: 'Monitoreo de barras', horizontal: true, titulo: 'Barras enviadas por proveedor', info: 'Proveedores con más barras enviadas (top 10).',
      datos: [{ nombre: 'Rioplatense', valor: 2904 }, { nombre: 'Cía. Bernal', valor: 2635 }, { nombre: 'Gorina', valor: 2397 }, { nombre: 'Bermejo', valor: 2210 }, { nombre: 'Runfo', valor: 1820 }, { nombre: 'Arre Beef', valor: 1620 }, { nombre: 'FRIAR 1970', valor: 1575 }, { nombre: 'Ecocarnes', valor: 1530 }, { nombre: 'Frigolar', valor: 1407 }, { nombre: 'Black Bamboo', valor: 1190 }] },
  ],
};

// SISTEMAS: foto de la última semana (misma mecánica que Compras). Semana 31.
const SISTEMAS = {
  key: 'sistemas', nombre: 'Sistemas', estado: 'ok', periodo: 'Semana 31', layout: 'stacked', objetivoPendiente: true,
  kpis: [
    // 1er conjunto: pendientes y vencidos (igual criterio que Compras).
    { id: 'abiertos', grupo: 'Pendientes y vencidos', titulo: 'Total de Abiertos', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 60,
      info: 'Total de tickets abiertos. (SISTEMAS, columna S)' },
    { id: 'pendientes', grupo: 'Pendientes y vencidos', titulo: 'Tickets Pendientes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Tickets que quedaron pendientes en la semana. (SISTEMAS, columna R)' },
    { id: 'vencidas', grupo: 'Pendientes y vencidos', titulo: 'Total Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Tickets vencidos (pasaron su plazo de atención). (SISTEMAS, columna U)' },
    { id: 'ant_vencidas', grupo: 'Pendientes y vencidos', titulo: 'Anteriores Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Tickets vencidos que vienen de semanas anteriores. (SISTEMAS, columna L)' },
    { id: 'ant_sin_vencer', grupo: 'Pendientes y vencidos', titulo: 'Anteriores Sin Vencer', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 27,
      info: 'Tickets de semanas anteriores que aún no vencieron. (SISTEMAS, columna M)' },
    // 2do conjunto: actividad de la semana.
    { id: 'tickets_semana', grupo: 'Actividad de la semana', titulo: 'Tickets de la Semana', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 77,
      info: 'Tickets ingresados en la semana. (SISTEMAS, columna N)' },
    { id: 'tratados', grupo: 'Actividad de la semana', titulo: 'Tickets Tratados', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 60,
      info: 'Tickets resueltos o gestionados en la semana. (SISTEMAS, columna O)' },
  ],
  graficos: [
    { tipo: 'bar', grupo: 'Actividad de la semana', titulo: 'Gestión de la semana', info: 'Flujo de tickets de la última semana: ingresados, tratados y pendientes.',
      datos: [{ nombre: 'Ingresados', valor: 77 }, { nombre: 'Tratados', valor: 60 }, { nombre: 'Pendientes', valor: 17 }] },
    { tipo: 'line', grupo: 'Vencidas por semana', titulo: 'Vencidas por semana', info: 'Tickets vencidos registrados cada semana (tendencia).',
      periodos: ['S24', 'S25', 'S26', 'S27', 'S28', 'S29', 'S30', 'S31'],
      series: [{ nombre: 'Vencidas', datos: [2, 1, 10, 6, 23, 10, 7, 17] }] },
  ],
};

// LOGÍSTICA: hoja con muchos bloques distintos (períodos mixtos) → sub-pestañas.
const G = { costo: 'Matriz de Costo · Junio', flota: 'Disponibilidad de Flota · Sem 30',
  lavado: 'Lavado de Camiones · Sem 30', tambores: 'Cuenta de Tambores · Sem 31',
  gasoil: 'Consumo de Gasoil · Sem 31', frig: 'Costo por Frigorífico · Sem 31', hiel: 'Stock de Hiel · Julio' };
// Rendimiento KG/LT semana a semana (S1–S31) para el histórico de gasoil.
const KGLT = [9.07, 6.19, 6.38, 6.79, 5.71, 3.75, 4.12, 5.15, 6.17, 6.30, 5.89, 6.31, 6.29, 7.90, 5.48, 6.11, 6.09, 5.16, 6.63, 6.11, 5.52, 5.66, 5.71, 6.16, 4.63, 5.32, 6.84, 6.61, 6.59, 6.67, 6.21];
const SALDO_HIEL = [1369, 1369, 3592, 3592, 3592, 6138, 3325, 4080, 4080, 4080, 5633, 5633, 9106, 6428, 3123, 3123, 4717, 4717, 4717, 6696, 4003, 5084, 2842, 4428, 4428, 4428, 5794, 2526, 3212, 4523, 1142];
const LOGISTICA = {
  key: 'logística', nombre: 'Logística', estado: 'ok', objetivoPendiente: true,
  kpis: [
    // Matriz de Costo (mensual, Junio)
    { id: 'costo_log', grupo: G.costo, titulo: 'Costo total de Logística', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 1051842271,
      info: 'Costo total del mes de Logística (Junio). (MATRIZ DE COSTO)' },
    { id: 'costo_general', grupo: G.costo, titulo: 'Costo General del mes', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 1176272936,
      info: 'Costo general del mes: descarga propios + fletes + lavado + taller. (MATRIZ DE COSTO)' },
    // Disponibilidad de Flota (Sem 30)
    { id: 'disp_general', grupo: G.flota, titulo: 'Disponibilidad de flota', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: null, valor: 84,
      desglose: [{ nombre: 'Disponibles', valor: 67 }, { nombre: 'Total', valor: 80 }],
      info: '67 de 80 unidades disponibles en la semana. (DISPONIBILIDAD DE FLOTA)' },
    { id: 'fuera_serv', grupo: G.flota, titulo: 'Unidades fuera de servicio', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 15,
      desglose: [{ nombre: 'Tractor', valor: 3 }, { nombre: 'Semi', valor: 11 }, { nombre: 'Bateas', valor: 1 }],
      info: 'Unidades con parada temporal (FS) en la semana. Las de baja permanente (FSP) NO se cuentan. Detalle en la tabla. (DISPONIBILIDAD DE FLOTA)' },
    // Lavado de Camiones (Sem 30)
    { id: 'camiones_lav', grupo: G.lavado, titulo: 'Camiones lavados', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 215,
      info: 'Total de camiones lavados en la semana. (LAVADO DE CAMIONES)' },
    { id: 'hs_lavado', grupo: G.lavado, titulo: 'Horas de lavado', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 686,
      info: 'Horas totales de lavado en la semana. (LAVADO DE CAMIONES)' },
    { id: 'operarios', grupo: G.lavado, titulo: 'Operarios presentes', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 21,
      desglose: [{ nombre: 'Por nómina', valor: 23 }], info: 'Operarios presentes vs. nómina. (LAVADO DE CAMIONES)' },
    // Cuenta de Tambores (Sem 31)
    { id: 'stock_tambores', grupo: G.tambores, titulo: 'Stock final de tambores', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: -280,
      desglose: [{ nombre: 'Enviados', valor: 18761 }, { nombre: 'Recibidos', valor: 18809 }],
      info: 'Stock final de tambores (negativo = a favor). Desglose por frigorífico en la tabla. (CUENTA DE TAMBORES)' },
    // Consumo de Gasoil (Sem 31)
    { id: 'kg_lt', grupo: G.gasoil, titulo: 'Rendimiento KG/LT', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 6.21,
      info: 'Kilos transportados por litro de gasoil. Más alto es mejor. Es el dato principal. (CONSUMO DE GASOIL)' },
    { id: 'total_lt', grupo: G.gasoil, titulo: 'Total litros (sem)', unidad: 'Lt', formato: 'numero', sentido: 'down', meta: null, valor: 8446,
      info: 'Litros de gasoil consumidos en la semana. (Total de Km recorridos: pendiente — no ubiqué la columna en la planilla.)' },
    { id: 'total_kg_gas', grupo: G.gasoil, titulo: 'Total Kg transportados', unidad: 'Kg', formato: 'numero', sentido: 'up', meta: null, valor: 2011585,
      info: 'Kilos transportados en la semana. (CONSUMO DE GASOIL)' },
    // Costo por Frigorífico (Sem 31) — el detalle completo va en la tabla.
    { id: 'valor_viajes', grupo: G.frig, titulo: 'Valor de los viajes', unidad: '', formato: 'moneda', sentido: 'up', meta: null, valor: 49033031,
      info: 'Valor total de los viajes de la semana. Detalle por frigorífico en la tabla. (COSTO POR FRIGORÍFICO)' },
    { id: 'kgs_transp', grupo: G.frig, titulo: 'Kgs transportados', unidad: 'Kg', formato: 'numero', sentido: 'up', meta: null, valor: 1294641,
      info: 'Kilos transportados a frigoríficos en la semana. (COSTO POR FRIGORÍFICO)' },
    { id: 'valor_exc', grupo: G.frig, titulo: 'Valor excedente', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 534057,
      info: 'Valor excedente total de los frigoríficos en la semana. (COSTO POR FRIGORÍFICO)' },
    // Stock de Hiel (diario, Julio)
    { id: 'saldo_hiel', grupo: G.hiel, titulo: 'Saldo de hiel', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 1142,
      info: 'Saldo de hiel al último día del mes (31/07). (STOCK DE HIEL)' },
  ],
  graficos: [
    { tipo: 'tabla', grupo: G.costo, titulo: 'Matriz de Costo (mes a mes)', info: 'Costos de logística por ítem, mes a mes (identificados por sector). (MATRIZ DE COSTO)',
      columnas: ['Ítem', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      filas: [
        ['Total mes Propios', '$ 170.311.650', '$ 135.284.531', '$ 225.726.369', '$ 147.618.376', '$ 174.169.228', '$ 251.927.671'],
        ['Total mes Fletes', '$ 556.192.701', '$ 604.028.315', '$ 701.667.920', '$ 516.434.800', '$ 637.802.650', '$ 799.914.600'],
        ['Total mes Logística', '$ 726.504.350', '$ 739.312.846', '$ 927.394.289', '$ 664.053.176', '$ 811.971.878', '$ 1.051.842.271'],
        ['Costo Logística $/kg', '$ 69,65', '$ 86,50', '$ 91,90', '$ 81,94', '$ 80,20', '$ 96,34'],
        ['Total mes Lavado', '$ 65.894.989', '$ 61.665.571', '$ 69.857.126', '$ 70.342.932', '$ 73.344.283', '$ 78.540.383'],
        ['Total mes Taller', '$ 41.309.801', '$ 64.853.812', '$ 46.625.124', '$ 74.493.537', '$ 112.892.410', '$ 45.890.383'],
        ['TOTAL GENERAL', '$ 833.709.140', '$ 865.832.229', '$ 1.043.876.539', '$ 808.889.645', '$ 998.208.572', '$ 1.176.272.936'],
        ['Total $/Tons Desc.', '$ 79.931', '$ 101.308', '$ 103.448', '$ 99.808', '$ 98.598', '$ 107.738'],
        ['Total $/Tons Prod.', '$ 130.778', '$ 160.683', '$ 197.041', '$ 166.918', '$ 166.831', '$ 193.767'],
      ] },
    { tipo: 'bar', grupo: G.flota, titulo: 'Disponibilidad por flota (%)', info: 'Disponibilidad por tipo de unidad (semana).',
      datos: [{ nombre: 'Tractor', valor: 94 }, { nombre: 'Torito', valor: 100 }, { nombre: 'Chasis', valor: 97 }, { nombre: 'Balancín', valor: 100 }, { nombre: 'Semi', valor: 80 }, { nombre: 'Bateas', valor: 92 }] },
    { tipo: 'tabla', grupo: G.flota, titulo: 'Patentes fuera de servicio (FS)', info: 'Unidades con parada temporal en la semana. No incluye las de baja permanente (FSP).',
      columnas: ['Dominio', 'Tipo', 'Marca', 'Días parado'],
      filas: [
        ['AC581KP', 'Tractor', 'Mercedes Benz', '6'], ['JNA841', 'Tractor', 'Mercedes Benz', '4'], ['AG252VK', 'Tractor', 'Mercedes Benz', '6'],
        ['FKP 957', 'Semi', 'Lambert', '6'], ['HRV 058', 'Semi', 'Astpra', '6'], ['IHZ 227', 'Semi', 'Astpra', '6'],
        ['IHZ 228', 'Semi', 'Astpra', '6'], ['IKO 415', 'Semi', 'Astpra', '6'], ['IMO 536', 'Semi', 'Astpra', '2'],
        ['JAP 922', 'Semi', 'Astpra', '6'], ['JNS 094', 'Semi', 'Astpra', '6'], ['LMD 345', 'Semi', 'Astpra', '6'],
        ['LMD 346', 'Semi', 'Astpra', '6'], ['MXC 712', 'Semi', 'Lambert', '6'], ['AC 427 IU', 'Batea', 'Gomatro', '4'],
      ] },
    { tipo: 'tabla', grupo: G.tambores, titulo: 'Cuenta de tambores por frigorífico', info: 'Stock de tambores por matadero (negativo = a favor).',
      columnas: ['Matadero', 'Anterior', 'Enviados', 'Recibidos', 'Stock Final'],
      filas: [
        ['Arroyo Seco (Ramallo)', '-45', '930', '984', '9'], ['Bermejo (Salta)', '30', '687', '704', '47'],
        ['C. Pampeanas', '-54', '500', '497', '-57'], ['Cañuelas', '0', '484', '484', '0'],
        ['Carindu', '-6', '536', '533', '-9'], ['Cocarsa', '-8', '884', '879', '-13'],
        ['Córdoba', '17', '376', '376', '17'], ['Faraón', '-19', '570', '569', '-20'],
        ['Federal', '0', '838', '834', '-4'], ['Finexcor', '-7', '1.398', '1.398', '-7'],
        ['Frigolar', '-38', '984', '982', '-40'], ['Gorina', '1', '1.738', '1.733', '-4'],
        ['Lobos', '-1', '268', '268', '-1'], ['Morón', '-16', '530', '530', '-16'],
        ['Penta', '0', '292', '292', '0'], ['Reconquista', '-89', '692', '689', '-92'],
        ['Rioplatense', '64', '2.292', '2.289', '61'], ['Runfo', '-25', '1.048', '1.064', '-9'],
        ['San Luis', '0', '500', '498', '-2'], ['Tolosa', '-1', '684', '685', '0'],
        ['Navarro', '2', '462', '462', '2'], ['Nelson', '-21', '500', '499', '-22'],
        ['P. G. Entrerriana', '-2', '392', '395', '1'], ['Black Bamboo', '-99', '500', '498', '-101'],
        ['Carcarañá', '20', '392', '392', '20'], ['Arroyo Seco', '-31', '284', '275', '-40'],
        ['TOTALES', '-328', '18.761', '18.809', '-280'],
      ] },
    { tipo: 'line', grupo: G.gasoil, titulo: 'Rendimiento KG/LT por semana', info: 'Tendencia del rendimiento (kilos por litro) semana a semana.',
      periodos: KGLT.map((_, i) => 'S' + (i + 1)), series: [{ nombre: 'KG/LT', datos: KGLT }] },
    { tipo: 'tabla', grupo: G.frig, titulo: 'Costos por frigorífico', info: 'Detalle por frigorífico: km, viajes, kilos, valor de viajes y excedente. Es el dato principal del bloque.',
      columnas: ['Proveedor', 'Km', 'Viajes', 'Kgs', 'Valor Viajes', 'Excedente'],
      filas: [
        ['Agroindustrias', '34,8', '6', '43.056', '$ 218.276', '—'], ['Arre Beef', '550', '10', '105.780', '$ 700.409', '$ 744.033'],
        ['Black Bamboo', '740', '3', '38.808', '$ 912.539', '$ 409.500'], ['Compañía Bernal', '37,8', '13', '92.510', '$ 267.364', '$ 1.529.667'],
        ['Ecocarnes', '142', '9', '81.941', '$ 298.165', '—'], ['El Chillén', '119', '5', '33.026', '$ 278.709', '—'],
        ['Frigolar', '108', '10', '103.499', '$ 267.364', '$ 218.617'], ['Gorina', '128', '23', '224.844', '$ 267.364', '$ 294.450'],
        ['Rioplatense', '159', '13', '119.955', '$ 331.825', '$ 144.083'], ['Gan. Las Pampas', '38,9', '3', '15.546', '$ 227.086', '—'],
        ['San Roque', '62,5', '6', '36.119', '$ 253.380', '—'], ['Tolosa', '168', '7', '65.068', '$ 340.483', '$ 102.700'],
        ['Menucar Lobos', '177', '3', '14.858', '$ 337.382', '—'], ['Mat. Federal', '32,1', '11', '83.878', '$ 217.523', '$ 8.450'],
        ['Runfo', '69,7', '12', '117.412', '$ 384.674', '$ 1.682.850'], ['Swift', '92,2', '—', '0', '$ 263.611', '$ 736.233'],
        ['Tresnal', '216', '8', '41.218', '$ 356.914', '$ 32.500'], ['Velsud', '20', '9', '49.337', '$ 203.439', '—'],
        ['TOTALES', '—', '156', '1.294.641', '$ 49.033.031', '$ 534.057'],
      ] },
    { tipo: 'line', grupo: G.hiel, titulo: 'Saldo de hiel diario (Julio)', info: 'Evolución del saldo de hiel día a día en el mes.',
      periodos: SALDO_HIEL.map((_, i) => String(i + 1)), series: [{ nombre: 'Saldo', datos: SALDO_HIEL }] },
  ],
};

function construirMock() {
  return {
    origen: 'mock',
    actualizado: new Date().toISOString(),
    sectores: [INSUMOS, COMPRAS, HIELO, LOGISTICA, SISTEMAS],
  };
}

module.exports = { construirMock };
