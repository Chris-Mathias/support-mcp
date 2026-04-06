import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import { documentRoutes } from "./modules/documents/document.routes.js";
import { gitlabRoutes } from "./modules/gitlab/gitlab.routes.js";
import { projectRoutes } from "./modules/projects/project.routes.js";
import { supportRoutes } from "./modules/support/support.routes.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});
await app.register(chatRoutes);
await app.register(documentRoutes);
await app.register(gitlabRoutes);
await app.register(projectRoutes);
await app.register(supportRoutes);

const port = Number(process.env.PORT || 3333);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`API running on port ${port}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
