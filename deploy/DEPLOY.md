# Despliegue de RoamPass en vm-dev-web

```
Navegador ──► Nginx de la VM :8080 ─┬─ /api/* ──► roampass-api  (127.0.0.1:4100, Express + Prisma)
                                    └─ /*     ──► roampass-web  (127.0.0.1:3100, SPA en Nginx)
roampass-api ──(red dev-net)──► postgres:5432 (PostgreSQL compartido de la VM)
```

| Archivo | Para qué |
|---|---|
| `docker-compose.prod.yml` | Los dos contenedores (api + web) |
| `deploy/Dockerfile.server` | Imagen de la API; al arrancar aplica `prisma migrate deploy` |
| `deploy/Dockerfile.client` | Compila la SPA con `VITE_API_URL=/api` y la sirve con Nginx |
| `deploy/nginx/spa.conf` | Nginx dentro del contenedor web (rutas de React Router) |
| `deploy/nginx/roampass.conf` | Nginx nativo de la VM (reverse proxy en el puerto 8080) |
| `deploy/production.env.example` | Plantilla del `.env` del servidor |

## Primera instalación

Requisitos en la VM: Docker, la red `dev-net` y el contenedor `postgres` (ver `~/infra/postgres`).

### 1. Base de datos y usuario propios

```bash
openssl rand -hex 16   # clave para el usuario roampass (guárdala)
docker exec -it postgres psql -U bautista -d postgres -c "CREATE USER roampass WITH PASSWORD 'LA_CLAVE';"
docker exec -it postgres psql -U bautista -d postgres -c "CREATE DATABASE roampass OWNER roampass;"
```

### 2. Código y configuración

```bash
mkdir -p ~/apps && cd ~/apps
git clone -b <rama> https://github.com/bautista83/roampass-companion.git roampass
cd roampass
cp deploy/production.env.example .env
openssl rand -hex 32   # JWT_SECRET
nano .env              # DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, CORS_ORIGIN
chmod 600 .env
```

### 3. Levantar los contenedores

```bash
docker compose up -d --build      # usa docker-compose.prod.yml por COMPOSE_FILE del .env
docker compose logs -f api        # esperar "All migrations have been successfully applied"
docker compose exec api npx prisma db seed   # cartas + admin inicial (solo la primera vez)
curl http://127.0.0.1:4100/api/health        # {"ok":true}
```

### 4. Nginx de la VM

```bash
sudo cp deploy/nginx/roampass.conf /etc/nginx/sites-available/roampass
sudo ln -s /etc/nginx/sites-available/roampass /etc/nginx/sites-enabled/roampass
sudo nginx -t && sudo systemctl reload nginx
```

App: `http://192.168.100.202:8080` (LAN) o `http://dev-web:8080` (Tailscale).

## Actualizar a una versión nueva

```bash
cd ~/apps/roampass
git pull
docker compose up -d --build      # las migraciones nuevas se aplican solas al arrancar la API
docker image prune -f             # borra las imágenes viejas
```

## Publicar en Internet con dominio propio (Cloudflare Tunnel)

El túnel sale desde la VM hacia Cloudflare: no hay que abrir puertos en el router y el HTTPS es automático.

```
Navegador ──HTTPS──► Cloudflare ──túnel──► cloudflared (VM) ──► Nginx :8080 ──► api / web
```

### 1. Dominio

1. En Cloudflare: **Domain Registration → Register Domains** y compra el dominio
   (por ejemplo `tudominio.com`). Queda con los DNS de Cloudflare.
2. Elige el subdominio de la app, por ejemplo `roampass.tudominio.com`.

### 2. Túnel

1. **Zero Trust → Networks → Tunnels → Create a tunnel** → tipo **Cloudflared** → nombre `roampass`.
2. Elige **Debian** y copia el comando que muestra el panel (`sudo cloudflared service install <token>`).
   Ejecútalo en la VM: instala `cloudflared` como servicio y arranca solo con la VM.
3. En **Public Hostname**: subdominio `roampass`, dominio `tudominio.com`, servicio
   **HTTP** → `localhost:8080`.
4. Comprueba: `systemctl status cloudflared` y abre `https://roampass.tudominio.com`.

### 3. `.env` del servidor

```bash
CORS_ORIGIN="https://roampass.tudominio.com"
APP_URL="https://roampass.tudominio.com"
TRUST_CLOUDFLARE=true
```

Con `TRUST_CLOUDFLARE=true` los límites de intentos usan la IP real del visitante
(encabezado `CF-Connecting-IP`). Sin eso, todas las visitas llegarían "desde" `cloudflared`
y 10 logins fallidos de cualquiera bloquearían a todos.

Luego: `docker compose up -d --build`.

## Correo con Brevo

Los correos de confirmación y de recuperación de contraseña salen por SMTP. Sin `SMTP_HOST`
no se envían: el enlace se imprime en el log de la API (`docker compose logs api`).

1. Crea la cuenta en [brevo.com](https://www.brevo.com) (plan gratuito: 300 correos por día).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `tudominio.com`.
   Brevo muestra registros DNS (código de Brevo, **DKIM** y **DMARC**). Cárgalos en
   **Cloudflare → DNS → Records** tal cual y pulsa **Authenticate** en Brevo.
   Sin este paso los correos suelen terminar en spam.
3. **Senders → Add a sender**: `no-reply@tudominio.com` (nombre `RoamPass`).
4. **SMTP & API → SMTP**: copia el *login* y genera una **SMTP key**.
5. En el `.env` del servidor:

   ```bash
   SMTP_HOST="smtp-relay.brevo.com"
   SMTP_PORT=587
   SMTP_USER="<login SMTP de Brevo>"
   SMTP_PASS="<SMTP key>"
   MAIL_FROM="RoamPass <no-reply@tudominio.com>"
   ```

6. `docker compose up -d` y prueba registrándote con un correo tuyo.

## Captcha en el registro (Cloudflare Turnstile, opcional)

Con el registro abierto a Internet, el captcha frena a los bots que crean cuentas y gastan el cupo de correos.

1. Cloudflare → **Turnstile → Add widget**: dominio `roampass.tudominio.com`, modo **Managed**.
2. En el `.env`: `VITE_TURNSTILE_SITE_KEY` (clave del sitio, va al navegador) y
   `TURNSTILE_SECRET_KEY` (clave secreta, solo servidor).
3. `docker compose up -d --build` (la clave del sitio se compila en el bundle).

Sin las dos claves el captcha queda apagado.

## Publicar en Internet con Tailscale Funnel (alternativa sin dominio)

```bash
sudo tailscale funnel --bg 8080     # https://dev-web.<tu-tailnet>.ts.net -> Nginx :8080
tailscale funnel status
sudo tailscale funnel reset         # dejar de publicar
```

Con Funnel no se pueden enviar correos desde un dominio propio: para el registro con
confirmación conviene Cloudflare Tunnel + Brevo.

La API limita el login (10 intentos fallidos / 15 min por IP), el registro (5 / hora por IP) y
los correos de confirmación y recuperación (3 / hora por IP).

## Notas

- Las variables `VITE_*` se compilan dentro del bundle: si cambias `VITE_GOOGLE_MAPS_API_KEY`
  o `VITE_TURNSTILE_SITE_KEY` hay que reconstruir (`docker compose up -d --build`).
- Las fotos de los pasaportes se guardan en PostgreSQL (tabla `UserPhoto`, ~30 KB cada una):
  entran en los backups de la base.
- Street View: en Google Cloud, agrega `http://192.168.100.202:8080/*` y `http://dev-web:8080/*`
  a las restricciones de referente HTTP de la API key.
- Ver la base con DBeaver: base `roampass`, usuario `roampass` (o `bautista`).
