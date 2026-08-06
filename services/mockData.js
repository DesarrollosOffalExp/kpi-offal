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

// Sectores todavía sin integrar (se muestran como "en preparación").
const PENDIENTES = ['Compras', 'Fábrica de Hielo', 'Logística', 'Sistemas'].map((nombre) => ({
  key: nombre.toLowerCase().replace(/\s+/g, '-'), nombre, estado: 'pendiente', kpis: [], graficos: [],
}));

function construirMock() {
  return {
    origen: 'mock',
    actualizado: new Date().toISOString(),
    sectores: [INSUMOS, ...PENDIENTES],
  };
}

module.exports = { construirMock };
