import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";

import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  // Plain liveness probe for Docker/EasyPanel — no DB/OpenAI checks here on purpose (that's
  // the richer /api/v1/admin/dashboard/health added in IT-10, for the admin UI, not the
  // container orchestrator).
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1", apiRouter);

  // Serve the built frontend static assets in production (single-container deploy).
  if (env.NODE_ENV === "production") {
    const staticDir = path.join(__dirname, "..", "public");
    app.use(express.static(staticDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
