import { useEffect, useState } from 'react';
import { getMe, getKpis } from './api';
import Navbar from './components/Navbar';
import KpiCard from './components/KpiCard';
import TrendChart from './components/charts/TrendChart';
import DistribChart from './components/charts/DistribChart';

function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [data, setData] = useState(null);
  const [sectorActivo, setSectorActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

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
            <button
              key={s.key}
              className={`tab ${s.key === sector?.key ? 'on' : ''}`}
              onClick={() => setSectorActivo(s.key)}
            >
              {s.nombre}
            </button>
          ))}
        </nav>

        {sector && (
          <section className="sector">
            <div className="kpi-grid">
              {sector.kpis.map((k) => (
                <KpiCard key={k.id} kpi={k} />
              ))}
            </div>

            <div className="charts-grid">
              <TrendChart periodos={data.periodos} kpis={sector.kpis} />
              {sector.distribucion && <DistribChart dist={sector.distribucion} />}
            </div>
          </section>
        )}

        <footer className="pie">
          <span>Offal · Tablero de indicadores</span>
        </footer>
      </main>
    </>
  );
}
