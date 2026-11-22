# App para celulares: compilar, firmar y publicar en Google Play

Guía de la app de Android de Roamle (`com.playroamle.app`). El diseño está en
[`docs/specs/mobile-app.md`](../docs/specs/mobile-app.md). La app es el mismo client de React
dentro de Capacitor: **usa la misma API que la web** (`https://playroamle.com/api`), así que el
servidor se sigue desplegando como siempre ([`DEPLOY.md`](DEPLOY.md)).

> **Nunca se suben a git:** `.env.mobile`, `client/android/app/google-services.json`,
> `client/android/keystore.properties` ni la clave `.jks`. Tampoco se pegan en chats ni en issues.

## Resumen

| Qué | Dónde | Cuándo |
|---|---|---|
| Servidor listo para la app (CORS, Firebase, Turnstile) | `.env` de la VM y Cloudflare | Una vez |
| `.env.mobile` y `google-services.json` | Tu PC | Una vez |
| Clave de subida y `keystore.properties` | Tu PC (y una copia de seguridad) | Una vez |
| Cuenta de Google Play y ficha de la app | Play Console | Una vez |
| Compilar, firmar y subir una versión | Tu PC → Play Console | Cada versión |
| Huella de Play en `assetlinks.json` | Repo → servidor | Una vez (después de la primera subida) |

## 1. Servidor listo para la app (una vez)

En el `.env` de la VM:

```bash
# La app llama a la API desde estos orígenes (D12). Sumarlos a los que ya están:
CORS_ORIGIN="https://playroamle.com,https://app.playroamle.com,capacitor://app.playroamle.com"

# Notificaciones push: JSON de la cuenta de servicio de Firebase, en base64 (ver abajo).
FIREBASE_SERVICE_ACCOUNT=

# Opcional: versión mínima de la app. Si la instalada es más vieja, la app pide actualizarla.
MIN_APP_VERSION=0.0.0
```

- **Firebase:** consola de Firebase → proyecto Roamle → *Configuración del proyecto → Cuentas de
  servicio → Generar nueva clave privada*. Convertir el JSON a base64 en PowerShell (queda en el
  portapapeles, sin mostrarse en pantalla) y pegarlo después del `=`:

  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\a\la-clave.json")) | Set-Clipboard
  ```

- **Turnstile** (si está activo): Cloudflare → Turnstile → el widget de Roamle → *Hostnames* →
  agregar `app.playroamle.com`. Sin esto, el registro desde la app falla en el captcha.
- Aplicar: `docker compose up -d --build` (ver [`DEPLOY.md`](DEPLOY.md#actualizar-a-una-versión-nueva)).

Para comprobarlo: `https://playroamle.com/.well-known/assetlinks.json` tiene que devolver un JSON
(no la página de la app) y `https://playroamle.com/api/app/config` la versión mínima.

## 2. Tu PC (una vez)

- **Android Studio** (trae el JDK y el SDK de Android). Node.js 20 o más nuevo.
- En la raíz del repo, copiar `.env.mobile.example` como **`.env.mobile`** y completar
  (`VITE_API_URL=https://playroamle.com/api`, la clave de Turnstile, la de Google Maps y el correo
  de contacto). **Sin este archivo la app sale en modo demo** (sin servidor).
- **`google-services.json`:** consola de Firebase → app Android `com.playroamle.app` → descargar y
  copiar en `client/android/app/`. Sin él la app compila, pero sin notificaciones.

## 3. Clave de subida (una vez)

Google Play usa **Play App Signing**: Google guarda la clave con la que se firma la app que llega a
los celulares, y tú firmas cada versión con una **clave de subida** propia.

1. Crear la clave (guardarla **fuera del repo**; pide una contraseña y unos datos):

   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "$HOME\claves\roamle-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Copiar `client/android/keystore.properties.example` como **`client/android/keystore.properties`**
   y completar la ruta del `.jks` y las contraseñas.
3. **Copia de seguridad** del `.jks` y las contraseñas (gestor de contraseñas, otro disco). Si se
   pierden, hay que pedirle a Google que cambie la clave de subida (se puede, pero tarda días).

## 4. Compilar una versión

1. Subir la versión en `client/android/app/build.gradle`:
   - `versionCode`: +1 en **cada** subida (Google Play no acepta un número repetido).
   - `versionName`: la versión que ve la gente (`1.0.0`, `1.0.1`…). Es la que compara
     `MIN_APP_VERSION`.
2. Compilar la interfaz y copiarla al proyecto Android (usa `.env.mobile`):

   ```powershell
   npm run mobile:sync -w client
   ```

   > No definir `CAP_DEV_API` al compilar una versión para la tienda: es solo para probar contra
   > un servidor local por http.

3. Generar el paquete firmado (`.aab`):

   ```powershell
   cd client\android
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   .\gradlew.bat bundleRelease
   ```

   Queda en `client/android/app/build/outputs/bundle/release/app-release.aab`.
   También se puede desde Android Studio: *Build → Generate Signed App Bundle or APK → Android App
   Bundle*, con la misma clave.

Si Gradle falla con *"Unable to establish loopback connection"*, agregar antes
`$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$HOME\.gradle\uds"` (y crear esa carpeta).

Probar el `.aab` antes de subirlo: lo más simple es subirlo a la **prueba interna** de Play Console
(llega en minutos a los celulares de la lista) o instalar una versión de depuración con
`.\gradlew.bat installDebug` con el celular conectado por USB.

## 5. Google Play Console (una vez)

1. **Cuenta de desarrollador** en <https://play.google.com/console> (pago único de USD 25).
   Las cuentas **personales** nuevas tienen que hacer una **prueba cerrada con al menos 12
   testers durante 14 días seguidos** antes de poder publicar en producción (riesgo R3).
2. **Crear app:** nombre *Roamle*, idioma predeterminado *Español (Latinoamérica)*, app, gratis.
3. **Contenido de la app** (Panel → *Configurar la app*):

   | Sección | Respuesta |
   |---|---|
   | Política de privacidad | `https://playroamle.com/privacy` |
   | Acceso a la app | Requiere iniciar sesión: crear una cuenta de prueba para la revisión de Google (usuario y contraseña) y cargarla aquí. |
   | Anuncios | No contiene anuncios. |
   | Clasificación de contenido | Cuestionario: juego de preguntas, sin violencia ni contenido sensible. Los jugadores se comunican solo con invitaciones (no hay chat). |
   | Público objetivo | Decisión tuya: si incluye menores de 13 años, la app entra en el programa *Familias* (más requisitos). Lo más simple es **13 años o más**. |
   | Seguridad de los datos | Ver la tabla de abajo. |
   | Eliminación de la cuenta | En la app: *Mi perfil → Eliminar mi cuenta*. URL para pedirla sin la app: `https://playroamle.com/privacy` (sección "Cómo eliminar tu cuenta"; desde la web también se puede eliminar en *Mi perfil*). |
   | Apps gubernamentales, financieras, de salud, noticias | No. |

   **Seguridad de los datos** (debe coincidir con la política de privacidad):

   | Dato | ¿Se recolecta? | Para qué | ¿Obligatorio? |
   |---|---|---|---|
   | Información personal → **Correo electrónico** | Sí | Funcionalidad de la app, administración de la cuenta, comunicaciones (confirmar correo, recuperar contraseña, invitaciones) | Sí al registrarse |
   | Información personal → **IDs de usuario** (nombre de usuario) | Sí | Funcionalidad de la app, administración de la cuenta | Sí |
   | Fotos → **Fotos** (foto del pasaporte) | Sí | Funcionalidad de la app (personalización) | No |
   | Actividad en la app → **Otro contenido generado por el usuario** (partidas y puntajes) | Sí | Funcionalidad de la app | Sí |
   | Dispositivo u otros IDs (token de notificaciones) | Sí | Funcionalidad de la app (notificaciones) | No |

   - ¿Se comparten datos con terceros? **No** (Brevo, Cloudflare y Firebase son proveedores que
     procesan datos en nombre de Roamle; Google no lo cuenta como "compartir").
   - ¿Datos cifrados en tránsito? **Sí** (https).
   - ¿Se puede pedir que se borren? **Sí** (en la app y en la web).

4. **Ficha de Play Store** (*Crecer → Presencia en Play Store → Ficha principal*):
   - **Ícono:** `client/assets/store/play-icon-512.png`.
   - **Gráfico de funciones:** `client/assets/store/play-feature-graphic.png` (1024×500).
     Se regeneran con `npm run mobile:assets -w client`.
   - **Capturas de teléfono:** al menos 2 (mejor 4–6): panel, una carta, el tablero digital y una
     sala online. Con el celular conectado se pueden sacar con
     `adb exec-out screencap -p > captura.png`.
   - **Descripción breve** (máx. 80 caracteres), por ejemplo:
     > El compañero de Roamle: cartas, millas y partidas online con tus amigos.
   - **Descripción completa** (máx. 4000), por ejemplo:
     > Roamle es un juego de preguntas para dar la vuelta al mundo. Esta app acompaña al juego de
     > mesa: muestra las cartas (lugares, banderas, capitales, historia y personalidades), lleva
     > las millas de cada viajero y anuncia quién gana.
     >
     > • Juega con el tablero impreso o con el tablero digital en pantalla.
     > • Partidas online: invita a tus amigos y cada uno juega desde su celular.
     > • Te avisamos cuando te invitan a una partida o cuando es tu turno.
     > • Tu pasaporte de viajero con tu foto, tus partidas y tus estadísticas.
     > • Estilo Cómic o Modo 80s.

5. **Prueba cerrada** (*Probar y publicar → Pruebas → Prueba cerrada*):
   1. Crear el track y una lista de testers (correos de cuentas de Google o un Grupo de Google).
   2. *Crear versión* → subir el `.aab` → notas de la versión → revisar y lanzar. La primera
      revisión de Google puede tardar unos días.
   3. Compartir el **enlace de participación** con los testers: cada uno lo abre con su cuenta de
      Google, acepta y después instala Roamle desde Play Store.
   4. Mantener **12 testers o más con la app instalada durante 14 días seguidos**. Después,
      *Solicitar acceso a producción* (el formulario pregunta cómo fue la prueba).

## 6. Enlaces a la app (`assetlinks.json`, una vez)

Para que Android abra los enlaces de `playroamle.com` directo en la app (D11), el sitio tiene que
publicar la huella de la clave con la que Google firma la app:

1. Play Console → *Probar y publicar → Configuración → Integridad de la app → Firma de apps* →
   copiar **"Huella digital del certificado SHA-256"** de la **clave de firma de apps** (no de la
   de subida). Es un dato público, no un secreto.
2. Agregarla en `client/public/.well-known/assetlinks.json`, dentro de `sha256_cert_fingerprints`
   (junto a la que ya está, que es la de la clave de depuración, para probar con
   `installDebug`).
3. Desplegar la web. Comprobar en Play Console → *Crecer → Vínculos directos* (o reinstalar la app)
   que el dominio figure como verificado.

## 7. Versiones nuevas

- **Solo cambios en el servidor:** desplegar como siempre. La API tiene que seguir funcionando con
  las versiones de la app que ya están instaladas (MA-01).
- **Cambios en la interfaz:** la web se actualiza al desplegar, pero la app necesita una versión
  nueva en la tienda: pasos 4 y 5.2 (subir `versionCode`).
- **Forzar la actualización** (por ejemplo, si cambió la API de forma incompatible): subir la
  versión nueva, esperar a que esté publicada y después poner `MIN_APP_VERSION` con su
  `versionName` en el `.env` de la VM. Las apps más viejas muestran "Actualiza Roamle".

## 8. Probar en un celular contra un servidor local

Para desarrollar (no para publicar): la app habla con la API de tu PC por USB.

```powershell
# Servidor local en el puerto 4010 (con PUSH_LOG=true los push se imprimen en la consola)
$env:VITE_API_URL = "http://localhost:4010/api"; $env:CAP_DEV_API = "1"; npm run mobile:sync -w client
adb reverse tcp:4010 tcp:4010
cd client\android; .\gradlew.bat installDebug
```

El servidor local tiene que tener `https://app.playroamle.com` en `CORS_ORIGIN`. Al terminar,
volver a compilar sin esas variables para no dejar instalada una versión que apunta a tu PC.
