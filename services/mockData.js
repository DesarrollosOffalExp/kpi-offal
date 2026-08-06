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
const FORMADORAS = [65, 70, 73, 78, 66, 73, 64, 67, 41];

const INSUMOS = {
  key: 'insumos', nombre: 'Insumos', estado: 'ok',
  kpis: [
    { id: 'recepcion', titulo: 'Eficiencia en Recepción', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      serie: serie(MESES, RECEPCION),
      info: 'Recepciones de materiales sin error sobre el total del mes. 100% = ninguna recepción con error. (Hoja INSUMOS, columna P — mensual)' },
    { id: 'entrega', titulo: 'Eficiencia en Entrega', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 99,
      serie: serie(MESES, ENTREGA),
      info: 'Egresos sin diferencias sobre el total de egresos del mes. Más alto es mejor. (Hoja INSUMOS, columna U — mensual)' },
    { id: 'formadoras', titulo: 'Cumplimiento de Formadoras', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      serie: serie(SEMANAS, FORMADORAS),
      info: 'Máximo de producción de las formadoras respecto del estándar (72 cajas), por semana. 100% = alcanzó el estándar. (Hoja INSUMOS, fila 111 — semanal)' },
    { id: 'productividad', titulo: 'Productividad de armado de cajas', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      valor: 89, desglose: [{ nombre: 'Día', valor: 89 }, { nombre: 'Noche', valor: 89 }],
      info: 'Índice de armado: cajas por hora reales vs. ideal por formadora, en la semana en curso. Con desglose por turno. (Hoja INSUMOS)' },
  ],
  graficos: [
    { tipo: 'line', titulo: 'Eficiencia mensual', info: 'Recepción vs. entrega de materiales, mes a mes.',
      periodos: MESES, series: [{ nombre: 'Recepción', datos: RECEPCION }, { nombre: 'Entrega', datos: ENTREGA }] },
    { tipo: 'bar', titulo: 'Cumplimiento de formadoras por semana', info: 'KPI semanal de las formadoras vs. estándar (72 cajas).',
      datos: SEMANAS.map((s, i) => ({ nombre: s, valor: FORMADORAS[i] })) },
  ],
};

// COMPRAS: foto de la última semana cargada (Semana 31). Valores tomados de la
// fila de la semana 31, columnas A→R de la hoja COMPRAS.
const COMPRAS = {
  key: 'compras', nombre: 'Compras', estado: 'ok', periodo: 'Semana 31',
  kpis: [
    { id: 'requis_semana', titulo: 'Requis de la Semana', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 137,
      info: 'Requisiciones de compra ingresadas en la semana. (COMPRAS, columna C)' },
    { id: 'tratadas', titulo: 'Requis Tratadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 97,
      info: 'Requisiciones gestionadas / resueltas en la semana. (COMPRAS, columna D)' },
    { id: 'sin_tratar', titulo: 'Requis sin Tratar', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 32,
      info: 'Requisiciones de la semana que quedaron sin gestionar. (COMPRAS, columna G)' },
    { id: 'pendientes', titulo: 'Total Pendientes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 51,
      info: 'Total de requisiciones pendientes al cierre de la semana. (COMPRAS, columna O)' },
    { id: 'vencidas', titulo: 'Total Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      desglose: [{ nombre: 'Nuevas', valor: 6 }, { nombre: 'Viejas', valor: 11 }],
      info: 'Requisiciones vencidas (pasaron su plazo), con desglose entre nuevas y viejas. (COMPRAS, columna J; K nuevas / L viejas)' },
    { id: 'urgentes', titulo: 'Urgentes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 3,
      info: 'Requisiciones urgentes pendientes. (COMPRAS, columna P)' },
  ],
  graficos: [
    { tipo: 'bar', titulo: 'Gestión de la semana', info: 'Flujo de requisiciones de la última semana: ingresadas, tratadas y las que quedaron.',
      datos: [{ nombre: 'Ingresadas', valor: 137 }, { nombre: 'Tratadas', valor: 97 }, { nombre: 'Sin tratar', valor: 32 }, { nombre: 'Rechazadas', valor: 1 }, { nombre: 'Anuladas', valor: 7 }] },
    { tipo: 'bar', titulo: 'Composición de pendientes', info: 'De qué se componen los pendientes de la última semana.',
      datos: [{ nombre: 'Por vencer', valor: 19 }, { nombre: 'En plazo', valor: 15 }, { nombre: 'Vencidas', valor: 17 }] },
  ],
};

// FÁBRICA DE HIELO: productividad de la semana (tabla semanal que se sobrescribe).
// KPIs de la fila RESUMEN; gráficos de las filas diarias. Datos de la Semana 31.
const HIELO = {
  key: 'fábrica-de-hielo', nombre: 'Fábrica de Hielo', estado: 'ok', periodo: 'Semana 31',
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
  key: 'sistemas', nombre: 'Sistemas', estado: 'ok', periodo: 'Semana 31',
  kpis: [
    { id: 'tickets_semana', titulo: 'Tickets de la Semana', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 77,
      info: 'Tickets ingresados en la semana. (SISTEMAS, columna N)' },
    { id: 'tratados', titulo: 'Tickets Tratados', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 60,
      info: 'Tickets resueltos o gestionados en la semana. (SISTEMAS, columna O)' },
    { id: 'pendientes', titulo: 'Tickets Pendientes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Tickets que quedaron pendientes en la semana. (SISTEMAS, columna R)' },
    { id: 'abiertos', titulo: 'Total de Abiertos', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 60,
      info: 'Total de tickets abiertos. (SISTEMAS, columna S)' },
    { id: 'vencidas', titulo: 'Total Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Tickets vencidos (pasaron su plazo de atención). (SISTEMAS, columna U)' },
    { id: 'por_vencer', titulo: 'En término por vencer', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 21,
      info: 'Tickets en término, próximos a vencer. (SISTEMAS, columna X)' },
  ],
  graficos: [
    { tipo: 'bar', titulo: 'Gestión de la semana', info: 'Flujo de tickets de la última semana: ingresados, tratados y pendientes.',
      datos: [{ nombre: 'Ingresados', valor: 77 }, { nombre: 'Tratados', valor: 60 }, { nombre: 'Pendientes', valor: 17 }] },
  ],
};

// LOGÍSTICA: hoja con 6 bloques distintos (períodos mixtos) → se agrupan en
// secciones. Valores de la última carga (Matriz de Costo mensual = Junio; resto semanal).
const G = { costo: 'Matriz de Costo · mensual (Junio)', flota: 'Disponibilidad de Flota · Sem 30',
  lavado: 'Lavado de Camiones · Sem 30', tambores: 'Cuenta de Tambores · Sem 31',
  gasoil: 'Consumo de Gasoil · Sem 31', frig: 'Costo por Frigorífico · Sem 31' };
const LOGISTICA = {
  key: 'logística', nombre: 'Logística', estado: 'ok',
  kpis: [
    // Matriz de Costo (mensual, Junio)
    { id: 'costo_log', grupo: G.costo, titulo: 'Costo total de Logística', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 1051942271,
      info: 'Costo total del mes de Logística. Se filtra por mes (el mes está en la fila 19). (MATRIZ DE COSTO)' },
    { id: 'costo_general', grupo: G.costo, titulo: 'Costo General del mes', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 1176272936,
      info: 'Costo general del mes (incluye descarga, fletes y lavatachos). (MATRIZ DE COSTO)' },
    // Disponibilidad de Flota (Sem 30)
    { id: 'disp_general', grupo: G.flota, titulo: 'Disponibilidad de flota', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: null, valor: 84,
      desglose: [{ nombre: 'Disponibles', valor: 67 }, { nombre: 'Total', valor: 80 }],
      info: '67 de 80 unidades disponibles en la semana. (DISPONIBILIDAD DE FLOTA)' },
    { id: 'fuera_serv', grupo: G.flota, titulo: 'Unidades fuera de servicio', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 13,
      info: 'Unidades de la flota fuera de servicio en la semana. (DISPONIBILIDAD DE FLOTA)' },
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
      info: 'Stock final de tambores por matadero (negativo = a favor). (CUENTA DE TAMBORES)' },
    // Consumo de Gasoil (Sem 31)
    { id: 'kg_lt', grupo: G.gasoil, titulo: 'Rendimiento KG/LT', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 6.21,
      info: 'Kilos transportados por litro de gasoil en la semana. Más alto es mejor. (CONSUMO DE GASOIL)' },
    { id: 'total_lt', grupo: G.gasoil, titulo: 'Total litros (sem)', unidad: 'Lt', formato: 'numero', sentido: 'down', meta: null, valor: 8446,
      info: 'Litros de gasoil consumidos en la semana. (CONSUMO DE GASOIL)' },
    { id: 'total_kg_gas', grupo: G.gasoil, titulo: 'Total Kg transportados', unidad: 'Kg', formato: 'numero', sentido: 'up', meta: null, valor: 2011585,
      info: 'Kilos transportados en la semana. (CONSUMO DE GASOIL)' },
    // Costo por Frigorífico (Sem 31)
    { id: 'valor_viajes', grupo: G.frig, titulo: 'Valor de los viajes', unidad: '', formato: 'moneda', sentido: 'up', meta: null, valor: 49033031,
      info: 'Valor total de los viajes de la semana. (COSTO POR FRIGORÍFICO)' },
    { id: 'kgs_transp', grupo: G.frig, titulo: 'Kgs transportados', unidad: 'Kg', formato: 'numero', sentido: 'up', meta: null, valor: 1294641,
      info: 'Kilos transportados a frigoríficos en la semana. (COSTO POR FRIGORÍFICO)' },
    { id: 'valor_exc', grupo: G.frig, titulo: 'Valor excedente', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 534057,
      info: 'Valor excedente total de los frigoríficos en la semana. (COSTO POR FRIGORÍFICO)' },
  ],
  graficos: [
    { tipo: 'line', grupo: G.costo, titulo: 'Costo de Logística mensual', info: 'Evolución del costo total de Logística mes a mes ($).',
      periodos: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      series: [{ nombre: 'Costo Logística', datos: [728504360, 799312646, 927394289, 664053176, 811971678, 1051942271] }] },
    { tipo: 'bar', grupo: G.flota, titulo: 'Disponibilidad por flota (%)', info: 'Indicador de disponibilidad por tipo de unidad (semana).',
      datos: [{ nombre: 'Tractor', valor: 94 }, { nombre: 'Torito', valor: 100 }, { nombre: 'Chasis', valor: 97 }, { nombre: 'Balancín', valor: 100 }, { nombre: 'Semi', valor: 80 }, { nombre: 'Bateas', valor: 92 }] },
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
