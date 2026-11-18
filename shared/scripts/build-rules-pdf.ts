// Genera el PDF de reglas para imprimir junto al tablero (A4, 2 paginas).
// Los textos y numeros salen de shared/src/rules.ts (las constantes del motor): si cambia un puntaje,
// se vuelve a correr este script y el PDF queda al dia.
//
//   npm run rules:pdf                 (español, el idioma por defecto)
//   npm run rules:pdf -- --lang=en    (otro idioma: reglas-roamle-A4.en.pdf)
//
// Arma un HTML y lo imprime con Chrome o Edge en modo headless (no agrega dependencias).
// Si el navegador no se encuentra solo, indicar la ruta en CHROME_PATH.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AVATARS,
  BOARD_SPACES,
  MILES_PER_SPACE,
  DEFAULT_LOCALE,
  MAX_PLAYERS,
  PAWN_COLORS,
  PAWN_COLOR_META,
  WORLD_TOUR_MILES,
  buildRules,
  formatMiles,
  formatNumber,
  localizeCard,
  resolveLocale,
  type Locale,
  type RulesSectionId,
  type SeedData,
} from '../src/index';
import { CATEGORY_HEX } from '../../client/src/components/game/categoryStyle';

const root = fileURLToPath(new URL('../../', import.meta.url));
const locale: Locale = resolveLocale(process.argv.find((a) => a.startsWith('--lang='))?.slice(7));
const OUTPUT = join(root, `art/worldmap/print/reglas-roamle-A4${locale === DEFAULT_LOCALE ? '' : `.${locale}`}.pdf`);

/** Textos propios del PDF (el resto sale de las reglas compartidas, shared/src/locales). */
interface PdfTexts {
  title: string;
  subtitle: string;
  worldTour: string;
  spaces: string;
  oneSpace: string;
  fullTour: string;
  physicalBoard: string;
  card: string;
  locationTitle: string;
  upTo: string;
  fromTo: (from: string) => string;
  bonusNote: string;
  page: (n: number, total: number) => string;
  footerNote: string;
}
const PDF_TEXTS: Record<Locale, PdfTexts> = {
  es: {
    title: 'Reglas del juego',
    subtitle: 'Viaja, adivina y explora',
    worldTour: 'La vuelta al mundo',
    spaces: 'casillas',
    oneSpace: '1 casilla',
    fullTour: 'vuelta completa',
    physicalBoard: 'Con el tablero impreso',
    card: 'Carta',
    locationTitle: 'Lugar: ¿a qué distancia marcaste?',
    upTo: 'hasta',
    fromTo: (from) => `${from} a`,
    bonusNote: 'Más el bonus del nivel de la carta.',
    page: (n, total) => `Página ${n} de ${total}`,
    footerNote: 'Los puntajes de este reglamento salen del código del juego (npm run rules:pdf).',
  },
};
const T = PDF_TEXTS[locale];
const rules = buildRules(locale);
const asset = (path: string) => pathToFileURL(join(root, 'client/public', path)).href;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mi = (n: number) => formatMiles(n, locale);
const num = (n: number) => formatNumber(n, locale);
const section = (id: RulesSectionId) => rules.sections.find((s) => s.id === id)!;

// ── Piezas dibujadas igual que en la app ─────────────────────────────────────

/** Mismos puntos que DieFace (client/src/components/game/Die.tsx). */
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function dieFace(face: number, size = 34) {
  const category = rules.die[face - 1]!.category;
  const pips = PIPS[face]!.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${face === 1 ? 11 : 9}" fill="#111"/>`).join('');
  return `<svg viewBox="0 0 108 108" width="${size}" height="${size}"><rect x="10" y="10" width="94" height="94" rx="22" fill="#111"/><rect x="3" y="3" width="94" height="94" rx="22" fill="${CATEGORY_HEX[category]}" stroke="#111" stroke-width="5"/>${pips}</svg>`;
}

/** Pin de jugador (mismo trazo que PawnToken). */
function pawn(color: (typeof PAWN_COLORS)[number], avatar: string, width = 26) {
  const pin = 'M20 50 C14 40 4 32.5 4 20 A16 16 0 0 1 36 20 C36 32.5 26 40 20 50 Z';
  const hex = PAWN_COLOR_META[color].hex;
  return `<svg viewBox="0 0 42 54" width="${width}"><path d="${pin}" transform="translate(2.6 2.4)" fill="#111"/><path d="${pin}" fill="${hex}" stroke="#111" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="20" r="11" fill="#fff" stroke="#111" stroke-width="2.5"/><text x="20" y="21" font-size="13" text-anchor="middle" dominant-baseline="middle">${avatar}</text></svg>`;
}

const bullets = (items: string[], numbered = false) =>
  `<ul class="${numbered ? 'steps' : 'dots'}">${items.map((p, i) => `<li><span class="mark">${numbered ? i + 1 : ''}</span><span>${esc(p)}</span></li>`).join('')}</ul>`;

function block(id: RulesSectionId, numbered = false, extra = '') {
  const s = section(id);
  const n = rules.sections.indexOf(s) + 1;
  return `<section class="block">
    <h2><span class="num">${n}</span>${s.icon} ${esc(s.title)}</h2>
    <p class="summary">${esc(s.summary)}</p>
    ${bullets(s.points, numbered)}
    ${extra}
  </section>`;
}

/** Bloque con un dibujo al costado del texto (ahorra alto). */
function blockWithSide(id: RulesSectionId, side: string) {
  const s = section(id);
  const n = rules.sections.indexOf(s) + 1;
  return `<section class="block side">
    <div>
      <h2><span class="num">${n}</span>${s.icon} ${esc(s.title)}</h2>
      <p class="summary">${esc(s.summary)}</p>
      ${bullets(s.points)}
    </div>
    ${side}
  </section>`;
}

// ── Contenido ───────────────────────────────────────────────────────────────

const events = (readJson('shared/data/seedData.json') as SeedData).cards.flatMap((c) =>
  c.category === 'TRAVEL_EVENT' ? [localizeCard(c, locale)] : [],
);
const eventExamples = [
  ...events.filter((e) => e.points > 0).slice(0, 1),
  ...events.filter((e) => e.points < 0).slice(0, 1),
];

function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

const dieTable = `<div class="die-grid">${rules.die.map(
  (d) => `<div class="die-cell" style="background:${CATEGORY_HEX[d.category]}">${dieFace(d.face, 30)}<span>${d.icon} ${esc(d.label)}</span></div>`,
).join('')}</div>`;

const physicalBox = `<div class="box physical">
  <h3>🗺️ ${esc(T.physicalBoard)}</h3>
  <div class="two-cols">${bullets(rules.physicalBoard)}</div>
</div>`;

const quizTable = `<table class="miles">
  <thead><tr><th>${esc(T.card)}</th>${rules.difficulties.map((d) => `<th><span class="pill diff-${d.difficulty}">${esc(d.label)}</span></th>`).join('')}</tr></thead>
  <tbody>${rules.quizPoints.map(
    (q) =>
      `<tr><td class="cat" style="background:${CATEGORY_HEX[q.category]}">${q.icon} ${esc(q.label)}</td>${rules.difficulties.map(
        (d) => `<td>+${num(q.byDifficulty[d.difficulty])}</td>`,
      ).join('')}</tr>`,
  ).join('')}</tbody>
</table>`;

const maxBracket = rules.locationBrackets[0]!.points;
const locationBox = `<div class="box location" style="background:${CATEGORY_HEX.LOCATION}">
  <h3>📍 ${esc(T.locationTitle)}</h3>
  ${rules.locationBrackets.map(
    (b, i) =>
      `<div class="bracket"><span class="km">${i === 0 ? esc(T.upTo) : esc(T.fromTo(num(b.fromKm)))} ${num(b.maxKm)} km</span><span class="bar" style="width:${(b.points / maxBracket) * 46}%"></span><b>+${num(b.points)}</b></div>`,
  ).join('')}
  <p class="small">${esc(T.bonusNote)}</p>
</div>`;

const eventsBox = `<div class="events">${eventExamples
  .map(
    (e) =>
      `<div class="event"><span class="ico">${e.icon}</span><span><b>${esc(e.title)}</b><span class="${e.points > 0 ? 'up' : 'down'}">${e.points > 0 ? '+' : '−'}${mi(Math.abs(e.points))}</span></span></div>`,
  )
  .join('')}</div>`;

const transports = `<div class="transports">${rules.transports.map(
  (t) => `<div class="transport"><img src="${asset(`board/spaces/${t.id}.svg`)}" alt=""/><span>${esc(t.name)}</span></div>`,
).join('')}</div>`;

const pawns = PAWN_COLORS.slice(0, MAX_PLAYERS)
  .map((c, i) => pawn(c, AVATARS[i]!))
  .join('');

const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"/>
<title>Roamle · ${esc(T.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #111; font-size: 10.2pt; line-height: 1.34;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; height: 297mm; padding: 11mm 13mm 10mm; position: relative; overflow: hidden; page-break-after: always; background: #fff; }
  .page:last-child { page-break-after: auto; }
  h1, h2, h3 { font-family: 'Dela Gothic One', 'Arial Black', sans-serif; font-weight: 400; margin: 0; }
  header { display: flex; align-items: center; gap: 4mm; border: 2.5px solid #111; border-radius: 6mm; padding: 3mm 5mm;
           background: #eaf2e6; box-shadow: 3px 3px 0 #111; margin-bottom: 5mm; }
  header img { width: 17mm; height: 17mm; }
  header h1 { font-size: 22pt; line-height: 1.05; }
  header p { margin: 1mm 0 0; font-weight: 700; color: #5a6357; }
  .meta { margin-left: auto; text-align: right; font-size: 9pt; font-weight: 700; }
  .meta .chip { display: inline-block; border: 2px solid #111; border-radius: 99px; padding: 0.6mm 3mm; background: #ffd43b; margin-top: 1mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .block { border: 2.5px solid #111; border-radius: 5mm; padding: 3.5mm 4.5mm; box-shadow: 3px 3px 0 #111; break-inside: avoid; }
  .block + .block { margin-top: 4mm; }
  h2 { font-size: 13.5pt; display: flex; align-items: center; gap: 2mm; margin-bottom: 1.5mm; }
  h3 { font-size: 10.5pt; margin-bottom: 1.5mm; }
  .num { display: inline-grid; place-items: center; width: 7mm; height: 7mm; border: 2px solid #111; border-radius: 99px;
         background: #ffd43b; font-family: Inter, sans-serif; font-weight: 800; font-size: 10pt; }
  .summary { margin: 0 0 2mm; font-weight: 700; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 2mm; margin: 0.9mm 0; }
  .mark { flex: none; display: inline-grid; place-items: center; width: 4.6mm; height: 4.6mm; margin-top: 0.3mm; border: 1.8px solid #111;
          border-radius: 99px; background: #ffd43b; font-size: 7.5pt; font-weight: 800; }
  .dots .mark::after { content: ''; width: 1.2mm; height: 1.2mm; border-radius: 99px; background: #111; }
  .box { border: 2px solid #111; border-radius: 4mm; padding: 3mm 3.5mm; margin-top: 3mm; break-inside: avoid; }
  .physical { background: #7ec4f5; margin-top: 4.5mm; box-shadow: 3px 3px 0 #111; }
  .two-cols ul { display: grid; grid-template-columns: 1fr 1fr; column-gap: 5mm; }
  .grid { align-items: start; }
  .block.side { display: flex; gap: 5mm; align-items: center; }
  .block.side > div:first-child { flex: 1; }
  .block.side .podium { margin-top: 0; flex: none; }
  .die-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin-top: 3mm; }
  .die-cell { display: flex; align-items: center; gap: 1.6mm; border: 2px solid #111; border-radius: 3mm; padding: 1.4mm 2mm;
              font-size: 8.6pt; font-weight: 800; line-height: 1.15; }
  .die-cell svg { flex: none; }
  .chips { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 2.5mm; align-items: center; }
  .chip { border: 2px solid #111; border-radius: 99px; padding: 0.6mm 3mm; font-weight: 800; font-size: 9pt; background: #fff; }
  .chip.sun { background: #ffd43b; }
  .pawns { display: flex; gap: 2.5mm; align-items: flex-end; margin-left: auto; }
  table.miles { width: 100%; border-collapse: separate; border-spacing: 0 1.4mm; margin-top: 2.5mm; font-size: 9.6pt; }
  table.miles th { font-size: 8pt; text-align: center; }
  table.miles th:first-child { text-align: left; text-transform: uppercase; letter-spacing: .08em; color: #5a6357; }
  table.miles td { border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 1mm 2mm; text-align: center; font-weight: 800; }
  table.miles td.cat { border-left: 2px solid #111; border-radius: 3mm 0 0 3mm; text-align: left; }
  table.miles td:last-child { border-right: 2px solid #111; border-radius: 0 3mm 3mm 0; }
  .pill { display: inline-block; border: 2px solid #111; border-radius: 99px; padding: 0.3mm 2.4mm; font-weight: 800; }
  .diff-EASY { background: #6bcf8b; } .diff-MEDIUM { background: #ffd43b; } .diff-HARD { background: #ff8a6b; }
  .bracket { display: flex; align-items: center; gap: 2.5mm; margin: 1.2mm 0; font-size: 9.6pt; }
  .bracket .km { width: 30mm; font-weight: 700; }
  .bracket .bar { height: 3.4mm; border: 2px solid #111; border-radius: 99px; background: #ffd43b; }
  .small { margin: 1.5mm 0 0; font-size: 8.4pt; font-weight: 700; }
  .events { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-top: 3mm; }
  .event { display: flex; gap: 2mm; align-items: center; border: 2px solid #111; border-radius: 3mm; padding: 1.5mm 2mm; font-size: 8.8pt; }
  .event .ico { font-size: 14pt; }
  .event b { display: block; }
  .up { color: #1e9e5a; font-weight: 800; } .down { color: #e5484d; font-weight: 800; }
  .transports { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1.5mm; margin-top: 3mm; text-align: center; }
  .transport img { width: 11mm; height: 11mm; display: block; margin: 0 auto 0.8mm; }
  .transport span { font-size: 7pt; font-weight: 700; line-height: 1.15; display: block; }
  .podium { display: flex; justify-content: center; align-items: flex-end; gap: 3mm; margin-top: 3mm; }
  .podium div { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
  .podium .step { width: 13mm; border: 2px solid #111; border-bottom: none; border-radius: 3mm 3mm 0 0; background: #ffd43b;
                  display: grid; place-items: center; font-family: 'Dela Gothic One', 'Arial Black', sans-serif; font-size: 14pt; }
  footer { position: absolute; left: 13mm; right: 13mm; bottom: 6mm; display: flex; justify-content: space-between;
           font-size: 7.5pt; color: #5a6357; font-weight: 600; }
</style></head>
<body>
  <div class="page">
    <header>
      <img src="${asset('logo.svg')}" alt=""/>
      <div><h1>Roamle</h1><p>${esc(T.title)} · ${esc(T.subtitle)}</p></div>
      <div class="meta">${esc(T.worldTour)}<br/><span class="chip">${BOARD_SPACES} ${esc(T.spaces)} = ${mi(WORLD_TOUR_MILES)}</span></div>
    </header>
    ${block(
      'goal',
      false,
      `<div class="chips"><span class="chip sun">${esc(T.oneSpace)} = ${mi(MILES_PER_SPACE)}</span><span class="chip">🌍 ${mi(WORLD_TOUR_MILES)} = ${esc(T.fullTour)}</span><span class="pawns">${pawns}</span></div>`,
    )}
    <div class="grid" style="margin-top:4.5mm">
      <div>${block('setup')}</div>
      <div>${block('turn', true, dieTable)}</div>
    </div>
    ${physicalBox}
    <footer><span>Roamle · ${esc(T.title)}</span><span>${esc(T.page(1, 2))}</span></footer>
  </div>

  <div class="page">
    ${block('cards', false, `<div class="grid">${quizTable}${locationBox}</div>`)}
    ${block('travel', false, `${eventsBox}${transports}`)}
    ${blockWithSide(
      'win',
      `<div class="podium">${[
        [2, PAWN_COLORS[1], AVATARS[1], 11],
        [1, PAWN_COLORS[0], AVATARS[0], 15],
        [3, PAWN_COLORS[2], AVATARS[2], 8],
      ]
        .map(([place, color, avatar, h]) => `<div>${pawn(color as (typeof PAWN_COLORS)[number], avatar as string, 22)}<span class="step" style="height:${h}mm">${place}</span></div>`)
        .join('')}</div>`,
    )}
    <footer><span>${esc(T.footerNote)}</span><span>${esc(T.page(2, 2))}</span></footer>
  </div>
</body></html>`;

// ── Imprimir con el navegador ───────────────────────────────────────────────

function findBrowser(): string {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No se encontró Chrome ni Edge. Indica la ruta con CHROME_PATH=/ruta/al/navegador');
  return found;
}

const work = join(tmpdir(), `roampass-rules-${Date.now()}`);
mkdirSync(work, { recursive: true });
const htmlPath = join(work, 'reglas.html');
writeFileSync(htmlPath, html, 'utf8');
mkdirSync(dirname(OUTPUT), { recursive: true });

execFileSync(
  findBrowser(),
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--allow-file-access-from-files',
    `--user-data-dir=${join(work, 'profile')}`,
    '--virtual-time-budget=8000',
    `--print-to-pdf=${OUTPUT}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: 'ignore' },
);
rmSync(work, { recursive: true, force: true });

if (!existsSync(OUTPUT)) throw new Error('El navegador no generó el PDF');
console.log(`✔ Reglas en PDF: ${OUTPUT.replace(root, '')}`);
