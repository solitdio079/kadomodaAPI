import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { productFields, productPatch, positiveId } from '../validation/commerce.js';
import { validate, idParam, notFound, HttpError } from '../middleware/http.js';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import path from 'node:path';
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

const csvProduct = z.object({
  name: z.string().trim().min(3).max(200),
  sizes: z.string().transform(v => v.split('|').map(s => s.trim())).pipe(z.array(z.string().min(1).max(20)).min(1).max(20)).refine(s => new Set(s).size === s.length),
  total_qty: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative().max(2147483647)),
  price: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/), variant: z.string().trim().min(1).max(100),
});
const columns = ['name', 'sizes', 'total_qty', 'price', 'variant'];
export async function createBulkProducts(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, 'FILE_REQUIRED', 'CSV veya XLSX dosyası yükleyin.');
  try {
    const categoryId = idParam(req.body.categoryId);
    const campaignId = req.body.campaignId ? idParam(req.body.campaignId) : null;
    await checkRelations({ categoryId, campaignId });
    const workbook = new ExcelJS.Workbook();
    try {
      if (path.extname(req.file.originalname).toLowerCase() === '.csv') await workbook.csv.readFile(req.file.path, { map: (value: string) => value });
      else await workbook.xlsx.readFile(req.file.path);
    } catch { throw new HttpError(400, 'INVALID_FILE', 'Dosya okunamadı. CSV veya XLSX biçimini kontrol edin.'); }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2 || sheet.rowCount > 1001) throw new HttpError(400, 'ROW_LIMIT', 'Dosya 1 ile 1000 arasında ürün içermelidir.');
    const headers = Array.from({ length: sheet.columnCount }, (_, i) => sheet.getRow(1).getCell(i + 1).text.trim());
    if (headers.length !== columns.length || !columns.every(c => headers.includes(c))) throw new HttpError(400, 'INVALID_COLUMNS', 'Sütunlar name, sizes, total_qty, price, variant olmalıdır.');
    const products: z.infer<typeof csvProduct>[] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const values = headers.map((_, i) => row.getCell(i + 1).text.trim());
      if (values.every(v => v === '')) return;
      const parsed = csvProduct.safeParse(Object.fromEntries(headers.map((h, i) => [h, values[i]])));
      if (!parsed.success) throw new HttpError(400, 'INVALID_ROW', `${number}. satırdaki ürün bilgilerini kontrol edin. Hiçbir ürün eklenmedi.`);
      products.push(parsed.data);
    });
    if (!products.length) throw new HttpError(400, 'EMPTY_FILE', 'Dosyada ürün bulunamadı.');
    const result = await prisma.product.createMany({ data: products.map(p => ({ ...p, categoryId, campaignId })) });
    res.status(201).json({ count: result.count });
  } finally { await unlink(req.file.path).catch(() => {}); }
}
