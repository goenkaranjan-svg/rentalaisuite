import bundledHandler from "./server-handler.mjs";

const handler =
  (bundledHandler && typeof bundledHandler === "object" && "default" in bundledHandler
    ? bundledHandler.default
    : bundledHandler);

export default async function vercelHandler(req, res) {
  return handler(req, res);
}
