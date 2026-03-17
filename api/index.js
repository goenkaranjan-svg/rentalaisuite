import bundledHandler from "./server-handler.cjs";

// Safely unwrap CJS default export
const handler =
  bundledHandler &&
  typeof bundledHandler === "object" &&
  "default" in bundledHandler
    ? bundledHandler.default
    : bundledHandler;

// Validate that the resolved handler is actually callable
if (typeof handler !== "function") {
  throw new Error(
    `[index.js] Failed to resolve a callable handler from "./server-handler.cjs". ` +
    `Got: ${JSON.stringify(handler)}`
  );
}

export default async function vercelHandler(req, res) {
  try {
    return await handler(req, res);
  } catch (err) {
    console.error("[vercelHandler] Unhandled error:", err);

    // Avoid sending a response if one was already started
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
}
