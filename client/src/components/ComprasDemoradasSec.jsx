import { useState } from 'react';
import Ventanas from './Ventanas';
import ComprasDemoradas from './ComprasDemoradas';
import ComprasInforme from './ComprasInforme';

// Compras · Órdenes demoradas, en dos ventanas:
//   · Demoradas → ítems de OC vencidos y pendientes de recepción (hoja Demoradas).
//   · Informe   → recepción en tiempo vs. fuera de plazo (hoja Reporte, AX vs BI).
// El informe estaba como sub-pestaña aparte y se movió acá.
const VENTANAS = [
  { key: 'demoradas', nombre: 'Demoradas', hint: 'OC vencidas y pendientes de recepción' },
  { key: 'informe', nombre: 'Informe', hint: 'Recepción en tiempo vs. fuera de plazo' },
];

export default function ComprasDemoradasSec() {
  const [ventana, setVentana] = useState('demoradas');
  return (
    <div className="com-demoradas">
      <Ventanas items={VENTANAS} activa={ventana} onCambiar={setVentana} etiqueta="Ventanas de Órdenes demoradas" />
      {ventana === 'demoradas' ? <ComprasDemoradas /> : <ComprasInforme />}
    </div>
  );
}
