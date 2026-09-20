import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import jwt from "jsonwebtoken";
import { promisify } from "node:util";
import { hashPassword } from "../src/utils/password.js";

const promisedSign = promisify(jwt.sign);
async function sendUserToken(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "User not logged in!" });
  const userData = {
    id: req.user.id,
    role: req.user.role,
    verified: req.user.verified,
  };

  try {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Unexpected error!" });
    const token = await promisedSign(userData, secretKey, {
      expiresIn: "6h",
      algorithm: "HS256",
    });
    return res.json({ message: "Token sent!", token });
  } catch (err) {
    return next(err);
  }
}

async function signUpUser(req, res, next) {
  try {
    // these are already validated fields: validation middleware will come before this
    const { email, password, name, confirmPassword } = req.body;

    if (password !== confirmPassword)
      return res.status(400).json({ error: "Passwords do not match!" });

    // check if email exists
    const userByEmail = await prisma.user.findUnique({
      where: { email:email.toLowerCase() },
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

export { sendUserToken, signUpUser };
