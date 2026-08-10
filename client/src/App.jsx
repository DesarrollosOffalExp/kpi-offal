import { useEffect, useState } from 'react';
import { getMe, getKpis } from './api';
import Navbar from './components/Navbar';
import KpiCard from './components/KpiCard';
import SectorCharts from './components/SectorCharts';
import Chart from './components/Chart';
import Modal from './components/Modal';

function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmt(v, formato, unidad) {
  if (v == null || Number.isNaN(v)) return '—';
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

  if (cargando) return <div className="estado">Cargando indicadores…</div>;
  if (error) return <div className="estado error">{error}</div>;

  const sector = data?.sectores?.find((s) => s.key === sectorActivo) || data?.sectores?.[0];

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

  return (
    <>
      <Navbar usuario={usuario} />
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
        </nav>

        {sector && (sector.estado === 'pendiente' ? (
          <div className="vacio-sector">
            <b>Sector {sector.nombre}</b>
            <p>Se completa cuando integremos su pestaña del Excel. La estructura del tablero ya está lista para recibir sus indicadores.</p>
          </div>
        ) : (
          <section className="sector">
            {sector.periodo && <div className="sector-periodo">Datos de la <b>{sector.periodo}</b></div>}
            {conSub && (
              <nav className="subtabs">
                {grupos.map((g) => (
                  <button key={g} className={`subtab ${g === subActual ? 'on' : ''}`} onClick={() => setSubActivo(g)}>{g}</button>
                ))}
              </nav>
            )}
            {(conSub ? [subActual] : grupos).map((g) => {
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
