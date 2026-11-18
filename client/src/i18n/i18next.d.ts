// Tipos de las claves de traduccion: t('clave.que.no.existe') no compila.
import 'i18next';
import type { es } from './locales/es/index';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
    returnNull: false;
  }
}
