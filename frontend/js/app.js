/**
 * نقطة بدء التطبيق.
 *
 * تبني الإطار مرة واحدة، تُنشئ الراوتر، وتربط معالجة الأخطاء العامة.
 */

import { el, render, qs } from "./core/dom.js";
import { appShell, skipLink } from "../components/layout/app-shell.js";
import { createRouter } from "./core/router.js";
import { buildRoutes } from "./config/routes.js";
import { tableSkeleton, errorState, forbiddenState, notFoundState } from "../components/feedback/states.js";
import { toast } from "../components/feedback/toast.js";
import { on } from "./core/events.js";
import { ErrorCode } from "./core/errors.js";
import { APP, LOCALE } from "./core/config.js";

function boot() {
  const root = qs("#app");

  if (!root) {
    console.error("[app] لم يُعثر على العنصر #app في index.html");
    return;
  }

  /* --- اللغة والاتجاه على عنصر <html> --- */
  document.documentElement.lang = LOCALE.language;
  document.documentElement.dir = LOCALE.direction;
  document.title = APP.name;

  /* --- الإطار --- */
  const shell = appShell();
  render(root, skipLink(), shell.element);

  /* --- الراوتر --- */
  const router = createRouter({
    outlet: shell.outlet,
    routes: buildRoutes(),
    hooks: {
      onNavigated: shell.setContext,
      // هيكل جدول أفضل من دوّارة: يحتفظ بارتفاع تقريبي فلا تقفز الصفحة.
      onLoading: () => el("div", { class: "pt-1" }, tableSkeleton({ rows: 6, columns: 5 })),
      onError: ({ error, retry }) => errorState({ error, onRetry: retry }),
      onForbidden: ({ route }) => forbiddenState({ route }),
      onNotFound: ({ path }) => notFoundState({ path }),
    },
  });

  /* --- أخطاء الـ API العامة --- */
  on("api:error", ({ error }) => {
    // انتهاء الجلسة يستحق إشعارًا عامًا؛ بقية الأخطاء تعالجها الشاشة في سياقها،
    // وإشعار إضافي فوقها يصبح ضجيجًا مكررًا.
    if (error.code === ErrorCode.UNAUTHENTICATED) {
      toast.error("انتهت الجلسة. سجّل الدخول من جديد.");
    }
  });

  /* --- شبكة أمان: خطأ غير ملتقط لا يختفي بصمت (docs/07-FRONTEND-RULES.md) --- */
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[app] وعد مرفوض بدون معالجة:", event.reason);
    toast.error("حدث خطأ غير متوقع. راجع وحدة التحكم (Console) للتفاصيل.");
  });

  window.addEventListener("error", (event) => {
    console.error("[app] خطأ غير ملتقط:", event.error ?? event.message);
  });

  router.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
