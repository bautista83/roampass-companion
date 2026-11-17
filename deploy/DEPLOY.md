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

## Publicar en Internet con Tailscale Funnel

```bash
sudo tailscale funnel --bg 8080     # https://dev-web.<tu-tailnet>.ts.net -> Nginx :8080
tailscale funnel status
sudo tailscale funnel reset         # dejar de publicar
```

La API limita el login (10 intentos fallidos / 15 min por IP) y el registro (5 / hora por IP).

## Notas

- Las variables `VITE_*` se compilan dentro del bundle: si cambias `VITE_GOOGLE_MAPS_API_KEY`
  hay que reconstruir (`docker compose up -d --build`).
- Street View: en Google Cloud, agrega `http://192.168.100.202:8080/*` y `http://dev-web:8080/*`
  a las restricciones de referente HTTP de la API key.
- Ver la base con DBeaver: base `roampass`, usuario `roampass` (o `bautista`).
