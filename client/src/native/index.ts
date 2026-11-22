// Integracion con la app para celulares (Capacitor, docs/specs/mobile-app.md).
// Unico lugar del client que usa plugins nativos: en la web todo esto no hace nada.

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { SplashScreen } from '@capacitor/splash-screen';

/** true dentro de la app de Android o iOS; false en el navegador. */
export const isNative = () => Capacitor.isNativePlatform();

export const nativePlatform = () => Capacitor.getPlatform() as 'web' | 'android' | 'ios';

/** Pantallas "raiz": ahi el boton Atras de Android minimiza la app en lugar de volver. */
const ROOT_PATHS = ['/', '/login'];

/**
 * Comportamiento de app nativa. Se monta una vez dentro del router:
 * pantalla de inicio, boton Atras, enlaces externos y color de la barra de estado.
 */
export function useNativeShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    if (!isNative()) return;
    void SplashScreen.hide();

    // Atras: cierra el modal abierto (si se puede cerrar), vuelve una pantalla o minimiza la app.
    const back = App.addListener('backButton', () => {
      if (document.querySelector('[role="dialog"]')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      if (ROOT_PATHS.includes(path.current)) {
        void App.minimizeApp();
      } else if ((window.history.state as { idx?: number } | null)?.idx) {
        navigate(-1);
      } else {
        navigate('/', { replace: true }); // se entro directo a esta pantalla (p. ej. desde un enlace)
      }
    });

    // Los enlaces a otros sitios se abren en el navegador del sistema, no dentro de la app.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin === window.location.origin || !/^https?:$/.test(url.protocol)) return;
      e.preventDefault();
      void Browser.open({ url: url.href });
    };
    document.addEventListener('click', onClick, true);

    // Iconos de la barra de estado claros u oscuros segun el estilo del perfil (Comic u 80s).
    const syncBars = () =>
      void SystemBars.setStyle({
        style: document.documentElement.classList.contains('dark') ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      });
    syncBars();
    const themeObserver = new MutationObserver(syncBars);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      void back.then((h) => h.remove());
      document.removeEventListener('click', onClick, true);
      themeObserver.disconnect();
    };
  }, [navigate]);
}
