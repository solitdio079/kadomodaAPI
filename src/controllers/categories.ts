import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { categoryFields } from '../validation/commerce.js';
import { validate, idParam, notFound } from '../middleware/http.js';
export const validateCategory = validate(categoryFields);
export async function createCategory(req: Request, res: Response) { res.status(201).json({ data: await prisma.category.create({ data: categoryFields.parse(req.body) }) }); }
export async function getOneCategory(req: Request, res: Response) {
  const data = await prisma.category.findUnique({ where: { id: idParam(req.params.categoryId) } });
  if (!data) notFound(); res.json({ data });
}
export async function getAllCategories(_req: Request, res: Response) { res.json({ data: await prisma.category.findMany({ orderBy: { name: 'asc' } }) }); }
export async function editCategory(req: Request, res: Response) { res.json({ data: await prisma.category.update({ where: { id: idParam(req.params.categoryId) }, data: categoryFields.parse(req.body) }) }); }
export async function deleteCategory(req: Request, res: Response) { await prisma.category.delete({ where: { id: idParam(req.params.categoryId) } }); res.json({ message: 'Kategori silindi.' }); }
