import ExcelJS from 'exceljs';
import path from 'node:path';
import { HttpError } from '../middleware/http.js';
import { productFields } from '../validation/commerce.js';

export const importColumns = ['name', 'details', 'sizes', 'total_qty', 'price', 'variant'];
export type ImportIssue = { row: number; field: string; reason: 'invalid' | 'cell_type' | 'duplicate' | 'exists' };
export type ImportProduct = { row: number; name: string; details: string; sizes: string[]; total_qty: number; price: string; variant: string };
export const productKey = (p: { name: string; variant: string }) => JSON.stringify([p.name.trim().toLocaleLowerCase('tr-TR'), p.variant.trim().toLocaleLowerCase('tr-TR')]);

// Parsing is shared by preview and commit. Excel formula caches, hyperlinks,
// dates, and errors are never accepted as product values.
export function parseProductSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet('Urunler') ?? workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2 || sheet.rowCount > 1001 || sheet.columnCount > 6)
    throw new HttpError(400, 'ROW_LIMIT', 'Dosya en fazla 1000 ürün satırı içermelidir.');
  const headers = Array.from({ length: sheet.columnCount }, (_, i) => sheet.getRow(1).getCell(i + 1).text.trim().replace(/^\uFEFF/, ''));
  const legacy = headers.length === 5 && !headers.includes('details');
  const expected = legacy ? importColumns.filter(c => c !== 'details') : importColumns;
  if (headers.length !== expected.length || new Set(headers).size !== expected.length || !expected.every(c => headers.includes(c)))
    throw new HttpError(400, 'INVALID_COLUMNS', 'Şablondaki sütun başlıklarını koruyun.');
  const products: ImportProduct[] = [], issues: ImportIssue[] = [];
  const seen = new Set<string>();
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const cells = headers.map((_, i) => row.getCell(i + 1));
    if (cells.every(c => c.value == null || c.value === '')) return;
    const invalid = cells.findIndex(c => c.value != null && typeof c.value !== 'string' && typeof c.value !== 'number');
    if (invalid !== -1) { issues.push({ row: number, field: headers[invalid], reason: 'cell_type' }); return; }
    const values = Object.fromEntries(headers.map((h, i) => [h, String(cells[i].value ?? '').trim()]));
    const sizesString = values.sizes.replace(/\|/g, ',');
    const parsed = productFields.safeParse({
      name: values.name, details: legacy ? 'Legacy import' : values.details,
      sizesString, total_qty: values.total_qty, price: values.price.replace(',', '.'), variant: values.variant, categoryId: 1,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push({ row: number, field: issue.path[0] === 'sizesString' ? 'sizes' : String(issue.path[0]), reason: 'invalid' });
      return;
    }
    const key = productKey(parsed.data);
    if (seen.has(key)) { issues.push({ row: number, field: 'name', reason: 'duplicate' }); return; }
    seen.add(key);
    const { name, variant, price, total_qty, details } = parsed.data;
    products.push({ row: number, name, variant, price, total_qty, details: legacy ? '' : details, sizes: sizesString.split(',').map(s => s.trim()) });
  });
  if (!products.length && !issues.length) throw new HttpError(400, 'EMPTY_FILE', 'Dosyada ürün bulunamadı.');
  return { products, issues };
}

export async function readProductImport(file: { originalname: string; path: string }) {
  const workbook = new ExcelJS.Workbook();
  try {
    if (path.extname(file.originalname).toLowerCase() === '.csv') await workbook.csv.readFile(file.path, { map: (value: string) => value });
    else await workbook.xlsx.readFile(file.path);
  } catch { throw new HttpError(400, 'INVALID_FILE', 'Dosya okunamadı. CSV veya XLSX biçimini kontrol edin.'); }
  return parseProductSheet(workbook);
}
