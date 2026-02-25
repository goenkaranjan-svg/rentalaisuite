import type { Express } from "express";
import { z } from "zod";
import { authStorage } from "./storage";
import { isAuthenticated } from "./oidcAuth";
import { generateResetToken, hashPassword, hashToken, verifyPassword } from "./crypto";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["manager", "tenant"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["manager", "tenant"]),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
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

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/signup", async (req: any, res) => {
    try {
      const input = signupSchema.parse(req.body);
      const existing = await authStorage.getUserByEmail(input.email);
      if (existing) {
        return res.status(409).json({ message: "Email already registered." });
      }

      const user = await authStorage.createLocalUser({
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
      });

      req.login(buildLocalSessionUser(user), (err: unknown) => {
        if (err) return res.status(500).json({ message: "Failed to create session." });
        return res.status(201).json({ id: user.id, email: user.email, role: user.role });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      return res.status(500).json({ message: "Failed to sign up." });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await authStorage.getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password." });
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        return res.status(401).json({ message: "Invalid email or password." });
      }
      if (user.role !== input.role) {
        return res.status(403).json({ message: `This account is registered as ${user.role}.` });
      }

      req.login(buildLocalSessionUser(user), (err: unknown) => {
        if (err) return res.status(500).json({ message: "Failed to create session." });
        return res.json({ id: user.id, email: user.email, role: user.role });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      return res.status(500).json({ message: "Failed to log in." });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const input = forgotSchema.parse(req.body);
      const user = await authStorage.getUserByEmail(input.email);
      if (!user) {
        return res.json({ message: "If that email exists, a reset link has been generated." });
      }

      const token = generateResetToken();
      await authStorage.setResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000));

      // TODO: integrate a real email provider. For dev usability, return token in non-production.
      const payload: Record<string, unknown> = {
        message: "Password reset link generated.",
      };
      if (process.env.NODE_ENV !== "production") {
        payload.resetToken = token;
      }
      return res.json(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      return res.status(500).json({ message: "Failed to process request." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const input = resetSchema.parse(req.body);
      const tokenHash = hashToken(input.token);
      const user = await authStorage.findUserByResetToken(tokenHash);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token." });
      }
      await authStorage.updatePassword(user.id, hashPassword(input.password));
      return res.json({ message: "Password updated successfully." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      return res.status(500).json({ message: "Failed to reset password." });
    }
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
