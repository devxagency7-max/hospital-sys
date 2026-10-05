/**
 * موجّه الطلبات التجريبية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  جدول `ROUTES` أدناه هو عقد الـ endpoints الذي تتوقعه الواجهة.
 *  مطور الباك-إند: نفّذ هذه المسارات بنفس الأسماء والمعاملات، ثم اضبط
 *  API.mode = 'live' في js/core/config.js. لا تعديل في الشاشات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * قاعدة صارمة: أي مسار غير مسجَّل هنا يرمي NOT_IMPLEMENTED ولا يُعيد نجاحًا
 * وهميًا. فزر يبدو عاملاً وهو لا يفعل شيئًا أسوأ من زر يقول بصراحة إنه غير
 * منفَّذ (docs/07-FRONTEND-RULES.md).
 */

import { notImplemented, notFound, validationError } from "../core/errors.js";
import { db, query, find, all, insert, update, archive, where } from "../mock/db.js";
import { REFERENCE_DATE } from "../mock/seed.js";
import { deriveBatchStatus } from "../mock/inventory.mock.js";

const round2 = (value) => Math.round(value * 100) / 100;

/* --------------------------------------------------------------------------
   جدول المسارات
   المفتاح: "METHOD /path"، والمقاطع المتغيرة بصيغة :param
   -------------------------------------------------------------------------- */

const ROUTES = {
  /* ========================= المرضى ========================= */

  "GET /patients": ({ params }) => query("patients", params),

  "GET /patients/:id": ({ params }) => {
    const patient = find("patients", params.id);
    if (!patient) throw notFound("المريض غير موجود.");
    return { data: patient };
  },

  "POST /patients": ({ body }) => {
    const errors = {};
    if (!body?.name?.trim()) errors.name = "اسم المريض مطلوب.";
    if (!body?.phone?.trim()) errors.phone = "رقم الهاتف مطلوب.";
    if (Object.keys(errors).length) throw validationError(errors);

    const id = (db.patients.reduce((max, row) => Math.max(max, row.id), 1000) ?? 1000) + 1;

    const patient = insert("patients", {
      ...body,
      id,
      patientCode: `P-${id}`,
      status: body.status ?? "active",
      registeredAt: new Date().toISOString().slice(0, 10),
      visitsCount: 0,
      outstandingBalance: 0,
    });

    return { data: patient };
  },

  "PUT /patients/:id": ({ params, body }) => {
    const patient = update("patients", params.id, body);
    if (!patient) throw notFound("المريض غير موجود.");
    return { data: patient };
  },

  /** أرشفة لا حذف — سجل المريض مرتبط بمعاملات مالية. */
  "DELETE /patients/:id": ({ params }) => {
    const patient = archive("patients", params.id);
    if (!patient) throw notFound("المريض غير موجود.");
    return { data: patient };
  },

  /** كشف حساب المريض — المصدر الذي يبني منه التقرير أقسامه. */
  "GET /patients/:id/account": ({ params }) => {
    const patient = find("patients", params.id);
    if (!patient) throw notFound("المريض غير موجود.");

    const patientInvoices = where("invoices", (row) => String(row.patientId) === String(params.id));
    const invoiceIds = new Set(patientInvoices.map((invoice) => invoice.id));

    const patientPayments = where("payments", (row) => invoiceIds.has(row.invoiceId));
    const patientRefunds = where("refunds", (row) => invoiceIds.has(row.invoiceId));

    /**
     * الفواتير الملغاة تُعرض في الكشف للشفافية، لكنها لا تدخل أي مجموع مالي:
     * إدخالها في «إجمالي المفوتر» يُظهر على المريض مديونية لفاتورة أُلغيت أصلاً.
     */
    const effective = patientInvoices.filter((row) => row.status !== "cancelled");

    const totalInvoiced = round2(effective.reduce((total, row) => total + row.total, 0));
    const totalPaid = round2(patientPayments.reduce((total, row) => total + row.amount, 0));
    const totalRefunded = round2(
      patientRefunds
        .filter((row) => row.status === "approved")
        .reduce((total, row) => total + row.amount, 0),
    );

    return {
      data: {
        patient,
        invoices: patientInvoices,
        payments: patientPayments,
        refunds: patientRefunds,
        summary: {
          invoicesCount: effective.length,
          cancelledCount: patientInvoices.length - effective.length,
          totalInvoiced,
          totalDiscount: round2(effective.reduce((total, row) => total + row.discount, 0)),
          totalPaid,
          totalRefunded,
          remainingBalance: round2(totalInvoiced - totalPaid + totalRefunded),
        },
      },
    };
  },

  /* ========================= الفواتير ========================= */

  "GET /invoices": ({ params }) => query("invoices", params),

  "GET /invoices/:id": ({ params }) => {
    const invoice = find("invoices", params.id);
    if (!invoice) throw notFound("الفاتورة غير موجودة.");

    return {
      data: {
        ...invoice,
        lines: where("invoiceLines", (row) => String(row.invoiceId) === String(params.id)),
        payments: where("payments", (row) => String(row.invoiceId) === String(params.id)),
      },
    };
  },

  "GET /payments": ({ params }) => query("payments", params),
  "GET /refunds": ({ params }) => query("refunds", params),

  /** الأرصدة المستحقة — فواتير لم تُسدَّد كاملة. */
  "GET /billing/outstanding": ({ params }) =>
    query("invoices", {
      ...params,
      status: params.status ?? "unpaid,partially_paid",
      sort: params.sort ?? "dueDate",
      order: params.order ?? "asc",
    }),

  /* ========================= المخزون ========================= */

  "GET /inventory/items": ({ params }) => query("items", params),

  "GET /inventory/items/:id": ({ params }) => {
    const item = find("items", params.id);
    if (!item) throw notFound("الصنف غير موجود.");

    return {
      data: {
        ...item,
        batches: where("batches", (row) => String(row.itemId) === String(params.id)),
      },
    };
  },

  "GET /inventory/batches": ({ params }) => query("batches", params),
  "GET /inventory/movements": ({ params }) => query("stockMovements", params),

  /** تنبيهات المخزون — تغذّي لوحة التحكم. */
  "GET /inventory/alerts": () => {
    const itemRows = all("items");
    const batchRows = all("batches");

    return {
      data: {
        lowStock: itemRows.filter((item) => item.status === "low_stock"),
        outOfStock: itemRows.filter((item) => item.status === "out_of_stock"),
        expired: batchRows.filter((batch) => deriveBatchStatus(batch, REFERENCE_DATE) === "expired"),
        nearExpiry: batchRows.filter(
          (batch) => deriveBatchStatus(batch, REFERENCE_DATE) === "near_expiry",
        ),
      },
    };
  },

  /* ===================== قوائم مرجعية (للقوائم المنسدلة) ===================== */

  "GET /lookups/departments": () => ({ data: all("departments") }),
  "GET /lookups/doctors": () => ({ data: all("doctors") }),
  "GET /lookups/services": () => ({ data: all("services") }),
  "GET /lookups/warehouses": () => ({ data: all("warehouses") }),
  "GET /lookups/suppliers": () => ({ data: all("suppliers") }),
  "GET /lookups/categories": () => ({ data: all("itemCategories") }),
  "GET /lookups/units": () => ({ data: all("units") }),
  "GET /lookups/payment-methods": () => ({ data: all("paymentMethods") }),
  "GET /lookups/governorates": () => ({ data: all("governorates") }),

  /* ========================= لوحة التحكم ========================= */

  "GET /dashboard/summary": () => {
    const invoiceRows = all("invoices").filter((row) => row.status !== "cancelled");
    const itemRows = all("items");

    const today = REFERENCE_DATE.toISOString().slice(0, 10);
    const monthPrefix = today.slice(0, 7);

    return {
      data: {
        asOf: REFERENCE_DATE.toISOString(),
        patients: {
          total: db.patients.length,
          active: db.patients.filter((row) => row.status === "active").length,
          newThisMonth: db.patients.filter((row) => row.registeredAt?.startsWith(monthPrefix)).length,
        },
        revenue: {
          invoicedThisMonth: round2(
            invoiceRows
              .filter((row) => row.date.startsWith(monthPrefix))
              .reduce((total, row) => total + row.total, 0),
          ),
          collectedThisMonth: round2(
            all("payments")
              .filter((row) => row.date.startsWith(monthPrefix))
              .reduce((total, row) => total + row.amount, 0),
          ),
          outstanding: round2(invoiceRows.reduce((total, row) => total + row.remaining, 0)),
        },
        invoices: {
          total: invoiceRows.length,
          unpaid: invoiceRows.filter((row) => row.status === "unpaid").length,
          partiallyPaid: invoiceRows.filter((row) => row.status === "partially_paid").length,
          overdue: invoiceRows.filter((row) => row.remaining > 0 && row.dueDate < today).length,
        },
        inventory: {
          items: itemRows.length,
          lowStock: itemRows.filter((row) => row.status === "low_stock").length,
          outOfStock: itemRows.filter((row) => row.status === "out_of_stock").length,
          valuation: round2(
            itemRows.reduce((total, row) => total + row.quantity * row.costPrice, 0),
          ),
        },
        approvals: {
          stockAdjustments: all("stockMovements").filter(
            (row) => row.type === "adjustment" && row.status === "pending",
          ).length,
          refunds: all("refunds").filter((row) => row.status === "pending").length,
        },
      },
    };
  },

  /* ========================= الجلسة ========================= */

  /** نائب عن المصادقة — تُنفَّذ فعليًا في Phase 7. */
  "GET /auth/me": () => ({
    data: {
      id: 1,
      name: "عبدالله محمد",
      role: "admin",
      jobTitle: "مدير النظام",
    },
  }),
};

/* --------------------------------------------------------------------------
   المطابقة والتوجيه
   -------------------------------------------------------------------------- */

/** يُجمَّع مرة واحدة عند التحميل لا عند كل طلب. */
const COMPILED = Object.entries(ROUTES).map(([key, handler]) => {
  const [method, pattern] = key.split(" ");
  const keys = [];

  const source = pattern.replace(/\/:(\w+)/g, (_match, name) => {
    keys.push(name);
    return "/([^/]+)";
  });

  return { method, pattern, regex: new RegExp(`^${source}$`), keys, handler };
});

/** قائمة المسارات المنفَّذة — تظهر في صفحة نظام التصميم وتفيد التوثيق. */
export function registeredEndpoints() {
  return COMPILED.map(({ method, pattern }) => `${method} ${pattern}`).sort();
}

/**
 * ينفّذ طلبًا تجريبيًا.
 * يُستدعى من js/api/http.js فقط — لا تستدعه من شاشة.
 */
export function dispatchMock({ method, path, params, body }) {
  for (const route of COMPILED) {
    if (route.method !== method) continue;

    const result = route.regex.exec(path);
    if (!result) continue;

    const pathParams = {};
    route.keys.forEach((key, index) => {
      pathParams[key] = decodeURIComponent(result[index + 1]);
    });

    return route.handler({ params: { ...params, ...pathParams }, body, query: params });
  }

  throw notImplemented(`${method} ${path}`);
}
