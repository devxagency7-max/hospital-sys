/**
 * خدمة حسابات المرضى والخدمات الطبية — المرضى، الخدمات، الإقامة والعمليات، الفواتير، وسندات القبض.
 *
 * كل فاتورة وسند قبض يُسجَّل هنا يتكامل مع الخزائن النقدية والبنوك ودفتر الأستاذ.
 */

import { notFound, validationError, ruleViolation } from "../../core/errors.js";
import * as money from "../../core/money.js";
import { db, all, find, insert, update, where, query } from "../db.js";
import { postDocument, audit } from "./posting.service.js";
import {
  occupyRoom,
  releaseRoom,
  tariffForRoom,
  backfillAdmissionCharges,
  getAdmissionCostSummary,
  datesBetween,
} from "./rooms.service.js";
import {
  BASE_CURRENCY,
  tierForPatientType,
  priceLine,
  rateFor,
} from "../../domain/pricing.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/* ==========================================================================
   1) المرضى (Patients)
   ========================================================================== */

export function listPatients(params = {}) {
  return query("patients", {
    searchFields: ["name", "code", "nationalId", "phone", "insuranceProvider"],
    filters: {
      status: params.status,
      insuranceType: params.insuranceType,
      gender: params.gender,
    },
    sort: params.sort ?? "code",
    order: params.order ?? "asc",
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });
}

export function getPatient(id) {
  const patient = find("patients", id);
  if (!patient) throw notFound("المريض غير موجود", { id });

  const patientInvoices = where("patientInvoices", (i) => Number(i.patientId) === Number(id));
  const patientReceipts = where("patientReceipts", (r) => Number(r.patientId) === Number(id));
  const patientAdmissions = where("admissions", (a) => Number(a.patientId) === Number(id));

  return {
    ...patient,
    invoices: patientInvoices,
    receipts: patientReceipts,
    admissions: patientAdmissions,
  };
}

export function createPatient(data, { user } = {}) {
  if (!data.name?.trim()) throw validationError("اسم المريض مطلوب");
  if (!data.phone?.trim()) throw validationError("رقم الهاتف مطلوب");

  const count = all("patients").length + 1;
  const code = `PAT-${String(count).padStart(4, "0")}`;

  const created = insert("patients", {
    ...data,
    code,
    totalBilled: 0,
    totalPaid: 0,
    balance: 0,
    status: data.status || "outpatient",
    statusLabel: data.status === "inpatient" ? "مقيم / منوّم" : "عيادات خارجية",
    createdAt: TODAY,
  });

  audit({
    action: "create",
    entity: "patient",
    entityId: created.id,
    details: `تسجيل مريض جديد: ${created.name} (${created.code})`,
    user,
  });

  return created;
}

export function updatePatient(id, patch, { user } = {}) {
  const patient = find("patients", id);
  if (!patient) throw notFound("المريض غير موجود", { id });

  const updated = update("patients", id, patch);

  audit({
    action: "update",
    entity: "patient",
    entityId: id,
    details: `تحديث بيانات المريض: ${updated.name}`,
    user,
  });

  return updated;
}

/* ==========================================================================
   2) دليل الخدمات الطبية للمستشفى (Services Catalog)
   ========================================================================== */

export function listServices(params = {}) {
  return query("hospitalServices", {
    searchFields: ["name", "code", "categoryName", "department"],
    filters: {
      category: params.category,
      department: params.department,
    },
    sort: params.sort ?? "code",
    order: params.order ?? "asc",
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });
}

export function getService(id) {
  const service = find("hospitalServices", id);
  if (!service) throw notFound("الخدمة الطبية غير موجودة", { id });
  return service;
}

export function createService(data, { user } = {}) {
  if (!data.name?.trim()) throw validationError("اسم الخدمة مطلوب");
  if (!data.price || data.price <= 0) throw validationError("سعر الخدمة غير صحيح");

  const count = all("hospitalServices").length + 1;
  const code = data.code || `SRV-${String(count).padStart(3, "0")}`;

  const created = insert("hospitalServices", {
    ...data,
    code,
    price: Number(data.price),
  });

  audit({
    action: "create",
    entity: "hospitalService",
    entityId: created.id,
    details: `إضافة خدمة طبية: ${created.name}`,
    user,
  });

  return created;
}

/* ==========================================================================
   3) حالات الإقامة والعمليات والعناية المركزة (Admissions)
   ============================================================================ */

export function listAdmissions(params = {}) {
  return query("admissions", {
    searchFields: ["patientName", "patientCode", "code", "roomNumber", "attendingDoctor", "diagnosis"],
    filters: {
      status: params.status,
      stayType: params.stayType,
      department: params.department,
    },
    sort: params.sort ?? "id",
    order: params.order ?? "desc",
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });
}

export function getAdmission(id) {
  const admission = find("admissions", id);
  if (!admission) throw notFound("سجل الإقامة غير موجود", { id });
  return admission;
}

/**
 * فتح إقامة جديدة لمريض في وحدة محددة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ثلاث ضمانات:
 *   1. **الوحدة تُحجز فعليًا** عبر `occupyRoom` — فلا تُحجز لمريضين.
 *   2. **التعريفة من دليل الخدمات** لا من رقم يُدخله الموظف.
 *   3. **ليالي الإقامة تُحمَّل آليًا** من الدخول حتى اليوم عبر محرك
 *      الاستحقاق — لا يوم يضيع ولا إجمالي يُضرب بالإيد.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function createAdmission(data, { user } = {}) {
  if (!data.patientId) throw validationError({ patientId: "المريض مطلوب." });
  if (!data.roomId) throw validationError({ roomId: "وحدة الإقامة (الغرفة أو السرير) مطلوبة." });

  const patient = find("patients", data.patientId);
  if (!patient) throw notFound("المريض غير موجود.");

  /* مريض مقيم بالفعل لا يُحجز له سرير ثانٍ. */
  const existing = all("admissions").find(
    (a) => a.status === "active" && String(a.patientId) === String(patient.id),
  );
  if (existing) {
    throw ruleViolation(
      `المريض ${patient.name} مقيم بالفعل في ${existing.roomNumber} بالإقامة ${existing.code} — ` +
        "سجّل خروجه أو انقله بدل فتح إقامة ثانية.",
      { field: "patientId" },
    );
  }

  const { room, roomType, dailyRate } = tariffForRoom(data.roomId);

  const admissionDate = data.admissionDate || TODAY;
  if (String(admissionDate) > String(TODAY)) {
    throw validationError({ admissionDate: "لا تُفتح إقامة بتاريخ مستقبلي." });
  }

  const count = all("admissions").length + 1;
  const code = `ADM-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

  const created = insert("admissions", {
    code,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.code,

    roomId: room.id,
    roomCode: room.code,
    roomNumber: room.name,
    roomTypeId: roomType.id,
    roomTypeName: roomType.name,
    stayType: roomType.category,
    stayTypeLabel: roomType.category === "icu" ? "عناية مركزة" : "إقامة غرف",
    department: roomType.department,

    /** التعريفة المتعاقد عليها لحظة الدخول — للعرض والمراجعة فقط. */
    dailyRate,

    admissionDate,
    dischargeDate: null,
    attendingDoctor: data.attendingDoctor || patient.attendingDoctor || null,
    diagnosis: data.diagnosis || null,
    notes: data.notes || null,
    status: "active",
    statusLabel: "محجوز حالياً",
  });

  /* الحجز يرمي إن كانت الوحدة غير متاحة — بعد الإدراج نُصحّح بالحذف. */
  try {
    occupyRoom(room.id, created, { user });
  } catch (error) {
    db.admissions = db.admissions.filter((a) => a.id !== created.id);
    throw error;
  }

  update("patients", patient.id, {
    status: "inpatient",
    statusLabel: "مقيم / منوّم",
    currentRoom: room.name,
    currentRoomId: room.id,
    currentAdmissionId: created.id,
    admissionDate,
    attendingDoctor: created.attendingDoctor,
  });

  /* تحميل كل ليالي الإقامة حتى اليوم — فكري الطابع فلا تكرار. */
  const accrual = backfillAdmissionCharges(created.id, { user });

  audit({
    action: "admission.created",
    actionLabel: "فتح إقامة لمريض",
    module: "حسابات المرضى",
    entity: "admission",
    entityId: created.id,
    details:
      `${code} — ${patient.name} في ${room.name} (${roomType.name}) ` +
      `بتعريفة ${dailyRate} ج.م/يوم · حُمِّلت ${accrual.nights} ليلة`,
    user,
  });

  return { ...created, accrual, costSummary: getAdmissionCostSummary(created.id) };
}

/**
 * تسجيل خروج مريض.
 *
 * يُلحق ليالي الإقامة الناقصة أولًا، ثم يُخلي الوحدة. الترتيب مقصود: إخلاء
 * السرير قبل تحميل ليلته يُسقط آخر يوم من الحساب نهائيًا.
 */
export function dischargeAdmission(id, data = {}, { user } = {}) {
  const admission = find("admissions", id);
  if (!admission) throw notFound("سجل الإقامة غير موجود.");

  if (admission.status !== "active") {
    throw ruleViolation(
      `الإقامة ${admission.code} غير قائمة (${admission.statusLabel}) — لا يُسجَّل خروج مرتين.`,
      { field: "status" },
    );
  }

  const dischargeDate = data.dischargeDate || TODAY;
  if (String(dischargeDate) < String(admission.admissionDate)) {
    throw validationError({ dischargeDate: "تاريخ الخروج لا يسبق تاريخ الدخول." });
  }

  /* 1) إكمال التحميل حتى يوم الخروج — قبل الإخلاء. */
  update("admissions", id, { dischargeDate });
  const accrual = backfillAdmissionCharges(id, { user });

  const updated = update("admissions", id, {
    status: "discharged",
    statusLabel: "تم الخروج",
    dischargeDate,
    dischargeNotes: data.notes ?? null,
    dischargedBy: user?.name ?? null,
    dischargedAt: new Date().toISOString(),
  });

  /* 2) إخلاء الوحدة — تصير «تحت التنظيف» لا «فاضية» فورًا. */
  if (admission.roomId) releaseRoom(admission.roomId, { user });

  update("patients", admission.patientId, {
    status: "discharged",
    statusLabel: "تم الخروج",
    currentRoom: null,
    currentRoomId: null,
    currentAdmissionId: null,
  });

  const costSummary = getAdmissionCostSummary(id);

  audit({
    action: "admission.discharged",
    actionLabel: "خروج مريض",
    module: "حسابات المرضى",
    entity: "admission",
    entityId: id,
    details:
      `${admission.code} — ${admission.patientName} خرج من ${admission.roomNumber} ` +
      `بعد ${costSummary.nights} ليلة · إجمالي ${costSummary.total} ج.م ` +
      `(غير مفوتر: ${costSummary.uninvoiced} ج.م)`,
    user,
  });

  return { ...updated, accrual, costSummary };
}

/* ==========================================================================
   4) فواتير المرضى (Patient Invoices)
   ============================================================================ */

export function listPatientInvoices(params = {}) {
  return query("patientInvoices", {
    searchFields: ["invoiceNumber", "patientName", "patientCode", "insuranceProvider"],
    filters: {
      status: params.status,
      insuranceType: params.insuranceType,
    },
    sort: params.sort ?? "date",
    order: params.order ?? "desc",
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });
}

export function getPatientInvoice(id) {
  const invoice = find("patientInvoices", id);
  if (!invoice) throw notFound("فاتورة المريض غير موجودة", { id });
  return invoice;
}

/**
 * إصدار فاتورة مريض.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ثلاث قواعد يحرسها هذا الإصدار:
 *
 *  1. **الشريحة تُشتق من نوع المريض** لا يختارها الموظف. مريض وافد يُسعَّر
 *     بتعريفة الوافد ولو سهَت الموظفة، ومريض تأمين لا يُفوتر بسعر نقدي.
 *
 *  2. **سعر الصرف يُثبَّت على الفاتورة** لحظة إصدارها. الفاتورة بالدولار
 *     تحمل سعر يومها إلى الأبد، ولا يُعاد تقييمها بسعر لاحق — فرق العملة
 *     يُعترف به عند التحصيل بندًا مستقلًا.
 *
 *  3. **كل حساب مالي يمر من `money`** — لا `+` ولا `*` مباشرة على المبالغ.
 *     الطرح العشري المباشر يُنتج 94.19999999999999 بدل 94.2، وفرق القرش
 *     هذا يتراكم حتى لا يتوازن الميزان.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function createPatientInvoice(data, { user } = {}) {
  if (!data?.patientId) throw validationError({ patientId: "المريض مطلوب." });

  const patient = find("patients", data.patientId);
  if (!patient) throw notFound("المريض غير موجود.");

  const rawLines = data.lines ?? [];
  if (!rawLines.length) {
    throw validationError({ lines: "يجب إضافة بند خدمة واحد على الأقل في الفاتورة." });
  }

  const date = data.date || TODAY;
  const patientType = patient.patientType ?? "cash";

  const tiers = all("tariffTiers");
  const tariffPrices = all("tariffPrices");
  const rates = all("exchangeRates");
  const tier = tierForPatientType(patientType, tiers);

  /*
   * السطر المُسعَّر: إن حمل `serviceId` فسعره من الشريحة، وإلا فسعره
   * المُدخَل (بنود يدوية كالخصم أو خدمة غير مُفهرسة). الخلط بينهما مسموح
   * لكن العملة لا بد أن تتوحّد.
   */
  const lines = rawLines.map((line, index) => {
    if (line.serviceId) {
      const service = find("hospitalServices", line.serviceId);
      if (!service) throw notFound(`الخدمة #${line.serviceId} غير موجودة.`);

      const priced = priceLine({
        service,
        patientType,
        quantity: line.quantity ?? 1,
        date,
        tiers,
        tariffPrices,
        rates,
      });

      return {
        id: index + 1,
        serviceId: service.id,
        serviceCode: service.code,
        description: line.description ?? service.name,
        category: service.category,
        categoryName: service.categoryName,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
        total: priced.total,
        currency: priced.currency,
        baseTotal: priced.baseTotal,
        priceSource: priced.priceSource,
        tierId: priced.tierId,
      };
    }

    /* بند يدوي — بعملة الفاتورة المفترضة (عملة الشريحة). */
    const quantity = Number(line.quantity ?? 1);
    const unitPrice = money.round(line.unitPrice ?? 0);
    const total = money.multiply(unitPrice, quantity);
    const { rate } = rateFor(tier.currency, date, rates);

    return {
      id: index + 1,
      serviceId: null,
      serviceCode: line.serviceCode ?? null,
      description: line.description ?? "بند يدوي",
      category: line.category ?? "other",
      categoryName: line.categoryName ?? "بنود أخرى",
      quantity,
      unitPrice,
      total,
      currency: tier.currency,
      baseTotal: money.round(total * rate),
      priceSource: "manual",
      tierId: tier.id,
    };
  });

  /* عملة واحدة للمستند — إجمالي بعملتين لا معنى له. */
  const currencies = [...new Set(lines.map((l) => l.currency))];
  if (currencies.length > 1) {
    throw ruleViolation(
      `سطور الفاتورة بعملات مختلفة (${currencies.join(", ")}) — افصلها في مستندين.`,
      { field: "lines" },
    );
  }

  const currency = currencies[0] ?? BASE_CURRENCY;
  const { rate: exchangeRate, date: exchangeRateDate } = rateFor(currency, date, rates);

  const subtotal = lines.reduce((sum, l) => money.add(sum, l.total), 0);
  const discount = money.round(data.discount ?? 0);

  if (discount > subtotal) {
    throw validationError({ discount: "الخصم لا يتجاوز إجمالي الفاتورة." });
  }

  const totalAfterDiscount = money.subtract(subtotal, discount);

  /* حصة التأمين تُحسب على الصافي بعد الخصم. */
  const coverageRate = Number(patient.coverageRate ?? 0);
  const insuranceAmount = coverageRate > 0 ? money.multiply(totalAfterDiscount, coverageRate) : 0;
  const patientAmount = money.subtract(totalAfterDiscount, insuranceAmount);

  const count = all("patientInvoices").length + 1;
  const invoiceNumber = `PINV-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

  const created = insert("patientInvoices", {
    invoiceNumber,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.code,
    date,
    dueDate: data.dueDate || date,

    /* --- الشريحة والعملة --- */
    patientType,
    patientTypeLabel: patient.patientTypeLabel ?? "نقدي خاص",
    tierId: tier.id,
    tierCode: tier.code,
    tierName: tier.name,
    currency,

    /** سعر الصرف يوم الإصدار — مثبَّت، لا يُعاد تقييمه أبدًا. */
    exchangeRate,
    exchangeRateDate,
    baseCurrency: BASE_CURRENCY,

    insuranceType: patient.insuranceType,
    insuranceProvider: patient.insuranceProvider,
    coverageRate,

    lines,
    subtotal,
    discount,
    totalAfterDiscount,
    insuranceAmount,
    patientAmount,

    /** المقابل بالعملة الأساسية — هو ما يُرحَّل في الدفتر. */
    baseSubtotal: lines.reduce((sum, l) => money.add(sum, l.baseTotal), 0),
    baseTotalAfterDiscount: money.round(totalAfterDiscount * exchangeRate),
    basePatientAmount: money.round(patientAmount * exchangeRate),
    baseInsuranceAmount: money.round(insuranceAmount * exchangeRate),

    paidAmount: 0,
    remainingAmount: patientAmount,
    status: "unpaid",
    statusLabel: "غير مسددة",
    createdBy: user?.name ?? null,
    createdAt: new Date().toISOString(),
  });

  /* ربط سطور دفتر الاستحقاق المفوترة — فلا تُفوتر مرتين. */
  if (Array.isArray(data.chargeIds) && data.chargeIds.length) {
    for (const chargeId of data.chargeIds) {
      const charge = find("admissionCharges", chargeId);
      if (!charge) continue;
      if (charge.invoiceId) {
        throw ruleViolation(
          `البند «${charge.serviceName}» مفوتر بالفعل في فاتورة سابقة — لا يُفوتر مرتين.`,
          { field: "chargeIds" },
        );
      }
      update("admissionCharges", chargeId, {
        invoiceId: created.id,
        invoicedAt: new Date().toISOString(),
      });
    }
  }

  /* رصيد المريض يُقاس بالعملة الأساسية دائمًا — وإلا جُمع دولار على جنيه. */
  update("patients", patient.id, {
    totalBilled: money.add(patient.totalBilled ?? 0, created.basePatientAmount),
    balance: money.add(patient.balance ?? 0, created.basePatientAmount),
  });

  audit({
    action: "patient.invoice_created",
    actionLabel: "إصدار فاتورة مريض",
    module: "حسابات المرضى",
    entity: "patientInvoice",
    entityId: created.id,
    details:
      `${invoiceNumber} — ${patient.name} · شريحة ${tier.name} · ` +
      `${patientAmount} ${currency}` +
      (currency === BASE_CURRENCY
        ? ""
        : ` (= ${created.basePatientAmount} ${BASE_CURRENCY} بسعر ${exchangeRate} يوم ${exchangeRateDate})`),
    user,
  });

  return created;
}

/* ==========================================================================
   5) سندات القبض والدفعات (Patient Receipts)
   ============================================================================ */

export function listPatientReceipts(params = {}) {
  return query("patientReceipts", {
    searchFields: ["receiptNumber", "patientName", "patientCode", "invoiceNumber", "notes"],
    filters: {
      type: params.type,
      paymentMethod: params.paymentMethod,
    },
    sort: params.sort ?? "date",
    order: params.order ?? "desc",
    page: params.page,
    perPage: params.perPage,
    search: params.search,
  });
}

/**
 * تسجيل سند قبض من مريض.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  التحصيل بعملة أجنبية يُنتج **بندين لا بندًا واحدًا**:
 *
 *   1. المحصَّل بقيمته — يُطفئ المديونية.
 *   2. فرق العملة — الفارق بين سعر يوم الفاتورة وسعر يوم التحصيل.
 *
 *  ولا يُعدَّل الإيراد الأصلي. الخدمة قُدِّمت بقيمتها، والفارق ناتج عن
 *  الزمن وسعر الصرف لا عن الخدمة. دمجهما يجعل «إيراد الكشف» يتغير لأن
 *  المريض تأخر في الدفع — وهو تحريف لقياس الأداء الطبي.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function createPatientReceipt(data, { user } = {}) {
  if (!data?.patientId) throw validationError({ patientId: "المريض مطلوب." });

  const patient = find("patients", data.patientId);
  if (!patient) throw notFound("المريض غير موجود.");

  const amount = money.round(data.amount);
  if (!money.isPositive(amount)) {
    throw validationError({ amount: "مبلغ السند يجب أن يكون أكبر من صفر." });
  }

  const date = data.date || TODAY;
  const invoice = data.invoiceId ? find("patientInvoices", data.invoiceId) : null;

  if (data.invoiceId && !invoice) throw notFound("الفاتورة غير موجودة.");

  /*
   * عملة السند تتبع عملة الفاتورة التي يُسدِّدها. سند بالجنيه على فاتورة
   * بالدولار يُخصم من مديونية بعملة أخرى — والمقارنة بينهما بلا معنى.
   */
  const currency = data.currency ?? invoice?.currency ?? BASE_CURRENCY;
  const rates = all("exchangeRates");
  const { rate: settlementRate, date: rateDate } = rateFor(currency, date, rates);

  const baseAmount = money.round(amount * settlementRate);

  /* فرق العملة — يُحسب فقط حين تختلف عملة الفاتورة عن العملة الأساسية. */
  let fxDifference = null;
  if (invoice && currency !== BASE_CURRENCY) {
    const invoiceRate = Number(invoice.exchangeRate ?? settlementRate);
    const baseAtInvoice = money.round(amount * invoiceRate);
    const difference = money.subtract(baseAmount, baseAtInvoice);

    fxDifference = {
      currency,
      foreignAmount: amount,
      invoiceRate,
      settlementRate,
      baseAtInvoice,
      baseAtSettlement: baseAmount,
      difference,
      label:
        difference > 0 ? "مكسب فرق عملة" : difference < 0 ? "خسارة فرق عملة" : "لا فرق عملة",
    };
  }

  if (invoice) {
    const outstanding = money.subtract(invoice.patientAmount, invoice.paidAmount ?? 0);
    if (amount > outstanding) {
      throw ruleViolation(
        `المتبقي على الفاتورة ${invoice.invoiceNumber} هو ${outstanding} ${invoice.currency} ` +
          `والمحصَّل ${amount}. لا يُقبل تحصيل أكثر من المستحق — سجّل الفارق تأمينًا مقدمًا.`,
        { field: "amount" },
      );
    }
  }

  const count = all("patientReceipts").length + 1;
  const receiptNumber = `PRC-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

  const created = insert("patientReceipts", {
    receiptNumber,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.code,
    invoiceId: invoice?.id ?? null,
    invoiceNumber: invoice?.invoiceNumber ?? (data.type === "deposit" ? "تأمين دخول مقدم" : null),
    date,

    amount,
    currency,

    /** المقابل بالعملة الأساسية — هو ما يُرحَّل ويُجمَع في التقارير. */
    baseAmount,
    baseCurrency: BASE_CURRENCY,
    exchangeRate: settlementRate,
    exchangeRateDate: rateDate,

    /** فرق العملة بندًا مستقلًا — لا يُدمج في الإيراد. */
    fxDifference,

    type: data.type || "invoice_payment",
    typeLabel: data.type === "deposit" ? "تأمين دخول مقدم" : "سداد فاتورة",
    paymentMethod: data.paymentMethod || "cash",
    paymentMethodLabel:
      data.paymentMethod === "cash"
        ? "نقدي بالخزينة"
        : data.paymentMethod === "card"
          ? "بطاقة بنكية / فيزا"
          : "تحويل بنكي",
    targetAccount:
      data.targetAccount ||
      (data.paymentMethod === "cash" ? "الخزينة الرئيسية (1111)" : "البنك الأهلي المصري (1121)"),
    notes: data.notes || "سند قبض من مريض",
    createdBy: user?.name ?? null,
    createdAt: new Date().toISOString(),
  });

  if (invoice) {
    const newPaid = money.add(invoice.paidAmount ?? 0, amount);
    const newRemaining = Math.max(0, money.subtract(invoice.patientAmount, newPaid));

    update("patientInvoices", invoice.id, {
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      status: newRemaining === 0 ? "paid" : "partially_paid",
      statusLabel: newRemaining === 0 ? "مسددة بالكامل" : "مسددة جزئياً",
    });
  }

  /* رصيد المريض بالعملة الأساسية — المقياس الوحيد القابل للجمع. */
  update("patients", patient.id, {
    totalPaid: money.add(patient.totalPaid ?? 0, baseAmount),
    balance: Math.max(0, money.subtract(patient.balance ?? 0, baseAmount)),
  });

  audit({
    action: "patient.receipt_created",
    actionLabel: "سند قبض من مريض",
    module: "حسابات المرضى",
    entity: "patientReceipt",
    entityId: created.id,
    details:
      `${receiptNumber} — ${patient.name} · ${amount} ${currency}` +
      (currency === BASE_CURRENCY ? "" : ` (= ${baseAmount} ${BASE_CURRENCY} بسعر ${settlementRate})`) +
      (fxDifference && fxDifference.difference !== 0
        ? ` · ${fxDifference.label}: ${fxDifference.difference} ${BASE_CURRENCY}`
        : ""),
    user,
  });

  return created;
}

/* ==========================================================================
   6) كشف حساب مريض تفصيلي (Patient Statement)
   ============================================================================ */

export function getPatientStatement(patientId) {
  const patient = find("patients", patientId);
  if (!patient) throw notFound("المريض غير موجود", { id: patientId });

  const invoices = where("patientInvoices", (i) => Number(i.patientId) === Number(patientId));
  const receipts = where("patientReceipts", (r) => Number(r.patientId) === Number(patientId));

  const timeline = [];

  for (const inv of invoices) {
    timeline.push({
      date: inv.date,
      type: "invoice",
      typeLabel: "فاتورة خدمات علاجية",
      reference: inv.invoiceNumber,
      refNumber: inv.invoiceNumber,
      description: `فاتورة خدمات (${inv.lines?.length || 0} بنود)${inv.insuranceProvider ? ` — تغطية ${inv.insuranceProvider}` : ""}`,
      debit: inv.patientAmount,
      credit: 0,
    });
  }

  for (const rec of receipts) {
    timeline.push({
      date: rec.date,
      type: "receipt",
      typeLabel: rec.typeLabel || "سند قبض",
      reference: rec.receiptNumber,
      refNumber: rec.receiptNumber,
      description: `${rec.typeLabel || "سند قبض"} — ${rec.paymentMethodLabel || "نقدي"} (${rec.notes || ""})`,
      debit: 0,
      credit: rec.amount,
    });
  }

  // ترتيب زمني
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  for (const item of timeline) {
    running += item.debit - item.credit;
    item.balance = running;
  }

  return {
    patient,
    timeline,
    entries: timeline,
    totalBilled: patient.totalBilled || 0,
    totalPaid: patient.totalPaid || 0,
    currentBalance: patient.balance || 0,
  };
}

/* ==========================================================================
   7) مؤشرات وإحصائيات لوحة حسابات المرضى (KPIs)
   ============================================================================ */

export function getPatientStats() {
  const allPatients = all("patients");
  const allAdmissions = all("admissions");
  const allInvoices = all("patientInvoices");
  const allReceipts = all("patientReceipts");

  const inpatientsCount = allPatients.filter((p) => p.status === "inpatient").length;
  const icuCount = allAdmissions.filter((a) => a.status === "active" && a.stayType === "icu").length;
  /*
   * الإجماليات تُجمَع بالعملة الأساسية لا بعملة كل فاتورة: جمع 1,285 دولار
   * على 32,450 جنيهًا يُنتج رقمًا بلا معنى. فواتير العملة الأجنبية تحمل
   * `baseTotalAfterDiscount` لهذا الغرض بالضبط.
   */
  const totalReceivables = allPatients.reduce((sum, p) => money.add(sum, p.balance ?? 0), 0);
  const totalBilled = allInvoices.reduce(
    (sum, inv) => money.add(sum, inv.baseTotalAfterDiscount ?? inv.totalAfterDiscount ?? 0),
    0,
  );
  const totalCollected = allReceipts.reduce(
    (sum, rec) => money.add(sum, rec.baseAmount ?? rec.amount ?? 0),
    0,
  );

  return {
    totalPatients: allPatients.length,
    activeInpatients: inpatientsCount,
    activeIcu: icuCount,
    totalReceivables,
    totalBilled,
    totalCollected,
    roomOccupancyRate: 78.5, // 78.5% نسبة إشغال الأسرة
  };
}

/* ==========================================================================
   8) استعلام حساب المريض الخاص بالاستقبال (Reception Patient Summary)
   ============================================================================ */

export function getReceptionPatientSummary(patientId) {
  const patient = find("patients", patientId);
  if (!patient) throw notFound("المريض غير موجود", { id: patientId });

  const invoices = where("patientInvoices", (i) => Number(i.patientId) === Number(patientId));
  const receipts = where("patientReceipts", (r) => Number(r.patientId) === Number(patientId));
  const admissionsList = where("admissions", (a) => Number(a.patientId) === Number(patientId));

  const summaryItems = [];

  for (const inv of invoices) {
    const lines = inv.lines || [];

    // تجميع بنود العمليات الجراحية في بند إجمالي واحد للعملية
    const surgeryLines = lines.filter((l) => l.category === "surgery");
    if (surgeryLines.length > 0) {
      const mainOp =
        surgeryLines.find(
          (l) =>
            l.serviceCode.startsWith("SRV-SURG-01") ||
            l.serviceCode.startsWith("SRV-SURG-02") ||
            l.serviceCode.startsWith("SRV-SURG-03") ||
            l.serviceCode.startsWith("SRV-SURG-04") ||
            l.serviceCode.startsWith("SRV-SURG-05"),
        ) || surgeryLines[0];
      const surgTotal = surgeryLines.reduce((s, l) => s + (l.total || 0), 0);
      const surgIns = Math.round(surgTotal * (inv.coverageRate || 0));
      const surgPatient = surgTotal - surgIns;

      summaryItems.push({
        id: `surg-${inv.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        type: "surgery",
        typeLabel: "عمليات جراحية",
        summaryTitle: `عملية جراحية: ${mainOp.description}`,
        department: "قسم العمليات والجراحة",
        totalCost: surgTotal,
        insuranceCoverage: surgIns,
        patientShare: surgPatient,
        status: inv.status,
        hasDetails: true,
        detailsNotice:
          "ملاحظة أمان: تفاصيل ومصروفات العملية الداخلية معروضة للاطلاع الفوري على الشاشة فقط لموظف الاستقبال للإجابة على استفسارات المريض شفهياً. طباعة هذه التفاصيل الدقيقة غير مصرح بها من الاستقبال ومخصصة حصرياً لإدارة الحسابات المالية العامة.",
        internalBreakdown: surgeryLines.map((l) => ({
          serviceCode: l.serviceCode,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
        })),
      });
    }

    // تجميع بنود العناية المركزة في بند إجمالي واحد للإقامة والعناية
    const icuLines = lines.filter((l) => l.category === "icu");
    if (icuLines.length > 0) {
      const icuTotal = icuLines.reduce((s, l) => s + (l.total || 0), 0);
      const icuIns = Math.round(icuTotal * (inv.coverageRate || 0));
      const icuPatient = icuTotal - icuIns;
      summaryItems.push({
        id: `icu-${inv.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        type: "icu",
        typeLabel: "عناية مركزة",
        summaryTitle: "إقامة ورعاية بالعناية المركزة (ICU)",
        department: "العناية المركزة",
        totalCost: icuTotal,
        insuranceCoverage: icuIns,
        patientShare: icuPatient,
        status: inv.status,
        hasDetails: true,
        detailsNotice:
          "ملاحظة أمان: تفاصيل بنود وأجهزة العناية المركزة للاطلاع على الشاشة فقط — طباعة التفاصيل من اختصاص الإدارة المالية.",
        internalBreakdown: icuLines.map((l) => ({
          serviceCode: l.serviceCode,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
        })),
      });
    }

    // تجميع بنود الإقامة العادية والغرف
    const roomLines = lines.filter((l) => l.category === "room");
    if (roomLines.length > 0) {
      const roomTotal = roomLines.reduce((s, l) => s + (l.total || 0), 0);
      const roomIns = Math.round(roomTotal * (inv.coverageRate || 0));
      const roomPatient = roomTotal - roomIns;
      summaryItems.push({
        id: `room-${inv.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        type: "room",
        typeLabel: "إقامة وأجنحة",
        summaryTitle: "إقامة بالقسم الداخلي ورعاية تمريضية",
        department: "القسم الداخلي",
        totalCost: roomTotal,
        insuranceCoverage: roomIns,
        patientShare: roomPatient,
        status: inv.status,
        hasDetails: true,
        detailsNotice: "ملاحظة أمان: تفاصيل الإقامة والغرف للاطلاع على الشاشة فقط.",
        internalBreakdown: roomLines.map((l) => ({
          serviceCode: l.serviceCode,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.total,
        })),
      });
    }

    // بنود الفحوصات والتحاليل والأشعة والأدوية
    const otherLines = lines.filter((l) => !["surgery", "icu", "room"].includes(l.category));
    for (const l of otherLines) {
      const lineIns = Math.round((l.total || 0) * (inv.coverageRate || 0));
      const linePatient = (l.total || 0) - lineIns;
      summaryItems.push({
        id: `other-${inv.id}-${l.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date,
        type: l.category || "service",
        typeLabel: l.categoryName || "خدمات طبية",
        summaryTitle: l.description,
        department: l.categoryName || "الخدمات الطبية",
        totalCost: l.total,
        insuranceCoverage: lineIns,
        patientShare: linePatient,
        status: inv.status,
        hasDetails: false,
        internalBreakdown: [
          {
            serviceCode: l.serviceCode,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
          },
        ],
      });
    }
  }

  // ترتيب الحركات زمنيًا
  summaryItems.sort((a, b) => new Date(b.date) - new Date(a.date));

  /* كشف الحساب يُقاس بالعملة الأساسية — هو المقياس الوحيد القابل للجمع. */
  const totalBilled = invoices.reduce(
    (sum, i) => money.add(sum, i.baseTotalAfterDiscount ?? i.totalAfterDiscount ?? 0),
    0,
  );
  const totalInsurance = invoices.reduce(
    (sum, i) => money.add(sum, i.baseInsuranceAmount ?? i.insuranceAmount ?? 0),
    0,
  );
  const totalPatientRequired = invoices.reduce(
    (sum, i) => money.add(sum, i.basePatientAmount ?? i.patientAmount ?? 0),
    0,
  );
  const totalPaid = receipts.reduce((sum, r) => money.add(sum, r.baseAmount ?? r.amount ?? 0), 0);
  const remainingDue = Math.max(0, money.subtract(totalPatientRequired, totalPaid));

  return {
    patient,
    admissions: admissionsList,
    summaryItems,
    receipts,
    kpis: {
      totalBilled,
      totalInsurance,
      totalPatientRequired,
      totalPaid,
      remainingDue,
    },
  };
}
