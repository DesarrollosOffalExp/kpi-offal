import { useEffect, useState } from 'react';
import { getMe, getKpis } from './api';
import Navbar from './components/Navbar';
import KpiCard from './components/KpiCard';
import SectorCharts from './components/SectorCharts';
import Chart from './components/Chart';
import Modal from './components/Modal';
import MatrizCostoLogistica from './components/MatrizCostoLogistica';
import MovimientoPallets from './components/MovimientoPallets';
import MonitoreoBarras from './components/MonitoreoBarras';
import Presupuesto from './components/Presupuesto';
import PresupuestoLogistica from './components/PresupuestoLogistica';
import PresupuestoInsumos from './components/PresupuestoInsumos';
import PresupuestoCompras from './components/PresupuestoCompras';
import ComprasPendientes from './components/ComprasPendientes';
import ComprasActividad from './components/ComprasActividad';
import ComprasVencidas from './components/ComprasVencidas';
import ComprasDemoradasSec from './components/ComprasDemoradasSec';
import ComprasSinEntrega from './components/ComprasSinEntrega';
import PresupuestoCongelado from './components/PresupuestoCongelado';
import PresupuestoTaller from './components/PresupuestoTaller';
import PresupuestoLavadero from './components/PresupuestoLavadero';
import DisponibilidadFlota from './components/DisponibilidadFlota';
import NecesidadTambores from './components/NecesidadTambores';
import ObjetivoSector from './components/ObjetivoSector';
import ObjetivosEstrategicos from './components/ObjetivosEstrategicos';
import ProductividadBarras from './components/ProductividadBarras';
import StockHiel from './components/StockHiel';
import ConsumoGasoil from './components/ConsumoGasoil';
import CostoFrigorifico from './components/CostoFrigorifico';
import MetricaCosto from './components/MetricaCosto';
import ProductividadArmado from './components/ProductividadArmado';
import MermaCajas from './components/MermaCajas';
import EficienciaMateriales from './components/EficienciaMateriales';
import ProductividadCerrado from './components/ProductividadCerrado';
import KpiSistemas from './components/KpiSistemas';

// Alto de la navbar sticky (.nav-inner en index.css).
const ALTO_NAV = 64;

// Clave de la pestaña transversal de objetivos (no es un sector del Excel de KPIs).
const TAB_OBJETIVOS = '__objetivos';

function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmt(v, formato, unidad) {
  if (v == null || Number.isNaN(v)) return '-';
  if (formato === 'porcentaje') return `${Math.round(v * 10) / 10}%`;
  if (formato === 'moneda') return `$ ${v.toLocaleString('es-AR')}`;
  const n = v.toLocaleString('es-AR');
  return unidad ? `${n} ${unidad}` : n;
}

// Contenido ampliado (dentro del modal) para un KPI o un gráfico.
function DetalleExpandido({ item }) {
  if (item.kind === 'grafico') return <Chart g={item.grafico} height={460} />;

  const kpi = item.kpi;
  const tieneSerie = Array.isArray(kpi.serie) && kpi.serie.length > 0;
  const actual = tieneSerie ? kpi.serie[kpi.serie.length - 1].valor : kpi.valor ?? null;
  return (
    <div className="detalle-kpi">
      <div className="detalle-cifras">
        <div><span className="detalle-lbl">Actual</span><span className="detalle-val">{fmt(actual, kpi.formato, kpi.unidad)}</span></div>
        {kpi.meta != null && <div><span className="detalle-lbl">Meta</span><span className="detalle-val meta">{fmt(kpi.meta, kpi.formato, kpi.unidad)}</span></div>}
        {kpi.desglose?.map((d) => (
          <div key={d.nombre}><span className="detalle-lbl">{d.nombre}</span><span className="detalle-val">{fmt(d.valor, kpi.formato, kpi.unidad)}</span></div>
        ))}
      </div>
      {kpi.info && <p className="detalle-info">{kpi.info}</p>}
      {tieneSerie && (
        <Chart height={420} g={{
          tipo: 'line',
          periodos: kpi.serie.map((p) => p.periodo),
          series: [{ nombre: kpi.titulo, datos: kpi.serie.map((p) => p.valor) }],
        }} />
      )}
    </div>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [data, setData] = useState(null);
  const [sectorActivo, setSectorActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [subActivo, setSubActivo] = useState(null);
  // Sección interna del tablero de Sistemas, que navega por su cuenta.
  const [subSistemas, setSubSistemas] = useState(null);

  async function cargar({ forzar = false } = {}) {
    try {
      forzar ? setRefrescando(true) : setCargando(true);
      const [me, kpis] = await Promise.all([usuario ? Promise.resolve(usuario) : getMe(), getKpis({ forzar })]);
      setUsuario(me);
      setData(kpis);
      setSectorActivo((prev) => prev || kpis.sectores?.[0]?.key || null);
      setError(null);
    } catch (err) {
      setError(err.code === 'NO_PERM' ? 'No tenés permiso para ver el tablero de KPIs.' : err.message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al bajar y perder de vista las pestañas, la navbar muestra dónde estás
  // (sector · sub-pestaña). Al volver arriba se saca, porque las pestañas
  // reales ya se ven. Se mide contra la última fila de navegación visible,
  // así vale igual para los sectores con y sin sub-pestañas.
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    function medir() {
      const el = document.querySelector('.subtabs') || document.querySelector('.tabs');
      const fuera = el ? el.getBoundingClientRect().bottom < ALTO_NAV : false;
      setCompacto((v) => (v === fuera ? v : fuera));
    }
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    // los tableros embebidos cambian de alto solos y corren el layout
    const ro = new ResizeObserver(medir);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      ro.disconnect();
    };
  }, []);

  if (cargando) return <div className="estado">Cargando indicadores…</div>;
  if (error) return <div className="estado error">{error}</div>;

  // "Objetivos" es una pestaña transversal, al mismo nivel que los sectores: no
  // sale del Excel de KPIs sino del archivo de objetivos de la gerencia.
  const enObjetivos = sectorActivo === TAB_OBJETIVOS;
  const sector = enObjetivos ? null : (data?.sectores?.find((s) => s.key === sectorActivo) || data?.sectores?.[0]);

  // Orden de secciones dentro del sector (por `grupo`; null = sin sección).
  const grupos = [];
  if (sector && sector.estado !== 'pendiente') {
    const vistos = new Set();
    [...(sector.kpis || []), ...(sector.graficos || [])].forEach((it) => {
      const g = it.grupo || null;
      const key = g ?? '__';
      if (!vistos.has(key)) { vistos.add(key); grupos.push(g); }
    });
    // "Objetivo de la semana": sección presente en todos los sectores; sin dato aún.
    if (sector.objetivoPendiente) grupos.push('Objetivo');
  }
  // Con varias secciones se navegan como sub-pestañas (una a la vez), salvo que el
  // sector pida layout 'stacked' (apiladas, ej. Compras/Sistemas). `subActual` cae
  // a la primera si la activa no pertenece a este sector.
  const conSub = grupos.length > 1 && sector?.layout !== 'stacked';
  const subActual = grupos.includes(subActivo) ? subActivo : grupos[0];

  // Lo que muestra la navbar cuando las pestañas quedaron arriba. Sistemas trae
  // su propio tablero con navegación interna: el marco no dibuja sub-pestañas,
  // así que tampoco se anuncia una.
  const contextoNav = !compacto ? null
    : enObjetivos ? { sector: 'Objetivos', sub: null }
      : sector ? {
        sector: sector.nombre,
        sub: sector.key === 'sistemas' ? subSistemas : (conSub ? subActual : null),
      }
        : null;

  return (
    <>
      <Navbar
        usuario={usuario}
        contexto={contextoNav}
      />
      <main className="wrap">
        <div className="head">
          <div>
            <p className="overline">Indicadores de gestión</p>
            <h1>Tablero de KPIs</h1>
          </div>
          <div className="head-acciones">
            <span className={`fuente ${data?.origen === 'graph' ? 'live' : 'mock'}`}>
              {data?.origen === 'graph' ? '● En vivo (SharePoint)' : '● Datos de ejemplo'}
            </span>
            <span className="actualizado">Actualizado: {formatearFecha(data?.actualizado)}</span>
            <button className="btn-refresh" onClick={() => cargar({ forzar: true })} disabled={refrescando}>
              {refrescando ? 'Actualizando…' : '↻ Actualizar'}
            </button>
          </div>
        </div>

        {data?.aviso && <div className="aviso">{data.aviso}</div>}

        <nav className="tabs">
          {data?.sectores?.map((s) => (
            <button key={s.key} className={`tab ${s.key === sector?.key ? 'on' : ''}`} onClick={() => setSectorActivo(s.key)}>
              {s.nombre}{s.estado === 'pendiente' && <span className="tab-dot">•</span>}
            </button>
          ))}
          <button className={`tab ${enObjetivos ? 'on' : ''}`} onClick={() => setSectorActivo(TAB_OBJETIVOS)}>
            Objetivos
          </button>
        </nav>

        {enObjetivos && (
          <section className="sector">
            <div className="marco-embebido"><ObjetivosEstrategicos modo="gerencia" /></div>
          </section>
        )}

        {sector && (sector.estado === 'pendiente' ? (
          <div className="vacio-sector">
            <b>Sector {sector.nombre}</b>
            <p>Se completa cuando integremos su pestaña del Excel. La estructura del tablero ya está lista para recibir sus indicadores.</p>
          </div>
        ) : (
          <section className="sector">
            {sector.key === 'sistemas' ? (
              // Sistemas: dashboard completo con sub-pestañas internas (Resumen, Por agente,
              // Tickets abiertos, Evolución, Objetivos).
              <KpiSistemas onSub={setSubSistemas} />
            ) : (
            <>
            {conSub && (
              <nav className="subtabs">
                {grupos.map((g) => (
                  <button key={g} className={`subtab ${g === subActual ? 'on' : ''}`} onClick={() => setSubActivo(g)}>{g}</button>
                ))}
              </nav>
            )}
            {(conSub ? [subActual] : grupos).map((g) => {
              // La Matriz de Costo de Logística se reemplaza por el dashboard embebido.
              const esMatrizLog = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Matriz de Costo');
              if (esMatrizLog) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <MatrizCostoLogistica />
                  </div>
                );
              }
              // Métrica de Costo (Logística): $/ton descargada real vs. proyección INDEC + conclusión.
              const esMetricaCosto = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Métrica de Costo');
              if (esMetricaCosto) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <MetricaCosto />
                  </div>
                );
              }
              // Productividad de Armado de Cajas (Insumos): dashboard embebido por formadora/turno/semana.
              const esArmado = sector.key === 'insumos' && typeof g === 'string' && g.startsWith('Productividad de Armado de Cajas');
              if (esArmado) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ProductividadArmado />
                  </div>
                );
              }
              // Productividad en Cerrado de Cajas (Insumos): Bestpack, picos y máximos por máquina y mes.
              const esCerrado = sector.key === 'insumos' && typeof g === 'string' && g.startsWith('Productividad en Cerrado de Cajas');
              if (esCerrado) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ProductividadCerrado />
                  </div>
                );
              }
              // Eficiencia de Materiales (Insumos): recepción (hoja 5) + entrega (hoja 7).
              const esEficMat = sector.key === 'insumos' && typeof g === 'string' && g.startsWith('Eficiencia de materiales');
              if (esEficMat) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <EficienciaMateriales />
                  </div>
                );
              }
              // Merma de Cajas (Insumos): planchas utilizadas vs. producidas por caja y mes.
              const esMerma = sector.key === 'insumos' && typeof g === 'string' && g.startsWith('Merma de Cajas');
              if (esMerma) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <MermaCajas />
                  </div>
                );
              }
              // Productividad (Fábrica de Hielo): dashboard embebido (productividad de barras).
              const esProd = sector.key === 'fábrica-de-hielo' && g === 'Productividad';
              if (esProd) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ProductividadBarras />
                  </div>
                );
              }
              // Movimiento de Pallets (Fábrica de Hielo): tabla ejecutiva embebida.
              const esMovPallets = sector.key === 'fábrica-de-hielo' && typeof g === 'string' && g.startsWith('Movimiento de Pallets');
              if (esMovPallets) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <MovimientoPallets />
                  </div>
                );
              }
              // Monitoreo de Barras (Fábrica de Hielo): tabla ejecutiva embebida.
              const esMonBarras = sector.key === 'fábrica-de-hielo' && typeof g === 'string' && g.startsWith('Monitoreo de Barras');
              if (esMonBarras) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <MonitoreoBarras />
                  </div>
                );
              }
              // Presupuesto (Fábrica de Hielo): tabla ejecutiva embebida (presup. vs real).
              const esPresupuesto = sector.key === 'fábrica-de-hielo' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupuesto) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <Presupuesto />
                  </div>
                );
              }
              // Consumo de Gasoil (Logística): dashboard embebido (semanal, lt/100km).
              const esGasoil = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Consumo de Gasoil');
              if (esGasoil) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ConsumoGasoil />
                  </div>
                );
              }
              // Costo por Frigorífico (Logística): dashboard embebido ($ x Kg).
              const esCostoFrig = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Costo por Frigorífico');
              if (esCostoFrig) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <CostoFrigorifico />
                  </div>
                );
              }
              // Stock de Hiel (Logística): dashboard embebido (libro diario de stock).
              const esStockHiel = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Stock de Hiel');
              if (esStockHiel) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <StockHiel />
                  </div>
                );
              }
              // Necesidad de Tambores (Logística): dashboard embebido (real, por semana).
              const esTambores = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Necesidad de Tambores');
              if (esTambores) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <NecesidadTambores />
                  </div>
                );
              }
              // Disponibilidad de Flota (Logística): dashboard embebido (real, por semana).
              const esFlota = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Disponibilidad de Flota');
              if (esFlota) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <DisponibilidadFlota />
                  </div>
                );
              }
              // Presupuesto (Logística): tabla ejecutiva embebida (presup. vs real).
              const esPresupLog = sector.key === 'logística' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupLog) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <PresupuestoLogistica />
                  </div>
                );
              }
              // Presupuesto (Insumos / Compras): tabla ejecutiva embebida (presup. vs real).
              const esPresupIns = sector.key === 'insumos' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupIns) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <PresupuestoInsumos />
                  </div>
                );
              }
              const esPresupCom = sector.key === 'compras' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupCom) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <PresupuestoCompras />
                  </div>
                );
              }
              // Compras · Pendientes y Vencidas: dashboard KPI embebido (hoja KPI, primera tabla).
              const esComPend = sector.key === 'compras' && typeof g === 'string' && g.startsWith('Pendientes y vencid');
              if (esComPend) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ComprasPendientes />
                  </div>
                );
              }
              // Compras · Actividad de la semana: flujo de requisiciones + composición de pendientes.
              const esComAct = sector.key === 'compras' && typeof g === 'string' && g.startsWith('Actividad de la semana');
              if (esComAct) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ComprasActividad />
                  </div>
                );
              }
              // Compras · Vencidas por semana: desglose de las vencidas por semana de origen (KPI · A112).
              const esComVenc = sector.key === 'compras' && typeof g === 'string' && g.startsWith('Vencidas por semana');
              if (esComVenc) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ComprasVencidas />
                  </div>
                );
              }
              // Compras · Sin entrega: OC vivas con ítems pendientes de entrega.
              const esSinEntrega = sector.key === 'compras' && typeof g === 'string' && g.startsWith('Sin entrega');
              if (esSinEntrega) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ComprasSinEntrega />
                  </div>
                );
              }
              // Compras · Órdenes demoradas: dos ventanas, la tabla agrupada de demoradas
              // (hoja Demoradas) y el informe de recepción (hoja Reporte), que antes era
              // una sub-pestaña aparte.
              const esComDem = sector.key === 'compras' && typeof g === 'string' && g.startsWith('Órdenes demoradas');
              if (esComDem) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ComprasDemoradasSec />
                  </div>
                );
              }
              const esPresupCong = sector.key === 'congelado' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupCong) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <PresupuestoCongelado />
                  </div>
                );
              }
              const esPresupTal = sector.key === 'taller' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupTal) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <PresupuestoTaller />
                  </div>
                );
              }
              const esPresupLav = sector.key === 'lavadero' && typeof g === 'string' && g.startsWith('Presupuesto');
              if (esPresupLav) {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <PresupuestoLavadero />
                  </div>
                );
              }
              // Objetivo: se abre en ventanas. La primera es el cuadro de KPIs asignados
              // del sector; siempre se suma la de objetivos estratégicos de la gerencia,
              // y Compras agrega la de precios real vs. ajustado por inflación.
              if (g === 'Objetivo') {
                return (
                  <div className="grupo" key={g}>
                    {!conSub && <h2 className="grupo-titulo">{g}</h2>}
                    <ObjetivoSector sectorKey={sector.key} data={sector.objetivos} />
                  </div>
                );
              }
              const kpisG = sector.kpis.filter((k) => (k.grupo || null) === g);
              const grafG = (sector.graficos || []).filter((x) => (x.grupo || null) === g);
              const vacio = kpisG.length === 0 && grafG.length === 0;
              return (
                <div className="grupo" key={g ?? '__'}>
                  {!conSub && g && <h2 className="grupo-titulo">{g}</h2>}
                  {vacio ? (
                    <div className="vacio-sector">
                      <b>{g}</b>
                      <p>Todavía no cargamos este dato. Se agrega cuando el área lo defina.</p>
                    </div>
                  ) : (
                    <>
                      {kpisG.length > 0 && (
                        <div className="kpi-grid">{kpisG.map((k) => <KpiCard key={k.id} kpi={k} onExpand={setExpandido} />)}</div>
                      )}
                      <SectorCharts graficos={grafG} onExpand={setExpandido} />
                    </>
                  )}
                </div>
              );
            })}
            </>
            )}
          </section>
        ))}

        <footer className="pie"><span>Offal · Tablero de indicadores</span></footer>
      </main>

      {expandido && (
        <Modal titulo={expandido.kind === 'kpi' ? expandido.kpi.titulo : expandido.grafico.titulo} onClose={() => setExpandido(null)}>
          <DetalleExpandido item={expandido} />
        </Modal>
      )}
    </>
  );
}
