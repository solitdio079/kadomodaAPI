import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { productFields, productPatch } from '../validation/commerce.js';
import { validate, idParam, notFound, HttpError } from '../middleware/http.js';
import { readProductImport, productKey, type ImportIssue } from '../services/productImport.js';
import { unlink } from 'node:fs/promises';

export const validateProduct = validate(productFields);
export const validateProductPatch = validate(productPatch);
const include = { campaign: true, category: true };
function files(req: Request) { return Array.isArray(req.files) ? req.files.map(f => f.filename) : []; }
function productData(body: unknown, patch = false) {
  const { sizesString, ...data } = patch ? productPatch.parse(body) : productFields.parse(body);
  return { ...data, ...(sizesString !== undefined ? { sizes: sizesString.split(',').map(s => s.trim()) } : {}) };
}
async function checkRelations(data: { categoryId?: number; campaignId?: number | null }) {
  if (data.categoryId !== undefined && !await prisma.category.findUnique({ where: { id: data.categoryId } }))
    throw new HttpError(400, 'INVALID_CATEGORY', 'Geçerli bir kategori seçin.');
  if (data.campaignId != null && !await prisma.campaign.findUnique({ where: { id: data.campaignId } }))
    throw new HttpError(400, 'INVALID_CAMPAIGN', 'Geçerli bir kampanya seçin.');
}
export async function createOneProduct(req: Request, res: Response) {
  const body = productFields.parse(req.body);
  await checkRelations(body);
  const images = files(req);
  if (!images.length) throw new HttpError(400, 'IMAGE_REQUIRED', 'En az bir ürün görseli yükleyin.');
  const { sizesString, ...fields } = body;
  const data = await prisma.product.create({ data: { ...fields, sizes: sizesString.split(',').map(s => s.trim()), images }, include });
  res.status(201).json({ data, message: 'Ürün oluşturuldu.' });
}
export async function putProduct(req: Request, res: Response) {
  const id = idParam(req.params.productId);
  const body = productFields.parse(req.body);
  await checkRelations(body);
  const images = files(req);
  // Replacing text never erases images unless new uploads were supplied.
  const data = await prisma.product.update({ where: { id }, data: { ...productData(body), campaignId: body.campaignId ?? null, ...(images.length ? { images } : {}) }, include });
  res.json({ data, message: 'Ürün güncellendi.' });
}
export async function patchProduct(req: Request, res: Response) {
  const id = idParam(req.params.productId);
  const fields = productData(req.body, true);
  await checkRelations(fields);
  const images = files(req);
  const data = await prisma.product.update({ where: { id }, data: { ...fields, ...(images.length ? { images } : {}) }, include });
  res.json({ data, message: 'Ürün güncellendi.' });
}
export async function getOneProduct(req: Request, res: Response) {
  const data = await prisma.product.findUnique({ where: { id: idParam(req.params.productId) }, include });
  if (!data) notFound();
  res.json({ data });
}
export async function getAllProducts(_req: Request, res: Response) { res.json({ data: await prisma.product.findMany({ include, orderBy: { id: 'desc' } }) }); }
export async function getCampaignProducts(req: Request, res: Response) { res.json({ data: await prisma.product.findMany({ where: { campaignId: idParam(req.params.campaignId) }, include }) }); }
export async function getCategoryProducts(req: Request, res: Response) { res.json({ data: await prisma.product.findMany({ where: { categoryId: idParam(req.params.categoryId) }, include }) }); }
export async function deleteProduct(req: Request, res: Response) {
  await prisma.product.delete({ where: { id: idParam(req.params.productId) } });
  // Keep existing image files: historical orders may refer to them.
  res.json({ message: 'Ürün silindi.' });
}

// Preview never writes; commit revalidates the same upload and current relations.
export async function createBulkProducts(req: Request, res: Response) { return bulkProducts(req, res, false); }
export async function previewBulkProducts(req: Request, res: Response) { return bulkProducts(req, res, true); }
async function bulkProducts(req: Request, res: Response, preview: boolean) {
  if (!req.file) throw new HttpError(400, 'FILE_REQUIRED', 'CSV veya XLSX dosyası yükleyin.');
  try {
    const categoryId = idParam(req.body.categoryId);
    const campaignId = req.body.campaignId ? idParam(req.body.campaignId) : null;
    await checkRelations({ categoryId, campaignId });
    const { products, issues } = await readProductImport(req.file);
    const checkExisting = async (db: Pick<Prisma.TransactionClient, 'product'>) => {
      const existing = await db.product.findMany({ where: { categoryId }, select: { name: true, variant: true } });
      const keys = new Set(existing.map(productKey));
      return products.filter(p => keys.has(productKey(p))).map(p => ({ row: p.row, field: 'name', reason: 'exists' as const }));
    };
    const report = (errors: ImportIssue[]) => ({
      valid: errors.length === 0, count: products.length, issueCount: errors.length, issues: errors.slice(0, 100),
      rows: products.map(({ details: _details, ...p }) => p),
    });
    if (preview) return res.json(report([...issues, ...await checkExisting(prisma)]));
    if (issues.length) return res.status(400).json({ code: 'INVALID_IMPORT', ...report(issues) });
    // Serializable duplicate check also protects a retry after a lost response.
    const result = await prisma.$transaction(async tx => {
      const conflicts = await checkExisting(tx);
      if (conflicts.length) return { conflicts, count: 0 };
      const created = await tx.product.createMany({ data: products.map(({ row: _row, ...p }) => ({ ...p, categoryId, campaignId, images: [] })) });
      return { conflicts: [], count: created.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 20000 });
    if (result.conflicts.length) return res.status(409).json({ code: 'INVALID_IMPORT', ...report(result.conflicts) });
    return res.status(201).json({ count: result.count });
  } finally { await unlink(req.file.path).catch(() => {}); }
}
