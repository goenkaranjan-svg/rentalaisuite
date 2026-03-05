import type { Express } from "express";
import { z } from "zod";
import { authStorage } from "./storage";
import { isAuthenticated } from "./oidcAuth";
import { generateResetToken, hashPassword, hashToken, verifyPassword } from "./crypto";
import { createRateLimiter } from "../../middleware/rateLimit";
import {
  consumeMagicLinkToken,
  consumeMfaLoginToken,
  consumeRecoveryToken,
  consumeStepUpToken,
  consumeVerificationToken,
  createMagicLinkToken,
  createMfaLoginToken,
  createRecoveryToken,
  createVerificationToken,
  generateBackupCodes,
  deviceFingerprint,
  generateMfaSecret,
  hashCode,
  isCaptchaSatisfied,
  isPasskeyFeatureEnabled,
  isUserLocked,
  parseCountryFromHeaders,
  readAuthAudit,
  registerFailedLogin,
  rememberDevice,
  validateGeoPolicy,
  verifyHashedCode,
  verifyTotp,
  writeAuthAudit,
  clearFailedLogins,
} from "./security";
import { removeSession, sessionsForUser } from "./sessionRegistry";
import {
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendRecoveryEmail,
  sendVerificationEmail,
} from "./mailer";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["manager", "tenant", "investor"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["manager", "tenant", "investor"]),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const mfaSetupSchema = z.object({
  password: z.string().min(1),
});

const mfaEnableSchema = z.object({
  secret: z.string().min(16),
  code: z.string().min(6),
});

const loginMfaVerifySchema = z.object({
  loginToken: z.string().min(1),
  code: z.string().optional(),
  backupCode: z.string().optional(),
});

const emailVerifySchema = z.object({
  token: z.string().min(1),
});
const resendVerifySchema = z.object({
  email: z.string().email(),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

const magicLinkConsumeSchema = z.object({
  token: z.string().min(1),
  role: z.enum(["manager", "tenant", "investor"]).optional(),
});

const recoveryStartSchema = z.object({
  email: z.string().email(),
});

const recoveryCompleteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12),
});

const stepUpCompleteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});

const reauthSchema = z.object({
  password: z.string().min(1),
});

function buildLocalSessionUser(user: { id: string; email: string | null }) {
  return {
    claims: {
      sub: user.id,
      email: user.email,
    },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    provider: "local",
  };
}

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function establishSession(req: any, res: any, user: { id: string; email: string | null; role: string }) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err: unknown) => {
      if (err) return reject(err);
      return resolve();
    });
  });

  return req.login(buildLocalSessionUser(user), (err: unknown) => {
    if (err) return res.status(500).json({ message: "Failed to create session." });
    req.session.createdAt = Date.now();
    req.session.lastActivityAt = Date.now();
    req.session.securityBinding = deviceFingerprint(getClientIp(req), String(req.headers["user-agent"] || "unknown"));
    return res.json({ id: user.id, email: user.email, role: user.role });
  });
}

function mapAuthDbError(error: unknown): string {
  const message = (error as any)?.message ?? "";
  if (typeof message === "string") {
    if (
      message.includes("column") &&
      (message.includes("auth_provider") ||
        message.includes("password_hash") ||
        message.includes("reset_token_hash") ||
        message.includes("reset_token_expires_at"))
    ) {
      return "Database schema is out of date. Run `npm run db:push` and retry.";
    }
    if (message.includes("gen_random_uuid")) {
      return "Database is missing UUID support. Run `npm run db:push` or enable pgcrypto.";
    }
  }
  return "Authentication service error. Check server logs.";
}

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  const strictAuthLimiter = createRateLimiter({
    keyPrefix: "auth-strict",
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many auth attempts. Please wait and try again.",
  });
  const loginLimiter = createRateLimiter({
    keyPrefix: "auth-login",
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      return `${ip}:${email}`;
    },
    message: "Too many login attempts. Please wait and try again.",
  });

  app.post("/api/auth/signup", strictAuthLimiter, async (req: any, res) => {
    try {
      if (!isCaptchaSatisfied(req)) {
        return res.status(400).json({ message: "Captcha validation required." });
      }
      const input = signupSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      // Temporarily disabled: password complexity enforcement.
      // const passwordPolicy = passwordPolicyResult(input.password);
      // if (!passwordPolicy.ok) {
      //   return res.status(400).json({ message: passwordPolicy.message });
      // }
      const existing = await authStorage.getUserByEmail(input.email);
      if (existing) {
        if (!existing.passwordHash) {
          const linked = await authStorage.linkLocalCredentials({
            userId: existing.id,
            passwordHash: hashPassword(input.password),
            role: input.role,
            firstName: input.firstName ?? existing.firstName ?? undefined,
            lastName: input.lastName ?? existing.lastName ?? undefined,
          });
          if (!linked) {
            return res.status(500).json({ message: "Failed to update account." });
          }
          await authStorage.markEmailVerified(linked.id);
          return establishSession(req, res.status(200), { id: linked.id, email: linked.email, role: linked.role });
        }
        return res.status(409).json({ message: "Email already registered. Please sign in." });
      }

      const user = await authStorage.createLocalUser({
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
      });

      const verificationToken = createVerificationToken(user.id);
      writeAuthAudit({
        action: "signup",
        userId: user.id,
        email: user.email ?? undefined,
        ip: getClientIp(req),
        userAgent: String(req.headers["user-agent"] || "unknown"),
        success: true,
        detail: "Account created",
      });
      const payload: Record<string, unknown> = {
        message: "Account created. Verify your email before first login.",
      };
      if (user.email) {
        await sendVerificationEmail({ to: user.email, token: verificationToken });
      }
      if (process.env.NODE_ENV !== "production") payload.verificationToken = verificationToken;
      return res.status(201).json(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Signup error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/login", loginLimiter, async (req: any, res) => {
    try {
      if (!isCaptchaSatisfied(req)) {
        return res.status(400).json({ message: "Captcha validation required." });
      }
      const input = loginSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const ip = getClientIp(req);
      const userAgent = String(req.headers["user-agent"] || "unknown");
      const countryCode = parseCountryFromHeaders(req.headers as Record<string, unknown>);
      const geo = validateGeoPolicy(countryCode);
      if (!geo.ok) {
        writeAuthAudit({
          action: "login",
          email: input.email,
          ip,
          userAgent,
          success: false,
          detail: geo.reason,
        });
        return res.status(403).json({ message: geo.reason });
      }

      if (isUserLocked(input.email)) {
        return res.status(429).json({ message: "Account temporarily locked. Please try again later." });
      }

      const user = await authStorage.getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        registerFailedLogin(input.email, ip);
        return res.status(401).json({ message: "Invalid email or password." });
      }
      // Temporarily disabled: allow sign-in even if email is not verified.
      // if (!user.emailVerifiedAt && process.env.REQUIRE_EMAIL_VERIFICATION !== "false") {
      //   return res.status(403).json({ message: "Please verify your email before signing in." });
      // }
      if (!verifyPassword(input.password, user.passwordHash)) {
        const result = registerFailedLogin(input.email, ip);
        await authStorage.updateLoginSecurityState({
          userId: user.id,
          failedLoginCount: (user.failedLoginCount ?? 0) + 1,
          lockoutUntil: result.locked ? new Date(Date.now() + 15 * 60 * 1000) : user.lockoutUntil,
        });
        writeAuthAudit({
          action: "login",
          userId: user.id,
          email: user.email ?? undefined,
          ip,
          userAgent,
          success: false,
          detail: "Invalid password",
        });
        return res.status(401).json({ message: "Invalid email or password." });
      }
      if (user.role !== input.role) {
        return res.status(403).json({ message: `This account is registered as ${user.role}.` });
      }

      clearFailedLogins(input.email, ip);
      await authStorage.updateLoginSecurityState({
        userId: user.id,
        failedLoginCount: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      });

      const fingerprint = deviceFingerprint(ip, userAgent);
      // Temporarily disabled: risk-based step-up verification on login.
      // if (needsRiskStepUp) {
      //   const token = createStepUpToken(user.id);
      //   return res.status(202).json({
      //     message: "Additional verification required.",
      //     stepUpRequired: true,
      //     stepUpToken: process.env.NODE_ENV !== "production" ? token : undefined,
      //   });
      // }

      // Temporarily disabled: MFA challenge on login.
      // if (user.mfaEnabled && user.mfaSecret) {
      //   const loginToken = createMfaLoginToken(user.id);
      //   return res.status(202).json({
      //     message: "MFA verification required.",
      //     mfaRequired: true,
      //     loginToken,
      //   });
      // }

      rememberDevice(user.id, fingerprint);
      writeAuthAudit({
        action: "login",
        userId: user.id,
        email: user.email ?? undefined,
        ip,
        userAgent,
        success: true,
      });
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Login error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/forgot-password", strictAuthLimiter, async (req, res) => {
    try {
      const input = forgotSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const payload: Record<string, unknown> = {
        message: "If that email exists, a reset email has been sent.",
      };
      const user = await authStorage.getUserByEmail(input.email);
      if (!user) {
        if (process.env.NODE_ENV !== "production") {
          payload.debug = "no_user";
        }
        return res.json(payload);
      }

      const token = generateResetToken();
      await authStorage.setResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000));
      const recoveryToken = createRecoveryToken(user.id);

      if (user.email) {
        const delivery = await sendPasswordResetEmail({ to: user.email, token });
        console.log(
          `[auth] password reset email queued for ${user.email} via ${delivery.provider}${
            delivery.id ? ` (${delivery.id})` : ""
          }`,
        );
        if (process.env.NODE_ENV !== "production") {
          payload.debug = "sent";
        }
      } else if (process.env.NODE_ENV !== "production") {
        payload.debug = "no_email";
      }
      if (process.env.NODE_ENV !== "production") {
        payload.resetToken = token;
        payload.recoveryToken = recoveryToken;
      }
      writeAuthAudit({
        action: "forgot_password",
        userId: user.id,
        email: user.email ?? undefined,
        ip: getClientIp(req),
        userAgent: String(req.headers["user-agent"] || "unknown"),
        success: true,
      });
      return res.json(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Forgot-password error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/reset-password", strictAuthLimiter, async (req, res) => {
    try {
      const input = resetSchema.parse(req.body);
      // Temporarily disabled: password complexity enforcement.
      // const policy = passwordPolicyResult(input.password);
      // if (!policy.ok) return res.status(400).json({ message: policy.message });
      const tokenHash = hashToken(input.token);
      const user = await authStorage.findUserByResetToken(tokenHash);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token." });
      }
      await authStorage.updatePassword(user.id, hashPassword(input.password));
      writeAuthAudit({
        action: "reset_password",
        userId: user.id,
        email: user.email ?? undefined,
        ip: getClientIp(req),
        userAgent: String(req.headers["user-agent"] || "unknown"),
        success: true,
      });
      return res.json({ message: "Password updated successfully." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Reset-password error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/verify-email", strictAuthLimiter, async (req, res) => {
    try {
      const input = emailVerifySchema.parse(req.body);
      const userId = consumeVerificationToken(input.token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired verification token." });
      await authStorage.markEmailVerified(userId);
      return res.json({ message: "Email verified successfully." });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/verify-email/resend", strictAuthLimiter, async (req, res) => {
    try {
      const input = resendVerifySchema.parse(req.body);
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(normalizedEmail);
      // Always return success-style response to avoid account enumeration.
      const payload: Record<string, unknown> = {
        message: "If the account exists and is not verified, a verification email has been sent.",
      };
      if (!user || !user.email || user.emailVerifiedAt) {
        if (process.env.NODE_ENV !== "production") {
          payload.debug = !user ? "no_user" : user.emailVerifiedAt ? "already_verified" : "no_email";
        }
        return res.json(payload);
      }
      const token = createVerificationToken(user.id);
      await sendVerificationEmail({ to: user.email, token });
      console.log(`[auth] verification resend queued for ${user.email}`);
      if (process.env.NODE_ENV !== "production") {
        payload.debug = "sent";
      }
      if (process.env.NODE_ENV !== "production") payload.verificationToken = token;
      return res.json(payload);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid email." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.get("/api/auth/verify-email", strictAuthLimiter, async (req, res) => {
    try {
      const token = String(req.query?.token ?? "");
      if (!token) return res.status(400).json({ message: "Missing token." });
      const userId = consumeVerificationToken(token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired verification token." });
      await authStorage.markEmailVerified(userId);
      return res.redirect("/login?verified=true");
    } catch (error) {
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/magic-link/request", strictAuthLimiter, async (req, res) => {
    try {
      const input = magicLinkRequestSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(input.email);
      const response: Record<string, unknown> = { message: "If the account exists, a magic link has been generated." };
      if (!user) return res.json(response);
      const token = createMagicLinkToken(user.id);
      if (user.email) {
        await sendMagicLinkEmail({ to: user.email, token, role: user.role as "manager" | "tenant" | "investor" });
      }
      if (process.env.NODE_ENV !== "production") response.magicLinkToken = token;
      return res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/magic-link/consume", strictAuthLimiter, async (req: any, res) => {
    try {
      const input = magicLinkConsumeSchema.parse(req.body);
      const userId = consumeMagicLinkToken(input.token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired magic link." });
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      if (input.role && user.role !== input.role) return res.status(403).json({ message: "Role mismatch for magic-link sign in." });
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.get("/api/auth/magic-link/consume", strictAuthLimiter, async (req: any, res) => {
    try {
      const token = String(req.query?.token ?? "");
      const role = typeof req.query?.role === "string" ? req.query.role : undefined;
      const userId = consumeMagicLinkToken(token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired magic link." });
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      if (role && user.role !== role) return res.status(403).json({ message: "Role mismatch for magic-link sign in." });
      return req.login(buildLocalSessionUser(user), (err: unknown) => {
        if (err) return res.status(500).json({ message: "Failed to create session." });
        req.session.createdAt = Date.now();
        req.session.lastActivityAt = Date.now();
        req.session.securityBinding = deviceFingerprint(getClientIp(req), String(req.headers["user-agent"] || "unknown"));
        return res.redirect("/");
      });
    } catch (error) {
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/login/step-up", strictAuthLimiter, async (req: any, res) => {
    try {
      const input = stepUpCompleteSchema.parse(req.body);
      const userId = consumeStepUpToken(input.token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired step-up token." });
      const user = await authStorage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found." });
      if (!verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ message: "Invalid credentials." });
      rememberDevice(user.id, deviceFingerprint(getClientIp(req), String(req.headers["user-agent"] || "unknown")));
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/mfa/setup", isAuthenticated, async (req: any, res) => {
    try {
      const input = mfaSetupSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const user = await authStorage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found." });
      if (!verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ message: "Invalid password." });
      const secret = generateMfaSecret();
      const backupCodes = generateBackupCodes();
      req.session.pendingMfaSecret = secret;
      req.session.pendingMfaBackupCodes = backupCodes.map(hashCode);
      return res.json({
        secret,
        otpauthUrl: `otpauth://totp/PropMan:${encodeURIComponent(user.email || user.id)}?secret=${secret}&issuer=PropMan`,
        backupCodes,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/mfa/enable", isAuthenticated, async (req: any, res) => {
    try {
      const input = mfaEnableSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const pendingSecret = req.session.pendingMfaSecret;
      const pendingBackupCodes = req.session.pendingMfaBackupCodes as string[] | undefined;
      if (!pendingSecret || !pendingBackupCodes) return res.status(400).json({ message: "No pending MFA setup found." });
      if (pendingSecret !== input.secret) return res.status(400).json({ message: "MFA secret mismatch." });
      if (!verifyTotp(input.secret, input.code)) return res.status(400).json({ message: "Invalid MFA code." });
      await authStorage.updateMfaConfig({ userId, enabled: true, secret: input.secret, backupCodes: pendingBackupCodes });
      req.session.pendingMfaSecret = undefined;
      req.session.pendingMfaBackupCodes = undefined;
      return res.json({ message: "MFA enabled." });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/login/verify-mfa", strictAuthLimiter, async (req: any, res) => {
    try {
      const input = loginMfaVerifySchema.parse(req.body);
      const userId = consumeMfaLoginToken(input.loginToken);
      if (!userId) return res.status(400).json({ message: "Invalid or expired login token." });
      const user = await authStorage.getUser(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) return res.status(400).json({ message: "MFA is not enabled." });
      let valid = false;
      if (input.code) valid = verifyTotp(user.mfaSecret, input.code);
      if (!valid && input.backupCode) {
        const codes = (user.mfaBackupCodes ?? []) as string[];
        const idx = codes.findIndex((c) => verifyHashedCode(input.backupCode!, c));
        if (idx >= 0) {
          codes.splice(idx, 1);
          await authStorage.updateMfaConfig({ userId: user.id, enabled: true, secret: user.mfaSecret, backupCodes: codes });
          valid = true;
        }
      }
      if (!valid) return res.status(401).json({ message: "Invalid MFA code." });
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.post("/api/auth/mfa/disable", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    await authStorage.updateMfaConfig({ userId, enabled: false, secret: null, backupCodes: [] });
    res.json({ message: "MFA disabled." });
  });

  app.get("/api/auth/sessions", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const currentSid = req.sessionID;
    const sessions = sessionsForUser(userId).map((s) => ({
      sid: s.sid,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: new Date(s.createdAt).toISOString(),
      lastSeenAt: new Date(s.lastSeenAt).toISOString(),
      current: s.sid === currentSid,
    }));
    res.json(sessions);
  });

  app.post("/api/auth/sessions/revoke", isAuthenticated, async (req: any, res) => {
    const sid = String(req.body?.sid ?? "");
    if (!sid) return res.status(400).json({ message: "sid is required." });
    req.sessionStore.destroy(sid, () => {
      removeSession(sid);
      res.json({ message: "Session revoked." });
    });
  });

  app.post("/api/auth/sessions/revoke-others", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const currentSid = req.sessionID;
    const all = sessionsForUser(userId);
    await Promise.all(
      all
        .filter((s) => s.sid !== currentSid)
        .map(
          (s) =>
            new Promise<void>((resolve) => {
              req.sessionStore.destroy(s.sid, () => {
                removeSession(s.sid);
                resolve();
              });
            })
        )
    );
    res.json({ message: "Other sessions revoked." });
  });

  app.post("/api/auth/reauth", isAuthenticated, async (req: any, res) => {
    try {
      const input = reauthSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const user = await authStorage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found." });
      if (!verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ message: "Invalid password." });
      req.session.stepUpVerifiedAt = Date.now();
      return res.json({ message: "Re-authenticated." });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });

  app.get("/api/auth/audit", isAuthenticated, async (req: any, res) => {
    const currentUserId = req.user?.claims?.sub;
    const currentUser = await authStorage.getUser(currentUserId);
    if (currentUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    res.json(readAuthAudit());
  });

  app.post("/api/auth/recovery/start", strictAuthLimiter, async (req, res) => {
    try {
      const input = recoveryStartSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(input.email);
      const payload: Record<string, unknown> = { message: "If the account exists, recovery has started." };
      if (!user) return res.json(payload);
      const token = createRecoveryToken(user.id);
      if (user.email) {
        await sendRecoveryEmail({ to: user.email, token });
      }
      if (process.env.NODE_ENV !== "production") payload.recoveryToken = token;
      return res.json(payload);
    } catch {
      return res.status(400).json({ message: "Invalid request." });
    }
  });

  app.post("/api/auth/recovery/complete", strictAuthLimiter, async (req, res) => {
    try {
      const input = recoveryCompleteSchema.parse(req.body);
      const token = consumeRecoveryToken(input.token);
      if (!token) return res.status(400).json({ message: "Invalid recovery token." });
      if (!token.ready) return res.status(400).json({ message: "Recovery is cooling down. Try again later." });
      // Temporarily disabled: password complexity enforcement.
      // const policy = passwordPolicyResult(input.password);
      // if (!policy.ok) return res.status(400).json({ message: policy.message });
      await authStorage.updatePassword(token.userId, hashPassword(input.password));
      return res.json({ message: "Account recovery complete." });
    } catch {
      return res.status(400).json({ message: "Invalid request." });
    }
  });

  app.post("/api/auth/passkeys/register/options", isAuthenticated, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey registration options endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });

  app.post("/api/auth/passkeys/register/verify", isAuthenticated, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey registration verify endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });

  app.post("/api/auth/passkeys/auth/options", strictAuthLimiter, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey auth options endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });

  app.post("/api/auth/passkeys/auth/verify", strictAuthLimiter, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey auth verify endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });

  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/auth/tenants", isAuthenticated, async (req, res) => {
    try {
      const currentUserId = (req as any).user?.claims?.sub;
      const currentUser = currentUserId ? await authStorage.getUser(currentUserId) : undefined;
      if (currentUser?.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const tenants = await authStorage.getTenants(); // We need to add this to authStorage
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });
}
