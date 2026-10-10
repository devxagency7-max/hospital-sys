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
import {
  summarizePatientAccount,
  buildInvoiceTimeline,
  totalInvoiced,
  totalCollected,
  totalOutstanding,
  inventoryValuation,
  isOverdue,
} from "../domain/billing.js";

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
    const patientCreditNotes = where("creditNotes", (row) => invoiceIds.has(row.invoiceId));

    // كل الحساب في وحدة المجال — لا رياضيات مالية في طبقة الـ API.
    const { invoices: settled, summary } = summarizePatientAccount({
      invoices: patientInvoices,
      payments: patientPayments,
      refunds: patientRefunds,
      creditNotes: patientCreditNotes,
    });

    return {
      data: {
        patient,
        invoices: settled,
        payments: patientPayments,
        refunds: patientRefunds,
        creditNotes: patientCreditNotes,
        summary,
      },
    };
  },

  /* ========================= الفواتير ========================= */

  "GET /invoices": ({ params }) => query("invoices", params),

  "GET /invoices/:id": ({ params }) => {
    const invoice = find("invoices", params.id);
    if (!invoice) throw notFound("الفاتورة غير موجودة.");

    const lines = where("invoiceLines", (row) => String(row.invoiceId) === String(params.id));
    const invoicePayments = where("payments", (row) => String(row.invoiceId) === String(params.id));
    const invoiceRefunds = where("refunds", (row) => String(row.invoiceId) === String(params.id));
    const invoiceCreditNotes = where("creditNotes", (row) => String(row.invoiceId) === String(params.id));

    return {
      data: {
        ...invoice,
        lines,
        payments: invoicePayments,
        refunds: invoiceRefunds,
        creditNotes: invoiceCreditNotes,
        /** للتدقيق — عرض مُشتَق لا سجل مُخزَّن، راجع buildInvoiceTimeline. */
        timeline: buildInvoiceTimeline(invoice, {
          payments: invoicePayments,
          refunds: invoiceRefunds,
          creditNotes: invoiceCreditNotes,
        }),
      },
    };
  },

  "GET /payments": ({ params }) => query("payments", params),
  "GET /refunds": ({ params }) => query("refunds", params),
  "GET /credit-notes": ({ params }) => query("creditNotes", params),

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
    const allInvoices = all("invoices");
    const itemRows = all("items");
    const allPayments = all("payments");
    const allRefunds = all("refunds");
    const allPatients = all("patients");

    const today = REFERENCE_DATE.toISOString().slice(0, 10);
    const monthPrefix = today.slice(0, 7);

    // دوال المجال تستبعد الملغاة بنفسها — لا نكرر الشرط في كل مجموع.
    const thisMonth = allInvoices.filter((row) => row.date.startsWith(monthPrefix));
    const invoiceRows = allInvoices.filter((row) => row.status !== "cancelled");

    const todaysInvoices = allInvoices.filter((row) => row.date === today);
    const todaysPayments = allPayments.filter((row) => row.date === today);
    const todaysRefunds = allRefunds.filter((row) => row.date === today);

    return {
      data: {
        asOf: REFERENCE_DATE.toISOString(),
        patients: {
          total: db.patients.length,
          active: db.patients.filter((row) => row.status === "active").length,
          newThisMonth: db.patients.filter((row) => row.registeredAt?.startsWith(monthPrefix)).length,
        },
        revenue: {
          invoicedThisMonth: totalInvoiced(thisMonth),
          // المحصَّل فعلًا = المدفوعات ناقص المرتجعات المعتمدة في نفس الشهر.
          collectedThisMonth: totalCollected({
            payments: allPayments.filter((row) => row.date.startsWith(monthPrefix)),
            refunds: allRefunds.filter((row) => row.date.startsWith(monthPrefix)),
          }),
          outstanding: totalOutstanding(allInvoices),
        },
        invoices: {
          total: invoiceRows.length,
          unpaid: invoiceRows.filter((row) => row.status === "unpaid").length,
          partiallyPaid: invoiceRows.filter((row) => row.status === "partially_paid").length,
          overdue: allInvoices.filter((row) => isOverdue(row, today)).length,
        },
        inventory: {
          items: itemRows.length,
          lowStock: itemRows.filter((row) => row.status === "low_stock").length,
          outOfStock: itemRows.filter((row) => row.status === "out_of_stock").length,
          valuation: inventoryValuation(itemRows),
        },
        approvals: {
          stockAdjustments: all("stockMovements").filter(
            (row) => row.type === "adjustment" && row.status === "pending",
          ).length,
          refunds: all("refunds").filter((row) => row.status === "pending").length,
          /** إشعارات الدائن تمر بنفس مسار المراجعة — بند منفصل لا جزء من المرتجعات. */
          creditNotes: all("creditNotes").filter((row) => row.status === "pending").length,
        },

        /**
         * نبض العمليات اليومي. «المحصَّل اليوم» لا «المفوتر اليوم» تحديدًا:
         * الفاتورة تُنشأ لحظة الخدمة لكن السداد يتوزّع على أيام تالية (تقسيط،
         * تحويل بنكي متأخر)، فالمبلغ الذي دخل الخزينة فعليًا اليوم أصدق مؤشرًا
         * على نشاط اليوم التشغيلي من قيمة فواتير رُفعَت اليوم وقد تُسدَّد لاحقًا.
         */
        today: {
          collected: totalCollected({ payments: todaysPayments, refunds: todaysRefunds }),
          invoicesIssued: todaysInvoices.filter((row) => row.status !== "cancelled").length,
          patientsVisited: allPatients.filter((row) => row.lastVisitAt === today).length,
          newPatients: allPatients.filter((row) => row.registeredAt === today).length,
        },

        /** سلسلة 14 يومًا للرسم البياني — مفوتر مقابل محصَّل، يومًا بيوم. */
        revenueTrend: buildRevenueTrend(allInvoices, allPayments, allRefunds, REFERENCE_DATE, 14),

        /** توزيع إيراد الشهر الحالي على الأقسام — الأقسام بلا نشاط لا تُعرض. */
        departments: buildDepartmentSummary(thisMonth),

        /**
         * الكادر الطبي الفعلي من سجل المستخدمين (/users) — الأدوار الإكلينيكية
         * المباشرة فقط (طبيب، صيدلي، فني مختبر، فني أشعة)، لا الإدارة أو
         * المحاسبة أو الاستقبال أو المخازن، فهذه أدوار دعم لا رعاية مباشرة.
         */
        workforce: {
          medicalStaff: all("users").filter(
            (row) =>
              ["doctor", "pharmacist", "lab_technician", "radiologist"].includes(row.role) &&
              row.status === "active",
          ).length,
          total: all("users").filter((row) => row.status === "active").length,
        },

        /**
         * العيادات المسجَّلة فعليًا في سجل العيادات (/settings/clinics) — لا
         * طول مصفوفة departments أعلاه، فتلك توزيع إيراد الشهر الحالي على
         * الأقسام (مقياس مختلف تمامًا، وعدد عناصرها يتغيّر مع نشاط الفواتير).
         */
        clinics: {
          total: all("clinics").length,
          active: all("clinics").filter((row) => row.status === "active").length,
        },

        /** آخر الحركات المالية — دفعات ومرتجعات، الأحدث أولًا. */
        recentActivity: buildRecentActivity(allPayments, allRefunds, allInvoices, 8),

        /** آخر المرضى المسجَّلين — الأحدث أولًا. */
        recentPatients: [...allPatients]
          .sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)))
          .slice(0, 6),
      },
    };
  },

  /* ========================= المحاسبة ========================= */

  "GET /accounting/accounts": ({ params }) => query("accounts", params),
  "POST /accounting/accounts": ({ body }) => {
    const id = (db.accounts.reduce((max, r) => Math.max(max, r.id), 100) ?? 100) + 1;
    const account = insert("accounts", {
      ...body,
      id,
      balance: 0,
      status: "active",
    });
    return { data: account };
  },

  "GET /accounting/journal": ({ params }) => query("journalEntries", params),
  "POST /accounting/journal": ({ body }) => {
    const id = (db.journalEntries.reduce((max, r) => Math.max(max, r.id), 100) ?? 100) + 1;
    const entry = insert("journalEntries", {
      ...body,
      id,
      entryNumber: `JV-2026-00${id}`,
      date: body.date || new Date().toISOString().slice(0, 10),
      status: body.status || "approved",
    });
    return { data: entry };
  },

  "GET /accounting/cash": ({ params }) => query("cashBoxes", params),
  "GET /accounting/banks": ({ params }) => query("bankAccounts", params),
  "GET /accounting/cost-centers": ({ params }) => query("costCenters", params),
  "GET /accounting/periods": ({ params }) => query("accountingPeriods", params),

  "GET /accounting/trial-balance": () => {
    const allAccounts = all("accounts").filter((a) => a.level === 4 || a.level === 3 && !all("accounts").some((sub) => sub.parentId === a.id));
    const rows = allAccounts.map((acc) => {
      const isDebit = acc.nature === "debit";
      const bal = Math.abs(acc.balance);
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        openingDebit: isDebit ? bal * 0.8 : 0,
        openingCredit: !isDebit ? bal * 0.8 : 0,
        periodDebit: isDebit ? bal * 0.2 : 0,
        periodCredit: !isDebit ? bal * 0.2 : 0,
        endingDebit: isDebit ? bal : 0,
        endingCredit: !isDebit ? bal : 0,
      };
    });
    const totals = rows.reduce(
      (acc, r) => ({
        openingDebit: acc.openingDebit + r.openingDebit,
        openingCredit: acc.openingCredit + r.openingCredit,
        periodDebit: acc.periodDebit + r.periodDebit,
        periodCredit: acc.periodCredit + r.periodCredit,
        endingDebit: acc.endingDebit + r.endingDebit,
        endingCredit: acc.endingCredit + r.endingCredit,
      }),
      { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, endingDebit: 0, endingCredit: 0 }
    );
    return { data: { rows, totals } };
  },

  /* ========================= المواعيد ========================= */

  "GET /appointments": ({ params }) => query("appointments", params),
  "GET /appointments/queue": ({ params }) => {
    const today = REFERENCE_DATE.toISOString().slice(0, 10);
    return query("appointments", {
      ...params,
      date: today,
      status: params.status || "waiting,confirmed",
    });
  },
  "POST /appointments": ({ body }) => {
    const id = (db.appointments.reduce((max, r) => Math.max(max, r.id), 1000) ?? 1000) + 1;
    const item = insert("appointments", {
      ...body,
      id,
      appointmentNumber: `APT-2026${id}`,
      status: body.status || "confirmed",
    });
    return { data: item };
  },
  "PUT /appointments/:id": ({ params, body }) => {
    const updated = update("appointments", params.id, body);
    if (!updated) throw notFound("الموعد غير موجود.");
    return { data: updated };
  },

  /* ========================= المشتريات ========================= */

  "GET /purchasing/requests": ({ params }) => query("purchaseRequests", params),
  "GET /purchasing/orders": ({ params }) => query("purchaseOrders", params),
  "GET /purchasing/invoices": ({ params }) => query("supplierInvoices", params),
  "GET /purchasing/suppliers": ({ params }) => query("suppliers", params),

  /* ========================= الصيدلية ========================= */

  "GET /pharmacy/prescriptions": ({ params }) => query("prescriptions", params),
  "POST /pharmacy/prescriptions/:id/dispense": ({ params }) => {
    const rx = update("prescriptions", params.id, {
      status: "dispensed",
      dispensedAt: new Date().toISOString(),
      dispensedBy: "صيدلي / مينا سمير",
    });
    if (!rx) throw notFound("الروشتة غير موجودة.");
    return { data: rx };
  },

  /* ========================= المختبر والأشعة ========================= */

  "GET /laboratory/requests": ({ params }) => query("labRequests", params),
  "PUT /laboratory/requests/:id": ({ params, body }) => {
    const updated = update("labRequests", params.id, body);
    if (!updated) throw notFound("طلب التحليل غير موجود.");
    return { data: updated };
  },

  "GET /radiology/requests": ({ params }) => query("radiologyRequests", params),
  "PUT /radiology/requests/:id": ({ params, body }) => {
    const updated = update("radiologyRequests", params.id, body);
    if (!updated) throw notFound("طلب الأشعة غير موجود.");
    return { data: updated };
  },

  /* ========================= المستخدمون وسجل التدقيق ========================= */

  "GET /users": ({ params }) => query("users", params),
  "POST /users": ({ body }) => {
    const id = (db.users.reduce((max, r) => Math.max(max, r.id), 10) ?? 10) + 1;
    const user = insert("users", {
      ...body,
      id,
      status: "active",
      lastLogin: "—",
    });
    return { data: user };
  },
  "GET /users/roles": () => ({ data: all("roles") }),
  "GET /audit": ({ params }) => query("auditLogs", params),

  /* ========================= الإعدادات ========================= */

  "GET /settings/hospital": () => ({ data: db.hospitalInfo }),
  "PUT /settings/hospital": ({ body }) => {
    db.hospitalInfo = { ...db.hospitalInfo, ...body };
    return { data: db.hospitalInfo };
  },
  "GET /settings/clinics": ({ params }) => query("clinics", params),
  "GET /settings/taxes": ({ params }) => query("taxes", params),

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
   مساعدات لوحة التحكم
   -------------------------------------------------------------------------- */

/** يبني سلسلة أيام متتالية بصيغة ISO تنتهي بـ `endDate`. */
function lastNDays(endDate, count) {
  return Array.from({ length: count }, (_unused, index) => {
    const date = new Date(endDate);
    date.setDate(date.getDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

/** سلسلة يومية: مفوتر الفواتير الصادرة مقابل ما حُصِّل فعليًا، لكل يوم على حدة. */
function buildRevenueTrend(invoices, payments, refunds, endDate, days) {
  return lastNDays(endDate, days).map((date) => ({
    date,
    invoiced: totalInvoiced(invoices.filter((row) => row.date === date)),
    collected: totalCollected({
      payments: payments.filter((row) => row.date === date),
      refunds: refunds.filter((row) => row.date === date),
    }),
  }));
}

/** إيراد الشهر الحالي مُوزَّعًا على الأقسام — الأقسام بلا فواتير تُستبعد. */
function buildDepartmentSummary(monthInvoices) {
  const byDepartment = new Map();

  for (const invoice of monthInvoices) {
    if (invoice.status === "cancelled" || !invoice.departmentId) continue;

    const entry = byDepartment.get(invoice.departmentId) ?? { invoices: [] };
    entry.invoices.push(invoice);
    byDepartment.set(invoice.departmentId, entry);
  }

  return [...byDepartment.entries()]
    .map(([departmentId, entry]) => {
      const department = find("departments", departmentId);
      return {
        departmentId,
        name: department?.name ?? "—",
        invoicesCount: entry.invoices.length,
        revenue: totalInvoiced(entry.invoices),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * آخر الحركات المالية — دفعات ومرتجعات مُدمَجة زمنيًا في سجل واحد.
 * اسم المريض يُستخرَج عبر الفاتورة المرتبطة (الدفعة لا تحمله مباشرة)
 * لتفادي الازدواج مع مجموعة المرضى — عقدة ربط واحدة لا اثنتان.
 */
function buildRecentActivity(payments, refunds, invoices, limit) {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const events = [
    ...payments.map((payment) => ({
      type: "payment",
      id: `payment-${payment.id}`,
      date: payment.date,
      amount: payment.amount,
      invoiceNumber: invoiceById.get(payment.invoiceId)?.invoiceNumber,
      patientName: invoiceById.get(payment.invoiceId)?.patientName,
    })),
    ...refunds
      .filter((refund) => refund.status === "approved")
      .map((refund) => ({
        type: "refund",
        id: `refund-${refund.id}`,
        date: refund.date,
        amount: refund.amount,
        invoiceNumber: refund.invoiceNumber,
        patientName: refund.patientName,
      })),
  ];

  return events.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit);
}

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
