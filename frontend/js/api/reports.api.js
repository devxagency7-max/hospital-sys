/**
 * واجهة بيانات التقارير.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هنا تُنفَّذ القاعدة الحرجة من docs/05-REPORTING-SPECIFICATION.md:
 *  «النظام يجب ألا يُصدِّر تقريرًا ناقصًا بصمت أبدًا.»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `buildReport` تجمع الأقسام المطلوبة، وتُعيد نتيجة واضحة: إمّا كل الأقسام
 * المطلوبة نجحت فيكون التقرير `complete`، أو سقط قسم فيكون `incomplete` مع
 * تسمية القسم وسببه. لا يوجد مسار ثالث يُخرج تقريرًا ناقصًا.
 *
 * الموضع مقصود: لو تُرك هذا لكل شاشة تقرير، لكفى أن ينسى مطور واحد `try/catch`
 * ليُصدَّر كشف حساب بدون قسم المدفوعات — وهو خطأ لا يُلاحظ إلا بعد خصام مع مريض.
 */

import { describeError } from "../core/errors.js";

/**
 * يبني تقريرًا من عدة أقسام.
 *
 * @param {object} definition
 * @param {string} definition.title
 * @param {object} [definition.meta]        ترويسة التقرير (النطاق الزمني، من أصدره…)
 * @param {Array<{
 *   key: string,
 *   label: string,
 *   required?: boolean,
 *   load: () => Promise<any>
 * }>} definition.sections
 *
 * @returns {Promise<{
 *   status: "complete" | "incomplete",
 *   title: string,
 *   meta: object,
 *   sections: Record<string, { label: string, status: "ok"|"failed"|"skipped", data?: any, error?: string }>,
 *   failures: Array<{ key: string, label: string, error: string }>,
 *   exportable: boolean,
 *   generatedAt: string
 * }>}
 */
export async function buildReport({ title, meta = {}, sections }) {
  // كل الأقسام تُجلب على التوازي — التقرير المالي قد يضم ستة أقسام، وجلبها
  // بالتسلسل يجعل المعاينة بطيئة بلا سبب.
  const settled = await Promise.allSettled(sections.map((section) => section.load()));

  const result = {};
  const failures = [];

  sections.forEach((section, index) => {
    const outcome = settled[index];

    if (outcome.status === "fulfilled") {
      result[section.key] = { label: section.label, status: "ok", data: outcome.value };
      return;
    }

    const message = describeError(outcome.reason);
    result[section.key] = { label: section.label, status: "failed", error: message };

    // القسم غير المطلوب يُسجَّل فشله لكنه لا يُسقط التقرير.
    if (section.required !== false) {
      failures.push({ key: section.key, label: section.label, error: message });
    }

    console.error(`[reports] فشل قسم "${section.label}" في تقرير "${title}":`, outcome.reason);
  });

  return {
    status: failures.length ? "incomplete" : "complete",
    title,
    meta,
    sections: result,
    failures,
    /** الشاشة تقرأ هذه الراية قبل تمكين أي زر تصدير. */
    exportable: failures.length === 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * بوابة التصدير.
 *
 * تُستدعى قبل أي تصدير (PDF / Excel / CSV / طباعة). ترمي خطأً إن كان التقرير
 * ناقصًا، فيستحيل تجاوزها بالنسيان.
 */
export function assertExportable(report) {
  if (report?.exportable) return report;

  const names = (report?.failures ?? []).map((failure) => failure.label).join("، ");

  const error = new Error(
    names
      ? `تعذّر التصدير: فشل تحميل الأقسام التالية — ${names}. أعد المحاولة أو استبعد هذه الأقسام من التقرير.`
      : "تعذّر التصدير: التقرير غير مكتمل.",
  );

  error.name = "ReportIncompleteError";
  error.failures = report?.failures ?? [];
  throw error;
}
