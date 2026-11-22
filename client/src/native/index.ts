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

/** Sitio cuyos enlaces abre la app (App Links / Universal Links, D11). */
const LINK_HOSTS = ['playroamle.com', 'www.playroamle.com'];
/** Pantallas que se abren desde un enlace (los de los correos y el de una sala online). */
const LINK_PATHS = [/^\/invite(\/opt-out)?$/, /^\/verify-email$/, /^\/reset-password$/, /^\/online\/[\w-]+$/];

/** Ruta interna de un enlace de playroamle.com ("/invite?token=..."), o null si la app no la abre. */
export function deepLinkPath(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !LINK_HOSTS.includes(u.hostname)) return null;
    return LINK_PATHS.some((re) => re.test(u.pathname)) ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}

/** La URL con la que se abrio la app se atiende una sola vez (getLaunchUrl la sigue devolviendo). */
let launchUrlHandled = false;

/** Pantallas "raiz": ahi el boton Atras de Android minimiza la app en lugar de volver. */
const ROOT_PATHS = ['/', '/login'];

/**
 * Comportamiento de app nativa. Se monta una vez dentro del router:
 * pantalla de inicio, boton Atras, enlaces de playroamle.com, enlaces externos y color de la barra de estado.
 */
export function useNativeShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const path = useRef(pathname);
  path.current = pathname;
  // navigate cambia con cada pantalla: se usa por ref para que el efecto corra una sola vez.
  const nav = useRef(navigate);
  nav.current = navigate;

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
        nav.current(-1);
      } else {
        nav.current('/', { replace: true }); // se entro directo a esta pantalla (p. ej. desde un enlace)
      }
    });

    // Enlaces de playroamle.com (un correo, un mensaje): se abre esa pantalla dentro de la app.
    // Con la app cerrada, el enlace llega como URL de inicio; con la app abierta, como evento.
    const openLink = (url: string | undefined) => {
      const target = url ? deepLinkPath(url) : null;
      if (target) nav.current(target);
    };
    if (!launchUrlHandled) {
      launchUrlHandled = true;
      void App.getLaunchUrl().then((r) => openLink(r?.url));
    }
    const urlOpen = App.addListener('appUrlOpen', ({ url }) => openLink(url));

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
      void urlOpen.then((h) => h.remove());
      document.removeEventListener('click', onClick, true);
      themeObserver.disconnect();
    };
  }, []);
}
