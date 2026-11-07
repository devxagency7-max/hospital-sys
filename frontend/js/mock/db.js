/**
 * قاعدة بيانات في الذاكرة + محرك استعلام.
 *
 * الغرض ليس محاكاة قاعدة بيانات، بل أن تتصرف طبقة البيانات التجريبية مثل API
 * حقيقي: بحث وفلترة وترتيب وترقيم على الخادم، بنفس عقد الاستجابة. لو رجعت
 * البيانات كاملة والجدول فلترها محليًا، فلن يعمل الجدول عند ربط API حقيقي
 * بآلاف الصفوف.
 *
 * التعديلات تُطبَّق على الذاكرة فعلًا، وتضيع عند تحديث الصفحة. هذا مقصود:
 * نافذة «تم الحفظ» يجب أن تعني أن شيئًا تغيّر بالفعل (docs/07-FRONTEND-RULES.md).
 */

import { matchesFields, compareValues } from "../core/text.js";
import { TABLE } from "../core/config.js";

import {
  accounts,
  journalEntries,
  fiscalYears,
  accountingPeriods,
  costCenters,
  postingMap,
} from "./accounting.mock.js";

import {
  customers,
  suppliers,
  customerInvoices,
  customerInvoiceLines,
  customerReceipts,
  customerCreditNotes,
  supplierInvoices,
  supplierPayments,
  cashBoxes,
  cashMovements,
  cashReconciliations,
  bankAccounts,
  bankTransactions,
  bankReconciliations,
  assetCategories,
  fixedAssets,
  depreciationRuns,
  taxes,
  taxReturns,
  subsidiaryReconciliation,
} from "./finance.mock.js";

import {
  employees,
  departments,
  positions,
  shifts,
  leaveTypes,
  holidays,
  attendanceRecords,
  leaveRequests,
  employeeAdvances,
  payrollRuns,
  payslips,
  payrollSettings,
} from "./hr.mock.js";

import {
  items,
  itemCategories,
  units,
  warehouses,
  stockMovements,
  stockBalances,
  batches,
  stockCounts,
  stockCountLines,
} from "./inventory.mock.js";

import {
  users,
  roles,
  auditLogs,
  companyInfo,
  branches,
  systemPreferences,
  notificationPreferences,
  documentSources,
} from "./admin.mock.js";

import { PAYMENT_METHODS, GOVERNORATES } from "./seed.js";

/**
 * المجموعات. نُنسخ المصفوفات حتى لا تُعدّل ملفات البيانات الأصلية في مكانها،
 * فتبقى إعادة التهيئة ممكنة.
 */
export const db = {
  /* --- المحاسبة العامة --- */
  accounts: [...accounts],
  journalEntries: [...journalEntries],
  fiscalYears: [...fiscalYears],
  accountingPeriods: [...accountingPeriods],
  costCenters: [...costCenters],

  /* --- المحاسبة المالية --- */
  customers: [...customers],
  suppliers: [...suppliers],
  customerInvoices: [...customerInvoices],
  customerInvoiceLines: [...customerInvoiceLines],
  customerReceipts: [...customerReceipts],
  customerCreditNotes: [...customerCreditNotes],
  supplierInvoices: [...supplierInvoices],
  supplierPayments: [...supplierPayments],
  cashBoxes: [...cashBoxes],
  cashMovements: [...cashMovements],
  cashReconciliations: [...cashReconciliations],
  bankAccounts: [...bankAccounts],
  bankTransactions: [...bankTransactions],
  bankReconciliations: [...bankReconciliations],
  assetCategories: [...assetCategories],
  fixedAssets: [...fixedAssets],
  depreciationRuns: [...depreciationRuns],
  taxes: [...taxes],
  taxReturns: [...taxReturns],

  /* --- الموارد البشرية --- */
  employees: [...employees],
  departments: [...departments],
  positions: [...positions],
  shifts: [...shifts],
  leaveTypes: [...leaveTypes],
  holidays: [...holidays],
  attendanceRecords: [...attendanceRecords],
  leaveRequests: [...leaveRequests],
  employeeAdvances: [...employeeAdvances],
  payrollRuns: [...payrollRuns],
  payslips: [...payslips],

  /* --- المخازن --- */
  items: [...items],
  itemCategories: [...itemCategories],
  units: [...units],
  warehouses: [...warehouses],
  stockMovements: [...stockMovements],
  stockBalances: [...stockBalances],
  batches: [...batches],
  stockCounts: [...stockCounts],
  stockCountLines: [...stockCountLines],

  /* --- الإدارة والنظام --- */
  users: [...users],
  roles: [...roles],
  auditLogs: [...auditLogs],
  branches: [...branches],
  documentSources: [...documentSources],
  notificationPreferences: [...notificationPreferences],

  /* --- قوائم مرجعية --- */
  paymentMethods: [...PAYMENT_METHODS],
  governorates: GOVERNORATES.map((name, index) => ({ id: index + 1, name })),

  /* --- كائنات مفردة (لا مجموعات) --- */
  companyInfo: { ...companyInfo },
  postingMap: { ...postingMap },
  systemPreferences: { ...systemPreferences },
  payrollSettings: { ...payrollSettings },
  subsidiaryReconciliation: [...subsidiaryReconciliation],
};

/* --------------------------------------------------------------------------
   محرك الاستعلام
   -------------------------------------------------------------------------- */

/** الحقول القابلة للبحث الحر لكل مجموعة. */
const SEARCHABLE = {
  accounts: ["code", "name", "nameEn", "type"],
  journalEntries: ["entryNumber", "description", "reference", "createdBy", "sourceType"],
  accountingPeriods: ["name", "periodKey", "status"],
  fiscalYears: ["name", "status"],
  costCenters: ["code", "name", "nameEn", "type"],

  customers: ["code", "name", "nameEn", "phone", "taxId", "activity", "contactPerson", "governorate"],
  suppliers: ["code", "name", "nameEn", "phone", "taxId", "activity", "contactPerson", "governorate"],
  customerInvoices: ["invoiceNumber", "customerName", "customerCode", "paymentTermsLabel"],
  customerReceipts: ["receiptNumber", "invoiceNumber", "customerName", "reference", "methodLabel"],
  customerCreditNotes: ["creditNoteNumber", "invoiceNumber", "customerName", "reason"],
  supplierInvoices: ["invoiceNumber", "supplierInvoiceNumber", "supplierName", "supplierCode"],
  supplierPayments: ["paymentNumber", "invoiceNumber", "supplierName", "reference"],
  cashBoxes: ["code", "name", "custodian", "location"],
  cashMovements: ["voucherNumber", "description", "reference", "performedBy"],
  bankAccounts: ["code", "bankName", "accountName", "accountNumber", "iban", "branch"],
  bankTransactions: ["description", "reference", "type"],
  fixedAssets: ["code", "name", "nameEn", "categoryName", "serialNumber"],
  assetCategories: ["code", "name"],
  depreciationRuns: ["runNumber", "period"],
  taxes: ["code", "name", "nameEn", "type"],
  taxReturns: ["returnNumber", "period"],

  employees: ["code", "name", "nameEn", "jobTitle", "departmentName", "phone", "nationalId", "email"],
  departments: ["code", "name", "nameEn"],
  positions: ["code", "title"],
  attendanceRecords: ["employeeName", "status"],
  leaveRequests: ["requestNumber", "employeeName", "employeeCode", "typeLabel", "reason", "departmentName"],
  employeeAdvances: ["advanceNumber", "employeeName", "employeeCode", "reason", "departmentName"],
  payrollRuns: ["runNumber", "periodLabel", "period"],
  payslips: ["payslipNumber", "employeeName", "employeeCode", "jobTitle", "departmentName", "periodLabel"],

  items: ["code", "barcode", "name", "nameEn", "category", "unit"],
  itemCategories: ["code", "name", "nameEn"],
  units: ["code", "name", "nameEn"],
  warehouses: ["code", "name", "nameEn", "location"],
  stockMovements: ["reference", "itemName", "itemCode", "warehouseName", "typeLabel", "performedBy", "reason"],
  stockBalances: ["itemCode", "itemName", "itemNameEn", "category", "warehouseName"],
  batches: ["batchNumber", "itemName", "itemCode", "warehouseName", "reference"],
  stockCounts: ["countNumber", "warehouseName", "countedBy"],

  users: ["code", "name", "username", "email", "phone", "roleName", "jobTitle"],
  roles: ["code", "name", "description"],
  auditLogs: ["user", "actionLabel", "action", "module", "entity", "ip", "details"],
  branches: ["code", "name", "governorate", "address"],
};

/** حقل التاريخ الذي يستهدفه فلتر `dateFrom` / `dateTo` لكل مجموعة. */
const DATE_FIELD = {
  journalEntries: "date",
  customerInvoices: "date",
  customerReceipts: "date",
  customerCreditNotes: "date",
  supplierInvoices: "date",
  supplierPayments: "date",
  cashMovements: "date",
  bankTransactions: "date",
  fixedAssets: "purchaseDate",
  depreciationRuns: "date",
  attendanceRecords: "date",
  leaveRequests: "fromDate",
  stockMovements: "date",
  batches: "expiryDate",
  stockCounts: "plannedDate",
  auditLogs: "timestamp",
  customers: "openedAt",
  suppliers: "openedAt",
  employees: "hireDate",
  users: "createdAt",
};

/**
 * معاملات لا تُعامل كفلاتر على الحقول.
 *
 * `asOf` و `period` و `method` و `costCenterId` مُدرَجة لأن بعض نقاط النهاية
 * تستخدمها كمعاملات حساب لا كفلاتر مطابقة على حقل — تمريرها إلى فلتر الحقول
 * يُفرِّغ النتيجة بصمت.
 */
const RESERVED = new Set([
  "page", "perPage", "search", "sort", "order", "dateFrom", "dateTo",
  "asOf", "period", "method", "includeZero", "groupBy",
]);

/**
 * يطبّق البحث والفلترة والترتيب والترقيم على مجموعة.
 *
 * @returns {{ data: object[], meta: { page:number, perPage:number, total:number, totalPages:number } }}
 */
export function query(collection, params = {}) {
  const rows = db[collection];
  if (!rows) throw new Error(`مجموعة غير معروفة: ${collection}`);

  let result = [...rows];

  /* --- البحث الحر --- */
  if (params.search) {
    const fields = SEARCHABLE[collection] ?? Object.keys(result[0] ?? {});
    result = result.filter((row) => matchesFields(row, fields, params.search));
  }

  /* --- نطاق التاريخ --- */
  const dateField = DATE_FIELD[collection];
  if (dateField && (params.dateFrom || params.dateTo)) {
    result = result.filter((row) => {
      const value = String(row[dateField] ?? "").slice(0, 10);
      if (!value) return false;
      if (params.dateFrom && value < params.dateFrom) return false;
      if (params.dateTo && value > params.dateTo) return false;
      return true;
    });
  }

  /* --- فلاتر الحقول --- */
  for (const [key, raw] of Object.entries(params)) {
    if (RESERVED.has(key) || raw === null || raw === undefined || raw === "") continue;

    // قيمة متعددة: status=paid,unpaid أو مصفوفة.
    const wanted = (Array.isArray(raw) ? raw : String(raw).split(",")).map((value) =>
      String(value).trim(),
    );

    result = result.filter((row) => {
      if (!(key in row)) return true; // فلتر لا يخص هذه المجموعة — نتجاهله
      return wanted.includes(String(row[key]));
    });
  }

  const total = result.length;

  /* --- الترتيب --- */
  if (params.sort) {
    const direction = params.order === "desc" ? -1 : 1;
    result = [...result].sort(
      (a, b) => compareValues(a[params.sort], b[params.sort]) * direction,
    );
  }

  /* --- الترقيم --- */
  const perPage = Number(params.perPage) > 0 ? Number(params.perPage) : TABLE.defaultPageSize;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  // صفحة خارج النطاق (بعد فلترة ضيّقة) تُقيَّد لآخر صفحة بدل إرجاع قائمة فارغة.
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);
  const start = (page - 1) * perPage;

  return {
    data: result.slice(start, start + perPage),
    meta: { page, perPage, total, totalPages },
  };
}

/** يُعيد سجلاً واحدًا بالمعرّف، أو undefined. */
export function find(collection, id) {
  return db[collection]?.find(
    (item) =>
      String(item.id) === String(id) ||
      String(item.code ?? "") === String(id) ||
      String(item.entryNumber ?? "") === String(id) ||
      String(item.invoiceNumber ?? "") === String(id) ||
      String(item.runNumber ?? "") === String(id),
  );
}

/** يُعيد كل السجلات المطابقة لمُرشِّح — للقوائم المرجعية والتجميعات. */
export function where(collection, predicate) {
  return (db[collection] ?? []).filter(predicate);
}

/** يُعيد كل السجلات دون ترقيم — للقوائم المنسدلة والحساب في طبقة المجال. */
export function all(collection) {
  return [...(db[collection] ?? [])];
}

/* --------------------------------------------------------------------------
   الكتابة
   -------------------------------------------------------------------------- */

/** المعرّف التالي لمجموعة. */
function nextId(collection) {
  const rows = db[collection] ?? [];
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

export function insert(collection, record) {
  if (!db[collection]) throw new Error(`مجموعة غير معروفة: ${collection}`);

  const row = { id: nextId(collection), ...record };
  db[collection].unshift(row);
  return row;
}

export function update(collection, id, patch) {
  const rows = db[collection];
  if (!rows) throw new Error(`مجموعة غير معروفة: ${collection}`);

  /*
   * معرّف فارغ يُرفض صراحةً.
   *
   * بدون هذا الفحص تُطابق المقارنة النصية `String(undefined)` نفسها، فأي
   * تحديث بمعرّف مفقود يُصيب أول صف بلا معرّف في المجموعة بدل أن يفشل —
   * وهو خطأ صامت يُعدّل بيانات سجل غير مقصود. حدث فعلًا مع صفوف أرصدة
   * المخزون قبل إضافة معرّفاتها.
   */
  if (id === undefined || id === null || id === "") {
    throw new Error(`update(${collection}) بمعرّف فارغ — السجل المقصود غير محدَّد.`);
  }

  const index = rows.findIndex((row) => String(row.id) === String(id));
  if (index === -1) return undefined;

  rows[index] = { ...rows[index], ...patch, id: rows[index].id };
  return rows[index];
}

/**
 * حذف ناعم. لا دالة حذف فعلي عن قصد: docs/07-FRONTEND-RULES.md يمنع حذف
 * تاريخ المعاملات المالية من الواجهة.
 */
export function archive(collection, id) {
  return update(collection, id, { status: "archived", archivedAt: new Date().toISOString() });
}

/** يُعيد عدّ السجلات المطابقة — لبطاقات المؤشرات. */
export function count(collection, predicate) {
  const rows = all(collection);
  return predicate ? rows.filter(predicate).length : rows.length;
}

/** يجمع حقلاً رقميًا — للمجاميع المالية. */
export function sum(collection, field, predicate) {
  return all(collection)
    .filter(predicate ?? (() => true))
    .reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

/** الكائنات المفردة — إعدادات لا مجموعات. */
export function singleton(key) {
  return db[key];
}

export function updateSingleton(key, patch) {
  db[key] = { ...db[key], ...patch };
  return db[key];
}
