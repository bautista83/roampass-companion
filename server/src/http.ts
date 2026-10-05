import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { GameRuleError } from '@roampass/shared';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Express 5 propaga los errores de handlers async; aqui se traducen a JSON.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof GameRuleError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof ZodError) {
    res.status(400).json({ error: 'Datos invalidos', issues: err.issues });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ error: 'El recurso ya existe' });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: 'No encontrado' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
};
