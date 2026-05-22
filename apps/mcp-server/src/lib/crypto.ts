import { createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? "";

  if (hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY deve ser uma string hex de 32 bytes (64 caracteres)",
    );
  }

  return Buffer.from(hex, "hex");
}

export function decrypt(stored: string): string {
  const parts = stored.split(":");

  if (parts.length !== 3) {
    throw new Error("INVALID_ENCRYPTED_FORMAT");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
