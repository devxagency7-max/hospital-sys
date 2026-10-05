/**
 * قواعد الحساب المالي — المصدر الوحيد للحقيقة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  دوال خالصة (pure): تأخذ بيانات وتُعيد أرقامًا. لا DOM، ولا طلبات شبكة،
 *  ولا استيراد من js/mock. تعمل في المتصفح وفي Node وفي الاختبارات بالتساوي.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الشرح الكامل للنموذج — التعريفات والعلاقات والأمثلة الرقمية — في
 * docs/12-BILLING-DOMAIN-MODEL.md. هذا الملف هو التنفيذ؛ ذاك المرجع هو القرار.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  محوران مستقلان لكل فاتورة، لا محور واحد:
 *
 *   محور الدورة (lifecycle)   draft → issued → cancelled
 *                              هل الفاتورة قابلة للتعديل؟
 *
 *   محور التسوية (settlement) unpaid → partially_paid → paid → overpaid
 *                              كم المتبقي على المريض؟ يُشتق من الأرقام فقط،
 *                              ولا يُكتب يدويًا أبدًا.
 *
 *  وعلى محور التسوية نفسه، تعديلان مستقلان لا يُخلطان:
 *
 *   إشعار دائن (CreditNote)  يُخفّض effectiveTotal — جانب «كم يُستحق».
 *                             تصحيح لقيمة الفاتورة نفسها بعد إصدارها.
 *
 *   مرتجع (Refund)           يُخفّض netPaid — جانب «كم حُصِّل فعلًا».
 *                             مال عاد للمريض؛ قيمة الفاتورة لم تتغيّر.
 *
 *  الصيغة التي تجمعهما:
 *
 *     effectiveTotal = total − Σ(إشعارات دائن معتمدة)
 *     netPaid        = Σ(دفعات) − Σ(مرتجعات معتمدة)
 *     remaining      = effectiveTotal − netPaid
 *
 *  هذا الملف كان قبل هذا التحديث يخلط المفهومين تحت اسم «مرتجع» واحد: فاتورة
 *  مُسدَّدة بالكامل اعتُمد عليها ما كان يُفترض أن يكون إشعار دائن، فتحوّلت في
 *  جدول الفواتير إلى «مدفوعة» برصيد صفر بينما طالب كشف الحساب المريض بالمبلغ
 *  نفسه. الإصلاح الأول وحّد الحساب؛ هذا التحديث يفصل المفهومين بنيويًا بحيث
 *  يستحيل خلطهما مرة أخرى — كل مفهوم كيان مستقل بحقوله وحالته ومساره.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";

/* ==========================================================================
   المفردات
   ========================================================================== */

/** دورة حياة الفاتورة كمستند. لا علاقة لها بحالة السداد. */
export const InvoiceLifecycle = Object.freeze({
  /** قابلة للتعديل الكامل — بنود وخصم وضريبة. لا تلتزم المريض بشيء بعد. */
  DRAFT: "draft",
  /** مستند مالي نهائي. `total` و `discount` و `tax` مجمَّدة إلى الأبد. */
  ISSUED: "issued",
  /** مُلغاة. تبقى للتدقيق، صفر في كل مجموع. لا رجوع عن الإلغاء. */
  CANCELLED: "cancelled",
});

/**
 * حالة مستند الرد (مرتجع أو إشعار دائن) — نفس المسار لكليهما.
 * الانتقال وحيد الاتجاه: pending → approved أو pending → rejected، مرة واحدة.
 * لا تعديل على المبلغ أو السبب أو الفاتورة المستهدفة بعد الإنشاء.
 */
export const DocumentStatus = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

/** فقط المستندات المعتمدة تؤثر على أي رصيد. */
const isApprovedDocument = (doc) => doc?.status === DocumentStatus.APPROVED;

/** يقرأ دورة حياة الفاتورة، بتوافق رجعي مع بيانات لا تحمل `lifecycleStatus`. */
function resolveLifecycle(invoice) {
  if (invoice?.lifecycleStatus) return invoice.lifecycleStatus;
  if (invoice?.status === InvoiceLifecycle.CANCELLED) return InvoiceLifecycle.CANCELLED;
  if (invoice?.status === InvoiceLifecycle.DRAFT) return InvoiceLifecycle.DRAFT;
  return InvoiceLifecycle.ISSUED;
}

export const isDraft = (invoice) => resolveLifecycle(invoice) === InvoiceLifecycle.DRAFT;
export const isCancelled = (invoice) => resolveLifecycle(invoice) === InvoiceLifecycle.CANCELLED;
export const isIssued = (invoice) => resolveLifecycle(invoice) === InvoiceLifecycle.ISSUED;

/** مستند مالي حقيقي يدخل الحسابات — ليس مسودة ولم يُلغَ. */
export const isFinalized = isIssued;

/* ==========================================================================
   1) نشأة الفاتورة — من بنودها إلى إجمالي، وهي لا تزال مسودة
   ========================================================================== */

/**
 * يحسب إجماليات فاتورة من بنودها.
 *
 * ينطبق فقط قبل الإصدار: الخصم والضريبة يُقرَّران أثناء بناء الفاتورة، ويُجمَّدان
 * داخل `total` لحظة `issueInvoice()`. أي تصحيح بعد ذلك يمر عبر إشعار دائن،
 * لا عبر إعادة حساب هذه الدالة على فاتورة صادرة.
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
   2) انتقالات دورة الحياة
   ========================================================================== */

/**
 * يتحقق أن الفاتورة لا تزال مسودة قبل أي تعديل على بنودها أو إجمالياتها.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذه هي البوابة الوحيدة لقاعدة «ممنوع تعديل فاتورة صادرة بصمت». أي دالة
 *  كتابة على بنود/خصم/ضريبة فاتورة — حاليًا أو في Phase 1 — تستدعيها أولاً.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function assertMutable(invoice) {
  if (!isDraft(invoice)) {
    throw ruleViolation(
      `لا يمكن تعديل الفاتورة ${invoice?.invoiceNumber ?? invoice?.id ?? ""} بعد إصدارها. ` +
        "الفاتورة الصادرة سجل مالي ثابت؛ أي تصحيح لقيمتها يتم عبر إشعار دائن.",
    );
  }
}

/**
 * يصدر فاتورة — مسودة → نهائية. بعدها `total` و `discount` و `tax` مجمَّدة.
 * دالة خالصة: تُعيد كائنًا جديدًا، لا تُعدِّل المُدخَل.
 *
 * لا تضبط `status` هنا: `lifecycleStatus` الجديدة هي المرجع الذي يقرأه
 * `resolveLifecycle`، و `status` المعروض سيُعاد اشتقاقه عند أول `settleInvoice`
 * تالية — وهي الخطوة الطبيعية التالية لأي فاتورة فور إصدارها.
 */
export function issueInvoice(invoice, { issuedAt = new Date().toISOString() } = {}) {
  assertMutable(invoice);
  return { ...invoice, lifecycleStatus: InvoiceLifecycle.ISSUED, issuedAt };
}

/**
 * يُلغي فاتورة. لا رجوع عن الإلغاء — فاتورة ملغاة بالخطأ تُصحَّح بفاتورة جديدة،
 * لا بإعادة تفعيل القديمة؛ وإلا فقد سجل الإلغاء نفسه قيمته كدليل تدقيق.
 *
 * السبب إلزامي: الإلغاء يمحو مديونية كانت قائمة، فيحتاج تبريرًا يُراجَع لاحقًا.
 */
export function cancelInvoice(invoice, { reason, cancelledAt = new Date().toISOString(), cancelledBy } = {}) {
  if (isCancelled(invoice)) {
    throw ruleViolation(`الفاتورة ${invoice?.invoiceNumber ?? invoice?.id ?? ""} ملغاة بالفعل.`);
  }
  if (!String(reason ?? "").trim()) {
    throw ruleViolation("إلغاء الفاتورة يتطلب سببًا — للتدقيق.", { field: "reason" });
  }

  return {
    ...invoice,
    lifecycleStatus: InvoiceLifecycle.CANCELLED,
    status: InvoiceLifecycle.CANCELLED,
    cancelledAt,
    cancelledBy,
    cancellationReason: reason,
  };
}

/**
 * يتحقق أن مستند ردّ (مرتجع أو إشعار دائن) لا يزال قابلًا للتعديل.
 * `label` عربي يُستخدم في رسالة الخطأ: "مرتجع" أو "إشعار دائن".
 */
export function assertDocumentMutable(doc, label = "المستند") {
  if (doc?.status !== DocumentStatus.PENDING) {
    throw ruleViolation(`لا يمكن تعديل ${label} بعد مراجعته (الحالة الحالية: ${doc?.status}).`);
  }
}

/* ==========================================================================
   3) الحدود — كم يمكن ردّه أو تصحيحه؟
   ========================================================================== */

/**
 * أقصى مبلغ قابل للرد نقدًا على فاتورة. صفر لو لم تكن الفاتورة صادرة —
 * لا معنى لردّ مال عن فاتورة لم يُدفع عليها شيء بعد أو أُلغيت بالكامل.
 */
export function maxRefundable(invoice, { payments = [], refunds = [] } = {}) {
  if (!isIssued(invoice)) return 0;

  const paid = money.sumBy(payments, "amount");
  const alreadyRefunded = money.sumBy(refunds.filter(isApprovedDocument), "amount");
  return money.max(money.subtract(paid, alreadyRefunded), 0);
}

/**
 * أقصى مبلغ قابل للتصحيح عبر إشعار دائن. لا يمكن أن يتجاوز مجموع
 * الإشعارات المعتمدة إجمالي الفاتورة الأصلي — وإلا أصبحت قيمتها سالبة.
 */
export function maxCreditable(invoice, { creditNotes = [] } = {}) {
  if (!isIssued(invoice)) return 0;

  const total = money.round(invoice?.total ?? 0);
  const alreadyCredited = money.sumBy(creditNotes.filter(isApprovedDocument), "amount");
  return money.max(money.subtract(total, alreadyCredited), 0);
}

/* ==========================================================================
   4) تسوية الفاتورة: effectiveTotal و netPaid والمتبقي والحالة
   ========================================================================== */

/**
 * يحسب حالة فاتورة واحدة بالكامل.
 *
 * التعريف الوحيد في النظام لهذه الحسابات. `effectiveTotal` و `netPaid` و
 * `remaining` و `status` تُشتق كلها هنا من نفس المدخلات، فيستحيل أن تتناقض
 * بين شاشة وأخرى.
 *
 * @param {object} invoice  يحتاج `total`، و `lifecycleStatus` أو `status`
 * @param {object} options
 * @param {Array<{amount:number}>} [options.payments]
 * @param {Array<{amount:number,status:string}>} [options.refunds]
 * @param {Array<{amount:number,status:string}>} [options.creditNotes]
 * @returns {{
 *   total:number, effectiveTotal:number,
 *   paid:number, refunded:number, netPaid:number,
 *   credited:number,
 *   remaining:number, status:string, lifecycleStatus:string, isSettled:boolean
 * }}
 */
export function settleInvoice(invoice, { payments = [], refunds = [], creditNotes = [] } = {}) {
  const total = money.round(invoice?.total ?? 0);
  const lifecycleStatus = resolveLifecycle(invoice);

  /*
   * الفاتورة الملغاة: صفر في كل شيء. تحتفظ بـ `total` للتدقيق فقط — لا تدخل
   * أي مجموع، ولا تملك مدفوعًا ولا مرتجعًا ولا إشعارًا فعّالًا من منظور الحساب.
   */
  if (lifecycleStatus === InvoiceLifecycle.CANCELLED) {
    return {
      total,
      effectiveTotal: total,
      paid: 0,
      refunded: 0,
      netPaid: 0,
      credited: 0,
      remaining: 0,
      status: InvoiceLifecycle.CANCELLED,
      lifecycleStatus,
      isSettled: true,
    };
  }

  /*
   * المسودة ليست التزامًا ماليًا بعد — لا مديونية حتى تُصدَر. نفس شكل الحقول
   * في كل الحالات حتى لا تحتاج الواجهة فحص أي فرع أنتج الكائن.
   */
  if (lifecycleStatus === InvoiceLifecycle.DRAFT) {
    return {
      total,
      effectiveTotal: total,
      paid: 0,
      refunded: 0,
      netPaid: 0,
      credited: 0,
      remaining: 0,
      status: InvoiceLifecycle.DRAFT,
      lifecycleStatus,
      isSettled: false,
    };
  }

  /* --- فاتورة صادرة: المعادلتان المستقلتان --- */
  const paid = money.sumBy(payments, "amount");
  const refunded = money.sumBy(refunds.filter(isApprovedDocument), "amount");
  const credited = money.sumBy(creditNotes.filter(isApprovedDocument), "amount");

  // لا يمكن أن يقل الإجمالي الفعلي عن صفر مهما بلغت الإشعارات.
  const effectiveTotal = money.max(money.subtract(total, credited), 0);
  const netPaid = money.subtract(paid, refunded);
  const remaining = money.subtract(effectiveTotal, netPaid);

  return {
    total,
    effectiveTotal,
    paid,
    refunded,
    netPaid,
    credited,
    remaining,
    status: deriveInvoiceStatus({ netPaid, remaining }),
    lifecycleStatus,
    isSettled: money.isZero(remaining),
  };
}

/**
 * يشتق حالة التسوية من صافي المدفوع والمتبقي.
 * لا تكتب `status: "paid"` يدويًا في أي مكان — هذه هي الدالة الوحيدة.
 */
export function deriveInvoiceStatus({ netPaid, remaining }) {
  // دفع زائد: effectiveTotal أقل مما حُصِّل فعلًا — عادة بسبب إشعار دائن صدر
  // بعد تحصيل كامل القيمة. رصيد لصالح المريض، لا تلقائيًا مرتجع.
  if (money.isNegative(remaining)) return "overpaid";
  if (money.isZero(remaining)) return "paid";
  if (money.isPositive(netPaid)) return "partially_paid";
  return "unpaid";
}

/**
 * هل الفاتورة متأخرة؟ المسودة والملغاة والمسوَّاة لا تتأخر أبدًا.
 *
 * فحص `isCancelled` صريح هنا رغم أن `settleInvoice` يضمن `remaining=0` للملغاة
 * أصلًا: هذه دالة عامة قد تُستدعى على كائن مُجمَّع يدويًا لا عبر `settleInvoice`
 * (مثل بيانات اختبار أو شاشة لم تُعِد التسوية بعد تغيير الحالة) — والاعتماد
 * على تزامن حقلين دون فرضه هو بالضبط ما سبّب الباگ الأصلي.
 */
export function isOverdue(invoice, asOfDate) {
  if (isCancelled(invoice)) return false;
  if (!money.isPositive(invoice?.remaining)) return false;
  if (!invoice?.dueDate) return false;

  const asOf = (asOfDate instanceof Date ? asOfDate.toISOString() : String(asOfDate ?? "")).slice(0, 10);
  return String(invoice.dueDate).slice(0, 10) < asOf;
}

/* ==========================================================================
   5) كشف حساب المريض
   ========================================================================== */

/**
 * يبني ملخص حساب مريض من فواتيره ومدفوعاته ومرتجعاته وإشعاراته الدائنة.
 *
 * ضمانة التماسك: `remainingBalance === مجموع remaining لفواتيره الصادرة`.
 * رقم كشف الحساب ورقم جدول الفواتير يخرجان من نفس الحساب دائمًا.
 *
 * @param {object} options
 * @param {object[]} options.invoices
 * @param {object[]} [options.payments]     لكل الفواتير، تُوزَّع هنا حسب invoiceId
 * @param {object[]} [options.refunds]
 * @param {object[]} [options.creditNotes]
 * @returns {{ invoices:object[], summary:object }}
 */
export function summarizePatientAccount({ invoices = [], payments = [], refunds = [], creditNotes = [] } = {}) {
  const paymentsByInvoice = groupBy(payments, "invoiceId");
  const refundsByInvoice = groupBy(refunds, "invoiceId");
  const creditNotesByInvoice = groupBy(creditNotes, "invoiceId");

  const settled = invoices.map((invoice) => ({
    ...invoice,
    ...settleInvoice(invoice, {
      payments: paymentsByInvoice.get(invoice.id) ?? [],
      refunds: refundsByInvoice.get(invoice.id) ?? [],
      creditNotes: creditNotesByInvoice.get(invoice.id) ?? [],
    }),
  }));

  /*
   * المسوّدات والملغاة تُعرض في الكشف للشفافية، لكنهما لا تدخلان أي مجموع —
   * المسوّدة لأنها ليست التزامًا بعد، والملغاة لأن إلغاءها محا الالتزام.
   */
  const effective = settled.filter(isFinalized);

  const totalInvoiced = money.sumBy(effective, "total");
  const totalDiscount = money.sumBy(effective, "discount");
  const totalCredited = money.sumBy(effective, "credited");
  const totalInvoicedNet = money.subtract(totalInvoiced, totalCredited);

  const totalPaid = money.sumBy(effective, "paid");
  const totalRefunded = money.sumBy(effective, "refunded");
  const netPaid = money.subtract(totalPaid, totalRefunded);

  const remainingBalance = money.sumBy(effective, "remaining");

  return {
    invoices: settled,
    summary: {
      invoicesCount: effective.length,
      draftCount: settled.filter(isDraft).length,
      cancelledCount: settled.filter(isCancelled).length,

      /** إجمالي ما فُوتر قبل أي تصحيح — القيمة الأصلية المُصدَرة. */
      totalInvoiced,
      totalDiscount,
      /** إجمالي التصحيحات على قيمة الفواتير بعد إصدارها (جانب الفاتورة). */
      totalCredited,
      /** ما يُستحق فعلًا على المريض بعد التصحيحات. */
      totalInvoicedNet,

      /** إجمالي ما حُصِّل قبل أي ردّ. */
      totalPaid,
      /** إجمالي ما أُعيد نقدًا (جانب التحصيل). */
      totalRefunded,
      /** ما حُصِّل فعلًا بعد المرتجعات. */
      netPaid,

      /** موجب = على المريض، سالب = له (دفع زائد). totalInvoicedNet − netPaid. */
      remainingBalance,
      creditBalance: money.isNegative(remainingBalance)
        ? money.multiply(remainingBalance, -1)
        : 0,
    },
  };
}

/* ==========================================================================
   6) السجل الزمني للفاتورة — للتدقيق
   ========================================================================== */

/**
 * يبني السجل الزمني لفاتورة من مصادره الأولية. **عرض مُشتَق، لا سجل مُخزَّن.**
 *
 * الضمانة الحقيقية لقابلية التدقيق ليست في هذه الدالة بل في ثبات مدخلاتها:
 * دفعة أو مرتجع أو إشعار دائن لا يُعدَّل بعد إنشائه (`assertDocumentMutable`
 * تحرس ذلك)، فإعادة بناء هذا السجل من نفس المصادر يُعيد نفس النتيجة دائمًا.
 * لا حاجة لجدول «أحداث» منفصل يحتاج هو نفسه حراسة من التعديل.
 *
 * @returns {Array<{type:string, date:string, label:string, amount?:number, reference?:string, status?:string}>}
 */
export function buildInvoiceTimeline(invoice, { payments = [], refunds = [], creditNotes = [] } = {}) {
  const events = [];

  const issuedAt = invoice?.issuedAt ?? invoice?.date;
  if (issuedAt) {
    events.push({
      type: "issued",
      date: issuedAt,
      label: "إصدار الفاتورة",
      amount: money.round(invoice?.total ?? 0),
      reference: invoice?.invoiceNumber,
    });
  }

  for (const payment of payments) {
    events.push({
      type: "payment",
      date: payment.date,
      label: "دفعة مسجَّلة",
      amount: payment.amount,
      reference: payment.reference,
    });
  }

  for (const refund of refunds) {
    events.push({
      type: "refund",
      date: refund.date,
      label: "مرتجع",
      amount: refund.amount,
      reference: refund.refundNumber,
      status: refund.status,
    });
  }

  for (const creditNote of creditNotes) {
    events.push({
      type: "credit_note",
      date: creditNote.date,
      label: "إشعار دائن",
      amount: creditNote.amount,
      reference: creditNote.creditNoteNumber,
      status: creditNote.status,
    });
  }

  if (isCancelled(invoice) && invoice?.cancelledAt) {
    events.push({
      type: "cancelled",
      date: invoice.cancelledAt,
      label: "إلغاء الفاتورة",
      reference: invoice?.cancellationReason,
    });
  }

  return events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/* ==========================================================================
   7) مجاميع على مستوى النظام
   ========================================================================== */

/** إجمالي المديونية على مجموعة فواتير — الصادرة فقط. */
export function totalOutstanding(invoices = []) {
  return money.sumBy(invoices.filter(isFinalized), "remaining");
}

/** إجمالي ما فُوتر (القيمة الأصلية، قبل إشعارات الدائن) — الصادرة فقط. */
export function totalInvoiced(invoices = []) {
  return money.sumBy(invoices.filter(isFinalized), "total");
}

/** إجمالي التصحيحات على قيمة الفواتير عبر إشعارات دائن معتمدة. */
export function totalCredited(invoices = []) {
  return money.sumBy(invoices.filter(isFinalized), "credited");
}

/** إجمالي ما حُصِّل فعلًا (المدفوعات ناقص المرتجعات المعتمدة). */
export function totalCollected({ payments = [], refunds = [] } = {}) {
  return money.subtract(
    money.sumBy(payments, "amount"),
    money.sumBy(refunds.filter(isApprovedDocument), "amount"),
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
