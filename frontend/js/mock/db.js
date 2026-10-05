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
import { patients } from "./patients.mock.js";
import { invoices, invoiceLines, payments, refunds, creditNotes } from "./invoices.mock.js";
import {
  items,
  batches,
  stockMovements,
  itemCategories,
  units,
  warehouses,
  suppliers,
  deriveItemStatus,
  deriveBatchStatus,
} from "./inventory.mock.js";
import {
  DEPARTMENTS,
  DOCTORS,
  SERVICES,
  PAYMENT_METHODS,
  GOVERNORATES,
} from "./seed.js";

/**
 * المجموعات. نُنسخ المصفوفات حتى لا تُعدّل ملفات البيانات الأصلية في مكانها،
 * فتبقى إعادة التهيئة ممكنة.
 */
export const db = {
  patients: [...patients],
  invoices: [...invoices],
  invoiceLines: [...invoiceLines],
  payments: [...payments],
  refunds: [...refunds],
  creditNotes: [...creditNotes],
  items: [...items],
  batches: [...batches],
  stockMovements: [...stockMovements],
  itemCategories: [...itemCategories],
  units: [...units],
  warehouses: [...warehouses],
  suppliers: [...suppliers],
  departments: [...DEPARTMENTS],
  doctors: [...DOCTORS],
  services: [...SERVICES],
  paymentMethods: [...PAYMENT_METHODS],
  governorates: GOVERNORATES.map((name, index) => ({ id: index + 1, name })),
};

/* --------------------------------------------------------------------------
   الحقول المشتقة
   تُحسب عند القراءة لا تُخزَّن، وإلا تناقضت مع الكمية بعد أي حركة مخزنية.
   -------------------------------------------------------------------------- */

const DERIVE = {
  items: (item) => ({ ...item, status: deriveItemStatus(item) }),
  batches: (batch) => ({ ...batch, status: deriveBatchStatus(batch) }),
};

function project(collection, row) {
  return DERIVE[collection] ? DERIVE[collection](row) : row;
}

/* --------------------------------------------------------------------------
   محرك الاستعلام
   -------------------------------------------------------------------------- */

/** الحقول القابلة للبحث الحر لكل مجموعة. */
const SEARCHABLE = {
  patients: ["name", "patientCode", "phone", "nationalId", "governorate"],
  invoices: ["invoiceNumber", "patientName", "patientCode", "doctorName"],
  payments: ["reference"],
  refunds: ["refundNumber", "invoiceNumber", "patientName", "reason"],
  creditNotes: ["creditNoteNumber", "invoiceNumber", "patientName", "reason"],
  items: ["name", "code", "category"],
  batches: ["batchNumber", "itemName", "itemCode"],
  stockMovements: ["reference", "itemName", "itemCode", "performedBy"],
  suppliers: ["name", "code", "phone"],
  doctors: ["name", "title"],
  services: ["name", "code", "category"],
};

/** حقل التاريخ الذي يستهدفه فلتر `dateFrom` / `dateTo` لكل مجموعة. */
const DATE_FIELD = {
  patients: "registeredAt",
  invoices: "date",
  payments: "date",
  refunds: "date",
  creditNotes: "date",
  batches: "expiryDate",
  stockMovements: "date",
};

/** معاملات لا تُعامل كفلاتر على الحقول. */
const RESERVED = new Set(["page", "perPage", "search", "sort", "order", "dateFrom", "dateTo"]);

/**
 * يطبّق البحث والفلترة والترتيب والترقيم على مجموعة.
 *
 * @returns {{ data: object[], meta: { page:number, perPage:number, total:number, totalPages:number } }}
 */
export function query(collection, params = {}) {
  const rows = db[collection];
  if (!rows) throw new Error(`مجموعة غير معروفة: ${collection}`);

  let result = rows.map((row) => project(collection, row));

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
  const row = db[collection]?.find((item) => String(item.id) === String(id));
  return row ? project(collection, row) : undefined;
}

/** يُعيد كل السجلات المطابقة لمُرشِّح — للقوائم المرجعية والتجميعات. */
export function where(collection, predicate) {
  return (db[collection] ?? []).filter(predicate).map((row) => project(collection, row));
}

/** يُعيد كل السجلات دون ترقيم — للقوائم المنسدلة فقط. */
export function all(collection) {
  return (db[collection] ?? []).map((row) => project(collection, row));
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
  return project(collection, row);
}

export function update(collection, id, patch) {
  const rows = db[collection];
  if (!rows) throw new Error(`مجموعة غير معروفة: ${collection}`);

  const index = rows.findIndex((row) => String(row.id) === String(id));
  if (index === -1) return undefined;

  rows[index] = { ...rows[index], ...patch, id: rows[index].id };
  return project(collection, rows[index]);
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
