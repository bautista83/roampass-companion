// Configuracion de la CLI de Prisma (migrate, seed, studio).
// La configuracion de todo el proyecto vive en el .env de la raiz: se carga aqui a mano,
// porque cuando existe este archivo Prisma ya no lee ningun .env por su cuenta.
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
