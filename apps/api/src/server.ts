import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import { ChatService } from "./modules/chat/chat.service.js";
import { prisma } from "./lib/prisma.js";
import { documentRoutes } from "./modules/documents/document.routes.js";
import { gitlabRoutes } from "./modules/gitlab/gitlab.routes.js";
import { projectRoutes } from "./modules/projects/project.routes.js";
import { supportRoutes } from "./modules/support/support.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { verifySessionToken, COOKIE_NAME } from "./lib/session.js";

const app = Fastify({
  logger: true,
});

const rateLimitConfig = {
  global:  Number(process.env.RATE_LIMIT_GLOBAL  ?? 60),
  llm:     Number(process.env.RATE_LIMIT_LLM     ?? 15),
  upload:  Number(process.env.RATE_LIMIT_UPLOAD  ?? 5),
  window:         process.env.RATE_LIMIT_WINDOW  ?? "1m",
};

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

await app.register(rateLimit, {
  max: rateLimitConfig.global,
  timeWindow: rateLimitConfig.window,
});

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    cb(new Error("Origin not allowed"), false);
  },
  credentials: true,
});

await app.register(cookie);

app.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
});

const PUBLIC_ROUTES = new Set(["POST /auth/login", "GET /health"]);

app.addHook("preHandler", async (request, reply) => {
  const key = `${request.method} ${request.routeOptions.url}`;
  if (PUBLIC_ROUTES.has(key)) return;
  const token = request.cookies?.[COOKIE_NAME];
  if (!token || !verifySessionToken(token)) {
    return reply.status(401).send({ message: "Não autenticado" });
  }
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

await app.register(authRoutes);
await app.register(chatRoutes);
await app.register(documentRoutes, {
  rateLimitUpload: rateLimitConfig.upload,
  rateLimitWindow: rateLimitConfig.window,
});
await app.register(gitlabRoutes);
await app.register(projectRoutes);
await app.register(supportRoutes, {
  rateLimitLlm: rateLimitConfig.llm,
  rateLimitWindow: rateLimitConfig.window,
});

const port = Number(process.env.PORT || 3333);
const retentionDays = Number(process.env.SESSION_RETENTION_DAYS ?? 30);
const chatService = new ChatService();

chatService.purgeExpiredSessions(retentionDays).catch((err) => {
  app.log.warn({ err }, "Failed to purge expired chat sessions on startup");
});
setInterval(
  () => {
    chatService.purgeExpiredSessions(retentionDays).catch((err) => {
      app.log.warn({ err }, "Failed to purge expired chat sessions");
    });
  },
  24 * 60 * 60 * 1000,
);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`API running on port ${port}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
