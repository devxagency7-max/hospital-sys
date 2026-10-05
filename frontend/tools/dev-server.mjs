/**
 * خادم ثابت بسيط بدون أي اعتماديات.
 *
 * التطبيق يستخدم ES Modules، والمتصفح يحجبها على بروتوكول file://، فلا بد من
 * خادم HTTP. هذا الملف يوفّره دون إضافة حزم إلى المشروع.
 *
 *   node tools/dev-server.mjs [--port 4173]
 */

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const PORT = (() => {
  const i = process.argv.indexOf("--port");
  const n = i !== -1 ? Number(process.argv[i + 1]) : Number(process.env.PORT);
  return Number.isInteger(n) && n > 0 ? n : 4173;
})();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

/** يحوّل مسار URL إلى مسار ملف داخل ROOT، أو null لو حاول الخروج منه. */
function resolveSafely(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const candidate = resolve(join(ROOT, normalize(decoded)));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed", { allow: "GET, HEAD" });
  }

  const urlPath = new URL(req.url, "http://localhost").pathname;
  let filePath = resolveSafely(urlPath);
  if (!filePath) return send(res, 403, "Forbidden");

  try {
    let info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, "index.html");
      info = await stat(filePath);
    }

    const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, {
      "content-type": type,
      "content-length": info.size,
      // أثناء التطوير نريد دائمًا أحدث نسخة من الملف.
      "cache-control": "no-store",
    });

    if (req.method === "HEAD") return res.end();
    createReadStream(filePath).pipe(res);
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") {
      return send(res, 404, `404 — غير موجود: ${urlPath}`);
    }
    console.error(`[dev-server] ${urlPath}:`, err.message);
    send(res, 500, "500 — خطأ في الخادم");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  المنفذ ${PORT} مستخدم بالفعل. جرّب: npm run serve -- --port 4174\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`\n  Hospital ERP  →  http://localhost:${PORT}\n`);
});
