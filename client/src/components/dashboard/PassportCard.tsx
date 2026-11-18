import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { User } from '../../api';
import { useLabels } from '../../i18n/useLabels';
import { UserPhoto } from '../ui/UserPhoto';

/** Numero de pasaporte estable a partir del id del usuario. */
function passportNumber(id: string) {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9_999_991;
  return `RL${String(h).padStart(7, '0')}`;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

/** Linea de lectura mecanica (MRZ) de 36 caracteres, como en los pasaportes reales. */
const mrz = (text: string) => text.toUpperCase().replace(/[^A-Z0-9<]/g, '<').padEnd(36, '<').slice(0, 36);

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold tracking-widest text-[#5a6357] uppercase">{label}</p>
      <p className="truncate text-sm font-extrabold text-[#111111] md:text-base">{value}</p>
    </div>
  );
}

/**
 * Pagina de datos del pasaporte del viajero: foto (la que subio el usuario o, si no tiene, un retrato
 * dibujado al azar), datos y la linea MRZ. Siempre se ve como documento,
 * con sus propios colores, en cualquier tema.
 */
export function PassportCard({ user }: { user: User }) {
  const number = passportNumber(user.id);
  const { t } = useTranslation();
  const { date } = useLabels();
  const role = user.role === 'ADMIN' ? t('dashboard.passport.roleAdmin') : t('dashboard.passport.rolePlayer');

  return (
    <motion.section
      className="sticker relative -rotate-1 overflow-hidden bg-[#fdf6e3] text-[#111111]"
      initial={{ y: 16, opacity: 0, rotate: -4 }}
      animate={{ y: 0, opacity: 1, rotate: -1 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16 }}
      aria-label={t('dashboard.passport.aria', { name: user.username })}
    >
      {/* fondo de seguridad: guilloche de lineas finas */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'repeating-radial-gradient(circle at 80% 20%, transparent 0 10px, rgb(126 196 245 / 0.35) 10px 11px), repeating-linear-gradient(135deg, transparent 0 14px, rgb(107 207 139 / 0.25) 14px 15px)',
        }}
        aria-hidden
      />

      <header className="relative flex items-center justify-between gap-3 border-b-3 border-[#111111] bg-[#ff5a5a] px-4 py-2 md:px-5">
        <span className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="size-8" aria-hidden />
          <span className="font-display text-sm text-white md:text-base">{t('dashboard.passport.header')}</span>
        </span>
        <span className="text-[10px] font-extrabold tracking-widest text-white/90 uppercase">{t('dashboard.passport.country')}</span>
      </header>

      <div className="relative grid grid-cols-[auto_1fr] gap-4 p-4 md:gap-5 md:p-5">
        <div className="flex flex-col items-center gap-2">
          <UserPhoto user={user} className="w-24 border-3 border-[#111111] shadow-[4px_4px_0_0_#111111] md:w-32" />
          <span className="font-['Brush_Script_MT',cursive] text-lg leading-none text-[#233462] italic">{user.username}</span>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#5a6357] uppercase">{t('dashboard.passport.holder')}</p>
            <h1 className="truncate text-2xl leading-tight md:text-4xl">{t('dashboard.passport.hello', { name: user.username })}</h1>
            <p className="text-sm text-[#5a6357]">{t('dashboard.passport.tagline')}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Field label={t('dashboard.passport.surname')} value={user.username.toUpperCase()} />
            <Field label={t('dashboard.passport.category')} value={role} />
            <Field label={t('dashboard.passport.nationality')} value={t('dashboard.passport.nationalityValue')} />
            <Field label={t('dashboard.passport.issued')} value={date(user.createdAt, DATE_FORMAT).toUpperCase()} />
            <Field label={t('dashboard.passport.number')} value={number} />
            <Field
              label={t('dashboard.passport.status')}
              value={user.isActive ? t('dashboard.passport.statusActive') : t('dashboard.passport.statusSuspended')}
            />
          </div>
        </div>
      </div>

      {/* Linea MRZ */}
      <div className="relative border-t-2 border-dashed border-[#111111]/40 bg-white/60 px-4 py-2 font-mono text-[11px] leading-snug tracking-[0.15em] break-all text-[#111111] md:px-5 md:text-sm">
        <p>{mrz(`P<RML${user.username}<<${t('dashboard.passport.mrzTraveler')}`)}</p>
        <p>
          {mrz(
            `${number}<0RML${user.isActive ? t('dashboard.passport.mrzActive') : t('dashboard.passport.mrzSuspended')}<<<${user.role}`,
          )}
        </p>
      </div>

      {/* sellos */}
      <span className="stamp pointer-events-none absolute right-4 bottom-14 rotate-[-12deg] border-[#e5484d]/60 text-2xl text-[#e5484d]/60 md:text-3xl" aria-hidden>
        {t('dashboard.passport.stamp')}
      </span>
      <span
        className="pointer-events-none absolute top-14 right-6 grid size-16 rotate-12 place-items-center rounded-full border-4 border-double border-[#1e9e5a]/60 text-center text-[9px] leading-tight font-extrabold text-[#1e9e5a]/70 uppercase md:size-20"
        aria-hidden
      >
        ✈️
        <br />
        {t('dashboard.passport.city')}
      </span>
    </motion.section>
  );
}
