import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { categoryFields } from '../validation/commerce.js';
import { validate, idParam, notFound, HttpError } from '../middleware/http.js';
import { Prisma } from '../generated/prisma/index.js';
import { validateParent } from '../services/categoryTree.js';
export const validateCategory = validate(categoryFields);
async function saveCategory(req: Request, id?: number) {
  const data = categoryFields.parse(req.body);
  return prisma.$transaction(async tx => {
    const categories = await tx.category.findMany({ select: { id: true, parentId: true } });
    validateParent(categories, data.parentId, id);
    return id ? tx.category.update({ where: { id }, data }) : tx.category.create({ data });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function createCategory(req: Request, res: Response) { res.status(201).json({ data: await saveCategory(req) }); }
export async function getOneCategory(req: Request, res: Response) {
  const data = await prisma.category.findUnique({ where: { id: idParam(req.params.categoryId) } });
  if (!data) notFound(); res.json({ data });
}
export async function getAllCategories(_req: Request, res: Response) { res.json({ data: await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }) }); }
export async function editCategory(req: Request, res: Response) { res.json({ data: await saveCategory(req, idParam(req.params.categoryId)) }); }
export async function deleteCategory(req: Request, res: Response) {
  const id = idParam(req.params.categoryId);
  await prisma.$transaction(async tx => {
    const existing = await tx.category.findUnique({ where: { id }, include: { _count: { select: { children: true, products: true } } } });
    if (!existing) notFound();
    if (existing._count.children || existing._count.products) throw new HttpError(409, 'CATEGORY_IN_USE', 'Önce alt kategorileri ve ürünleri taşıyın veya kaldırın.');
    await tx.category.delete({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ message: 'Kategori silindi.' });
}
