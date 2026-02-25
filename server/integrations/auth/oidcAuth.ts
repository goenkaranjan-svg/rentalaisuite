import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

const OIDC_PLACEHOLDERS = [
  "your-auth-provider.com",
  "your-client-id-here",
  "your-tenant.auth0.com",
];

function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}

function isOidcConfigured(): boolean {
  const issuer = process.env.ISSUER_URL ?? process.env.OIDC_ISSUER_URL ?? "";
  const clientId = process.env.CLIENT_ID ?? "";
  if (!issuer || !clientId) return false;
  const isPlaceholder = OIDC_PLACEHOLDERS.some(
    (p) => issuer.includes(p) || clientId.includes(p)
  );
  return !isPlaceholder;
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? process.env.OIDC_ISSUER_URL!),
      process.env.CLIENT_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
      },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
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
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
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
        req.session?.destroy(() => res.redirect("/"));
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
        req.session?.destroy(() => res.redirect("/"));
      });
    });
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
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
    if (desiredRole === "manager" || desiredRole === "tenant") {
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
        if ((desiredRole === "manager" || desiredRole === "tenant") && req.user?.claims?.sub) {
          await authStorage.updateUserRole(req.user.claims.sub, desiredRole);
          delete req.session.desiredRole;
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.CLIENT_ID!,
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
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
