import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  COOKIE_NAME,
  buildSessionCookieOptions,
  createSessionToken,
  deleteSessionToken,
} from "../../lib/session.js";
import { prisma } from "../../lib/prisma.js";

type AuthRouteOptions = {
  rateLimitLogin: number;
  rateLimitLoginWindow: string;
};

const loginSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function authRoutes(app: FastifyInstance, opts: AuthRouteOptions) {
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: opts.rateLimitLogin, timeWindow: opts.rateLimitLoginWindow } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: "Payload inválido",
          issues: parsed.error.flatten(),
        });
      }

      const appPassword = process.env.APP_PASSWORD!;

      const expected = Buffer.from(appPassword);
      const actual = Buffer.from(parsed.data.password);

      const match =
        expected.length === actual.length && timingSafeEqual(expected, actual);

      if (!match) {
        request.log.warn({ ip: request.ip }, "auth:login:failure");
        return reply.status(401).send({ message: "Senha incorreta" });
      }

      const token = await createSessionToken(prisma);

      reply.setCookie(COOKIE_NAME, token, buildSessionCookieOptions());

      request.log.info({ ip: request.ip }, "auth:login:success");
      return reply.send({ ok: true });
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies?.[COOKIE_NAME];
    if (token) {
      await deleteSessionToken(token, prisma);
    }
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    request.log.info({ ip: request.ip }, "auth:logout");
    return reply.send({ ok: true });
  });

  app.get("/auth/me", { config: { rateLimit: false } }, async (_request, reply) => {
    return reply.send({ ok: true });
  });
}
