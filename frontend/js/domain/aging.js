/**
 * تحليل أعمار الديون (Aging) — للعملاء والموردين معًا.
 *
 * دوال خالصة. وحدة واحدة لا اثنتان: أعمار ذمم العملاء وأعمار ذمم الموردين
 * نفس الحساب تمامًا (مبلغ متبقٍ + تاريخ استحقاق + تاريخ مرجعي)، والفرق
 * في العنوان المعروض فقط. نسختان منفصلتان تعنيان أن حدود الشرائح ستتباعد
 * بينهما بعد أول تعديل.
 */

import * as money from "../core/money.js";

/* ==========================================================================
   1) الشرائح
   ========================================================================== */

/**
 * شرائح التقادم القياسية. `from` و `to` بالأيام بعد تاريخ الاستحقاق،
 * و`to: null` تعني الشريحة المفتوحة الأخيرة.
 *
 * الشريحة الأولى (`current`) ليست تأخرًا: حدّها الأعلى صفر، أي كل ما لم
 * يستحق بعد. خلطها مع «1–30 يومًا» هو أشهر خطأ في تقارير التقادم — فيظهر
 * رصيد سليم كأنه متأخر شهرًا.
 */
export const AGING_BUCKETS = Object.freeze([
  { key: "current", label: "لم يستحق بعد", from: null, to: 0, tone: "success" },
  { key: "d1_30", label: "1 – 30 يومًا", from: 1, to: 30, tone: "info" },
  { key: "d31_60", label: "31 – 60 يومًا", from: 31, to: 60, tone: "warning" },
  { key: "d61_90", label: "61 – 90 يومًا", from: 61, to: 90, tone: "warning" },
  { key: "d91_180", label: "91 – 180 يومًا", from: 91, to: 180, tone: "danger" },
  { key: "over_180", label: "أكثر من 180 يومًا", from: 181, to: null, tone: "danger" },
]);

/** عدد الأيام بين تاريخين (ISO). موجب = الأول بعد الثاني. */
export function daysBetween(laterDate, earlierDate) {
  const later = Date.parse(`${String(laterDate).slice(0, 10)}T00:00:00Z`);
  const earlier = Date.parse(`${String(earlierDate).slice(0, 10)}T00:00:00Z`);

  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return 0;
  return Math.round((later - earlier) / 86_400_000);
}

/**
 * أيام التأخر لفاتورة. صفر أو أقل = لم تستحق بعد.
 * فاتورة بلا تاريخ استحقاق تُعدّ مستحقة من تاريخها.
 */
export function daysOverdue(invoice, asOf) {
  const due = invoice?.dueDate ?? invoice?.date;
  if (!due) return 0;
  return daysBetween(asOf, due);
}

/** الشريحة التي تقع فيها فاتورة. */
export function bucketFor(invoice, asOf) {
  const days = daysOverdue(invoice, asOf);

  return (
    AGING_BUCKETS.find(
      (bucket) =>
        (bucket.from === null || days >= bucket.from) && (bucket.to === null || days <= bucket.to),
    ) ?? AGING_BUCKETS[0]
  );
}

/* ==========================================================================
   2) تقرير التقادم
   ========================================================================== */

/**
 * يبني تقرير تقادم مُجمَّعًا حسب الطرف.
 *
 * المدخل فواتير **مُسوَّاة مسبقًا** (تحمل `remaining` من `settleInvoice`)،
 * لا فواتير خامًا: حساب المتبقي مكانه js/domain/invoicing.js، وتكراره هنا
 * يُنتج مصدر حقيقة ثانيًا للرقم نفسه.
 *
 * @param {object[]} invoices فواتير تحمل `remaining` و `dueDate` و `partyId`
 * @param {object} options
 * @param {string} options.asOf              التاريخ المرجعي (YYYY-MM-DD)
 * @param {object[]} [options.parties]       العملاء أو الموردون — لأسمائهم وحدود الائتمان
 * @param {string} [options.partyKey="partyId"] اسم حقل الربط في الفاتورة
 * @returns {{ rows:object[], totals:object, buckets:object[], asOf:string }}
 */
export function agingReport(invoices = [], { asOf, parties = [], partyKey = "partyId" } = {}) {
  const reference = String(asOf ?? new Date().toISOString()).slice(0, 10);
  const partyById = new Map(parties.map((party) => [String(party.id), party]));

  const emptyBuckets = () =>
    Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket.key, 0]));

  const byParty = new Map();

  for (const invoice of invoices) {
    const remaining = money.round(invoice?.remaining ?? 0);

    // الفاتورة المسوَّاة أو المُفرَطة السداد لا مكان لها في تقرير تقادم.
    if (!money.isPositive(remaining)) continue;

    const key = String(invoice?.[partyKey] ?? "__none__");
    const bucket = byParty.get(key) ?? {
      partyId: invoice?.[partyKey] ?? null,
      invoices: [],
      buckets: emptyBuckets(),
      total: 0,
      oldestDays: 0,
    };

    const slot = bucketFor(invoice, reference);
    const days = daysOverdue(invoice, reference);

    bucket.buckets[slot.key] = money.add(bucket.buckets[slot.key], remaining);
    bucket.total = money.add(bucket.total, remaining);
    bucket.oldestDays = Math.max(bucket.oldestDays, days);
    bucket.invoices.push({ ...invoice, remaining, agingBucket: slot.key, daysOverdue: days });

    byParty.set(key, bucket);
  }

  const rows = [...byParty.values()]
    .map((bucket) => {
      const party = partyById.get(String(bucket.partyId));
      const creditLimit = money.round(party?.creditLimit ?? 0);

      return {
        ...bucket,
        code: party?.code ?? "—",
        name: party?.name ?? "طرف غير محدَّد",
        phone: party?.phone ?? null,
        creditLimit,
        /**
         * تجاوز حد الائتمان. صفر الحد يعني «لا حد مُعَد» لا «حد صفر» —
         * معاملته كصفر تُظهر كل العملاء متجاوزين، وهو إنذار كاذب شامل.
         */
        overLimit: money.isZero(creditLimit)
          ? 0
          : money.max(money.subtract(bucket.total, creditLimit), 0),
        invoicesCount: bucket.invoices.length,
      };
    })
    .sort((a, b) => money.toMinor(b.total) - money.toMinor(a.total));

  const totals = {
    ...Object.fromEntries(
      AGING_BUCKETS.map((bucket) => [
        bucket.key,
        money.sum(rows.map((row) => row.buckets[bucket.key])),
      ]),
    ),
    total: money.sumBy(rows, "total"),
    overLimit: money.sumBy(rows, "overLimit"),
    partiesCount: rows.length,
    invoicesCount: rows.reduce((count, row) => count + row.invoicesCount, 0),
  };

  return { rows, totals, buckets: [...AGING_BUCKETS], asOf: reference };
}

/**
 * نسبة كل شريحة من الإجمالي — لمخطط التوزيع.
 * @returns {Array<{ key:string, label:string, tone:string, amount:number, share:number }>}
 */
export function agingDistribution(totals = {}) {
  const grand = money.round(totals.total ?? 0);

  return AGING_BUCKETS.map((bucket) => {
    const amount = money.round(totals[bucket.key] ?? 0);
    return {
      key: bucket.key,
      label: bucket.label,
      tone: bucket.tone,
      amount,
      share: money.isZero(grand) ? 0 : amount / grand,
    };
  });
}

/**
 * مؤشر جودة التحصيل: نسبة ما لم يستحق بعد من إجمالي المديونية.
 * الأعلى أفضل. يُستخدم في لوحة التحكم كمؤشر صحة الذمم.
 */
export function collectionHealth(totals = {}) {
  const grand = money.round(totals.total ?? 0);
  if (money.isZero(grand)) return 1;

  const healthy = money.add(totals.current ?? 0, totals.d1_30 ?? 0);
  return healthy / grand;
}

/**
 * الفواتير المستحقة قريبًا — خلال `withinDays` القادمة ولم تتأخر بعد.
 * تُغذّي تنبيهات لوحة التحكم ومتابعة التحصيل.
 */
export function dueSoon(invoices = [], { asOf, withinDays = 7 } = {}) {
  const reference = String(asOf ?? new Date().toISOString()).slice(0, 10);

  return invoices
    .filter((invoice) => {
      if (!money.isPositive(invoice?.remaining ?? 0)) return false;
      const days = daysOverdue(invoice, reference);
      return days <= 0 && days > -withinDays - 1;
    })
    .map((invoice) => ({ ...invoice, daysUntilDue: -daysOverdue(invoice, reference) }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
