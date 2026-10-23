// Carga el .env de la raiz del proyecto (unico archivo de configuracion para cliente y servidor).
// Se importa primero en cada punto de entrada del servidor (src/env.ts y prisma/seed.ts).
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
