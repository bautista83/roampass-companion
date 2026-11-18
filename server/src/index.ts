import { createApp } from './app';
import { env } from './env';
import { purgeUnverifiedAccounts } from './auth/emailTokens';

createApp().listen(env.port, () => {
  console.log(`🧭 RoamPass API escuchando en http://localhost:${env.port}/api`);
});

// Libera cada hora los registros sin confirmar de mas de 7 dias (CO-03).
const purge = () =>
  purgeUnverifiedAccounts()
    .then((n) => n > 0 && console.log(`🧹 ${n} registro(s) sin confirmar eliminados`))
    .catch((err) => console.error('No se pudieron limpiar los registros sin confirmar:', err));
void purge();
setInterval(purge, 60 * 60 * 1000).unref();
