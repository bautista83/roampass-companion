import type { ReactNode } from 'react';
import { PAWN_COLOR_META, type PawnColor } from '@roampass/shared';
import { useThemeStore } from '../../store/themeStore';

/**
 * Ficha del jugador: un pin de mapa con el color del peon y el avatar dibujado adentro.
 * En el tema Comic es un sticker (contorno negro y sombra dura, como las casillas del tablero);
 * en el modo 80s es un sprite pixelado con borde neon, como el tablero retro.
 * El avatar se guarda como emoji (partidas viejas siguen funcionando): aca se cambia por su dibujo.
 */

const INK = { stroke: '#111111', strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Iconos vectoriales (caja de 24x24) en el estilo del tablero. */
const VECTOR: Record<string, ReactNode> = {
  '🧭': (
    <>
      <circle cx="12" cy="12" r="9" fill="#ffd43b" {...INK} />
      <circle cx="12" cy="12" r="6.3" fill="#ffffff" {...INK} strokeWidth={1.4} />
      <path d="M12 5.8 L14.4 12 L9.6 12 Z" fill="#ff5a5a" {...INK} strokeWidth={1.3} />
      <path d="M12 18.2 L14.4 12 L9.6 12 Z" fill="#7ec4f5" {...INK} strokeWidth={1.3} />
      <circle cx="12" cy="12" r="1.2" fill="#111111" />
    </>
  ),
  '🎒': (
    <>
      <path d="M9 6 Q12 1.5 15 6" fill="none" {...INK} />
      <rect x="5" y="5.5" width="14" height="15.5" rx="4.5" fill="#6bcf8b" {...INK} />
      <path d="M5.3 10.5 Q12 14 18.7 10.5" fill="none" {...INK} />
      <rect x="8" y="13.5" width="8" height="5.5" rx="2" fill="#ffd43b" {...INK} />
      <circle cx="12" cy="12.4" r="1" fill="#111111" />
    </>
  ),
  '🗺️': (
    <>
      <path d="M2.5 6 L8.5 4 L15.5 6 L21.5 4 L21.5 18 L15.5 20 L8.5 18 L2.5 20 Z" fill="#fff0a8" {...INK} />
      <path d="M8.5 4 L15.5 6 L15.5 20 L8.5 18 Z" fill="#bfe8c6" {...INK} />
      <path d="M5 16 Q8 9 12 12.5 T18 8.5" fill="none" stroke="#ff5a5a" strokeWidth="1.7" strokeDasharray="2 1.8" strokeLinecap="round" />
      <path d="M17 6.8 L19.6 9.4 M19.6 6.8 L17 9.4" fill="none" {...INK} stroke="#e5484d" strokeWidth={1.8} />
    </>
  ),
  '📸': (
    <>
      <path d="M8 8.5 L9.6 5.2 L14.4 5.2 L16 8.5" fill="#c7b3ff" {...INK} />
      <rect x="2.5" y="8" width="19" height="12.5" rx="3" fill="#7ec4f5" {...INK} />
      <circle cx="12" cy="14.2" r="4.4" fill="#ffffff" {...INK} />
      <circle cx="12" cy="14.2" r="2" fill="#c7b3ff" {...INK} strokeWidth={1.2} />
      <circle cx="18.2" cy="10.8" r="1.1" fill="#ffd43b" stroke="#111111" strokeWidth="0.9" />
    </>
  ),
  '🏕️': (
    <>
      <path d="M12 5 L12 1.8 L15.5 2.9 L12 4" fill="#ff5a5a" {...INK} strokeWidth={1.2} />
      <path d="M2 20.5 L12 5 L22 20.5 Z" fill="#ff8a6b" {...INK} />
      <path d="M12 9.5 L8 20.5 L16 20.5 Z" fill="#ffd43b" {...INK} />
      <path d="M12 9.5 L12 20.5" fill="none" {...INK} strokeWidth={1.2} />
    </>
  ),
  '🚂': (
    <>
      <circle cx="7.5" cy="2.8" r="1.6" fill="#ffffff" {...INK} strokeWidth={1.1} />
      <rect x="6" y="4.5" width="3.2" height="4" fill="#ffd43b" {...INK} strokeWidth={1.4} />
      <rect x="3" y="8.3" width="12.5" height="9" rx="1.6" fill="#ff5a5a" {...INK} />
      <rect x="13.5" y="5" width="7.5" height="12.3" rx="1.4" fill="#ff5a5a" {...INK} />
      <rect x="15.3" y="7" width="3.8" height="3.6" rx="0.6" fill="#ffffff" {...INK} strokeWidth={1.3} />
      <circle cx="7.5" cy="18.6" r="2.6" fill="#ffffff" {...INK} />
      <circle cx="16.3" cy="18.6" r="2.6" fill="#ffffff" {...INK} />
    </>
  ),
  '⛵': (
    <>
      <path d="M12 3 L12 15" fill="none" {...INK} />
      <path d="M12.8 3.8 L19.5 13.5 L12.8 13.5 Z" fill="#ffffff" {...INK} />
      <path d="M11.2 6 L5.5 13.5 L11.2 13.5 Z" fill="#ffd43b" {...INK} />
      <path d="M2.8 15 L21.2 15 L18 20 L6 20 Z" fill="#7ec4f5" {...INK} />
      <path d="M1.5 22.3 q2.6 -1.6 5.2 0 t5.2 0 t5.2 0 t5.2 0" fill="none" stroke="#3a8fd0" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  '🐪': (
    <>
      <path d="M6 16 L6 21.5 M9 16 L9 21.5 M13.5 16 L13.5 21.5 M16 16 L16 21.5" fill="none" {...INK} />
      <path
        d="M3.5 15.5 Q3.5 10 7.2 10 Q8.6 5.8 10.6 9.6 Q12.4 5.8 14.2 9.8 Q16.6 10.4 16.8 12.6 L18.2 7.6 Q18.4 5.6 20.4 5.8 L22 7 L20.6 8.6 L19.2 14.4 Q18.2 16.6 15.6 16.6 L5.5 16.6 Q3.5 16.6 3.5 15.5 Z"
        fill="#e0ac69"
        {...INK}
      />
      <circle cx="20" cy="7.2" r="0.7" fill="#111111" />
    </>
  ),
};

/** Mismos avatares en 7x7 pixeles para el modo 80s. */
const PIXEL: Record<string, string[]> = {
  '🧭': ['.yyyyy.', 'y..r..y', 'y..r..y', 'y.rwr.y', 'y..c..y', 'y..c..y', '.yyyyy.'],
  '🎒': ['..ggg..', '..g.g..', '.ggggg.', '.gyyyg.', '.ggggg.', '.gyyyg.', '.ggggg.'],
  '🗺️': ['mmccmm.', 'mmccmmc', 'mrccmmc', 'mmrrmmc', 'mmccrmc', 'mmccmrc', '.mccmmx'],
  '📸': ['.......', '.ll....', 'ccccccc', 'cc.w.cc', 'c.www.c', 'cc.w.cc', 'ccccccc'],
  '🏕️': ['...r...', '...o...', '..ooo..', '.oo.oo.', '.o.y.o.', 'oo.y.oo', 'ooooooo'],
  '🚂': ['.w.....', 'yy..rrr', 'yy..rwr', 'rrrrrrr', 'rrrrrrr', '.w..w..', '.......'],
  '⛵': ['...w...', '..yww..', '.yywww.', 'yyywwww', '...w...', 'ccccccc', '.ccccc.'],
  '🐪': ['.......', '.o.o..o', 'ooooo.o', 'ooooooo', 'o.o.o..', 'o.o.o..', '.......'],
};
const PIXEL_HEX: Record<string, string> = {
  y: '#ffd23f',
  r: '#ff3864',
  w: '#fbe9ff',
  c: '#3ef2ff',
  g: '#2de2a6',
  m: '#2de2a6',
  l: '#b388ff',
  o: '#ff9f1c',
  x: '#ff3864',
};

/** Pin pixelado de 13x16: # contorno, o color del jugador, w disco del avatar. */
const PIN = [
  '....#####....',
  '..##ooooo##..',
  '.#ooooooooo#.',
  '#oowwwwwwwoo#',
  '#oowwwwwwwoo#',
  '#oowwwwwwwoo#',
  '#oowwwwwwwoo#',
  '#oowwwwwwwoo#',
  '#oowwwwwwwoo#',
  '#oowwwwwwwoo#',
  '.#ooooooooo#.',
  '..#ooooooo#..',
  '...#ooooo#...',
  '....#ooo#....',
  '.....#o#.....',
  '......#......',
];

/** Solo el avatar dibujado (sin pin), para listas y textos. */
export function AvatarIcon({ avatar, className = '' }: { avatar: string; className?: string }) {
  const retro = useThemeStore((s) => s.retro);
  if (retro && PIXEL[avatar]) {
    return (
      <svg viewBox="0 0 7 7" className={className} shapeRendering="crispEdges" role="img" aria-label={`Avatar ${avatar}`}>
        {pixels(PIXEL[avatar]!, 0, 0)}
      </svg>
    );
  }
  if (VECTOR[avatar]) {
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={`Avatar ${avatar}`}>
        {VECTOR[avatar]}
      </svg>
    );
  }
  return <span className={className}>{avatar}</span>;
}

function pixels(rows: string[], ox: number, oy: number, colors: Record<string, string> = PIXEL_HEX) {
  return rows.flatMap((row, y) =>
    [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}-${y}`} x={ox + x} y={oy + y} width="1.02" height="1.02" fill={colors[ch]} /> : null)),
  );
}

/**
 * Pin del jugador. `className` define el ancho (el alto sale de la proporcion del pin).
 * La punta queda abajo al centro: para apoyarla sobre una casilla, trasladar -50% / -100%.
 */
export function PawnToken({ avatar, color, className = '', title }: { avatar: string; color: PawnColor; className?: string; title?: string }) {
  const retro = useThemeStore((s) => s.retro);
  const hex = PAWN_COLOR_META[color].hex;

  if (retro) {
    return (
      <svg
        viewBox="-1 -1 15 18"
        className={className}
        shapeRendering="crispEdges"
        role="img"
        aria-label={title ?? `Ficha ${avatar}`}
        style={{ filter: `drop-shadow(0 0 0.15em ${hex}) drop-shadow(0.12em 0.12em 0 #3ef2ff)` }}
      >
        {title && <title>{title}</title>}
        {pixels(PIN, 0, 0, { '#': '#ff2bd6', o: hex, w: '#12021f' })}
        {/* brillo pixelado */}
        <rect x="3" y="1.9" width="2" height="1" fill="#ffffff" opacity="0.7" />
        {PIXEL[avatar] ? (
          pixels(PIXEL[avatar]!, 3, 3)
        ) : (
          <text x="6.5" y="8" fontSize="6" textAnchor="middle" dominantBaseline="middle">
            {avatar}
          </text>
        )}
      </svg>
    );
  }

  const pin = 'M20 50 C14 40 4 32.5 4 20 A16 16 0 0 1 36 20 C36 32.5 26 40 20 50 Z';
  return (
    <svg viewBox="0 0 42 54" className={className} role="img" aria-label={title ?? `Ficha ${avatar}`}>
      {title && <title>{title}</title>}
      <ellipse cx="21" cy="51" rx="6" ry="2" fill="#111111" opacity="0.25" />
      <path d={pin} transform="translate(2.6 2.4)" fill="#111111" />
      <path d={pin} fill={hex} stroke="#111111" strokeWidth="3" strokeLinejoin="round" />
      <path d="M9.5 13 A12 12 0 0 1 17 7.5" fill="none" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="20" r="11.6" fill="#ffffff" stroke="#111111" strokeWidth="2.6" />
      {VECTOR[avatar] ? (
        <g transform="translate(10.6 10.6) scale(0.783)">{VECTOR[avatar]}</g>
      ) : (
        <text x="20" y="21" fontSize="13" textAnchor="middle" dominantBaseline="middle">
          {avatar}
        </text>
      )}
    </svg>
  );
}
