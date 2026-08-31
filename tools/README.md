# tools · de dónde sale cada dato de los tableros

Los tableros de `client/src/dashboards/*.html` llevan los datos adentro: son una
foto del Excel de SharePoint, no una consulta en vivo. Esta carpeta guarda **de
qué archivo sale cada dato, de qué hoja, de qué columnas y con qué cuenta**, y el
script que rehace esa foto.

## Cómo se actualiza

1. Bajar de SharePoint los archivos de la carpeta que cambió, a `Descargas`.
2. Correr el actualizador con el nombre del grupo:

```bash
node tools/actualizar.js fabrica-hielo
```

Grupos disponibles: `fabrica-hielo`, `compras`, `sistemas`, `objetivos`,
`presupuesto`, `insumos`, `logistica`. Sin argumentos lista todo lo que sabe hacer.

El script busca cada archivo por nombre en `Descargas`, tolerando los sufijos
que agrega el navegador (`archivo (2).xlsx`) y quedándose con el más reciente.
Con `--dir <ruta>` se puede apuntar a otra carpeta y con `--dry` se ve el
diff sin escribir nada.

Antes de escribir, cada extractor **rehace los períodos que ya estaban cargados
y los compara**. Si un período viejo no da igual, lo avisa: o cambió la planilla
o cambió la forma de leerla, y conviene mirarlo antes de seguir.

## Por qué un manifiesto y no sólo el script

`fuentes.json` está en castellano y describe la cuenta de cada indicador con
palabras. Sirve para dos cosas: que se pueda auditar un número sin leer código,
y que cuando la planilla cambie de forma —que cambia seguido— se vea rápido qué
suposición se rompió.

## Lo que hay que saber de estas planillas

- **Los nombres de hoja cambian todos los meses.** El resumen del presupuesto se
  llamó `DESVIOS ANALIZADOS`, `PARTIDA PRESUPUESTARIA`, `RESUMEN` y
  `Resumen Gerencia` según el mes. Los extractores buscan la hoja **por
  contenido**, no por nombre.
- **Hay nombres de archivo con doble espacio.** Varios `MONITOREO DE BARRAS  DEL
  …` tienen dos espacios donde SharePoint muestra uno. La búsqueda normaliza
  espacios.
- **Los totales no siempre se suman.** En Movimiento de Pallets el total de la
  semana es la fila `STOCK FINAL` de la planilla, no la suma de los frigoríficos.
- **Las fechas pueden venir como número de serie** de Excel cuando la celda no
  está formateada como fecha.
- **Hay hojas que dejan armado todo el año con ceros.** En `Picos de empaque
  TPM` la hoja `Comparativo_Semanal` tiene las 53 semanas; sólo valen las que ya
  cerraron. Lo mismo con la semana en curso en `Prod. Armado de Cajas`.
- **En armado, las horas son la columna F** (`Total de tiempo` = horas armando −
  tiempo en falla), no la D. Y el tablero lista siempre las cuatro formadoras:
  la que no trabajó va en cero y el ideal del total sigue siendo 76 cajas/min.
- **Una semana cerrada se sigue corrigiendo.** El archivo del 15 al 21 de
  agosto de Monitoreo de Barras se completó cuatro días después (+5 % de kilos).
  Por eso el extractor no sólo suma semanas nuevas: rehace las ya cargadas y
  avisa qué cambió.
- **Hay fórmulas rotas que hay que rehacer.** En `2026 Consumo de
  combustible` la fila `DESCARGA KG NETA` de la hoja `Gastos` es una tabla
  dinámica que da #REF!, y con ella se caen todas las series por kilo. El
  extractor lo detecta y rehace los kilos sumando `ResumenKgs`.
- **Hay hojas que se pisan cada semana.** `Costo Frigo` guarda una sola semana
  por vez: el tablero acumula y no se puede revalidar el histórico.
- **Algunas hojas traen bloques viejos arriba del bueno.** En la hoja `KPI` de
  Compras hay tres versiones de la misma tabla; la que vale es la que tiene las
  columnas `Total REQ Tratadas` y `Observaciones`.
- **Y otras repiten los encabezados dos veces en la misma fila.** En `STOCK HIEL`
  la hoja `STOCK` tiene el detalle por bin despachado y, más a la derecha, un
  resumen por día con los mismos títulos (`PESADA`, `N° TICKET`, `REMITO`).
  Mapear las columnas por nombre dejando ganar la última match daba el resumen,
  que se carga a mano y no siempre coincide: el 6 de agosto el detalle tiene
  3.920 kg de balanza y el resumen 3.751,5. Vale el detalle, y la corrida avisa
  cuando los dos no dan igual.
- **Hay tableros cuya única memoria es nuestra.** La tabla de vencidas de Compras
  se recalcula sola y pierde las requisiciones que se destrabaron. Cada corrida
  guarda una foto en `tools/historico-vencidas.json`: si se borra, el histórico
  no se puede reconstruir desde la planilla.
- **Una cuenta puede estar partida en tramos.** El `Consolidado` de tambores no
  corre de enero a hoy: se cerró en cero dos veces (hasta la S20 y en la S33,
  que fue un arqueo). El saldo es la suma de la S21 a la S32 y `Año 2026` la de
  la S34 en adelante. Los cortes están en la constante `TRAMOS` del extractor y
  cada corrida controla que las dos columnas den la suma de sus semanas.

## Cómo se analiza el costo de Logística

No se evalúa gasto contra gasto: cada rubro tiene su propia lógica y todo se mide
**por toneladas transportadas y por cantidad de viajes**.

- **Propios**: un fijo, el sueldo del personal, y un variable, el gasoil según los
  kilómetros. Ojo que el combustible se imputa **por compra y no por consumo**, así
  que el rubro se mueve con la decisión de stockear.
- **Fletes**: plano, cada viaje vale lo mismo lleve lo que lleve. Si hay más viajes
  tiene que haber más gasto; si no se verifica, mirar la registración de las
  facturas. **Ningún fletero factura por mes: todos facturan a semana vencida**, así
  que el gasto de un mes nunca coincide con los viajes de ese mes.
- **Lavatachos**: sólo personal; varía con los días extraordinarios (feriados
  trabajados).
- **Taller**: reparaciones del mes. Sin preventivos no hay tendencia que buscarle.

El promedio del valor del viaje **no sirve** para comparar meses: mezcla un equipo
completo de ~ M con un tractorista externo de ~60 k, y se mueve solo con el
cambio de mezcla. Hay que abrirlo por tipo de equipo.

## Índices que no salen de SharePoint

La ventana **Métrica de Fletes** compara contra tres índices que no están en
ningún Excel de la empresa: el ICT de FADEEAC, el precio oficial del gasoil de
la Secretaría de Energía y el IPC del INDEC. Viven en `tools/indices-externos.json`
con la URL y el corte exacto de cada uno, y **se actualizan a mano** cuando sale
el informe del mes. El PDF de FADEEAC es una imagen: el texto se saca
descomprimiendo los streams del PDF, no con un lector común.

## Agregar una fuente nueva

1. Sumar la entrada en `fuentes.json` con archivo, hoja, columnas y la cuenta.
2. Escribir el extractor en `tools/extractores/<grupo>.js`, exportando
   `async function actualizar({ leer, escribir, log, dry })`.
3. Dejar la validación contra lo ya cargado: es lo que avisa cuando la planilla
   cambia de forma.

## Una trampa que ya nos mordió

Varios tableros declaran sus datos encadenados en una sola sentencia:

```js
var ACC=[…], ACC_MES='07/2026';
```

Reemplazar el literal con un regex no-greedy —cortando en el primer `]`— se
lleva puesto lo que sigue y deja el archivo sin `ACC_MES`. Por eso `escribir()`
**cuenta corchetes** en vez de usar un regex, y saltea comillas para no cortar
dentro de un string. Aun así conviene dejar **una declaración por sentencia**:
las que estaban encadenadas ya se separaron.

Y una segunda: **`escribir()` reemplaza el literal entero**. Si `DATA` tiene
más claves que las que arma el extractor —en Productividad de Armado convivían
`weeks`, `ultima`, `ideal` y `capacidad`— hay que escribir el objeto fusionado
(`Object.assign({}, viejo, { … })`), no sólo la parte nueva, o el tablero se
queda sin la mitad de sus datos y falla en silencio al renderizar.

Después de cada corrida vale la pena chequear que los tableros sigan siendo
JavaScript válido:

```bash
node -e "const s=require('fs').readFileSync('client/src/dashboards/kpi-sistemas.html','utf8');new Function(s.match(/<script>\s*\(function\(\)\{([\s\S]*?)\}\)\(\);\s*<\/script>/)[1]);console.log('ok')"
```

## Qué falta

Dentro de `insumos`, la `merma-cajas`: el KPI mensual está en la hoja `KPIs`,
pero el detalle por tipo de caja sale de cruzar `Consumos Deposito` con
producción y todavía no está mapeado. **Métrica de Fletes** y **Cierre Enero–Febrero** todavía no tienen
extractor: los tableros están armados pero sus datos se cargaron a mano, así que
pedir "actualizá logística" no los toca. El script avisa cuándo un grupo no tiene
extractor en lugar de fallar de cualquier modo.

Todo lo demás está cubierto: los 32 tableros de `client/src/dashboards` tienen
su fuente declarada en `fuentes.json` y su extractor, y los siete grupos corren
de punta a punta. Se puede comprobar con `--dry`, que muestra qué quedaría
escrito sin tocar nada.
