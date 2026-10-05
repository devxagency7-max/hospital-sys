/**
 * فحص طبقة البيانات: تماسك الأرقام المالية، والاستعلام، والتوجيه.
 * هذه الوحدات لا تلمس DOM فتعمل في Node مباشرة.
 */

import { patients } from "../js/mock/patients.mock.js";
import { invoices, payments, invoiceLines } from "../js/mock/invoices.mock.js";
import { items, batches, deriveItemStatus } from "../js/mock/inventory.mock.js";
import { query, find, all } from "../js/mock/db.js";
import { dispatchMock, registeredEndpoints } from "../js/api/mock-adapter.js";
import { normalize, matchesQuery } from "../js/core/text.js";
import { validate, rules } from "../js/core/validate.js";
import { buildReport, assertExportable } from "../js/api/reports.api.js";
import { can, setRole } from "../js/core/permissions.js";
import * as money from "../js/core/money.js";

import { assert as check, section, report } from "./harness.mjs";

// التقريب عبر وحدة المال لا يدويًا — نفس الدقة التي يستخدمها التطبيق.
const r2 = (n) => money.round(n);

/* ───────────────────────── أحجام البيانات ───────────────────────── */
section("أحجام البيانات");
check("مرضى مُولَّدون", patients.length === 148, `${patients.length}`);
check("فواتير مُولَّدة", invoices.length === 236, `${invoices.length}`);
check("بنود فواتير", invoiceLines.length > 400, `${invoiceLines.length}`);
check("أصناف", items.length > 60, `${items.length}`);
check("تشغيلات", batches.length > 30, `${batches.length}`);

/* ───────────────────── تماسك الأرقام المالية ───────────────────── */
section("تماسك الأرقام المالية");

const headerMath = invoices.filter(
  (i) => Math.abs(r2(i.subtotal - i.discount + i.tax) - i.total) > 0.011,
);
check("subtotal − discount + tax = total", headerMath.length === 0, `${headerMath.length} مخالفة`);

/*
 * المعادلة الصحيحة هي `netPaid + remaining = total` لا `paid + remaining`.
 * المرتجع المعتمد يُخفّض صافي المدفوع ويرفع المتبقي، فالفاتورة المسدَّدة التي
 * رُدّ جزء منها تعود مديونية — وهذا هو جوهر الإصلاح.
 */
const active = invoices.filter((i) => i.status !== "cancelled");
const settleMath = active.filter(
  (i) => !money.equals(money.add(i.netPaid, i.remaining), i.total),
);
check(
  "netPaid + remaining = total (غير الملغاة)",
  settleMath.length === 0,
  settleMath.length
    ? `${settleMath.length} مخالفة، مثال ${settleMath[0].invoiceNumber}: ${settleMath[0].netPaid}+${settleMath[0].remaining}≠${settleMath[0].total}`
    : "",
);

const withRefund = active.filter((i) => i.refunded > 0);
check(
  "الفواتير ذات المرتجع: netPaid = paid − refunded",
  withRefund.length > 0 &&
    withRefund.every((i) => money.equals(i.netPaid, money.subtract(i.paid, i.refunded))),
  `${withRefund.length} فاتورة عليها مرتجع`,
);

const cancelled = invoices.filter((i) => i.status === "cancelled");
check(
  "الملغاة: paid و remaining صفر مع بقاء total",
  cancelled.length > 0 && cancelled.every((i) => i.paid === 0 && i.remaining === 0 && i.total > 0),
  `${cancelled.length} فاتورة ملغاة`,
);

// الفاتورة الملغاة لا يجوز أن تدخل مجاميع المديونية في كشف الحساب.
const cancelledPatient = cancelled[0]?.patientId;
if (cancelledPatient) {
  const acct = dispatchMock({
    method: "GET",
    path: `/patients/${cancelledPatient}/account`,
    params: {},
    body: null,
  });
  const expected = r2(
    acct.data.invoices
      .filter((i) => i.status !== "cancelled")
      .reduce((t, i) => t + i.total, 0),
  );
  check(
    "كشف الحساب يستبعد الملغاة من «إجمالي المفوتر»",
    Math.abs(acct.data.summary.totalInvoiced - expected) < 0.011,
    `${acct.data.summary.totalInvoiced} مقابل ${expected} (ملغاة: ${acct.data.summary.cancelledCount})`,
  );
}

// الدفعات المسجَّلة يجب أن تساوي حقل paid (الملغاة مستثناة: paid=0 بلا دفعات)
const paidByInvoice = new Map();
for (const p of payments) {
  paidByInvoice.set(p.invoiceId, r2((paidByInvoice.get(p.invoiceId) ?? 0) + p.amount));
}
const paymentMismatch = invoices.filter(
  (i) => Math.abs((paidByInvoice.get(i.id) ?? 0) - i.paid) > 0.011,
);
check("مجموع الدفعات = حقل paid", paymentMismatch.length === 0, `${paymentMismatch.length} مخالفة`);

const lineMath = new Map();
for (const l of invoiceLines) {
  lineMath.set(l.invoiceId, r2((lineMath.get(l.invoiceId) ?? 0) + l.lineTotal));
}
const subtotalMismatch = invoices.filter(
  (i) => Math.abs((lineMath.get(i.id) ?? 0) - i.subtotal) > 0.011,
);
check("مجموع البنود = subtotal", subtotalMismatch.length === 0, `${subtotalMismatch.length} مخالفة`);

// الحالة تُشتق من صافي المدفوع لا من المدفوع الخام.
const statusMismatch = invoices.filter((i) => {
  if (i.status === "cancelled") return false;
  const expected =
    money.isNegative(i.remaining)
      ? "overpaid"
      : money.isZero(i.remaining)
        ? "paid"
        : money.isPositive(i.netPaid)
          ? "partially_paid"
          : "unpaid";
  return i.status !== expected;
});
check(
  "الحالة مشتقة من الأرقام",
  statusMismatch.length === 0,
  statusMismatch.length ? `${statusMismatch[0].invoiceNumber} → ${statusMismatch[0].status}` : "",
);

const negatives = invoices.filter((i) => i.total < 0 || i.paid < 0 || i.remaining < 0);
check("لا مبالغ سالبة", negatives.length === 0, `${negatives.length}`);

/* ───────────────────── الحالات المشتقة للمخزون ───────────────────── */
section("الحالات المشتقة للمخزون");
const itemRows = all("items");
const badStatus = itemRows.filter((i) => i.status !== deriveItemStatus(i));
check("حالة الصنف مشتقة من الكمية", badStatus.length === 0, `${badStatus.length}`);

const lowButPlenty = itemRows.filter((i) => i.status === "low_stock" && i.quantity > i.minimumQuantity);
check("لا صنف «منخفض» وكميته أعلى من الحد", lowButPlenty.length === 0, `${lowButPlenty.length}`);

const outButStocked = itemRows.filter((i) => i.status === "out_of_stock" && i.quantity > 0);
check("لا صنف «نافد» وكميته > 0", outButStocked.length === 0, `${outButStocked.length}`);

check(
  "توزيع الحالات واقعي",
  itemRows.some((i) => i.status === "low_stock") && itemRows.some((i) => i.status === "available"),
  `منخفض=${itemRows.filter((i) => i.status === "low_stock").length} نافد=${itemRows.filter((i) => i.status === "out_of_stock").length}`,
);

/* ───────────────────── محرك الاستعلام ───────────────────── */
section("محرك الاستعلام");
const page1 = query("patients", { page: 1, perPage: 25 });
check("الترقيم يحترم perPage", page1.data.length === 25);
check("meta.total صحيح", page1.meta.total === 148, `${page1.meta.total}`);
check("meta.totalPages صحيح", page1.meta.totalPages === 6, `${page1.meta.totalPages}`);

const page7 = query("patients", { page: 99, perPage: 25 });
check("صفحة خارج النطاق تُقيَّد لآخر صفحة", page7.meta.page === 6, `${page7.meta.page}`);

const sorted = query("patients", { sort: "visitsCount", order: "desc", perPage: 100 });
const descOk = sorted.data.every(
  (row, i) => i === 0 || sorted.data[i - 1].visitsCount >= row.visitsCount,
);
check("الترتيب تنازليًا يعمل", descOk);

const filtered = query("patients", { status: "active", perPage: 200 });
check("الفلترة بحقل تعمل", filtered.data.every((p) => p.status === "active"));

const multi = query("invoices", { status: "unpaid,partially_paid", perPage: 300 });
check(
  "فلتر متعدد القيم يعمل",
  multi.data.length > 0 && multi.data.every((i) => ["unpaid", "partially_paid"].includes(i.status)),
  `${multi.data.length} نتيجة`,
);

const ranged = query("invoices", { dateFrom: "2026-09-01", dateTo: "2026-09-30", perPage: 300 });
check(
  "فلتر نطاق التاريخ يعمل",
  ranged.data.length > 0 && ranged.data.every((i) => i.date >= "2026-09-01" && i.date <= "2026-09-30"),
  `${ranged.data.length} نتيجة`,
);

/* ───────────────────── البحث العربي ───────────────────── */
section("البحث العربي المُطبَّع");
check("أ ← ا", normalize("أحمد") === normalize("احمد"));
check("ة ← ه", normalize("فاطمة") === normalize("فاطمه"));
check("ى ← ي", normalize("مصطفى") === normalize("مصطفي"));
check("أرقام هندية ← لاتينية", normalize("١٠٠١") === "1001");
check("مطابقة بالكلمات لا بالنص الكامل", matchesQuery("أحمد محمود خليل", "احمد خليل"));
check("كلمة غير موجودة لا تُطابق", !matchesQuery("أحمد محمود خليل", "احمد سمير"));

const searched = query("patients", { search: "احمد", perPage: 200 });
check("البحث في المجموعة يجد نتائج", searched.data.length > 0, `${searched.data.length} نتيجة`);

/* ───────────────────── موجّه الطلبات ───────────────────── */
section("موجّه الطلبات التجريبية");
check("endpoints مسجَّلة", registeredEndpoints().length >= 25, `${registeredEndpoints().length}`);

const dash = dispatchMock({ method: "GET", path: "/dashboard/summary", params: {}, body: null });
check("ملخص لوحة التحكم يعمل", dash.data.patients.total === 148);
check("تقييم المخزون محسوب", dash.data.inventory.valuation > 0, `${dash.data.inventory.valuation}`);
check(
  "الأرصدة المستحقة موجبة",
  dash.data.revenue.outstanding > 0,
  `${dash.data.revenue.outstanding}`,
);

const one = dispatchMock({ method: "GET", path: "/patients/1001", params: {}, body: null });
check("مسار بمعامل يعمل", one.data.id === 1001);

const account = dispatchMock({ method: "GET", path: "/patients/1001/account", params: {}, body: null });
check("كشف الحساب يُعيد كل الأقسام",
  ["patient", "invoices", "payments", "refunds", "summary"].every((k) => k in account.data));

// التحقق الحسابي لكشف الحساب
const s = account.data.summary;
check(
  "رصيد كشف الحساب = مُفوتر − مدفوع + مرتجع",
  Math.abs(r2(s.totalInvoiced - s.totalPaid + s.totalRefunded) - s.remainingBalance) < 0.011,
  `${s.remainingBalance}`,
);

let threw = null;
try {
  dispatchMock({ method: "POST", path: "/invoices", params: {}, body: {} });
} catch (e) {
  threw = e;
}
check(
  "مسار غير مسجَّل يرمي NOT_IMPLEMENTED لا نجاحًا وهميًا",
  threw?.code === "NOT_IMPLEMENTED" && threw?.status === 501,
  threw?.code ?? "لم يرمِ شيئًا",
);

let notFoundErr = null;
try {
  dispatchMock({ method: "GET", path: "/patients/999999", params: {}, body: null });
} catch (e) {
  notFoundErr = e;
}
check("سجل غير موجود يرمي NOT_FOUND", notFoundErr?.code === "NOT_FOUND");

let validationErr = null;
try {
  dispatchMock({ method: "POST", path: "/patients", params: {}, body: { name: "" } });
} catch (e) {
  validationErr = e;
}
check(
  "التحقق يرمي VALIDATION_ERROR بأخطاء حقول",
  validationErr?.code === "VALIDATION_ERROR" && validationErr?.fields?.name,
);

// الكتابة تُعدّل الذاكرة فعلًا
const before = all("patients").length;
const created = dispatchMock({
  method: "POST",
  path: "/patients",
  params: {},
  body: { name: "تجربة إدخال", phone: "01012345678" },
});
check("الإنشاء يُعدّل الذاكرة فعلًا", all("patients").length === before + 1);
check("الكود يُولَّد تلقائيًا", created.data.patientCode === `P-${created.data.id}`);

/* ───────────────────── التحقق من النماذج ───────────────────── */
section("التحقق من النماذج");
const bad = validate(
  { name: "", phone: "0501234567", amount: "-5", dateTo: "2026-01-01", dateFrom: "2026-06-01" },
  {
    name: [rules.required()],
    phone: [rules.required(), rules.phone()],
    amount: [rules.money()],
    dateTo: [rules.notBefore("dateFrom")],
  },
);
check("يرفض النموذج الخاطئ", !bad.valid);
check("يلتقط الحقل المطلوب", Boolean(bad.errors.name));
check("يلتقط الهاتف غير المصري", Boolean(bad.errors.phone));
check("يلتقط المبلغ السالب", Boolean(bad.errors.amount));
check("يلتقط ترتيب التاريخين", Boolean(bad.errors.dateTo));

const good = validate(
  { name: "أحمد خليل", phone: "01012345678", amount: "1250.50" },
  { name: [rules.required()], phone: [rules.required(), rules.phone()], amount: [rules.money()] },
);
check("يقبل النموذج الصحيح", good.valid, JSON.stringify(good.errors));

/* ───────────────────── قاعدة التقارير الحرجة ───────────────────── */
section("قاعدة التقارير: ممنوع تصدير تقرير ناقص");

const complete = await buildReport({
  title: "كشف حساب",
  sections: [
    { key: "services", label: "الخدمات", load: async () => [1, 2] },
    { key: "payments", label: "المدفوعات", load: async () => [3] },
  ],
});
check("تقرير ناجح → complete", complete.status === "complete");
check("تقرير ناجح → exportable", complete.exportable === true);
check("التصدير يمر", (() => { try { assertExportable(complete); return true; } catch { return false; } })());

const incomplete = await buildReport({
  title: "كشف حساب",
  sections: [
    { key: "services", label: "الخدمات", load: async () => [1] },
    { key: "payments", label: "المدفوعات", load: async () => { throw new Error("فشل الشبكة"); } },
    { key: "refunds", label: "المرتجعات", load: async () => { throw new Error("مهلة"); } },
  ],
});
check("قسم فاشل → incomplete", incomplete.status === "incomplete");
check("قسم فاشل → exportable = false", incomplete.exportable === false);
check("يسمّي الأقسام الفاشلة", incomplete.failures.length === 2,
  incomplete.failures.map((f) => f.label).join("، "));
check("القسم الناجح يبقى محمَّلاً", incomplete.sections.services.status === "ok");

let exportBlocked = false;
try {
  assertExportable(incomplete);
} catch (e) {
  exportBlocked = e.name === "ReportIncompleteError" && e.message.includes("المدفوعات");
}
check("بوابة التصدير تحجب التقرير الناقص وتسمّي السبب", exportBlocked);

const optional = await buildReport({
  title: "تقرير",
  sections: [
    { key: "core", label: "الأساسي", load: async () => [1] },
    { key: "extra", label: "إضافي", required: false, load: async () => { throw new Error("فشل"); } },
  ],
});
check("قسم غير مطلوب لا يُسقط التقرير", optional.exportable === true);
check("لكن فشله مُسجَّل", optional.sections.extra.status === "failed");

/* ───────────────────── الصلاحيات ───────────────────── */
section("الصلاحيات");
setRole("admin");
check("admin يملك كل شيء", can("accounting.period.close") && can("roles.manage"));

setRole("receptionist");
check("الاستقبال يرى المرضى", can("patients.view"));
check("الاستقبال يحجز موعدًا (بالبادئة *)", can("appointments.create"));
check("الاستقبال لا يُغلق فترة محاسبية", !can("accounting.period.close"));
check("الاستقبال لا يدير الأدوار", !can("roles.manage"));

setRole("lab_technician");
check("فني المختبر يُدخل نتيجة", can("laboratory.result.enter"));
check("فني المختبر لا يعتمد نتيجة", !can("laboratory.result.approve"));
check("فني المختبر لا يرى الفواتير", !can("billing.view"));

setRole("admin");

report();
