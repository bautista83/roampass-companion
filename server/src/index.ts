import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './env';
import { purgeUnverifiedAccounts } from './auth/emailTokens';
import { expireEmailInvites } from './invites/service';
import { attachRealtime } from './realtime';
import { registerGamePushes } from './push/gameEvents';
import { loadOnlineDeck } from './online/deck';
import { onlineService } from './online/service';

const server = createServer(createApp());
attachRealtime(server);
registerGamePushes();

server.listen(env.port, () => {
  console.log(`🧭 Roamle API escuchando en http://localhost:${env.port}/api`);
});

// Partidas online: mazo en memoria y timers de las partidas en curso (CA-31).
loadOnlineDeck()
  .then(() => onlineService.init())
  .catch((err) => console.error('No se pudieron retomar las partidas online:', err));

// Libera cada hora los registros sin confirmar de mas de 7 dias (CO-03) y vence invitaciones por correo.
const purge = () =>
  purgeUnverifiedAccounts()
    .then((n) => n > 0 && console.log(`🧹 ${n} registro(s) sin confirmar eliminados`))
    .then(() => expireEmailInvites())
    .catch((err) => console.error('No se pudieron limpiar los registros sin confirmar:', err));
void purge();
setInterval(purge, 60 * 60 * 1000).unref();
