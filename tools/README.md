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
`presupuesto`. Sin argumentos lista todo lo que sabe hacer.

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
- **Algunas hojas traen bloques viejos arriba del bueno.** En la hoja `KPI` de
  Compras hay tres versiones de la misma tabla; la que vale es la que tiene las
  columnas `Total REQ Tratadas` y `Observaciones`.

## Agregar una fuente nueva

1. Sumar la entrada en `fuentes.json` con archivo, hoja, columnas y la cuenta.
2. Escribir el extractor en `tools/extractores/<grupo>.js`, exportando
   `async function actualizar({ leer, escribir, log, dry })`.
3. Dejar la validación contra lo ya cargado: es lo que avisa cuando la planilla
   cambia de forma.
