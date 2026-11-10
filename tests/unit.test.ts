import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../src/generated/prisma/index.js';
import { cartFields, addressFields, productFields, productPatch, campaignFields, orderStatusFields } from '../src/validation/commerce.js';
import { idParam } from '../src/middleware/http.js';
import { priceLines } from '../src/services/pricing.js';
import ExcelJS from 'exceljs';
import { importColumns, parseProductSheet } from '../src/services/productImport.js';

function importBook(rows: ExcelJS.CellValue[][], columns = importColumns) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Urunler');
  sheet.addRow(columns); rows.forEach(row => sheet.addRow(row));
  return book;
}
const importRow = ['Saten Elbise', 'Yumuşak dokulu saten elbise.', 'S, M, L', 12, 1890.50, 'Siyah'];
test('Excel import parses typed numbers, Turkish decimals, sizes and description', () => {
  const parsed = parseProductSheet(importBook([importRow, ['Keten Gömlek', 'Uzun kollu keten gömlek.', 'M|L', '0', '999,90', 'Beyaz']]));
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.products[0].price, '1890.5');
  assert.equal(parsed.products[0].details, importRow[1]);
  assert.deepEqual(parsed.products[1].sizes, ['M', 'L']);
  assert.equal(parsed.products[1].price, '999.90');
  assert.equal(parsed.products[1].total_qty, 0);
});
test('Excel import reports row/field errors and rejects formulas and duplicate products', () => {
  const book = importBook([importRow, [...importRow.slice(0, 3), -1, 12, 'Beyaz'], [...importRow.slice(0, 4), { formula: '1+1', result: 2 }, 'Mavi'], importRow]);
  const result = parseProductSheet(book);
  assert.deepEqual(result.issues, [
    { row: 3, field: 'total_qty', reason: 'invalid' },
    { row: 4, field: 'price', reason: 'cell_type' },
    { row: 5, field: 'name', reason: 'duplicate' },
  ]);
  const invalidRows = [
    ['name', 'x'], ['details', 'short'], ['sizes', 'M,M'], ['sizes', ''], ['total_qty', '2.5'], ['total_qty', '2147483648'], ['price', '12.345'], ['price', '1.890,50'], ['variant', ''], ['price', new Date()],
  ];
  for (const [field, value] of invalidRows) {
    const row: ExcelJS.CellValue[] = [...importRow]; row[importColumns.indexOf(String(field))] = value;
    assert.ok(parseProductSheet(importBook([row])).issues.length, `${field}: ${value}`);
  }
});
test('Excel import accepts legacy columns, ignores empty rows, rejects empty/malformed/oversized sheets', () => {
  assert.deepEqual(parseProductSheet(importBook([['Legacy product', 'S|M', '1', '10.00', 'Siyah']], ['name', 'sizes', 'total_qty', 'price', 'variant'])).products[0].details, '');
  assert.equal(parseProductSheet(importBook([[], importRow])).products[0].row, 3);
  assert.throws(() => parseProductSheet(importBook([[]])));
  assert.throws(() => parseProductSheet(importBook([importRow], ['name', 'name', 'sizes', 'total_qty', 'price', 'variant'])));
  const huge = importBook([importRow]); huge.worksheets[0].getCell('A1002').value = 'overflow';
  assert.throws(() => parseProductSheet(huge));
});

test('IDs reject partial strings, negative values and overflow', () => {
  assert.equal(idParam('123'), 123);
  for (const value of ['1oops', '-1', '0', '1.2', '2147483648', undefined]) assert.throws(() => idParam(value));
});
test('cart accepts only product, size and bounded integer quantity', () => {
  const line = { productId: 1, size: 'M', quantity: 1 };
  assert.ok(cartFields.safeParse([line]).success);
  for (const extra of [{ price: '0.01' }, { cartId: 99 }, { name: 'spoof' }]) assert.equal(cartFields.safeParse([{ ...line, ...extra }]).success, false);
  for (const quantity of [-1, 0, 1.5, 100]) assert.equal(cartFields.safeParse([{ ...line, quantity }]).success, false);
  assert.equal(cartFields.safeParse([line, line]).success, false);
});
test('address ownership cannot be supplied by the client', () => {
  const data = { name: 'Ev adresi', phone: '5551234567', address: 'Örnek Mahallesi No 12', city: 'İstanbul', zipCode: '34000' };
  assert.ok(addressFields.safeParse(data).success);
  assert.equal(addressFields.safeParse({ ...data, userId: 2 }).success, false);
});
test('multipart values are parsed without coercing empty or invalid quantities', () => {
  const data = { name: 'Örnek ürün', details: 'Örnek ürün açıklaması', sizesString: 'S, M', total_qty: '5', price: '19.99', categoryId: '1', variant: 'Siyah', campaignId: '' };
  const parsed = productFields.parse(data);
  assert.equal(parsed.total_qty, 5); assert.equal(parsed.campaignId, null);
  assert.equal(productFields.safeParse({ ...data, total_qty: '' }).success, false);
  assert.equal(productFields.safeParse({ ...data, sizesString: 'M,M' }).success, false);
  assert.equal(productFields.safeParse({ ...data, categoryId: 0 }).success, false);
  assert.ok(productPatch.safeParse({ price: '21.25' }).success);
  assert.equal(productPatch.safeParse({}).success, false);
  assert.equal(campaignFields.safeParse({ name: 'Sale', discount: 101 }).success, false);
});
test('orders cannot alter payment, ownership or line values through status updates', () => {
  assert.ok(orderStatusFields.safeParse({ status: 'KARGODA' }).success);
  for (const extra of [{ payment: { status: 'PAID' } }, { userId: 42 }, { addressId: 4 }, { subtotal: 0 }]) assert.equal(orderStatusFields.safeParse({ status: 'KARGODA', ...extra }).success, false);
});
const product = { id: 1, name: 'Ürün', sizes: ['S','M'], total_qty: 3, price: new Prisma.Decimal('19.99'), images: ['one.jpg'], campaign: { discount: 10 } };
const tx = { product: { findMany: async () => [product] } } as unknown as Prisma.TransactionClient;
test('pricing uses database values and exact decimal rounding', async () => {
  const { quoted, subtotal } = await priceLines(tx, [{ productId: 1, size: 'M', quantity: 2 }]);
  assert.equal(quoted[0].name, 'Ürün'); assert.equal(quoted[0].price.toString(), '17.99'); assert.equal(subtotal.toString(), '35.98');
});
test('pricing rejects missing products, invalid sizes and combined overstock', async () => {
  for (const lines of [[{ productId: 2, size: 'M', quantity: 1 }], [{ productId: 1, size: 'XL', quantity: 1 }], [{ productId: 1, size: 'S', quantity: 2 }, { productId: 1, size: 'M', quantity: 2 }]]) await assert.rejects(priceLines(tx, lines));
});
