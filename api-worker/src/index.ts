import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Bindings } from "./types";
import hotspots from "./routes/hotspots";

const app = new Hono<{ Bindings: Bindings }>({ strict: false });

// Per-request logging middleware (method, path, status, duration).
app.use("*", logger());

app.use("*", async (c, next) => {
  const raw = (c.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:4321").trim();
  // Public read-only API: "*" allows any origin (no credentials). Otherwise use
  // the explicit allow-list (credentials enabled for those origins).
  const isWildcard = raw === "*";
  const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: isWildcard ? "*" : origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Accept", "Authorization", "Content-Type", "X-Requested-With"],
    exposeHeaders: ["Link"],
    credentials: !isWildcard,
    maxAge: 300,
  })(c, next);
});

app.get("/health", async (c) => {
  let d1 = "disconnected";
  try {
    await c.env.DB.prepare("SELECT 1").first();
    d1 = "connected";
  } catch {
    d1 = "disconnected";
  }
  return c.json({ status: "ok", d1 });
});

app.route("/api/v1/hotspots", hotspots);

app.notFound((c) =>
  c.json({ message: "resource not found", success: false }, 404),
);

app.onError((err, c) => {
  console.error("unhandled error", err);
  return c.json(
    { message: "internal server error", success: false, error: String(err) },
    500,
  );
});

export default app;
