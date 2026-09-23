import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { cartFields } from '../validation/commerce.js';
import { validate, idParam, requireUser, notFound } from '../middleware/http.js';
import { priceLines } from '../services/pricing.js';
export const validateCartProduct = validate(cartFields);
export async function createCart(req: Request, res: Response) {
  const user = requireUser(req);
  const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {}, include: { cartProducts: true } });
  res.status(200).json({ data: cart });
}
export const getCart = createCart;
export async function editCart(req: Request, res: Response) {
  const user = requireUser(req), id = idParam(req.params.cartId);
  const cart = await prisma.$transaction(async tx => {
    if (!await tx.cart.findFirst({ where: { id, userId: user.id } })) notFound();
    const { quoted, subtotal } = await priceLines(tx, cartFields.parse(req.body));
    await tx.cartProduct.deleteMany({ where: { cartId: id } });
    await tx.cartProduct.createMany({ data: quoted.map(line => ({ ...line, cartId: id })) });
    return tx.cart.update({ where: { id }, data: { subtotal }, include: { cartProducts: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ data: cart, message: 'Sepet güncellendi.' });
}
export async function clearCart(req: Request, res: Response) {
  const user = requireUser(req), id = idParam(req.params.cartId);
  const cart = await prisma.$transaction(async tx => {
    if (!await tx.cart.findFirst({ where: { id, userId: user.id } })) notFound();
    await tx.cartProduct.deleteMany({ where: { cartId: id } });
    return tx.cart.update({ where: { id }, data: { subtotal: 0 }, include: { cartProducts: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ data: cart, message: 'Sepet temizlendi.' });
}
