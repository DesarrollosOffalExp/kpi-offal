// Seguimiento de los KPI asignados a Logística · el cuadro del sector, lleno.
//
// El cuadro de «KPI asignados» viene del archivo de objetivos con las celdas en
// blanco o en N/A: dice qué se comprometió pero no cuánto se cumplió. Este
// extractor calcula los tres KPI que se pueden medir con el dato que ya tenemos,
// mes a mes, y guarda con cada valor **cómo se formó**, para que al hacer clic se
// vea el numerador, el denominador y de qué archivo salió cada uno.
//
// El cuarto KPI del cuadro —«INFORMES DE GESTION»— no se calcula: es un informe
// que todavía no se levanta a ningún sistema.
const fs = require('fs');
const path = require('path');

const DESTINO = 'client/src/dashboards/objetivos-logistica.html';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const iso = d => d instanceof Date ? d.toISOString().slice(0, 10) : null;
const lim = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toUpperCase();
const placa = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const r2 = v => v == null ? null : Math.round(v * 100) / 100;
const ANIO = '2026';

exports.actualizar = async function ({ leer, escribir, log, util, carpetas }) {
  const XLSX = require('xlsx');

  /* ═══ 1 · hoja de ruta: los viajes de colgado que hacemos nosotros ═══
     El destino se escribe a mano y aparece como «RUNFO (COLGADO)» y alguna vez
     como «RUNFO (COLGADOS)». Las hojas por año se pisan, así que se unen con la
     misma clave que usa el tablero de saturación. */
  const ARCH = [];
  carpetas.forEach(d => fs.readdirSync(d).forEach(f => {
    if (!/^hoja de ruta - transporte.*\.xlsx$/i.test(f)) return;
    const ruta = path.join(d, f);
    try { XLSX.readFile(ruta, { sheetRows: 1 }); ARCH.push(ruta); } catch (e) { /* copia ilegible */ }
  }));
  if (!ARCH.length) throw new Error('no encuentro «HOJA DE RUTA - TRANSPORTE.xlsx» en ' + carpetas.join(' ni en '));

  const viajes = new Map();
  ARCH.forEach(f => {
    const wb = XLSX.readFile(f, { cellDates: true });
    wb.SheetNames.forEach(hoja => {
      const R = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: true, defval: null, blankrows: false });
      if (!R.length || !R[0]) return;
      const enc = R[0].map(v => lim(v));
      const c = n => enc.indexOf(n);
      const K = { fe: c('FECHA'), rem: c('NUMERO DE REMITO'), pat: c('PATENTE'), des: c('DESTINO'),
        lle: c('SEMI LLEVA'), tra: c('SEMI TRAE'), cho: c('CHOFER') };
      if (K.fe < 0 || K.des < 0 || K.pat < 0) return;
      const rep = new Map();
      R.slice(1).forEach(r => {
        const fecha = iso(r[K.fe]); if (!fecha || fecha.slice(0, 4) !== ANIO) return;
        const base = fecha + '|' + String(r[K.rem] == null ? '' : r[K.rem]).trim() + '|' + placa(r[K.pat])
          + '|' + placa(r[K.lle]) + '|' + placa(r[K.tra]) + '|' + lim(r[K.des]);
        const n = (rep.get(base) || 0) + 1; rep.set(base, n);
        viajes.set(base + '#' + n, { fecha, des: lim(r[K.des]), pat: placa(r[K.pat]),
          rem: String(r[K.rem] == null ? '' : r[K.rem]).trim(),
          chofer: K.cho >= 0 ? String(r[K.cho] || '').replace(/\s+/g, ' ').trim() : '' });
      });
    });
  });
  const HRUTA = [...viajes.values()];
  const colgPropio = HRUTA.filter(v => /COLGADO/.test(v.des)).sort((a, b) => a.fecha < b.fecha ? -1 : 1);

  /* ═══ 2 · consumo de combustible ═══ */
  const wbC = (() => {
    const w = leer('2026 Consumo de combustible.xlsx');
    return { ruta: w.ruta, hojas: w.hojas, filas: w.filas };
  })();
  const hojaFlet = wbC.hojas.find(h => /KG-FLETES-DESCRIMINADO/i.test(h));
  const hojaRes = wbC.hojas.find(h => /^resumenkgs$/i.test(h.replace(/\s+/g, '')));
  if (!hojaFlet) throw new Error('«2026 Consumo de combustible.xlsx» no tiene la hoja KG-FLETES-DESCRIMINADO');
  if (!hojaRes) throw new Error('«2026 Consumo de combustible.xlsx» no tiene la hoja ResumenKgs');

  /* ── 2a · fletes de colgado ─────────────────────────────────────────────
     El encabezado está en la segunda fila: la primera sólo tiene el año. */
  const F = wbC.filas(hojaFlet);
  const encF = (F[1] || []).map(v => lim(v));
  const cF = n => encF.indexOf(n);
  const KF = { dia: cF('DÍA'), trans: cF('TRANSPORTE'), dest: cF('ORIGEN / DESTINO'), merc: cF('MERCADERÍA'),
    tarifa: cF('TARIFA(SIN IVA)'), kilos: cF('KILOS'), tipo: cF('TIPO DE FLETE') };
  if (KF.dia < 0 || KF.merc < 0) throw new Error(hojaFlet + ': no encuentro las columnas DÍA y MERCADERÍA');
  const fletes = F.slice(2).filter(r => r && r[KF.dia] instanceof Date && iso(r[KF.dia]).slice(0, 4) === ANIO)
    .map(r => ({ fecha: iso(r[KF.dia]), trans: lim(r[KF.trans]), dest: lim(r[KF.dest]), merc: lim(r[KF.merc]),
      tarifa: +r[KF.tarifa] || 0, kilos: +r[KF.kilos] || 0, tipo: lim(r[KF.tipo]) }));
  const colgFlete = fletes.filter(r => /COLGADO/.test(r.merc));

  /* ── 2b · ResumenKgs: viajes por proveedor y por transporte ── */
  const R = wbC.filas(hojaRes);
  const encR = (R[0] || []).map(v => lim(v));
  const cR = n => encR.indexOf(n);
  const KR = { fe: cR('FECHA'), ing: cR('Nº INGRESO'), prov: cR('PROVEEDOR'), pat: cR('PATENTE'),
    kilos: cR('KILOS'), rs: cR('PATENTES.RAZONSOCIAL'), tr: cR('TRANSPORTE') };
  if (KR.fe < 0 || KR.prov < 0 || KR.tr < 0) throw new Error(hojaRes + ': no encuentro FECHA, PROVEEDOR o TRANSPORTE');
  const ingresos = R.slice(1).filter(r => r && r[KR.fe] instanceof Date && iso(r[KR.fe]).slice(0, 4) === ANIO)
    .map(r => ({ fecha: iso(r[KR.fe]), ing: r[KR.ing], prov: lim(r[KR.prov]), pat: placa(r[KR.pat]),
      kilos: +r[KR.kilos] || 0, rs: lim(r[KR.rs]), tr: lim(r[KR.tr]) }));

  /* ═══ 3 · la métrica de costo, que ya está calculada ═══ */
  const MZ = util.actual('client/src/dashboards/matriz-costo-logistica.html', 'D_RAW');
  if (!MZ) throw new Error('no pude leer D_RAW de matriz-costo-logistica.html');

  /* ═══ helpers ═══ */
  const mesDe = f => +f.slice(5, 7);
  const agrupar = (lista, cond) => {
    const m = {};
    lista.filter(cond || (() => true)).forEach(x => { const k = mesDe(x.fecha); (m[k] = m[k] || []).push(x); });
    return m;
  };
  // Meses en que la fuente tiene algo cargado: sirve para distinguir «cero» de
  // «todavía no cerró el mes».
  const mesesCon = lista => new Set(lista.map(x => mesDe(x.fecha)));

  /* ═══ KPI 1 · colgado con flota propia ═══ */
  const K1 = (() => {
    const propios = agrupar(colgPropio);
    const flet = agrupar(colgFlete);
    const conFlete = mesesCon(colgFlete), conRuta = mesesCon(HRUTA);
    const meses = [...new Set([...Object.keys(propios), ...Object.keys(flet)])].map(Number).sort((a, b) => a - b);
    const valores = meses.map(m => {
      const p = propios[m] || [], f = flet[m] || [];
      const total = p.length + f.length;
      const porProv = {};
      f.forEach(x => { porProv[x.trans] = (porProv[x.trans] || 0) + 1; });
      return {
        mes: m, valor: total ? r1(100 * p.length / total) : null,
        // El mes está incompleto si la hoja de ruta llega pero el archivo de
        // fletes todavía no cargó nada de ese mes.
        parcial: conRuta.has(m) && !conFlete.has(m),
        propios: p.length, fleteros: f.length, total,
        kilosFlete: f.reduce((a, x) => a + x.kilos, 0),
        tarifaFlete: f.reduce((a, x) => a + x.tarifa, 0),
        porProveedor: Object.entries(porProv).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })),
        detallePropios: p.map(x => ({ f: x.fecha, pat: x.pat, rem: x.rem, chofer: x.chofer })),
      };
    });
    return valores;
  })();

  /* ═══ KPI 2 · rutas que pasaron a flota propia ═══ */
  const RUTAS = [{ clave: 'ARRE BEEF', re: /ARRE\s*BEEF/i }, { clave: 'BLACK BAMBOO', re: /BLACK\s*BAMBOO/i }];
  const K2 = (() => {
    const sel = ingresos.filter(x => RUTAS.some(r => r.re.test(x.prov)));
    const porMes = agrupar(sel);
    // Cuánto pesan estas dos rutas sobre todo lo que se movió en el mes: sin ese
    // contexto, un 70 % de cumplimiento puede estar moviendo el 5 % del gasto.
    const todoElMes = agrupar(ingresos);
    const meses = Object.keys(porMes).map(Number).sort((a, b) => a - b);
    return meses.map(m => {
      const l = porMes[m];
      const prop = l.filter(x => /PROPIO/.test(x.tr));
      const porRuta = RUTAS.map(r => {
        const s = l.filter(x => r.re.test(x.prov));
        return { ruta: r.clave, total: s.length, propios: s.filter(x => /PROPIO/.test(x.tr)).length,
          kilos: s.reduce((a, x) => a + x.kilos, 0) };
      });
      const porFletero = {};
      l.filter(x => !/PROPIO/.test(x.tr)).forEach(x => { porFletero[x.rs || '(sin razón social)'] = (porFletero[x.rs || '(sin razón social)'] || 0) + 1; });
      const mes = todoElMes[m] || [];
      const kilosMes = mes.reduce((a, x) => a + x.kilos, 0);
      const kilosRutas = l.reduce((a, x) => a + x.kilos, 0);
      return {
        mes: m, valor: l.length ? r1(100 * prop.length / l.length) : null, parcial: false,
        propios: prop.length, total: l.length, fleteros: l.length - prop.length,
        viajesMes: mes.length, kilosMes,
        pesoViajes: mes.length ? r1(100 * l.length / mes.length) : null,
        pesoKilos: kilosMes ? r1(100 * kilosRutas / kilosMes) : null,
        kilosPropios: prop.reduce((a, x) => a + x.kilos, 0),
        kilosTotal: l.reduce((a, x) => a + x.kilos, 0),
        porRuta, porFletero: Object.entries(porFletero).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v })),
      };
    });
  })();

  /* ═══ KPI 3 · costo real contra el ajustado por INDEC ═══
     La cuenta ya la hace la matriz: cada mes se compara contra el real del mes
     anterior inflado por el INDEC de ese mes. Enero es la base y no tiene
     variación. Un valor negativo es bueno: el costo real quedó por debajo de lo
     que la inflación explicaba. */
  const K3 = (() => {
    const real = MZ.pesoTonDesc || [], ajus = MZ.ajusteIndec || [], pct = MZ.pctIndec || [], ind = MZ.indec || [];
    const out = [];
    for (let i = 1; i < real.length; i++) {
      if (real[i] == null || !ajus[i]) continue;
      out.push({
        mes: i + 1, valor: pct[i] == null ? null : r1(pct[i] * 100), parcial: false,
        real: Math.round(real[i]), ajustado: Math.round(ajus[i]), base: Math.round(real[i - 1]),
        indec: ind[i] == null ? null : r2(ind[i] * 100),
        diferencia: Math.round(real[i] - ajus[i]),
      });
    }
    return out;
  })();

  /* ═══ el paquete ═══ */
  const ultimoMes = Math.max(...[].concat(K1, K2, K3).map(v => v.mes));
  const DATA = {
    meta: {
      anio: ANIO, generado: new Date().toISOString().slice(0, 10),
      persona: 'Dario Pisano', ultimoMes, meses: MESES.slice(0, ultimoMes),
      hojaRuta: { viajes: HRUTA.length, desde: HRUTA.map(v => v.fecha).sort()[0], hasta: HRUTA.map(v => v.fecha).sort().pop() },
      fletes: { filas: fletes.length, hoja: hojaFlet, hasta: fletes.map(v => v.fecha).sort().pop() },
      ingresos: { filas: ingresos.length, hoja: hojaRes, hasta: ingresos.map(v => v.fecha).sort().pop() },
    },
    kpis: [
      {
        n: 1, sentido: 'up', unidad: '%',
        titulo: 'Colgado con flota propia',
        kpi: 'REEMPLAZAR LOS VIAJES DE COLGADO PARA HACER CON FLOTA PROPIA UNA VEZ REPARADOS LOS EQUIPOS DE FRIO.',
        objetivo: 'Mejorar un 15% el costo por tonelada transportado (interno y externo)',
        mide: 'Qué parte de los viajes de colgado hacemos nosotros, sobre el total de viajes de colgado del mes.',
        formula: 'viajes propios de colgado ÷ (propios + de fletero) × 100',
        fuentes: [
          'Propios: HOJA DE RUTA - TRANSPORTE.xlsx, viajes con destino «RUNFO (COLGADO)».',
          'De fletero: 2026 Consumo de combustible.xlsx, hoja «' + hojaFlet + '», filas con MERCADERÍA = COLGADO.',
        ],
        valores: K1,
      },
      {
        n: 2, sentido: 'up', unidad: '%',
        titulo: 'Rutas que pasaron a flota propia',
        kpi: 'PRESENTAREMOS ALTERNATIVAS PARA REALIZAR VIAJES CON FLOTA PROPIA EN RUTAS QUE PODAMOS CUMPLIR Y ELIMINAREMOS EL FLETE DE ESA RUTA.',
        objetivo: 'Mejorar un 15% el costo por tonelada transportado (interno y externo)',
        mide: 'Qué parte de los viajes a Arre Beef y Black Bamboo hacemos con flota propia. Son dos rutas que antes se hacían enteras con flete.',
        formula: 'viajes propios a esas dos rutas ÷ total de viajes a esas dos rutas × 100',
        fuentes: [
          '2026 Consumo de combustible.xlsx, hoja «' + hojaRes + '»: cada fila es un ingreso con su proveedor y su transporte.',
          'Se toman los proveedores ARRE BEEF S.A y BLACK BAMBOO ENTERPRISES S.A, y se cuenta como propio lo que tiene TRANSPORTE = PROPIO.',
        ],
        valores: K2,
      },
      {
        n: 3, sentido: 'down', unidad: '%',
        titulo: 'Costo real contra el ajustado por inflación',
        kpi: 'SE TOMARAN LOS GASTOS DEL AÑO ANTERIOR MAS LA INFLACION DEL AÑO Y SE LO VA A COMPRARAR POR LO PAGADO AL TRANSPORTISTA.',
        objetivo: 'Mejorar un 15% el costo por tonelada transportado (interno y externo)',
        mide: 'Cuánto se despegó el costo real por tonelada de lo que la inflación explicaba. Negativo es bueno: el mes cerró por debajo del ajuste.',
        formula: '(costo real del mes − costo del mes anterior ajustado por INDEC) ÷ ajustado × 100',
        fuentes: [
          'Matriz de Costo de Logística: TOTAL $ x TONS DESC de cada mes.',
          'Índice de precios del INDEC del mes, el mismo que usa la Métrica de Costo.',
        ],
        nota: 'Se evalúa dentro del año, mes contra mes anterior, y no contra el año pasado. Enero es la base y por eso no tiene variación.',
        valores: K3,
      },
    ],
  };

  escribir(DESTINO, 'DATA', DATA);

  log('hoja de ruta: ' + HRUTA.length + ' viajes de ' + ANIO + ' · colgado propio: ' + colgPropio.length);
  log('fletes de colgado: ' + colgFlete.length + ' viajes · ' + colgFlete.reduce((a, x) => a + x.kilos, 0).toLocaleString('es-AR') + ' kg');
  log('ingresos de ResumenKgs: ' + ingresos.length + ' · a las dos rutas: ' + ingresos.filter(x => RUTAS.some(r => r.re.test(x.prov))).length);
  DATA.kpis.forEach(k => {
    log('KPI ' + k.n + ' · ' + k.titulo);
    log('   ' + k.valores.map(v => MESES[v.mes - 1].slice(0, 3) + ' '
      + (v.valor == null ? '—' : v.valor + '%') + (v.parcial ? '*' : '')).join(' · '));
  });
  if (DATA.kpis[0].valores.some(v => v.parcial)) log('   (*) mes con la hoja de ruta cargada y el archivo de fletes todavía sin cerrar');
};
