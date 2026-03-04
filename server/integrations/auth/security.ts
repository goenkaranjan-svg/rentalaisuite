import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

type FailedAttempt = { count: number; windowResetAt: number };
type TemporaryToken = { userId: string; expiresAt: number; used?: boolean };
type VerificationToken = { userId: string; expiresAt: number; used?: boolean };
type RecoveryToken = { userId: string; expiresAt: number; notBefore: number; used?: boolean };
type AuditEvent = {
  at: string;
  userId?: string;
  email?: string;
  action: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  detail?: string;
};

const failedAttempts = new Map<string, FailedAttempt>();
const lockedUsers = new Map<string, number>();
const emailVerifyTokens = new Map<string, VerificationToken>();
const magicLinkTokens = new Map<string, TemporaryToken>();
const mfaLoginTokens = new Map<string, TemporaryToken>();
const recoveryTokens = new Map<string, RecoveryToken>();
const knownDeviceHashes = new Map<string, Set<string>>();
const pendingStepUp = new Map<string, TemporaryToken>();
const authAuditLog: AuditEvent[] = [];
const MAX_AUDIT_ITEMS = 1000;

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "qwerty",
  "letmein",
  "123456",
  "12345678",
  "welcome",
  "admin",
  "iloveyou",
  "abc123",
]);

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  const normalized = input.toUpperCase().replace(/=+$/, "");
  for (const char of normalized) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(data: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < data.length; i++) {
    bits += data[i].toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += alphabet[parseInt(chunk, 2)];
  }
  return output;
}

function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function nowStep(stepSeconds = 30): number {
  return Math.floor(Date.now() / 1000 / stepSeconds);
}

export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

export function verifyTotp(secret: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  const current = nowStep();
  for (let offset = -1; offset <= 1; offset++) {
    if (hotp(secret, current + offset) === cleaned) return true;
  }
  return false;
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () => randomBytes(4).toString("hex"));
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function verifyHashedCode(raw: string, hashed: string): boolean {
  const a = Buffer.from(hashCode(raw), "hex");
  const b = Buffer.from(hashed, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordPolicyResult(password: string): { ok: boolean; message?: string } {
  if (password.length < 12) return { ok: false, message: "Password must be at least 12 characters." };
  if (!/[A-Z]/.test(password)) return { ok: false, message: "Password must include an uppercase letter." };
  if (!/[a-z]/.test(password)) return { ok: false, message: "Password must include a lowercase letter." };
  if (!/[0-9]/.test(password)) return { ok: false, message: "Password must include a number." };
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, message: "Password must include a symbol." };
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return { ok: false, message: "Password is too common." };
  return { ok: true };
}

export function isUserLocked(email: string): boolean {
  const until = lockedUsers.get(email.toLowerCase()) ?? 0;
  return until > Date.now();
}

export function registerFailedLogin(email: string, ip: string): { locked: boolean; remaining: number } {
  const key = `${email.toLowerCase()}::${ip}`;
  const now = Date.now();
  const existing = failedAttempts.get(key);
  if (!existing || now >= existing.windowResetAt) {
    failedAttempts.set(key, { count: 1, windowResetAt: now + 15 * 60 * 1000 });
    return { locked: false, remaining: 4 };
  }
  existing.count += 1;
  const remaining = Math.max(5 - existing.count, 0);
  if (existing.count >= 5) {
    lockedUsers.set(email.toLowerCase(), now + 15 * 60 * 1000);
    return { locked: true, remaining: 0 };
  }
  return { locked: false, remaining };
}

export function clearFailedLogins(email: string, ip: string) {
  failedAttempts.delete(`${email.toLowerCase()}::${ip}`);
  lockedUsers.delete(email.toLowerCase());
}

export function createVerificationToken(userId: string): string {
  const token = randomBytes(24).toString("hex");
  emailVerifyTokens.set(hashCode(token), { userId, expiresAt: Date.now() + 60 * 60 * 1000 });
  return token;
}

export function consumeVerificationToken(token: string): string | null {
  const key = hashCode(token);
  const payload = emailVerifyTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}

export function createMagicLinkToken(userId: string): string {
  const token = randomBytes(24).toString("hex");
  magicLinkTokens.set(hashCode(token), { userId, expiresAt: Date.now() + 15 * 60 * 1000 });
  return token;
}

export function consumeMagicLinkToken(token: string): string | null {
  const key = hashCode(token);
  const payload = magicLinkTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}

export function createMfaLoginToken(userId: string): string {
  const token = randomBytes(24).toString("hex");
  mfaLoginTokens.set(hashCode(token), { userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return token;
}

export function consumeMfaLoginToken(token: string): string | null {
  const key = hashCode(token);
  const payload = mfaLoginTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}

export function createRecoveryToken(userId: string): string {
  const token = randomBytes(24).toString("hex");
  recoveryTokens.set(hashCode(token), {
    userId,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    notBefore: Date.now() + 10 * 60 * 1000,
  });
  return token;
}

export function consumeRecoveryToken(token: string): { userId: string; ready: boolean } | null {
  const key = hashCode(token);
  const payload = recoveryTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  if (Date.now() < payload.notBefore) return { userId: payload.userId, ready: false };
  payload.used = true;
  return { userId: payload.userId, ready: true };
}

export function deviceFingerprint(ip: string, userAgent: string): string {
  return hashCode(`${ip}::${userAgent}`);
}

export function isKnownDevice(userId: string, fingerprint: string): boolean {
  return knownDeviceHashes.get(userId)?.has(fingerprint) ?? false;
}

export function rememberDevice(userId: string, fingerprint: string) {
  const set = knownDeviceHashes.get(userId) ?? new Set<string>();
  set.add(fingerprint);
  knownDeviceHashes.set(userId, set);
}

export function createStepUpToken(userId: string): string {
  const token = randomBytes(20).toString("hex");
  pendingStepUp.set(hashCode(token), { userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return token;
}

export function consumeStepUpToken(token: string): string | null {
  const key = hashCode(token);
  const payload = pendingStepUp.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}

export function writeAuthAudit(event: Omit<AuditEvent, "at">) {
  authAuditLog.unshift({ at: new Date().toISOString(), ...event });
  if (authAuditLog.length > MAX_AUDIT_ITEMS) authAuditLog.length = MAX_AUDIT_ITEMS;
}

export function readAuthAudit(userId?: string): AuditEvent[] {
  if (!userId) return authAuditLog.slice(0, 200);
  return authAuditLog.filter((e) => e.userId === userId).slice(0, 200);
}

export function parseCountryFromHeaders(headers: Record<string, unknown>): string {
  const raw = (headers["x-vercel-ip-country"] || headers["cf-ipcountry"] || headers["x-country"] || "") as string;
  return String(raw || "").trim().toUpperCase();
}

export function validateGeoPolicy(countryCode: string): { ok: boolean; reason?: string } {
  const allow = (process.env.AUTH_ALLOW_COUNTRIES || "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
  const deny = (process.env.AUTH_DENY_COUNTRIES || "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
  if (countryCode && deny.includes(countryCode)) return { ok: false, reason: "Login blocked from your region." };
  if (allow.length > 0 && countryCode && !allow.includes(countryCode)) return { ok: false, reason: "Login not allowed from this region." };
  return { ok: true };
}

export function isCaptchaSatisfied(req: any): boolean {
  if (process.env.REQUIRE_CAPTCHA_ON_AUTH !== "true") return true;
  const token = req.headers["x-captcha-token"];
  return typeof token === "string" && token.trim().length >= 20;
}

export function isPasskeyFeatureEnabled(): boolean {
  return process.env.ENABLE_PASSKEYS === "true";
}
