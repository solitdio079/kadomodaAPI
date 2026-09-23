import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { Prisma } from '../generated/prisma/index.js';
import multer from 'multer';
import { unlink } from 'node:fs/promises';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function idParam(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)
    throw new HttpError(400, 'INVALID_ID', 'Geçerli bir kayıt numarası belirtin.');
  return Number(value);
}
export const validate = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};
export const requireUser = (req: Request) => {
  if (!req.user) throw new HttpError(401, 'AUTH_REQUIRED', 'Lütfen giriş yapın.');
  return req.user;
};
export function ownerWhere(req: Request, id: number) { return { id, userId: requireUser(req).id }; }
export function notFound(): never { throw new HttpError(404, 'NOT_FOUND', 'Kayıt bulunamadı.'); }

export async function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return _next(err);
  const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat();
  await Promise.all(files.map(file => unlink(file.path).catch(() => {})));
  if (err instanceof HttpError) return res.status(err.status).json({ code: err.code, error: err.message });
  if (err instanceof ZodError) return res.status(400).json({ code: 'VALIDATION_ERROR', error: 'Gönderilen bilgileri kontrol edin.', fields: err.issues.map(i => ({ path: i.path, code: i.code })) });
  if (err instanceof multer.MulterError) return res.status(400).json({ code: 'INVALID_UPLOAD', error: 'Dosya türünü, boyutunu ve dosya sayısını kontrol edin.' });
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return res.status(404).json({ code: 'NOT_FOUND', error: 'Kayıt bulunamadı.' });
    if (err.code === 'P2002') return res.status(409).json({ code: 'CONFLICT', error: 'Bu bilgilerle bir kayıt zaten var.' });
    if (err.code === 'P2003') return res.status(409).json({ code: 'RELATED_RECORD', error: 'İlişkili kayıt bulunamadı veya bu kayıt halen kullanılıyor.' });
    if (err.code === 'P2034') return res.status(409).json({ code: 'RETRY', error: 'Kayıt aynı anda değiştirildi. Lütfen tekrar deneyin.' });
  }
  if (err && typeof err === 'object' && 'status' in err && [400,413,415].includes(Number(err.status)))
    return res.status(Number(err.status)).json({ code: 'INVALID_REQUEST', error: 'İstek biçimini ve boyutunu kontrol edin.' });
  // Do not expose database errors, stack traces, credentials or request payloads.
  console.error('API request failed', { method: req.method, path: req.path, type: err instanceof Error ? err.name : 'UnknownError' });
  return res.status(500).json({ code: 'INTERNAL_ERROR', error: 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.' });
}
