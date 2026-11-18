import express from 'express';
import cors from 'cors';
import { env } from './env';
import { errorHandler } from './http';
import { authRouter } from './auth/routes';
import { usersRouter } from './routes/users';
import { photosRouter } from './routes/photos';
import { cardsRouter } from './routes/cards';
import { gamesRouter } from './routes/games';

export function createApp() {
  const app = express();
  // Detras de proxies (Nginx de la VM, Tailscale Funnel): confiar solo en saltos locales/privados
  // para que req.ip sea la IP real del cliente (la usan los limites de login/registro).
  app.set('trust proxy', 'loopback, uniquelocal');
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  // Fotos antes que usersRouter: ver la foto solo requiere sesion, no ser ADMIN.
  app.use('/api/users', photosRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/cards', cardsRouter);
  app.use('/api/games', gamesRouter);

  app.use(errorHandler);
  return app;
}
