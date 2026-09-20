import passportJwt from "passport-jwt";
import passport from "passport";
import { prisma } from "../lib/prisma.js";
import "dotenv/config";

const JwtStrategy = passportJwt.Strategy;

const ExtractJwt = passportJwt.ExtractJwt;

const secretKey = process.env.SECRET_KEY;

if(!secretKey) {
  throw new Error("missing secret key")
}

const opts: passportJwt.WithSecretOrKey = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: secretKey,
  algorithms: ["HS256"],
};

passport.use(
  new JwtStrategy(opts, async function (
    payload: {
      id: number
    },
    done,
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: payload.id,
        },
        omit:{
          pwd:true,
          createdAt:true,
          updatedAt:true
        }
      });
      if (!user) return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  }),
);
