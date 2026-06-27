# Authenticator QR

Aplicacion Ionic + Angular standalone con una API Express y MongoDB Atlas para recuperar cuentas mediante un codigo QR y un PIN de 6 digitos.

## Arquitectura

```text
Portal web             App movil / vista movil          API Express + MongoDB
(genera QR)     ->     (escanea QR y obtiene PIN)  ->   (guarda solicitudes)
(verifica PIN)  <-     (muestra PIN)
```

## Flujo principal

1. En la vista WEB se ingresa correo y servicio.
2. La app llama a `POST /api/generate` y genera un QR con el ID de solicitud.
3. En la vista MOVIL se escanea el QR o se pega el ID manualmente en navegador.
4. La API devuelve el PIN de 6 digitos.
5. En la vista WEB se escribe el PIN y se verifica la solicitud.
6. La solicitud pasa a estado `aprobado`.

## Stack actual

- Angular 20 con componentes standalone.
- Ionic Angular 8.
- Capacitor 8.
- Escaner QR: `@capacitor-mlkit/barcode-scanning`.
- Backend: Express 4.
- Base de datos: MongoDB Atlas.

> Nota: este proyecto ya no usa `app.module.ts`, `home.module.ts` ni `app-routing.module.ts`. El arranque esta en `src/main.ts` con `bootstrapApplication` y las rutas estan en `src/app/app.routes.ts`.

## Endpoints de la API

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/status` | Health check de la API |
| `POST` | `/api/generate` | Crea solicitud y PIN unico |
| `GET` | `/api/requests` | Lista las ultimas 20 solicitudes |
| `GET` | `/api/scan/:id` | Devuelve el PIN al escanear/pegar el ID |
| `POST` | `/api/verify` | Verifica el PIN y aprueba la solicitud |
| `DELETE` | `/api/revoke/:id` | Cancela una solicitud pendiente |
| `GET` | `/api/status/:id` | Consulta el estado de una solicitud |

## Requisitos

- Node.js compatible con Angular 20.
- npm.
- MongoDB Atlas o una instancia MongoDB accesible.
- Para movil: Android Studio o Xcode, segun plataforma.

## Instalacion

Desde la raiz del proyecto:

```bash
npm install
```

La API tiene su propio `package.json`. Si no estan instaladas sus dependencias:

```bash
cd api
npm install
cd ..
```

## Configurar API local

La API necesita `MONGODB_URI`. En PowerShell:

```powershell
cd api
$env:MONGODB_URI="mongodb+srv://cluster.mongodb.net/database?retryWrites=true&w=majority"
node index.js
```

Si inicia bien, veras:

```text
API escuchando en http://localhost:3000
```

Comprueba el health check:

```powershell
Invoke-RestMethod http://localhost:3000/api/status
```

Debe responder:

```json
{ "ok": true }
```

## Configurar frontend

En desarrollo, `src/environments/environment.ts` debe apuntar a la API local:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
};
```

Para produccion, reemplaza `src/environments/environment.prod.ts` con tu URL real de Vercel:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://TU-PROYECTO.vercel.app',
};
```

## Ejecutar en navegador

En otra terminal, desde la raiz del proyecto:

```bash
npm.cmd start
```

Abre:

```text
http://localhost:4200
```

En desktop inicia en vista WEB. Puedes cambiar a MOVIL con el boton de la barra superior. En navegador, la vista MOVIL usa entrada manual del ID porque no hay camara nativa de Capacitor.

## Comprobar que funciona

### 1. Build

```bash
npm.cmd run build
```

Debe terminar con `Application bundle generation complete` y generar salida en `www`.

### 2. API

Con la API local encendida:

```powershell
Invoke-RestMethod http://localhost:3000/api/status
```

Debe devolver `{ ok: true }`.

### 3. Flujo completo en navegador

1. Abre `http://localhost:4200`.
2. En WEB, escribe un correo y pulsa `GENERAR QR`.
3. Obtiene el ID mas reciente:

```powershell
Invoke-RestMethod http://localhost:3000/api/requests
```

4. Copia el `id` de la primera solicitud.
5. Cambia a MOVIL.
6. Pulsa `Escanear codigo QR`.
7. En navegador aparecera entrada manual: pega el `id`.
8. La vista MOVIL debe mostrar un PIN de 6 digitos.
9. Vuelve a WEB, escribe ese PIN y pulsa `VERIFICAR CODIGO`.
10. La solicitud debe cambiar a `Aprobado`.

### 4. Prueba directa de API opcional

Generar solicitud:

```powershell
$req = Invoke-RestMethod http://localhost:3000/api/generate -Method Post -ContentType 'application/json' -Body '{"email":"demo@empresa.com","service":"Servicio Normal"}'
$req
```

Obtener PIN como si fuera escaneo:

```powershell
$scan = Invoke-RestMethod "http://localhost:3000/api/scan/$($req.id)"
$scan.pin
```

Verificar PIN:

```powershell
Invoke-RestMethod http://localhost:3000/api/verify -Method Post -ContentType 'application/json' -Body "{`"id`":`"$($req.id)`",`"pin`":`"$($scan.pin)`"}"
```

Debe devolver `success: true` y `status: aprobado`.

## Deploy de API en Vercel

Desde la raiz del proyecto:

```bash
vercel
```

En el dashboard de Vercel agrega la variable de entorno:

```text
MONGODB_URI=mongodb+srv://cluster.mongodb.net/database?retryWrites=true&w=majority
```

Despues actualiza `src/environments/environment.prod.ts` con la URL de Vercel.

## Android

Genera el build web y sincroniza Capacitor:

```bash
npm.cmd run build
npx cap add android
npx cap sync android
npx cap open android
```

Agrega permiso de camara en `android/app/src/main/AndroidManifest.xml` antes de la etiqueta `application`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Para `@capacitor-mlkit/barcode-scanning`, agrega tambien dentro de `application`:

```xml
<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />
```

Luego ejecuta desde Android Studio.

## iOS

```bash
npm.cmd run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

En `ios/App/App/Info.plist` agrega:

```xml
<key>NSCameraUsageDescription</key>
<string>Se necesita la camara para escanear codigos QR</string>
```

El plugin ML Kit requiere iOS deployment target 15.5 o superior.

## MongoDB

Base de datos: `authenticator`

Coleccion: `requests`

Documento ejemplo:

```json
{
  "service": "Servicio Normal",
  "email": "usuario@empresa.com",
  "pin": "847293",
  "status": "pendiente",
  "createdAt": "2026-06-26T00:00:00.000Z",
  "expiresAt": "2026-06-26T00:10:00.000Z"
}
```

Indice TTL recomendado:

```js
db.requests.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

## Problemas comunes

- `MONGODB_URI no esta definida`: falta configurar la variable antes de iniciar la API.
- Error de `app.module.ts` o `home.module.ts` en VS Code: son diagnosticos antiguos del editor; esos archivos ya no existen. Reinicia `Angular Language Server`, `TypeScript Server` y recarga la ventana.
- El boton de escaneo en navegador pide ID manual: es normal; la camara nativa se prueba en Android/iOS con Capacitor.
- La API responde `/api/status`, pero generar QR falla: revisa conexion y permisos de MongoDB Atlas.

