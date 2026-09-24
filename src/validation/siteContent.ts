import { z } from 'zod';
export const contentSlugs = ['business', 'about', 'privacy', 'distance-sales', 'delivery', 'returns'] as const;
export const contentSlug = z.enum(contentSlugs);
export const businessFields = z.object({
  legalName: z.string().trim().max(200), address: z.string().trim().max(1000),
  email: z.string().trim().max(254), phone: z.string().trim().max(40),
  returnAddress: z.string().trim().max(1000), taxOffice: z.string().trim().max(150),
  taxNumber: z.string().trim().max(30), mersis: z.string().trim().max(30),
  kep: z.string().trim().max(254), chamber: z.string().trim().max(200),
  professionalRules: z.string().trim().max(2000),
  shippingFee: z.string().trim().max(300), dispatchTime: z.string().trim().max(300), deliveryTime: z.string().trim().max(300),
}).strict();
export const pageFields = z.object({ body: z.string().trim().max(25000) }).strict();
export const contentRequest = z.object({
  revision: z.number().int().min(0).max(2147483646),
  action: z.enum(['save', 'publish', 'unpublish']),
  confirmed: z.boolean().optional(),
  content: z.unknown(),
}).strict();
export function parseContent(slug: string, content: unknown, publish: boolean) {
  if (slug !== 'business') return (publish ? pageFields.extend({ body: z.string().trim().min(100).max(25000) }) : pageFields).parse(content);
  const data = businessFields.parse(content);
  if (publish) businessFields.extend({
    legalName: z.string().min(2), address: z.string().min(10),
    email: z.string().email(), phone: z.string().regex(/^\+?[\d ()-]{7,40}$/),
    returnAddress: z.string().min(10), taxOffice: z.string().min(2), taxNumber: z.string().regex(/^\d{10,11}$/),
    shippingFee: z.string().min(2), dispatchTime: z.string().min(2), deliveryTime: z.string().min(2),
    kep: z.union([z.literal(''), z.string().email()]),
  }).parse(data);
  return data;
}
export function blankContent(slug: string) {
  return slug === 'business' ? Object.fromEntries(Object.keys(businessFields.shape).map(key => [key, ''])) : { body: '' };
}
