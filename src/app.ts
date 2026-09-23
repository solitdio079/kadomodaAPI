import { createApp } from './server.js';
import { prisma } from './lib/prisma.js';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = createApp().listen(port, '0.0.0.0', () => console.log(`Kado Moda API listening on ${port}`));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => { await prisma.$disconnect(); clearTimeout(timer); process.exit(0); });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
