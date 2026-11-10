import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';

// Fail closed before dotenv/imports. Never use the application's DATABASE_URL for tests.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL is required; use a disposable local database named kadomoda_test.');
const parsed = new URL(testUrl);
if (!['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.pathname !== '/kadomoda_test') throw new Error('Integration tests only allow a local kadomoda_test database.');
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;
process.env.SECRET_KEY = randomUUID() + randomUUID();
process.env.BREVO_API_KEY = 'test-unused-no-email-sent';
const uploadDir = await mkdtemp(path.join(tmpdir(), 'kadomoda-uploads-test-'));
process.env.UPLOAD_DIR = uploadDir;
process.env.IMPORT_DIR = await mkdtemp(path.join(tmpdir(), 'kadomoda-imports-test-'));
const { prisma } = await import('../src/lib/prisma.js');
const { createApp } = await import('../src/server.js');
const { bootstrapAdmin } = await import('../scripts/bootstrap-admin.js');
const { seedDemo } = await import('../scripts/seed-demo.js');
const { hashPassword } = await import('../src/utils/password.js');
const { default: jwt } = await import('jsonwebtoken');
let server: Server, base: string, adminToken: string, ownerToken: string, otherToken: string;
let adminId: number, ownerId: number, otherId: number, categoryId: number, otherCategoryId: number, productId: number, cartId: number, addressId: number;
const pwd = `T-${randomUUID()}!`;
const address = { name: 'Ev adresi', phone: '5551234567', address: 'Örnek Mahallesi No 12', city: 'İstanbul', zipCode: '34000' };
async function request(url: string, { token, method = 'GET', body }: { token?: string; method?: string; body?: unknown } = {}) {
  const response = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  assert.equal(await prisma.user.count(), 0, 'Use a fresh disposable database for this test run.');
  const admin = await bootstrapAdmin('admin@example.test', 'Test Admin', pwd); adminId = admin.id;
  const owner = await prisma.user.create({ data: { email: 'owner@example.test', name: 'Owner', pwd: await hashPassword(pwd) } }); ownerId = owner.id;
  const other = await prisma.user.create({ data: { email: 'other@example.test', name: 'Other', pwd: await hashPassword(pwd) } }); otherId = other.id;
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const addr = server.address(); assert.ok(addr && typeof addr !== 'string'); base = `http://127.0.0.1:${addr.port}`;
  for (const [email, assign] of [['admin@example.test', (s: string) => { adminToken = s; }], ['owner@example.test', (s: string) => { ownerToken = s; }], ['other@example.test', (s: string) => { otherToken = s; }]] as const) {
    const result = await request('/auth/login', { method: 'POST', body: { email, password: pwd } }); assert.equal(result.status, 200); assign(result.body.token);
  }
  categoryId = (await prisma.category.create({ data: { name: 'Elbiseler' } })).id;
  otherCategoryId = (await prisma.category.create({ data: { name: 'Ceketler' } })).id;
  productId = (await prisma.product.create({ data: { name: 'Test elbise', details: 'Test ürün açıklaması', categoryId, price: '19.99', sizes: ['S','M'], total_qty: 3, variant: 'Siyah', images: ['original.jpg'] } })).id;
});
after(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); await prisma.$disconnect(); await rm(uploadDir, { recursive: true, force: true }); await rm(process.env.IMPORT_DIR!, { recursive: true, force: true }); });

test('health, public catalog and allowed CORS preflight work without a token', async () => {
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/product')).status, 200);
  const response = await fetch(base + '/product', { method: 'OPTIONS', headers: { Origin: 'https://kadomoda.com', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), 'https://kadomoda.com');
  const denied = await fetch(base + '/product', { headers: { Origin: 'https://untrusted.example' } }); assert.equal(denied.status, 403);
});
test('catalog mutations require ADMIN before uploads or database changes', async () => {
  for (const [url, method, body] of [['/category','POST',{name:'Bad'}], [`/category/${categoryId}`,'DELETE',undefined], ['/campaign','POST',{name:'Bad',discount:20}], [`/product/${productId}`,'DELETE',undefined], ['/product','POST',{}], ['/product/bulk','POST',{}], ['/product/bulk/preview','POST',{}]] as const) {
    assert.equal((await request(url, { method, body, token: ownerToken })).status, 403);
    assert.equal((await request(url, { method, body })).status, 401);
  }
  assert.equal(await prisma.product.count(), 1);
});

test('PUT updates the same ID, parses multipart numbers and preserves images', async () => {
  const form = new FormData();
  for (const [key,value] of Object.entries({ name: 'Edited elbise', details: 'Yeni test ürün açıklaması', sizesString: 'S,M', total_qty: '3', price: '19.99', categoryId: String(categoryId), variant: 'Siyah' })) form.set(key, value);
  const response = await fetch(base + `/product/${productId}`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
  const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); assert.equal(body.data.id, productId); assert.deepEqual(body.data.images, ['original.jpg']); assert.equal(await prisma.product.count(), 1);
  const patch = await request(`/product/${productId}`, { method: 'PATCH', token: adminToken, body: { details: 'Sadece açıklama değişti.' } }); assert.equal(patch.status, 200); assert.equal(patch.body.data.price, '19.99');
});
test('category filtering is independent of campaign ID and invalid IDs return 400', async () => {
  assert.equal((await request(`/product/category/${categoryId}`)).body.data.length, 1);
  assert.equal((await request(`/product/category/${otherCategoryId}`)).body.data.length, 0);
  assert.equal((await request('/product/1oops')).status, 400);
});
test('address reads, updates and deletes enforce ownership; zipCode maps to zipcode', async () => {
  const created = await request('/address', { method: 'POST', token: ownerToken, body: address }); assert.equal(created.status, 201); addressId = created.body.data.id; assert.equal(created.body.data.zipcode, '34000');
  for (const method of ['GET','PUT','DELETE']) assert.equal((await request(`/address/${addressId}`, { method, token: otherToken, ...(method === 'PUT' ? {body:address} : {}) })).status, 404);
  assert.equal((await request('/address', { method: 'POST', token: ownerToken, body: { ...address, userId: otherId } })).status, 400);
  assert.equal((await prisma.address.findUniqueOrThrow({ where: { id: addressId } })).userId, ownerId);
});
test('cart writes are atomic, use server prices, reject tampering and reset totals', async () => {
  const created = await request('/cart', { method: 'POST', token: ownerToken }); cartId = created.body.data.id;
  assert.equal((await request('/cart', { method: 'POST', token: ownerToken })).body.data.id, cartId);
  const lines = [{ productId, size: 'M', quantity: 2 }];
  assert.equal((await request(`/cart/${cartId}`, { method: 'PUT', token: otherToken, body: lines })).status, 404);
  assert.equal((await request(`/cart/${cartId}`, { method: 'DELETE', token: otherToken })).status, 404);
  assert.equal((await request(`/cart/${cartId}`, { method: 'PUT', token: ownerToken, body: [{ ...lines[0], price: '0.01' }] })).status, 400);
  const result = await request(`/cart/${cartId}`, { method: 'PUT', token: ownerToken, body: lines }); assert.equal(result.status, 200); assert.equal(result.body.data.subtotal, '39.98'); assert.equal(result.body.data.cartProducts[0].price, '19.99');
  assert.equal((await request(`/cart/${cartId}`, { method: 'PUT', token: ownerToken, body: [{ productId, size: 'S', quantity: 2 }, ...lines] })).status, 409);
  assert.equal((await request('/cart', { token: ownerToken })).body.data.subtotal, '39.98');
  const cleared = await request(`/cart/${cartId}`, { method: 'DELETE', token: ownerToken }); assert.equal(cleared.body.data.subtotal, '0'); assert.deepEqual(cleared.body.data.cartProducts, []);
});
test('order creation is closed and customer cannot alter status or payment', async () => {
  assert.equal((await request('/order', { method: 'POST' })).status, 401);
  assert.equal((await request('/order', { method: 'POST', token: ownerToken, body: {} })).status, 503);
  const order = await prisma.order.create({ data: { userId: ownerId, addressId, subtotal: '19.99', payment: { create: { status: 'UNPAID' } } } });
  assert.equal((await request(`/address/${addressId}`, { method: 'PUT', token: ownerToken, body: address })).status, 409);
  assert.equal((await request(`/order/${order.id}`, { token: otherToken })).status, 404);
  assert.equal((await request(`/order/${order.id}`, { method: 'PUT', token: ownerToken, body: { status: 'IPTAL' } })).status, 403);
  assert.equal((await request(`/order/${order.id}`, { method: 'PUT', token: adminToken, body: { status: 'KARGODA', payment: { status: 'PAID' } } })).status, 400);
  assert.equal((await request(`/order/${order.id}`, { method: 'PUT', token: adminToken, body: { status: 'KARGODA' } })).status, 409);
  assert.equal((await request(`/order/${order.id}`, { method: 'PUT', token: adminToken, body: { status: 'IPTAL' } })).status, 200);
  assert.equal((await request(`/order/${order.id}`, { method: 'PUT', token: adminToken, body: { status: 'PROCESSING' } })).status, 409);
  assert.equal((await request(`/order/${order.id}`, { method: 'DELETE', token: adminToken })).status, 405);
});
test('email-purpose JWTs cannot authenticate as access tokens', async () => {
  const token = jwt.sign({ id: adminId, purpose: 'email_verify' }, process.env.SECRET_KEY!, { expiresIn: '1h' });
  assert.equal((await request('/users', { token })).status, 401);
});
test('failed validation returns safe JSON and invalid image uploads are removed', async () => {
  const form = new FormData(); form.set('images', new Blob(['<html>not an image</html>'], {type:'image/png'}), 'fake.png');
  const response = await fetch(base + '/product', { method: 'POST', headers: {Authorization:`Bearer ${adminToken}`}, body:form });
  assert.equal(response.status, 400); assert.deepEqual(await readdir(uploadDir), []);
  const bad = await request('/category', { method:'POST', token:adminToken, body:{name:''} }); assert.equal(bad.status,400); assert.equal(bad.body.code,'VALIDATION_ERROR');
});
test('bootstrap is idempotent, does not reset passwords, seeds have valid relations and tracked IDs', async () => {
  assert.equal((await bootstrapAdmin('admin@example.test','Admin',pwd)).id,adminId);
  await assert.rejects(bootstrapAdmin('admin@example.test','Admin','WrongPassword123!'));
  const ids=await seedDemo(); assert.equal(ids.length,8); assert.deepEqual(await seedDemo(),ids);
  assert.equal(await prisma.product.count({where:{isDemo:true}}),8);
  const seeded=await prisma.product.findUniqueOrThrow({where:{id:ids[0]}}); assert.ok(seeded.categoryId > 0); assert.equal(seeded.campaignId,null); assert.ok(seeded.seedKey?.startsWith('luxury-preview-v1:'));
  assert.equal((await request(`/product/${ids[0]}`,{method:'DELETE',token:adminToken})).status,200);
});

test('site content drafts stay private, publication requires admin and complete content, stale writes fail', async () => {
  assert.deepEqual((await request('/site-content')).body.data, []);
  assert.equal((await request('/site-content/admin')).status, 401);
  assert.equal((await request('/site-content/admin', { token: ownerToken })).status, 403);
  const initial = await request('/site-content/admin', { token: adminToken });
  assert.equal(initial.body.data.length, 6);
  const draft = { revision: 0, action: 'save', content: { body: 'Private draft — not ready' } };
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: ownerToken, body: draft })).status, 403);
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: draft })).status, 200);
  assert.deepEqual((await request('/site-content')).body.data, []);
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: draft })).status, 409);
  const publish = { revision: 1, action: 'publish', confirmed: true, content: { body: 'Mağazamız hakkında test metni. '.repeat(6) } };
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: { ...publish, confirmed: false } })).status, 400);
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: { ...publish, content: { body: 'Too short' } } })).status, 400);
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: publish })).status, 200);
  assert.equal((await request('/site-content')).body.data[0].content.body, publish.content.body.trim());
  const secretDraft = { revision: 2, action: 'save', content: { body: 'Unpublished changes' } };
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: secretDraft })).status, 200);
  const visible = await request('/site-content');
  assert.equal(visible.body.data[0].content.body, publish.content.body.trim());
  assert.ok(!JSON.stringify(visible.body).includes('Unpublished changes'));
  assert.equal((await request('/site-content/admin/about', { method: 'PUT', token: adminToken, body: { ...secretDraft, revision: 3, action: 'unpublish' } })).status, 200);
  assert.deepEqual((await request('/site-content')).body.data, []);
  const business = initial.body.data.find((row: { slug: string }) => row.slug === 'business').draft;
  assert.equal((await request('/site-content/admin/business', { method: 'PUT', token: adminToken, body: { revision: 0, action: 'publish', confirmed: true, content: business } })).status, 400);
  const complete = { ...business, legalName: 'Test İşletmesi', address: 'Test Mahallesi Numara 1 İstanbul', email: 'test@example.test', phone: '+905551234567', returnAddress: 'Test İade Adresi Numara 1 İstanbul', taxOffice: 'Test Dairesi', taxNumber: '1234567890', shippingFee: 'Test kargo bedeli', dispatchTime: 'Test hazırlık süresi', deliveryTime: 'Test teslimat süresi' };
  assert.equal((await request('/site-content/admin/business', { method: 'PUT', token: adminToken, body: { revision: 0, action: 'publish', confirmed: true, content: complete } })).status, 200);
  assert.equal((await request('/site-content')).body.data[0].content.legalName, 'Test İşletmesi');
});

test('Excel template previews without writes, imports atomically, prevents duplicates, then accepts photos', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(new URL('../../kadoModaClient/public/templates/kado-moda-urun-sablonu.xlsx', import.meta.url).pathname);
  const sheet = workbook.getWorksheet('Urunler')!;
  sheet.getRow(2).values = ['Toplu Saten Elbise', 'Yumuşak dokulu saten elbise.', 'S, M, L', 12, 1890.50, 'Siyah'];
  sheet.getRow(3).values = ['Toplu Keten Gömlek', 'Uzun kollu keten gömlek.', 'M|L', 4, '999,90', 'Beyaz'];
  const campaign = await prisma.campaign.create({ data: { name: 'Bulk test campaign', discount: 10 } });
  const send = async (endpoint: string, category = String(categoryId), bytes?: ArrayBuffer) => {
    const form = new FormData(); form.set('categoryId', category); form.set('campaignId', String(campaign.id));
    form.set('file', new Blob([bytes ?? await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer]), 'products.xlsx');
    const response = await fetch(base + endpoint, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
    return { status: response.status, body: await response.json() };
  };
  const before = await prisma.product.count();
  let preview = await send('/product/bulk/preview');
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.valid, true); assert.equal(preview.body.count, 2);
  assert.equal(await prisma.product.count(), before);
  assert.deepEqual(await readdir(process.env.IMPORT_DIR!), []);
  sheet.getCell('E3').value = 'bad price';
  const invalid = await send('/product/bulk');
  assert.equal(invalid.status, 400); assert.equal(invalid.body.issues[0].row, 3); assert.equal(invalid.body.issues[0].field, 'price');
  assert.equal(await prisma.product.count(), before);
  sheet.getCell('E3').value = '999,90';
  assert.equal((await send('/product/bulk', '2147483647')).status, 400);
  assert.equal((await send('/product/bulk', String(categoryId), new TextEncoder().encode('not xlsx').buffer)).status, 400);
  const created = await send('/product/bulk');
  assert.equal(created.status, 201, JSON.stringify(created.body)); assert.equal(created.body.count, 2);
  assert.equal(await prisma.product.count(), before + 2);
  const product = await prisma.product.findFirstOrThrow({ where: { name: 'Toplu Saten Elbise' } });
  assert.equal(product.details, 'Yumuşak dokulu saten elbise.'); assert.equal(product.campaignId, campaign.id);
  assert.equal(product.price.toString(), '1890.5'); assert.deepEqual(product.images, []);
  assert.deepEqual(product.sizes, ['S', 'M', 'L']);
  const again = await send('/product/bulk'); assert.equal(again.status, 409); assert.equal(again.body.issues[0].reason, 'exists');
  assert.equal(await prisma.product.count(), before + 2);
  preview = await send('/product/bulk/preview'); assert.equal(preview.body.valid, false);
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: product.name, details: product.details, sizesString: product.sizes.join(', '), total_qty: String(product.total_qty), price: product.price.toString(), variant: product.variant, categoryId: String(product.categoryId), campaignId: String(campaign.id) })) form.set(key, value);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLPsAAAAASUVORK5CYII=', 'base64');
  form.set('images', new Blob([png], { type: 'image/png' }), 'product.png');
  const response = await fetch(base + `/product/${product.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
  const withPhoto = await response.json();
  assert.equal(response.status, 200, JSON.stringify(withPhoto)); assert.equal(withPhoto.data.images.length, 1);
  assert.equal(withPhoto.data.id, product.id); assert.equal(withPhoto.data.details, product.details);
  assert.equal((await fetch(base + '/' + withPhoto.data.images[0])).status, 200);
  sheet.getRow(2).values = ['Eşzamanlı Ürün', 'Eşzamanlı yükleme test ürünü.', 'M', 2, 500, 'Mavi'];
  sheet.getRow(3).values = [];
  const concurrent = await Promise.all([send('/product/bulk'), send('/product/bulk')]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
  assert.equal(await prisma.product.count({ where: { name: 'Eşzamanlı Ürün' } }), 1);
  assert.deepEqual(await readdir(process.env.IMPORT_DIR!), []);
});

test('reference categories are seeded, editable as a tree, cycle-safe, and include descendant products', async () => {
  const seeded = await prisma.category.findMany({ where: { slug: { not: null } } });
  assert.equal(seeded.length, 63);
  const upper = seeded.find(c => c.slug === 'ust-giyim')!;
  const dress = seeded.find(c => c.slug === 'ust-giyim/elbise')!;
  assert.equal(dress.parentId, upper.id);
  assert.equal(seeded.filter(c => c.name === 'OVERSIZE').length, 2);
  const parent = await request('/category', { method: 'POST', token: adminToken, body: { name: 'Yeni ana kategori' } });
  assert.equal(parent.status, 201);
  const child = await request('/category', { method: 'POST', token: adminToken, body: { name: 'Yeni alt kategori', parentId: parent.body.data.id } });
  assert.equal(child.status, 201); assert.equal(child.body.data.parentId, parent.body.data.id);
  const leaf = await request('/category', { method: 'POST', token: adminToken, body: { name: 'Yeni yaprak kategori', parentId: child.body.data.id } });
  assert.equal(leaf.status, 201);
  await prisma.product.create({ data: { name: 'Alt kategoride ürün', details: 'Alt kategoride test ürün açıklaması', categoryId: leaf.body.data.id, price: '10', sizes: ['M'], total_qty: 1, variant: 'Siyah' } });
  const result = await request(`/product/category/${parent.body.data.id}`);
  assert.equal(result.status, 200); assert.equal(result.body.data.length, 1); assert.equal(result.body.data[0].categoryId, leaf.body.data.id);
  const cycle = await request(`/category/${parent.body.data.id}`, { method: 'PUT', token: adminToken, body: { name: 'Döngü', parentId: leaf.body.data.id } });
  assert.equal(cycle.status, 400); assert.equal(cycle.body.code, 'CATEGORY_CYCLE');
  assert.equal((await request('/category', { method: 'POST', token: adminToken, body: { name: 'Geçersiz üst', parentId: 2147483647 } })).status, 400);
  assert.equal((await request(`/category/${parent.body.data.id}`, { method: 'DELETE', token: adminToken })).status, 409);
  assert.equal((await request(`/category/${leaf.body.data.id}`, { method: 'DELETE', token: adminToken })).status, 409);
  const renamed = await request(`/category/${child.body.data.id}`, { method: 'PUT', token: adminToken, body: { name: 'Yeni isim' } });
  assert.equal(renamed.status, 200); assert.equal(renamed.body.data.parentId, parent.body.data.id);
});
