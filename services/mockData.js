// Datos de EJEMPLO del tablero, con la estructura REAL de la pestaña INSUMOS
// (tomados de los rangos declarados en config/kpiConfig.js). Se usan cuando faltan
// las credenciales de Graph. La forma de estos objetos ES el contrato que consume
// el frontend: cuando se conecte el Excel real, kpiSource devuelve esta estructura.

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul"];
const serie = (periodos, vals) => periodos.map((p, i) => ({ periodo: p, valor: vals[i] }));

// Series base (reutilizadas por KPIs y gráficos).
// Hoja KPIs de "Indicadores Insumos - 2026": N° 5 (recepción) y N° 7 (entrega).
// Se actualizan con `node tools/actualizar.js insumos`.
const RECEPCION = [100,100,100,100,100,100,100];
const ENTREGA = [99.74,99.63,97.82,97.91,99.47,99.57,100];

const INSUMOS = {
  key: 'insumos', nombre: 'Insumos', estado: 'ok', objetivoPendiente: true,
  // Cuadro de KPIs asignados (hoja "Insumos" del archivo KPI Gerencia de Operaciones 2026).
  objetivos: {"persona":"Luis Ramos","total":3,"meses":["Ene","Feb","Mar","Abr","May","Jun","Jul"],"filas":[{"n":"1","objetivo":"REDUCIR EL WORKING CAPITAL INMOVILIZADO UN 10 %","kpi":"CANTIDAD DE MATERIALES OBSOLETOS A ENERO 2026 VS DICIEMBRE 2026","area":"Insumos","meta":"3%","vals":["31%","","","","2%","1%","1%"]},{"n":"2","objetivo":"REDUCIR EL WORKING CAPITAL INMOVILIZADO UN 10 %","kpi":"CANTIDAD DE MATERIALES CON SOBRESTOCK ENERO 2026 VS DICIEMBRE 2026","area":"Insumos","meta":"20%","vals":["34%","","","","17%","18%","17%"]},{"n":"3","objetivo":"REDUCIR EL WORKING CAPITAL INMOVILIZADO UN 10 %","kpi":"DIAS DE STOCK DE INSUMOS PRODUCTIVOS ENERO 2025 VS DICIEMBRE 2026","area":"Insumos","meta":"20%","vals":["30%","","","","27%","27%","24%"]},{"n":"4","objetivo":"Cumplimiento >70%","kpi":"INFORMES DE GESTION","area":"Insumos","meta":"","vals":["","","","","","",""]}],"promedio":null},
  kpis: [
    // Productividad de Armado de Cajas (embebido; ProductividadArmado.jsx). Solo registra el grupo/subtab.
    { id: 'prod_armado', grupo: 'Productividad de Armado de Cajas', titulo: 'Productividad de Armado de Cajas', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100, valor: null,
      info: 'Índice de cajas por hora vs. ideal por formadora y turno, por semana (hoja Prod. Armado de Cajas).' },
    // Merma de Cajas (embebido; MermaCajas.jsx). Solo registra el grupo/subtab.
    { id: 'merma_cajas', grupo: 'Merma de Cajas', titulo: 'Merma de Cajas', unidad: '%', formato: 'porcentaje', sentido: 'down', meta: null, valor: null,
      info: 'Planchas utilizadas vs. cajas producidas por tipo de caja y mes (hoja 2 · Consumos Depósito + Producción).' },
    // Productividad en Cerrado de Cajas (embebido; ProductividadCerrado.jsx). Solo registra el grupo/subtab.
    { id: 'cerrado_cajas', grupo: 'Productividad en Cerrado de Cajas', titulo: 'Productividad en Cerrado de Cajas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: null,
      info: 'Cajas cerradas por las Bestpack, picos y máximos por máquina y mes (Picos de empaque TPM · réplica de Comparativo_Semanal).' },
    // Sección Eficiencia de materiales.
    { id: 'recepcion', grupo: 'Eficiencia de materiales', titulo: 'Eficiencia en Recepción', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 100,
      serie: serie(MESES, RECEPCION),
      info: 'Recepciones de materiales sin error sobre el total del mes. (Hoja INSUMOS, columna P · mensual)' },
    { id: 'entrega', grupo: 'Eficiencia de materiales', titulo: 'Eficiencia en Entrega', unidad: '%', formato: 'porcentaje', sentido: 'up', meta: 99,
      serie: serie(MESES, ENTREGA),
      info: 'Egresos sin diferencias sobre el total de egresos del mes. (Hoja INSUMOS, columna U · mensual)' },
  ],
  graficos: [
    { tipo: 'line', grupo: 'Eficiencia de materiales', titulo: 'Eficiencia mensual', info: 'Recepción vs. entrega de materiales, mes a mes.',
      periodos: MESES, series: [{ nombre: 'Recepción', datos: RECEPCION }, { nombre: 'Entrega', datos: ENTREGA }] },
    // Presupuesto (embebido; PresupuestoInsumos.jsx). Solo registra el grupo/subtab, va
    // último para que Presupuesto y Objetivo queden como los dos últimos de la ventana.
    { tipo: 'tabla', grupo: 'Presupuesto', titulo: 'Presupuesto', info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Insumos).', columnas: [], filas: [] },
  ],
};

// COMPRAS: foto de la última semana cargada (Semana 31). Valores tomados de la
// fila de la semana 34, columnas A→R de la hoja KPI.
const COMPRAS = {
  key: 'compras', nombre: 'Compras', estado: 'ok', objetivoPendiente: true,
  // Cuadro de KPIs asignados (hoja "Compras" del archivo KPI Gerencia de Operaciones 2026).
  objetivos: {"persona":"Juan Retamero","total":5,"meses":["Ene","Feb","Mar","Abr","May","Jun","Jul"],"filas":[{"n":"1","objetivo":"Mejorar un 10% el costo por tonelada mediante la mejora de costos de compras","kpi":"SE DEBE SACAR EL INFORME \"IMFORME DE PRECIOS PROMEDIO PONDERADO\" (ES EL UNICO QUE ENCONTRAMOS QUE TIRABA LOS PRECIOS DE LOS MATERIALES) MES A MES Y SE LO DEBE CALCULAR CON LA INFLACION MENSUAL.","area":"Compras","meta":"4%","vals":["-6%","-5%","-4%","-6%","-2%","",""]},{"n":"2","objetivo":"","kpi":"INDICADOR DE NUEVOS PROVEEDORES EN EL PERIODO MEDIDO","area":"Compras","meta":"2%","vals":["","","","","3%","6%","7%"]},{"n":"3","objetivo":"","kpi":"LICITACIONES","area":"Compras","meta":"2%","vals":["N/A","N/A","N/A","N/A","N/A","N/A","N/A"]},{"n":"4","objetivo":"Asegurar el proyecto de transformación antes del fin del 1er semestre","kpi":"MATRIZ","area":"Compras","meta":"50%","vals":["N/A","N/A","N/A","N/A","N/A","N/A","N/A"]},{"n":"5","objetivo":"","kpi":"MATRIZ DE HABILIDADES","area":"Compras","meta":"50%","vals":["N/A","N/A","N/A","N/A","N/A","N/A","N/A"]},{"n":"6","objetivo":"Cumplimiento >70%","kpi":"INFORMES DE GESTION","area":"Compras","meta":"70%","vals":["","","","","","",""]}],"promedio":null},
  kpis: [
    // 1er conjunto: entender de dónde nace el total de pendientes.
    { id: 'pendientes', grupo: 'Pendientes y vencidos', titulo: 'Total Pendientes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 313,
      info: 'Total de requisiciones pendientes al cierre de la semana. (COMPRAS, columna O)' },
    { id: 'sin_tratar', grupo: 'Pendientes y vencidos', titulo: 'Requis sin Tratar', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 292,
      info: 'Requisiciones de la semana que quedaron sin gestionar. (COMPRAS, columna G)' },
    { id: 'vencidas', grupo: 'Pendientes y vencidos', titulo: 'Total Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      desglose: [{ nombre: 'Nuevas', valor: 5 }, { nombre: 'Viejas', valor: 12 }],
      info: 'Requisiciones vencidas (pasaron su plazo), con desglose entre nuevas y viejas. (COMPRAS, columna J; K nuevas / L viejas)' },
    { id: 'total_sin_tratar', grupo: 'Pendientes y vencidos', titulo: 'Total de Requis Sin Tratar', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 313,
      info: 'Total de requisiciones sin tratar (acumulado: anteriores + de la semana). (COMPRAS, columna H)' },
    { id: 'ant_vencidas', grupo: 'Pendientes y vencidos', titulo: 'Anteriores Vencidas', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 17,
      info: 'Requisiciones vencidas que vienen de semanas anteriores. (COMPRAS, columna A)' },
    { id: 'ant_sin_vencer', grupo: 'Pendientes y vencidos', titulo: 'Anteriores Sin Vencer', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 4,
      info: 'Requisiciones de semanas anteriores que aún no vencieron. (COMPRAS, columna B)' },
    // 2do conjunto: actividad de la semana.
    { id: 'requis_semana', grupo: 'Actividad de la semana', titulo: 'Requis de la Semana', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 339,
      info: 'Requisiciones de compra ingresadas en la semana. (COMPRAS, columna C)' },
    { id: 'tratadas', grupo: 'Actividad de la semana', titulo: 'Requis Tratadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 45,
      info: 'Requisiciones gestionadas / resueltas en la semana. (COMPRAS, columna D)' },
  ],
  graficos: [
    { tipo: 'bar', grupo: 'Pendientes y vencidos', titulo: 'Composición de pendientes', info: 'De qué se componen los pendientes de la última semana.',
      datos: [{ nombre: 'Por vencer', valor: 202 }, { nombre: 'En plazo', valor: 94 }, { nombre: 'Vencidas', valor: 17 }] },
    { tipo: 'bar', grupo: 'Actividad de la semana', titulo: 'Gestión de la semana', info: 'Flujo de requisiciones de la última semana: ingresadas, tratadas y las que quedaron.',
      datos: [{ nombre: 'Ingresadas', valor: 339 }, { nombre: 'Tratadas', valor: 45 }, { nombre: 'Sin tratar', valor: 292 }, { nombre: 'Rechazadas', valor: 1 }, { nombre: 'Anuladas', valor: 1 }] },
    // Vencidas por semana: gráfico embebido (ComprasVencidas.jsx) con el desglose de la
    // tabla A112 (composición de las vencidas por semana de origen). Solo registra el grupo/subtab.
    { tipo: 'tabla', grupo: 'Vencidas por semana', titulo: 'Vencidas por semana', info: 'Desglose de cómo se componen las vencidas por semana de origen (hoja KPI · A112).', columnas: [], filas: [] },
    // Órdenes demoradas (embebido; ComprasDemoradasSec.jsx): tabla agrupada con detalle + el informe.
    { tipo: 'tabla', grupo: 'Órdenes demoradas', titulo: 'Órdenes demoradas', info: 'Ítems de OC del año en curso, vencidos y pendientes de recepción, por proveedor y rubro (hoja Reporte).', columnas: [], filas: [] },
    // Sin entrega (embebido; ComprasSinEntrega.jsx). Solo registra el grupo/subtab.
    { tipo: 'tabla', grupo: 'Sin entrega', titulo: 'Sin entrega', info: 'Órdenes de compra vivas con ítems todavía pendientes de entrega, vencidos o no, por proveedor y rubro (hoja Reporte).', columnas: [], filas: [] },
    // Presupuesto (embebido; PresupuestoCompras.jsx). Solo registra el grupo/subtab, va
    // último para que Presupuesto y Objetivo queden como los dos últimos de la ventana.
    { tipo: 'tabla', grupo: 'Presupuesto', titulo: 'Presupuesto', info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Compras).', columnas: [], filas: [] },
  ],
};

// FÁBRICA DE HIELO: productividad de la semana (tabla semanal que se sobrescribe).
// KPIs de la fila RESUMEN; gráficos de las filas diarias. Datos de la Semana 31.
const HIELO = {
  key: 'fábrica-de-hielo', nombre: 'Fábrica de Hielo', estado: 'ok', objetivoPendiente: true,
  // Cuadro de KPIs asignados (hoja "Fabrica de hielo" del archivo KPI Gerencia de Operaciones 2026).
  objetivos: {"persona":"Juan Retamero","total":5,"meses":["Ene","Feb","Mar","Abr","May","Jun","Jul"],"filas":[{"n":"1","objetivo":"Capacidad de producción y consumo, junto y separado.","kpi":"HORAS TRABAJADAS VS PRODUCCION","area":"Fabrica de Hielo","meta":"50%","vals":["N/A","N/A","N/A","N/A","N/A","N/A","N/A"]},{"n":"2","objetivo":"Capacidad de producción y consumo, junto y separado.","kpi":"STOCK DE BARRAS, PALLETS DE MADERA Y PLASTICOS, SEGUIMIENTO POR FRIGORIFICO  DE DEUDA DE PALLETS.","area":"Fabrica de Hielo","meta":"50%","vals":["N/A","N/A","N/A","N/A","N/A","N/A","N/A"]},{"n":"3","objetivo":"Cumplimiento >70%","kpi":"INFORMES DE GESTION","area":"Fabrica de Hielo","meta":"70%","vals":["","","","","","",""]}],"promedio":null},
  kpis: [
    // --- Movimiento de Pallets (tabla ejecutiva embebida; ver MovimientoPallets.jsx) ---
    // Este KPI solo registra el grupo/subtab: App.jsx lo reemplaza por el dashboard
    // embebido (MOVIMIENTO DE PALLETS.xlsx, una hoja por semana).
    { id: 'mov_pallets', grupo: 'Movimiento de Pallets', titulo: 'Movimiento de Pallets', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 2102,
      info: 'Deuda de pallets por frigorífico, semana a semana (enviados, recibidos y saldo sin devolver).' },
    // --- Productividad (principal: Hombre/Barra Día) ---
    { id: 'prod_dia', grupo: 'Productividad', titulo: 'Hombre / Barra Día', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 1278,
      info: 'Productividad principal: barras por persona en la semana (barras / personal). (FABRICA DE HIELO, resumen col. E)' },
    { id: 'barras', grupo: 'Productividad', titulo: 'Barras producidas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 30680,
      info: 'Barras de hielo producidas en la semana (total). (resumen col. D)' },
    { id: 'prod_hs', grupo: 'Productividad', titulo: 'Hom / Barra Hs', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 34,
      info: 'Barras por hora de máquina (barras / horas). (resumen col. G)' },
    { id: 'consumo', grupo: 'Productividad', titulo: 'Consumo', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 35085,
      info: 'Consumo total de la semana. (resumen col. H)' },
    { id: 'horas', grupo: 'Productividad', titulo: 'Horas trabajadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 899,
      info: 'Horas de máquina trabajadas en la semana (total). (resumen col. F)' },
    // --- Monitoreo de Barras (tabla ejecutiva embebida; ver MonitoreoBarras.jsx) ---
    // Solo registra el grupo/subtab: App.jsx lo reemplaza por el dashboard embebido
    // (NUEVO MONITOREO DE BARRAS.xlsx, detalle por proveedor de tambores).
    { id: 'mon_barras', grupo: 'Monitoreo de Barras', titulo: 'Monitoreo de Barras', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 1.44,
      info: 'Barras de hielo por proveedor: estimadas vs. usadas, promedio por tambor y costo por kilo.' },
    // --- Presupuesto (tabla ejecutiva embebida; ver Presupuesto.jsx) ---
    // Solo registra el grupo/subtab: App.jsx lo reemplaza por el dashboard embebido
    // (PRESUPUESTO.xlsx: presupuestado vs. gasto real por grupo, mes a mes).
    { id: 'presupuesto', grupo: 'Presupuesto', titulo: 'Presupuesto', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 112963549,
      info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Fábrica de Hielo).' },
  ],
  graficos: [
    { tipo: 'bar', grupo: 'Productividad', titulo: 'Hombre / Barra Día por día', info: 'Productividad (barras por persona) día a día de la semana. Dato principal.',
      datos: [{ nombre: 'Lun', valor: 247 }, { nombre: 'Mar', valor: 247 }, { nombre: 'Mié', valor: 168 }, { nombre: 'Jue', valor: 247 }, { nombre: 'Vie', valor: 247 }, { nombre: 'Sáb', valor: 247 }] },
    { tipo: 'bar', grupo: 'Productividad', titulo: 'Barras por día', info: 'Producción diaria de barras de hielo en la semana.',
      datos: [{ nombre: 'Lun', valor: 5920 }, { nombre: 'Mar', valor: 5920 }, { nombre: 'Mié', valor: 4040 }, { nombre: 'Jue', valor: 5920 }, { nombre: 'Vie', valor: 5920 }, { nombre: 'Sáb', valor: 2960 }] },
    { tipo: 'bar', grupo: 'Productividad', titulo: 'Consumo por día', info: 'Consumo diario en la semana.',
      datos: [{ nombre: 'Lun', valor: 7205 }, { nombre: 'Mar', valor: 7335 }, { nombre: 'Mié', valor: 6725 }, { nombre: 'Jue', valor: 6520 }, { nombre: 'Vie', valor: 1530 }, { nombre: 'Sáb', valor: 5770 }] },
    { tipo: 'tabla', wrap: true, grupo: 'Productividad', titulo: 'Observaciones de la semana', info: 'Novedades cargadas día a día en la planilla (columna Observaciones).',
      columnas: ['Día', 'Fecha', 'Observación'],
      filas: [['Miércoles', '29/07', 'Quedaron sin sacar 20 perchas (400 barras) por problemas con la noria.']] },
  ],
};

// SISTEMAS: foto de la última semana (misma mecánica que Compras). Semana 31.
const SISTEMAS = {
  key: 'sistemas', nombre: 'Sistemas', estado: 'ok', objetivoPendiente: true,
  kpis: [
    // 1er conjunto: pendientes (gerencia pidió dejar solo esto, sin "vencidas").
    { id: 'abiertos', grupo: 'Pendientes', titulo: 'Total de Abiertos', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 72,
      info: 'Total de tickets abiertos. (SISTEMAS, columna S)' },
    { id: 'pendientes', grupo: 'Pendientes', titulo: 'Tickets Pendientes', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 9,
      info: 'Tickets que quedaron pendientes en la semana. (SISTEMAS, columna R)' },
    // 2do conjunto: actividad de la semana.
    { id: 'tickets_semana', grupo: 'Actividad de la semana', titulo: 'Tickets de la Semana', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 75,
      info: 'Tickets ingresados en la semana. (SISTEMAS, columna N)' },
    { id: 'tratados', grupo: 'Actividad de la semana', titulo: 'Tickets Tratados', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 66,
      info: 'Tickets resueltos o gestionados en la semana. (SISTEMAS, columna O)' },
  ],
  graficos: [
    { tipo: 'bar', grupo: 'Actividad de la semana', titulo: 'Gestión de la semana', info: 'Flujo de tickets de la última semana: ingresados, tratados y pendientes.',
      datos: [{ nombre: 'Ingresados', valor: 75 }, { nombre: 'Tratados', valor: 66 }, { nombre: 'Pendientes', valor: 9 }] },
  ],
};

// LOGÍSTICA: hoja con muchos bloques distintos (períodos mixtos) → sub-pestañas.
// Los nombres de las ventanas no llevan mes ni semana: el período lo muestra
// cada tablero a partir de sus propios datos.
const G = { costo: 'Matriz de Costo', metrica: 'Métrica de Costo', flota: 'Disponibilidad de Flota',
  lavado: 'Lavado de Camiones', tambores: 'Necesidad de Tambores',
  gasoil: 'Consumo de Gasoil', frig: 'Costo por Frigorífico', hiel: 'Stock de Hiel' };
// Rendimiento KG/LT semana a semana (S1–S31) para el histórico de gasoil.
const KGLT = [9.07, 6.19, 6.38, 6.79, 5.71, 3.75, 4.12, 5.15, 6.17, 6.30, 5.89, 6.31, 6.29, 7.90, 5.48, 6.11, 6.09, 5.16, 6.63, 6.11, 5.52, 5.66, 5.71, 6.16, 4.63, 5.32, 6.84, 6.61, 6.59, 6.67, 6.21];
const SALDO_HIEL = [1369, 1369, 3592, 3592, 3592, 6138, 3325, 4080, 4080, 4080, 5633, 5633, 9106, 6428, 3123, 3123, 4717, 4717, 4717, 6696, 4003, 5084, 2842, 4428, 4428, 4428, 5794, 2526, 3212, 4523, 1142];
const LOGISTICA = {
  key: 'logística', nombre: 'Logística', estado: 'ok', objetivoPendiente: true,
  // Cuadro de KPIs asignados (hoja "Logistica" del archivo KPI Gerencia de Operaciones 2026).
  objetivos: {"persona":"Dario Pisano","total":2,"meses":["Ene","Feb","Mar","Abr","May","Jun","Jul"],"filas":[{"n":"1","objetivo":"Mejorar un 15% el costo por tonelada transportado (interno y externo)","kpi":"REEMPLAZAR LOS VIAJES DE COLGADO PARA HACER CON FLOTA PROPIA UNA VEZ REPARADOS LOS EQUIPOS DE FRIO.","area":"Logistica","meta":"","vals":["0%","0%","0%","0%","0%","",""]},{"n":"2","objetivo":"Mejorar un 15% el costo por tonelada transportado (interno y externo)","kpi":"PRESENTAREMOS ALTERNATIVAS PARA REALIZAR VIAJES CON FLOTA PROPIA EN RUTAS QUE PODAMOS CUMPLIR Y ELIMINAREMOS EL FLETE DE ESA RUTA.","area":"Logistica","meta":"","vals":["","","","","","",""]},{"n":"3","objetivo":"Mejorar un 15% el costo por tonelada transportado (interno y externo)","kpi":"SE TOMARAN LOS GASTOS DEL AÑO ANTERIOR MAS LA INFLACION DEL AÑO Y SE LO VA A COMPRARAR POR LO PAGADO AL TRANSPORTISTA.","area":"Logistica","meta":"","vals":["N/A","N/A","N/A","N/A","N/A","N/A","N/A"]},{"n":"4","objetivo":"Cumplimiento >70%","kpi":"INFORMES DE GESTION","area":"Logistica","meta":"70","vals":["","","","","","",""]}],"promedio":null},
  kpis: [
    // Matriz de Costo (mensual) · datos-héroe del último mes cargado.
    { id: 'costo_general', grupo: G.costo, titulo: 'Costo General del mes', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 1176272936, destacado: true,
      info: 'Costo general de Junio: propios + fletes + lavado + taller. Es el TOTALIZADO del mes. (MATRIZ DE COSTO)' },
    { id: 'costo_ton_prod', grupo: G.costo, titulo: 'Costo por tonelada producida', unidad: '', formato: 'moneda', sentido: 'down', meta: null, valor: 193767, destacado: true,
      info: 'Costo total por tonelada producida en Junio. (MATRIZ DE COSTO · Total $/Tons Prod.)' },
    { id: 'kilos_prod', grupo: G.costo, titulo: 'Kilos producidos', unidad: 'KG', formato: 'numero', sentido: 'up', meta: null, valor: 6070550,
      info: 'Descarga de producción en Junio. (MATRIZ DE COSTO · Descarga Producción)' },
    { id: 'kilos_desc', grupo: G.costo, titulo: 'Kilos descargados (neto)', unidad: 'KG', formato: 'numero', sentido: 'up', meta: null, valor: 10917908,
      info: 'Descarga kg neta en Junio. (MATRIZ DE COSTO · Descarga KG Neta)' },
    { id: 'dolar_ref', grupo: G.costo, titulo: 'Dólar de referencia', unidad: '', formato: 'moneda', sentido: 'up', meta: null, valor: 1500,
      info: 'Valorización del dólar oficial usada en Junio (Banco Nación). (MATRIZ DE COSTO)' },
    // Métrica de Costo (embebido; MetricaCosto.jsx): $/ton descargada real vs. proyección INDEC. Solo registra el grupo.
    { id: 'metrica_costo_reg', grupo: G.metrica, titulo: 'Métrica de Costo', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 0,
      info: '$/ton descargada real mes a mes vs. proyección por inflación (INDEC), con conclusión. (hoja Gastos)' },
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
      info: 'Litros de gasoil consumidos en la semana. (Total de Km recorridos: pendiente · no ubiqué la columna en la planilla.)' },
    { id: 'total_kg_gas', grupo: G.gasoil, titulo: 'Total Kg transportados', unidad: 'Kg', formato: 'numero', sentido: 'up', meta: null, valor: 2011585,
      info: 'Kilos transportados en la semana. (CONSUMO DE GASOIL)' },
    // Costo por Frigorífico (Sem 31) · el detalle completo va en la tabla.
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
    { tipo: 'tabla', grupo: G.costo, titulo: 'Matriz de Costo · 2026 (mes a mes)',
      info: 'Costos de logística por ítem y por mes, con los mismos identificadores de color del Excel: Propios, Fletes, Total Costo, Lavatachos, Taller y Total General. (MATRIZ DE COSTO · Logística, A1:N55)',
      columnas: ['Ítem', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      secciones: [
        { label: 'Dólar de referencia (Banco Nación)', cat: 'dolar', filas: [
          ['Dólar oficial $', '$ 1.465', '$ 1.420', '$ 1.405', '$ 1.415', '$ 1.430', '$ 1.500'],
        ] },
        { label: 'Descarga (kg)', cat: 'descarga', filas: [
          ['Descarga producción', '6.374.977', '5.388.443', '5.297.767', '4.846.034', '5.983.368', '6.070.550'],
          ['Descarga kg neta', '10.430.399', '8.546.571', '10.090.865', '8.104.433', '10.124.075', '10.917.908'],
        ] },
        { label: 'Propios', cat: 'propios', filas: [
          ['Descarga propios (kg)', '4.615.842', '4.474.926', '5.058.980', '4.660.439', '5.841.572', '6.269.946'],
          ['Total del mes Propios', '$ 170.311.650', '$ 135.284.531', '$ 225.726.369', '$ 147.618.376', '$ 174.169.228', '$ 251.927.671'],
          ['Costo $/kg', '$ 37', '$ 30', '$ 45', '$ 32', '$ 30', '$ 40'],
          ['Costo USD/ton', 'USD 25', 'USD 21', 'USD 32', 'USD 22', 'USD 21', 'USD 27'],
        ] },
        { label: 'Fletes', cat: 'fletes', filas: [
          ['Descarga fletes (kg)', '5.814.556', '4.071.645', '5.031.885', '3.443.994', '4.282.503', '4.647.962'],
          ['Total del mes Fletes', '$ 556.192.701', '$ 604.028.315', '$ 701.667.920', '$ 516.434.800', '$ 637.802.650', '$ 799.914.600'],
          ['Costo $/kg', '$ 96', '$ 148', '$ 139', '$ 150', '$ 149', '$ 172'],
          ['Costo USD/ton', 'USD 65', 'USD 104', 'USD 99', 'USD 106', 'USD 104', 'USD 115'],
        ] },
        { label: 'Total Costo Logística', cat: 'totalcosto', filas: [
          ['Total del mes Logística', '$ 726.504.350', '$ 739.312.846', '$ 927.394.289', '$ 664.053.176', '$ 811.971.878', '$ 1.051.842.271'],
          ['Costo Logística $/kg', '$ 69,65', '$ 86,50', '$ 91,90', '$ 81,94', '$ 80,20', '$ 96,34'],
          ['Logística USD/ton', 'USD 48', 'USD 61', 'USD 65', 'USD 58', 'USD 56', 'USD 64'],
        ] },
        { label: 'Lavatachos', cat: 'lavatachos', filas: [
          ['Total del mes Lavado', '$ 65.894.989', '$ 61.665.571', '$ 69.857.126', '$ 70.342.932', '$ 73.344.283', '$ 78.540.283'],
          ['Costo $/lavado', '$ 79.487', '$ 81.568', '$ 82.185', '$ 82.756', '$ 86.287', '$ 92.400'],
          ['Costo USD/lavado', 'USD 54', 'USD 57', 'USD 58', 'USD 58', 'USD 60', 'USD 62'],
          ['Cantidad de lavados', '829', '756', '850', '850', '850', '850'],
          ['USD/ton', 'USD 4', 'USD 5', 'USD 5', 'USD 6', 'USD 5', 'USD 5'],
        ] },
        { label: 'Taller', cat: 'taller', filas: [
          ['Total del mes Taller', '$ 41.309.801', '$ 64.853.812', '$ 46.625.124', '$ 74.493.537', '$ 112.892.410', '$ 45.890.383'],
          ['Costo USD/ton', 'USD 3', 'USD 5', 'USD 3', 'USD 6', 'USD 8', 'USD 3'],
        ] },
        { label: 'Total General', cat: 'totalgeneral', filas: [
          ['TOTAL del mes · Costo General', '$ 833.709.140', '$ 865.832.229', '$ 1.043.876.539', '$ 808.889.645', '$ 998.208.572', '$ 1.176.272.936'],
          ['Total USD/ton desc.', 'USD 55', 'USD 69', 'USD 71', 'USD 68', 'USD 67', 'USD 74'],
          ['Total $/ton descargada', '$ 79.931', '$ 101.308', '$ 103.448', '$ 99.808', '$ 98.598', '$ 107.738'],
          ['Total $/ton producida', '$ 130.778', '$ 160.683', '$ 197.041', '$ 166.918', '$ 166.831', '$ 193.767'],
          ['% Kg Propios', '44%', '52%', '50%', '58%', '58%', '57%'],
          ['% Kg Fletes', '56%', '48%', '50%', '42%', '42%', '43%'],
        ] },
      ] },
    { tipo: 'bar', grupo: G.flota, titulo: 'Disponibilidad por flota (%)', info: 'Disponibilidad por tipo de unidad (semana).',
      datos: [{ nombre: 'Tractor', valor: 94 }, { nombre: 'Torito', valor: 100 }, { nombre: 'Chasis', valor: 97 }, { nombre: 'Balancín', valor: 100 }, { nombre: 'Semi', valor: 80 }, { nombre: 'Bateas', valor: 92 }] },
    { tipo: 'tabla', grupo: G.flota, titulo: 'Patentes fuera de servicio (FS)', info: 'Unidades con parada temporal en la semana. No incluye las de baja permanente (FSP). Pasá el mouse por una patente para ver su destino y motivo (base de datos de flota).',
      columnas: ['Dominio', 'Tipo', 'Marca', 'Días parado'],
      filas: [
        ['AC581KP', 'Tractor', 'Mercedes Benz', '6'], ['JNA841', 'Tractor', 'Mercedes Benz', '4'], ['AG252VK', 'Tractor', 'Mercedes Benz', '6'],
        ['FKP 957', 'Semi', 'Lambert', '6'], ['HRV 058', 'Semi', 'Astpra', '6'], ['IHZ 227', 'Semi', 'Astpra', '6'],
        ['IHZ 228', 'Semi', 'Astpra', '6'], ['IKO 415', 'Semi', 'Astpra', '6'], ['IMO 536', 'Semi', 'Astpra', '2'],
        ['JAP 922', 'Semi', 'Astpra', '6'], ['JNS 094', 'Semi', 'Astpra', '6'], ['LMD 345', 'Semi', 'Astpra', '6'],
        ['LMD 346', 'Semi', 'Astpra', '6'], ['MXC 712', 'Semi', 'Lambert', '6'], ['AC 427 IU', 'Batea', 'Gomatro', '4'],
        ['TOTAL', '15 unidades', '-', '82'],
      ],
      // Detalle por patente (base de datos de flota): destino + motivo del freno.
      // Alineado a `filas`; null donde el archivo todavía no tiene el dato.
      filaTips: [
        'Destino: Taller\nMotivo: Motor roto', null, null,
        'Destino: Bonano\nMotivo: Pecho, piso y puertas deteriorados.',
        'Destino: Se usa para hielo\nMotivo: Piso y puertas rotas',
        'Destino: Bonano\nMotivo: Piso y puertas rotas',
        'Destino: Bonano\nMotivo: Pecho partido',
        'Destino: Bonano\nMotivo: Pecho partido, piso y puertas deteriorados.',
        null, null, null,
        'Destino: Bonano\nMotivo: Pecho partido, piso y puertas deteriorados.',
        'Destino: Bonano\nMotivo: Pecho partido, piso y puertas deteriorados.',
        'Destino: Para Zucars\nMotivo: Piso roto y bisagras',
        null, null,
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
        ['Agroindustrias', '34,8', '6', '43.056', '$ 218.276', '-'], ['Arre Beef', '550', '10', '105.780', '$ 700.409', '$ 744.033'],
        ['Black Bamboo', '740', '3', '38.808', '$ 912.539', '$ 409.500'], ['Compañía Bernal', '37,8', '13', '92.510', '$ 267.364', '$ 1.529.667'],
        ['Ecocarnes', '142', '9', '81.941', '$ 298.165', '-'], ['El Chillén', '119', '5', '33.026', '$ 278.709', '-'],
        ['Frigolar', '108', '10', '103.499', '$ 267.364', '$ 218.617'], ['Gorina', '128', '23', '224.844', '$ 267.364', '$ 294.450'],
        ['Rioplatense', '159', '13', '119.955', '$ 331.825', '$ 144.083'], ['Gan. Las Pampas', '38,9', '3', '15.546', '$ 227.086', '-'],
        ['San Roque', '62,5', '6', '36.119', '$ 253.380', '-'], ['Tolosa', '168', '7', '65.068', '$ 340.483', '$ 102.700'],
        ['Menucar Lobos', '177', '3', '14.858', '$ 337.382', '-'], ['Mat. Federal', '32,1', '11', '83.878', '$ 217.523', '$ 8.450'],
        ['Runfo', '69,7', '12', '117.412', '$ 384.674', '$ 1.682.850'], ['Swift', '92,2', '-', '0', '$ 263.611', '$ 736.233'],
        ['Tresnal', '216', '8', '41.218', '$ 356.914', '$ 32.500'], ['Velsud', '20', '9', '49.337', '$ 203.439', '-'],
        ['TOTALES', '-', '156', '1.294.641', '$ 49.033.031', '$ 534.057'],
      ] },
    { tipo: 'line', grupo: G.hiel, titulo: 'Saldo de hiel diario (Julio)', info: 'Evolución del saldo de hiel día a día en el mes.',
      periodos: SALDO_HIEL.map((_, i) => String(i + 1)), series: [{ nombre: 'Saldo', datos: SALDO_HIEL }] },
    // Presupuesto (tabla ejecutiva embebida; ver PresupuestoLogistica.jsx). Solo registra
    // el grupo/subtab: App.jsx lo reemplaza por el dashboard embebido. Va último para que
    // el orden termine en Presupuesto y luego Objetivo (los dos últimos de la ventana).
    { tipo: 'tabla', grupo: 'Presupuesto', titulo: 'Presupuesto', info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Logística).', columnas: [], filas: [] },
  ],
};

// CONGELADO: por ahora con Presupuesto (embebido) y la ventana Objetivo preparada.
const CONGELADO = {
  key: 'congelado', nombre: 'Congelado', estado: 'ok', objetivoPendiente: true,
  kpis: [],
  graficos: [
    // Presupuesto (embebido; PresupuestoCongelado.jsx). Registra el grupo/subtab; va
    // antes de Objetivo, que queda preparado (placeholder) como último botón.
    { tipo: 'tabla', grupo: 'Presupuesto', titulo: 'Presupuesto', info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Congelado).', columnas: [], filas: [] },
  ],
};

// TALLER y LAVADERO DE CAMIONES: sectores propios con Presupuesto (embebido) + Objetivo.
const TALLER = {
  key: 'taller', nombre: 'Taller', estado: 'ok', objetivoPendiente: false,
  kpis: [],
  graficos: [
    { tipo: 'tabla', grupo: 'Presupuesto', titulo: 'Presupuesto', info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Taller).', columnas: [], filas: [] },
  ],
};
const LAVADERO = {
  key: 'lavadero', nombre: 'Lavadero de Camiones', estado: 'ok', objetivoPendiente: false,
  kpis: [],
  graficos: [
    { tipo: 'tabla', grupo: 'Presupuesto', titulo: 'Presupuesto', info: 'Presupuestado vs. gasto real por grupo de costo, mes a mes (Lavadero de Camiones).', columnas: [], filas: [] },
  ],
};

function construirMock() {
  return {
    origen: 'mock',
    actualizado: new Date().toISOString(),
    sectores: [INSUMOS, COMPRAS, HIELO, LOGISTICA, SISTEMAS, CONGELADO, TALLER, LAVADERO],
  };
}

module.exports = { construirMock };
