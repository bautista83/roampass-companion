import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MAX_PLAYERS, type PublicGameView } from '@roampass/shared';
import { api, type SentInvite } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { getSocket, onlineAvailable } from '../../online/socket';
import { useOnlineStore } from '../../store/onlineStore';
import { PawnToken } from '../ui/PawnToken';
import { OnlineTable } from './OnlineTable';
import { PlayerSearch } from './shared';

/** /online/:id — sala de espera o mesa, segun la fase de la partida. */
export function OnlineRoom() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const join = useOnlineStore((s) => s.join);
  const leave = useOnlineStore((s) => s.leave);
  const view = useOnlineStore((s) => s.view);
  const status = useOnlineStore((s) => s.status);
  const error = useOnlineStore((s) => s.error);

  useEffect(() => {
    if (!onlineAvailable) return;
    join(id);
    return () => leave();
  }, [id, join, leave]);

  if (!onlineAvailable) return <p className="panel p-6">{t('online.demoUnavailable')}</p>;
  if (status === 'closed' || status === 'error') {
    return (
      <div className="panel mx-auto max-w-md space-y-4 p-6 text-center">
        <p className="font-bold">{status === 'closed' ? t('online.lobby.closed') : (error ?? t('online.table.notFound'))}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>
          {t('online.table.back')}
        </button>
      </div>
    );
  }
  if (!view) return <p className="panel p-6 text-center">{t('online.table.connecting')}</p>;
  return view.state.online.phase === 'LOBBY' ? <OnlineLobby view={view} /> : <OnlineTable view={view} />;
}

function OnlineLobby({ view }: { view: PublicGameView }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { miles } = useLabels();
  const act = useOnlineStore((s) => s.act);
  const connected = useOnlineStore((s) => s.connected);
  const { state, you } = view;
  const [sent, setSent] = useState<SentInvite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reloadSent = useCallback(() => {
    api.listSentInvites(state.id).then(setSent).catch(() => {});
  }, [state.id]);
  useEffect(() => {
    reloadSent();
    const socket = getSocket();
    socket.on('invite:updated', reloadSent);
    return () => {
      socket.off('invite:updated', reloadSent);
    };
  }, [reloadSent, state.players.length]);

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    }
  }

  const goal = state.config.mode === 'POINTS' ? t('dashboard.recent.goalMiles', { miles: miles(state.config.target) }) : t('dashboard.recent.goalRounds', { count: state.config.target });
  const userIds = state.online.userIds;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl">{t('online.lobby.title')}</h1>
          <p className="text-sm text-passport-500 dark:text-passport-300">
            {t('online.lobby.settings', { goal, card: state.timerSeconds ?? 10, die: state.online.dieTimeoutSeconds })}
          </p>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/')}>
          {t('online.table.back')}
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        <section className="panel space-y-3 p-4 md:p-6">
          <h2 className="text-xl">{t('online.lobby.players', { count: state.players.length, max: MAX_PLAYERS })}</h2>
          <p className="text-sm text-passport-500 dark:text-passport-300">{t('online.lobby.subtitle', { max: MAX_PLAYERS })}</p>
          <ul className="space-y-2">
            {state.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl bg-passport-800/[0.03] p-2 dark:bg-white/[0.03]">
                <PawnToken avatar={p.avatar} color={p.color} className="w-8 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {p.name} {p.id === you.playerId && <span className="text-xs text-brass">({t('online.lobby.you')})</span>}
                </span>
                {p.id === state.online.hostPlayerId && <span className="rounded-full border-2 border-ink bg-sun px-2 text-xs font-bold text-ink">{t('online.lobby.host')}</span>}
                <span className={`size-2.5 rounded-full ${connected.includes(userIds[i]!) ? 'bg-stamp-green' : 'bg-passport-300'}`} aria-hidden />
              </li>
            ))}
          </ul>

          {you.isHost ? (
            <div className="space-y-2 pt-2">
              <button className="btn-primary w-full text-lg" disabled={state.players.length < 2} onClick={() => run(() => act('game:start'))}>
                {t('online.lobby.start')}
              </button>
              {state.players.length < 2 && <p className="text-center text-xs text-passport-500">{t('online.lobby.needTwo')}</p>}
              <button
                className="btn-ghost w-full text-stamp"
                onClick={() =>
                  run(async () => {
                    await api.cancelOnlineGame(state.id);
                    navigate('/');
                  })
                }
              >
                {t('online.lobby.cancelRoom')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <p className="rounded-xl border-2 border-dashed border-ink/30 p-3 text-center text-sm font-semibold">{t('online.lobby.waitingHost')}</p>
              <button
                className="btn-ghost w-full"
                onClick={() =>
                  run(async () => {
                    await api.leaveOnlineLobby(state.id);
                    navigate('/');
                  })
                }
              >
                {t('online.lobby.leave')}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
              {error}
            </p>
          )}
        </section>

        {you.isHost && (
          <section className="panel space-y-4 p-4 md:p-6">
            <h2 className="text-xl">{t('online.lobby.inviteTitle')}</h2>
            {state.players.length < MAX_PLAYERS && (
              <PlayerSearch sessionId={state.id} excludeNames={[...state.players.map((p) => p.name), ...sent.map((s) => s.username)]} onInvited={reloadSent} />
            )}
            {sent.length > 0 && (
              <div>
                <p className="label">{t('online.lobby.pending')}</p>
                <ul className="space-y-1.5">
                  {sent.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>⏳ @{inv.username}</span>
                      <button className="underline" onClick={() => run(async () => { await api.cancelInvite(inv.id); reloadSent(); })}>
                        {t('online.lobby.cancelInvite')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
