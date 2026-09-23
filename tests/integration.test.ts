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
  for (const [url, method, body] of [['/category','POST',{name:'Bad'}], [`/category/${categoryId}`,'DELETE',undefined], ['/campaign','POST',{name:'Bad',discount:20}], [`/product/${productId}`,'DELETE',undefined], ['/product','POST',{}], ['/product/bulk','POST',{}]] as const) {
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
