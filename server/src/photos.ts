import sharp from 'sharp';
import { prisma } from './db';
import { HttpError } from './http';
import { publicUserSelect } from './auth/middleware';

/** Lado de la foto guardada (cuadrada). El cliente ya la manda achicada; esto lo garantiza. */
export const PHOTO_SIZE = 256;
/** Tamaño maximo que se acepta subir (antes de procesar). */
export const MAX_PHOTO_UPLOAD = '10mb';

/**
 * Normaliza cualquier imagen a WebP 256x256: respeta la orientacion EXIF, recorta al centro y
 * descarta TODOS los metadatos (sharp no los copia salvo que se pida), incluida la ubicacion GPS.
 */
export async function processPhoto(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new HttpError(400, 'El archivo no es una imagen válida', 'INVALID_IMAGE');
  }
}

export async function savePhoto(userId: string, input: Buffer) {
  if (!input.length) throw new HttpError(400, 'El archivo no es una imagen válida', 'INVALID_IMAGE');
  const data = new Uint8Array(await processPhoto(input));
  const [, user] = await prisma.$transaction([
    prisma.userPhoto.upsert({
      where: { userId },
      create: { userId, data, mimeType: 'image/webp' },
      update: { data, mimeType: 'image/webp' },
    }),
    prisma.user.update({ where: { id: userId }, data: { photoUpdatedAt: new Date() }, select: publicUserSelect }),
  ]);
  return user;
}

export async function deletePhoto(userId: string) {
  const [, user] = await prisma.$transaction([
    prisma.userPhoto.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { photoUpdatedAt: null }, select: publicUserSelect }),
  ]);
  return user;
}
