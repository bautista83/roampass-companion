import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { SeedData } from '@roampass/shared';
import { cardToRow } from '../src/cardMapper';

const prisma = new PrismaClient();
const seedPath = fileURLToPath(new URL('../../shared/data/seedData.json', import.meta.url));

async function main() {
  const { cards } = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedData;
  for (const card of cards) {
    const row = cardToRow(card);
    await prisma.cardQuestion.upsert({ where: { id: card.id }, create: row, update: row });
  }
  console.log(`✔ ${cards.length} cartas sincronizadas`);

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn('⚠ ADMIN_USERNAME / ADMIN_PASSWORD no definidos: no se crea el admin inicial');
    return;
  }
  await prisma.user.upsert({
    where: { username },
    create: { username, passwordHash: await bcrypt.hash(password, 10), role: 'ADMIN' },
    update: { role: 'ADMIN', isActive: true },
  });
  console.log(`✔ Usuario ADMIN "${username}" listo`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
