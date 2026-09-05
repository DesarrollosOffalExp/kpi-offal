import { useState } from 'react';
import Ventanas from './Ventanas';
import CuadroObjetivos from './CuadroObjetivos';
import ObjetivosEstrategicos from './ObjetivosEstrategicos';
import ComprasPrecios from './ComprasPrecios';
import ObjetivosLogistica from './ObjetivosLogistica';

// Sección "Objetivo" de un sector, dividida en ventanas. Primero el objetivo
// estratégico (el número del sector mes a mes y el desglose de sus KPI) y
// después los KPI asignados. Compras suma el seguimiento del objetivo de costo.

// Nombre del área tal como figura en el archivo de objetivos, por clave de sector.
const AREA = {
  insumos: 'Insumos',
  compras: 'Compras',
  'logística': 'Logística',
  'fábrica-de-hielo': 'Fábrica de Hielo',
  sistemas: 'Sistemas',
};

export default function ObjetivoSector({ sectorKey, data }) {
  const ventanas = [
    { key: 'estrategicos', nombre: 'Objetivo estratégico', hint: 'Mes a mes, con el desglose de KPI' },
  ];
  if (data && data.filas) ventanas.push({ key: 'asignados', nombre: 'KPI asignados', hint: 'Los objetivos cargados al sector' });
  if (sectorKey === 'compras') ventanas.push({ key: 'precios', nombre: 'Precios real vs. ajustado', hint: 'Seguimiento del objetivo de costo' });
  // Logística: el cuadro de arriba dice qué se comprometió; esta ventana, cuánto
  // se cumplió, con la justificación de cada valor.
  if (sectorKey === 'logística') ventanas.push({ key: 'seguimiento', nombre: 'Seguimiento de KPI', hint: 'Los KPI asignados, calculados mes a mes' });

  const [ventana, setVentana] = useState(ventanas[0].key);
  const activa = ventanas.some((v) => v.key === ventana) ? ventana : ventanas[0].key;

  return (
    <div className="obj-sector">
      <Ventanas items={ventanas} activa={activa} onCambiar={setVentana} etiqueta="Ventanas de la sección Objetivo" />
      {activa === 'estrategicos' && (
        <div className="marco-embebido"><ObjetivosEstrategicos modo="sector" area={AREA[sectorKey]} /></div>
      )}
      {activa === 'asignados' && <CuadroObjetivos data={data} />}
      {activa === 'precios' && <div className="marco-embebido"><ComprasPrecios /></div>}
      {activa === 'seguimiento' && <div className="marco-embebido"><ObjetivosLogistica /></div>}
    </div>
  );
}
