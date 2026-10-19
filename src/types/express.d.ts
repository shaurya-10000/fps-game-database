import { Context } from "../infrastructure/auth/middleware";

declare global {
  namespace Express {
    interface Request {
      ctx?: Context;
    }
  }
}

export {};
