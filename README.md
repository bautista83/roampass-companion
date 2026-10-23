# RoamPass: Travel, Guess & Explore — Companion App

"Director de Juego Digital" del juego de mesa físico RoamPass. El tablero, los dados y los peones
son físicos; la web gestiona usuarios, hace de mazo de tarjetas interactivas y calcula el puntaje en
tiempo real.

## Arquitectura

Monorepo con npm workspaces:

```
shared/   @roampass/shared  Motor de juego puro en TS (sin dependencias)
  src/geo.ts                Fórmula Haversine
  src/scoring.ts            Puntaje por carta (tramos de LUGAR, quiz, eventos)
  src/engine.ts             Turnos, rondas, condición de victoria, ranking/podio
  src/deck.ts               Robo de cartas sin repetición, mezcla, URL de FlagCDN
  src/countries.ts          Generador de preguntas de banderas y capitales con 3 niveles
  data/seedData.json        183 cartas escritas a mano (42 lugares con foto + 40 con Street View, 23 historia, 38 personalidades, 18 eventos, banderas y ciudades)
  data/countries.json       194 países (ONU + Vaticano): nombre, capital, región, popularidad, banderas parecidas, ciudades trampa
  scripts/check-streetview.mjs  Valida y ajusta las coordenadas de Street View
  test/                     Vitest (27 tests)
client/   @roampass/client  React 19 + Vite + Tailwind v4 + Framer Motion + Zustand + react-leaflet
server/   @roampass/server  Express 5 + Prisma 6 + PostgreSQL + JWT
```

El cliente y el servidor usan **el mismo motor** (`@roampass/shared`), así las reglas viven en un
solo lugar.

### Componentes React (`client/src/components`)

| Componente | Función |
| --- | --- |
| `auth/Login` | Login / registro (roles `ADMIN` y `PLAYER`) |
| `dashboard/Dashboard` | Métricas (partidas, victorias, récord), crear/continuar partida |
| `dashboard/UserManagement` | CRUD de usuarios para ADMIN: activar/desactivar, rol, renombrar, cambiar contraseña, eliminar |
| `setup/GameSetup` | Wizard: paso 1 condición de victoria y tiempo por carta, paso 2 jugadores (2-4, color de peón, avatar) |
| `game/GameTable` | Mesa: layout responsive de 1 columna (móvil) / 35%-65% (tablet) |
| `game/TurnBanner` | Turno y ronda actual (sticky en móvil) |
| `game/Scoreboard` | Marcador en tiempo real con barras de progreso |
| `game/CardGrid` | Mazo de 6 tarjetas (2x3 en móvil, 3x2 en tablet) |
| `game/QuizModal` | Bandera, Capitales y Ciudades, Historia, Personalidades |
| `game/LocationCardModal` | Foto panorámica + mapa Leaflet/OpenStreetMap + distancia Haversine |
| `game/TravelEventModal` | Eventos de viajero (± puntos sin pregunta) |
| `game/VictoryScreen` | "¡Victoria!": podio y estadísticas |

### Reglas implementadas

- **LUGAR:** d ≤ 100 km → 1000 · d ≤ 500 km → 500 · d ≤ 2000 km → 200 · más → 0.
- **BANDERA** +400 · **CIUDADES** +300 · **HISTORIA** +500 · **PERSONALIDADES** +400 · error = 0.
- **Dificultad (mixta con bonus):** cada carta es Fácil (×1), Normal (×1,25) o Difícil (×1,5) y el
  multiplicador se aplica a los puntos de arriba. Los eventos de viajero no se multiplican.
- **EVENTO:** suma o resta directa (ej. Visa Denegada −300, Voucher de Vuelo +500).
- El marcador **nunca baja de 0**; el historial guarda el delta efectivamente aplicado.
- **Límite de puntos (3.000/5.000/10.000):** termina en cuanto alguien llega a la meta.
- **Número de rondas (10/15/20):** termina cuando el último jugador completa la ronda final.
- Desempate: más aciertos. Si persiste, comparten posición.
- **Ninguna carta se repite dentro de una partida.** Cada tarjeta muestra cuántas quedan; si una
  categoría se agota, queda marcada como «Agotada» y el jugador elige otra.
- Una carta abierta no se puede cerrar sin responder, y sobrevive a un refresco del navegador.
- **Timer por carta:** se elige en el wizard de cada partida: 10, 15, 20, 25 o 30 segundos (por
  defecto 10). Al agotarse, la carta cuenta como error (0 pts); en LUGAR, si ya se marcó un punto, se
  envía ese punto. El reloj no se reinicia al refrescar. Los eventos de viajero no tienen timer.

## Puesta en marcha

Requisitos: Node 20+ (probado con Node 24).

```bash
npm install
```

### Opción A — Modo demo (sin backend)

```bash
npm run dev
```

Abrir http://localhost:5173. Sin `VITE_API_URL`, la app guarda usuarios y partidas en
`localStorage` y usa el mazo de `shared/data/seedData.json`. Admin de prueba: `admin` / `roampass`.
Este modo es solo para probar en un dispositivo: **no es seguro para datos reales**.

### Opción B — Con backend y PostgreSQL

```bash
docker compose up -d
cp .env.example .env
npm run db:migrate -w server
npm run db:seed -w server
npm run dev:server
npm run dev
```

Edita el `.env` antes de sembrar: pon `VITE_API_URL=http://localhost:4000/api`, un `JWT_SECRET`
aleatorio y la `ADMIN_PASSWORD` del admin inicial.

### Configuración: un solo `.env` en la raíz

Toda la configuración (cliente, servidor, base de datos, Prisma y scripts) se lee del archivo `.env`
de la raíz del proyecto; la plantilla comentada es `.env.example`. El `.env` no se sube a git.
Vite solo expone al navegador las variables que empiezan con `VITE_`: los secretos del servidor del
mismo archivo nunca llegan al bundle del cliente.

### Street View (opcional)

Con una API key de Google, la carta **LUGAR** muestra una vista 360° interactiva estilo GeoGuessr
(Maps Embed API, gratis y sin límite de uso) sobre 40 calles y caminos poco obvios. Sin clave, LUGAR
usa las fotos de lugares conocidos. Los dos mazos nunca se mezclan.

1. En Google Cloud Console habilita **Maps Embed API** (para el juego) y **Street View Static API**
   (para el script de validación) y crea una API key.
2. Pégala en el `.env` de la raíz:
   ```
   VITE_GOOGLE_MAPS_API_KEY=tu_clave
   ```
3. Valida las coordenadas y ajústalas al panorama real más cercano (el iframe solo busca imagen en
   un radio de 50 m). Usa la Street View Image Metadata API, que no consume cuota:
   ```bash
   npm run streetview:check -- --fix
   ```
4. Reinicia `npm run dev` (Vite lee las variables al arrancar) y crea una partida nueva.

Si restringes la clave por dominio (recomendado: `http://localhost:5173/*` y tu dominio de producción),
el script no podrá usarla porque corre fuera del navegador. En ese caso pásale otra clave sin esa
restricción: `GOOGLE_MAPS_API_KEY=otra_clave npm run streetview:check -- --fix`.

### Scripts útiles

```bash
npm test                  # tests del motor (Vitest)
npm run typecheck         # TypeScript en los 3 paquetes
npm run build             # build de producción del cliente
npm run streetview:check  # valida las coordenadas de Street View (requiere API key)
```

## API (`/api`)

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | público |
| GET | `/auth/me` | autenticado |
| GET/POST | `/users` | ADMIN |
| PATCH/DELETE | `/users/:id` | ADMIN (no puede desactivarse ni borrarse a sí mismo) |
| GET | `/cards` | autenticado |
| PUT | `/games/:id` | autenticado (upsert idempotente del estado de la partida) |
| GET | `/games/active` | autenticado (reanudar en otro dispositivo) |
| GET | `/games/stats/me` | autenticado |

Desactivar un usuario corta su acceso de inmediato: el middleware recarga la cuenta en cada request.

## Decisiones y notas

- **Offline-first:** la partida vive en el dispositivo (Zustand + `localStorage`) y se sincroniza
  con el servidor después de cada turno. Si el servidor se cae, se sigue jugando y se avisa en pantalla.
- **Puntuación en el cliente:** el servidor valida la estructura y la configuración, pero confía en
  el puntaje porque la mesa es física y presencial. Si en el futuro hubiera partidas remotas
  competitivas, habría que mover `applyTurn` al servidor (el motor ya es compartido).
- **Banderas y capitales generadas:** la API v3.1 de RestCountries fue dada de baja y la v5 exige
  API key, así que no se usa. En su lugar, `countries.json` es una instantánea de Wikidata incluida
  en el repo, y `generateCountryCards` crea ~355 preguntas en el cliente (sin red, deterministas).
  El nivel sale de la popularidad del país y define las opciones: Fácil usa países conocidos del
  mismo continente; Normal y Difícil usan banderas casi idénticas (Rumania/Chad, Italia/Irlanda/México)
  y ciudades trampa (Sídney para Australia, Lagos para Nigeria). Un país famoso con trampas sube de nivel.
  Estas cartas no se guardan en `CardQuestion`; FlagCDN sigue funcionando sin clave.
- **Imágenes:** fotos de Wikimedia Commons (dominio público o CC BY/BY-SA). Cada carta guarda autor y
  licencia, y se muestran sobre la imagen como exige la licencia.
- **Récord personal:** en el wizard se marca qué peón es el usuario logueado ("Este peón soy yo").
  Los demás jugadores son invitados sin cuenta.
