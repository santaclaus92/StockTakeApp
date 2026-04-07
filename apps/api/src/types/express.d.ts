import type { UserRole } from "../middleware/auth";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string | null;
        role: UserRole;
      };
    }
  }
}

export {};
