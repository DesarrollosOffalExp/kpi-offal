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

// Sectores todavía sin integrar (se muestran como "en preparación").
const PENDIENTES = ['Fábrica de Hielo', 'Logística', 'Sistemas'].map((nombre) => ({
  key: nombre.toLowerCase().replace(/\s+/g, '-'), nombre, estado: 'pendiente', kpis: [], graficos: [],
}));

function construirMock() {
  return {
    origen: 'mock',
    actualizado: new Date().toISOString(),
    sectores: [INSUMOS, COMPRAS, ...PENDIENTES],
  };
}

module.exports = { construirMock };
