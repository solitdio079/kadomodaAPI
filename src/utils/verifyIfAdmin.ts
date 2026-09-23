import type { RequestHandler } from 'express';
const verifyIfAdmin: RequestHandler<any> = (req, res, next) => {
  if (!req.user) { res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Lütfen giriş yapın.' }); return; }
  if (req.user.role !== 'ADMIN') { res.status(403).json({ code: 'ADMIN_REQUIRED', error: 'Bu işlem için yönetici yetkisi gerekiyor.' }); return; }
  next();
};
export default verifyIfAdmin;
