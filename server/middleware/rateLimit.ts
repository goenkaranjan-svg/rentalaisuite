import type { RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: any) => string;
  message?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const {
    windowMs,
    max,
    keyPrefix,
    keyGenerator = (req) => getClientIp(req),
    message = "Too many requests. Please try again later.",
  } = options;

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(max - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(max - existing.count, 0);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1000)));

    if (existing.count > max) {
      return res.status(429).json({ message });
    }

    return next();
  };
}
