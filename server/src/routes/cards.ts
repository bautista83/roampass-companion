import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { rowToCard } from '../cardMapper';

export const cardsRouter = Router();

// Devuelve el mazo completo; el cliente lo cachea y roba cartas offline durante la partida.
cardsRouter.get('/', requireAuth, async (_req, res) => {
  const rows = await prisma.cardQuestion.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  res.json({ cards: rows.map(rowToCard) });
});
