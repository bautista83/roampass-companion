import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Temas: claro (estilo sticker del tablero) y 80s (synthwave pixelado, reemplaza al modo oscuro).
 * 'system' sigue al sistema operativo: oscuro → 80s.
 */
export type Theme = 'light' | 'retro' | 'system';

const media = window.matchMedia('(prefers-color-scheme: dark)');

const resolveRetro = (theme: Theme) => theme === 'retro' || (theme === 'system' && media.matches);

/** El modo 80s tambien activa `dark`, asi las variantes dark: de los componentes siguen aplicando. */
function apply(theme: Theme): boolean {
  const retro = resolveRetro(theme);
  document.documentElement.classList.toggle('dark', retro);
  document.documentElement.classList.toggle('retro', retro);
  return retro;
}

interface ThemeState {
  theme: Theme;
  /** Tema 80s activo (resuelto, incluido 'system'). */
  retro: boolean;
  cycle: () => void;
}

const ORDER: Theme[] = ['system', 'light', 'retro'];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      retro: resolveRetro('system'),
      cycle() {
        const theme = ORDER[(ORDER.indexOf(get().theme) + 1) % ORDER.length]!;
        set({ theme, retro: apply(theme) });
      },
    }),
    {
      name: 'roampass-theme',
      // v1: el antiguo modo 'dark' pasa a ser el modo 80s.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { theme?: string };
        return { theme: state.theme === 'dark' ? 'retro' : (state.theme ?? 'system') } as ThemeState;
      },
      partialize: ({ theme }) => ({ theme }) as ThemeState,
      onRehydrateStorage: () => (state) => {
        const retro = apply(state?.theme ?? 'system');
        useThemeStore.setState({ retro });
      },
    },
  ),
);

media.addEventListener('change', () => useThemeStore.setState({ retro: apply(useThemeStore.getState().theme) }));
