/**
 * بيانات تجريبية لباقي موديولات النظام:
 * المحاسبة، المواعيد، المشتريات، الصيدلية، المختبر، الأشعة، المستخدمين، التدقيق، والإعدادات.
 */

import { createRandom, DEPARTMENTS, DOCTORS, SERVICES, WAREHOUSES, SUPPLIERS, PAYMENT_METHODS, REFERENCE_DATE } from "./seed.js";
import { patients } from "./patients.mock.js";
import { items } from "./inventory.mock.js";

const random = createRandom(918_273);

/* ============================================================================
   1. شجرة الحسابات (Chart of Accounts)
   ============================================================================ */
export const accounts = [
  // 1. الأصول
  { id: 1, code: "1", name: "الأصول", type: "asset", parentId: null, level: 1, balance: 14250000, nature: "debit", status: "active" },
  { id: 11, code: "11", name: "الأصول المتداولة", type: "asset", parentId: 1, level: 2, balance: 6850000, nature: "debit", status: "active" },
  { id: 111, code: "111", name: "النقدية وما في حكمها", type: "asset", parentId: 11, level: 3, balance: 2450000, nature: "debit", status: "active" },
  { id: 1111, code: "1111", name: "الخزينة الرئيسية", type: "asset", parentId: 111, level: 4, balance: 450000, nature: "debit", status: "active" },
  { id: 1112, code: "1112", name: "خزينة الاستقبال", type: "asset", parentId: 111, level: 4, balance: 120000, nature: "debit", status: "active" },
  { id: 1113, code: "1113", name: "خزينة الصيدلية", type: "asset", parentId: 111, level: 4, balance: 80000, nature: "debit", status: "active" },
  { id: 1114, code: "1114", name: "البنك الأهلي المصري (حساب جاري)", type: "asset", parentId: 111, level: 4, balance: 1150000, nature: "debit", status: "active" },
  { id: 1115, code: "1115", name: "بنك مصر (حساب العمليات)", type: "asset", parentId: 111, level: 4, balance: 650000, nature: "debit", status: "active" },
  { id: 112, code: "112", name: "العملاء والمدينون", type: "asset", parentId: 11, level: 3, balance: 1850000, nature: "debit", status: "active" },
  { id: 1121, code: "1121", name: "حسابات المرضى النقدية", type: "asset", parentId: 112, level: 4, balance: 420000, nature: "debit", status: "active" },
  { id: 1122, code: "1122", name: "شركات التأمين الصحي", type: "asset", parentId: 112, level: 4, balance: 1430000, nature: "debit", status: "active" },
  { id: 113, code: "113", name: "المخزون السلعي", type: "asset", parentId: 11, level: 3, balance: 2550000, nature: "debit", status: "active" },
  { id: 1131, code: "1131", name: "مخزون الأدوية", type: "asset", parentId: 113, level: 4, balance: 1450000, nature: "debit", status: "active" },
  { id: 1132, code: "1132", name: "مخزون المستلزمات الطبية", type: "asset", parentId: 113, level: 4, balance: 850000, nature: "debit", status: "active" },
  { id: 1133, code: "1133", name: "مخزون مستلزمات المختبر والأشعة", type: "asset", parentId: 113, level: 4, balance: 250000, nature: "debit", status: "active" },
  { id: 12, code: "12", name: "الأصول غير المتداولة (الثابتة)", type: "asset", parentId: 1, level: 2, balance: 7400000, nature: "debit", status: "active" },
  { id: 121, code: "121", name: "الأجهزة والمعدات الطبية", type: "asset", parentId: 12, level: 3, balance: 5200000, nature: "debit", status: "active" },
  { id: 122, code: "122", name: "مجمع إهلاك الأجهزة الطبية", type: "asset", parentId: 12, level: 3, balance: -850000, nature: "credit", status: "active" },
  { id: 123, code: "123", name: "أثاث وتجهيزات غرف المرضى", type: "asset", parentId: 12, level: 3, balance: 1450000, nature: "debit", status: "active" },
  { id: 124, code: "124", name: "أجهزة الحاسب والشبكات", type: "asset", parentId: 12, level: 3, balance: 600000, nature: "debit", status: "active" },

  // 2. الخصوم (الالتزامات)
  { id: 2, code: "2", name: "الخصوم والالتزامات", type: "liability", parentId: null, level: 1, balance: 3450000, nature: "credit", status: "active" },
  { id: 21, code: "21", name: "الخصوم المتداولة", type: "liability", parentId: 2, level: 2, balance: 3450000, nature: "credit", status: "active" },
  { id: 211, code: "211", name: "الموردون والدائنون", type: "liability", parentId: 21, level: 3, balance: 2150000, nature: "credit", status: "active" },
  { id: 2111, code: "2111", name: "موردو الأدوية والمستلزمات", type: "liability", parentId: 211, level: 4, balance: 1650000, nature: "credit", status: "active" },
  { id: 2112, code: "2112", name: "موردو الأجهزة وصيانتها", type: "liability", parentId: 211, level: 4, balance: 500000, nature: "credit", status: "active" },
  { id: 212, code: "212", name: "المصروفات المستحقة", type: "liability", parentId: 21, level: 3, balance: 820000, nature: "credit", status: "active" },
  { id: 2121, code: "2121", name: "رواتب وأجور مستحقة", type: "liability", parentId: 212, level: 4, balance: 680000, nature: "credit", status: "active" },
  { id: 2122, code: "2122", name: "تأمينات اجتماعية مستحقة", type: "liability", parentId: 212, level: 4, balance: 140000, nature: "credit", status: "active" },
  { id: 213, code: "213", name: "الضرائب المستحقة (مصلحة الضرائب)", type: "liability", parentId: 21, level: 3, balance: 480000, nature: "credit", status: "active" },

  // 3. حقوق الملكية
  { id: 3, code: "3", name: "حقوق الملكية", type: "equity", parentId: null, level: 1, balance: 8200000, nature: "credit", status: "active" },
  { id: 31, code: "31", name: "رأس المال المدفوع", type: "equity", parentId: 3, level: 2, balance: 6000000, nature: "credit", status: "active" },
  { id: 32, code: "32", name: "الاحتياطي القانوني", type: "equity", parentId: 3, level: 2, balance: 1100000, nature: "credit", status: "active" },
  { id: 33, code: "33", name: "الأرباح المرحلة المبقاة", type: "equity", parentId: 3, level: 2, balance: 1100000, nature: "credit", status: "active" },

  // 4. الإيرادات
  { id: 4, code: "4", name: "الإيرادات", type: "revenue", parentId: null, level: 1, balance: 5600000, nature: "credit", status: "active" },
  { id: 41, code: "41", name: "إيرادات النشاط الطبي", type: "revenue", parentId: 4, level: 2, balance: 5600000, nature: "credit", status: "active" },
  { id: 411, code: "411", name: "إيرادات الكشوفات والعيادات الخارجية", type: "revenue", parentId: 41, level: 3, balance: 1450000, nature: "credit", status: "active" },
  { id: 412, code: "412", name: "إيرادات العمليات الجراحية", type: "revenue", parentId: 41, level: 3, balance: 1820000, nature: "credit", status: "active" },
  { id: 413, code: "413", name: "إيرادات الإقامة والرعاية المركزة", type: "revenue", parentId: 41, level: 3, balance: 850000, nature: "credit", status: "active" },
  { id: 414, code: "414", name: "إيرادات مبيعات الصيدلية", type: "revenue", parentId: 41, level: 3, balance: 920000, nature: "credit", status: "active" },
  { id: 415, code: "415", name: "إيرادات المختبر والتحاليل", type: "revenue", parentId: 41, level: 3, balance: 340000, nature: "credit", status: "active" },
  { id: 416, code: "416", name: "إيرادات مركز الأشعة", type: "revenue", parentId: 41, level: 3, balance: 220000, nature: "credit", status: "active" },

  // 5. المصروفات
  { id: 5, code: "5", name: "المصروفات", type: "expense", parentId: null, level: 1, balance: 3000000, nature: "debit", status: "active" },
  { id: 51, code: "51", name: "تكلفة الخدمات الطبية المباعة", type: "expense", parentId: 5, level: 2, balance: 1350000, nature: "debit", status: "active" },
  { id: 511, code: "511", name: "تكلفة الأدوية والمستهلكات المنصرفة", type: "expense", parentId: 51, level: 3, balance: 950000, nature: "debit", status: "active" },
  { id: 512, code: "512", name: "أتعاب الأطباء والاستشاريين", type: "expense", parentId: 51, level: 3, balance: 400000, nature: "debit", status: "active" },
  { id: 52, code: "52", name: "المصروفات العمومية والإدارية", type: "expense", parentId: 5, level: 2, balance: 1650000, nature: "debit", status: "active" },
  { id: 521, code: "521", name: "رواتب وأجور الطاقم الطبي والإداري", type: "expense", parentId: 52, level: 3, balance: 980000, nature: "debit", status: "active" },
  { id: 522, code: "522", name: "إيجار مباني المستشفى", type: "expense", parentId: 52, level: 3, balance: 250000, nature: "debit", status: "active" },
  { id: 523, code: "523", name: "الكهرباء والمياه والمرافق", type: "expense", parentId: 52, level: 3, balance: 110000, nature: "debit", status: "active" },
  { id: 524, code: "524", name: "صيانة الأجهزة والمعدات", type: "expense", parentId: 52, level: 3, balance: 180000, nature: "debit", status: "active" },
  { id: 525, code: "525", name: "إهلاك الأصول الثابتة", type: "expense", parentId: 52, level: 3, balance: 130000, nature: "debit", status: "active" },
];

/* ============================================================================
   2. قيود اليومية (Journal Entries)
   ============================================================================ */
export const journalEntries = [
  {
    id: 1,
    entryNumber: "JV-2026-00101",
    date: "2026-10-01",
    description: "إثبات مبيعات كشوفات العيادات الخارجية لشهر سبتمبر",
    debitTotal: 145000,
    creditTotal: 145000,
    status: "approved",
    createdBy: "أحمد حسني (محاسب عام)",
    approvedBy: "عمر خليل (مدير مالي)",
    lines: [
      { accountId: 1112, accountCode: "1112", accountName: "خزينة الاستقبال", debit: 145000, credit: 0, costCenter: "العيادات الخارجية" },
      { accountId: 411, accountCode: "411", accountName: "إيرادات الكشوفات والعيادات الخارجية", debit: 0, credit: 145000, costCenter: "العيادات الخارجية" },
    ],
  },
  {
    id: 2,
    entryNumber: "JV-2026-00102",
    date: "2026-10-02",
    description: "سداد فاتورة مشتريات مستلزمات طبية بشيك بنكي",
    debitTotal: 85000,
    creditTotal: 85000,
    status: "approved",
    createdBy: "أحمد حسني (محاسب عام)",
    approvedBy: "عمر خليل (مدير مالي)",
    lines: [
      { accountId: 2111, accountCode: "2111", accountName: "موردو الأدوية والمستلزمات", debit: 85000, credit: 0, costCenter: "المخزن الرئيسي" },
      { accountId: 1114, accountCode: "1114", accountName: "البنك الأهلي المصري (حساب جاري)", debit: 0, credit: 85000, costCenter: "الإدارة المالية" },
    ],
  },
  {
    id: 3,
    entryNumber: "JV-2026-00103",
    date: "2026-10-03",
    description: "صرف رواتب شهر سبتمبر لطاقم التمريض",
    debitTotal: 195000,
    creditTotal: 195000,
    status: "approved",
    createdBy: "سارة مدحت (محاسب رواتب)",
    approvedBy: "عمر خليل (مدير مالي)",
    lines: [
      { accountId: 521, accountCode: "521", accountName: "رواتب وأجور الطاقم الطبي والإداري", debit: 195000, credit: 0, costCenter: "التمريض" },
      { accountId: 1114, accountCode: "1114", accountName: "البنك الأهلي المصري (حساب جاري)", debit: 0, credit: 195000, costCenter: "الإدارة المالية" },
    ],
  },
  {
    id: 4,
    entryNumber: "JV-2026-00104",
    date: "2026-10-04",
    description: "توريد نقدية من خزينة الصيدلية إلى الحساب البنكي",
    debitTotal: 60000,
    creditTotal: 60000,
    status: "approved",
    createdBy: "أحمد حسني (محاسب عام)",
    approvedBy: "عمر خليل (مدير مالي)",
    lines: [
      { accountId: 1114, accountCode: "1114", accountName: "البنك الأهلي المصري (حساب جاري)", debit: 60000, credit: 0, costCenter: "الصيدلية" },
      { accountId: 1113, accountCode: "1113", accountName: "خزينة الصيدلية", debit: 0, credit: 60000, costCenter: "الصيدلية" },
    ],
  },
  {
    id: 5,
    entryNumber: "JV-2026-00105",
    date: "2026-10-05",
    description: "تسوية عجز أدوية منتهية الصلاحية بمخزن الصيدلية",
    debitTotal: 12400,
    creditTotal: 12400,
    status: "draft",
    createdBy: "أحمد حسني (محاسب عام)",
    approvedBy: null,
    lines: [
      { accountId: 511, accountCode: "511", accountName: "تكلفة الأدوية والمستهلكات المنصرفة", debit: 12400, credit: 0, costCenter: "الصيدلية" },
      { accountId: 1131, accountCode: "1131", accountName: "مخزون الأدوية", debit: 0, credit: 12400, costCenter: "الصيدلية" },
    ],
  },
];

/* ============================================================================
   3. الصناديق النقدية (Cash Boxes)
   ============================================================================ */
export const cashBoxes = [
  { id: 1, name: "الخزينة الرئيسية", code: "CASH-MAIN", balance: 450000, custodian: "محمد عبدالحميد", location: "الإدارة المالية - مبنى أ", status: "active" },
  { id: 2, name: "خزينة الاستقبال العام", code: "CASH-REC", balance: 120000, custodian: "نورهان يحيى", location: "بهو الاستقبال الرئيسي", status: "active" },
  { id: 3, name: "خزينة الصيدلية الخارجية", code: "CASH-PHAR", balance: 80000, custodian: "مينا سمير", location: "مبنى العيادات الخارجية", status: "active" },
  { id: 4, name: "خزينة قسم الطوارئ", code: "CASH-ER", balance: 45000, custodian: "خالد سعيد", location: "استقبال الطوارئ", status: "active" },
];

/* ============================================================================
   4. الحسابات البنكية (Bank Accounts)
   ============================================================================ */
export const bankAccounts = [
  { id: 1, bankName: "البنك الأهلي المصري", accountName: "مستشفى أمان الحياة - جاري", accountNumber: "1098234871234", iban: "EG3800020001098234871234001", currency: "EGP", balance: 1150000, status: "active" },
  { id: 2, bankName: "بنك مصر", accountName: "حساب غرف العمليات والمستلزمات", accountNumber: "2044819203112", iban: "EG1200030002044819203112001", currency: "EGP", balance: 650000, status: "active" },
  { id: 3, bankName: "البنك التجاري الدولي (CIB)", accountName: "حساب التبرعات والودائع", accountNumber: "3188204910394", iban: "EG5500100003188204910394001", currency: "EGP", balance: 820000, status: "active" },
];

/* ============================================================================
   5. مراكز التكلفة (Cost Centers)
   ============================================================================ */
export const costCenters = [
  { id: 1, code: "CC-101", name: "العيادات الخارجية", manager: "د. سامي عبدالفتاح", budget: 500000, actualCost: 380000, revenue: 1450000, status: "active" },
  { id: 2, code: "CC-102", name: "غرف العمليات الجراحية", manager: "د. عمرو حجازي", budget: 1200000, actualCost: 950000, revenue: 1820000, status: "active" },
  { id: 3, code: "CC-103", name: "قسم الطوارئ", manager: "د. كمال الديب", budget: 400000, actualCost: 320000, revenue: 490000, status: "active" },
  { id: 4, code: "CC-104", name: "الرعاية المركزة (ICU)", manager: "د. ياسر قنديل", budget: 800000, actualCost: 650000, revenue: 850000, status: "active" },
  { id: 5, code: "CC-105", name: "الصيدلية", manager: "د. مروة الشريف", budget: 600000, actualCost: 520000, revenue: 920000, status: "active" },
  { id: 6, code: "CC-106", name: "المختبر المركزي", manager: "د. نهاد عزمي", budget: 350000, actualCost: 280000, revenue: 340000, status: "active" },
  { id: 7, code: "CC-107", name: "مركز الأشعة والتصوير الطبي", manager: "د. حازم زاهر", budget: 300000, actualCost: 210000, revenue: 220000, status: "active" },
];

/* ============================================================================
   6. الفترات المحاسبية (Accounting Periods)
   ============================================================================ */
export const accountingPeriods = [
  { id: 1, name: "الربع الأول 2026 (Q1)", startDate: "2026-01-01", endDate: "2026-03-31", status: "closed", entriesCount: 1420, closedAt: "2026-04-05", closedBy: "عمر خليل" },
  { id: 2, name: "الربع الثاني 2026 (Q2)", startDate: "2026-04-01", endDate: "2026-06-30", status: "closed", entriesCount: 1580, closedAt: "2026-07-04", closedBy: "عمر خليل" },
  { id: 3, name: "الربع الثالث 2026 (Q3)", startDate: "2026-07-01", endDate: "2026-09-30", status: "closed", entriesCount: 1690, closedAt: "2026-10-02", closedBy: "عمر خليل" },
  { id: 4, name: "الربع الرابع 2026 (Q4)", startDate: "2026-10-01", endDate: "2026-12-31", status: "active", entriesCount: 145, closedAt: null, closedBy: null },
];

/* ============================================================================
   7. المواعيد والعيادات (Appointments)
   ============================================================================ */
export const appointments = Array.from({ length: 40 }, (_, i) => {
  const patient = patients[i % patients.length];
  const doctor = DOCTORS[i % DOCTORS.length];
  const dept = DEPARTMENTS.find((d) => d.id === doctor.departmentId) || DEPARTMENTS[0];
  const daysOffset = (i % 7) - 2; // بعضها ماضٍ، اليوم، وقادم
  const dateObj = new Date(REFERENCE_DATE);
  dateObj.setDate(dateObj.getDate() + daysOffset);
  const dateStr = dateObj.toISOString().slice(0, 10);
  const hour = 9 + (i % 8);
  const minute = (i % 4) * 15;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const statuses = ["confirmed", "completed", "waiting", "cancelled", "no_show"];
  const status = daysOffset < 0 ? "completed" : daysOffset === 0 ? (i % 2 === 0 ? "waiting" : "confirmed") : "confirmed";

  return {
    id: 1000 + i + 1,
    appointmentNumber: `APT-${2026000 + i + 1}`,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.patientCode,
    patientPhone: patient.phone,
    doctorId: doctor.id,
    doctorName: doctor.name,
    doctorTitle: doctor.title,
    departmentId: dept.id,
    departmentName: dept.name,
    clinicName: `عيادة ${dept.name}`,
    date: dateStr,
    time: timeStr,
    type: i % 3 === 0 ? "consultation" : i % 3 === 1 ? "follow_up" : "urgent",
    status,
    notes: i % 4 === 0 ? "متابعة نتائج التحاليل السابقة" : "كشف دوري عادي",
  };
});

/* ============================================================================
   8. طلبات الشراء وأوامر الشراء (Purchasing)
   ============================================================================ */
export const purchaseRequests = [
  { id: 1, requestNumber: "PR-2026-0041", department: "المخزن الرئيسي", requestedBy: "سامر طارق", date: "2026-10-01", itemsCount: 6, estimatedTotal: 74000, priority: "normal", status: "approved" },
  { id: 2, requestNumber: "PR-2026-0042", department: "الصيدلية", requestedBy: "د. مروة الشريف", date: "2026-10-02", itemsCount: 12, estimatedTotal: 128000, priority: "urgent", status: "approved" },
  { id: 3, requestNumber: "PR-2026-0043", department: "المختبر", requestedBy: "د. نهاد عزمي", date: "2026-10-03", itemsCount: 4, estimatedTotal: 42000, priority: "normal", status: "pending" },
  { id: 4, requestNumber: "PR-2026-0044", department: "غرف العمليات", requestedBy: "مها النادي", date: "2026-10-04", itemsCount: 8, estimatedTotal: 96000, priority: "urgent", status: "pending" },
];

export const purchaseOrders = [
  { id: 1, orderNumber: "PO-2026-0028", supplierId: 1, supplierName: "شركة النيل للأدوية", date: "2026-10-01", deliveryDate: "2026-10-06", totalAmount: 115000, status: "delivered", paidAmount: 115000 },
  { id: 2, orderNumber: "PO-2026-0029", supplierId: 2, supplierName: "المصرية للمستلزمات الطبية", date: "2026-10-02", deliveryDate: "2026-10-08", totalAmount: 84000, status: "in_transit", paidAmount: 40000 },
  { id: 3, orderNumber: "PO-2026-0030", supplierId: 3, supplierName: "دلتا فارما للتوزيع", date: "2026-10-03", deliveryDate: "2026-10-10", totalAmount: 62000, status: "approved", paidAmount: 0 },
  { id: 4, orderNumber: "PO-2026-0031", supplierId: 4, supplierName: "الأهرام للأجهزة الطبية", date: "2026-10-04", deliveryDate: "2026-10-15", totalAmount: 240000, status: "draft", paidAmount: 0 },
];

export const supplierInvoices = [
  { id: 1, invoiceNumber: "SINV-9081", poNumber: "PO-2026-0028", supplierId: 1, supplierName: "شركة النيل للأدوية", date: "2026-10-02", dueDate: "2026-11-02", totalAmount: 115000, paidAmount: 115000, status: "paid" },
  { id: 2, invoiceNumber: "SINV-9082", poNumber: "PO-2026-0029", supplierId: 2, supplierName: "المصرية للمستلزمات الطبية", date: "2026-10-03", dueDate: "2026-11-03", totalAmount: 84000, paidAmount: 40000, status: "partially_paid" },
  { id: 3, invoiceNumber: "SINV-9083", poNumber: "PO-2026-0025", supplierId: 5, supplierName: "مجموعة الشفاء الطبية", date: "2026-09-20", dueDate: "2026-10-20", totalAmount: 45000, paidAmount: 0, status: "unpaid" },
];

/* ============================================================================
   9. الصيدلية (Prescriptions & Dispensing)
   ============================================================================ */
export const prescriptions = Array.from({ length: 30 }, (_, i) => {
  const patient = patients[i % patients.length];
  const doctor = DOCTORS[i % DOCTORS.length];
  const item1 = items[i % items.length];
  const item2 = items[(i + 1) % items.length];

  return {
    id: 5000 + i + 1,
    prescriptionNumber: `RX-2026-${String(i + 101).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.patientCode,
    doctorName: doctor.name,
    doctorTitle: doctor.title,
    date: REFERENCE_DATE.toISOString().slice(0, 10),
    status: i % 3 === 0 ? "pending" : "dispensed",
    dispensedAt: i % 3 === 0 ? null : REFERENCE_DATE.toISOString(),
    dispensedBy: i % 3 === 0 ? null : "صيدلي / مينا سمير",
    items: [
      { name: item1.name, code: item1.code, dosage: "قرص مرتين يوميًا بعد الأكل", quantity: 2, price: item1.unitPrice || 65 },
      { name: item2.name, code: item2.code, dosage: "قرص مرة واحدة مساءً", quantity: 1, price: item2.unitPrice || 45 },
    ],
    totalAmount: (item1.unitPrice || 65) * 2 + (item2.unitPrice || 45),
  };
});

/* ============================================================================
   10. المختبر (Lab Requests & Results)
   ============================================================================ */
export const labRequests = Array.from({ length: 25 }, (_, i) => {
  const patient = patients[i % patients.length];
  const doctor = DOCTORS[i % DOCTORS.length];
  const testTypes = [
    { name: "صورة دم كاملة (CBC)", category: "دمويات", sample: "عينة دم وريدي", range: "طبيعي" },
    { name: "وظائف كبد (ALT, AST, Bilirubin)", category: "كيمياء إكلينيكية", sample: "عينة مصل دم", range: "مرتفع قليلاً" },
    { name: "وظائف كلى (Creatinine, Urea)", category: "كيمياء إكلينيكية", sample: "عينة دم وريدي", range: "طبيعي" },
    { name: "سكر صائم وتراكمي (HbA1c)", category: "هرمونات وسكر", sample: "عينة دم كامل", range: "6.8% (مضبوط)" },
    { name: "تحليل بول كامل (Urine Analysis)", category: "ميكروسكوبي", sample: "عينة بول صباحية", range: "طبيعي - لا أملاح" },
    { name: "دهون ثلاثية وكوليسترول (Lipid Profile)", category: "كيمياء إكلينيكية", sample: "عينة مصل دم", range: "كوليسترول 220 mg/dL" },
  ];
  const test = testTypes[i % testTypes.length];
  const statuses = ["pending", "sample_collected", "completed", "completed"];
  const status = statuses[i % statuses.length];

  return {
    id: 7000 + i + 1,
    requestNumber: `LAB-2026-${String(i + 201).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.patientCode,
    doctorName: doctor.name,
    testName: test.name,
    category: test.category,
    sampleType: test.sample,
    priority: i % 5 === 0 ? "urgent" : "normal",
    status,
    collectedAt: status !== "pending" ? REFERENCE_DATE.toISOString() : null,
    collectedBy: status !== "pending" ? "فني مختبر / هدى إبراهيم" : null,
    resultSummary: status === "completed" ? test.range : "في انتظار إجراء الفحص",
    resultDetails: status === "completed" ? "النتيجة مطابقة للمؤشرات السريرية، يوصى بالمتابعة الدورية." : null,
    verifiedBy: status === "completed" ? "د. نهاد عزمي (استشاري التحاليل الطبية)" : null,
    date: REFERENCE_DATE.toISOString().slice(0, 10),
  };
});

/* ============================================================================
   11. الأشعة (Radiology Requests & Reports)
   ============================================================================ */
export const radiologyRequests = Array.from({ length: 20 }, (_, i) => {
  const patient = patients[i % patients.length];
  const doctor = DOCTORS[i % DOCTORS.length];
  const scans = [
    { name: "أشعة سينية على الصدر (Chest X-Ray)", modality: "X-Ray", bodyPart: "الصدر والقفص الصدري" },
    { name: "أشعة مقطعية متعددة المقاطع على البطن (CT Abdomen)", modality: "CT", bodyPart: "البطن والحوض" },
    { name: "رنين مغناطيسي على المخ والفقرات العنقية (MRI Brain)", modality: "MRI", bodyPart: "الرأس والعنق" },
    { name: "موجات صوتية على البطن والحوض (Ultrasound)", modality: "US", bodyPart: "أعضاء البطن" },
    { name: "رسم قلب بالمجهود والإيكو (Echo Cardio)", modality: "ECHO", bodyPart: "القلب" },
  ];
  const scan = scans[i % scans.length];
  const statuses = ["scheduled", "in_progress", "completed", "completed"];
  const status = statuses[i % statuses.length];

  return {
    id: 8000 + i + 1,
    requestNumber: `RAD-2026-${String(i + 151).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.patientCode,
    doctorName: doctor.name,
    scanName: scan.name,
    modality: scan.modality,
    bodyPart: scan.bodyPart,
    priority: i % 4 === 0 ? "urgent" : "normal",
    status,
    scheduledAt: REFERENCE_DATE.toISOString().slice(0, 10),
    reportStatus: status === "completed" ? "signed" : "pending",
    radiologist: status === "completed" ? "د. حازم زاهر (استشاري الأشعة التشخيصية)" : null,
    findings: status === "completed" ? "فحص سليم دون وجود ارتشاح أو ظلال غير طبيعية. الهيكل العظمي والأنسجة الرخوة في حدود المعدلات الطبيعية." : "التقرير قيد الإعداد والمراجعة.",
    conclusion: status === "completed" ? "فحص طبيعي (Normal Study)" : null,
    date: REFERENCE_DATE.toISOString().slice(0, 10),
  };
});

/* ============================================================================
   12. المستخدمون والأدوار (Users & Roles)
   ============================================================================ */
export const users = [
  { id: 1, name: "عبدالله محمد", username: "admin", email: "admin@hospital.local", phone: "01001234567", role: "admin", roleName: "مدير النظام", department: "الإدارة العليا", status: "active", lastLogin: "2026-10-06 09:30" },
  { id: 2, name: "د. سامي عبدالفتاح", username: "dr.sami", email: "sami.f@hospital.local", phone: "01123456789", role: "doctor", roleName: "طبيب استشاري", department: "الباطنة", status: "active", lastLogin: "2026-10-06 08:45" },
  { id: 3, name: "د. منال الشاذلي", username: "dr.manal", email: "manal.s@hospital.local", phone: "01234567890", role: "doctor", roleName: "طبيب استشاري", department: "النساء والتوليد", status: "active", lastLogin: "2026-10-05 14:10" },
  { id: 4, name: "عمر خليل", username: "omar.cfo", email: "omar.k@hospital.local", phone: "01098765432", role: "accountant", roleName: "المدير المالي", department: "الإدارة المالية", status: "active", lastLogin: "2026-10-06 09:15" },
  { id: 5, name: "أحمد حسني", username: "ahmed.acc", email: "ahmed.h@hospital.local", phone: "01511223344", role: "accountant", roleName: "محاسب عام", department: "الإدارة المالية", status: "active", lastLogin: "2026-10-06 08:00" },
  { id: 6, name: "نورهان يحيى", username: "nourhan.rec", email: "nourhan.y@hospital.local", phone: "01055667788", role: "receptionist", roleName: "موظف استقبال", department: "الاستقبال وشؤون المرضى", status: "active", lastLogin: "2026-10-06 07:30" },
  { id: 7, name: "د. مروة الشريف", username: "marwa.pharm", email: "marwa.s@hospital.local", phone: "01199887766", role: "pharmacist", roleName: "مدير الصيدلية", department: "الصيدلية", status: "active", lastLogin: "2026-10-05 18:20" },
  { id: 8, name: "د. نهاد عزمي", username: "nehad.lab", email: "nehad.a@hospital.local", phone: "01288776655", role: "lab_technician", roleName: "رئيس قسم المختبر", department: "المختبر المركزي", status: "active", lastLogin: "2026-10-06 08:15" },
  { id: 9, name: "د. حازم زاهر", username: "hazem.rad", email: "hazem.z@hospital.local", phone: "01077665544", role: "radiologist", roleName: "استشاري أشعة", department: "مركز الأشعة", status: "active", lastLogin: "2026-10-05 12:40" },
  { id: 10, name: "سامر طارق", username: "samer.store", email: "samer.t@hospital.local", phone: "01566554433", role: "warehouse_officer", roleName: "أمين مخزن", department: "المخازن والمستودعات", status: "active", lastLogin: "2026-10-06 08:50" },
];

export const roles = [
  { id: 1, code: "admin", name: "مدير النظام الشامل", description: "صلاحيات كاملة للوصول إلى كافة شاشات ووحدات النظام وإدارتها", usersCount: 1, permissionsCount: 105 },
  { id: 2, code: "doctor", name: "طبيب استشاري / أخصائي", description: "الاطلاع على ملفات المرضى، حجز وكتابة التقارير، وصف الروشتات، وطلب الفحوصات", usersCount: 2, permissionsCount: 38 },
  { id: 3, code: "accountant", name: "محاسب / مدير مالي", description: "إدارة الفواتير والمدفوعات والقيود اليومية وشجرة الحسابات والتقارير المالية", usersCount: 2, permissionsCount: 64 },
  { id: 4, code: "receptionist", name: "موظف استقبال وتسكين", description: "تسجيل المرضى، حجز المواعيد، إصدار الفواتير المبدئية، وتحصيل الرسوم النقدية", usersCount: 1, permissionsCount: 24 },
  { id: 5, code: "pharmacist", name: "صيدلي", description: "صرف الروشتات الطبية، إدارة مخزون الصيدلية، ومتابعة تواريخ الصلاحية والتشغيلات", usersCount: 1, permissionsCount: 32 },
  { id: 6, code: "lab_technician", name: "أخصائي / فني مختبر", description: "استلام العينات، تسجيل نتائج التحاليل، واعتماد التقارير المخبرية", usersCount: 1, permissionsCount: 28 },
  { id: 7, code: "radiologist", name: "طبيب / فني أشعة", description: "جدولة فحوصات الأشعة، كتابة تقارير الفحص التشخيصي، ورفع المرفقات", usersCount: 1, permissionsCount: 26 },
  { id: 8, code: "warehouse_officer", name: "أمين مخزن ومستودعات", description: "استلام أذون الإضافة والصرف والتحويل المخزني، الجرد، والتسويات المخزنية", usersCount: 1, permissionsCount: 35 },
];

/* ============================================================================
   13. سجل التدقيق (Audit Logs)
   ============================================================================ */
export const auditLogs = [
  { id: 1, timestamp: "2026-10-06 09:45:12", user: "عبدالله محمد (admin)", action: "تسجيل دخول", module: "المصادقة", entity: "جلسة مستخدم", ip: "192.168.1.10", details: "تسجيل دخول ناجح من شبكة الإدارة الداخلية" },
  { id: 2, timestamp: "2026-10-06 09:30:25", user: "نورهان يحيى (استقبال)", action: "حجز موعد جديد", module: "المواعيد", entity: "APT-2026041", ip: "192.168.1.45", details: "حجز موعد كشف باطنة للمريض أحمد محمود السيد" },
  { id: 3, timestamp: "2026-10-06 09:20:00", user: "أحمد حسني (محاسبة)", action: "ترحيل قيد يومية", module: "المحاسبة", entity: "JV-2026-00104", ip: "192.168.1.22", details: "اعتماد وترحيل قيد توريد نقدية بمبلغ 60,000 ج.م" },
  { id: 4, timestamp: "2026-10-06 08:55:18", user: "د. مروة الشريف (صيدلية)", action: "صرف روشتة علاجية", module: "الصيدلية", entity: "RX-2026-0112", ip: "192.168.1.33", details: "صرف علاج أموكسيسيلين + باراسيتامول للمريض سارة علي" },
  { id: 5, timestamp: "2026-10-06 08:40:40", user: "سامر طارق (مخازن)", action: "إذن استلام أصناف", module: "المشتريات", entity: "PO-2026-0028", ip: "192.168.1.50", details: "استلام شحنة مستلزمات طبية من شركة النيل للأدوية" },
  { id: 6, timestamp: "2026-10-06 08:15:33", user: "د. نهاد عزمي (مختبر)", action: "اعتماد نتيجة تحليل", module: "المختبر", entity: "LAB-2026-0205", ip: "192.168.1.61", details: "اعتماد وتوقيع تحليل صورة دم كاملة (CBC)" },
  { id: 7, timestamp: "2026-10-05 16:30:00", user: "عمر خليل (مدير مالي)", action: "إغلاق فترة محاسبية", module: "المحاسبة", entity: "Q3-2026", ip: "192.168.1.15", details: "إغلاق الربع الثالث 2026 وترحيل الأرصدة الختامية" },
  { id: 8, timestamp: "2026-10-05 14:12:09", user: "عبدالله محمد (admin)", action: "تعديل تفضيلات المظهر", module: "الإعدادات", entity: "appearance", ip: "192.168.1.10", details: "تحديث خلفية النظام والضبابية (Glassmorphism)" },
];

/* ============================================================================
   14. إعدادات المستشفى والعيادات والضرائب
   ============================================================================ */
export const hospitalInfo = {
  name: "مستشفى أمان الحياة",
  nameEn: "Aman Al Hayat Hospital",
  taxNumber: "892-341-980",
  commercialRegister: "982341",
  licenseNumber: "MOH-2024-819",
  phone: "02-2798-4000",
  emergencyPhone: "16890",
  email: "info@amanalhayat-hospital.com",
  website: "https://amanalhayat-hospital.com",
  address: "شارع التحرير، الدقي، الجيزة، جمهورية مصر العربية",
  governorate: "الجيزة",
  currency: "ج.م (EGP)",
  foundedYear: 2018,
  totalBeds: 180,
  icuBeds: 24,
  orRooms: 6,
};

export const clinics = [
  { id: 1, code: "CLN-01", name: "عيادة الباطنة التخصصية", departmentId: 1, departmentName: "الباطنة", room: "غرفة 101 - الدور الأول", doctor: "د. سامي عبدالفتاح", status: "active" },
  { id: 2, code: "CLN-02", name: "عيادة الجراحة العامة والمناظير", departmentId: 2, departmentName: "الجراحة العامة", room: "غرفة 102 - الدور الأول", doctor: "د. عمرو حجازي", status: "active" },
  { id: 3, code: "CLN-03", name: "عيادة صحة الطفل ورعاية المواليد", departmentId: 3, departmentName: "الأطفال", room: "غرفة 201 - الدور الثاني", doctor: "د. هالة سعيد", status: "active" },
  { id: 4, code: "CLN-04", name: "عيادة النساء والتوليد والحمل الحرج", departmentId: 4, departmentName: "النساء والتوليد", room: "غرفة 202 - الدور الثاني", doctor: "د. منال الشاذلي", status: "active" },
  { id: 5, code: "CLN-05", name: "عيادة جراحة العظام والمفاصل", departmentId: 5, departmentName: "العظام", room: "غرفة 104 - الدور الأول", doctor: "د. طارق المنشاوي", status: "active" },
  { id: 6, code: "CLN-06", name: "عيادة أمراض وجراحة القلب", departmentId: 6, departmentName: "القلب والأوعية الدموية", room: "غرفة 301 - الدور الثالث", doctor: "د. ياسر قنديل", status: "active" },
  { id: 7, code: "CLN-07", name: "عيادة الجلدية والتجميل والليزر", departmentId: 8, departmentName: "الجلدية", room: "غرفة 205 - الدور الثاني", doctor: "د. نيفين رشاد", status: "active" },
  { id: 8, code: "CLN-08", name: "عيادة جراحة المسالك والذكورة", departmentId: 9, departmentName: "المسالك البولية", room: "غرفة 106 - الدور الأول", doctor: "د. مجدي الأبيض", status: "active" },
];

export const taxes = [
  { id: 1, code: "VAT-14", name: "ضريبة القيمة المضافة العامة", rate: 14, type: "sales", applicableTo: "الأجهزة والمستلزمات غير المعفاة", status: "active" },
  { id: 2, code: "WHT-1", name: "ضريبة الخصم والإضافة (توريدات)", rate: 1, type: "withholding", applicableTo: "فواتير الموردين والمقاولات", status: "active" },
  { id: 3, code: "WHT-3", name: "ضريبة الخصم والإضافة (خدمات)", rate: 3, type: "withholding", applicableTo: "أتعاب الاستشارات والخدمات الطبية الخارجية", status: "active" },
  { id: 4, code: "MED-EXEMPT", name: "إعفاء الخدمات الطبية (قانون 67 لسنة 2016)", rate: 0, type: "exemption", applicableTo: "الكشوفات، العمليات، والإقامة السريرية", status: "active" },
];
