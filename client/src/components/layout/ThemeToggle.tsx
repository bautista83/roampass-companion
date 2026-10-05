import { useThemeStore } from '../../store/themeStore';

const META = {
  system: { icon: '🖥️', label: 'Tema del sistema' },
  light: { icon: '☀️', label: 'Tema claro' },
  dark: { icon: '🌙', label: 'Tema oscuro' },
} as const;

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const cycle = useThemeStore((s) => s.cycle);
  const { icon, label } = META[theme];
  return (
    <button className="btn-ghost size-12 px-0 text-lg" onClick={cycle} title={label} aria-label={`${label}. Cambiar tema`}>
      {icon}
    </button>
  );
}
