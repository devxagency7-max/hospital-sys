/**
 * مُشغّل مجموعات الاختبار.
 *
 *   npm test            كل الاختبارات
 *   npm run test:unit   الوحدات فقط (بلا متصفح — سريع)
 *   npm run test:browser  اختبارات المتصفح فقط
 *
 * اختبارات المتصفح تحتاج خادمًا يعمل، فيُشغّله هذا الملف ويُغلقه تلقائيًا.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PORT = 4178; // منفذ مخصص للاختبارات حتى لا يصطدم بخادم التطوير

/** الوحدات: دوال خالصة، تعمل في Node مباشرة. */
const UNIT = ["tests/billing.test.mjs", "tests/data.test.mjs", "tests/architecture.test.mjs"];

/** المتصفح: تحتاج خادمًا و Playwright. */
const BROWSER = ["tests/ui.test.mjs", "tests/routes.test.mjs"];

const args = process.argv.slice(2);
const onlyUnit = args.includes("--unit");
const onlyBrowser = args.includes("--browser");

const results = [];

function run(file, env = {}) {
  process.stdout.write(`\n${"═".repeat(60)}\n  ${file}\n${"═".repeat(60)}\n`);

  const result = spawnSync(process.execPath, [file], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

  results.push({ file, ok: result.status === 0 });
  return result.status === 0;
}

/* -------------------------------------------------- الوحدات */

if (!onlyBrowser) {
  for (const file of UNIT) run(file);
}

/* -------------------------------------------------- المتصفح */

let server;

if (!onlyUnit) {
  // الـ CSS المبني مطلوب، وإلا ظهرت الصفحة بلا أنماط ففشلت فحوص التخطيط.
  if (!existsSync(resolve(ROOT, "css/app.css"))) {
    console.error("\n  css/app.css غير موجود. شغّل `npm run build` أولاً.\n");
    process.exit(1);
  }

  let playwrightReady = true;
  try {
    await import("playwright");
  } catch {
    playwrightReady = false;
  }

  if (!playwrightReady) {
    console.error(
      "\n  Playwright غير مثبَّت. شغّل:\n    npm install\n    npx playwright install chromium\n",
    );
    process.exit(1);
  }

  server = spawn(process.execPath, ["tools/dev-server.mjs", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
  });

  // ننتظر استجابة الخادم بدل تخمين مدة ثابتة.
  const base = `http://localhost:${PORT}`;
  const deadline = Date.now() + 10_000;
  let up = false;

  while (Date.now() < deadline && !up) {
    try {
      const response = await fetch(`${base}/index.html`);
      up = response.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  if (!up) {
    console.error(`\n  تعذّر تشغيل خادم الاختبار على ${base}\n`);
    server.kill();
    process.exit(1);
  }

  for (const file of BROWSER) run(file, { BASE: base });

  server.kill();
}

/* -------------------------------------------------- الخلاصة */

const failed = results.filter((r) => !r.ok);

console.log(`\n${"═".repeat(60)}`);
console.log("  الخلاصة");
console.log("═".repeat(60));
for (const { file, ok } of results) console.log(`  ${ok ? "✅" : "❌"}  ${file}`);
console.log("");

process.exit(failed.length ? 1 : 0);
