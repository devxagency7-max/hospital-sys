/**
 * أنواع الأخطاء.
 *
 * قاعدة من docs/07-FRONTEND-RULES.md: «ممنوع إخفاء الأخطاء بصمت» و«ممنوع رسائل
 * نجاح لعمليات لم تحدث». لذلك كل فشل يصل إلى الواجهة كخطأ مُصنَّف، والشاشة
 * تتصرف بناءً على `code` لا على نص الرسالة.
 */

/** شكل الخطأ المتفق عليه مع الباك-إند — راجع docs/11-FRONTEND-CONVENTIONS.md. */
export class ApiError extends Error {
  /**
   * @param {object} options
   * @param {string} options.code    رمز ثابت قابل للفحص برمجيًا
   * @param {string} options.message رسالة عربية صالحة للعرض للمستخدم
   * @param {number} [options.status] رمز حالة HTTP
   * @param {Record<string,string>} [options.fields] أخطاء على مستوى الحقول
   * @param {unknown} [options.cause]
   */
  constructor({ code, message, status, fields, cause }) {
    super(message, { cause });
    this.name = "ApiError";
    this.code = code ?? "UNKNOWN";
    this.status = status ?? 0;
    this.fields = fields ?? null;
  }

  /** أخطاء الحقول تُعرض داخل النموذج، لا في toast عام. */
  get isValidation() {
    return this.code === "VALIDATION_ERROR";
  }

  get isOffline() {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT";
  }

  get isPermission() {
    return this.code === "FORBIDDEN" || this.code === "UNAUTHENTICATED";
  }

  /** الأخطاء العابرة فقط تستحق زر «إعادة المحاولة». */
  get isRetryable() {
    return this.isOffline || this.status >= 500;
  }
}

export const ErrorCode = {
  NETWORK: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  VALIDATION: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  SERVER: "SERVER_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  REPORT_INCOMPLETE: "REPORT_SECTION_FAILED",
  UNKNOWN: "UNKNOWN",
};

/**
 * ينشئ خطأ «غير منفَّذ».
 *
 * مهم: أي endpoint لم يُكتب بعد يجب أن يرمي هذا الخطأ لا أن يُعيد نجاحًا وهميًا.
 * بهذا يظهر النقص في الواجهة بوضوح بدل أن يبدو الزر كأنه يعمل.
 */
export function notImplemented(endpoint) {
  return new ApiError({
    code: ErrorCode.NOT_IMPLEMENTED,
    status: 501,
    message: `هذه العملية غير منفّذة بعد في طبقة البيانات التجريبية (${endpoint}).`,
  });
}

export function validationError(fields, message = "راجع الحقول المظلَّلة.") {
  return new ApiError({ code: ErrorCode.VALIDATION, status: 422, message, fields });
}

export function notFound(message = "العنصر المطلوب غير موجود.") {
  return new ApiError({ code: ErrorCode.NOT_FOUND, status: 404, message });
}

export function forbidden(message = "لا تملك صلاحية تنفيذ هذا الإجراء.") {
  return new ApiError({ code: ErrorCode.FORBIDDEN, status: 403, message });
}

/** يلفّ أي خطأ مجهول في ApiError حتى تتعامل الواجهة مع شكل واحد. */
export function toApiError(error) {
  if (error instanceof ApiError) return error;

  return new ApiError({
    code: ErrorCode.UNKNOWN,
    message: error?.message || "حدث خطأ غير متوقع.",
    cause: error,
  });
}

/** رسالة صالحة للعرض — لا تُظهر أبدًا تفاصيل تقنية خام للمستخدم. */
export function describeError(error) {
  const apiError = toApiError(error);

  const fallbacks = {
    [ErrorCode.NETWORK]: "تعذّر الاتصال بالخادم. تحقّق من الشبكة ثم أعد المحاولة.",
    [ErrorCode.TIMEOUT]: "استغرق الطلب وقتًا أطول من المسموح. أعد المحاولة.",
    [ErrorCode.SERVER]: "خطأ في الخادم. أعد المحاولة، وإن تكرر أبلغ الدعم الفني.",
    [ErrorCode.UNAUTHENTICATED]: "انتهت الجلسة. سجّل الدخول من جديد.",
  };

  return apiError.message || fallbacks[apiError.code] || "حدث خطأ غير متوقع.";
}
