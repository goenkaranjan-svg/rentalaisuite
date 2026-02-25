import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, hashed: string): boolean {
  const [salt, expected] = hashed.split(":");
  if (!salt || !expected) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  if (expectedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, derivedBuf);
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
