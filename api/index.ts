import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/app";

// Wrap the module-level promise so a cold-start failure can be retried
// instead of permanently holding a rejected promise.
let appPromise: Promise<ReturnType<typeof createApp> extends Promise<{ app: infer A }> ? A : never> | null = null;

const APP_INIT_TIMEOUT_MS = 10_000; // 10 seconds

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[index.ts] Timed out after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

function getAppPromise() {
  // If there's no cached promise (or the previous one failed), create a new one
  if (!appPromise) {
    appPromise = withTimeout(
      createApp("serverless").then(({ app }) => app),
      APP_INIT_TIMEOUT_MS,
      "createApp()"
    ).catch((err) => {
      // Reset so the next request retries initialisation
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getAppPromise();
    return await app(req, res);
  } catch (err) {
    console.error("[handler] Unhandled error:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}
