import { z } from 'zod';

/** Correo en minusculas (CO-01). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Correo no válido').max(254));
