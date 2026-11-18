# Spec: Panel de administración y admin único

| | |
| --- | --- |
| Estado | **Borrador** — falta definir el detalle |
| Fecha | 2026-11-18 |
| Afecta | `server`, `client` |
| Relacionado | [online-multiplayer.md](online-multiplayer.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) |

---

## 1. Objetivo

Separar claramente los dos roles:

- **Admin del sistema:** uno solo. Administra usuarios y ve todas las partidas.
- **Anfitrión:** cualquier usuario que crea una partida online. Solo administra esa partida y no tiene permisos en el sistema (ver online-multiplayer.md).

Y darle al admin del sistema un **panel de control** propio.

## 2. Situación actual

- El rol `ADMIN` se puede asignar a **cualquier usuario** desde la administración de usuarios
  (`PATCH /api/users/:id` con `role`) o al crearlo (`POST /api/users`). Puede haber varios.
- El seed crea o asciende a `ADMIN_USERNAME` del `.env`.
- La administración de usuarios está dentro del panel principal (`UserManagement` en `Dashboard`):
  activar/desactivar, confirmar correos a mano, quitar fotos, renombrar, cambiar contraseña, cambiar rol y eliminar.
  Desde [user-photo-and-email.md](user-photo-and-email.md) los registros se confirman por correo: el admin ya no
  los aprueba (salvo las cuentas viejas que quedaron pendientes).
- En "Últimas partidas" el admin ve las partidas de todos y puede eliminar cualquiera.

## 3. Reglas

| Id | Regla |
| --- | --- |
| AP-01 | Existe **un solo** usuario `ADMIN`: el definido en `ADMIN_USERNAME` del `.env`. |
| AP-02 | El rol ya **no se puede cambiar** desde la UI ni desde la API: `POST /api/users` crea siempre `PLAYER` y `PATCH /api/users/:id` no acepta `role`. |
| AP-03 | El admin no se puede desactivar ni eliminar a sí mismo. |
| AP-04 | El admin ve todas las partidas, locales y online, con su estado. |

## 4. Panel de control

Contenido inicial (lo que ya existe, reorganizado):

- **Usuarios:** listado con foto y correo, cuentas sin confirmar, activar/desactivar, renombrar, cambiar contraseña, eliminar.
- **Partidas:** todas las partidas (locales y online), con estado, jugadores y anfitrión.

### Foto de pasaporte

Ya implementada en [user-photo-and-email.md](user-photo-and-email.md): el admin ve la foto de cada
usuario y puede quitarla.

## 5. Preguntas abiertas

1. Si hoy hay **otros usuarios con rol `ADMIN`**, ¿se pasan a `PLAYER` con una migración?
2. Si cambia `ADMIN_USERNAME` en el `.env`, ¿el anterior pierde el rol al correr el seed?
3. ¿El panel va en una **ruta propia** (`/admin`) o sigue dentro del panel principal?
4. ¿El admin necesita ver una partida online **en vivo** (como espectador) o le alcanza con el listado?
5. ¿Qué más debería mostrar el panel (estadísticas globales, cartas, actividad)?

## 6. Criterios de aceptación (iniciales)

- **AP-CA-01.** Dado el panel de usuarios, entonces no existe la opción de cambiar el rol.
- **AP-CA-02.** Dado un `POST /api/users` con `role: "ADMIN"`, entonces se crea como `PLAYER` o se rechaza.
- **AP-CA-03.** Dado el admin, cuando intenta desactivarse o eliminarse, entonces recibe error.
- **AP-CA-04.** Dado el admin, entonces ve en el panel todas las partidas, locales y online.
