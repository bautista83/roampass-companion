# Spec: Foto del jugador, cuentas con correo y preparación multi idioma

| | |
| --- | --- |
| Estado | **Implementado** — PR 1 (foto + correo) y PR 2 (multi idioma) |
| Fecha | 2026-11-18 |
| Afecta | `shared`, `server`, `client`, `deploy` |
| Entrega | PR 1: foto + correo + despliegue · PR 2: multi idioma |
| Relacionado | [ARCHITECTURE.md](../ARCHITECTURE.md) · [admin-panel.md](admin-panel.md) |

---

## 1. Objetivo

1. Que cada usuario tenga **su foto** en el pasaporte, sacada con la cámara o subida desde el dispositivo.
2. Que el registro **no dependa del admin**: la cuenta se confirma con un enlace enviado por correo.
3. Iniciar sesión con **usuario o correo**, y recuperar la contraseña por correo.
4. Publicar la app con **dominio propio** (Cloudflare Tunnel) y enviar correos con **Brevo**.
5. Dejar la app **lista para varios idiomas**, de modo que en el futuro solo falte traducir el contenido.
6. Mantener el nombre **RoamPass** con el subtítulo en español **"Viaja, adivina y explora"**.

## 2. Decisiones

| # | Decisión |
| --- | --- |
| D1 | La foto se achica **en el navegador** (256×256, recorte al centro) y el servidor la **vuelve a procesar con `sharp`**: valida que sea una imagen, fija el tamaño y elimina los metadatos EXIF (incluida la ubicación GPS). |
| D2 | La foto se guarda en PostgreSQL (`bytea`, tabla aparte). Pesa ~20–40 KB: no hace falta un volumen de archivos y entra en los backups. |
| D3 | La foto solo la ven usuarios con sesión: el cliente la descarga con el token y la muestra como `blob:`. |
| D4 | Correo por **SMTP con `nodemailer`** (Brevo en producción). Sin `SMTP_HOST`, el enlace se imprime en la consola del servidor (desarrollo). |
| D5 | Los tokens de correo son aleatorios (32 bytes), de **un solo uso**, y en la BD se guarda solo su hash SHA-256. |
| D6 | La confirmación del correo es independiente de `isActive`: el admin puede seguir desactivando cuentas. |
| D7 | Los textos nuevos se escriben en **español latino neutro** (tuteo) y en un solo lugar, para traducirlos después. |
| D8 | Los errores de la API llevan un **código** (`{ error, code }`) además del mensaje, para poder traducirlos en el cliente. |
| D9 | **Turnstile** (captcha de Cloudflare) en el registro, **apagado** mientras no estén las claves en el `.env`. |
| D10 | Detrás de Cloudflare, el límite de intentos usa la IP real del encabezado `CF-Connecting-IP` (`TRUST_CLOUDFLARE=true`). |
| D11 | Cloudflare Tunnel se instala **en la VM** con el comando que da el panel de Cloudflare y apunta al Nginx (`http://localhost:8080`). No cambia el compose. |

## 3. Foto del jugador

### Flujo

1. En **Mi perfil**: botones **"Sacar foto"** (en el celular abre la cámara frontal) y **"Elegir imagen"**.
2. La app recorta al centro, achica a 256×256 y muestra una **vista previa** con **Guardar** / **Cancelar**.
3. Al guardar, la foto reemplaza al retrato dibujado en el pasaporte. **"Quitar foto"** vuelve al retrato.
4. En la gestión de usuarios, el admin ve la foto de cada uno y puede **quitarla**.

### Reglas

| Id | Regla |
| --- | --- |
| FO-01 | Se aceptan imágenes de hasta **10 MB** (JPEG, PNG, WebP, HEIC si el navegador lo decodifica). |
| FO-02 | El servidor guarda siempre **WebP 256×256**, sin metadatos. Lo que no es una imagen válida se rechaza (400). |
| FO-03 | La foto se sirve solo con sesión iniciada y con caché del navegador; cambia la URL cuando cambia la foto. |
| FO-04 | Modo demo: la foto se guarda en `localStorage`. |

## 4. Cuentas con correo

### Registro y confirmación

1. El registro pide **usuario, correo y contraseña** (y Turnstile, si está activo).
2. La cuenta se crea **sin confirmar** y se envía un correo con el enlace `APP_URL/verify-email?token=…`.
3. Al abrir el enlace, la app confirma la cuenta y ofrece iniciar sesión.
4. Si alguien intenta entrar sin confirmar, ve *"Confirma tu correo para entrar"* y el botón **"Reenviar correo"**.

### Otras funciones

- **Iniciar sesión con usuario o correo**: si lo escrito tiene `@`, se busca por correo (los usuarios no pueden tener `@`).
- **¿Olvidaste tu contraseña?**: se pide el usuario o el correo y llega un enlace `APP_URL/reset-password?token=…`.
- **Correo en Mi perfil**: agregar o cambiar el correo (pide la contraseña actual). El correo nuevo recibe un enlace; hasta confirmarlo sigue valiendo el anterior.

### Reglas

| Id | Regla |
| --- | --- |
| CO-01 | El correo se guarda en minúsculas y es único. |
| CO-02 | El enlace de confirmación vence a las **24 h**; el de recuperación, a la **1 h**. Ambos son de un solo uso. |
| CO-03 | Las cuentas **sin confirmar** con más de **7 días** se eliminan; su usuario y su correo quedan libres. |
| CO-04 | Reenviar la confirmación y pedir recuperación: **3 por hora** por IP. Las respuestas no revelan si el usuario o el correo existen. |
| CO-05 | El error de inicio de sesión sigue siendo genérico ("Usuario o contraseña incorrectos"). |
| CO-06 | Usuarios que ya existían: siguen entrando como siempre; el correo es opcional. |
| CO-07 | Registros que hoy están pendientes de aprobación (sin correo): los sigue activando el admin. |
| CO-08 | El botón **"Activar"** del admin también marca el correo como confirmado. El admin puede **confirmar a mano** un correo (si el mensaje no llegó). |
| CO-09 | Usuarios creados por el admin: no necesitan correo. |
| CO-10 | Recuperar la contraseña con el enlace también confirma el correo (prueba que es del usuario). |
| CO-11 | Modo demo: el registro entra directo (como hoy) y la recuperación por correo no está disponible. |

## 5. Modelo de datos

```prisma
model User {
  // ... campos actuales ...
  email           String?   @unique
  emailVerifiedAt DateTime?
  /// Correo nuevo pedido desde Mi perfil, hasta que se confirma.
  pendingEmail    String?
  /// Cambia con cada foto nueva (sirve para invalidar la caché).
  photoUpdatedAt  DateTime?
  photo           UserPhoto?
  emailTokens     EmailToken[]
}

model UserPhoto {
  userId    String   @id
  data      Bytes
  mimeType  String   // image/webp
  updatedAt DateTime @updatedAt
}

enum EmailTokenPurpose {
  VERIFY_EMAIL
  CHANGE_EMAIL
  RESET_PASSWORD
}

model EmailToken {
  id        String            @id @default(cuid())
  userId    String
  purpose   EmailTokenPurpose
  tokenHash String            @unique
  /// Correo al que se envió (en CHANGE_EMAIL, el correo nuevo).
  email     String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime          @default(now())
}
```

## 6. API

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | rate limit + Turnstile | `{ username, email, password, captchaToken? }` → `{ pending: true, message }` |
| POST | `/api/auth/login` | rate limit | `{ identifier, password }` (acepta `username` por compatibilidad). 403 `EMAIL_NOT_VERIFIED` |
| POST | `/api/auth/verify-email` | — | `{ token }` → confirma el registro o el cambio de correo |
| POST | `/api/auth/resend-verification` | rate limit | `{ identifier }` → respuesta genérica |
| POST | `/api/auth/forgot-password` | rate limit | `{ identifier }` → respuesta genérica |
| POST | `/api/auth/reset-password` | rate limit | `{ token, password }` |
| PATCH | `/api/auth/me` | usuario | Además de tema y contraseña: `{ email, currentPassword }` |
| PUT | `/api/auth/me/photo` | usuario | Cuerpo: la imagen (`image/*`, hasta 10 MB) |
| DELETE | `/api/auth/me/photo` | usuario | Quita la foto |
| GET | `/api/users/:id/photo` | usuario | La foto (WebP) o 404 |
| DELETE | `/api/users/:id/photo` | ADMIN | Quita la foto de un usuario |
| PATCH | `/api/users/:id` | ADMIN | Acepta `emailVerified: true` |

Errores: `{ error: string, code?: string }`. Códigos nuevos: `EMAIL_NOT_VERIFIED`, `ACCOUNT_INACTIVE`,
`USERNAME_TAKEN`, `EMAIL_TAKEN`, `INVALID_TOKEN`, `CAPTCHA_FAILED`, `INVALID_IMAGE`.

## 7. Configuración (`.env`)

| Variable | Para qué |
| --- | --- |
| `APP_URL` | URL pública de la app, para los enlaces de los correos |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Servidor de correo (Brevo: `smtp-relay.brevo.com`, puerto 587) |
| `MAIL_FROM` | Remitente, por ejemplo `RoamPass <no-reply@tudominio.com>` |
| `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` | Captcha del registro (vacías = apagado) |
| `TRUST_CLOUDFLARE` | `true` detrás de Cloudflare Tunnel: usa `CF-Connecting-IP` |

## 8. Preparación multi idioma (PR 2)

| Parte | Qué se hace |
| --- | --- |
| Librería | `i18next` + `react-i18next` en el cliente |
| Textos de la interfaz | Todos pasan a `client/src/i18n/es.json` (español latino neutro: se reemplaza el voseo) |
| Reglas y etiquetas | `shared/rules.ts` y `labels.ts` leen sus textos de un diccionario por idioma; el PDF de reglas recibe el idioma |
| Errores de la API | El cliente muestra la traducción del `code`; si no la tiene, el mensaje del servidor |
| Correos | Plantillas por idioma en el servidor; el idioma sale del perfil del usuario |
| Idioma del usuario | Campo `locale` en el perfil (`es` por defecto). Antes de iniciar sesión, el idioma del navegador |
| Selector | Oculto mientras haya un solo idioma (`LanguageSection` en Mi perfil) |
| Cartas | Formato listo: traducciones opcionales por carta (`translations: { en: {...} }`) con el español como respaldo |
| Países | En otros idiomas, el nombre sale de `Intl.DisplayNames`; las capitales, de las traducciones |
| Fechas y números | Con el idioma activo (`Intl`) |

**Queda para el futuro (lo costoso):** traducir las cartas escritas a mano, las capitales y revisar
el contenido que solo tiene sentido en un país.

## 9. Criterios de aceptación

**Foto**

- **FA-01.** Dada una foto de 8 MB, cuando la subo, entonces se guarda en 256×256 y pesa menos de 60 KB.
- **FA-02.** Dada una foto con ubicación GPS, cuando la descargo del servidor, entonces no tiene metadatos.
- **FA-03.** Dado un archivo que no es imagen renombrado a `.jpg`, cuando lo subo, entonces recibo error.
- **FA-04.** Dado que quito mi foto, entonces el pasaporte vuelve a mostrar el retrato dibujado.
- **FA-05.** Dado el admin, cuando quita la foto de un usuario, entonces ese usuario vuelve al retrato.
- **FA-06.** Dada una petición sin token a `/api/users/:id/photo`, entonces recibe 401.

**Correo**

- **CA-01.** Dado que me registro, entonces no puedo entrar hasta confirmar, y al abrir el enlace puedo entrar.
- **CA-02.** Dado un enlace usado o vencido, cuando lo abro, entonces veo un error y la opción de pedir otro.
- **CA-03.** Dado que intento entrar sin confirmar, entonces veo el aviso y puedo reenviar el correo.
- **CA-04.** Dado mi correo con mayúsculas, cuando inicio sesión con él en minúsculas, entonces entro.
- **CA-05.** Dado que pido recuperar la contraseña con un correo que no existe, entonces la respuesta es la misma que si existiera.
- **CA-06.** Dado el enlace de recuperación, cuando pongo una contraseña nueva, entonces entro con ella y la anterior deja de valer.
- **CA-07.** Dado que cambio mi correo, entonces sigo teniendo el anterior hasta abrir el enlace enviado al nuevo.
- **CA-08.** Dado un registro sin confirmar de hace más de 7 días, entonces su usuario se puede volver a registrar.
- **CA-09.** Dado que el admin pulsa "Confirmar correo", entonces el usuario puede entrar sin el enlace.
- **CA-10.** Dado Turnstile activo, cuando me registro sin resolverlo, entonces recibo `CAPTCHA_FAILED`.
- **CA-11.** Dados más de 10 inicios de sesión fallidos desde una IP detrás de Cloudflare, entonces solo se bloquea esa IP.

**Multi idioma**

- **IA-01.** Dada la app en español, entonces no hay textos de interfaz escritos fuera de los diccionarios.
- **IA-02.** Dada la app, entonces los textos usan tuteo neutro (no voseo).
- **IA-03.** Dada una carta con traducción a otro idioma, entonces se muestra traducida; sin traducción, en español.
- **IA-04.** Dado un error de la API con código, entonces el cliente muestra el texto del diccionario.

## 10. Plan

| PR | Commits |
| --- | --- |
| 1 | Spec · Foto · Correo (registro, confirmación, login, recuperación, perfil, admin) · Turnstile + IP real · Despliegue (Cloudflare, Brevo) y subtítulo · Docs |
| 2 | i18n en el cliente · Reglas, PDF y correos por idioma · Cartas y países traducibles · Docs |
