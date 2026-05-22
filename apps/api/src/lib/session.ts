import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) {
    throw new Error("SESSION_SECRET deve ter ao menos 32 caracteres");
  }
  return s;
}

function sign(id: string): string {
  return `${id}.${createHmac("sha256", getSecret()).update(id).digest("hex")}`;
}

export function createSessionToken(): string {
  return sign(randomBytes(32).toString("hex"));
}

export function verifySessionToken(token: string): boolean {
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
