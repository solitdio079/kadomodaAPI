import passport from "passport";
import { prisma } from "../lib/prisma.js";
import  LocalStrategy  from "passport-local";
import { verifyPassword } from "./password.js";


passport.use(
  new LocalStrategy.Strategy({
    usernameField: 'email',
    passwordField: 'password',
  },async function (username, password, done) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: username.toLowerCase() },
      });
      if (!user) return done(null, false);
      const verifiedPassword = await verifyPassword(password, user.pwd);
      if (!verifiedPassword) {
        return done(null, false);
      }
      const {pwd,createdAt,updatedAt,...restUser} = user
      return done(null, restUser);
    } catch (err) {
      return done(err);
    }
  }),
);
