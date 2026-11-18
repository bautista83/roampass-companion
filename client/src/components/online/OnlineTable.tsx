import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { DIE_FACES, MAX_PLAYERS, currentPlayer, maxInitialMiles, seatedPlayers, type GamePlayer, type PublicGameView } from '@roampass/shared';
import { api } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { useOnlineStore } from '../../store/onlineStore';
import { BoardView } from '../game/BoardView';
import { DieFace } from '../game/Die';
import { Scoreboard } from '../game/Scoreboard';
import { TurnBanner } from '../game/TurnBanner';
import { VictoryScreen } from '../game/VictoryScreen';
import { Modal } from '../ui/Modal';
import { OnlineCard } from './OnlineCard';
import { PlayerSearch, useSecondsLeft } from './shared';

type Confirm = 'abandon' | 'end' | null;

/** Mesa de una partida online: todos ven lo mismo; solo el jugador en turno puede actuar. */
export function OnlineTable({ view }: { view: PublicGameView }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { categories } = useLabels();
  const act = useOnlineStore((s) => s.act);
  const connected = useOnlineStore((s) => s.connected);
  const offline = useOnlineStore((s) => s.offline);
  const { state, you, pending } = view;
  const online = state.online;
  const finished = state.status === 'FINISHED';
  const player = currentPlayer(state);
  const me = state.players.find((p) => p.id === you.playerId);
  const myPresence = me?.presence ?? 'ACTIVE';
  const seconds = useSecondsLeft(online.deadline);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [inviting, setInviting] = useState(false);
  const [moving, setMoving] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  // Marcas del marcador: anfitrion, pausa, abandono y conexion.
  const badges = Object.fromEntries(
    state.players.map((p, i) => {
      const marks: string[] = [];
      if (p.id === online.hostPlayerId) marks.push(t('online.table.host'));
      if (p.presence === 'PAUSED') marks.push(t('online.table.presencePaused'));
      if (p.presence === 'ABANDONED') marks.push(t('online.table.presenceAbandoned'));
      else if (!connected.includes(online.userIds[i]!)) marks.push(t('online.table.offline'));
      return [p.id, marks.join(' · ')];
    }),
  );

  const lastSkip = online.lastResolution?.skipped ? online.lastResolution : null;
  const skipName = lastSkip ? state.players.find((p) => p.id === lastSkip.playerId)?.name : undefined;

  // ── Panel del dado ──
  let diePanel: React.ReactNode;
  if (finished) {
    diePanel = <p className="text-center font-bold">{t('game.turn.endOfTrip')}</p>;
  } else if (online.pausedByHost) {
    diePanel = <p className="text-center font-bold">{t('online.table.pausedByHost')}</p>;
  } else if (online.phase === 'IDLE') {
    diePanel = <p className="text-center font-bold">{t('online.table.idle')}</p>;
  } else if (online.phase === 'AWAITING_ROLL') {
    diePanel = you.isActive ? (
      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-xl">{t('online.table.yourTurn')}</p>
        <button className="btn-primary text-lg" onClick={() => run(() => act('game:roll'))}>
          {t('online.table.roll')}
        </button>
        <button className="btn-ghost min-h-10 px-3 text-sm" onClick={() => run(() => act('game:pass'))}>
          {t('online.table.pass')}
        </button>
        {seconds !== null && <p className="text-xs font-semibold">{t('online.table.rollIn', { seconds })}</p>}
      </div>
    ) : (
      <p className="text-center font-bold">{t('online.table.waitingRoll', { name: player.name, seconds: seconds ?? 0 })}</p>
    );
  } else if (online.phase === 'REVEALING' && pending) {
    const category = DIE_FACES[pending.dieFace - 1]!;
    diePanel = (
      <motion.div className="flex flex-col items-center gap-2" initial={{ rotate: -90, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }}>
        <DieFace face={pending.dieFace} size={72} />
        <p className="text-center font-bold">
          {t('online.table.rolled', { face: pending.dieFace, icon: categories[category].icon, label: categories[category].label })}
        </p>
      </motion.div>
    );
  } else {
    diePanel = <p className="text-center font-bold">{t('online.table.turnOf', { name: player.name })}</p>;
  }

  const controls = (
    <div className="flex flex-wrap gap-2">
      <button className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => navigate('/')}>
        {t('online.table.back')}
      </button>
      {!finished && myPresence === 'ACTIVE' && (
        <button className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => run(() => act('player:pause'))}>
          {t('online.table.pauseMe')}
        </button>
      )}
      {!finished && myPresence === 'PAUSED' && (
        <button className="btn-primary min-h-10 flex-1 px-3 text-sm" onClick={() => run(() => act('player:resume'))}>
          {t('online.table.resumeMe')}
        </button>
      )}
      {!finished && myPresence === 'ABANDONED' && (
        <button className="btn-primary min-h-10 flex-1 px-3 text-sm" onClick={() => run(() => api.rejoinOnline(state.id))}>
          {t('online.table.rejoin')}
        </button>
      )}
      {!finished && myPresence !== 'ABANDONED' && (
        <button className="btn-ghost min-h-10 flex-1 px-3 text-sm text-stamp" onClick={() => setConfirm('abandon')}>
          {t('online.table.abandon')}
        </button>
      )}
      {!finished && you.isHost && (
        <>
          <button className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => run(() => act(online.pausedByHost ? 'host:resume' : 'host:pause'))}>
            {online.pausedByHost ? t('online.table.hostResume') : t('online.table.hostPause')}
          </button>
          {seatedPlayers(state).length < MAX_PLAYERS && (
            <button className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => setInviting(true)}>
              {t('online.table.inviteMore')}
            </button>
          )}
          <button className="btn-ghost min-h-10 flex-1 px-3 text-sm text-stamp" onClick={() => setConfirm('end')}>
            {t('online.table.hostEnd')}
          </button>
        </>
      )}
    </div>
  );

  const notices = (
    <>
      {offline && <p className="rounded-xl border-2 border-ink bg-sun px-3 py-2 text-xs font-semibold text-ink">{t('online.table.connecting')}</p>}
      {myPresence === 'PAUSED' && !finished && <p className="rounded-xl border-2 border-ink bg-sun px-3 py-2 text-sm font-bold text-ink">{t('online.table.youArePaused')}</p>}
      {myPresence === 'ABANDONED' && !finished && <p className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">{t('online.table.youAbandoned')}</p>}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </>
  );

  const frozen = online.phase === 'REVEALING' || online.phase === 'AWAITING_ANSWER';
  const onArrive = useCallback((_p: GamePlayer, _s: number) => {}, []);

  return (
    <>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,30fr)_minmax(0,70fr)] md:items-start md:gap-5">
        <div className="flex flex-col gap-4">
          <TurnBanner game={state} player={player} />
          <div className="panel flex min-h-40 items-center justify-center p-4">{diePanel}</div>
          <AnimatePresence>
            {lastSkip && skipName && online.phase === 'AWAITING_ROLL' && (
              <motion.p key={lastSkip.at} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-sm font-semibold text-passport-500">
                {lastSkip.skipped === 'TIMEOUT_ROLL' ? t('online.table.skippedTimeout', { name: skipName }) : t('online.table.skippedPass', { name: skipName })}
              </motion.p>
            )}
          </AnimatePresence>
          {notices}
          <Scoreboard game={state} badges={badges} />
          {controls}
        </div>
        <section aria-label={t('game.table.boardAria')}>
          <BoardView players={state.players} currentPlayerId={finished ? null : player.id} frozen={frozen} onArrive={onArrive} onMovingChange={setMoving} />
        </section>
      </div>

      <OnlineCard view={view} />

      <Modal open={inviting} onClose={() => setInviting(false)} title={t('online.table.inviteTitle')}>
        <div className="p-6">
          <PlayerSearch sessionId={state.id} excludeNames={state.players.map((p) => p.name)} maxInitialMiles={maxInitialMiles(state)} />
        </div>
      </Modal>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === 'end' ? t('online.table.confirmEndTitle') : t('online.table.confirmAbandonTitle')}>
        <div className="space-y-4 p-6">
          <p>{confirm === 'end' ? t('online.table.confirmEnd') : t('online.table.confirmAbandon')}</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirm(null)}>
              {t('common.actions.cancel')}
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                const event = confirm === 'end' ? 'host:end' : 'player:abandon';
                setConfirm(null);
                void run(() => act(event));
              }}
            >
              {confirm === 'end' ? t('online.table.hostEnd') : t('online.table.abandon')}
            </button>
          </div>
        </div>
      </Modal>

      {finished && !moving && (
        <VictoryScreen
          game={state}
          onLeave={(to) => navigate(to === '/setup' ? '/online/new' : to)}
          abandonedIds={state.players.filter((p) => p.presence === 'ABANDONED').map((p) => p.id)}
          subtitle={online.endReason ? t(`online.table.endReason.${online.endReason}`) : undefined}
        />
      )}
    </>
  );
}
