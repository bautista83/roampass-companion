import { useEffect, useRef } from 'react';

/** Clave publica del captcha de Cloudflare. Sin ella el captcha esta apagado. */
export const TURNSTILE_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined;

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
  reset(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no cargó')));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile no cargó'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Captcha de Cloudflare (Turnstile). Llama a `onToken` con el token cuando se resuelve y con null
 * cuando vence. `resetKey` distinto vuelve a pedir uno (los tokens son de un solo uso).
 */
export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    const el = ref.current;
    loadTurnstile()
      .then((ts) => {
        if (cancelled) return;
        widgetId = ts.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          language: 'es',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onTokenRef.current(null);
    };
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex min-h-[65px] justify-center" />;
}
