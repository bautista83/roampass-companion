// Genera las imagenes base del icono y la pantalla de inicio de la app (docs/specs/mobile-app.md)
// a partir de public/logo.svg. Despues `capacitor-assets generate` arma todos los tamanos para
// Android e iOS. Uso: npm run mobile:assets
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const BG = '#eaf2e6';
const svg = await readFile(new URL('../public/logo.svg', import.meta.url));
const out = (name) => new URL(`../assets/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
await mkdir(out(''), { recursive: true });

const logo = (size) => sharp(svg, { density: 1200 }).resize(size, size).png().toBuffer();
const canvas = (size, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } });

// Icono clasico (iOS y Android viejos): logo sobre el fondo de la marca.
await canvas(1024, BG).composite([{ input: await logo(800), gravity: 'center' }]).png().toFile(out('icon-only.png'));
// Icono adaptativo de Android: el sistema recorta un circulo/cuadrado, el logo va en la zona segura (~60%).
await canvas(1024, { r: 0, g: 0, b: 0, alpha: 0 }).composite([{ input: await logo(600), gravity: 'center' }]).png().toFile(out('icon-foreground.png'));
await canvas(1024, BG).png().toFile(out('icon-background.png'));
// Pantalla de inicio. Sin version oscura: el modo oscuro del sistema no tiene que ver con el
// estilo del perfil (Comic u 80s), asi que siempre se usa el fondo claro de la marca.
await canvas(2732, BG).composite([{ input: await logo(640), gravity: 'center' }]).png().toFile(out('splash.png'));

console.log('Imagenes base en client/assets/');
