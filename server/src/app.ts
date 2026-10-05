import express from 'express';
import cors from 'cors';
import { env } from './env';
import { errorHandler } from './http';
import { authRouter } from './auth/routes';
import { usersRouter } from './routes/users';
import { cardsRouter } from './routes/cards';
import { gamesRouter } from './routes/games';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/cards', cardsRouter);
  app.use('/api/games', gamesRouter);

  app.use(errorHandler);
  return app;
}
