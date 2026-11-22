import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../components/ui/Modal';
import { enablePush, usePushPrompt } from './push';

/** Pantalla previa al permiso del sistema (docs/specs/mobile-app.md, 4.2). Se monta una vez en App. */
export function PushPrompt() {
  const { t } = useTranslation();
  const open = usePushPrompt((s) => s.open);
  const close = usePushPrompt((s) => s.close);
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      await enablePush();
    } catch {
      // si el sistema falla, queda el interruptor en el Perfil
    } finally {
      setBusy(false);
      close();
    }
  }

  return (
    <Modal open={open} onClose={busy ? undefined : close} title={t('profile.notifications.prompt.title')}>
      <div className="space-y-4 p-6">
        <p>{t('profile.notifications.prompt.body')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-ghost" onClick={close} disabled={busy}>
            {t('profile.notifications.prompt.later')}
          </button>
          <button className="btn-primary" onClick={() => void activate()} disabled={busy}>
            {t('profile.notifications.prompt.enable')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
