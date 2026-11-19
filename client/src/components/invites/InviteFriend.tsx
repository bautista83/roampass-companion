import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type MyEmailInvite } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { Modal } from '../ui/Modal';

/** Boton "Invitar a un amigo" del panel con su modal (docs/specs/email-invitations.md, 4.2 y 4.3). */
export function InviteFriendButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost" data-tour="invite-friend" onClick={() => setOpen(true)}>
        {t('invites.friend.button')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('invites.friend.title')}>
        {open && <InviteFriend />}
      </Modal>
    </>
  );
}

function InviteFriend() {
  const { t } = useTranslation();
  const { date } = useLabels();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [mine, setMine] = useState<MyEmailInvite[] | null>(null);

  const reload = useCallback(() => {
    api.listMyEmailInvites().then(setMine).catch(() => setMine([]));
  }, []);
  useEffect(reload, [reload]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const to = email.trim().toLowerCase();
    setBusy(true);
    setStatus(null);
    try {
      await api.inviteFriend(to);
      setStatus({ ok: true, text: t('invites.friend.sent', { email: to }) });
      setEmail('');
      reload();
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const statusText = (inv: MyEmailInvite) =>
    inv.status === 'REGISTERED'
      ? inv.registeredUsername
        ? t('invites.mine.status.REGISTERED', { username: inv.registeredUsername })
        : t('invites.mine.status.REGISTERED_DELETED')
      : t(`invites.mine.status.${inv.status}`);

  return (
    <div className="space-y-5 p-6">
      <form onSubmit={onSubmit} className="space-y-3">
        <p>{t('invites.friend.intro')}</p>
        <div>
          <label className="label" htmlFor="friend-email">
            {t('invites.friend.email')}
          </label>
          <input
            id="friend-email"
            type="email"
            className="input"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
          <p className="mt-1 text-xs text-passport-500 dark:text-passport-300">{t('invites.friend.limits')}</p>
        </div>
        {status && (
          <p role="status" className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${status.ok ? 'bg-mint' : 'bg-coral'}`}>
            {status.text}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? t('invites.friend.sending') : t('invites.friend.send')}
        </button>
      </form>

      <section>
        <h3 className="label">{t('invites.mine.title')}</h3>
        {mine === null ? null : mine.length === 0 ? (
          <p className="text-sm text-passport-500 dark:text-passport-300">{t('invites.mine.empty')}</p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {mine.map((inv) => (
              <li key={inv.id} className="rounded-xl border-2 border-ink/10 px-3 py-2 text-sm dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{inv.email}</span>
                  <span className="shrink-0 text-xs text-passport-500 dark:text-passport-300">
                    {inv.kind === 'GAME' ? t('invites.mine.game') : t('invites.mine.friend')} · {date(inv.createdAt)}
                  </span>
                </div>
                <p className="mt-1">
                  <span
                    className={
                      inv.status === 'REGISTERED'
                        ? 'rounded-full border-2 border-ink bg-mint px-2 text-xs font-bold text-ink'
                        : 'text-xs text-passport-500 dark:text-passport-300'
                    }
                  >
                    {statusText(inv)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
