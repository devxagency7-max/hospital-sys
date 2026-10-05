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
  calculateInvoiceTotals,
  settleInvoice,
  deriveInvoiceStatus,
  summarizePatientAccount,
  totalOutstanding,
  totalInvoiced,
  totalCollected,
  isOverdue,
} from "../js/domain/billing.js";

import { assert, assertMoney, section, report } from "./harness.mjs";

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

section("التسوية — الدفع الزائد");

const over = settleInvoice({ total: 1000 }, { payments: [{ amount: 1200 }] });
assertMoney("المتبقي سالب", over.remaining, -200);
assert("الحالة overpaid", over.status === "overpaid", over.status);

section("التسوية — الفاتورة الملغاة");

const cancelled = settleInvoice(
  { total: 5000, status: "cancelled" },
  { payments: [{ amount: 2000 }], refunds: [{ amount: 500, status: "approved" }] },
);
assertMoney("الإجمالي يبقى للتدقيق", cancelled.total, 5000);
assertMoney("المدفوع صفر", cancelled.paid, 0);
assertMoney("المتبقي صفر", cancelled.remaining, 0);
assert("الحالة cancelled", cancelled.status === "cancelled", cancelled.status);

section("اشتقاق الحالة");

assert("صفر متبقٍ → paid", deriveInvoiceStatus({ total: 100, netPaid: 100, remaining: 0 }) === "paid");
assert("لا مدفوع → unpaid", deriveInvoiceStatus({ total: 100, netPaid: 0, remaining: 100 }) === "unpaid");
assert("مدفوع جزئي → partially_paid", deriveInvoiceStatus({ total: 100, netPaid: 40, remaining: 60 }) === "partially_paid");
assert("متبقٍ سالب → overpaid", deriveInvoiceStatus({ total: 100, netPaid: 120, remaining: -20 }) === "overpaid");

/* ==========================================================================
   كشف حساب المريض — عدة فواتير
   ========================================================================== */

section("كشف الحساب — عدة فواتير لنفس المريض");

const invoices = [
  { id: 1, total: 1000, discount: 0, status: "unpaid" },        // مفتوحة
  { id: 2, total: 2000, discount: 200, status: "paid" },        // مسدَّدة
  { id: 3, total: 1500, discount: 0, status: "partially_paid" },// جزئية
  { id: 4, total: 3000, discount: 0, status: "paid" },          // مسدَّدة + مرتجع
  { id: 5, total: 800, discount: 100, status: "cancelled" },    // ملغاة
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

const account = summarizePatientAccount({
  invoices,
  payments: accountPayments,
  refunds: accountRefunds,
});

const s = account.summary;

assert("عدد الفواتير الفعّالة 4", s.invoicesCount === 4, String(s.invoicesCount));
assert("عدد الملغاة 1", s.cancelledCount === 1, String(s.cancelledCount));

assertMoney("إجمالي المفوتر يستبعد الملغاة", s.totalInvoiced, 7500);
assertMoney("إجمالي الخصم يستبعد الملغاة", s.totalDiscount, 200);
assertMoney("إجمالي المدفوع يستبعد دفعات الملغاة", s.totalPaid, 5500);
assertMoney("إجمالي المرتجع المعتمد", s.totalRefunded, 750);
assertMoney("صافي المدفوع", s.netPaid, 4750);
assertMoney("الرصيد المتبقي", s.remainingBalance, 2750);

/* الضمانة الأساسية التي كانت مفقودة */
const sumOfRemaining = money.sumBy(
  account.invoices.filter((invoice) => invoice.status !== "cancelled"),
  "remaining",
);
assertMoney("الرصيد = مجموع متبقي الفواتير (تطابق الشاشتين)", sumOfRemaining, s.remainingBalance);

const byId = new Map(account.invoices.map((invoice) => [invoice.id, invoice]));
assert("الفاتورة 1 unpaid", byId.get(1).status === "unpaid", byId.get(1).status);
assert("الفاتورة 2 paid (مرتجع معلّق)", byId.get(2).status === "paid", byId.get(2).status);
assert("الفاتورة 3 partially_paid", byId.get(3).status === "partially_paid", byId.get(3).status);
assert("الفاتورة 4 partially_paid بعد المرتجع", byId.get(4).status === "partially_paid", byId.get(4).status);
assert("الفاتورة 5 cancelled", byId.get(5).status === "cancelled", byId.get(5).status);
assertMoney("متبقي الفاتورة 4 = المرتجع", byId.get(4).remaining, 750);
assertMoney("متبقي الملغاة صفر", byId.get(5).remaining, 0);
assert("الملغاة تظهر في الكشف للشفافية", account.invoices.length === 5);

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
  { total: 1000, remaining: 400, status: "partially_paid" },
  { total: 2000, remaining: 0, status: "paid" },
  { total: 500, remaining: 500, status: "unpaid" },
  { total: 900, remaining: 0, status: "cancelled" },
];

assertMoney("إجمالي المديونية يستبعد الملغاة", totalOutstanding(systemInvoices), 900);
assertMoney("إجمالي المفوتر يستبعد الملغاة", totalInvoiced(systemInvoices), 3500);

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
