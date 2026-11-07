/**
 * Production server for the built Vite output.
 *
 * A static file server with one dynamic route: GET /api/health, which reports
 * whether the build is present and serviceable. It exists so the deployment can
 * verify the app actually started — the application itself is entirely
 * client-side and needs no server beyond static delivery.
 *
 * No framework, no dependencies: Node's own http + fs modules.
 */

import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(here, "dist");
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const hasBuild = existsSync(join(DIST, "index.html"));

function sendFile(res, filePath, status = 200) {
  const type = MIME[extname(filePath)] ?? "application/octet-stream";
  const { size } = statSync(filePath);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": size,
    "Cache-Control": filePath.includes(`${extname(filePath)}`) && extname(filePath) === ".html"
      ? "no-cache"
      : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  createReadStream(filePath).pipe(res);
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method not allowed");
  }

  // Health check: the only dynamic route.
  if (pathname === "/api/health") {
    return send(
      res,
      200,
      JSON.stringify({
        ok: hasBuild,
        app: "pocket-ledger",
        buildPresent: hasBuild,
        uptimeSeconds: Math.round(process.uptime()),
      }),
      "application/json; charset=utf-8",
    );
  }

  if (!hasBuild) {
    return send(
      res,
      503,
      "Pocket Ledger has no build output. Run `npm run build` before starting the server.",
    );
  }

  // Refuse any path that escapes the build directory.
  const target = normalize(join(DIST, pathname));
  if (!target.startsWith(DIST)) {
    return send(res, 403, "Forbidden");
  }

  if (existsSync(target) && statSync(target).isFile()) {
    return sendFile(res, target);
  }

  // Hashed assets that no longer exist are a genuine 404, not a fallback.
  if (pathname.startsWith("/assets/")) {
    return send(res, 404, "Not found");
  }

  // Everything else is a client route: hand back the shell.
  const shell = join(DIST, "index.html");
  if (existsSync(shell)) return sendFile(res, shell);
  return send(res, 404, "Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Pocket Ledger`);
  console.log(`  serving ${DIST}`);
  console.log(`  http://localhost:${PORT}`);
  if (!hasBuild) console.warn("  warning: no build found — run `npm run build` first");
});
