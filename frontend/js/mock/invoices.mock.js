/**
 * فواتير ودفعات تجريبية.
 *
 * ملاحظة مهمة: الأرقام هنا متماسكة حسابيًا — subtotal − discount + tax = total،
 * ومجموع البنود = subtotal، ومجموع الدفعات المسجَّلة = حقل `paid`.
 * بيانات مالية غير متوازنة تجعل كل جدول ومؤشر وتقرير يبدو كأن فيه عطلاً،
 * ويُهدر وقتًا في تتبّع خطأ غير موجود.
 *
 * استثناء مقصود — الفاتورة الملغاة: تحتفظ بـ `total` وبنودها للتدقيق، لكن
 * `paid` و `remaining` فيها صفر، فلا تسري عليها معادلة paid + remaining = total.
 * لذلك أي مجموع مديونية أو إيراد يجب أن يستبعد `status === "cancelled"` أولاً.
 * «ممنوع حذف تاريخ المعاملات المالية من الواجهة» — فالإلغاء لا يمحو الفاتورة.
 */

import { createRandom, SERVICES, PAYMENT_METHODS, DOCTORS } from "./seed.js";
import { patients } from "./patients.mock.js";

const round2 = (value) => Math.round(value * 100) / 100;

function generate() {
  const random = createRandom(720_033);

  const invoices = [];
  const invoiceLines = [];
  const payments = [];

  // مرضى نشطون فقط تُصدر لهم فواتير.
  const billable = patients.filter((patient) => patient.status !== "archived");
  let lineId = 50_001;
  let paymentId = 60_001;

  for (let index = 0; index < 236; index += 1) {
    const id = 2001 + index;
    const patient = random.pick(billable);
    const date = random.date(random.int(0, 420));

    /* --- البنود --- */
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
        lineTotal: round2(service.price * quantity),
      };
    });

    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));

    /* --- الخصم والضريبة --- */
    const discountRate = random.chance(0.26) ? random.pick([0.05, 0.1, 0.15, 0.2]) : 0;
    const discount = round2(subtotal * discountRate);
    // الخدمات الطبية في مصر معفاة من ض.ق.م في الغالب؛ نترك ضريبة على قلة منها.
    const tax = random.chance(0.12) ? round2((subtotal - discount) * 0.14) : 0;
    const total = round2(subtotal - discount + tax);

    /* --- الدفعات: تُولَّد أولاً، ثم يُشتق منها `paid` --- */
    const settlement = random.pickWeighted([
      ["paid", 52],
      ["partially_paid", 22],
      ["unpaid", 20],
      ["cancelled", 6],
    ]);

    const invoicePayments = [];

    if (settlement === "paid") {
      const installments = random.chance(0.75) ? 1 : 2;
      let left = total;

      for (let part = 0; part < installments; part += 1) {
        const isLast = part === installments - 1;
        const amount = isLast ? round2(left) : round2(total * 0.5);
        left = round2(left - amount);

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
    } else if (settlement === "partially_paid") {
      invoicePayments.push({
        id: paymentId++,
        invoiceId: id,
        patientId: patient.id,
        date: random.date(random.int(0, 30)),
        amount: round2(total * random.pick([0.25, 0.3, 0.5, 0.6, 0.75])),
        method: random.pick(PAYMENT_METHODS).id,
        reference: `RCT-${paymentId}`,
        status: "completed",
      });
    }

    const paid = round2(invoicePayments.reduce((sum, payment) => sum + payment.amount, 0));
    const remaining = round2(total - paid);

    // الحالة مشتقة من الأرقام، لا مستقلة عنها — إلا الملغاة.
    let status;
    if (settlement === "cancelled") status = "cancelled";
    else if (remaining <= 0) status = "paid";
    else if (paid > 0) status = "partially_paid";
    else status = "unpaid";

    const dueDate = (() => {
      const due = new Date(date);
      due.setDate(due.getDate() + 30);
      return due.toISOString().slice(0, 10);
    })();

    const doctor = random.pick(DOCTORS);

    invoices.push({
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
      subtotal,
      discount,
      discountRate,
      tax,
      total,
      paid: settlement === "cancelled" ? 0 : paid,
      remaining: settlement === "cancelled" ? 0 : remaining,
      status,
      /** حالة الفاتورة الإلكترونية — تكامل ETA يُنفَّذ في Phase 7. */
      etaStatus: random.pickWeighted([
        ["accepted", 6],
        ["submitted", 2],
        ["not_submitted", 3],
        ["invalid", 1],
      ]),
      etaUuid: null,
      createdBy: "عبدالله محمد",
      notes: null,
    });

    invoiceLines.push(...lines);
    if (settlement !== "cancelled") payments.push(...invoicePayments);
  }

  return { invoices, invoiceLines, payments };
}

const generated = generate();

export const invoices = generated.invoices;
export const invoiceLines = generated.invoiceLines;
export const payments = generated.payments;

/** مرتجعات — قليلة عن قصد، كما في الواقع. */
export const refunds = (() => {
  const random = createRandom(410_077);
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");

  return random.sample(paidInvoices, 9).map((invoice, index) => ({
    id: 70_001 + index,
    refundNumber: `REF-2026-${String(index + 1).padStart(3, "0")}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    patientId: invoice.patientId,
    patientName: invoice.patientName,
    date: random.date(random.int(0, 90)),
    amount: round2(invoice.total * random.pick([0.25, 0.5, 1])),
    reason: random.pick([
      "إلغاء خدمة لم تُقدَّم",
      "تحصيل مزدوج",
      "تعديل فاتورة بعد السداد",
      "إلغاء عملية بناءً على طلب المريض",
    ]),
    method: random.pick(PAYMENT_METHODS).id,
    status: random.pickWeighted([
      ["approved", 6],
      ["pending", 2],
      ["rejected", 1],
    ]),
  }));
})();
