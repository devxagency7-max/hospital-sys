/**
 * وضع التطوير: بناء الـ CSS بالمراقبة + خادم ثابت، في عملية واحدة.
 *
 *   npm run dev
 *
 * ينتظر أول بناء ناجح للـ CSS قبل تشغيل الخادم، حتى لا تُفتح الصفحة بدون أنماط.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const CSS_OUT = resolve(ROOT, "css/app.css");

const children = [];
let shuttingDown = false;

function run(label, command, args) {
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`\n  [${label}] توقف بالرمز ${code}. إنهاء وضع التطوير.\n`);
    shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("tailwind", "npx", [
  "tailwindcss",
  "-i",
  "./css/tailwind.src.css",
  "-o",
  "./css/app.css",
  "--watch",
]);

// Tailwind يكتب الملف في أول دورة بناء؛ ننتظر ظهوره بدلاً من تخمين مدة.
const startedAt = Date.now();
const poll = setInterval(() => {
  if (existsSync(CSS_OUT)) {
    clearInterval(poll);
    run("server", "node", ["tools/dev-server.mjs", ...process.argv.slice(2)]);
  } else if (Date.now() - startedAt > 30_000) {
    clearInterval(poll);
    console.error("\n  لم يُنتج Tailwind ملف css/app.css خلال 30 ثانية.\n");
    shutdown(1);
  }
}, 150);
