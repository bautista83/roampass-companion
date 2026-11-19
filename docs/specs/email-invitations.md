# Spec: Invitaciones por correo y control de invitaciones

| | |
| --- | --- |
| Estado | **Borrador** — listo para implementar si se aprueba |
| Fecha | 2026-11-19 |
| Afecta | `shared`, `server`, `client` |
| Relacionado | [online-multiplayer.md](online-multiplayer.md) · [user-photo-and-email.md](user-photo-and-email.md) · [admin-panel.md](admin-panel.md) |

---

## 1. Objetivo

1. Que un jugador pueda **invitar por correo a una partida online** a alguien que todavía no tiene cuenta.
2. Que un jugador pueda **invitar a un amigo** a Roamle desde el panel principal, sin partida de por medio.
3. Que el **admin** sepa quién invitó a quién, qué invitaciones terminaron en una cuenta nueva y de quién vino cada una.

## 2. Alcance

### Incluido

- Invitación a partida online por correo, desde el buscador de jugadores de la sala (también con la partida empezada).
- Botón **"Invitar a un amigo"** en el panel principal, con el listado **"Mis invitaciones"** y su estado.
- Página de registro desde el enlace del correo, con el correo **prellenado y fijo** y sin confirmación aparte.
- Sección **"Invitaciones"** para el admin: totales, ranking de quién invitó más y listado completo.
- Columna **"Invitado por"** en la administración de usuarios.
- Enlace **"No quiero recibir invitaciones"** en cada correo.

### Fuera de alcance

- Mensaje personal en la invitación (se evita usar Roamle para mandar texto libre a desconocidos).
- Premios o recompensas por invitar.
- Invitar por WhatsApp u otros medios (se podría sumar "copiar enlace" más adelante).
- Avisos en tiempo real a quien invitó cuando el invitado se registra: lo ve en "Mis invitaciones".

## 3. Decisiones

| # | Decisión |
| --- | --- |
| D1 | **No se revela si un correo está registrado.** Quien invita ve siempre "Invitación enviada", exista o no la cuenta. |
| D2 | Si el correo **ya tiene cuenta** y es una invitación a partida, se crea la invitación de partida normal dentro de la app (la de 10 minutos) y además se envía un correo para que entre. En la sala, esa invitación se muestra **con el correo que escribió el anfitrión**, no con el usuario, hasta que se acepte. |
| D3 | Si el correo **ya tiene cuenta** y es una invitación de amigo, **no se envía nada** (no tiene sentido invitarlo a registrarse). Para el admin queda registrada como `ALREADY_MEMBER`. |
| D4 | El enlace del correo lleva un token aleatorio de un solo uso (en la BD solo su hash SHA-256), igual que los de confirmación de correo (D5 de user-photo-and-email). |
| D5 | Quien se registra **desde el enlace** ya demostró que el correo es suyo: la cuenta nace **confirmada** y entra directo, sin pasar por el correo de confirmación. Turnstile se mantiene. |
| D6 | El crédito de una cuenta nueva es para la invitación **cuyo enlace se usó**. Las demás invitaciones pendientes a ese mismo correo quedan `CLOSED` (también si se registra sin enlace). |
| D7 | Vencimientos: invitación de amigo, **7 días**; invitación a partida, mientras la partida no termine, con un máximo de **7 días**. Si la partida terminó, el enlace sigue sirviendo para crear la cuenta, sin la partida. |
| D8 | Límites antiabuso: cada usuario manda hasta **10 invitaciones por correo por día** (sumando ambos tipos); no se reenvía al **mismo correo** antes de **24 h**; un mismo correo recibe como mucho **3 invitaciones por día** de cualquier usuario. |
| D9 | Quien pide "No quiero recibir invitaciones" queda en una lista de bloqueo (se guarda el hash del correo). A esos correos no se les envía nada, y quien invita igual ve "Invitación enviada". |
| D10 | El admin ve los **correos completos** de las invitaciones (es el responsable del sistema). Los jugadores solo ven los correos que ellos mismos invitaron. |
| D11 | Textos en español latino neutro, en el diccionario i18n (`invites.json` en el cliente, plantillas del servidor). |

## 4. Flujos de usuario

### 4.1 Invitar a una partida por correo

1. En la sala (o con "Invitar más" en la partida empezada), el anfitrión escribe en el buscador.
2. Si lo que escribió **parece un correo**, debajo de los resultados aparece **"Enviar invitación por correo a ana@mail.com"**.
   Con la partida empezada se eligen las millas iniciales, igual que con un usuario.
3. Se envía y se muestra "Invitación enviada". En la lista de invitaciones de la sala aparece el correo como "pendiente".
4. Le llega el correo:
   - **Asunto:** "Pepe te invitó a jugar una partida de Roamle"
   - **Cuerpo:** "Pepe te invitó a su partida online de Roamle, el juego de viajar, adivinar y explorar. Crea tu cuenta para sumarte." · Botón **"Crear mi cuenta y jugar"**.
   - Si el correo ya tenía cuenta: "Pepe te invitó a su partida online de Roamle. Entra para aceptar la invitación." · Botón **"Entrar a Roamle"** (D2).
5. El invitado abre el enlace → registro con el correo fijo → entra directo (D5) → si la partida sigue y hay lugar,
   le aparece la invitación a la partida (la de 10 minutos, recién creada) y puede aceptarla.
6. Si la partida terminó o se llenó: "Tu cuenta quedó creada, pero la partida de Pepe ya no está disponible."

### 4.2 Invitar a un amigo

1. En el panel principal, botón **"Invitar a un amigo"** → modal con un campo de correo y el listado "Mis invitaciones".
2. Le llega el correo:
   - **Asunto:** "Pepe te invita a sumarte a Roamle"
   - **Cuerpo:** "Pepe te invita a Roamle, el juego de viajar, adivinar y explorar. Crea tu pasaporte y juega con tus amigos." · Botón **"Crear mi cuenta"**.
3. El invitado abre el enlace → registro con el correo fijo → entra directo.

### 4.3 "Mis invitaciones" (jugador)

Listado de las invitaciones por correo que mandé, con fecha, correo, tipo (amigo / partida) y estado:
**Pendiente**, **Se registró como @ana**, **Venció**. Las `ALREADY_MEMBER`, `CLOSED` y bloqueadas se muestran como
"Pendiente" hasta vencer, para no revelar nada (D1).

### 4.4 Control del admin

Sección **"Invitaciones"** en el panel del admin, debajo de la administración de usuarios:

- **Totales:** enviadas, cuentas creadas por invitación, porcentaje de conversión, pendientes.
- **Quién invitó más:** por usuario, enviadas y registradas (ordenado por registradas).
- **Listado completo:** fecha, quién invitó, correo, tipo (y partida), estado, cuenta creada y fecha de registro.
  Con filtros por estado y por quién invitó.
- En la administración de usuarios, cada cuenta muestra **"Invitado por @pepe"** si se creó desde una invitación.

### 4.5 Darse de baja

El pie de cada correo dice "¿No quieres recibir más invitaciones de Roamle? Haz clic aquí". La página confirma con un
botón (no se da de baja con solo abrir el enlace, porque los antivirus del correo abren los enlaces).

## 5. Reglas

| Id | Regla |
| --- | --- |
| EI-01 | Solo usuarios con sesión pueden invitar. Nadie se invita a sí mismo (su propio correo). |
| EI-02 | La invitación a partida la manda solo el **anfitrión**, con la partida en sala o en curso, y si hay lugar (máximo 6). |
| EI-03 | No se puede tener dos invitaciones `PENDING` del mismo usuario al mismo correo para la misma partida (o de amigo). |
| EI-04 | Límites de D8. Al superarlos: "Llegaste al límite de invitaciones por hoy. Prueba mañana." (`INVITE_LIMIT`). El límite por correo de destino no se informa (D1): se responde "Invitación enviada" y no se envía. |
| EI-05 | Al registrarse con un enlace válido: la cuenta nace confirmada, la invitación pasa a `REGISTERED` con la cuenta nueva, y `User.invitedById` apunta a quien invitó (D6). |
| EI-06 | Al registrarse, si la invitación era a una partida que sigue sin terminar, hay lugar y el anfitrión sigue siendo quien invitó (o sigue en la partida), se crea la invitación de partida normal con las millas que eligió el anfitrión (ajustadas al máximo vigente). |
| EI-07 | Un enlace vencido, usado o cancelado muestra "El enlace no es válido o ya venció" y ofrece el registro normal. |
| EI-08 | Si el anfitrión cancela la sala, sus invitaciones por correo a esa partida pasan a `CANCELLED`, pero el enlace sigue sirviendo para registrarse como invitación de amigo (sin partida). |
| EI-09 | Si se elimina la cuenta que invitó, sus invitaciones se conservan para el admin con "cuenta eliminada" (`fromUserId` queda en `null`). |

## 6. Modelo de datos

### 6.1 Prisma

```prisma
enum EmailInviteKind {
  FRIEND
  GAME
}

enum EmailInviteStatus {
  PENDING         // enviada, sin usar
  REGISTERED      // se creo una cuenta con este enlace
  ALREADY_MEMBER  // el correo ya tenia cuenta (D2/D3)
  CLOSED          // el correo se registro por otra invitacion o sin enlace (D6)
  BLOCKED         // el correo pidio no recibir invitaciones (D9)
  CANCELLED       // el anfitrion cancelo la sala (EI-08)
  EXPIRED
}

model EmailInvite {
  id               String            @id @default(cuid())
  kind             EmailInviteKind
  fromUserId       String?
  fromUser         User?             @relation("EmailInviteFrom", fields: [fromUserId], references: [id], onDelete: SetNull)
  fromUsername     String            // copia, para el admin si se borra la cuenta
  email            String            // normalizado en minusculas
  sessionId        String?           // solo GAME
  session          GameSession?      @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  initialMiles     Int               @default(0)
  tokenHash        String            @unique
  status           EmailInviteStatus @default(PENDING)
  createdAt        DateTime          @default(now())
  expiresAt        DateTime
  registeredUserId String?
  registeredUser   User?             @relation("EmailInviteRegistered", fields: [registeredUserId], references: [id], onDelete: SetNull)
  registeredAt     DateTime?

  @@index([fromUserId, createdAt])
  @@index([email, createdAt])
}

model EmailOptOut {
  emailHash String   @id // SHA-256 del correo normalizado
  createdAt DateTime @default(now())
}

model User {
  // ...
  invitedById String?
  invitedBy   User?  @relation("InvitedBy", fields: [invitedById], references: [id], onDelete: SetNull)
  invitedUsers User[] @relation("InvitedBy")
}
```

`GameInvite` suma `viaEmail String?` para mostrar en la sala el correo en lugar del usuario (D2).

## 7. Interfaces

### 7.1 REST

| Método y ruta | Quién | Qué hace |
| --- | --- | --- |
| `POST /api/email-invites` `{ email }` | con sesión | Invitación de amigo. Responde siempre `201 { sent: true }` salvo `INVITE_LIMIT`. |
| `GET /api/email-invites/mine` | con sesión | "Mis invitaciones" (4.3). |
| `POST /api/online/:id/email-invites` `{ email, initialMiles }` | anfitrión | Invitación a partida por correo (4.1). |
| `GET /api/email-invites/token/:token` | público | Datos para la página de registro: `{ email, fromUsername, kind, gameAvailable }`. |
| `POST /api/auth/register` `{ …, inviteToken? }` | público | Con `inviteToken` válido: el correo debe coincidir, la cuenta nace confirmada y responde `{ token, user, gameInvite? }`. |
| `POST /api/email-invites/opt-out` `{ token }` | público | Baja de invitaciones (4.5). |
| `GET /api/admin/email-invites?status&fromUserId` | admin | Listado completo (4.4). |
| `GET /api/admin/email-invites/stats` | admin | Totales y ranking (4.4). |
| `GET /api/users` | admin | Suma `invitedBy: { id, username } \| null`. |

Códigos de error nuevos: `INVITE_LIMIT`, `INVALID_INVITE`, `INVITE_EMAIL_MISMATCH`, `CANNOT_INVITE_SELF`.

### 7.2 Cliente

- `components/invites/InviteFriend.tsx` (modal con formulario y "Mis invitaciones") y botón en `Dashboard`.
- `PlayerSearch` (online): opción "Enviar invitación por correo" cuando el texto es un correo.
- Ruta `/invite/:token`: registro con correo fijo; ruta `/invite/:token/opt-out`: baja.
- `components/dashboard/InviteStats.tsx` (solo admin) y columna "Invitado por" en `UserManagement`.
- Textos en `locales/es/invites.json`.

## 8. Aspectos técnicos

- **Normalización del correo:** `trim().toLowerCase()`; validación con Zod `email()`.
- **Vencimiento:** se marca `EXPIRED` al consultar (como `expireInvites` del modo online) y en la purga diaria.
- **Envío:** con el `mailer` actual; si el envío falla, la invitación se borra y se responde error para reintentar
  (salvo en los casos que no deben revelar nada, que responden "enviada").
- **Rate limit por IP** en `POST /api/email-invites*` además de los límites por usuario (D8), y en `GET /token/:token`.
- **Amenazas:** enumeración de correos (D1, respuestas iguales y tiempos parecidos), spam (D8, D9, sin texto libre),
  enlaces reenviados (el registro exige el mismo correo y el token es de un solo uso).

## 9. Criterios de aceptación

- **CA-01.** Dado que soy anfitrión y escribo `ana@mail.com` sin cuenta, cuando envío la invitación, entonces veo "Invitación enviada", le llega el correo "Pepe te invitó a jugar una partida de Roamle" y en la sala aparece el correo como pendiente.
- **CA-02.** Dado ese correo, cuando Ana abre el enlace, entonces ve el registro con `ana@mail.com` fijo y el texto "Pepe te invitó".
- **CA-03.** Dado que Ana completa el registro, entonces entra directo sin confirmar el correo, le aparece la invitación a la partida y al aceptarla queda sentada.
- **CA-04.** Dado que la partida terminó antes de que Ana se registre, cuando se registra, entonces entra con su cuenta y ve "la partida de Pepe ya no está disponible".
- **CA-05.** Dado que `luis@mail.com` ya tiene cuenta, cuando el anfitrión lo invita por correo, entonces ve "Invitación enviada", a Luis le llega la invitación en la app y un correo para entrar, y en la sala se muestra `luis@mail.com` hasta que acepte.
- **CA-06.** Dado que invito a un amigo desde el panel, cuando envío, entonces le llega "Pepe te invita a sumarte a Roamle" y la veo como "Pendiente" en "Mis invitaciones".
- **CA-07.** Dado que el amigo se registró con el enlace, entonces en "Mis invitaciones" veo "Se registró como @ana".
- **CA-08.** Dado que invito de amigo a un correo que ya tiene cuenta, entonces veo "Invitación enviada", no se envía correo y el admin la ve como "Ya tenía cuenta".
- **CA-09.** Dado que ya mandé 10 invitaciones hoy, cuando mando otra, entonces veo "Llegaste al límite de invitaciones por hoy".
- **CA-10.** Dado que invité a `ana@mail.com` hace menos de 24 h, cuando la vuelvo a invitar, entonces veo el mismo error de límite.
- **CA-11.** Dado que Ana pidió no recibir invitaciones, cuando alguien la invita, entonces ve "Invitación enviada" y no se envía nada.
- **CA-12.** Dado que Pepe y Juan invitaron a Ana y ella usa el enlace de Juan, entonces la cuenta queda "Invitado por @juan", la de Juan `REGISTERED` y la de Pepe `CLOSED`.
- **CA-13.** Dado que alguien reenvía el enlace a otro correo, cuando intenta registrarse con otro correo, entonces no puede (el campo está fijo y el servidor rechaza `INVITE_EMAIL_MISMATCH`).
- **CA-14.** Dado que soy admin, cuando abro "Invitaciones", entonces veo los totales, el ranking de quién invitó más y el listado con quién invitó, a qué correo, el estado y la cuenta creada.
- **CA-15.** Dado que soy admin, cuando miro los usuarios, entonces veo "Invitado por @pepe" en las cuentas creadas por invitación.
- **CA-16.** Dado que un jugador que no es admin llama a `/api/admin/email-invites`, entonces recibe 403.
- **CA-17.** Dado un enlace usado o vencido, cuando se abre, entonces se muestra "El enlace no es válido o ya venció" con un botón al registro normal.

## 10. Plan de implementación (un commit por etapa)

| Etapa | Contenido |
| --- | --- |
| E1 | Migración Prisma (`EmailInvite`, `EmailOptOut`, `User.invitedById`, `GameInvite.viaEmail`), servicio de invitaciones (crear, límites, vencer, consumir) y plantillas de correo. Tests. |
| E2 | Rutas REST de jugador, registro con `inviteToken`, baja y rutas del admin. |
| E3 | Cliente: "Invitar a un amigo" + "Mis invitaciones", invitación por correo en `PlayerSearch`, página `/invite/:token` y baja. |
| E4 | Cliente admin: sección "Invitaciones" y "Invitado por" en usuarios. |
| E5 | Pruebas de punta a punta (correo de prueba local), docs (ARCHITECTURE, README) y estado de la spec. |

## 11. Preguntas abiertas

Ninguna: las decisiones de la sección 3 quedaron acordadas. Si alguna no te convence, se cambia antes de empezar.
