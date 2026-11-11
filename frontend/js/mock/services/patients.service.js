/**
 * خدمة حسابات المرضى والخدمات الطبية — المرضى، الخدمات، الإقامة والعمليات، الفواتير، وسندات القبض.
 *
 * كل فاتورة وسند قبض يُسجَّل هنا يتكامل مع الخزائن النقدية والبنوك ودفتر الأستاذ.
 */

import { notFound, validationError } from "../../core/errors.js";
import { db, all, find, insert, update, where, query } from "../db.js";
import { postDocument, audit } from "./posting.service.js";
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

export function createAdmission(data, { user } = {}) {
  if (!data.patientId) throw validationError("المريض مطلوب");
  const patient = find("patients", data.patientId);
  if (!patient) throw notFound("المريض غير موجود");

  const count = all("admissions").length + 1;
  const code = `ADM-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

  const dailyRate = Number(data.dailyRate || 1600);
  const daysCount = Number(data.daysCount || 1);

  const created = insert("admissions", {
    ...data,
    code,
    patientName: patient.name,
    patientCode: patient.code,
    status: "active",
    statusLabel: "منوم حالياً",
    admissionDate: data.admissionDate || TODAY,
    dailyRate,
    daysCount,
    totalCost: dailyRate * daysCount,
  });

  // تحديث حالة المريض إلى منوم
  update("patients", patient.id, {
    status: "inpatient",
    statusLabel: "مقيم / منوّم",
    currentRoom: data.roomNumber,
    admissionDate: data.admissionDate || TODAY,
    attendingDoctor: data.attendingDoctor || patient.attendingDoctor,
  });

  audit({
    action: "create",
    entity: "admission",
    entityId: created.id,
    details: `دخول مريض: ${patient.name} (${data.roomNumber})`,
    user,
  });

  return created;
}

export function dischargeAdmission(id, data = {}, { user } = {}) {
  const admission = find("admissions", id);
  if (!admission) throw notFound("سجل الإقامة غير موجود");

  const dischargeDate = data.dischargeDate || TODAY;
  const updated = update("admissions", id, {
    status: "discharged",
    statusLabel: "تم الخروج",
    dischargeDate,
  });

  // تحديث حالة المريض
  update("patients", admission.patientId, {
    status: "discharged",
    statusLabel: "تم الخروج",
    currentRoom: null,
  });

  audit({
    action: "update",
    entity: "admission",
    entityId: id,
    details: `خروج مريض: ${admission.patientName}`,
    user,
  });

  return updated;
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

export function createPatientInvoice(data, { user } = {}) {
  if (!data.patientId) throw validationError("المريض مطلوب");
  const patient = find("patients", data.patientId);
  if (!patient) throw notFound("المريض غير موجود");

  const lines = data.lines || [];
  if (!lines.length) throw validationError("يجب إضافة بند خدمة واحد على الأقل في الفاتورة");

  const count = all("patientInvoices").length + 1;
  const invoiceNumber = `PINV-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity || 1) * Number(line.unitPrice || 0)), 0);
  const discount = Number(data.discount || 0);
  const totalAfterDiscount = Math.max(0, subtotal - discount);

  const coverageRate = Number(patient.coverageRate || 0);
  const insuranceAmount = coverageRate > 0 ? Math.round(totalAfterDiscount * coverageRate) : 0;
  const patientAmount = totalAfterDiscount - insuranceAmount;

  const created = insert("patientInvoices", {
    invoiceNumber,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.code,
    date: data.date || TODAY,
    dueDate: data.dueDate || TODAY,
    insuranceType: patient.insuranceType,
    insuranceProvider: patient.insuranceProvider,
    coverageRate,
    lines: lines.map((l, idx) => ({ id: idx + 1, ...l })),
    subtotal,
    discount,
    totalAfterDiscount,
    insuranceAmount,
    patientAmount,
    paidAmount: 0,
    remainingAmount: patientAmount,
    status: "unpaid",
    statusLabel: "غير مسددة",
  });

  // تحديث رصيد المريض
  update("patients", patient.id, {
    totalBilled: (patient.totalBilled || 0) + patientAmount,
    balance: (patient.balance || 0) + patientAmount,
  });

  audit({
    action: "create",
    entity: "patientInvoice",
    entityId: created.id,
    details: `إصدار فاتورة مريض: ${invoiceNumber} بمبلغ ${patientAmount} ج.م`,
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

export function createPatientReceipt(data, { user } = {}) {
  if (!data.patientId) throw validationError("المريض مطلوب");
  const patient = find("patients", data.patientId);
  if (!patient) throw notFound("المريض غير موجود");

  const amount = Number(data.amount);
  if (!amount || amount <= 0) throw validationError("مبلغ السند غير صحيح");

  const count = all("patientReceipts").length + 1;
  const receiptNumber = `PRC-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;

  const created = insert("patientReceipts", {
    receiptNumber,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.code,
    invoiceId: data.invoiceId || null,
    invoiceNumber: data.invoiceNumber || (data.invoiceId ? find("patientInvoices", data.invoiceId)?.invoiceNumber : "تأمين مقدم"),
    date: data.date || TODAY,
    amount,
    type: data.type || "invoice_payment",
    typeLabel: data.type === "deposit" ? "تأمين دخول مقدم" : "سداد فاتورة",
    paymentMethod: data.paymentMethod || "cash",
    paymentMethodLabel: data.paymentMethod === "cash" ? "نقدي بالخزينة" : data.paymentMethod === "card" ? "بطاقة بنكية / فيزا" : "تحويل بنكي",
    targetAccount: data.targetAccount || (data.paymentMethod === "cash" ? "الخزينة الرئيسية (1111)" : "البنك الأهلي المصري (1121)"),
    notes: data.notes || "سند قبض من مريض",
  });

  // تحديث الفاتورة إن وُجدت
  if (data.invoiceId) {
    const inv = find("patientInvoices", data.invoiceId);
    if (inv) {
      const newPaid = (inv.paidAmount || 0) + amount;
      const newRemaining = Math.max(0, inv.patientAmount - newPaid);
      update("patientInvoices", inv.id, {
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newRemaining === 0 ? "paid" : "partially_paid",
        statusLabel: newRemaining === 0 ? "مسددة بالكامل" : "مسددة جزئياً",
      });
    }
  }

  // تحديث إجمالي مسددات المريض ورصيده
  update("patients", patient.id, {
    totalPaid: (patient.totalPaid || 0) + amount,
    balance: Math.max(0, (patient.balance || 0) - amount),
  });

  audit({
    action: "create",
    entity: "patientReceipt",
    entityId: created.id,
    details: `سند قبض مريض: ${receiptNumber} بمبلغ ${amount} ج.م`,
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
  const totalReceivables = allPatients.reduce((sum, p) => sum + (p.balance || 0), 0);
  const totalBilled = allInvoices.reduce((sum, inv) => sum + (inv.totalAfterDiscount || 0), 0);
  const totalCollected = allReceipts.reduce((sum, rec) => sum + (rec.amount || 0), 0);

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

  const totalBilled = invoices.reduce((sum, i) => sum + (i.totalAfterDiscount || 0), 0);
  const totalInsurance = invoices.reduce((sum, i) => sum + (i.insuranceAmount || 0), 0);
  const totalPatientRequired = invoices.reduce((sum, i) => sum + (i.patientAmount || 0), 0);
  const totalPaid = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const remainingDue = Math.max(0, totalPatientRequired - totalPaid);

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
