/**
 * اختبارات الحساب المالي.
 *
 * تغطي `js/core/money.js` و `js/domain/billing.js` — الدوال الخالصة التي تُعرّف
 * كل رقم مالي في النظام. تعمل في Node بلا متصفح لأن هذه الوحدات لا تلمس DOM،
 * وهذا بحد ذاته أحد مخرجات التثبيت: الحساب المالي معزول عن العرض.
 *
 *   node tests/billing.test.mjs
 */

import * as money from "../js/core/money.js";
import {
  InvoiceLifecycle,
  DocumentStatus,
  calculateInvoiceTotals,
  settleInvoice,
  deriveInvoiceStatus,
  summarizePatientAccount,
  totalOutstanding,
  totalInvoiced,
  totalCredited,
  totalCollected,
  isOverdue,
  isDraft,
  isIssued,
  isCancelled,
  isFinalized,
  assertMutable,
  assertDocumentMutable,
  issueInvoice,
  cancelInvoice,
  maxRefundable,
  maxCreditable,
  buildInvoiceTimeline,
} from "../js/domain/billing.js";

import { assert, assertMoney, assertThrows, section, report } from "./harness.mjs";

/* ==========================================================================
   وحدة المال
   ========================================================================== */

section("money — دقة الحساب");

assert("0.1 + 0.2 = 0.3 بالضبط", money.add(0.1, 0.2) === 0.3);
assert("الجمع الخام يُخطئ (للمقارنة)", 0.1 + 0.2 !== 0.3);

assertMoney("جمع 1000 مبلغ بثلاث منازل لا ينحرف", money.sum(Array(1000).fill(0.07)), 70);

assert("toMinor يقرّب 1.005 إلى 101 قرشًا", money.toMinor(1.005) === 101);
assert("toMinor يتعامل مع null", money.toMinor(null) === 0);
assert("toMinor يتعامل مع نص", money.toMinor("12.34") === 1234);

assertMoney("الضرب: 33.33 × 3", money.multiply(33.33, 3), 99.99);
assertMoney("نسبة: 14% من 1000", money.percentOf(1000, 0.14), 140);

assert("equals تتجاوز مشكلة العشرية", money.equals(0.1 + 0.2, 0.3));
assert("compare تعمل", money.compare(5, 3) === 1 && money.compare(3, 5) === -1);

section("money — التوزيع بلا ضياع قرش");

const thirds = money.allocate(100, 3);
assertMoney("توزيع 100 على 3 يجمع 100", money.sum(thirds), 100);
assert("الحصص: 33.34 / 33.33 / 33.33", thirds.join(",") === "33.34,33.33,33.33", thirds.join(","));

const weighted = money.allocateByWeight(100, [50, 30, 20]);
assertMoney("توزيع بالوزن يجمع 100", money.sum(weighted), 100);

const odd = money.allocateByWeight(0.05, [1, 1, 1]);
assertMoney("توزيع 5 قروش على 3 يجمع 0.05", money.sum(odd), 0.05);

/* ==========================================================================
   إجماليات الفاتورة
   ========================================================================== */

section("الفاتورة — الإجماليات");

const basicLines = [
  { quantity: 2, unitPrice: 250 },
  { quantity: 1, unitPrice: 1850 },
];

const plain = calculateInvoiceTotals({ lines: basicLines });
assertMoney("الإجمالي قبل الخصم", plain.subtotal, 2350);
assertMoney("بلا خصم", plain.discount, 0);
assertMoney("بلا ضريبة", plain.tax, 0);
assertMoney("الإجمالي", plain.total, 2350);

const discounted = calculateInvoiceTotals({ lines: basicLines, discountRate: 0.1 });
assertMoney("خصم 10%", discounted.discount, 235);
assertMoney("الإجمالي بعد الخصم", discounted.total, 2115);

const fixed = calculateInvoiceTotals({ lines: basicLines, discount: 350 });
assertMoney("خصم بمبلغ مقطوع", fixed.discount, 350);
assertMoney("الإجمالي", fixed.total, 2000);

const taxed = calculateInvoiceTotals({ lines: basicLines, discountRate: 0.1, taxRate: 0.14 });
assertMoney("الضريبة على الصافي بعد الخصم", taxed.tax, 296.1);
assertMoney("الإجمالي مع الضريبة", taxed.total, 2411.1);

// حماية من قيم فاسدة
const overDiscount = calculateInvoiceTotals({ lines: basicLines, discount: 99999 });
assertMoney("الخصم لا يتجاوز الإجمالي", overDiscount.discount, 2350);
assertMoney("الإجمالي لا يصبح سالبًا", overDiscount.total, 0);

const negDiscount = calculateInvoiceTotals({ lines: basicLines, discount: -50 });
assertMoney("الخصم السالب يُعامل كصفر", negDiscount.discount, 0);

assertMoney("فاتورة بلا بنود", calculateInvoiceTotals({ lines: [] }).total, 0);

// كسور تكشف انحراف الفاصلة العائمة
const fractional = calculateInvoiceTotals({
  lines: [{ quantity: 3, unitPrice: 33.33 }, { quantity: 7, unitPrice: 0.07 }],
});
assertMoney("بنود كسرية", fractional.subtotal, 100.48);

/* ==========================================================================
   تسوية الفاتورة — الحالات المطلوبة
   ========================================================================== */

section("التسوية — فاتورة مفتوحة (غير مدفوعة)");

const open = settleInvoice({ total: 1000 }, { payments: [], refunds: [] });
assertMoney("المدفوع صفر", open.paid, 0);
assertMoney("المتبقي كامل", open.remaining, 1000);
assert("الحالة unpaid", open.status === "unpaid", open.status);
assert("غير مسوّاة", open.isSettled === false);

section("التسوية — فاتورة مسدَّدة بالكامل");

const closed = settleInvoice({ total: 1000 }, { payments: [{ amount: 1000 }] });
assertMoney("المدفوع كامل", closed.paid, 1000);
assertMoney("المتبقي صفر", closed.remaining, 0);
assert("الحالة paid", closed.status === "paid", closed.status);
assert("مسوّاة", closed.isSettled === true);

const closedInstallments = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 400 }, { amount: 350.5 }, { amount: 249.5 }] },
);
assertMoney("سداد على ثلاث دفعات", closedInstallments.paid, 1000);
assert("الحالة paid", closedInstallments.status === "paid", closedInstallments.status);

section("التسوية — فاتورة مدفوعة جزئيًا");

const partial = settleInvoice({ total: 1000 }, { payments: [{ amount: 300 }] });
assertMoney("المدفوع", partial.paid, 300);
assertMoney("المتبقي", partial.remaining, 700);
assert("الحالة partially_paid", partial.status === "partially_paid", partial.status);

const tiny = settleInvoice({ total: 1000 }, { payments: [{ amount: 0.01 }] });
assert("قرش واحد يجعلها جزئية لا غير مدفوعة", tiny.status === "partially_paid", tiny.status);

section("التسوية — المرتجعات (الباگ الأصلي)");

/*
 * السيناريو الذي كشف الخلل: فاتورة سُدِّدت بالكامل ثم اعتُمد عليها مرتجع.
 * قبل التثبيت كان `remaining` يبقى صفرًا — فيقول جدول الفواتير إن المريض لا
 * يدين بشيء، بينما يطالبه كشف الحساب بقيمة المرتجع.
 */
const refunded = settleInvoice(
  { total: 36496 },
  { payments: [{ amount: 36496 }], refunds: [{ amount: 9124, status: "approved" }] },
);
assertMoney("المدفوع يبقى كما هو", refunded.paid, 36496);
assertMoney("المرتجع مسجَّل", refunded.refunded, 9124);
assertMoney("صافي المدفوع = المدفوع − المرتجع", refunded.netPaid, 27372);
assertMoney("المتبقي يساوي المرتجع", refunded.remaining, 9124);
assert("الحالة تعود partially_paid", refunded.status === "partially_paid", refunded.status);
assert("لم تعد مسوّاة", refunded.isSettled === false);

const pendingRefund = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 1000 }], refunds: [{ amount: 400, status: "pending" }] },
);
assertMoney("المرتجع المعلّق لا يُحتسب", pendingRefund.refunded, 0);
assertMoney("المتبقي يبقى صفرًا", pendingRefund.remaining, 0);
assert("الحالة تبقى paid", pendingRefund.status === "paid", pendingRefund.status);

const rejectedRefund = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 1000 }], refunds: [{ amount: 400, status: "rejected" }] },
);
assertMoney("المرتجع المرفوض لا يُحتسب", rejectedRefund.refunded, 0);

const fullRefund = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 1000 }], refunds: [{ amount: 1000, status: "approved" }] },
);
assertMoney("مرتجع كامل يُعيد المتبقي للإجمالي", fullRefund.remaining, 1000);
assert("الحالة تعود unpaid", fullRefund.status === "unpaid", fullRefund.status);

const multiRefund = settleInvoice(
  { total: 1000 },
  {
    payments: [{ amount: 1000 }],
    refunds: [
      { amount: 200, status: "approved" },
      { amount: 150, status: "approved" },
      { amount: 500, status: "pending" },
    ],
  },
);
assertMoney("مرتجعات متعددة تُجمع المعتمدة فقط", multiRefund.refunded, 350);
assertMoney("المتبقي", multiRefund.remaining, 350);

section("التسوية — إشعارات الدائن (تصحيح قيمة الفاتورة)");

/*
 * الفرق الجوهري عن المرتجع: إشعار الدائن يُخفّض effectiveTotal (جانب
 * الفاتورة) لا netPaid (جانب التحصيل). فاتورة لم يُدفع عليها شيء بعد وصدر
 * عليها إشعار دائن: المتبقي يقل فورًا، رغم أن المدفوع لا يزال صفرًا.
 */
const creditedUnpaid = settleInvoice(
  { total: 1000 },
  { creditNotes: [{ amount: 300, status: "approved" }] },
);
assertMoney("effectiveTotal ينخفض بقيمة الإشعار", creditedUnpaid.effectiveTotal, 700);
assertMoney("المدفوع يبقى صفرًا — الإشعار لا يمسّ التحصيل", creditedUnpaid.paid, 0);
assertMoney("المتبقي = effectiveTotal", creditedUnpaid.remaining, 700);
assert("الحالة unpaid لا partially_paid", creditedUnpaid.status === "unpaid", creditedUnpaid.status);

const creditedPending = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 1000 }], creditNotes: [{ amount: 300, status: "pending" }] },
);
assertMoney("الإشعار المعلّق لا يُحتسب", creditedPending.credited, 0);
assertMoney("effectiveTotal يبقى كاملًا", creditedPending.effectiveTotal, 1000);
assert("الحالة تبقى paid", creditedPending.status === "paid", creditedPending.status);

const creditedRejected = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 1000 }], creditNotes: [{ amount: 300, status: "rejected" }] },
);
assertMoney("الإشعار المرفوض لا يُحتسب", creditedRejected.credited, 0);

const multiCredit = settleInvoice(
  { total: 1000 },
  {
    creditNotes: [
      { amount: 200, status: "approved" },
      { amount: 150, status: "approved" },
      { amount: 500, status: "pending" },
    ],
  },
);
assertMoney("إشعارات متعددة تُجمع المعتمدة فقط", multiCredit.credited, 350);
assertMoney("effectiveTotal", multiCredit.effectiveTotal, 650);

const overCredited = settleInvoice(
  { total: 1000 },
  { creditNotes: [{ amount: 1500, status: "approved" }] },
);
assertMoney(
  "إشعار يتجاوز الإجمالي: effectiveTotal لا يصبح سالبًا",
  overCredited.effectiveTotal,
  0,
);
assertMoney("المتبقي صفر لا سالب", overCredited.remaining, 0);

section("التسوية — إشعار دائن بعد تحصيل كامل (الحالة الحرجة)");

/*
 * السيناريو الذي يثبت استقلال المحورين: فاتورة سُدِّدت بالكامل، ثم اكتُشف
 * أن جزءًا من الخدمة لم يُقدَّم فصدر إشعار دائن — لا مرتجع، لأن لا أحد طلب
 * استرداد مال بعد؛ القيمة المستحقة هي التي تغيّرت. النتيجة "دفع زائد" لا
 * "مدفوعة جزئيًا" — المريض الآن له رصيد دائن، لا عليه مديونية.
 */
const fullyPaidThenCredited = settleInvoice(
  { total: 1000 },
  { payments: [{ amount: 1000 }], creditNotes: [{ amount: 300, status: "approved" }] },
);
assertMoney("effectiveTotal", fullyPaidThenCredited.effectiveTotal, 700);
assertMoney("netPaid لم يتغيّر — لا مرتجع هنا", fullyPaidThenCredited.netPaid, 1000);
assertMoney("المتبقي سالب = رصيد دائن 300", fullyPaidThenCredited.remaining, -300);
assert("الحالة overpaid لا paid", fullyPaidThenCredited.status === "overpaid", fullyPaidThenCredited.status);

section("التسوية — مرتجع وإشعار دائن معًا");

/*
 * المحوران مستقلان تمامًا ويتركّبان بلا أي حالة خاصة: إشعار دائن يُخفّض
 * effectiveTotal، ثم مرتجع جزئي من الفائض الناتج يُخفّض netPaid — بالضبط
 * كما يحدث في الواقع: تصحيح القيمة أولًا، ثم إعادة الفائض نقدًا.
 */
const both = settleInvoice(
  { total: 1000 },
  {
    payments: [{ amount: 1000 }],
    creditNotes: [{ amount: 200, status: "approved" }],
    refunds: [{ amount: 150, status: "approved" }],
  },
);
assertMoney("effectiveTotal = 1000 − 200", both.effectiveTotal, 800);
assertMoney("netPaid = 1000 − 150", both.netPaid, 850);
assertMoney("المتبقي = effectiveTotal − netPaid", both.remaining, -50);
assert("الحالة overpaid", both.status === "overpaid", both.status);

section("التسوية — الدفع الزائد (بالتحصيل المباشر، بلا إشعار)");

const over = settleInvoice({ total: 1000 }, { payments: [{ amount: 1200 }] });
assertMoney("المتبقي سالب", over.remaining, -200);
assert("الحالة overpaid", over.status === "overpaid", over.status);

section("التسوية — الفاتورة الملغاة");

const cancelled = settleInvoice(
  { total: 5000, status: "cancelled" },
  {
    payments: [{ amount: 2000 }],
    refunds: [{ amount: 500, status: "approved" }],
    creditNotes: [{ amount: 300, status: "approved" }],
  },
);
assertMoney("الإجمالي يبقى للتدقيق", cancelled.total, 5000);
assertMoney("effectiveTotal = total — لا تصحيح على فاتورة ملغاة", cancelled.effectiveTotal, 5000);
assertMoney("المدفوع صفر", cancelled.paid, 0);
assertMoney("المُحتسب (مرتجع) صفر", cancelled.refunded, 0);
assertMoney("المُحتسب (إشعار دائن) صفر", cancelled.credited, 0);
assertMoney("المتبقي صفر", cancelled.remaining, 0);
assert("الحالة cancelled", cancelled.status === "cancelled", cancelled.status);
assert("lifecycleStatus cancelled", cancelled.lifecycleStatus === InvoiceLifecycle.CANCELLED);
assert("مسوّاة", cancelled.isSettled === true);

section("التسوية — الفاتورة المسودة");

/*
 * المسودة ليست التزامًا ماليًا بعد — لا مديونية حتى تُصدَر. حتى لو سُجِّلت
 * عليها دفعة بالخطأ (حالة شاذة لا ينبغي أن تحدث عبر الواجهة)، الحساب يتجاهلها.
 */
const draft = settleInvoice(
  { total: 1000, lifecycleStatus: InvoiceLifecycle.DRAFT },
  { payments: [{ amount: 500 }] },
);
assertMoney("الإجمالي محفوظ", draft.total, 1000);
assertMoney("effectiveTotal = total", draft.effectiveTotal, 1000);
assertMoney("لا مديونية بعد", draft.remaining, 0);
assert("الحالة draft", draft.status === InvoiceLifecycle.DRAFT, draft.status);
assert("غير مسوّاة", draft.isSettled === false);

const legacyDraft = settleInvoice({ total: 500, status: "draft" }, {});
assert(
  "التوافق الرجعي: status='draft' يُقرأ كـ lifecycleStatus",
  legacyDraft.lifecycleStatus === InvoiceLifecycle.DRAFT,
  legacyDraft.lifecycleStatus,
);

const legacyIssued = settleInvoice({ total: 500, status: "paid" }, { payments: [{ amount: 500 }] });
assert(
  "التوافق الرجعي: أي status آخر يُعامَل كـ issued",
  legacyIssued.lifecycleStatus === InvoiceLifecycle.ISSUED,
  legacyIssued.lifecycleStatus,
);

section("اشتقاق الحالة");

assert("صفر متبقٍ → paid", deriveInvoiceStatus({ netPaid: 100, remaining: 0 }) === "paid");
assert("لا مدفوع → unpaid", deriveInvoiceStatus({ netPaid: 0, remaining: 100 }) === "unpaid");
assert("مدفوع جزئي → partially_paid", deriveInvoiceStatus({ netPaid: 40, remaining: 60 }) === "partially_paid");
assert("متبقٍ سالب → overpaid", deriveInvoiceStatus({ netPaid: 120, remaining: -20 }) === "overpaid");

/* ==========================================================================
   دورة حياة الفاتورة — انتقالات ومنع التعديل
   ========================================================================== */

section("محمولات الدورة");

assert("isDraft", isDraft({ lifecycleStatus: "draft" }) && !isDraft({ lifecycleStatus: "issued" }));
assert("isIssued", isIssued({ lifecycleStatus: "issued" }) && !isIssued({ lifecycleStatus: "cancelled" }));
assert("isCancelled", isCancelled({ status: "cancelled" }));
assert("isFinalized يساوي isIssued", isFinalized === isIssued);
assert(
  "فاتورة بلا أي حقل حالة تُعامَل كصادرة",
  isIssued({ total: 100 }) && !isDraft({ total: 100 }) && !isCancelled({ total: 100 }),
);

section("منع التعديل بعد الإصدار");

assertThrows(
  "assertMutable ترمي على فاتورة صادرة",
  () => assertMutable({ lifecycleStatus: InvoiceLifecycle.ISSUED, invoiceNumber: "INV-1" }),
  (error) => error.code === "BUSINESS_RULE_VIOLATION" && /INV-1/.test(error.message),
);
assertThrows(
  "assertMutable ترمي على فاتورة ملغاة",
  () => assertMutable({ lifecycleStatus: InvoiceLifecycle.CANCELLED }),
);

{
  let threw = false;
  try {
    assertMutable({ lifecycleStatus: InvoiceLifecycle.DRAFT });
  } catch {
    threw = true;
  }
  assert("assertMutable لا ترمي على مسودة", threw === false);
}

section("إصدار الفاتورة");

const draftInvoice = { id: 1, total: 1000, lifecycleStatus: InvoiceLifecycle.DRAFT };
const issued = issueInvoice(draftInvoice, { issuedAt: "2026-10-05T10:00:00Z" });
assert("lifecycleStatus يصبح issued", issued.lifecycleStatus === InvoiceLifecycle.ISSUED);
assert("يسجّل issuedAt", issued.issuedAt === "2026-10-05T10:00:00Z");
assert("لا يُعدِّل الكائن الأصلي (دالة خالصة)", draftInvoice.lifecycleStatus === InvoiceLifecycle.DRAFT);

assertThrows(
  "لا يمكن إصدار فاتورة صادرة بالفعل",
  () => issueInvoice({ lifecycleStatus: InvoiceLifecycle.ISSUED }),
);
assertThrows(
  "لا يمكن إصدار فاتورة ملغاة",
  () => issueInvoice({ lifecycleStatus: InvoiceLifecycle.CANCELLED }),
);

section("إلغاء الفاتورة");

const toCancel = { id: 2, invoiceNumber: "INV-2", total: 1000, lifecycleStatus: InvoiceLifecycle.ISSUED };
const cancelledInvoice = cancelInvoice(toCancel, { reason: "خطأ في تسجيل الخدمة", cancelledAt: "2026-10-05T11:00:00Z", cancelledBy: "عبدالله محمد" });
assert("lifecycleStatus يصبح cancelled", cancelledInvoice.lifecycleStatus === InvoiceLifecycle.CANCELLED);
assert("يسجّل السبب", cancelledInvoice.cancellationReason === "خطأ في تسجيل الخدمة");
assert("يسجّل من ألغى ومتى", cancelledInvoice.cancelledBy === "عبدالله محمد" && cancelledInvoice.cancelledAt === "2026-10-05T11:00:00Z");
assert("لا يُعدِّل الكائن الأصلي", toCancel.lifecycleStatus === InvoiceLifecycle.ISSUED);

assertThrows(
  "الإلغاء يتطلب سببًا",
  () => cancelInvoice({ lifecycleStatus: InvoiceLifecycle.ISSUED }, {}),
  (error) => error.code === "BUSINESS_RULE_VIOLATION" && error.fields?.reason,
);
assertThrows(
  "سبب فارغ (مسافات فقط) يُرفض",
  () => cancelInvoice({ lifecycleStatus: InvoiceLifecycle.ISSUED }, { reason: "   " }),
);
assertThrows(
  "لا يمكن إلغاء فاتورة ملغاة بالفعل",
  () => cancelInvoice({ lifecycleStatus: InvoiceLifecycle.CANCELLED }, { reason: "أي سبب" }),
);

section("منع تعديل مستندات الردّ بعد مراجعتها");

{
  let threw = false;
  try {
    assertDocumentMutable({ status: DocumentStatus.PENDING }, "مرتجع");
  } catch {
    threw = true;
  }
  assert("لا ترمي على مستند معلّق", threw === false);
}

assertThrows(
  "ترمي على مرتجع معتمد",
  () => assertDocumentMutable({ status: DocumentStatus.APPROVED }, "مرتجع"),
  (error) => /مرتجع/.test(error.message) && /APPROVED|approved/.test(error.message),
);
assertThrows(
  "ترمي على إشعار دائن مرفوض، وتذكر النوع في الرسالة",
  () => assertDocumentMutable({ status: DocumentStatus.REJECTED }, "إشعار دائن"),
  (error) => /إشعار دائن/.test(error.message),
);

section("حدود الردّ والتصحيح");

const issuedWithHistory = { lifecycleStatus: InvoiceLifecycle.ISSUED, total: 1000 };

assertMoney(
  "أقصى مرتجع = المدفوع − المرتجع السابق",
  maxRefundable(issuedWithHistory, {
    payments: [{ amount: 1000 }],
    refunds: [{ amount: 300, status: "approved" }],
  }),
  700,
);
assertMoney(
  "أقصى مرتجع لا يقل عن صفر",
  maxRefundable(issuedWithHistory, {
    payments: [{ amount: 100 }],
    refunds: [{ amount: 300, status: "approved" }],
  }),
  0,
);
assertMoney(
  "أقصى إشعار دائن = الإجمالي − الإشعارات السابقة",
  maxCreditable(issuedWithHistory, { creditNotes: [{ amount: 400, status: "approved" }] }),
  600,
);
assertMoney(
  "لا رد ولا تصحيح على فاتورة مسودة",
  maxRefundable({ lifecycleStatus: InvoiceLifecycle.DRAFT, total: 1000 }, { payments: [{ amount: 1000 }] }),
  0,
);
assertMoney(
  "ولا على فاتورة ملغاة",
  maxCreditable({ lifecycleStatus: InvoiceLifecycle.CANCELLED, total: 1000 }, {}),
  0,
);

/* ==========================================================================
   السجل الزمني للفاتورة
   ========================================================================== */

section("السجل الزمني");

const timeline = buildInvoiceTimeline(
  { invoiceNumber: "INV-9", date: "2026-09-01", total: 1000 },
  {
    payments: [{ date: "2026-09-05", amount: 600, reference: "RCT-1" }],
    refunds: [{ date: "2026-09-10", amount: 100, refundNumber: "REF-1", status: "approved" }],
    creditNotes: [{ date: "2026-09-08", amount: 200, creditNoteNumber: "CN-1", status: "approved" }],
  },
);

assert("يضم كل الأحداث الأربعة", timeline.length === 4, `${timeline.length}`);
assert(
  "مرتَّب زمنيًا",
  timeline.map((event) => event.date).join(",") ===
    ["2026-09-01", "2026-09-05", "2026-09-08", "2026-09-10"].join(","),
  timeline.map((event) => event.date).join(","),
);
assert("أول حدث هو الإصدار", timeline[0].type === "issued" && timeline[0].reference === "INV-9");
assert("يضم حدث الدفعة بمرجعها", timeline.some((event) => event.type === "payment" && event.reference === "RCT-1"));
assert(
  "يضم حدث الإشعار الدائن بحالته",
  timeline.some((event) => event.type === "credit_note" && event.status === "approved"),
);
assert(
  "يضم حدث المرتجع بحالته",
  timeline.some((event) => event.type === "refund" && event.status === "approved"),
);

const cancelledTimeline = buildInvoiceTimeline(
  {
    date: "2026-09-01",
    lifecycleStatus: InvoiceLifecycle.CANCELLED,
    cancelledAt: "2026-09-15",
    cancellationReason: "خطأ إداري",
  },
  {},
);
assert(
  "يضم حدث الإلغاء",
  cancelledTimeline.some((event) => event.type === "cancelled" && event.reference === "خطأ إداري"),
);

const emptyTimeline = buildInvoiceTimeline({}, {});
assert("فاتورة بلا تاريخ ولا حركات: سجل فارغ لا خطأ", Array.isArray(emptyTimeline) && emptyTimeline.length === 0);

/* ==========================================================================
   كشف حساب المريض — عدة فواتير
   ========================================================================== */

section("كشف الحساب — عدة فواتير لنفس المريض");

const invoices = [
  { id: 1, total: 1000, discount: 0, status: "unpaid" },         // مفتوحة
  { id: 2, total: 2000, discount: 200, status: "paid" },         // مسدَّدة
  { id: 3, total: 1500, discount: 0, status: "partially_paid" }, // جزئية + إشعار دائن
  { id: 4, total: 3000, discount: 0, status: "paid" },           // مسدَّدة + مرتجع
  { id: 5, total: 800, discount: 100, status: "cancelled" },     // ملغاة
  { id: 6, total: 5000, lifecycleStatus: InvoiceLifecycle.DRAFT }, // مسودة — لم تُصدَر بعد
];

const accountPayments = [
  { invoiceId: 2, amount: 2000 },
  { invoiceId: 3, amount: 500 },
  { invoiceId: 4, amount: 3000 },
  { invoiceId: 5, amount: 800 }, // دفعة على فاتورة ألغيت لاحقًا
];

const accountRefunds = [
  { invoiceId: 4, amount: 750, status: "approved" },
  { invoiceId: 2, amount: 300, status: "pending" },
];

const accountCreditNotes = [{ invoiceId: 3, amount: 300, status: "approved" }];

const account = summarizePatientAccount({
  invoices,
  payments: accountPayments,
  refunds: accountRefunds,
  creditNotes: accountCreditNotes,
});

const s = account.summary;

assert("عدد الفواتير الفعّالة 4 (تستبعد المسودة والملغاة)", s.invoicesCount === 4, String(s.invoicesCount));
assert("عدد المسودات 1", s.draftCount === 1, String(s.draftCount));
assert("عدد الملغاة 1", s.cancelledCount === 1, String(s.cancelledCount));

assertMoney("إجمالي المفوتر يستبعد المسودة والملغاة", s.totalInvoiced, 7500);
assertMoney("إجمالي الخصم (ما قبل الإصدار)", s.totalDiscount, 200);
assertMoney("إجمالي إشعارات الدائن (ما بعد الإصدار)", s.totalCredited, 300);
assertMoney("صافي المفوتر = المفوتر − الإشعارات", s.totalInvoicedNet, 7200);
assertMoney("إجمالي المدفوع يستبعد دفعات الملغاة", s.totalPaid, 5500);
assertMoney("إجمالي المرتجع المعتمد", s.totalRefunded, 750);
assertMoney("صافي المحصَّل = المدفوع − المرتجع", s.netPaid, 4750);
assertMoney("الرصيد المتبقي = صافي المفوتر − صافي المحصَّل", s.remainingBalance, 2450);

/* الضمانة الأساسية التي كانت مفقودة */
const sumOfRemaining = money.sumBy(account.invoices.filter(isFinalized), "remaining");
assertMoney("الرصيد = مجموع متبقي الفواتير الصادرة (تطابق الشاشتين)", sumOfRemaining, s.remainingBalance);

const byId = new Map(account.invoices.map((invoice) => [invoice.id, invoice]));
assert("الفاتورة 1 unpaid", byId.get(1).status === "unpaid", byId.get(1).status);
assert("الفاتورة 2 paid (مرتجع معلّق)", byId.get(2).status === "paid", byId.get(2).status);
assert("الفاتورة 3 partially_paid رغم الإشعار الدائن", byId.get(3).status === "partially_paid", byId.get(3).status);
assertMoney("effectiveTotal الفاتورة 3 = 1500 − 300", byId.get(3).effectiveTotal, 1200);
assertMoney("متبقي الفاتورة 3 = 1200 − 500", byId.get(3).remaining, 700);
assert("الفاتورة 4 partially_paid بعد المرتجع", byId.get(4).status === "partially_paid", byId.get(4).status);
assert("الفاتورة 5 cancelled", byId.get(5).status === "cancelled", byId.get(5).status);
assert("الفاتورة 6 draft", byId.get(6).status === InvoiceLifecycle.DRAFT, byId.get(6).status);
assertMoney("متبقي الفاتورة 4 = المرتجع", byId.get(4).remaining, 750);
assertMoney("متبقي الملغاة صفر", byId.get(5).remaining, 0);
assertMoney("متبقي المسودة صفر — لا مديونية قبل الإصدار", byId.get(6).remaining, 0);
assert("المسودة والملغاة تظهران في الكشف للشفافية", account.invoices.length === 6);

section("كشف الحساب — حالات حدّية");

const empty = summarizePatientAccount({ invoices: [], payments: [], refunds: [] });
assertMoney("مريض بلا فواتير: رصيد صفر", empty.summary.remainingBalance, 0);
assert("بلا فواتير: العدد صفر", empty.summary.invoicesCount === 0);

const creditAccount = summarizePatientAccount({
  invoices: [{ id: 1, total: 500, status: "paid" }],
  payments: [{ invoiceId: 1, amount: 800 }],
  refunds: [],
});
assertMoney("الدفع الزائد يُنتج رصيدًا سالبًا", creditAccount.summary.remainingBalance, -300);
assertMoney("ويُعرض كرصيد دائن موجب", creditAccount.summary.creditBalance, 300);

const allCancelled = summarizePatientAccount({
  invoices: [{ id: 1, total: 900, status: "cancelled" }],
  payments: [],
  refunds: [],
});
assertMoney("كل الفواتير ملغاة: مفوتر صفر", allCancelled.summary.totalInvoiced, 0);
assertMoney("كل الفواتير ملغاة: رصيد صفر", allCancelled.summary.remainingBalance, 0);

/* ==========================================================================
   مجاميع النظام
   ========================================================================== */

section("مجاميع النظام");

const systemInvoices = [
  { total: 1000, remaining: 400, credited: 0, status: "partially_paid" },
  { total: 2000, remaining: 0, credited: 100, status: "paid" },
  { total: 500, remaining: 500, credited: 0, status: "unpaid" },
  { total: 900, remaining: 0, credited: 0, status: "cancelled" },
  { total: 700, remaining: 0, credited: 0, lifecycleStatus: InvoiceLifecycle.DRAFT },
];

assertMoney("إجمالي المديونية يستبعد المسودة والملغاة", totalOutstanding(systemInvoices), 900);
assertMoney("إجمالي المفوتر يستبعد المسودة والملغاة", totalInvoiced(systemInvoices), 3500);
assertMoney("إجمالي إشعارات الدائن يستبعد المسودة والملغاة", totalCredited(systemInvoices), 100);

assertMoney(
  "المحصَّل = المدفوعات − المرتجعات المعتمدة",
  totalCollected({
    payments: [{ amount: 1000 }, { amount: 500 }],
    refunds: [{ amount: 200, status: "approved" }, { amount: 300, status: "pending" }],
  }),
  1300,
);

section("التأخر عن السداد");

assert("فاتورة متأخرة", isOverdue({ remaining: 100, dueDate: "2026-09-01", status: "unpaid" }, "2026-10-05"));
assert("فاتورة في موعدها", !isOverdue({ remaining: 100, dueDate: "2026-11-01", status: "unpaid" }, "2026-10-05"));
assert("مسدَّدة لا تتأخر", !isOverdue({ remaining: 0, dueDate: "2026-01-01", status: "paid" }, "2026-10-05"));
assert("ملغاة لا تتأخر", !isOverdue({ remaining: 500, dueDate: "2026-01-01", status: "cancelled" }, "2026-10-05"));

section("العزل عن العرض");

/*
 * هذه الاختبارات نفسها هي الدليل: الملف يعمل في Node بلا DOM. لو تسرّب أي
 * اعتماد على المتصفح إلى طبقة الحساب، لفشل الاستيراد من أول سطر.
 */
assert("لا وجود لـ window في بيئة الاختبار", typeof window === "undefined");
assert("لا وجود لـ document", typeof document === "undefined");

report();
