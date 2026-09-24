import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { authenticate } from '../middleware/auth.js';
import admin from '../utils/verifyIfAdmin.js';
import { HttpError } from '../middleware/http.js';
import { blankContent, contentSlugs, contentSlug, contentRequest, parseContent } from '../validation/siteContent.js';
const router = Router();
router.get('/', async (_req, res) => {
  const rows = await prisma.siteContent.findMany({ select: { slug: true, published: true, publishedAt: true } });
  res.set('Cache-Control', 'no-store').json({ data: rows.filter(row => row.published !== null).map(row => ({ slug: row.slug, content: row.published, publishedAt: row.publishedAt })) });
});
router.get('/admin', authenticate, admin, async (_req, res) => {
  const rows = await prisma.siteContent.findMany();
  res.set('Cache-Control', 'no-store').json({ data: contentSlugs.map(slug => rows.find(row => row.slug === slug) ?? { slug, draft: blankContent(slug), published: null, revision: 0, publishedAt: null, updatedAt: null }) });
});
router.put('/admin/:slug', authenticate, admin, async (req, res) => {
  const slug = contentSlug.parse(req.params.slug);
  const { revision, action, content, confirmed } = contentRequest.parse(req.body);
  if (action === 'publish' && confirmed !== true) throw new HttpError(400, 'CONFIRM_REQUIRED', 'Yayımlamadan önce bilgilerin doğruluğunu onaylayın.');
  const draft = parseContent(slug, content, action === 'publish');
  const data = await prisma.$transaction(async tx => {
    const existing = await tx.siteContent.findUnique({ where: { slug } });
    if ((existing?.revision ?? 0) !== revision) throw new HttpError(409, 'CONTENT_CONFLICT', 'Bu metin başka bir oturumda değişti. Güncel kaydı yükleyip tekrar deneyin.');
    const values = {
      draft, revision: revision + 1,
      ...(action === 'publish' ? { published: draft, publishedAt: new Date() } : {}),
      ...(action === 'unpublish' ? { published: Prisma.DbNull, publishedAt: null } : {}),
    };
    return tx.siteContent.upsert({ where: { slug }, create: { slug, ...values }, update: values });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.set('Cache-Control', 'no-store').json({ data });
});
export default router;
