import { z } from 'zod';
export const positiveId = z.number().int().positive().max(2147483647);
const formInteger = z.preprocess(v => typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v, z.number().int().min(0).max(2147483647));
const relationId = z.preprocess(v => typeof v === 'string' && /^[1-9]\d*$/.test(v) ? Number(v) : v, positiveId);
const optionalCampaign = z.preprocess(v => v === '' || v === 'null' ? null : v, relationId.nullable());
const sizesString = z.string().trim().max(200).refine(v => {
  const sizes = v.split(',').map(s => s.trim());
  return sizes.length <= 20 && sizes.every(s => s.length > 0 && s.length <= 20) && new Set(sizes).size === sizes.length;
});
export const productFields = z.object({
  name: z.string().trim().min(3).max(200), details: z.string().trim().min(10).max(10000),
  sizesString, total_qty: formInteger,
  price: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
  categoryId: relationId, campaignId: optionalCampaign.optional(),
  variant: z.string().trim().min(1).max(100),
}).strict();
export const productPatch = productFields.partial().refine(v => Object.keys(v).length > 0);
export const categoryFields = z.object({ name: z.string().trim().min(2).max(100) }).strict();
export const campaignFields = z.object({ name: z.string().trim().min(3).max(150), discount: formInteger.refine(v => v <= 100) }).strict();
export const campaignPatch = campaignFields.partial().refine(v => Object.keys(v).length > 0);
export const addressFields = z.object({
  name: z.string().trim().min(2).max(120), phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/),
  address: z.string().trim().min(10).max(1000), city: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100).default('Türkiye'),
  zipCode: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/),
}).strict();
// Ownership, names, images and prices come from the server, never the payload.
export const cartLineFields = z.object({ productId: positiveId, size: z.string().trim().min(1).max(20), quantity: z.number().int().min(1).max(99) }).strict();
export const cartFields = z.array(cartLineFields).max(100).refine(lines => new Set(lines.map(l => `${l.productId}:${l.size}`)).size === lines.length);
export const orderStatusFields = z.object({ status: z.enum(['PROCESSING','KARGODA','TESLIM_EDILDI','IPTAL']) }).strict();
