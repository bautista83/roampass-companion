/**
 * Retrato dibujado para la foto del pasaporte, en el estilo del tablero (borde negro, colores planos).
 * Es "aleatorio" pero estable: sale siempre igual para el mismo `seed` (el usuario).
 * Cuando los usuarios puedan subir su foto, este retrato queda como foto por defecto.
 */

const SKIN = ['#ffdbac', '#f9d7b5', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
const HAIR = ['#111111', '#3b2414', '#6b3e1f', '#b7772f', '#d9a441', '#c0392b', '#8a8a8a', '#7e57c2'];
const SHIRT = ['#ff8a6b', '#6bcf8b', '#7ec4f5', '#c7b3ff', '#ffd43b', '#ff5a5a'];
const BACKDROP = ['#cfe6fb', '#bfe8c6', '#fff0a8', '#e3d9ff', '#ffcdbd'];

/** Hash FNV-1a: numeros pseudoaleatorios estables a partir de un texto. */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, list: readonly T[]) => list[Math.floor(r() * list.length)]!;

export function AvatarPortrait({ seed, className = '' }: { seed: string; className?: string }) {
  const r = rng(seed.toLowerCase());
  const skin = pick(r, SKIN);
  const hair = pick(r, HAIR);
  const shirt = pick(r, SHIRT);
  const backdrop = pick(r, BACKDROP);
  const style = pick(r, ['short', 'long', 'curly', 'bun', 'spiky', 'bald'] as const);
  const glasses = r() < 0.35;
  const beard = style !== 'long' && r() < 0.3;
  const earrings = !beard && r() < 0.3;
  const smile = pick(r, ['smile', 'grin', 'calm'] as const);

  const ink = { stroke: '#111111', strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  return (
    <svg viewBox="0 0 100 124" className={className} role="img" aria-label="Foto del pasaporte">
      <rect x="0" y="0" width="100" height="124" fill={backdrop} />
      {/* trama de seguridad de la foto */}
      {[18, 38, 58, 78, 98].map((y) => (
        <path key={y} d={`M0 ${y} q12 -6 25 0 t25 0 t25 0 t25 0`} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" />
      ))}

      {/* pelo largo: va detras de la cara */}
      {style === 'long' && <path d="M24 56 Q20 22 50 21 Q80 22 76 56 L80 98 Q66 96 64 74 L36 74 Q34 96 20 98 Z" fill={hair} {...ink} />}
      {style === 'bun' && <circle cx="50" cy="17" r="10" fill={hair} {...ink} />}

      {/* hombros y cuello */}
      <path d="M12 124 Q14 94 36 90 L64 90 Q86 94 88 124 Z" fill={shirt} {...ink} />
      <path d="M42 80 L42 92 Q50 98 58 92 L58 80 Z" fill={skin} {...ink} />
      <path d="M40 90 L50 102 L60 90" fill="none" {...ink} />

      {/* cara y orejas */}
      <ellipse cx="27" cy="56" rx="5" ry="7" fill={skin} {...ink} />
      <ellipse cx="73" cy="56" rx="5" ry="7" fill={skin} {...ink} />
      {earrings && (
        <>
          <circle cx="27" cy="66" r="2.6" fill="#ffd43b" {...ink} strokeWidth={1.6} />
          <circle cx="73" cy="66" r="2.6" fill="#ffd43b" {...ink} strokeWidth={1.6} />
        </>
      )}
      <ellipse cx="50" cy="55" rx="23" ry="27" fill={skin} {...ink} />
      {beard && <path d="M28 58 Q30 84 50 85 Q70 84 72 58 Q66 72 50 72 Q34 72 28 58 Z" fill={hair} {...ink} />}

      {/* pelo de adelante */}
      {style === 'short' && <path d="M27 52 Q25 27 50 26 Q75 27 73 52 Q70 38 56 36 Q46 42 32 40 Q28 44 27 52 Z" fill={hair} {...ink} />}
      {style === 'long' && <path d="M27 52 Q27 28 50 27 Q73 28 73 52 Q66 38 50 37 Q34 38 27 52 Z" fill={hair} {...ink} />}
      {style === 'bun' && <path d="M27 50 Q27 27 50 27 Q73 27 73 50 Q64 36 50 36 Q36 36 27 50 Z" fill={hair} {...ink} />}
      {style === 'curly' &&
        [
          [30, 38],
          [38, 30],
          [50, 27],
          [62, 30],
          [70, 38],
          [26, 48],
          [74, 48],
        ].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" fill={hair} {...ink} />)}
      {style === 'spiky' && <path d="M27 48 L30 30 L36 38 L40 24 L46 35 L52 22 L56 35 L62 25 L64 38 L71 30 L73 48 Q62 40 50 40 Q38 40 27 48 Z" fill={hair} {...ink} />}
      {style === 'bald' && <path d="M34 36 Q40 31 46 33" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />}

      {/* cejas, ojos, nariz y boca */}
      <path d="M36 48 Q41 45 45 48 M55 48 Q59 45 64 48" fill="none" {...ink} />
      <circle cx="41" cy="55" r="2.8" fill="#111111" />
      <circle cx="59" cy="55" r="2.8" fill="#111111" />
      {glasses && (
        <g fill="#ffffff" fillOpacity="0.35" {...ink}>
          <circle cx="41" cy="55" r="7.5" />
          <circle cx="59" cy="55" r="7.5" />
          <path d="M48.5 55 L51.5 55" fill="none" />
        </g>
      )}
      <path d="M50 58 Q48 64 51 65" fill="none" {...ink} strokeWidth={2.2} />
      {smile === 'smile' && <path d="M42 69 Q50 76 58 69" fill="none" {...ink} />}
      {smile === 'grin' && <path d="M41 68 Q50 79 59 68 Z" fill="#ffffff" {...ink} />}
      {smile === 'calm' && <path d="M44 71 L56 71" fill="none" {...ink} />}
      <circle cx="35" cy="64" r="3.5" fill="#ff8a6b" fillOpacity="0.45" />
      <circle cx="65" cy="64" r="3.5" fill="#ff8a6b" fillOpacity="0.45" />
    </svg>
  );
}
