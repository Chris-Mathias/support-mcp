import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  createSessionToken,
} from "../../lib/session.js";

const loginSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    const appPassword = process.env.APP_PASSWORD ?? "";

    if (!appPassword) {
      request.log.error("APP_PASSWORD não configurado");
      return reply.status(500).send({ message: "Servidor não configurado" });
    }

    const expected = Buffer.from(appPassword);
    const actual = Buffer.from(parsed.data.password);

    const match =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!match) {
      return reply.status(401).send({ message: "Senha incorreta" });
    }

    const token = createSessionToken();

    const proto = request.headers["x-forwarded-proto"];
    const isHttps = proto === "https" || (Array.isArray(proto) && proto[0] === "https");

    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
      secure: isHttps,
    });

    return reply.send({ ok: true });
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (_request, reply) => {
    return reply.send({ ok: true });
  });
}
