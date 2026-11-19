import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type AdminEmailInvite, type EmailInviteStats, type EmailInviteStatus } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';

const STATUSES: EmailInviteStatus[] = ['PENDING', 'REGISTERED', 'ALREADY_MEMBER', 'CLOSED', 'BLOCKED', 'EXPIRED'];
const COLS = 'md:grid md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.4fr)_5rem_minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-3';

/** Modulo ADMIN: quien invito a quien y que invitaciones terminaron en una cuenta (spec 4.4). */
export function InviteStats() {
  const { t } = useTranslation();
  const { num, date } = useLabels();
  const [stats, setStats] = useState<EmailInviteStats | null>(null);
  const [invites, setInvites] = useState<AdminEmailInvite[] | null>(null);
  const [status, setStatus] = useState<EmailInviteStatus | ''>('');
  const [fromUserId, setFromUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getEmailInviteStats().then(setStats).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    api
      .listEmailInvites({ ...(status && { status }), ...(fromUserId && { fromUserId }) })
      .then(setInvites)
      .catch((e) => setError(errorText(e)));
  }, [status, fromUserId]);

  const tiles = stats && [
    { label: t('invites.admin.sent'), value: num(stats.sent) },
    { label: t('invites.admin.registered'), value: num(stats.registered) },
    { label: t('invites.admin.conversion'), value: `${Math.round(stats.conversion * 100)} %` },
    { label: t('invites.admin.pending'), value: num(stats.pending) },
  ];
  const inviters = (stats?.ranking ?? []).filter((r) => r.userId);

  return (
    <section className="panel space-y-5 p-4 md:p-6" aria-labelledby="invite-stats-title">
      <h2 id="invite-stats-title" className="text-xl">
        {t('invites.admin.title')}
      </h2>
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}

      {tiles && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border-2 border-ink/15 p-3 dark:border-white/10">
              <p className="label">{tile.label}</p>
              <p className="text-2xl font-extrabold tabular-nums">{tile.value}</p>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div>
          <h3 className="label">{t('invites.admin.ranking')}</h3>
          {stats.ranking.length === 0 ? (
            <p className="text-sm text-passport-500 dark:text-passport-300">{t('invites.admin.noRanking')}</p>
          ) : (
            <ol className="space-y-1">
              {stats.ranking.map((r, i) => (
                <li key={`${r.userId ?? r.username}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">
                    {i + 1}. @{r.username}
                    {!r.userId && <span className="font-normal text-passport-500"> ({t('invites.admin.deletedUser')})</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-passport-500 dark:text-passport-300">
                    {t('invites.admin.rankingRow', { sent: num(r.sent), registered: num(r.registered) })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="label">{t('invites.admin.list')}</h3>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-semibold">
              {t('invites.admin.filterStatus')}
              <select className="input mt-1 min-h-10 py-0" value={status} onChange={(e) => setStatus(e.target.value as EmailInviteStatus | '')}>
                <option value="">{t('invites.admin.all')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`invites.admin.status.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              {t('invites.admin.filterFrom')}
              <select className="input mt-1 min-h-10 py-0" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
                <option value="">{t('invites.admin.allUsers')}</option>
                {inviters.map((r) => (
                  <option key={r.userId} value={r.userId!}>
                    @{r.username}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {invites && invites.length === 0 ? (
          <p className="text-sm text-passport-500 dark:text-passport-300">{t('invites.admin.empty')}</p>
        ) : (
          <ul className="space-y-2 md:space-y-0">
            <li className={`hidden px-3 pb-1 text-xs font-bold uppercase tracking-wide text-passport-500 ${COLS}`}>
              <span>{t('invites.admin.date')}</span>
              <span>{t('invites.admin.from')}</span>
              <span>{t('invites.admin.email')}</span>
              <span>{t('invites.admin.kind')}</span>
              <span>{t('invites.admin.statusCol')}</span>
              <span>{t('invites.admin.account')}</span>
            </li>
            {invites?.map((inv) => (
              <li
                key={inv.id}
                className={`space-y-1 rounded-xl border-2 border-ink/10 px-3 py-2 text-sm md:space-y-0 md:rounded-none md:border-0 md:border-t-2 dark:border-white/10 ${COLS}`}
              >
                <span className="text-xs tabular-nums text-passport-500 dark:text-passport-300">{date(inv.createdAt)}</span>
                <span className="block truncate font-semibold">
                  @{inv.fromUsername}
                  {!inv.fromUserId && <span className="font-normal text-passport-500"> ({t('invites.admin.deletedUser')})</span>}
                </span>
                <span className="block truncate">{inv.email}</span>
                <span className="mr-2 inline-block md:mr-0">{inv.kind === 'GAME' ? t('invites.mine.game') : t('invites.mine.friend')}</span>
                <span className="inline-block">
                  <span
                    title={t(`invites.admin.statusHelp.${inv.status}`)}
                    className={`whitespace-nowrap rounded-full border-2 border-ink px-2 text-xs font-bold text-ink ${
                      inv.status === 'REGISTERED' ? 'bg-mint' : inv.status === 'PENDING' ? 'bg-sun' : 'bg-paper dark:bg-white/80'
                    }`}
                  >
                    {t(`invites.admin.status.${inv.status}`)}
                  </span>
                </span>
                <span className="block truncate">
                  {inv.registeredUser ? (
                    <>
                      @{inv.registeredUser.username}
                      {inv.registeredAt && <span className="text-xs text-passport-500"> · {date(inv.registeredAt)}</span>}
                    </>
                  ) : inv.status === 'REGISTERED' ? (
                    t('invites.admin.deletedUser')
                  ) : (
                    '—'
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
