import express from 'express';
import cors from 'cors';
import { env } from './env';
import { errorHandler } from './http';
import { authRouter } from './auth/routes';
import { usersRouter } from './routes/users';
import { photosRouter } from './routes/photos';
import { cardsRouter } from './routes/cards';
import { gamesRouter } from './routes/games';
import { invitesRouter, onlineRouter, userSearchRouter } from './online/routes';
import { adminInvitesRouter, emailInvitesRouter } from './invites/routes';
import { appConfigRouter } from './routes/appConfig';
import { devicesRouter } from './routes/devices';

export function createApp() {
  const app = express();
  // Detras de proxies (Nginx de la VM, Tailscale Funnel): confiar solo en saltos locales/privados
  // para que req.ip sea la IP real del cliente (la usan los limites de login/registro).
  app.set('trust proxy', 'loopback, uniquelocal');
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/app', appConfigRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/devices', devicesRouter);
  // Fotos y busqueda antes que usersRouter: solo requieren sesion, no ser ADMIN.
  app.use('/api/users', photosRouter);
  app.use('/api/users', userSearchRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/cards', cardsRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/online', onlineRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/email-invites', emailInvitesRouter);
  app.use('/api/admin/email-invites', adminInvitesRouter);

  app.use(errorHandler);
  return app;
}
