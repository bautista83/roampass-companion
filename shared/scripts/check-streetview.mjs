// Valida que cada carta de LUGAR con Street View tenga imagen cerca, usando la Street View Image
// Metadata API (gratis: no consume cuota). Con --fix mueve la coordenada al panorama real mas
// cercano, porque el iframe de la Embed API solo busca imagen en un radio de 50 m.
//
//   npm run streetview:check            → solo informa
//   npm run streetview:check -- --fix   → ademas corrige shared/data/seedData.json
//
// La clave se lee de GOOGLE_MAPS_API_KEY o de VITE_GOOGLE_MAPS_API_KEY en el .env de la raiz.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const seedPath = `${root}shared/data/seedData.json`;
const envPath = `${root}.env`;
const fix = process.argv.includes('--fix');
/** Diferencias menores (redondeo de decimales) no se consideran un ajuste. */
const TOLERANCE_M = 5;
/** Hasta donde se busca un panorama alrededor de la coordenada original. */
const SEARCH_RADIUS_M = 1000;

function readKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY;
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('VITE_GOOGLE_MAPS_API_KEY='));
  return line?.slice('VITE_GOOGLE_MAPS_API_KEY='.length).trim().replace(/^["']|["']$/g, '') || null;
}

const key = readKey();
if (!key) {
  console.error('Falta la API key: define VITE_GOOGLE_MAPS_API_KEY en el .env de la raiz');
  process.exit(1);
}

const toRad = (d) => (d * Math.PI) / 180;
const distanceM = (a, b) => {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const cards = seed.cards.filter((c) => c.category === 'LOCATION' && !c.imageUrl);
let ok = 0;
let moved = 0;
const missing = [];

for (const card of cards) {
  const params = new URLSearchParams({
    location: `${card.location.lat},${card.location.lng}`,
    radius: String(SEARCH_RADIUS_M),
    source: 'outdoor',
    key,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params}`);
  const meta = await res.json();

  if (meta.status === 'REQUEST_DENIED') {
    // No se imprime la URL para no exponer la clave.
    console.error(`REQUEST_DENIED: ${meta.error_message ?? 'revisa que la clave tenga habilitada la Street View Static API'}`);
    process.exit(1);
  }
  if (meta.status !== 'OK') {
    missing.push(card.id);
    console.log(`✗ ${card.id.padEnd(24)} ${meta.status} — sin Street View a menos de ${SEARCH_RADIUS_M} m`);
    continue;
  }

  ok++;
  const snapped = { lat: +meta.location.lat.toFixed(6), lng: +meta.location.lng.toFixed(6) };
  const d = distanceM(card.location, snapped);
  const year = meta.date ? ` (${meta.date})` : '';
  if (d > TOLERANCE_M) {
    moved++;
    console.log(`${fix ? '↪' : '•'} ${card.id.padEnd(24)} panorama a ${Math.round(d)} m${year}`);
    if (fix) card.location = snapped;
  } else {
    console.log(`✓ ${card.id.padEnd(24)} exacto${year}`);
  }
}

console.log(`\n${ok}/${cards.length} con Street View · ${moved} ${fix ? 'ajustadas' : 'por ajustar'} · ${missing.length} sin imagen`);
if (missing.length) console.log(`Sin imagen (revisar o reemplazar): ${missing.join(', ')}`);
if (fix && moved) {
  writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n');
  console.log('seedData.json actualizado. Si usas backend, vuelve a correr: npm run db:seed -w server');
} else if (!fix && moved) {
  console.log('Ejecuta con --fix para mover esas coordenadas al panorama real.');
}
process.exitCode = missing.length ? 1 : 0;
