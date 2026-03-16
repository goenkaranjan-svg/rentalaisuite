import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { deviceFingerprint } from "./security";
import { removeSession, touchSession, trackSession } from "./sessionRegistry";

const OIDC_PLACEHOLDERS = [
  "your-auth-provider.com",
  "your-client-id-here",
  "your-tenant.auth0.com",
];

type OidcClientModule = typeof import("openid-client");
type OidcPassportModule = typeof import("openid-client/passport");

let oidcClientPromise: Promise<OidcClientModule> | null = null;
let oidcPassportPromise: Promise<OidcPassportModule> | null = null;

function getRuntimeEnv() {
  return globalThis.process?.env ?? process.env;
}

async function loadOidcClient(): Promise<OidcClientModule> {
  oidcClientPromise ??= import("openid-client");
  return oidcClientPromise;
}

async function loadOidcPassport(): Promise<OidcPassportModule> {
  oidcPassportPromise ??= import("openid-client/passport");
  return oidcPassportPromise;
}

function isDevAuthBypassEnabled(): boolean {
  const env = getRuntimeEnv();
  return env.NODE_ENV !== "production" && env.DEV_AUTH_BYPASS === "true";
}

function isOidcConfigured(): boolean {
  const env = getRuntimeEnv();
  const issuer = env.ISSUER_URL ?? env.OIDC_ISSUER_URL ?? "";
  const clientId = env.CLIENT_ID ?? "";
  if (!issuer || !clientId) return false;
  const isPlaceholder = OIDC_PLACEHOLDERS.some(
    (p) => issuer.includes(p) || clientId.includes(p)
  );
  return !isPlaceholder;
}

const getOidcConfig = memoize(
  async () => {
    const env = getRuntimeEnv();
    const client = await loadOidcClient();
    return await client.discovery(
      new URL(env.ISSUER_URL ?? env.OIDC_ISSUER_URL!),
      env.CLIENT_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const configuredSecret = process.env.SESSION_SECRET ?? "";
  const hasStrongSecret = configuredSecret.length >= 32;
  if (process.env.NODE_ENV === "production" && !hasStrongSecret) {
    console.warn(
      "SESSION_SECRET is missing or too short in production. Falling back to a temporary secret; rotate SESSION_SECRET to a 32+ character value.",
    );
  }
  const sessionSecret = hasStrongSecret
    ? configuredSecret
    : "prod-fallback-session-secret-change-immediately-0123456789";

  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    name: process.env.NODE_ENV === "production" ? "__Host-propman.sid" : "propman.sid",
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    unset: "destroy",
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: any
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  const env = getRuntimeEnv();
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : 0);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(async (req: any, res, next) => {
    try {
      const sid = req.sessionID;
      if (!sid) return next();

      if (req.user?.claims?.sub) {
        const ip = getClientIp(req);
        const ua = String(req.headers["user-agent"] || "unknown");
        const fp = deviceFingerprint(ip, ua);

        if (!req.session.securityBinding) {
          req.session.securityBinding = fp;
        } else if (req.session.securityBinding !== fp) {
          req.logout?.(() => {
            req.session?.destroy(() => {
              removeSession(sid);
              return res.status(401).json({ message: "Session security check failed. Please sign in again." });
            });
          });
          return;
        }

        let userRole = String(req.session.userRole || "").trim();
        if (!userRole) {
          const dbUser = await authStorage.getUser(req.user.claims.sub);
          if (dbUser?.role) {
            userRole = dbUser.role;
            req.session.userRole = userRole;
          }
        }

        const defaultIdleMaxMs = Number(process.env.SESSION_IDLE_TIMEOUT_MS || 30 * 60 * 1000);
        const adminIdleRequestedMs = Number(process.env.ADMIN_SESSION_IDLE_TIMEOUT_MS || 10 * 60 * 1000);
        const adminIdleMaxMs = Math.min(10 * 60 * 1000, Math.max(5 * 60 * 1000, adminIdleRequestedMs));
        const idleMaxMs = userRole === "manager" ? adminIdleMaxMs : defaultIdleMaxMs;

        const lastActivityAt = Number(req.session.lastActivityAt || Date.now());
        if (Date.now() - lastActivityAt > idleMaxMs) {
          req.logout?.(() => {
            req.session?.destroy(() => {
              removeSession(sid);
              return res.status(401).json({ message: "Session expired due to inactivity." });
            });
          });
          return;
        }

        req.session.lastActivityAt = Date.now();
        touchSession(sid);
        trackSession({
          sid,
          userId: req.user.claims.sub,
          ip,
          userAgent: ua,
          createdAt: Number(req.session.createdAt || Date.now()),
          lastSeenAt: Date.now(),
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    const sid = req.sessionID;
    const finish = () => {
      req.session?.destroy(() => {
        if (sid) removeSession(sid);
        res.status(204).send();
      });
    };
    if (typeof req.logout === "function") return req.logout(finish);
    return finish();
  });

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  if (isDevAuthBypassEnabled()) {
    const devUserId = process.env.DEV_AUTH_BYPASS_USER_ID ?? "dev-local-user";
    const devUserEmail = process.env.DEV_AUTH_BYPASS_EMAIL ?? "dev@localhost";

    await authStorage.upsertUser({
      id: devUserId,
      email: devUserEmail,
      firstName: "Dev",
      lastName: "User",
      role: "manager",
    });

    app.use((req: any, _res, next) => {
      req.user = {
        claims: {
          sub: devUserId,
          email: devUserEmail,
        },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      };
      req.isAuthenticated = () => true;
      next();
    });

    app.get("/api/login", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/login/google", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/login/facebook", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/logout", (req: any, res) => {
      req.logout?.(() => {
        const sid = req.sessionID;
        req.session?.destroy(() => {
          if (sid) removeSession(sid);
          res.redirect("/");
        });
      });
    });
    return;
  }

  if (!isOidcConfigured()) {
    app.get("/api/login", (_req, res) => {
      res.status(503).json({
        message:
          "OIDC not configured. Set ISSUER_URL and CLIENT_ID in .env (see QUICK_OIDC_SETUP.md).",
      });
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/?error=oidc-not-configured");
    });
    app.get("/api/login/google", (_req, res) => {
      res.status(503).json({ message: "OIDC not configured." });
    });
    app.get("/api/login/facebook", (_req, res) => {
      res.status(503).json({ message: "OIDC not configured." });
    });
    app.get("/api/logout", (req: any, res) => {
      req.logout?.(() => {
        const sid = req.sessionID;
        req.session?.destroy(() => {
          if (sid) removeSession(sid);
          res.redirect("/");
        });
      });
    });
    return;
  }

  const [client, { Strategy }] = await Promise.all([
    loadOidcClient(),
    loadOidcPassport(),
  ]);

  let config: Awaited<ReturnType<typeof getOidcConfig>>;
  try {
    config = await getOidcConfig();
  } catch (error) {
    console.error("OIDC discovery failed. Auth routes will return 503 until configuration/connectivity is fixed.", error);
    app.get("/api/login", (_req, res) => {
      res.status(503).json({ message: "OIDC provider unavailable." });
    });
    app.get("/api/login/google", (_req, res) => {
      res.status(503).json({ message: "OIDC provider unavailable." });
    });
    app.get("/api/login/facebook", (_req, res) => {
      res.status(503).json({ message: "OIDC provider unavailable." });
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/?error=oidc-provider-unavailable");
    });
    app.get("/api/logout", (req: any, res) => {
      req.logout?.(() => {
        const sid = req.sessionID;
        req.session?.destroy(() => {
          if (sid) removeSession(sid);
          res.redirect("/");
        });
      });
    });
    return;
  }

  const verify = async (
    tokens: any,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (req: any) => {
    const domain = req.hostname;
    const protocol = req.protocol || (req.secure ? 'https' : 'http');
    const strategyName = `oidcauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `${protocol}://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  const startOidcLogin = (req: any, res: any, next: any, provider?: "google" | "facebook") => {
    const desiredRole = typeof req.query.role === "string" ? req.query.role : undefined;
    if (desiredRole === "manager" || desiredRole === "tenant" || desiredRole === "investor") {
      req.session.desiredRole = desiredRole;
    }
    ensureStrategy(req);
    const providerParams =
      provider === "google"
        ? { connection: "google-oauth2" }
        : provider === "facebook"
          ? { connection: "facebook" }
          : {};
    passport.authenticate(`oidcauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      ...providerParams,
    })(req, res, next);
  };

  app.get("/api/login", (req: any, res, next) => {
    startOidcLogin(req, res, next);
  });

  app.get("/api/login/google", (req: any, res, next) => {
    startOidcLogin(req, res, next, "google");
  });

  app.get("/api/login/facebook", (req: any, res, next) => {
    startOidcLogin(req, res, next, "facebook");
  });

  app.get("/api/callback", (req: any, res, next) => {
    ensureStrategy(req);
    passport.authenticate(`oidcauth:${req.hostname}`, async (err: unknown, user: any) => {
      if (err || !user) {
        return res.redirect("/api/login");
      }
      req.logIn(user, async (loginErr: unknown) => {
        if (loginErr) return next(loginErr);
        const desiredRole = req.session?.desiredRole;
        if (
          (desiredRole === "manager" || desiredRole === "tenant" || desiredRole === "investor") &&
          req.user?.claims?.sub
        ) {
          await authStorage.updateUserRole(req.user.claims.sub, desiredRole);
          delete req.session.desiredRole;
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      const sid = (req as any).sessionID;
      if (sid) removeSession(sid);
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: env.CLIENT_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const client = await loadOidcClient();
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
