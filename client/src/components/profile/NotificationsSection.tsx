import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App } from '@capacitor/app';
import { PUSH_TYPES, type PushType } from '@roampass/shared';
import type { User } from '../../api';
import { errorText } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { enablePush, getPushPermission, openNotificationSettings, pushAvailable, type PushPermission } from '../../native/push';

/**
 * Notificaciones (docs/specs/mobile-app.md, 4.4). Solo en la app: estado del permiso del telefono y
 * un interruptor por tipo. En la web no se muestra (CA-14).
 */
export function NotificationsSection({ user }: { user: User }) {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { t } = useTranslation();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<PushType | null>(null);

  const check = useCallback(() => void getPushPermission().then(setPermission).catch(() => setPermission('denied')), []);
  useEffect(() => {
    if (!pushAvailable()) return;
    check();
    // Al volver de los ajustes del telefono se ve el estado nuevo.
    const resume = App.addListener('resume', check);
    return () => void resume.then((h) => h.remove());
  }, [check]);

  if (!pushAvailable() || !permission) return null;
  const muted = user.pushMuted ?? [];

  async function toggle(type: PushType) {
    setError(null);
    setSaving(type);
    try {
      await updateProfile({ pushMuted: muted.includes(type) ? muted.filter((m) => m !== type) : [...muted, type] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="panel space-y-4 p-4 md:p-6" aria-labelledby="notificaciones">
      <div>
        <h2 id="notificaciones" className="text-xl">
          {t('profile.notifications.title')}
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">{t('profile.notifications.intro')}</p>
      </div>

      {permission === 'prompt' && (
        <button className="btn-primary w-full sm:w-auto" onClick={() => void enablePush().then(setPermission)}>
          {t('profile.notifications.enable')}
        </button>
      )}
      {permission === 'denied' && (
        <div className="space-y-3">
          <p className="rounded-xl border-2 border-ink bg-sun/40 px-3 py-2 text-sm font-semibold">{t('profile.notifications.blocked')}</p>
          <button className="btn-ghost w-full sm:w-auto" onClick={() => void openNotificationSettings()}>
            {t('profile.notifications.openSettings')}
          </button>
        </div>
      )}
      {permission === 'granted' && (
        <ul className="space-y-2">
          {PUSH_TYPES.map((type) => {
            const on = !muted.includes(type);
            return (
              <li key={type}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-ink/20 px-3 py-2">
                  <input
                    type="checkbox"
                    role="switch"
                    className="mt-1 size-5 shrink-0 accent-passport-700"
                    checked={on}
                    disabled={saving !== null}
                    onChange={() => void toggle(type)}
                  />
                  <span>
                    <span className="block font-bold">{t(`profile.notifications.types.${type}.title`)}</span>
                    <span className="block text-sm text-passport-500 dark:text-passport-300">
                      {t(`profile.notifications.types.${type}.desc`)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </section>
  );
}
