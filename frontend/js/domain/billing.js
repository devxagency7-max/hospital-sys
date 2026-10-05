/**
 * قواعد الحساب المالي — المصدر الوحيد للحقيقة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  دوال خالصة (pure): تأخذ بيانات وتُعيد أرقامًا. لا DOM، ولا طلبات شبكة،
 *  ولا استيراد من js/mock. تعمل في المتصفح وفي Node وفي الاختبارات بالتساوي.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * لماذا وُجد هذا الملف:
 * كان حساب رصيد المريض مكتوبًا داخل `js/api/mock-adapter.js`، بينما حساب حالة
 * الفاتورة مكتوب في `js/mock/invoices.mock.js`. تعريفان منفصلان لنفس المفهوم،
 * فانحرفا: جدول الفواتير أظهر فاتورة «مدفوعة» برصيد صفر، وكشف الحساب أظهر على
 * نفس المريض مديونية 9,124 ج.م — لأن `remaining` لم يكن يعرف شيئًا عن المرتجعات.
 * شاشتان، رقمان مختلفان، نفس المريض.
 *
 * الجذر لم يكن رقمًا خاطئًا بل غياب تعريف واحد. الآن كل حساب مالي يمر من هنا:
 * طبقة البيانات التجريبية تستخدمه لتوليد بيانات متسقة، والشاشات تعرض نتائجه
 * ولا تحسب شيئًا. وهو أيضًا المواصفة التي يجب أن يطابقها الباك-إند في Phase 7.
 */

import * as money from "../core/money.js";

/* ==========================================================================
   نموذج المرتجع
   ==========================================================================

   المرتجع المعتمد **يعكس دفعة**: المستشفى أعاد مالًا للمريض.

     صافي المدفوع = المدفوع − المرتجع المعتمد
     المتبقي      = الإجمالي − صافي المدفوع

   مثال: فاتورة 36,496 دُفعت كاملة ثم اعتُمد مرتجع 9,124
         → صافي المدفوع 27,372، والمتبقي 9,124.

   الفاتورة تبقى بإجماليها للتدقيق — لا يُعدَّل الإجمالي ولا تُحذف البنود،
   التزامًا بقاعدة «ممنوع حذف تاريخ المعاملات المالية من الواجهة».

   ملاحظة نطاق: لو كانت الخدمة لم تُقدَّم أصلًا فالتصحيح المحاسبي الصحيح هو
   إشعار دائن (credit note) يُخفّض الإجمالي، لا مرتجع. إشعارات الدائن غير
   موجودة في المرحلة 0 — راجع «قرارات مطلوبة» في تقرير التثبيت.
   ========================================================================== */

/** المرتجعات المعلّقة أو المرفوضة لا تؤثر على أي رصيد. */
const isEffectiveRefund = (refund) => refund?.status === "approved";

/** الفاتورة الملغاة لا تدخل أي مجموع مالي. */
export const isCancelled = (invoice) => invoice?.status === "cancelled";

/* ==========================================================================
   1) إجماليات الفاتورة من بنودها
   ========================================================================== */

/**
 * يحسب إجماليات فاتورة من بنودها.
 *
 * @param {object} options
 * @param {Array<{quantity:number, unitPrice:number}>} options.lines
 * @param {number} [options.discount]      خصم بمبلغ مقطوع
 * @param {number} [options.discountRate]  أو خصم بنسبة (كسر: 0.1 = 10%)
 * @param {number} [options.taxRate]       نسبة الضريبة على الصافي بعد الخصم
 * @returns {{ subtotal:number, discount:number, tax:number, total:number }}
 */
export function calculateInvoiceTotals({
  lines = [],
  discount,
  discountRate,
  taxRate = 0,
} = {}) {
  const lineTotals = lines.map((line) => money.multiply(line.unitPrice, line.quantity ?? 1));
  const subtotal = money.sum(lineTotals);

  // الخصم بمبلغ مقطوع له الأولوية لو مُرّر الاثنان؛ وفي كل الأحوال لا يتجاوز
  // الإجمالي قبل الخصم، وإلا صار إجمالي الفاتورة سالبًا.
  const requested =
    discount !== undefined && discount !== null
      ? money.round(discount)
      : money.percentOf(subtotal, discountRate ?? 0);

  const appliedDiscount = money.min(money.max(requested, 0), subtotal);

  const net = money.subtract(subtotal, appliedDiscount);
  const tax = money.percentOf(net, taxRate);

  return {
    subtotal,
    discount: appliedDiscount,
    tax,
    total: money.add(net, tax),
  };
}

/** مجموع بنود فاتورة — للتحقق من تطابقها مع `subtotal`. */
export function sumLines(lines = []) {
  return money.sum(lines.map((line) => line.lineTotal ?? money.multiply(line.unitPrice, line.quantity ?? 1)));
}

/* ==========================================================================
   2) تسوية الفاتورة: المدفوع والمرتجع والمتبقي والحالة
   ========================================================================== */

/**
 * يحسب حالة السداد لفاتورة واحدة.
 *
 * هذه هي الدالة التي كان غيابها سبب التناقض بين الشاشات: `paid` و `remaining`
 * و `status` تُشتق كلها هنا من نفس المدخلات، فيستحيل أن تتناقض.
 *
 * @param {object} invoice   يحتاج `total` و `status` فقط
 * @param {object} options
 * @param {Array<{amount:number}>} [options.payments]
 * @param {Array<{amount:number,status:string}>} [options.refunds]
 * @returns {{
 *   total:number, paid:number, refunded:number, netPaid:number,
 *   remaining:number, status:string, isSettled:boolean
 * }}
 */
export function settleInvoice(invoice, { payments = [], refunds = [] } = {}) {
  const total = money.round(invoice?.total ?? 0);

  /*
   * الفاتورة الملغاة: لا مدفوع ولا متبقٍ. تحتفظ بإجماليها وبنودها للتدقيق،
   * لكنها لا تُنشئ ولا تُلغي مديونية. أي مجموع يجب أن يستبعدها.
   */
  if (isCancelled(invoice)) {
    return {
      total,
      paid: 0,
      refunded: 0,
      netPaid: 0,
      remaining: 0,
      status: "cancelled",
      isSettled: true,
    };
  }

  const paid = money.sumBy(payments, "amount");
  const refunded = money.sumBy(refunds.filter(isEffectiveRefund), "amount");

  const netPaid = money.subtract(paid, refunded);
  const remaining = money.subtract(total, netPaid);

  return {
    total,
    paid,
    refunded,
    netPaid,
    remaining,
    status: deriveInvoiceStatus({ total, netPaid, remaining }),
    isSettled: money.isZero(remaining),
  };
}

/**
 * يشتق حالة الفاتورة من أرقامها.
 *
 * التعريف الوحيد للحالة في النظام. لا تكتب `status: "paid"` يدويًا في أي مكان.
 */
export function deriveInvoiceStatus({ total, netPaid, remaining }) {
  const left = remaining ?? money.subtract(total, netPaid);

  // دفع زائد (صافي المدفوع أكبر من الإجمالي) — رصيد لصالح المريض.
  if (money.isNegative(left)) return "overpaid";
  if (money.isZero(left)) return "paid";
  if (money.isPositive(netPaid)) return "partially_paid";
  return "unpaid";
}

/** هل الفاتورة متأخرة؟ تحتاج تاريخ استحقاق ومتبقيًا موجبًا. */
export function isOverdue(invoice, asOfDate) {
  if (isCancelled(invoice)) return false;
  if (!money.isPositive(invoice?.remaining)) return false;
  if (!invoice?.dueDate) return false;

  const asOf = (asOfDate instanceof Date ? asOfDate.toISOString() : String(asOfDate ?? "")).slice(0, 10);
  return String(invoice.dueDate).slice(0, 10) < asOf;
}

/* ==========================================================================
   3) كشف حساب المريض
   ========================================================================== */

/**
 * يبني ملخص حساب مريض من فواتيره ومدفوعاته ومرتجعاته.
 *
 * ضمانة التماسك التي كانت مفقودة:
 *     remainingBalance === مجموع remaining للفواتير غير الملغاة
 * الرقم في كشف الحساب والرقم في جدول الفواتير يخرجان من نفس الحساب.
 *
 * @param {object} options
 * @param {object[]} options.invoices
 * @param {object[]} [options.payments]  لكل الفواتير، تُوزَّع هنا حسب invoiceId
 * @param {object[]} [options.refunds]
 * @returns {{ invoices:object[], summary:object }}
 */
export function summarizePatientAccount({ invoices = [], payments = [], refunds = [] } = {}) {
  const paymentsByInvoice = groupBy(payments, "invoiceId");
  const refundsByInvoice = groupBy(refunds, "invoiceId");

  /* --- تسوية كل فاتورة على حدة --- */
  const settled = invoices.map((invoice) => {
    const settlement = settleInvoice(invoice, {
      payments: paymentsByInvoice.get(invoice.id) ?? [],
      refunds: refundsByInvoice.get(invoice.id) ?? [],
    });

    return { ...invoice, ...settlement };
  });

  /*
   * الفواتير الملغاة تُعرض في الكشف للشفافية لكنها لا تدخل أي مجموع — وإلا
   * ظهرت على المريض مديونية لفاتورة أُلغيت أصلًا. ومعها تُستبعد مدفوعاتها
   * ومرتجعاتها، فمبلغ دُفع على فاتورة ألغيت لاحقًا لا يُخصم من مديونية أخرى.
   */
  const effective = settled.filter((invoice) => !isCancelled(invoice));

  const totalInvoiced = money.sumBy(effective, "total");
  const totalDiscount = money.sumBy(effective, "discount");
  const totalPaid = money.sumBy(effective, "paid");
  const totalRefunded = money.sumBy(effective, "refunded");
  const remainingBalance = money.sumBy(effective, "remaining");

  return {
    invoices: settled,
    summary: {
      invoicesCount: effective.length,
      cancelledCount: settled.length - effective.length,

      totalInvoiced,
      totalDiscount,
      totalPaid,
      totalRefunded,
      netPaid: money.subtract(totalPaid, totalRefunded),

      /** موجب = على المريض، سالب = له (دفع زائد). */
      remainingBalance,
      creditBalance: money.isNegative(remainingBalance)
        ? money.multiply(remainingBalance, -1)
        : 0,
    },
  };
}

/* ==========================================================================
   4) مجاميع على مستوى النظام
   ========================================================================== */

/**
 * إجمالي المديونية على مجموعة فواتير.
 * يستبعد الملغاة دائمًا — وهو الخطأ الذي تكرر في أكثر من موضع قبل توحيده هنا.
 */
export function totalOutstanding(invoices = []) {
  return money.sumBy(invoices.filter((invoice) => !isCancelled(invoice)), "remaining");
}

/** إجمالي ما فُوتر خلال فترة. */
export function totalInvoiced(invoices = []) {
  return money.sumBy(invoices.filter((invoice) => !isCancelled(invoice)), "total");
}

/** إجمالي ما حُصِّل فعلًا (المدفوعات ناقص المرتجعات المعتمدة). */
export function totalCollected({ payments = [], refunds = [] } = {}) {
  return money.subtract(
    money.sumBy(payments, "amount"),
    money.sumBy(refunds.filter(isEffectiveRefund), "amount"),
  );
}

/** قيمة المخزون = الكمية × سعر التكلفة لكل صنف. */
export function inventoryValuation(items = []) {
  return money.sum(items.map((item) => money.multiply(item.costPrice, item.quantity ?? 0)));
}

/* -------------------------------------------------------------------------- */

function groupBy(rows, key) {
  const map = new Map();

  for (const row of rows) {
    const id = row?.[key];
    if (id === undefined || id === null) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }

  return map;
}
