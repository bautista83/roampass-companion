import { Router } from 'express';
import { z } from 'zod';
import type { EmailInviteStatus } from '@prisma/client';
import { prisma } from '../db';
import { requireAdmin, requireAuth } from '../auth/middleware';
import { inviteLimiter, tokenLimiter } from '../auth/rateLimit';
import { emailSchema } from '../auth/schemas';
import { describeInvite, expireEmailInvites, myInvites, optOut, sendEmailInvite } from './service';

const tokenSchema = z.string().min(10).max(200);

// ── Jugadores ────────────────────────────────────────────────────────────────

export const emailInvitesRouter = Router();

/** Invitar a un amigo (4.2). Responde siempre "enviada" salvo los limites propios (D1). */
emailInvitesRouter.post('/', requireAuth, inviteLimiter, async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  await sendEmailInvite({ from: req.user!, email });
  res.status(201).json({ sent: true });
});

/** "Mis invitaciones" (4.3). */
emailInvitesRouter.get('/mine', requireAuth, async (req, res) => {
  await expireEmailInvites();
  res.json({ invites: await myInvites(req.user!.id) });
});

/** Datos de la invitacion para la pagina de registro (publico). */
emailInvitesRouter.get('/token', tokenLimiter, async (req, res) => {
  const token = tokenSchema.parse(req.query.token);
  res.json(await describeInvite(token));
});

/** Baja de invitaciones (4.5, publico). */
emailInvitesRouter.post('/opt-out', tokenLimiter, async (req, res) => {
  const { token } = z.object({ token: tokenSchema }).parse(req.body);
  await optOut(token);
  res.status(204).end();
});

// ── Admin (4.4) ─────────────────────────────────────────────────────────────

export const adminInvitesRouter = Router();
adminInvitesRouter.use(requireAuth, requireAdmin);

const STATUSES = ['PENDING', 'REGISTERED', 'ALREADY_MEMBER', 'CLOSED', 'BLOCKED', 'EXPIRED'] as const satisfies readonly EmailInviteStatus[];

/** Listado completo, con filtros por estado y por quien invito. */
adminInvitesRouter.get('/', async (req, res) => {
  const { status, fromUserId } = z
    .object({ status: z.enum(STATUSES).optional(), fromUserId: z.string().max(64).optional() })
    .parse(req.query);
  await expireEmailInvites();
  const rows = await prisma.emailInvite.findMany({
    where: { ...(status && { status }), ...(fromUserId && { fromUserId }) },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      kind: true,
      email: true,
      status: true,
      sessionId: true,
      createdAt: true,
      expiresAt: true,
      registeredAt: true,
      fromUserId: true,
      fromUsername: true,
      registeredUser: { select: { id: true, username: true } },
    },
  });
  res.json({ invites: rows });
});

/** Totales y ranking de quien invito mas (ordenado por cuentas creadas). */
adminInvitesRouter.get('/stats', async (_req, res) => {
  await expireEmailInvites();
  const rows = await prisma.emailInvite.findMany({ select: { status: true, fromUserId: true, fromUsername: true } });
  const totals = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<EmailInviteStatus, number>;
  const byUser = new Map<string, { userId: string | null; username: string; sent: number; registered: number }>();
  for (const r of rows) {
    totals[r.status]++;
    const key = r.fromUserId ?? `deleted:${r.fromUsername}`;
    const entry = byUser.get(key) ?? { userId: r.fromUserId, username: r.fromUsername, sent: 0, registered: 0 };
    entry.sent++;
    if (r.status === 'REGISTERED') entry.registered++;
    byUser.set(key, entry);
  }
  // La conversion se mide sobre las invitaciones que pudieron terminar en una cuenta nueva.
  const eligible = rows.length - totals.ALREADY_MEMBER - totals.BLOCKED;
  res.json({
    sent: rows.length,
    registered: totals.REGISTERED,
    pending: totals.PENDING,
    conversion: eligible > 0 ? totals.REGISTERED / eligible : 0,
    byStatus: totals,
    ranking: [...byUser.values()].sort((a, b) => b.registered - a.registered || b.sent - a.sent).slice(0, 20),
  });
});
