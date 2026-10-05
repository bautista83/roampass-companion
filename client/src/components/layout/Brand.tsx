export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid place-items-center rounded-xl bg-passport-800 text-brass shadow-inner ring-2 ring-brass/40 ${
          compact ? 'size-11 text-2xl' : 'size-16 text-4xl'
        }`}
        aria-hidden
      >
        🧭
      </div>
      <div className="leading-tight">
        <p className={`font-stamp tracking-widest ${compact ? 'text-xl' : 'text-4xl'}`}>RoamPass</p>
        <p className={`text-passport-500 dark:text-passport-300 ${compact ? 'hidden text-xs sm:block' : 'text-sm'}`}>
          Travel, Guess &amp; Explore
        </p>
      </div>
    </div>
  );
}
