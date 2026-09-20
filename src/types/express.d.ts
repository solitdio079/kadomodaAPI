export {};
import { type Role } from "../generated/prisma/index.js";
declare global {
  namespace Express {
    interface User {
      id: number;
      role: Role;
      email: string;
      verified: boolean;
      name: string | null;
    }
  }
}
