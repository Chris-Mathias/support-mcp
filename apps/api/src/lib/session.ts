import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { CookieSerializeOptions } from "@fastify/cookie";

export const COOKIE_NAME = "session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const RENEW_THRESHOLD_SECONDS = 60 * 60 * 24 * 3; // renew if < 3 days remaining
const CACHE_TTL_MS = 30_000;

export function buildSessionCookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  };
}

type CacheEntry = { expiresAt: number; cachedUntil: number };
const sessionCache = new Map<string, CacheEntry>();

export type SessionVerifyResult =
  | { valid: false }
  | { valid: true; shouldRenew: boolean };

function getSecret(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET deve ter ao menos 32 caracteres");
  return s;
}

function sign(id: string): string {
  return `${id}.${createHmac("sha256", getSecret()).update(id).digest("hex")}`;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function verifyHmac(token: string): boolean {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return false;
    const id = token.slice(0, dot);
    const expected = Buffer.from(sign(id));
    const actual = Buffer.from(token);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function clearSessionCache(): void {
  sessionCache.clear();
}

export async function createSessionToken(prisma: PrismaClient): Promise<string> {
  const token = sign(randomBytes(32).toString("hex"));
  const hash = tokenHash(token);
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await prisma.session.create({ data: { id: hash, expiresAt } });

  sessionCache.set(hash, { expiresAt: expiresAt.getTime(), cachedUntil: Date.now() + CACHE_TTL_MS });

  return token;
}

export async function verifySessionToken(
  token: string,
  prisma: PrismaClient,
): Promise<SessionVerifyResult> {
  if (!verifyHmac(token)) return { valid: false };

  const hash = tokenHash(token);
  const now = Date.now();

  const cached = sessionCache.get(hash);
  if (cached && now < cached.cachedUntil) {
    if (now >= cached.expiresAt) {
      sessionCache.delete(hash);
      return { valid: false };
    }
    return { valid: true, shouldRenew: cached.expiresAt - now < RENEW_THRESHOLD_SECONDS * 1000 };
  }

  const session = await prisma.session.findUnique({ where: { id: hash } });
  if (!session || session.expiresAt <= new Date()) {
    sessionCache.delete(hash);
    return { valid: false };
  }

  sessionCache.set(hash, {
    expiresAt: session.expiresAt.getTime(),
    cachedUntil: now + CACHE_TTL_MS,
  });

  return {
    valid: true,
    shouldRenew: session.expiresAt.getTime() - now < RENEW_THRESHOLD_SECONDS * 1000,
  };
}

export async function deleteSessionToken(
  token: string,
  prisma: PrismaClient,
): Promise<void> {
  const hash = tokenHash(token);
  sessionCache.delete(hash);
  await prisma.session.deleteMany({ where: { id: hash } });
}

export async function renewSessionToken(
  token: string,
  prisma: PrismaClient,
): Promise<string> {
  await deleteSessionToken(token, prisma);
  return createSessionToken(prisma);
}
