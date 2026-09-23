import '../utils/passportLocal.js';
import { Router } from 'express';
import passport from 'passport';
import { z } from 'zod';
import { validate } from '../middleware/http.js';
import { sendUserToken, signUpUser, validateUser } from '../controllers/auth.js';
const router = Router();
router.post('/signup', validateUser, signUpUser);
router.post('/login', validate(z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(256) }).strict()), (req, res, next) => {
  passport.authenticate('local', { session: false }, (error: unknown, user: Express.User | false) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ code: 'INVALID_CREDENTIALS', error: 'E-posta adresiniz veya şifreniz hatalı.' });
    req.user = user;
    sendUserToken(req, res, next);
  })(req, res, next);
});
export default router;
