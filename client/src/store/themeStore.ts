import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
}

interface ThemeState {
  theme: Theme;
  cycle: () => void;
}

const ORDER: Theme[] = ['system', 'light', 'dark'];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      cycle() {
        const theme = ORDER[(ORDER.indexOf(get().theme) + 1) % ORDER.length]!;
        apply(theme);
        set({ theme });
      },
    }),
    { name: 'roampass-theme', onRehydrateStorage: () => (state) => apply(state?.theme ?? 'system') },
  ),
);

media.addEventListener('change', () => apply(useThemeStore.getState().theme));
