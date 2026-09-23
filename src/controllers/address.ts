import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { addressFields } from '../validation/commerce.js';
import { validate, requireUser, ownerWhere, idParam, notFound, HttpError } from '../middleware/http.js';
export const validateAddress = validate(addressFields);
function addressData(body: unknown) { const { zipCode, ...rest } = addressFields.parse(body); return { ...rest, zipcode: zipCode }; }
export async function createAddress(req: Request, res: Response) {
  const data = await prisma.address.create({ data: { ...addressData(req.body), userId: requireUser(req).id } });
  res.status(201).json({ data });
}
export async function editAddress(req: Request, res: Response) {
  const where = ownerWhere(req, idParam(req.params.addressId));
  const data = await prisma.$transaction(async tx => {
    if (!await tx.address.findFirst({ where })) notFound();
    if (await tx.order.count({ where: { addressId: where.id } }))
      throw new HttpError(409, 'ADDRESS_IN_USE', 'Siparişte kullanılan adres değiştirilemez. Yeni bir adres ekleyin.');
    return tx.address.update({ where, data: addressData(req.body) });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ data });
}
export async function getUserAddresses(req: Request, res: Response) {
  res.json({ data: await prisma.address.findMany({ where: { userId: requireUser(req).id }, orderBy: { id: 'desc' } }) });
}
export async function getOneAddress(req: Request, res: Response) {
  const data = await prisma.address.findFirst({ where: ownerWhere(req, idParam(req.params.addressId)) });
  if (!data) notFound();
  res.json({ data });
}
export async function deleteAddress(req: Request, res: Response) {
  await prisma.address.delete({ where: ownerWhere(req, idParam(req.params.addressId)) });
  res.json({ message: 'Adres silindi.' });
}
