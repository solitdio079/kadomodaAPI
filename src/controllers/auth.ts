import "dotenv/config";
import { type Request, type Response, type NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import jwt from "jsonwebtoken";
import { hashPassword } from "../utils/password.js";
import * as z from "zod";
import { UserValidator } from "../validation/validators.js";

async function sendUserToken(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "User not logged in!" });
  const userData = {
    id: req.user.id,
    purpose: 'access',
  };

  try {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey)
      return res.status(500).json({ error: "No secret provided" });
    const token = jwt.sign(userData, secretKey, {
      expiresIn: "6h",
      algorithm: "HS256",
    });
    return res.json({ message: "Token sent!", token });
  } catch (err) {
    return next(err);
  }
}

interface userBody {
  email: string;
  password: string;
  name: string;
  confirmPassword: string;
}

function validateUser(
  req: Request<Record<string, never>, unknown, userBody>,
  res: Response,
  next: NextFunction,
) {
  const result = UserValidator.safeParse(req.body);
  if (!result.success) {
    next(result.error) // ZodError instance
  } else {
    req.body = result.data; // { username: string; xp: number }
    next()
  }
}

async function signUpUser(
  req: Request<Record<string, never>, unknown, userBody>,
  res: Response,
  next: NextFunction,
) {
  try {
    // these are already validated fields: validation middleware will come before this
    const { email, password, name, confirmPassword } = req.body;

    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match!" });

    // check if email exists
    const userByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (userByEmail)
      return res.status(409).json({ error: "Email already exists!" });

    // Password hashing
    const hashedPassword = await hashPassword(password);
    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        pwd: hashedPassword,
        name,
      },
    });

    return res.status(201).json({ message: "User created!" });
  } catch (err) {
    return next(err);
  }
}

export { sendUserToken, signUpUser, validateUser };
