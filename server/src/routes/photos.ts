import { Router } from 'express';
import { prisma } from '../db';
import { HttpError } from '../http';
import { requireAdmin, requireAuth } from '../auth/middleware';
import { deletePhoto } from '../photos';

/** Fotos de pasaporte. Solo con sesion iniciada (el cliente las pide con el token). */
export const photosRouter = Router();

photosRouter.get('/:id/photo', requireAuth, async (req, res) => {
  const photo = await prisma.userPhoto.findUnique({ where: { userId: String(req.params.id) } });
  if (!photo) throw new HttpError(404, 'Sin foto', 'NOT_FOUND');
  // La URL lleva ?v=<photoUpdatedAt>: una foto nueva cambia la URL, asi que se puede cachear.
  res.set('Cache-Control', 'private, max-age=86400');
  res.type(photo.mimeType).send(Buffer.from(photo.data));
});

/** Moderacion: el admin quita la foto de cualquier usuario. */
photosRouter.delete('/:id/photo', requireAuth, requireAdmin, async (req, res) => {
  res.json({ user: await deletePhoto(String(req.params.id)) });
});
