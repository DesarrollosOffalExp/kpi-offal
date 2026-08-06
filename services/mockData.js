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
    { id: 'barras', titulo: 'Barras producidas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 30680,
      info: 'Barras de hielo producidas en la semana (total). (FABRICA DE HIELO, resumen col. D)' },
    { id: 'prod_dia', titulo: 'Productividad Hombre/Barra Día', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 1278,
      info: 'Productividad: barras por persona en la semana (barras / personal). (resumen col. E)' },
    { id: 'prod_hs', titulo: 'Productividad Hom/Barra Hs', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 34,
      info: 'Productividad: barras por hora de máquina (barras / horas). (resumen col. G)' },
    { id: 'consumo', titulo: 'Consumo', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 35085,
      info: 'Consumo total de la semana. (FABRICA DE HIELO, resumen col. H)' },
    { id: 'horas', titulo: 'Horas trabajadas', unidad: '', formato: 'numero', sentido: 'up', meta: null, valor: 899,
      info: 'Horas de máquina trabajadas en la semana (total). (resumen col. F)' },
    { id: 'pallets_nd', titulo: 'Pallets no devueltos', unidad: '', formato: 'numero', sentido: 'down', meta: null, valor: 2102,
      desglose: [{ nombre: 'Enviados sem', valor: 313 }, { nombre: 'Recibidos sem', valor: 310 }],
      info: 'Pallets entregados a frigoríficos que aún no fueron devueltos (deuda de pallets). Corresponde a la semana anterior (sem. 30). (FABRICA DE HIELO, STOCK FINAL col. E; Enviados col. C, Recibidos col. D)' },
  ],
  graficos: [
    { tipo: 'bar', titulo: 'Barras por día', info: 'Producción diaria de barras de hielo en la semana.',
      datos: [{ nombre: 'Lun', valor: 5920 }, { nombre: 'Mar', valor: 5920 }, { nombre: 'Mié', valor: 4040 }, { nombre: 'Jue', valor: 5920 }, { nombre: 'Vie', valor: 5920 }, { nombre: 'Sáb', valor: 2960 }] },
    { tipo: 'bar', titulo: 'Consumo por día', info: 'Consumo diario en la semana.',
      datos: [{ nombre: 'Lun', valor: 7205 }, { nombre: 'Mar', valor: 7335 }, { nombre: 'Mié', valor: 6725 }, { nombre: 'Jue', valor: 6520 }, { nombre: 'Vie', valor: 1530 }, { nombre: 'Sáb', valor: 5770 }] },
    { tipo: 'bar', horizontal: true, titulo: 'Pallets no devueltos por frigorífico', info: 'Frigoríficos con más pallets sin devolver (top 10, semana anterior).',
      datos: [{ nombre: 'Congelados', valor: 363 }, { nombre: 'Supermercado', valor: 285 }, { nombre: 'Runfo', valor: 273 }, { nombre: 'Gorina', valor: 172 }, { nombre: 'Rioplat.', valor: 171 }, { nombre: 'Cordoba', valor: 111 }, { nombre: 'Frigolar', valor: 99 }, { nombre: 'Federal', valor: 90 }, { nombre: 'Cocarsa', valor: 88 }, { nombre: 'Faraon', valor: 86 }] },
  ],
};

// Sectores todavía sin integrar (se muestran como "en preparación").
const PENDIENTES = ['Logística', 'Sistemas'].map((nombre) => ({
  key: nombre.toLowerCase().replace(/\s+/g, '-'), nombre, estado: 'pendiente', kpis: [], graficos: [],
}));

function construirMock() {
  return {
    origen: 'mock',
    actualizado: new Date().toISOString(),
    sectores: [INSUMOS, COMPRAS, HIELO, ...PENDIENTES],
  };
}

module.exports = { construirMock };
