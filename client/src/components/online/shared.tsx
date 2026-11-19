import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AVATARS, PAWN_COLORS, type PawnColor } from '@roampass/shared';
import { api } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { AvatarIcon } from '../ui/PawnToken';

/** Segundos que faltan para un deadline ISO (se actualiza solo). */
export function useSecondsLeft(deadline: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

/** Elegir color y avatar del peon (los colores ocupados se ven deshabilitados). */
export function PawnPicker(props: {
  color: PawnColor;
  avatar: string;
  taken?: PawnColor[];
  onChange: (pawn: { color: PawnColor; avatar: string }) => void;
}) {
  const { color, avatar, taken = [], onChange } = props;
  const { t } = useTranslation();
  const { pawnColors } = useLabels();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <fieldset>
        <legend className="label">{t('setup.players.pawn')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {PAWN_COLORS.map((c) => {
            const isTaken = taken.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={isTaken}
                onClick={() => onChange({ color: c, avatar })}
                aria-label={`${t('setup.players.colorAria', { color: pawnColors[c].label })}${isTaken ? t('setup.players.colorTaken') : ''}`}
                aria-pressed={color === c}
                className={`size-11 rounded-full ring-offset-2 ring-offset-paper transition disabled:opacity-20 dark:ring-offset-passport-900 ${
                  color === c ? 'ring-4 ring-passport-700 dark:ring-brass' : ''
                }`}
                style={{ background: pawnColors[c].hex }}
              />
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">{t('setup.players.avatar')}</legend>
        <div className="flex flex-wrap gap-1">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ color, avatar: a })}
              aria-pressed={avatar === a}
              aria-label={t('setup.players.avatarAria', { avatar: a })}
              className={`grid size-11 place-items-center rounded-lg transition ${
                avatar === a ? 'bg-passport-700/15 ring-2 ring-passport-700 dark:bg-brass/20 dark:ring-brass' : ''
              }`}
            >
              <AvatarIcon avatar={a} className="size-8" />
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Primer color libre (o el primero, si estan todos). */
export const firstFree = (taken: PawnColor[]) => PAWN_COLORS.find((c) => !taken.includes(c)) ?? PAWN_COLORS[0];

/** Buscar usuarios registrados e invitarlos (con millas iniciales si la partida ya empezo). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function PlayerSearch(props: { sessionId: string; excludeNames: string[]; maxInitialMiles?: number; onInvited?: () => void }) {
  const { sessionId, excludeNames, maxInitialMiles, onInvited } = props;
  const { t } = useTranslation();
  const { miles } = useLabels();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [initial, setInitial] = useState(0);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Un correo no se busca (no se revela si tiene cuenta): se ofrece invitarlo por correo.
  const email = EMAIL_RE.test(q.trim()) ? q.trim().toLowerCase() : null;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || term.includes('@')) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.searchUsers(term).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  async function invite(u: { id: string; username: string }) {
    setStatus(null);
    try {
      await api.inviteToOnline(sessionId, u.id, initial);
      setStatus({ ok: true, text: t('online.lobby.invited', { name: u.username }) });
      onInvited?.();
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    }
  }

  async function inviteByEmail(to: string) {
    setStatus(null);
    try {
      await api.inviteToOnlineByEmail(sessionId, to, initial);
      setStatus({ ok: true, text: t('invites.search.sent', { email: to }) });
      setQ('');
      onInvited?.();
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    }
  }

  const shown = results.filter((u) => !excludeNames.includes(u.username));
  return (
    <div className="space-y-3">
      <input className="input" placeholder={t('online.lobby.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('online.lobby.searchPlaceholder')} />
      {maxInitialMiles !== undefined && (
        <div>
          <label className="label" htmlFor="initial-miles">
            {t('online.table.initialMiles')}
          </label>
          <input
            id="initial-miles"
            type="number"
            className="input"
            min={0}
            max={maxInitialMiles}
            step={500}
            value={initial}
            onChange={(e) => setInitial(Math.max(0, Math.min(maxInitialMiles, Number(e.target.value) || 0)))}
          />
          <p className="mt-1 text-xs text-passport-500 dark:text-passport-300">{t('online.table.initialMilesHint', { max: miles(maxInitialMiles) })}</p>
        </div>
      )}
      {email ? (
        <div className="space-y-1.5">
          <button className="btn-primary w-full min-h-10 px-3 text-sm" onClick={() => inviteByEmail(email)}>
            <span className="truncate">{t('invites.search.byEmail', { email })}</span>
          </button>
          <p className="text-xs text-passport-500 dark:text-passport-300">{t('invites.search.byEmailHint')}</p>
        </div>
      ) : q.trim().length < 2 || q.includes('@') ? (
        <p className="text-xs text-passport-500 dark:text-passport-300">{t('online.lobby.searchHint')}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-passport-500 dark:text-passport-300">{t('online.lobby.noResults')}</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink/10 px-3 py-1.5 dark:border-white/10">
              <span className="truncate font-semibold">@{u.username}</span>
              <button className="btn-primary min-h-10 px-3 text-sm" onClick={() => invite(u)}>
                {t('online.lobby.invite')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && (
        <p role="status" className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${status.ok ? 'bg-mint' : 'bg-coral'}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
