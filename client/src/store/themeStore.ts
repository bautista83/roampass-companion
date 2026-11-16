import { create } from 'zustand';
import type { UiTheme } from '@roampass/shared';
import { useAuthStore } from './authStore';

/**
 * Estilo visual del sitio. No se elige con un boton: es una configuracion del perfil de cada usuario
 * (Mi perfil). Sin sesion (login) siempre se ve el estilo base, COMIC.
 * RETRO (80s) activa las clases `retro` y `dark` en <html>; `dark` mantiene las variantes dark:.
 */
function apply(theme: UiTheme): boolean {
  const retro = theme === 'RETRO';
  document.documentElement.classList.toggle('dark', retro);
  document.documentElement.classList.toggle('retro', retro);
  return retro;
}

interface ThemeState {
  theme: UiTheme;
  /** Modo 80s activo. */
  retro: boolean;
}

const themeOf = () => useAuthStore.getState().user?.theme ?? 'COMIC';

export const useThemeStore = create<ThemeState>()(() => {
  const theme = themeOf();
  return { theme, retro: apply(theme) };
});

// Al iniciar o cerrar sesion, o al cambiarlo en Mi perfil, se aplica el estilo del usuario.
useAuthStore.subscribe(() => {
  const theme = themeOf();
  if (theme !== useThemeStore.getState().theme) useThemeStore.setState({ theme, retro: apply(theme) });
});
