import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import passport from 'passport';
import routes from './routes/index.js';
import siteContent from './routes/siteContent.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, HttpError } from './middleware/http.js';
import { uploadDirectory } from './utils/multerUpload.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Only trust known reverse-proxy addresses/CIDRs; never trust arbitrary forwarded IPs.
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(v => v.trim()));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const allowed = (process.env.CORS_ORIGINS || 'https://kadomoda.com,https://www.kadomoda.com').split(',').map(v => v.trim()).filter(Boolean);
  app.use(cors({ origin(origin, cb) {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Bu kaynaktan gelen isteğe izin verilmiyor.'));
  }, methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], maxAge: 600 }));
  app.use(express.json({ limit: '256kb' }));
  app.use(passport.initialize());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/', (_req, res) => res.json({ name: 'Kado Moda API', checkoutAvailable: false }));
  app.use(express.static(uploadDirectory, { dotfiles: 'deny', index: false, fallthrough: true }));
  app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { code: 'RATE_LIMITED', error: 'Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.' } }), routes.auth);
  app.use('/site-content', siteContent);
  app.use('/product', routes.product);
  app.use('/category', routes.category);
  app.use('/campaign', routes.campaign);
  app.use('/order', routes.order);
  app.use('/posts', routes.post);
  app.use('/comments', authenticate, routes.comment);
  app.use('/address', authenticate, routes.address);
  app.use('/cart', authenticate, routes.cart);
  app.use('/users', authenticate, routes.user);
  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', error: 'İstenen adres bulunamadı.' }));
  app.use(errorHandler);
  return app;
}
