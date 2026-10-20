import { Router, Request, Response } from "express";
import { AuthService } from "./auth-service";

export function buildAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, username, password } = req.body;
      if (!email || !username || !password) {
        res.status(400).json({ error: "MISSING_FIELDS" });
        return;
      }
      const result = await authService.register(email, username, password);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.message === "EMAIL_IN_USE" || err.message === "USERNAME_TAKEN") {
        res.status(409).json({ error: err.message });
      } else {
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
    }
  });

  router.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "MISSING_FIELDS" });
        return;
      }
      const result = await authService.login(email, password);
      res.status(200).json(result);
    } catch (err: any) {
      if (err.message === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: "INVALID_CREDENTIALS" });
      } else {
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
      }
    }
  });

  // JWKS endpoint for the IdentityProvider to consume
  router.get("/.well-known/jwks.json", (req: Request, res: Response) => {
    res.json(authService.getJwks());
  });

  return router;
}