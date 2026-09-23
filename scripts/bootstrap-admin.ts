import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { UserValidator } from '../src/validation/validators.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

export async function bootstrapAdmin(email: string, name: string, password: string) {
  const data = UserValidator.parse({ email, name, password, confirmPassword: password });
  const normalized = data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    // Never reset an existing account's password as an incidental bootstrap action.
    if (!await verifyPassword(password, existing.pwd)) throw new Error('Existing account password does not match; no changes made.');
    return prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' }, select: { id: true, email: true, role: true } });
  }
  return prisma.user.create({ data: { email: normalized, name: data.name, pwd: await hashPassword(password), role: 'ADMIN' }, select: { id: true, email: true, role: true } });
}

if (process.argv[1]?.endsWith('bootstrap-admin.ts')) {
  try {
    const { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_NAME: name, BOOTSTRAP_ADMIN_PASSWORD: password } = process.env;
    if (!email || !name || !password) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD in the server environment.');
    console.log(await bootstrapAdmin(email, name, password));
  } catch { console.error('Admin bootstrap failed. Check server-only bootstrap variables and the existing account password. No password was logged.'); process.exitCode = 1; }
  finally { await prisma.$disconnect(); }
}
