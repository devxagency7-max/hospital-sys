/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  نقطة التبديل الوحيدة بين البيانات التجريبية و API حقيقي.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * كل طلب في التطبيق يمر من هنا. ملفات `*.api.js` تستدعي هذه الدوال، والشاشات
 * تستدعي `*.api.js` — ولا تلمس الشاشات هذا الملف ولا عنوان URL أبدًا.
 *
 * لتشغيل الواجهة على باك-إند حقيقي: اضبط `API.mode = 'live'` في
 * js/core/config.js. لا تعديل آخر مطلوب.
 */

import { API, MOCK } from "../core/config.js";
import { ApiError, ErrorCode, toApiError } from "../core/errors.js";
import { appState } from "../core/store.js";
import { emit } from "../core/events.js";
import { dispatchMock } from "./mock-adapter.js";

/** يحوّل كائن معاملات إلى querystring، مُهملاً القيم الفارغة. */
function toQueryString(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)));
    else search.append(key, String(value));
  }

  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

/** يحدّث عدّاد الطلبات الجارية الذي يشغّل شريط التقدّم العلوي. */
function trackRequest(delta) {
  const next = Math.max(0, appState.get().pendingRequests + delta);
  appState.set({ pendingRequests: next });
}

/* --------------------------------------------------------------------------
   الوضع التجريبي
   -------------------------------------------------------------------------- */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mockLatency() {
  const [min, max] = MOCK.latencyMs;
  return wait(min + Math.random() * Math.max(0, max - min));
}

async function requestMock(method, path, { params, body } = {}) {
  await mockLatency();

  // فشل عشوائي اختياري — لاختبار حالات الخطأ دون تعطيل الباك-إند.
  if (MOCK.failureRate > 0 && Math.random() < MOCK.failureRate) {
    throw new ApiError({
      code: ErrorCode.SERVER,
      status: 500,
      message: "خطأ محاكى في الخادم (MOCK.failureRate مفعّل في js/core/config.js).",
    });
  }

  return dispatchMock({ method, path, params: params ?? {}, body: body ?? null });
}

/* --------------------------------------------------------------------------
   الوضع الحقيقي
   -------------------------------------------------------------------------- */

async function requestLive(method, path, { params, body, signal } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), API.timeoutMs);
  signal?.addEventListener("abort", () => controller.abort(signal.reason));

  let response;
  try {
    response = await fetch(`${API.baseUrl}${path}${toQueryString(params)}`, {
      method,
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError({
      code: controller.signal.reason === "timeout" ? ErrorCode.TIMEOUT : ErrorCode.NETWORK,
      message:
        controller.signal.reason === "timeout"
          ? "استغرق الطلب وقتًا أطول من المسموح."
          : "تعذّر الاتصال بالخادم.",
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    // شكل الخطأ المتفق عليه: { error: { code, message, fields } }
    const details = payload?.error ?? {};
    throw new ApiError({
      code: details.code ?? statusToCode(response.status),
      status: response.status,
      message: details.message ?? `فشل الطلب (${response.status}).`,
      fields: details.fields,
    });
  }

  return payload;
}

function statusToCode(status) {
  const map = {
    400: ErrorCode.VALIDATION,
    401: ErrorCode.UNAUTHENTICATED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    422: ErrorCode.VALIDATION,
    501: ErrorCode.NOT_IMPLEMENTED,
  };
  return map[status] ?? (status >= 500 ? ErrorCode.SERVER : ErrorCode.UNKNOWN);
}

/* --------------------------------------------------------------------------
   الواجهة العامة
   -------------------------------------------------------------------------- */

async function request(method, path, options = {}) {
  trackRequest(+1);

  try {
    const payload =
      API.mode === "mock"
        ? await requestMock(method, path, options)
        : await requestLive(method, path, options);

    return payload;
  } catch (error) {
    const apiError = toApiError(error);

    // حدث واحد لكل فشل — تستخدمه الطبقة العامة لمعالجة انتهاء الجلسة.
    emit("api:error", { method, path, error: apiError });
    throw apiError;
  } finally {
    trackRequest(-1);
  }
}

export const http = {
  get: (path, params, options) => request("GET", path, { ...options, params }),
  post: (path, body, options) => request("POST", path, { ...options, body }),
  put: (path, body, options) => request("PUT", path, { ...options, body }),
  patch: (path, body, options) => request("PATCH", path, { ...options, body }),
  del: (path, options) => request("DELETE", path, options),
};

/**
 * مساعد للقوائم المُرقَّمة. يُعيد دائمًا نفس الشكل حتى لا تكرر كل شاشة
 * التعامل مع غياب الـ meta:
 *   { data: [], meta: { page, perPage, total, totalPages } }
 */
export async function fetchList(path, params = {}) {
  const payload = await http.get(path, params);
  const data = Array.isArray(payload) ? payload : (payload?.data ?? []);

  const perPage = Number(payload?.meta?.perPage ?? params.perPage ?? data.length) || data.length;
  const total = Number(payload?.meta?.total ?? data.length);

  return {
    data,
    meta: {
      page: Number(payload?.meta?.page ?? params.page ?? 1),
      perPage,
      total,
      totalPages: Number(payload?.meta?.totalPages ?? (perPage ? Math.ceil(total / perPage) : 1)),
    },
  };
}
