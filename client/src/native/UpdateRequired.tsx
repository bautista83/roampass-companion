import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App as CapApp } from '@capacitor/app';
import { api } from '../api';
import { Brand } from '../components/layout/Brand';
import { isNative, nativePlatform } from './index';

/** Compara versiones "1.2.3": negativo si a < b. Partes faltantes o no numericas valen 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Version minima de la app (docs/specs/mobile-app.md, D16): si la app instalada es mas vieja que la
 * que pide el servidor, devuelve el enlace a la tienda. En la web y en el modo demo, siempre null.
 * Si no hay conexion, no bloquea.
 */
export function useRequiredUpdate(): string | null {
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    let alive = true;
    void (async () => {
      try {
        const [config, info] = await Promise.all([api.getAppConfig(), CapApp.getInfo()]);
        if (!config || compareVersions(info.version, config.minAppVersion) >= 0) return;
        const url = nativePlatform() === 'ios' ? config.storeUrls.ios : config.storeUrls.android;
        if (alive && url) setStoreUrl(url);
      } catch {
        // sin conexion o servidor viejo: se sigue usando la app
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return storeUrl;
}

/** Pantalla que reemplaza a la app cuando hay que actualizarla. */
export function UpdateRequired({ storeUrl }: { storeUrl: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="panel w-full max-w-md space-y-4 p-6 text-center shadow-hard-lg sm:p-8">
        <div className="flex justify-center">
          <Brand />
        </div>
        <h1 className="text-2xl">{t('common.updateRequired.title')}</h1>
        <p>{t('common.updateRequired.body')}</p>
        <a href={storeUrl} className="btn-primary w-full">
          {t('common.updateRequired.button')}
        </a>
      </div>
    </div>
  );
}
