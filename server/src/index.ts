import { createApp } from './app';
import { env } from './env';

createApp().listen(env.port, () => {
  console.log(`🧭 RoamPass API escuchando en http://localhost:${env.port}/api`);
});
