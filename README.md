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
2. La app llama a `POST /api/generate` y genera un QR con un enlace de la app que incluye `scanId`.
3. En la vista MOVIL se escanea el QR, se abre el enlace, o se pega el ID/enlace manualmente en navegador.
4. La API devuelve el PIN de 6 digitos.
5. En la vista WEB se escribe el PIN y se verifica la solicitud.
6. La solicitud pasa a estado `aprobado`.

## Cambios recientes (28 de junio de 2026)

- El QR ahora codifica un enlace de la app con `scanId`, por ejemplo `/home?scanId=...`, para que el celular abra la vista movil correcta.
- En desarrollo por red local, el frontend detecta el host actual y llama a la API en ese mismo host con puerto `3000`. Si abres `http://192.168.1.70:4200`, la app llama a `http://192.168.1.70:3000`.
- Al escanear el QR, la API marca `scannedAt` y el portal WEB autollena las 6 cajas del PIN. Ya no se usa el input manual visible para escribir el PIN.
- El boton `VERIFICAR CODIGO` se habilita cuando las 6 cajas tienen codigo.
- El boton de revocar queda activo para registros `pendiente` y `aprobado`; se deshabilita cuando el registro ya esta `cancelado`.
- Se agrego el boton `Limpiar`, que borra todos los registros del historial en MongoDB con `DELETE /api/requests`.
- El campo `Servicio` inicia vacio, muestra un ejemplo como placeholder y si se deja vacio se guarda como `Servicio Normal`.
- Se ajustaron colores, labels y cajas del PIN para mejorar visibilidad, y se corrigieron textos visibles con acentos mal codificados.

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
| `POST` | `/api/generate` | Crea solicitud, PIN unico y cancela pendientes previas del mismo correo |
| `GET` | `/api/requests` | Lista las ultimas 20 solicitudes; expone `pin` solo si fue escaneada y sigue pendiente |
| `DELETE` | `/api/requests` | Elimina todos los registros del historial |
| `GET` | `/api/scan/:id` | Valida el ID, marca `scannedAt` y devuelve el PIN si la solicitud sigue pendiente |
| `POST` | `/api/verify` | Verifica el PIN y aprueba la solicitud |
| `DELETE` | `/api/revoke/:id` | Revoca una solicitud pendiente o aprobada y la marca como `cancelado` |
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

Tambien puedes guardar la variable en `api/.env`:

```env
MONGODB_URI=mongodb+srv://cluster.mongodb.net/database?retryWrites=true&w=majority
```

Con ese archivo creado, para levantar la API despues basta con:

```powershell
cd api
node index.js
```

Importante: si usas `mongodb+srv://`, no agregues `:27017` en la URI. Ese tipo de URI SRV no debe llevar puerto.


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

En desktop inicia en vista WEB. Puedes cambiar a MOVIL con el boton de la barra superior. En navegador, la vista MOVIL usa entrada manual del ID o enlace porque no hay camara nativa de Capacitor.

## Ejecutar en red local con celular

Para que el QR funcione desde un telefono fisico, no generes el QR desde `localhost`, porque `localhost` en el celular apunta al propio celular y no a tu computadora.

1. Obten la IPv4 de tu computadora con `ipconfig`. En tus pruebas fue `192.168.1.70`.
2. Levanta la API:

```powershell
cd api
node index.js
```

3. Levanta Angular escuchando en la red:

```powershell
npm.cmd start -- --host 0.0.0.0 --port 4200
```

4. Abre el portal desde la IP de tu PC:

```text
http://192.168.1.70:4200
```

5. Genera el QR desde esa URL. El celular debe abrir algo como:

```text
http://192.168.1.70:4200/home?scanId=...
```

Si tu IP cambia, reemplaza `192.168.1.70` por la nueva IPv4.

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
7. En navegador aparecera entrada manual: pega el `id` o el enlace completo del QR.
8. La vista MOVIL debe mostrar un PIN de 6 digitos.
9. Vuelve a WEB; las 6 cajas del PIN deben llenarse solas por polling. Si tarda, espera unos segundos.
10. Pulsa `VERIFICAR CODIGO`.
11. La solicitud debe cambiar a `Aprobado`.

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

## Operaciones del historial

- `Revocar`: marca un registro como `cancelado`. El boton aparece activo para `pendiente` y `aprobado`; queda inactivo si ya esta `cancelado`.
- `Limpiar`: borra todos los registros de la coleccion `requests` en MongoDB. La accion pide confirmacion antes de ejecutar `DELETE /api/requests`.

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

## Cuando reiniciar

- Si modificas solo frontend (`src/app/...`), normalmente Angular recarga solo. Si ves estilos/textos viejos, usa `Ctrl + F5` o reinicia `npm.cmd start`.
- Si modificas backend (`api/index.js`) o cambias `MONGODB_URI`, reinicia la API con `node index.js`.
- Si modificas solo `README.md`, no necesitas reiniciar nada.

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
  "expiresAt": "2026-06-26T00:10:00.000Z",
  "scannedAt": "2026-06-26T00:01:00.000Z",
  "approvedAt": "2026-06-26T00:02:00.000Z",
  "updatedAt": "2026-06-26T00:03:00.000Z"
}
```

Indice TTL recomendado:

```js
db.requests.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

## Problemas comunes

- `MONGODB_URI no esta definida`: falta configurar la variable antes de iniciar la API o crear `api/.env`.
- Error de `app.module.ts` o `home.module.ts` en VS Code: son diagnosticos antiguos del editor; esos archivos ya no existen. Reinicia `Angular Language Server`, `TypeScript Server` y recarga la ventana.
- El boton de escaneo en navegador pide ID/enlace manual: es normal; la camara nativa se prueba en Android/iOS con Capacitor. Si usas la camara externa del telefono, genera el QR desde la URL de red local, por ejemplo `http://192.168.1.70:4200`, no desde `localhost`.
- La API responde `/api/status`, pero generar QR falla: revisa conexion y permisos de MongoDB Atlas.
- `mongodb+srv URI cannot have port number`: quita `:27017` de la URI de MongoDB Atlas.
- El QR abre `localhost:4200` en el celular: vuelve a abrir el frontend por IP LAN y genera un QR nuevo.
- Ves textos con caracteres raros: guarda el archivo como UTF-8, recarga con `Ctrl + F5` o reinicia el servidor Angular.

