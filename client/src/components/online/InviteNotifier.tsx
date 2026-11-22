import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';
import { AVATARS, type InviteSummary, type PawnColor } from '@roampass/shared';
import { api } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { getSocket, onlineAvailable } from '../../online/socket';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../ui/Modal';
import { PawnPicker, firstFree } from './shared';

/**
 * Invitaciones a partidas online: llegan al instante por el socket (si el usuario esta conectado) o
 * se cargan al entrar (CA-04). Tambien avisa al anfitrion cuando aceptan o rechazan.
 */
export function InviteNotifier() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { miles } = useLabels();
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [choosing, setChoosing] = useState<InviteSummary | null>(null);
  const [pawn, setPawn] = useState<{ color: PawnColor; avatar: string }>({ color: 'red', avatar: AVATARS[0] });
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.listInvites().then(setInvites).catch(() => {});
  }, []);

  useEffect(() => {
    if (!onlineAvailable || !token) return;
    reload();
    const socket = getSocket();
    const onReceived = (inv: InviteSummary) => setInvites((list) => [inv, ...list.filter((i) => i.id !== inv.id)]);
    const onUpdated = (u: { id: string; status: string; username: string }) => {
      setInvites((list) => list.filter((i) => i.id !== u.id));
      const key = u.status === 'ACCEPTED' ? 'accepted' : u.status === 'DECLINED' ? 'declined' : u.status === 'EXPIRED' ? 'expired' : 'cancelled';
      setToast({ text: t(`online.invites.${key}`, { name: u.username }), key: Date.now() });
    };
    socket.on('invite:received', onReceived);
    socket.on('invite:updated', onUpdated);
    return () => {
      socket.off('invite:received', onReceived);
      socket.off('invite:updated', onUpdated);
    };
  }, [token, reload, t]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  function openAccept(inv: InviteSummary) {
    setError(null);
    setPawn({ color: firstFree(inv.takenColors), avatar: AVATARS[inv.players.length % AVATARS.length]! });
    setChoosing(inv);
  }

  async function accept() {
    if (!choosing) return;
    try {
      const { sessionId } = await api.acceptInvite(choosing.id, pawn);
      setInvites((list) => list.filter((i) => i.id !== choosing.id));
      setChoosing(null);
      navigate(`/online/${sessionId}`);
    } catch (err) {
      setError(errorText(err));
      reload();
    }
  }

  async function decline(inv: InviteSummary) {
    setInvites((list) => list.filter((i) => i.id !== inv.id));
    await api.declineInvite(inv.id).catch(() => {});
  }

  const goal = (inv: InviteSummary) =>
    inv.mode === 'POINTS' ? t('dashboard.recent.goalMiles', { miles: miles(inv.target) }) : t('dashboard.recent.goalRounds', { count: inv.target });

  return (
    <>
      <div className="pointer-events-none fixed right-3 bottom-[calc(0.75rem+var(--sab))] z-[950] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {invites.map((inv) => (
            <motion.div
              key={inv.id}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              className="sticker pointer-events-auto bg-sun p-3 text-ink"
              role="alert"
            >
              <p className="text-xs font-extrabold tracking-widest uppercase">{t('online.invites.title')}</p>
              <p className="font-bold">
                <Trans i18nKey="online.invites.from" values={{ from: inv.from }} components={{ b: <strong /> }} />
              </p>
              <p className="text-sm">{t('online.invites.details', { goal: goal(inv), count: inv.players.length })}</p>
              {inv.started && (
                <p className="text-xs font-semibold">
                  {inv.initialMiles > 0 ? t('online.invites.startedWithMiles', { miles: miles(inv.initialMiles) }) : t('online.invites.started')}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button className="btn-primary min-h-10 flex-1 px-3 text-sm" onClick={() => openAccept(inv)}>
                  {t('online.invites.accept')}
                </button>
                <button className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => decline(inv)}>
                  {t('online.invites.decline')}
                </button>
              </div>
            </motion.div>
          ))}
          {toast && (
            <motion.div key={toast.key} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="sticker pointer-events-auto bg-mint p-3 text-sm font-bold text-ink" role="status">
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal open={choosing !== null} onClose={() => setChoosing(null)} title={t('online.invites.chooseTitle')}>
        <div className="space-y-4 p-6">
          {choosing && <PawnPicker color={pawn.color} avatar={pawn.avatar} taken={choosing.takenColors} onChange={setPawn} />}
          {error && (
            <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" onClick={accept}>
            {t('online.invites.join')}
          </button>
        </div>
      </Modal>
    </>
  );
}
