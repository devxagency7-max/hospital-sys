/**
 * فواتير ومدفوعات ومرتجعات تجريبية.
 *
 * البيانات متماسكة **بالبناء لا بالصدفة**: كل إجمالي وحالة سداد يُشتق باستدعاء
 * `js/domain/billing.js` — نفس الوحدة التي تستخدمها طبقة الـ API والاختبارات.
 *
 * قبل هذا، كانت الحالة تُكتب هنا يدويًا والرصيد يُحسب في `mock-adapter.js`،
 * فانحرف التعريفان: ظهرت فواتير «مدفوعة» برصيد صفر رغم وجود مرتجع معتمد
 * عليها، بينما كشف حساب نفس المريض يطالبه بالمبلغ. توليد البيانات من نفس
 * الدوال يجعل هذا التناقض مستحيلًا.
 *
 * ملاحظة محاسبية: الفاتورة الملغاة تحتفظ بإجماليها وبنودها للتدقيق، لكن
 * `paid` و `remaining` فيها صفر. أي مجموع مديونية أو إيراد يستبعدها.
 */

import { createRandom, SERVICES, PAYMENT_METHODS, DOCTORS } from "./seed.js";
import { patients } from "./patients.mock.js";
import * as money from "../core/money.js";
import { calculateInvoiceTotals, settleInvoice } from "../domain/billing.js";

/** الخدمات الطبية في مصر معفاة من ض.ق.م غالبًا؛ نطبّقها على قلة منها فقط. */
const TAX_RATE = 0.14;

const REFUND_REASONS = [
  "إلغاء خدمة لم تُقدَّم",
  "تحصيل مزدوج",
  "تعديل فاتورة بعد السداد",
  "إلغاء عملية بناءً على طلب المريض",
];

function generate() {
  const random = createRandom(720_033);

  const invoices = [];
  const invoiceLines = [];
  const payments = [];
  const refunds = [];

  const billable = patients.filter((patient) => patient.status !== "archived");

  let lineId = 50_001;
  let paymentId = 60_001;
  let refundId = 70_001;
  let refundSequence = 0;

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
      if (random.chance(0.05)) {
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

    // `paid` و `refunded` و `remaining` و `status` كلها مشتقة من نفس الدالة.
    const settlement = settleInvoice(base, {
      payments: invoicePayments,
      refunds: invoiceRefunds,
    });

    invoices.push({ ...base, ...settlement });
    invoiceLines.push(...lines);

    // الفاتورة الملغاة لا تحمل حركات مالية.
    if (intent !== "cancelled") {
      payments.push(...invoicePayments);
      refunds.push(...invoiceRefunds);
    }
  }

  return { invoices, invoiceLines, payments, refunds };
}

const generated = generate();

export const invoices = generated.invoices;
export const invoiceLines = generated.invoiceLines;
export const payments = generated.payments;
export const refunds = generated.refunds;
