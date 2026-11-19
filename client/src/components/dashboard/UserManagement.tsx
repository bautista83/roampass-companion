import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Role } from '@roampass/shared';
import { Trans, useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';
import { api, type User, type UserUpdate } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../ui/Modal';
import { UserPhoto } from '../ui/UserPhoto';

const COLS = 'md:grid md:grid-cols-[minmax(0,1.6fr)_8rem_9rem_6rem_auto] md:items-center md:gap-4';

/** Modulo ADMIN: CRUD de usuarios (ver, crear, activar/desactivar, editar, eliminar). */
export function UserManagement() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState<User | null>(null);
  const { t } = useTranslation();
  const { date } = useLabels();

  const reload = useCallback(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unexpectedError'));
      return false;
    }
  }

  const patch = (u: User, data: UserUpdate) => run(() => api.updateUser(u.id, data));

  return (
    <section className="panel p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">{t('users.module')}</p>
          <h2 className="text-xl font-bold">{t('users.title')}</h2>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          {t('users.new')}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp">
          {error}
        </p>
      )}

      <div className={`hidden px-3 pb-2 label ${COLS}`}>
        <span>{t('users.columns.user')}</span>
        <span>{t('users.columns.role')}</span>
        <span>{t('users.columns.status')}</span>
        <span>{t('users.columns.games')}</span>
        <span className="text-right">{t('users.columns.actions')}</span>
      </div>
      <ul className="space-y-2">
        {users.map((u) => {
          const isMe = u.id === me?.id;
          return (
            <li
              key={u.id}
              className={`flex flex-col gap-3 rounded-xl border border-passport-800/10 p-3 dark:border-white/10 ${COLS} ${
                u.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserPhoto user={u} shape="square" className="w-10 shrink-0 rounded-lg border-2 border-ink" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    @{u.username} {isMe && <span className="text-xs text-brass">{t('common.you')}</span>}
                  </p>
                  {u.email && (
                    <p className="truncate text-xs text-passport-500 dark:text-passport-300">
                      {u.email}
                      {!u.emailVerifiedAt && (
                        <>
                          {' · '}
                          <span className="font-bold text-brass">{t('users.unverified')}</span>{' '}
                          <button
                            className="underline hover:text-stamp-green"
                            onClick={() => patch(u, { emailVerified: true })}
                            title={t('users.confirmEmailTitle')}
                          >
                            {t('users.confirmEmail')}
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-passport-500 dark:text-passport-300">
                    {t('users.joined', { date: date(u.createdAt) })}
                    {u.invitedBy && (
                      <>
                        {' · '}
                        <span className="font-semibold">{t('invites.admin.invitedBy', { username: u.invitedBy.username })}</span>
                      </>
                    )}
                    {u.photoUpdatedAt && (
                      <>
                        {' · '}
                        <button className="underline hover:text-stamp" onClick={() => setRemovingPhoto(u)}>
                          {t('users.removePhoto')}
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <select
                aria-label={t('users.roleOf', { name: u.username })}
                className="input min-h-12 py-0"
                value={u.role}
                disabled={isMe}
                onChange={(e) => patch(u, { role: e.target.value as Role })}
              >
                <option value="PLAYER">PLAYER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button
                className={`btn min-h-12 text-sm ${
                  u.isActive ? 'bg-stamp-green/15 text-stamp-green' : 'bg-stamp/10 text-stamp'
                }`}
                disabled={isMe}
                onClick={() => patch(u, { isActive: !u.isActive })}
                title={u.isActive ? t('users.deactivate') : t('users.activate')}
              >
                {u.isActive ? t('users.active') : t('users.inactive')}
              </button>
              <span className="text-sm tabular-nums">
                <span className="md:hidden">{t('users.gamesShort')}</span>
                {u.gamesHosted ?? 0}
              </span>
              <div className="flex gap-2 md:justify-end">
                <button className="btn-ghost min-h-12 flex-1 px-3 md:flex-none" onClick={() => setEditing(u)}>
                  {t('users.editButton')}
                </button>
                <button
                  className="btn-ghost min-h-12 flex-1 px-3 text-stamp md:flex-none"
                  disabled={isMe}
                  onClick={() => setDeleting(u)}
                >
                  🗑️
                  <span className="md:sr-only">{t('common.actions.delete')}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <UserFormModal
        open={creating}
        title={t('users.newTitle')}
        onClose={() => setCreating(false)}
        onSubmit={async ({ username, password, role }) => {
          if (await run(() => api.createUser({ username, password: password!, role }))) setCreating(false);
        }}
      />
      <UserFormModal
        open={editing !== null}
        title={t('users.editTitle', { name: editing?.username ?? '' })}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={async ({ username, password, role }) => {
          if (!editing) return;
          const data: UserUpdate = {};
          if (username !== editing.username) data.username = username;
          if (password) data.password = password;
          if (role !== editing.role) data.role = role;
          if (await patch(editing, data)) setEditing(null);
        }}
      />
      <Modal open={removingPhoto !== null} onClose={() => setRemovingPhoto(null)} title={t('users.removePhotoTitle')}>
        <div className="space-y-4 p-6">
          <p>
            <Trans i18nKey="users.removePhotoBody" values={{ name: removingPhoto?.username }} components={{ b: <strong /> }} />
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setRemovingPhoto(null)}>
              {t('common.actions.cancel')}
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (removingPhoto && (await run(() => api.deleteUserPhoto(removingPhoto.id)))) setRemovingPhoto(null);
              }}
            >
              {t('users.removePhoto')}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t('users.deleteTitle')}>
        <div className="space-y-4 p-6">
          <p>
            <Trans i18nKey="users.deleteBody" values={{ name: deleting?.username }} components={{ b: <strong /> }} />
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDeleting(null)}>
              {t('common.actions.cancel')}
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (deleting && (await run(() => api.deleteUser(deleting.id)))) setDeleting(null);
              }}
            >
              {t('common.actions.delete')}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

interface UserFormValues {
  username: string;
  password?: string;
  role: Role;
}

function UserFormModal(props: {
  open: boolean;
  title: string;
  initial?: User;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}) {
  const { open, title, initial, onClose, onSubmit } = props;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('PLAYER');
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    setUsername(initial?.username ?? '');
    setPassword('');
    setRole(initial?.role ?? 'PLAYER');
  }, [open, initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit({ username: username.trim(), password: password || undefined, role });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4 p-6">
        <div>
          <label className="label" htmlFor="uf-username">
            {t('users.form.username')}
          </label>
          <input id="uf-username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
        </div>
        <div>
          <label className="label" htmlFor="uf-password">
            {initial ? t('users.form.newPasswordOptional') : t('users.form.password')}
          </label>
          <input
            id="uf-password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!initial}
            minLength={6}
          />
        </div>
        <div>
          <label className="label" htmlFor="uf-role">
            {t('users.form.role')}
          </label>
          <select id="uf-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="PLAYER">PLAYER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.actions.cancel')}
          </button>
          <button className="btn-primary">{t('common.actions.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
