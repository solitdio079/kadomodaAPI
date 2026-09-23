import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma, type OrderStatus } from '../generated/prisma/index.js';
import { idParam, requireUser, notFound, HttpError, validate } from '../middleware/http.js';
import { orderStatusFields } from '../validation/commerce.js';
const include = { payment: true, orderProducts: true, address: true };
export const validateOrder = validate(orderStatusFields);
// No order/payment creation until provider verification, per-size inventory,
// shipping quotes, immutable address/price snapshots and idempotency are implemented.
// This is deliberately not controlled by a runtime switch that could enable unsafe code.
export function createOrder(_req: Request, res: Response) {
  res.status(503).json({ code: 'CHECKOUT_UNAVAILABLE', error: 'Sipariş ve ödeme işlemleri henüz kullanıma açık değil.' });
}
export async function getOrders(req: Request, res: Response) {
  const user = requireUser(req);
  res.json({ data: await prisma.order.findMany({ where: user.role === 'ADMIN' ? {} : { userId: user.id }, include, orderBy: { id: 'desc' }, take: 100 }) });
}
export async function getOneOrder(req: Request, res: Response) {
  const user = requireUser(req);
  const data = await prisma.order.findFirst({ where: { id: idParam(req.params.orderId), ...(user.role === 'ADMIN' ? {} : { userId: user.id }) }, include });
  if (!data) notFound();
  res.json({ data });
}
export function canTransition(from: OrderStatus, to: OrderStatus, paid: boolean) {
  if (from === to) return true;
  if (from === 'PROCESSING' && to === 'IPTAL') return !paid;
  if (from === 'PROCESSING' && to === 'KARGODA') return paid;
  return from === 'KARGODA' && to === 'TESLIM_EDILDI' && paid;
}
export async function editOrder(req: Request, res: Response) {
  const user = requireUser(req);
  if (user.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED', 'Bu işlem için yönetici yetkisi gerekiyor.');
  const id = idParam(req.params.orderId), { status } = orderStatusFields.parse(req.body);
  const data = await prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id }, include: { payment: true } });
    if (!order) notFound();
    if (!canTransition(order.status, status, order.payment?.status === 'PAID'))
      throw new HttpError(409, 'INVALID_TRANSITION', 'Sipariş bu duruma geçirilemez. Ödeme ve iade durumunu kontrol edin.');
    return tx.order.update({ where: { id }, data: { status }, include });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ data, message: 'Sipariş durumu güncellendi.' });
}
export function deleteOrder(_req: Request, res: Response) {
  res.status(405).set('Allow', 'GET, PUT, PATCH').json({ code: 'ORDER_DELETE_DISABLED', error: 'Sipariş kayıtları silinemez. Uygun siparişler iptal edilebilir.' });
}
