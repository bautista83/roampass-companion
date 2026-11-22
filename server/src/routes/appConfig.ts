import { Router } from 'express';
import { env } from '../env';

/** Datos publicos para la app de celulares (docs/specs/mobile-app.md, D16). */
export const appConfigRouter = Router();

appConfigRouter.get('/config', (_req, res) => {
  res.json({
    minAppVersion: env.app.minVersion,
    storeUrls: { android: env.app.androidStoreUrl, ios: env.app.iosStoreUrl },
  });
});
