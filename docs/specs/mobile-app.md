# Spec: App para celulares (Capacitor) y notificaciones push

| | |
| --- | --- |
| Estado | **En desarrollo** — E1 hecha en la rama `Feature.MobileApp` (ver 12) |
| Fecha | 2026-11-19 |
| Afecta | `client`, `server`, `shared`, `deploy` |
| Relacionado | [online-multiplayer.md](online-multiplayer.md) · [email-invitations.md](email-invitations.md) · [user-photo-and-email.md](user-photo-and-email.md) |

---

## 1. Objetivo

1. Publicar Roamle como **app para Android y iPhone** en Google Play y App Store, **reusando el mismo `client` de React** (sin reescribirlo) con [Capacitor](https://capacitorjs.com).
2. Avisar con **notificaciones push** en el celular cuando pasa algo que requiere al jugador, sobre todo **una invitación a una partida online**, aunque la app esté cerrada.
3. Que los enlaces de los correos (invitaciones, confirmación, contraseña) **abran la app** si está instalada.
4. La web en playroamle.com sigue funcionando igual: **un solo código** para web, Android e iOS.

## 2. Alcance

### Incluido

- Proyectos nativos `client/android` y `client/ios` generados con Capacitor, con nombre, ícono y pantalla de inicio de Roamle.
- Notificaciones push con **Firebase Cloud Messaging** (Android directo; iPhone a través de APNs).
- Preferencias de notificaciones por tipo en el **Perfil**.
- Deep links (App Links en Android, Universal Links en iOS) para las rutas de los correos y de las salas.
- Ajustes de "app nativa": zonas seguras (notch), botón Atrás de Android, barra de estado, vibración al resolver una carta, pantalla siempre encendida durante la partida.
- Requisitos de las tiendas: **política de privacidad** pública y **eliminar mi cuenta** desde la app.
- Guía de compilación y publicación en `deploy/MOBILE.md`.

### Fuera de alcance

- Reescribir la interfaz con componentes nativos (React Native, Flutter).
- Web Push en el navegador o PWA con notificaciones (se puede sumar después; ver P8).
- Actualizaciones "en vivo" sin pasar por la tienda (Capgo, Appflow).
- Notificaciones de marketing o masivas desde el admin.
- Iniciar sesión con Google o Apple.
- Modo sin conexión de las partidas online.

## 3. Decisiones (propuestas)

| # | Decisión |
| --- | --- |
| D1 | **Capacitor** envuelve el `client` compilado por Vite. Los archivos de la interfaz van **dentro de la app** (no se carga playroamle.com remoto): la app abre rápido y Apple no la ve como "una web envuelta". |
| D2 | La app usa **siempre el backend real** (`VITE_API_URL=https://playroamle.com/api`): no hay modo demo en la app. |
| D3 | Identificador de la app: `com.playroamle.app`; nombre visible **Roamle**. |
| D4 | Se publica **primero Android** y después iOS (iOS necesita la cuenta de Apple y compilar en una Mac). El código queda listo para ambos desde el principio. |
| D5 | Push con **Firebase Cloud Messaging (HTTP v1)** desde el servidor con `firebase-admin`. Es gratis. Las credenciales (cuenta de servicio de Firebase, clave APNs) las carga el dueño en el `.env` de la VM y en la consola de Firebase; **nunca pasan por el repositorio ni por el chat**. |
| D6 | Tipos de notificación (ver 5.2). Cada uno se puede apagar desde el Perfil; **todos vienen encendidos**. |
| D7 | **No se manda push si el jugador ya está mirando la app** (tiene una conexión de Socket.IO abierta): ahí ya ve el aviso dentro de la app. Así no hay avisos duplicados. |
| D8 | El permiso del sistema ("¿Permitir notificaciones?") **no se pide al abrir la app**, sino en un momento con sentido: al entrar por primera vez a una sala online o al tocar "Invitar a un amigo", con una pantalla previa que explica para qué sirve. Si dice que no, se puede activar después desde el Perfil. |
| D9 | Un usuario puede tener **varios dispositivos** (máximo 10). El token se borra al **cerrar sesión** y cuando Firebase avisa que ya no sirve (app desinstalada). Si un token llega desde otra cuenta (otro usuario inició sesión en ese celular), pasa a la cuenta nueva. |
| D10 | Tocar una notificación **abre la app en la pantalla que corresponde** (la sala de la partida, el panel principal, etc.). |
| D11 | Deep links para `/invite`, `/invite/opt-out`, `/verify-email`, `/reset-password` y `/online/:id`. Los archivos de verificación (`assetlinks.json`, `apple-app-site-association`) se publican en `playroamle.com/.well-known/`. Si la app no está instalada, el enlace abre la web como hoy. |
| D12 | Dentro de la app el origen es `https://app.playroamle.com` (Android) y `capacitor://app.playroamle.com` (iOS), con `server.hostname` de Capacitor. Se agregan al **CORS** (REST y Socket.IO) y a los hostnames de **Turnstile**. |
| D13 | La sesión sigue en `localStorage` del WebView (persiste igual que en el navegador). Pasarla al almacenamiento seguro del sistema queda para después. |
| D14 | Textos de las notificaciones en el servidor, en español latino neutro, junto a las plantillas de correo (`server/src/push/messages.ts`), con el mismo criterio de locale. |
| D15 | Las actualizaciones de la interfaz se publican como **versiones nuevas en las tiendas**. El servidor sigue desplegándose en la VM como siempre; la API se mantiene **compatible hacia atrás** porque puede haber celulares con una versión vieja de la app. |
| D16 | La versión mínima de la app se controla desde el servidor (`MIN_APP_VERSION`): si la app instalada es más vieja, muestra "Actualiza Roamle para seguir jugando" con el botón a la tienda. |
| D17 | Si el navegador o el **WebView de Android** es demasiado viejo para la interfaz (necesita Chrome 111 / Safari 16.4 o posterior), en lugar de una pantalla en blanco se muestra un aviso para actualizarlo (en Android, con el botón a *Android System WebView* en Google Play). |

## 4. Flujos de usuario

### 4.1 Instalar y entrar

1. La persona instala **Roamle** desde Google Play (o App Store).
2. Abre la app: pantalla de inicio con el logo y después el login, igual que en la web.
3. Inicia sesión o se registra. No se pide ningún permiso todavía.

### 4.2 Activar las notificaciones

1. La primera vez que entra a una sala online (o toca "Invitar a un amigo"), aparece una pantalla propia:
   > 🔔 **¿Te avisamos cuando te inviten a jugar?**
   > Te mandamos una notificación cuando alguien te invite a una partida o cuando empiece. Puedes cambiarlo cuando quieras en tu perfil.
   > [Activar notificaciones] [Ahora no]
2. "Activar" muestra el permiso del sistema. Si lo acepta, la app registra el dispositivo en el servidor.
3. "Ahora no" no vuelve a preguntar solo; queda el interruptor en el Perfil.

### 4.3 Recibir una invitación con la app cerrada

1. Pepe invita a Ana a su sala.
2. Ana no tiene la app abierta → le llega:
   > **Roamle** · Pepe te invitó a una partida
   > Tienes 10 minutos para unirte. Toca para ver la sala.
3. Ana toca la notificación → se abre la app en la invitación de la sala, lista para aceptar o rechazar.
4. Si la invitación ya venció o la sala se canceló, la app muestra "Esta invitación ya no está disponible" y la lleva al panel principal.

### 4.4 Preferencias en el Perfil

Sección **"Notificaciones"** (solo en la app):

- Estado del permiso del sistema. Si está bloqueado, botón "Abrir ajustes del teléfono".
- Un interruptor por tipo (5.2).

### 4.5 Enlaces de los correos

1. Ana recibe en el celular el correo "Pepe te invitó a jugar a Roamle".
2. Toca el enlace: si tiene la app, se abre la app en la página de registro con la invitación; si no, se abre la web, como hoy.

### 4.6 Eliminar mi cuenta

1. En el Perfil, al final: **"Eliminar mi cuenta"**.
2. Confirma escribiendo su nombre de usuario y su contraseña.
3. Se borra la cuenta con sus datos personales (foto, correo, dispositivos), igual que cuando el admin elimina un usuario: se borran las partidas que creó, y en las partidas de otros queda su nombre sin vínculo a la cuenta. Si está en una partida online en curso, primero tiene que abandonarla.

## 5. Reglas

### 5.1 Generales

| # | Regla |
| --- | --- |
| MA-01 | La web y la app usan la misma API; ningún cambio de servidor puede romper una versión de la app que todavía sea `>= MIN_APP_VERSION`. |
| MA-02 | Un token de dispositivo pertenece a un solo usuario a la vez. |
| MA-03 | Al cerrar sesión se borra el token de ese dispositivo **antes** de borrar la sesión local. |
| MA-04 | Si Firebase responde que el token no es válido (`registration-token-not-registered`, `invalid-argument`), se borra. |
| MA-05 | El push nunca incluye datos privados de otros (correos, por ejemplo): solo el nombre de usuario de quien invita y el destino. |
| MA-06 | Las notificaciones respetan las preferencias del usuario y D7. Un error al enviar un push **nunca** hace fallar la acción que lo originó (se registra en el log y sigue). |
| MA-07 | Un usuario inactivo (desactivado por el admin) no recibe notificaciones. |

### 5.2 Tipos de notificación

| Tipo | Para | Cuándo | Texto (título · cuerpo) | Abre |
| --- | --- | --- | --- | --- |
| `GAME_INVITE` | Invitado | Le llega una invitación a una partida (también la de D2 de invitaciones por correo) | "{{from}} te invitó a una partida" · "Tienes 10 minutos para unirte. Toca para ver la sala." | La invitación |
| `GAME_STARTED` | Jugadores sentados | El anfitrión empieza la partida | "¡Empezó la partida de {{host}}!" · "Entra para no perder tu turno." | `/online/:id` |
| `YOUR_TURN` | Jugador de turno | Empieza su turno, no tiene la app abierta y el tiempo del dado es de 60 s o más (P3) | "Es tu turno en Roamle" · "Tira el dado antes de que se acabe el tiempo." | `/online/:id` |
| `INVITE_ACCEPTED` | Anfitrión | Alguien acepta su invitación | "{{username}} se unió a tu partida" · — | `/online/:id` |
| `INVITE_REGISTERED` | Quien invitó por correo | Alguien crea su cuenta con su invitación | "{{username}} se registró con tu invitación" · "¡Ya pueden jugar juntos!" | `/` |

## 6. Modelo de datos

### 6.1 Prisma

```prisma
enum DevicePlatform {
  ANDROID
  IOS
}

model DeviceToken {
  id         String         @id @default(cuid())
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String         @unique
  platform   DevicePlatform
  appVersion String
  createdAt  DateTime       @default(now())
  lastSeenAt DateTime       @default(now())

  @@index([userId])
}

model User {
  // ...
  devices    DeviceToken[]
  /** Tipos de push apagados por el usuario (por defecto, todos encendidos). */
  pushMuted  String[]       @default([])
}
```

## 7. Interfaces

### 7.1 REST

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/devices` | Registra o actualiza el token del dispositivo actual (`{ token, platform, appVersion }`). Aplica MA-02 y el máximo de D9 (se borra el más viejo). |
| `DELETE` | `/api/devices/:token` | Lo llama la app al cerrar sesión (MA-03). |
| `PATCH` | `/api/auth/me` | Acepta `pushMuted: PushType[]`. |
| `DELETE` | `/api/auth/me` | Eliminar mi cuenta (4.6). Pide `password`. |
| `GET` | `/api/app/config` | Público: `{ minAppVersion, storeUrls }` (D16). |

### 7.2 Servidor

- `server/src/push/firebase.ts`: inicializa `firebase-admin` con `FIREBASE_SERVICE_ACCOUNT` (JSON en base64). Sin la variable, el push queda **desactivado** y el resto funciona igual (como el correo sin SMTP).
- `server/src/push/service.ts`: `sendPush(userId, type, params, link)` aplica preferencias, D7 (consulta si hay sockets en la sala `user:<id>`), envía a todos los dispositivos y limpia tokens inválidos (MA-04).
- Puntos de envío: `createGameInvite` y el inicio de partida/turno en `server/src/online/routes.ts` y `server/src/realtime/index.ts`; `completeInviteRegistration` en `server/src/invites/service.ts`.

### 7.3 Cliente

- `client/src/native/`: único lugar que importa plugins de Capacitor; en la web exporta funciones vacías (`isNative() === false`).
  - `push.ts`: permisos, registro del token, tocar una notificación → `navigate(link)`.
  - `deepLinks.ts`: `App.addListener('appUrlOpen')` → `navigate(path)`.
  - `backButton.ts`: cierra el modal abierto, vuelve atrás o minimiza la app en el panel principal.
  - `haptics.ts`, `keepAwake.ts`, `statusBar.ts`.
- `components/profile/NotificationSettings.tsx` y `DeleteAccount.tsx`.
- Página pública `/privacy` con la política de privacidad.
- `client/capacitor.config.ts`, `client/android/`, `client/ios/`.
- Script `npm run mobile:sync` (build de Vite con la URL de producción + `npx cap sync`).

### 7.4 Plugins

`@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/browser` (enlaces externos) y `@capacitor-community/keep-awake`.

## 8. Aspectos técnicos

- **CORS y Socket.IO:** `CORS_ORIGIN` suma los orígenes de D12; Socket.IO ya usa la misma lista (`env.corsOrigins`).
- **Turnstile:** agregar `app.playroamle.com` en Cloudflare. En iOS el esquema `capacitor://` puede no ser aceptado por Turnstile: **se verifica en la etapa de iOS** (riesgo R1).
- **Zonas seguras:** `viewport-fit=cover` y `env(safe-area-inset-*)` en el layout, el tablero y los modales.
- **Teclado:** que no tape los campos del login y del buscador de jugadores.
- **Enlaces externos** (reglas, correos de soporte): se abren en el navegador del sistema, no dentro de la app.
- **`.well-known`:** `client/public/.well-known/assetlinks.json` (con la huella SHA-256 de la firma de Google Play) y `apple-app-site-association` (sin extensión, servido como `application/json` en `deploy/nginx/spa.conf`).
- **Firma de Android:** se usa *Play App Signing*. La clave de subida la genera y guarda el dueño; no se sube al repositorio (`.gitignore` para `*.jks`, `*.keystore`, `google-services.json` y `GoogleService-Info.plist`).
- **Tamaño:** las imágenes del tablero (`client/public/board`) van dentro de la app; conviene revisar su peso.

### Riesgos

| # | Riesgo | Mitigación |
| --- | --- | --- |
| R1 | Turnstile no funcione en iOS dentro del WebView. | Probarlo al principio de la etapa iOS; alternativa: verificación con Turnstile en una vista del navegador del sistema. |
| R2 | Apple rechace la app por "funcionalidad mínima" (guía 4.2). | Push, vibración, deep links y pantalla encendida; textos de revisión explicando el uso como companion del juego físico. |
| R3 | Google Play pida 12 testers durante 14 días (cuentas personales nuevas). | Planificar la prueba cerrada con amigos/jugadores antes de la fecha de lanzamiento. |
| R4 | `YOUR_TURN` llegue tarde con tiempos de dado cortos (30 s). | Solo se manda con tiempos de 60 s o más (P3). |

## 9. Criterios de aceptación

| # | Dado | Cuando | Entonces |
| --- | --- | --- | --- |
| CA-01 | La app instalada en Android | se abre | muestra la pantalla de inicio y el login, sin barra de navegador, respetando el notch. |
| CA-02 | Un usuario en la app | entra por primera vez a una sala online | ve la pantalla de 4.2 y, al aceptar, su dispositivo queda registrado. |
| CA-03 | Ana con la app cerrada y notificaciones activas | Pepe la invita a una partida | le llega `GAME_INVITE` y al tocarla se abre la app en la invitación. |
| CA-04 | Ana con la app abierta | Pepe la invita | ve la invitación en la app y **no** le llega push (D7). |
| CA-05 | Ana apagó `GAME_INVITE` en el Perfil | Pepe la invita | no recibe push. |
| CA-06 | Ana cerró sesión en el celular | Pepe la invita | ese celular no recibe push. |
| CA-07 | Ana desinstaló la app | el servidor intenta enviarle | Firebase rechaza el token y el servidor lo borra. |
| CA-08 | Ana tiene la app | toca el enlace de una invitación por correo | se abre la app en `/invite?token=…`. |
| CA-09 | Ana no tiene la app | toca el mismo enlace | se abre la web, como hoy. |
| CA-10 | El servidor sin `FIREBASE_SERVICE_ACCOUNT` | se crea una invitación | la invitación funciona y no hay error. |
| CA-11 | En Android | se aprieta Atrás con un modal abierto | se cierra el modal; en el panel principal, la app se minimiza. |
| CA-12 | Un usuario en la app | elimina su cuenta con su contraseña | se borra la cuenta y vuelve al login. |
| CA-13 | La app instalada es más vieja que `MIN_APP_VERSION` | se abre | muestra "Actualiza Roamle" con el botón a la tienda. |
| CA-14 | La web en el navegador | se usa | todo funciona igual que antes; no aparecen opciones de notificaciones push. |

## 10. Plan de implementación (un commit por etapa)

| Etapa | Contenido |
| --- | --- |
| E1 | Capacitor en el `client`: config, proyecto Android, ícono y splash, `client/src/native/` con zonas seguras, botón Atrás, barra de estado, enlaces externos; CORS y Turnstile para el origen de la app. Prueba en emulador. |
| E2 | Requisitos de tienda: página `/privacy`, "Eliminar mi cuenta", `GET /api/app/config` y aviso de versión mínima. |
| E3 | Push en el servidor: modelo `DeviceToken`, `pushMuted`, rutas `/api/devices`, `server/src/push/`, envío de los tipos de 5.2 y limpieza de tokens. |
| E4 | Push en la app: permiso con pantalla previa, registro, tocar → navegar, preferencias en el Perfil. Prueba real en un Android. |
| E5 | Deep links (`.well-known`, App Links), vibración y pantalla encendida. |
| E6 | Guía `deploy/MOBILE.md` (compilar, firmar, subir a Play), README y ARCHITECTURE. Publicación en prueba cerrada de Google Play. |
| E7 | iOS: proyecto, APNs en Firebase, Universal Links, verificación de Turnstile (R1), envío a TestFlight y App Store. |

## 11. Preguntas resueltas (2026-11-19)

| # | Pregunta | Respuesta |
| --- | --- | --- |
| P1 | ¿Qué notificaciones incluimos en la primera versión? | Las cinco de 5.2. |
| P2 | ¿Android primero e iOS después? | Sí (D4). Para iOS, si no hay una Mac a mano, se compila con un servicio en la nube (Codemagic). |
| P3 | ¿`YOUR_TURN` siempre? | Solo si el tiempo del dado es de **60 s o más**. Con 30 s no se manda. |
| P4 | ¿Cuenta de Google Play? | Personal (USD 25), con la prueba cerrada de 14 días (R3). |
| P5 | ¿Identificador de la app? | `com.playroamle.app` (D3). |
| P6 | ¿Pantalla siempre encendida? | Sí, solo mientras hay una partida en curso, en la app y en la web donde el navegador lo permita. |
| P7 | ¿Política de privacidad? | La redacta Claude con lo que guarda Roamle y la revisa el dueño. |
| P8 | ¿PWA después? | Sí, como spec aparte. |

## 12. Notas de la implementación

### E1 — Capacitor y proyecto Android

- Capacitor 8 (`@capacitor/core`, `android`, `ios`, `app`, `browser`, `splash-screen`). Para la barra de estado se usa `SystemBars`, que viene en el núcleo de Capacitor 8 (no hace falta `@capacitor/status-bar`).
- `client/capacitor.config.ts`: `com.playroamle.app`, `server.hostname = app.playroamle.com` (D12), `SystemBars.insetsHandling = native`. Con `CAP_DEV_API=1` permite http para probar contra un backend local; nunca para publicar.
- Gradle: el wrapper que genera Capacitor (8.14) no corre con el JDK 25 de Android Studio; se subió a **Gradle 9.3.1** (AGP 8.13 compila bien).
- Ícono y pantalla de inicio: `npm run mobile:assets` genera las imágenes base desde `public/logo.svg` (`scripts/mobile-assets.mjs`) y `@capacitor/assets` arma todos los tamaños. Sin versión oscura del splash: el modo oscuro del sistema no tiene que ver con el estilo del perfil.
- Build de la app: `npm run mobile:sync -w client` (`vite build --mode mobile` + `cap sync`). Lee `.env.mobile` (ejemplo en `.env.mobile.example`) con `VITE_API_URL=https://playroamle.com/api`. Sin ese archivo la app queda en modo demo, útil para probar la interfaz sin servidor.
- `client/src/native/index.ts` (`useNativeShell`, montado en `App`): oculta el splash, botón Atrás (cierra el diálogo abierto mandando Escape, vuelve una pantalla, o minimiza en `/` y `/login`), enlaces externos al navegador del sistema y estilo de la barra de estado según el estilo Comic u 80s.
- Zonas seguras: variables `--sat/--sar/--sab/--sal` (`env(safe-area-inset-*)`) en `index.css`, padding en `body` y una franja opaca bajo la barra de estado. Ajustados: `Modal`, `VictoryScreen`, el banner de turno sticky, el aviso de la mesa y las invitaciones.
- Aviso de navegador viejo (D17): script en `index.html` que detecta `Array.prototype.at` y `color-mix()`. Apareció al probar en un Samsung Galaxy A30 (Android 11) con WebView 87: la app quedaba en blanco (`Xo.at is not a function`).
- Servidor: sin cambios de código. Hay que sumar los orígenes de la app a `CORS_ORIGIN` (ejemplo en `deploy/production.env.example`) y `app.playroamle.com` a los hostnames de Turnstile.

Pruebas: APK de debug instalado por USB en un Samsung Galaxy A30 (Android 11, WebView 157 después de actualizarlo), en modo demo: splash, login, panel, guía, "Cómo jugar", crear partida; Atrás cierra la guía, vuelve al panel y minimiza la app. La web se revisó en el navegador sin cambios visibles. No probado todavía: contra producción, un teléfono con notch y Android 15+ (borde a borde).

