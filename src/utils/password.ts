import {promisify} from "node:util"
import  { randomBytes, scrypt,timingSafeEqual } from "node:crypto";

const promisedRandomBytes = promisify(randomBytes)
const promisedScrypt: (password: string, salt: string, length: number) => Promise<Buffer> = promisify(scrypt)

async function hashPassword(password:string): Promise<string> {
 
  // create a salt for each password
  const salt = await promisedRandomBytes(32);

  const hash = await promisedScrypt(password, salt.toString("hex"), 32);

  return [hash.toString("hex"), salt.toString("hex")].join(" ");
}


async function verifyPassword(password:string, hashedPassword:string) :Promise<boolean>{
  
  const [hash, salt] = hashedPassword.split(" ");
  if(!hash || !salt) return false
  const hashBuff = Buffer.from(hash, "hex");

  const verifyBuff = await promisedScrypt(password, salt, 32)

  if(verifyBuff.length !== hashBuff.length) return false

  return timingSafeEqual(verifyBuff,hashBuff)
}


export {verifyPassword,hashPassword}