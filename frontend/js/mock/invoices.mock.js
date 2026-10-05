/**
 * فواتير ومدفوعات ومرتجعات وإشعارات دائنة تجريبية.
 *
 * البيانات متماسكة **بالبناء لا بالصدفة**: كل إجمالي وحالة سداد يُشتق باستدعاء
 * `js/domain/billing.js` — نفس الوحدة التي تستخدمها طبقة الـ API والاختبارات.
 *
 * قبل الإصلاح الأول، كانت الحالة تُكتب هنا يدويًا والرصيد يُحسب في
 * `mock-adapter.js`، فانحرف التعريفان. قبل هذا التحديث، كان المرتجع الوحيد
 * الموجود يُستخدم أحيانًا لتصحيح قيمة فاتورة لم تُقدَّم خدمتها كاملة — وهو
 * استخدام خاطئ: ذاك تصحيح لجانب *الفاتورة*، لا لجانب *التحصيل*. الآن
 * المفهومان مستقلان: `refunds` يُنشئ فقط حين يعود مال فعلي للمريض، و
 * `creditNotes` يُنشئ فقط حين تُصحَّح قيمة الفاتورة نفسها. راجع
 * docs/12-BILLING-DOMAIN-MODEL.md للعلاقة الكاملة بينهما.
 *
 * ملاحظة محاسبية: الفاتورة الملغاة تحتفظ بإجماليها وبنودها للتدقيق، لكن كل
 * حقل مالي فيها صفر. أي مجموع مديونية أو إيراد يستبعدها.
 */

import { createRandom, SERVICES, PAYMENT_METHODS, DOCTORS } from "./seed.js";
import { patients } from "./patients.mock.js";
import * as money from "../core/money.js";
import { calculateInvoiceTotals, settleInvoice } from "../domain/billing.js";

/** الخدمات الطبية في مصر معفاة من ض.ق.م غالبًا؛ نطبّقها على قلة منها فقط. */
const TAX_RATE = 0.14;

/** أسباب مرتجع — مال عاد فعليًا للمريض. */
const REFUND_REASONS = [
  "تحصيل مزدوج",
  "استرداد نقدي بناءً على طلب المريض",
  "خطأ في طريقة الدفع المُستخدمة",
];

/**
 * أسباب إشعار دائن — تصحيح لقيمة الفاتورة، لا حركة نقدية.
 * عامة لأي نظام فوترة، لا قواعد محاسبية أو تأمينية خاصة بمستشفى بعينه.
 */
const CREDIT_NOTE_REASONS = [
  "بند مُفوتر لم يُقدَّم",
  "تصحيح خطأ في سعر بند",
  "تصحيح كمية مُفوترة بالخطأ",
  "خصم إضافي مُعتمَد بعد إصدار الفاتورة",
];

function generate() {
  const random = createRandom(720_033);

  const invoices = [];
  const invoiceLines = [];
  const payments = [];
  const refunds = [];
  const creditNotes = [];

  const billable = patients.filter((patient) => patient.status !== "archived");

  let lineId = 50_001;
  let paymentId = 60_001;
  let refundId = 70_001;
  let refundSequence = 0;
  let creditNoteId = 85_001;
  let creditNoteSequence = 0;

  for (let index = 0; index < 236; index += 1) {
    const id = 2001 + index;
    const patient = random.pick(billable);
    const date = random.date(random.int(0, 420));

    /* ---------------------------------------------------- البنود والإجماليات */

    const lines = random.sample(SERVICES, random.int(1, 5)).map((service) => {
      const quantity = service.category === "إقامة" ? random.int(1, 6) : random.int(1, 2);

      return {
        id: lineId++,
        invoiceId: id,
        serviceId: service.id,
        serviceCode: service.code,
        description: service.name,
        category: service.category,
        quantity,
        unitPrice: service.price,
        lineTotal: money.multiply(service.price, quantity),
      };
    });

    const discountRate = random.chance(0.26) ? random.pick([0.05, 0.1, 0.15, 0.2]) : 0;
    const taxRate = random.chance(0.12) ? TAX_RATE : 0;

    // الإجماليات تُحسب بوحدة المجال لا يدويًا — نفس الدالة التي سيطابقها الباك-إند.
    const totals = calculateInvoiceTotals({ lines, discountRate, taxRate });

    /* ------------------------------------------------- نية السداد ثم الحركات */

    const intent = random.pickWeighted([
      ["paid", 52],
      ["partially_paid", 22],
      ["unpaid", 20],
      ["cancelled", 6],
    ]);

    const invoicePayments = [];
    const invoiceRefunds = [];
    const invoiceCreditNotes = [];

    if (intent === "paid") {
      // سداد على دفعة واحدة غالبًا، وعلى دفعتين أحيانًا.
      const installments = random.chance(0.75) ? 1 : 2;
      const shares =
        installments === 1 ? [totals.total] : money.allocate(totals.total, 2);

      for (const amount of shares) {
        invoicePayments.push({
          id: paymentId++,
          invoiceId: id,
          patientId: patient.id,
          date: random.date(random.int(0, 20)),
          amount,
          method: random.pick(PAYMENT_METHODS).id,
          reference: `RCT-${paymentId}`,
          status: "completed",
        });
      }

      // مرتجع على فاتورة مسدَّدة — نادر، كما في الواقع.
      if (random.chance(0.06)) {
        refundSequence += 1;
        const refundStatus = random.pickWeighted([
          ["approved", 6],
          ["pending", 2],
          ["rejected", 1],
        ]);

        invoiceRefunds.push({
          id: refundId++,
          refundNumber: `REF-2026-${String(refundSequence).padStart(3, "0")}`,
          invoiceId: id,
          invoiceNumber: `INV-2026-${String(index + 1).padStart(4, "0")}`,
          patientId: patient.id,
          patientName: patient.name,
          date: random.date(random.int(0, 90)),
          amount: money.multiply(totals.total, random.pick([0.25, 0.5, 1])),
          reason: random.pick(REFUND_REASONS),
          method: random.pick(PAYMENT_METHODS).id,
          status: refundStatus,
        });
      }
    } else if (intent === "partially_paid") {
      invoicePayments.push({
        id: paymentId++,
        invoiceId: id,
        patientId: patient.id,
        date: random.date(random.int(0, 30)),
        amount: money.multiply(totals.total, random.pick([0.25, 0.3, 0.5, 0.6, 0.75])),
        method: random.pick(PAYMENT_METHODS).id,
        reference: `RCT-${paymentId}`,
        status: "completed",
      });
    }

    /*
     * إشعار دائن: تصحيح لقيمة الفاتورة، لا حركة نقدية — فيُنشأ بصرف النظر عن
     * حالة السداد. نسبة حدوثه منخفضة (تصحيحات نادرة بطبيعتها)، ومستقل تمامًا
     * عن توليد المرتجع أعلاه؛ قد يجتمع الاثنان على نفس الفاتورة بالصدفة، تمامًا
     * كما قد يحدث في الواقع (تُصحَّح القيمة أولًا، ثم يُردّ الفائض الناتج نقدًا).
     */
    if (intent !== "cancelled" && random.chance(0.045)) {
      creditNoteSequence += 1;

      // لا يتجاوز إجمالي الفاتورة أبدًا — maxCreditable تفرض الحد نفسه لاحقًا.
      const creditAmount = money.multiply(totals.total, random.pick([0.1, 0.2, 0.3, 0.5]));

      invoiceCreditNotes.push({
        id: creditNoteId++,
        creditNoteNumber: `CN-2026-${String(creditNoteSequence).padStart(3, "0")}`,
        invoiceId: id,
        invoiceNumber: `INV-2026-${String(index + 1).padStart(4, "0")}`,
        patientId: patient.id,
        patientName: patient.name,
        date: random.date(random.int(0, 60)),
        amount: creditAmount,
        reason: random.pick(CREDIT_NOTE_REASONS),
        status: random.pickWeighted([
          ["approved", 6],
          ["pending", 2],
          ["rejected", 1],
        ]),
      });
    }

    /* ------------------------------------------------------------- التسوية */

    const doctor = random.pick(DOCTORS);

    const dueDate = (() => {
      const due = new Date(date);
      due.setDate(due.getDate() + 30);
      return due.toISOString().slice(0, 10);
    })();

    const base = {
      id,
      invoiceNumber: `INV-2026-${String(index + 1).padStart(4, "0")}`,
      patientId: patient.id,
      patientName: patient.name,
      patientCode: patient.patientCode,
      doctorId: doctor.id,
      doctorName: doctor.name,
      departmentId: doctor.departmentId,
      date,
      dueDate,
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountRate,
      tax: totals.tax,
      taxRate,
      total: totals.total,
      status: intent === "cancelled" ? "cancelled" : undefined,
      etaStatus: random.pickWeighted([
        ["accepted", 6],
        ["submitted", 2],
        ["not_submitted", 3],
        ["invalid", 1],
      ]),
      etaUuid: null,
      createdBy: "عبدالله محمد",
      notes: null,
    };

    // effectiveTotal/paid/refunded/credited/remaining/status كلها من دالة واحدة.
    const settlement = settleInvoice(base, {
      payments: invoicePayments,
      refunds: invoiceRefunds,
      creditNotes: invoiceCreditNotes,
    });

    invoices.push({ ...base, ...settlement });
    invoiceLines.push(...lines);

    // الفاتورة الملغاة لا تحمل حركات مالية.
    if (intent !== "cancelled") {
      payments.push(...invoicePayments);
      refunds.push(...invoiceRefunds);
      creditNotes.push(...invoiceCreditNotes);
    }
  }

  /*
   * ضمان صريح لا احتمالي: يجب أن يحمل سجل تجريبي واحد على الأقل مرتجعًا
   * وإشعارًا دائنًا معًا على نفس الفاتورة — السيناريو الذي يُثبت استقلال
   * المحورين عمليًا (راجع docs/12-BILLING-DOMAIN-MODEL.md، المثال 4). ترك هذا
   * لاحتمالين مستقلين (~4% × ~6%) يعني أن أي تعديل لاحق على نسب أخرى في هذا
   * الملف قد يُسقط الحالة من المجموعة بصمت. أول فاتورة «مدفوعة بالكامل» بلا
   * حركات بعد تُحوَّل يدويًا بدل الاعتماد على الحظ.
   */
  const example = invoices.find(
    (invoice) => invoice.status === "paid" && invoice.refunded === 0 && invoice.credited === 0,
  );

  if (example) {
    creditNoteSequence += 1;
    refundSequence += 1;

    /*
     * الترتيب الزمني السردي مقصود، لا رياضي فقط: سُدِّدت الفاتورة كاملة أولًا،
     * ثم اكتُشف لاحقًا أن بندًا لم يُقدَّم فصدر إشعار دائن، ثم رُدّ الفائض
     * الناتج نقدًا. تأريخهما قبل الدفعة كان يجعل السجل الزمني يعرض ردًّا
     * لمبلغ لم يُحصَّل بعد — حساب صحيح رقميًا، لكنه سرد غير متماسك.
     */
    const latestPaymentDate = payments
      .filter((payment) => payment.invoiceId === example.id)
      .map((payment) => payment.date)
      .sort()
      .at(-1);

    const addDays = (isoDate, days) => {
      const next = new Date(`${isoDate}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + days);
      return next.toISOString().slice(0, 10);
    };

    const creditNoteDate = addDays(latestPaymentDate ?? example.date, 5);
    const refundDate = addDays(creditNoteDate, 3);

    const exampleCreditNote = {
      id: creditNoteId++,
      creditNoteNumber: `CN-2026-${String(creditNoteSequence).padStart(3, "0")}`,
      invoiceId: example.id,
      invoiceNumber: example.invoiceNumber,
      patientId: example.patientId,
      patientName: example.patientName,
      date: creditNoteDate,
      amount: money.multiply(example.total, 0.2),
      reason: "بند مُفوتر لم يُقدَّم",
      status: "approved",
    };

    const exampleRefund = {
      id: refundId++,
      refundNumber: `REF-2026-${String(refundSequence).padStart(3, "0")}`,
      invoiceId: example.id,
      invoiceNumber: example.invoiceNumber,
      patientId: example.patientId,
      patientName: example.patientName,
      date: refundDate,
      amount: money.multiply(example.total, 0.1),
      reason: "استرداد نقدي بناءً على طلب المريض",
      method: "cash",
      status: "approved",
    };

    creditNotes.push(exampleCreditNote);
    refunds.push(exampleRefund);

    const resettled = settleInvoice(example, {
      payments: payments.filter((payment) => payment.invoiceId === example.id),
      refunds: [exampleRefund],
      creditNotes: [exampleCreditNote],
    });

    const position = invoices.findIndex((invoice) => invoice.id === example.id);
    invoices[position] = { ...example, ...resettled };
  }

  return { invoices, invoiceLines, payments, refunds, creditNotes };
}

const generated = generate();

export const invoices = generated.invoices;
export const invoiceLines = generated.invoiceLines;
export const payments = generated.payments;
export const refunds = generated.refunds;
export const creditNotes = generated.creditNotes;
