import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma.js';
import { Prisma } from '../src/generated/prisma/index.js';
const directory = path.dirname(fileURLToPath(import.meta.url));
const prefix = 'luxury-preview-v1:';
export async function seedDemo() {
  const products = JSON.parse(await fs.readFile(path.join(directory, 'fixtures/catalog.json'), 'utf8')) as Array<{ key: string; name: string; details: string; category: string; price: string; stock: number; sizes: string[]; color: string; image: string }>;
  const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || 'public');
  await fs.mkdir(uploadDirectory, { recursive: true });
  for (const p of products) await fs.copyFile(path.join(directory, 'fixtures', p.image), path.join(uploadDirectory, `demo-${p.image}`));
  return prisma.$transaction(async tx => {
    const ids: number[] = [];
    for (const p of products) {
      // Reruns do not overwrite edits made later in the admin panel.
      const existing = await tx.product.findUnique({ where: { seedKey: prefix + p.key } });
      if (existing) { ids.push(existing.id); continue; }
      const category = await tx.category.findFirst({ where: { name: p.category } }) ?? await tx.category.create({ data: { name: p.category } });
      const created = await tx.product.create({ data: { name: p.name, details: p.details, categoryId: category.id, campaignId: null, sizes: p.sizes, total_qty: p.stock, price: p.price, variant: p.color, images: [`demo-${p.image}`], isDemo: true, seedKey: prefix + p.key } });
      ids.push(created.id);
    }
    return ids;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
async function main() {
  if (process.argv.includes('--list')) {
    console.log(await prisma.product.findMany({ where: { isDemo: true, seedKey: { startsWith: prefix } }, select: { id: true, name: true, seedKey: true } }));
  } else if (process.argv.includes('--delete')) {
    if (!process.argv.includes('--apply')) throw new Error('Use --list to review demo IDs; deletion also requires --apply.');
    // Narrowly scoped to this seed batch. Preserve images, categories and historical orders.
    console.log(await prisma.product.deleteMany({ where: { isDemo: true, seedKey: { startsWith: prefix } } }));
  } else console.log({ demoProductIds: await seedDemo() });
}
if (process.argv[1]?.endsWith('seed-demo.ts')) {
  main().catch(() => { console.error('Demo seed operation failed; check the database and fixture files.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
