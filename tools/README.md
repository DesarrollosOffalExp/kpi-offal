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
`presupuesto`, `insumos`, `logistica`, `gestion`. Sin argumentos lista todo lo que
sabe hacer.

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

## Gerencia de Gestión no se organiza como Gerencia de Operaciones

Las dos carpetas guardan el presupuesto, pero no de la misma forma, y conviene no
confundirlas:

- **Gerencia de Operaciones / Presupuesto** tiene *un archivo por mes* en una
  única carpeta (`Gerencia de Operaciones 072026.xlsx`), ya analizado: trae
  presupuestado, gasto real y las acciones correctivas que escribió cada sector.
- **Gerencia de Gestión** tiene *una carpeta por mes analizado*, y adentro
  `presupuesto <mes> <año>.xlsx`, que es el **export crudo del ERP**: sólo gasto
  real, sin presupuestado y sin justificaciones.

Del export crudo el gasto del mes **no es una hoja**, son tres que se suman:
`Hoja1` No Transaccionables (servicios, mano de obra y fletes, imputados al
facturarse), `Hoja4` Consumos (materiales, imputados al centro de costo
**destino** al salir del almacén) y `Hoja2` Ajustes de inventario (suman o
restan). `Hoja5` trae ese mismo total ya consolidado por la planilla: no se usa
como fuente, se usa como **control** —cada corrida compara los tres componentes
contra ella y avisa si alguno se despega más de medio punto.

`Hoja3` (Detalle de Comprobante) es tentadora porque tiene historia —de 12/2023 a
08/2026— pero **mide facturas de compra, no gasto del mes**: para julio da 5.798 M
contra los 6.295 M de arriba. Sumarla a la serie daría una evolución que no cierra
con ningún mes. Por eso el extractor la ignora.

Y ojo con el nombre: en `Descargas` convive `presupuesto enero 2026
detallado.xlsx`, que es otro archivo, de Logística. El extractor sólo acepta el
patrón exacto `presupuesto <mes> <año>.xlsx`.

### La "nueva presentación" de julio 2026

En julio el archivo cambió de nombre —`INFO <MES> <AÑO> …`, antes `presupuesto
<mes> <año>.xlsx`— y sobre todo de forma. El extractor lee las dos, pero conviene
saber qué cambió:

- Pasó de cinco hojas (`Hoja1`..`Hoja5`) a **dos**: `SERVICIOS` (no
  transaccionables) y `MATERIALES` (consumos).
- **La mano de obra ya no está.** Ni propia ni eventual. Se fue a un archivo
  aparte, `COSTOS Mano de Obra <mes> <año>.xlsx`, que **todavía no se procesa**.
  Por eso el total de julio bajó de 6.295 M a 2.581 M: no es que haya bajado el
  gasto, es que faltan los 3.151 M de mano de obra.
- Tampoco vienen los **ajustes de inventario** ni la hoja de **totales de
  control**. De control quedó sólo la tabla dinámica de consumos por centro de
  costo que `MATERIALES` trae pegada al costado, sin encabezado.
- `SERVICIOS` sumó una columna, **`Periodo Devengado Manual`**, en el medio: por
  eso las columnas se mapean **por nombre de encabezado** y no por posición.
  Leerlas por posición tomaba el importe de la columna equivocada.
- El **centro de costo viene a veces con el código y a veces con el nombre** en
  la misma columna (`LOG` y `LOGISTICA`, `SIS` y `SISTEMAS`, `RH` y `RRHH`…). Sin
  normalizar, Logística quedaba partida en dos filas, de 832,3 M y 5,3 M.

Y lo importante para leer los números: la nueva presentación **incluye las
facturas devengadas en el mes siguiente**, que es el criterio con el que los
sectores arman su presupuesto. Con eso Fletes cerró:

| Fletes de julio · centro `LOG` | |
|---|---|
| Gestión, presentación vieja (devengado 07/2026) | 768,0 M |
| Gestión, presentación nueva | **827,1 M** |
| Logística (`PRESUPUESTO LOGISTICA.xlsx`) | **827,1 M** |

Antes la diferencia era de 59,1 M y se explicaba entera por el corrimiento: ningún
fletero factura por mes, todos facturan a semana vencida, así que la factura del 5
de agosto es de viajes de julio. Eran 103,7 M que Logística contaba en julio y el
ERP devengaba en agosto, contra 44,6 M de facturas de julio que el ERP contaba y
Logística ya había contado en junio.

Si alguna vez hay que volver a cruzar las dos ventanas: **factura por factura sólo
se puede desde el lado del ERP**, que trae proveedor y número de comprobante. El
archivo de Logística no trae número de factura y agrupa la cola en una sola línea
—en julio, 66 ítems menores en un renglón de 81,6 M—, así que lo más fino posible
es cruzar por importe.

### La carpeta de Gestión ya no hay que bajarla

`fuentes.json` le pone al grupo una `carpetaLocal`: la carpeta de SharePoint
sincronizada (`Gerencia de Gestion/Presupuesto <mes>`). El actualizador busca
primero ahí y después en `Descargas`, así que los tres archivos del mes se leen
directo de OneDrive, sin descargar nada. Con `--dir` se sigue pudiendo apuntar a
otra carpeta.

Los tres archivos son:

| | |
|---|---|
| `INFO <MES> <AÑO> …` | servicios, fletes y materiales |
| `COSTOS Mano de Obra <mes> <año>` | mano de obra propia y eventual |
| `INFO PRESUPUESTADO <AÑO> …` | **presupuestado** y la gerencia de cada sector |

Cuidado con los dos que empiezan igual: `INFO PRESUPUESTADO …` es el presupuesto
y `INFO <MES> <AÑO> …` es el gasto.

Del archivo de presupuestado hay dos cosas para saber. Primero, **a la derecha
del año hay un segundo juego de doce columnas de mes** (`PARTIDAS AJUSTADAS`,
`CODIGO` y otra vez enero a diciembre) que es un anexo de trabajo: se toma sólo el
primer bloque contiguo, o el presupuesto sale al doble. Segundo, **cada archivo
nombra distinto al mismo centro de costo** —"DESCARGA MENUDENCIAS" el de gasto,
"DESCARGA" el de mano de obra, "ADMINISTRACION DE PLANTA" contra "ADMINISTRACION
Y FINANZAS"— así que se guardan todos los alias vistos, más los que no se pueden
deducir, en la constante `ALIAS` del extractor.

`RECICLADO` y `RUNFO` tienen partida presupuestaria pero no gastaron nada en
julio: entran igual, en cero, porque un presupuesto sin ejecutar también es una
desviación.

### Un mes por carpeta, todos los meses de una

`carpetaLocal` apunta a `Gerencia de Gestion` y el actualizador **expande sus
subcarpetas**: cada `Presupuesto <Mes>` entra sola en la búsqueda. El extractor
lee **todos** los archivos de gasto que encuentre, uno por mes, y publica los dos
—o los que haya— para poder comparar. El último es el mes analizado.

Cuidado con dos cosas al sumar un mes:

- **La forma cambia entre meses.** Junio trae la hoja `MATERIAL` y la columna
  `DEVENGADO MANUAL`; julio, `MATERIALES` y `Periodo Devengado Manual`. Las hojas
  se buscan con `/^material(es)?$/i` y `/^servicios?$/i`, y el mes acepta los dos
  nombres de la columna manual. Todo lo demás se mapea por nombre de encabezado.
- **En `Descargas` puede quedar el archivo viejo del mismo mes.** Quedó
  `presupuesto julio 2026.xlsx`, de la presentación anterior, y por nombre más
  corto ganaba: julio daba 9.235 M en vez de 5.521 M. Ahora `archivosDeGasto()`
  prioriza el patrón nuevo (`INFO <MES> <AÑO>`) sobre el viejo, y recién a igual
  presentación desempata por nombre más corto.

El presupuestado no se toca: ese archivo ya trae los doce meses, así que sirve
para cualquier mes que se cargue.

### Tres niveles: grupo → ítem → comprobante

La tabla de Gestión se abre en tres pasos, y cada uno sale del mismo lugar que el
de arriba, así que los totales siempre cierran:

1. **Gasto real** → los ítems (subrubros) que lo forman.
2. **Dif. mes ant.** → los ítems que explican la diferencia contra el mes anterior.
3. **clic en un ítem** → los comprobantes de los dos meses. La factura casi nunca
   se repite entre meses: lo que aparece de un lado y no del otro **es** la
   diferencia.

`DATA.docs` guarda ese tercer nivel agregado por comprobante
(`[mes, centro, grupo, ítem, comprobante, proveedor u origen, importe]`): 1.373
filas de las 10.600 del archivo, 81 KB. La clave usa **el mismo ítem** que la
celda del nivel de arriba, o los dos niveles no se encuentran.

Dos grupos no tienen tercer nivel, y no es un olvido:

- **Mano de obra.** Sale del archivo de costos, que es un modelo por CECO y
  concepto. No hay comprobantes: el desglose por concepto ya es el máximo detalle.
- **Fletes de Logística.** Se excluyen a propósito. Ningún fletero factura por
  mes —todos facturan a semana vencida—, así que la factura suelta no explica el
  movimiento: hay que mirarlo por viaje y por tonelada, como en Métrica de Fletes.
  El resto de los fletes (Congelado, Supermercado) sí se abre.

### El cruce contra los presupuestos de sector

La ventana de Gestión trae una tabla que compara, grupo por grupo, lo que muestra
el Presupuesto de cada sector contra lo que Gestión imputa a su centro de costo.
No se carga a mano: `cruzar()` lee la constante del tablero de cada sector ya
escrito, así que compara exactamente lo que la persona ve en pantalla. Si aparece
una diferencia que no tiene causa declarada en `CAUSAS`, la corrida avisa y la
ventana la marca **sin explicar**.

En julio 2026, cinco de los siete sectores dan exactamente lo mismo. Los dos que
no:

- **Fábrica de Hielo, −38,5 M en Servicios Públicos.** *Le falta a Gestión.* El
  archivo nuevo no trae servicios públicos: la presentación anterior tenía la
  electricidad y el gas de toda la planta (518,5 M y 28,0 M) y la nueva los dejó
  afuera. Hay que pedir de dónde salen ahora.
- **Logística, −8,6 M en MO Propia.** *Error del sector.* La ventana de Logística
  toma la mano de obra propia de la línea `GASTOS DE PERSONAL PROPIO` del ERP,
  que en Logística ya incluye a los consultores, y además muestra esos mismos
  consultores como MO eventual: los cuenta dos veces. Su total de julio debería
  ser 1.045,2 M y no 1.053,8 M. Gestión los separa con el archivo de costos.

Una tercera diferencia apareció y ya está corregida: **el rubro `REP` (REPARADO)
existe en las dos hojas del archivo**. Las reparaciones de camiones que Taller
factura afuera están en `SERVICIOS` y son servicios; los repuestos que salen del
almacén están en `MATERIALES` y son material. Mapear el rubro sin mirar de qué
hoja viene pasaba 41,2 M de Taller y 1,6 M de Sistemas de un grupo al otro —el
total del sector daba bien, pero la apertura no. Por eso `grupoDe()` recibe de
qué hoja viene la fila.

## Qué falta

La ventana **Presupuesto de Gestión** muestra el gasto real de julio abierto por
grupo de costo y por centro de costo, pero le faltan tres cosas, y las tres por
la misma razón: no están en el archivo.

1. **La mano de obra.** Es lo más urgente: sin ella el total no es el gasto de la
   planta. Está en `COSTOS Mano de Obra <mes> <año>.xlsx`, que tiene una hoja por
   mes (`JULIO-26`) con el costo por CECO abierto en líneas, horas al 50 y al
   100, changas y terceros. Hay que decidir qué columna es el equivalente de
   `MO PROPIA` y cuál de `MO EVENTUAL` antes de sumarlo.
2. **El presupuestado**, que hay que traer de otra fuente: sin él no hay desvío
   ni ejecución como en los presupuestos de sector.
3. **La serie mes a mes**, que llega cuando estén las carpetas de los meses
   anteriores en SharePoint.

Dentro de `insumos`, la `merma-cajas`: el KPI mensual está en la hoja `KPIs`,
pero el detalle por tipo de caja sale de cruzar `Consumos Deposito` con
producción y todavía no está mapeado. **Métrica de Fletes** y **Cierre Enero–Febrero** todavía no tienen
extractor: los tableros están armados pero sus datos se cargaron a mano, así que
pedir "actualizá logística" no los toca. El script avisa cuándo un grupo no tiene
extractor en lugar de fallar de cualquier modo.

Todo lo demás está cubierto: los 34 tableros de `client/src/dashboards` tienen
su fuente declarada en `fuentes.json` y su extractor, y los ocho grupos corren
de punta a punta. Se puede comprobar con `--dry`, que muestra qué quedaría
escrito sin tocar nada.
