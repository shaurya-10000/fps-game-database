import { Router } from "express";
import { logger } from "../infrastructure/logging/logger";
import { createSnapshotProvider, type SnapshotDeps } from "./snapshot";
import { renderStatusPage } from "./StatusPage";

// The page is static HTML with inline CSS only: no scripts, no remote assets.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

export function buildStatusRouter(deps: SnapshotDeps): Router {
  const router = Router();
  const getSnapshot = createSnapshotProvider(deps);

  router.get("/", async (_req, res) => {
    try {
      const snapshot = await getSnapshot();
      res
        .status(snapshot.overall === "down" ? 503 : 200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "Content-Security-Policy": CONTENT_SECURITY_POLICY,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        })
        .send(renderStatusPage(snapshot));
    } catch (err) {
      logger.error("Status page failed", { error: String(err) });
      res.status(500).type("text/plain").send("Status page unavailable");
    }
  });

  return router;
}