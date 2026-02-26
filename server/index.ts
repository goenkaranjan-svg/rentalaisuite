import { createApp, log } from "./app";

(async () => {
  const { httpServer } = await createApp("server");

  // Serve on the configured port; use HOST if provided.
  // Some environments do not support binding with all socket options on 0.0.0.0,
  // so fallback to loopback when an unsupported bind occurs.
  const port = parseInt(process.env.PORT || "5001", 10);
  const primaryHost = process.env.HOST || "0.0.0.0";
  const fallbackHost = "127.0.0.1";

  const startServer = (host: string) => {
    httpServer.listen({ port, host }, () => {
      log(`serving on http://${host}:${port}`);
    });
  };

  httpServer.once("error", (err: NodeJS.ErrnoException) => {
    if ((err.code === "ENOTSUP" || err.code === "EADDRNOTAVAIL") && primaryHost !== fallbackHost) {
      log(
        `bind failed on ${primaryHost}:${port} (${err.code}), retrying on ${fallbackHost}:${port}`,
        "server",
      );
      startServer(fallbackHost);
      return;
    }

    throw err;
  });

  startServer(primaryHost);
})();
