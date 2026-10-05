/**
 * راوتر يعتمد الـ hash.
 *
 * اخترنا الـ hash لا History API عن قصد: لا يحتاج أي إعداد على الخادم
 * (لا rewrite rules)، فيعمل التطبيق من أي مسار فرعي وبأي خادم ثابت — وهو ما
 * يناسب تسليمًا سيُنشر لاحقًا داخل شبكة المستشفى.
 *
 * شكل المسار:  #/patients/1001?tab=account
 */

import { el, render, clear } from "./dom.js";
import { emit } from "./events.js";
import { can } from "./permissions.js";
import { toApiError } from "./errors.js";
import { runCleanups } from "./lifecycle.js";

/** @type {Array<object>} */
let routes = [];
/** @type {HTMLElement|null} */
let outlet = null;
/** دالة تفكيك الشاشة الحالية. */
let disposeCurrent = null;
/**
 * رمز الانتقال الحالي. التحميل غير متزامن، وبدون هذا الرمز قد تصل شاشة قديمة
 * بعد شاشة أحدث فتكتب فوقها.
 */
let navigationToken = 0;

let hooks = {
  onLoading: null,
  onError: null,
  onForbidden: null,
  onNotFound: null,
  onNavigated: null,
};

/* --------------------------------------------------------------------------
   تحليل المسار
   -------------------------------------------------------------------------- */

/** يحوّل `/patients/:id` إلى تعبير نمطي + أسماء المعاملات. */
function compile(pattern) {
  const keys = [];
  const source = pattern
    .replace(/\/+$/, "")
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\/:(\w+)/g, (_match, key) => {
      keys.push(key);
      return "/([^/]+)";
    });

  return { regex: new RegExp(`^${source || "/"}$`), keys };
}

/** يقرأ الـ hash الحالي إلى { path, query }. */
function readLocation() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart = ""] = raw.split("?");

  const path = ("/" + pathPart.replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
  const query = Object.fromEntries(new URLSearchParams(queryPart));

  return { path, query };
}

function match(path) {
  for (const route of routes) {
    const result = route.regex.exec(path);
    if (!result) continue;

    const params = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(result[index + 1]);
    });

    return { route, params };
  }

  return null;
}

/* --------------------------------------------------------------------------
   الواجهة العامة
   -------------------------------------------------------------------------- */

/**
 * @param {object} options
 * @param {HTMLElement} options.outlet   العنصر الذي تُرسم فيه الشاشات
 * @param {Array} options.routes
 * @param {object} [options.hooks]       onLoading / onError / onForbidden / onNotFound / onNavigated
 */
export function createRouter({ outlet: outletElement, routes: routeList, hooks: routeHooks = {} }) {
  outlet = outletElement;
  hooks = { ...hooks, ...routeHooks };

  routes = routeList.map((route) => ({ ...route, ...compile(route.path) }));

  window.addEventListener("hashchange", handleChange);

  return {
    start: handleChange,
    navigate,
    replace: (path) => navigate(path, { replace: true }),
    current: readLocation,
    /** يبني رابطًا صالحًا للسمة href. */
    href: (path) => `#${path}`,
    resolve: (path) => match(path),
    stop() {
      window.removeEventListener("hashchange", handleChange);
    },
  };
}

/** انتقال برمجي. */
export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith("/") ? path : `/${path}`}`;

  if (window.location.hash === target) {
    handleChange();
    return;
  }

  if (replace) {
    const url = window.location.href.split("#")[0] + target;
    window.history.replaceState(null, "", url);
    handleChange();
  } else {
    window.location.hash = target;
  }
}

/** يحدّث معاملات الاستعلام دون إعادة تحميل الشاشة — للتبويبات والفلاتر. */
export function setQuery(patch, { replace = true } = {}) {
  const { path, query } = readLocation();
  const next = { ...query };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") delete next[key];
    else next[key] = String(value);
  }

  const queryString = new URLSearchParams(next).toString();
  const target = queryString ? `${path}?${queryString}` : path;

  // replaceState يمنع تضخّم سجل المتصفح بكل ضغطة فلتر.
  if (replace) {
    window.history.replaceState(null, "", window.location.href.split("#")[0] + `#${target}`);
    emit("router:query", next);
  } else {
    navigate(target);
  }
}

/* --------------------------------------------------------------------------
   دورة الانتقال
   -------------------------------------------------------------------------- */

async function handleChange() {
  if (!outlet) return;

  const token = ++navigationToken;
  const { path, query } = readLocation();
  const found = match(path);

  // تفكيك الشاشة السابقة قبل رسم الجديدة — يمنع تسريب المستمعين والمؤقتات.
  runDispose();

  if (!found) {
    // الإطار يُحدَّث حتى على 404، وإلا بقي مسار التنقل يعرض الصفحة السابقة
    // فيبدو المستخدم واقفًا في مكان غير الذي يراه.
    document.title = "صفحة غير موجودة — Hospital ERP";
    hooks.onNavigated?.({ path, params: {}, query, route: null, navigate, setQuery });
    renderFallback(hooks.onNotFound, { path }, token);
    emit("router:navigated", { path, route: null });
    return;
  }

  const { route, params } = found;

  if (route.redirect) {
    navigate(typeof route.redirect === "function" ? route.redirect(params) : route.redirect, {
      replace: true,
    });
    return;
  }

  const context = { path, params, query, route, navigate, setQuery };

  if (!can(route.permission)) {
    document.title = `${route.title ?? "غير مصرّح"} — Hospital ERP`;
    hooks.onNavigated?.(context);
    renderFallback(hooks.onForbidden, { route }, token);
    emit("router:navigated", { path, route });
    return;
  }

  document.title = route.title ? `${route.title} — Hospital ERP` : "Hospital ERP";
  emit("router:navigating", context);
  hooks.onNavigated?.(context);

  // حالة التحميل تظهر فورًا لأن `load` تجلب وحدة الشاشة عبر الشبكة.
  renderFallback(hooks.onLoading, { route }, token);

  try {
    const module = await route.load();
    if (token !== navigationToken) return; // سبقه انتقال أحدث

    const factory = module.default ?? module.render;
    if (typeof factory !== "function") {
      throw new Error(`الشاشة "${route.path}" لا تُصدِّر دالة رسم افتراضية.`);
    }

    const result = await factory(context);
    if (token !== navigationToken) return;

    // الشاشة قد تُعيد عنصرًا، أو { element, destroy } لو احتاجت تنظيفًا.
    const element = result instanceof Node ? result : result?.element;
    if (!(element instanceof Node)) {
      throw new Error(`الشاشة "${route.path}" لم تُعِد عنصر DOM.`);
    }

    if (typeof result?.destroy === "function") disposeCurrent = result.destroy;

    render(outlet, element);
    afterRender(context);
  } catch (error) {
    if (token !== navigationToken) return;

    console.error(`[router] فشل تحميل الشاشة "${route.path}":`, error);
    renderFallback(hooks.onError, { route, error: toApiError(error), retry: handleChange }, token);
  } finally {
    if (token === navigationToken) emit("router:navigated", { path, route });
  }
}

function runDispose() {
  // المكوّنات التي سجّلت تنظيفها بنفسها (جداول، تبويبات، قوائم منسدلة).
  runCleanups();

  if (!disposeCurrent) return;

  try {
    disposeCurrent();
  } catch (error) {
    console.error("[router] فشل تفكيك الشاشة السابقة:", error);
  } finally {
    disposeCurrent = null;
  }
}

function renderFallback(hook, payload, token) {
  if (token !== navigationToken) return;

  const node = hook?.(payload);
  if (node instanceof Node) render(outlet, node);
  else render(outlet, el("div", { class: "p-6 text-muted" }, "…"));
}

function afterRender(context) {
  // في SPA لا يُعيد المتصفح التمرير للأعلى تلقائيًا.
  if (!context.query.keepScroll) {
    window.scrollTo({ top: 0, behavior: "instant" });
    outlet.scrollTop = 0;
  }

  // نقل التركيز إلى عنوان الشاشة حتى يعلن قارئ الشاشة الانتقال.
  const heading = outlet.querySelector("h1, [data-page-title]");
  if (heading instanceof HTMLElement) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

/** يُفرّغ المخرج — تُستدعى عند تسجيل الخروج. */
export function clearOutlet() {
  runDispose();
  if (outlet) clear(outlet);
}
