// Datos de EJEMPLO del tablero, para desarrollar la UI antes de tener cableado
// el Excel real. Se usan automáticamente cuando faltan las credenciales de Graph.
// La forma de estos objetos ES el contrato que consume el frontend: cuando se
// conecte el KPI.xlsx real, kpiSource.js debe devolver exactamente esta estructura.

const PERIODOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

function kpi(id, titulo, unidad, formato, sentido, meta, serie) {
  return { id, titulo, unidad, formato, sentido, meta, serie };
}

const SECTORES = [
  {
    key: 'produccion',
    nombre: 'Producción',
    kpis: [
      kpi('prod-ton', 'Producción total', 't', 'numero', 'up', 1300, [1120, 1185, 1210, 1240, 1298, 1342]),
      kpi('prod-oee', 'OEE (eficiencia)', '%', 'porcentaje', 'up', 85, [78, 80, 79, 82, 84, 86]),
      kpi('prod-merma', 'Merma', '%', 'porcentaje', 'down', 3, [4.8, 4.2, 4.0, 3.6, 3.4, 3.1]),
      kpi('prod-paradas', 'Paradas no programadas', 'h', 'numero', 'down', 20, [38, 31, 34, 26, 22, 19]),
    ],
    distribucion: {
      titulo: 'Producción por línea',
      tipo: 'donut',
      datos: [
        { nombre: 'Línea A', valor: 540 },
        { nombre: 'Línea B', valor: 430 },
        { nombre: 'Línea C', valor: 372 },
      ],
    },
  },
  {
    key: 'calidad',
    nombre: 'Calidad',
    kpis: [
      kpi('cal-conf', 'Producto conforme', '%', 'porcentaje', 'up', 99, [97.2, 97.8, 98.1, 98.4, 98.9, 99.1]),
      kpi('cal-recl', 'Reclamos de clientes', '', 'numero', 'down', 5, [12, 10, 9, 7, 6, 4]),
      kpi('cal-nc', 'No conformidades', '', 'numero', 'down', 8, [18, 15, 14, 11, 10, 7]),
    ],
    distribucion: {
      titulo: 'No conformidades por origen',
      tipo: 'bar',
      datos: [
        { nombre: 'Proceso', valor: 3 },
        { nombre: 'Proveedor', valor: 2 },
        { nombre: 'Etiquetado', valor: 1 },
        { nombre: 'Transporte', valor: 1 },
      ],
    },
  },
  {
    key: 'logistica',
    nombre: 'Logística',
    kpis: [
      kpi('log-otif', 'OTIF (entregas a tiempo)', '%', 'porcentaje', 'up', 95, [88, 90, 89, 92, 94, 96]),
      kpi('log-costo', 'Costo por tonelada', '$', 'moneda', 'down', 42000, [48000, 47200, 46500, 45100, 44000, 43200]),
      kpi('log-ciclo', 'Tiempo de despacho', 'h', 'numero', 'down', 6, [9.2, 8.6, 8.1, 7.4, 6.8, 6.2]),
    ],
    distribucion: {
      titulo: 'Despachos por destino',
      tipo: 'donut',
      datos: [
        { nombre: 'Mercado interno', valor: 320 },
        { nombre: 'Exportación', valor: 480 },
        { nombre: 'Retiro en planta', valor: 90 },
      ],
    },
  },
  {
    key: 'compras',
    nombre: 'Compras',
    kpis: [
      kpi('com-ahorro', 'Ahorro negociado', '%', 'porcentaje', 'up', 8, [4.1, 5.0, 5.8, 6.4, 7.2, 8.3]),
      kpi('com-lead', 'Lead time de compra', 'días', 'numero', 'down', 10, [16, 15, 14, 12, 11, 9]),
      kpi('com-cumpl', 'Cumplimiento de proveedores', '%', 'porcentaje', 'up', 95, [89, 90, 91, 93, 94, 96]),
    ],
    distribucion: {
      titulo: 'Gasto por rubro',
      tipo: 'bar',
      datos: [
        { nombre: 'Insumos', valor: 42 },
        { nombre: 'Servicios', valor: 27 },
        { nombre: 'Mantenimiento', valor: 18 },
        { nombre: 'Logística', valor: 13 },
      ],
    },
  },
];

// Ensambla la estructura final, adjuntando los períodos a cada serie de KPI.
function construirMock() {
  const sectores = SECTORES.map((s) => ({
    key: s.key,
    nombre: s.nombre,
    kpis: s.kpis.map((k) => ({
      ...k,
      serie: k.serie.map((valor, i) => ({ periodo: PERIODOS[i], valor })),
    })),
    distribucion: s.distribucion,
  }));

  return {
    origen: 'mock',
    actualizado: new Date().toISOString(),
    periodos: PERIODOS,
    sectores,
  };
}

module.exports = { construirMock, PERIODOS };
