# Tablero KPI — Offal

Módulo del ecosistema Offal que muestra los **indicadores de gestión por sector**
en un tablero propio (identidad navy + índigo, misma barra unificada que el resto
de las apps). Los datos salen del **`KPI.xlsx` alojado en SharePoint**, leído vía
**Microsoft Graph**; el tablero cachea y refresca automáticamente a medida que se
carga información en el Excel.

Login único con **Entra ID (Easy Auth)** y autorización contra el **padrón central
`acceso`** (app `kpi`), igual que proveedores / etiquetas / lavados.

## Arquitectura

```
kpi-offal/
  index.js              Express: /health, /api/me, /api/kpis, sirve el cliente
  config/
    db.js               Conexión a la base compartida (padrón acceso)
    kpiConfig.js        Mapeo Excel → sectores/KPIs (convención, editable)
  middlewares/auth.js   Identidad Easy Auth + permiso 'kpi' del padrón
  services/
    kpiSource.js        Token Graph + lectura del Excel (REST) + cache + fallback
    mockData.js         Datos de ejemplo (se usan si falta Graph)
  client/               React + Vite (tablero, gráficos con Recharts)
  .github/workflows/    Deploy al App Service "kpi-offal"
```

**Fuente de datos:** si están configuradas las credenciales de Graph + la URL del
archivo, lee el Excel real. Si falta cualquiera, usa **datos mock** (para desarrollo)
y lo indica en la UI (`● Datos de ejemplo`).

## Correr en local

```bash
npm install
npm run client:build     # compila el frontend
npm start                # http://localhost:3006
```

Desarrollo con recarga del frontend (dos terminales):

```bash
npm start                # backend en :3006
npm run client           # Vite en :5176 (proxya /api al backend)
```

Sin variables de entorno, arranca en **modo mock** — se ve el tablero completo con
datos de ejemplo. Copiá `.env.example` a `.env` para conectar la base y/o Graph.

## Conectar el Excel real (Microsoft Graph)

Lo habilita quien administra el M365 del tenant:

1. **App registration** en Entra con permiso de **aplicación** `Sites.Selected`
   (recomendado, acotado a ese sitio) o `Files.Read.All`, con **consentimiento de
   admin**. Si se usa `Sites.Selected`, dar acceso de lectura de la app a ese sitio.
2. Crear un **client secret**.
3. Completar en `.env` (o en el App Service): `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`,
   `GRAPH_CLIENT_SECRET` y `KPI_FILE_SHARE_URL` (la URL de compartir del `KPI.xlsx`).

El servicio resuelve el archivo por su URL de compartir (`/shares`), lista las hojas
y lee el rango usado de cada una. El **mapeo hoja → KPIs** asume una convención
descrita en `config/kpiConfig.js`; **cuando tengamos la estructura real del Excel se
ajusta ahí** (idealmente sin tocar código).

## Deploy (Azure)

Mismo patrón que el resto del ecosistema:

1. Crear **App Service `kpi-offal`** (Node 20, Linux). Prender **Basic authentication**.
2. Cargar el secret `AZUREAPPSERVICE_PUBLISHPROFILE_KPIOFFAL` (publish profile) en GitHub.
3. Habilitar **Easy Auth** contra el mismo registro de Entra (SSO con las otras apps).
4. Cargar la app **`kpi`** en el padrón (`acceso.Permisos`) y poner
   `KPI_REQUIRE_PERMISSION=true` para exigir permiso.
5. Sumar la tarjeta del módulo al **portal** (`portal-offal/config/apps.js`).

Push a `main` dispara el workflow y deploya.

## Pendientes de infraestructura (los resuelve el inge/admin)

- [ ] App registration + permiso Graph + consentimiento + client secret.
- [ ] Crear el App Service `kpi-offal` + Basic auth + publish profile.
- [ ] Easy Auth (SSO Entra).
- [ ] Alta de la app `kpi` en `acceso.Permisos` + permisos por usuario.
- [ ] Confirmar la estructura real del `KPI.xlsx` para el mapeo.
