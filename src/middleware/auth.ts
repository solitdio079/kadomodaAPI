import type { RequestHandler } from 'express';
import passport from 'passport';
import '../utils/passportJwt.js';
export const authenticate: RequestHandler = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err: unknown, user: Express.User | false) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Lütfen giriş yapın.' });
    req.user = user;
    next();
  })(req, res, next);
};
