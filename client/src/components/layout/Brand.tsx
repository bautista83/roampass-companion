export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* Logo: mapa sticker con pasaporte, avion, barco y tren (mismo estilo que el tablero) */}
      <img src="/logo.svg" alt="" aria-hidden className={`shrink-0 ${compact ? 'size-12' : 'size-20'}`} />
      <div className="leading-tight">
        <p className={`font-display ${compact ? 'text-xl' : 'text-4xl'}`}>RoamPass</p>
        <p className={`font-semibold text-passport-500 dark:text-passport-300 ${compact ? 'hidden text-xs sm:block' : 'text-sm'}`}>
          Travel, Guess &amp; Explore
        </p>
      </div>
    </div>
  );
}
