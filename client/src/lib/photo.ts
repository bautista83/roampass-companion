/** Lado de la foto del pasaporte (cuadrada). El servidor guarda el mismo tamaño. */
export const PHOTO_SIZE = 256;
/** Tamaño maximo del archivo original que se acepta elegir. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Error con la clave del texto a mostrar (profile.photo.*). */
export class PhotoError extends Error {
  constructor(public readonly key: 'tooLarge' | 'unreadable' | 'unsupported' | 'processFailed') {
    super(key);
  }
}

/**
 * Achica una foto en el navegador: recorte cuadrado al centro y 256x256. Asi una foto de celular de
 * varios MB sube como ~30 KB. Respeta la orientacion EXIF y, al redibujar en un canvas, se pierden
 * los metadatos (el servidor igual los vuelve a quitar).
 */
export async function resizePhoto(file: Blob): Promise<Blob> {
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('tooLarge');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('unreadable');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('unsupported');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();

  // WebP si el navegador lo sabe codificar (Safari antiguo devuelve PNG); si no, JPEG.
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode('image/webp', 0.85);
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg', 0.88);
  if (!blob) throw new PhotoError('processFailed');
  return blob;
}
