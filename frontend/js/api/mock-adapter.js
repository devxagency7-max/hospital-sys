/**
 * موجّه الطلبات التجريبية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  جدول `ROUTES` أدناه هو عقد الـ endpoints الذي تتوقعه الواجهة.
 *  مطور الباك-إند: نفّذ هذه المسارات بنفس الأسماء والمعاملات، ثم اضبط
 *  API.mode = 'live' في js/core/config.js. لا تعديل في الشاشات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * منطق العمل كله في `js/mock/services/*` — وهي محاكاة لطبقة خدمات الباك-إند
 * ومواصفتها في الوقت نفسه. هذا الملف توجيه ومعاملات فقط، بلا حساب ولا قرار.
 *
 * قاعدة صارمة: أي مسار غير مسجَّل هنا يرمي NOT_IMPLEMENTED ولا يُعيد نجاحًا
 * وهميًا. فزر يبدو عاملاً وهو لا يفعل شيئًا أسوأ من زر يقول بصراحة إنه غير
 * منفَّذ (docs/07-FRONTEND-RULES.md).
 */

import { notImplemented, notFound } from "../core/errors.js";
import { db, query, find, all, insert, update, where, singleton, updateSingleton } from "../mock/db.js";

/* كتالوج الصلاحيات وأسماء مفاتيح الربط — تُقرأ من مصدرها ولا تُكرَّر هنا. */
import { currentUser, PERMISSIONS as PERMISSION_LABELS } from "../core/permissions.js";
import { MAP_KEYS as MAP_LABELS } from "../domain/posting-rules.js";

import * as posting from "../mock/services/posting.service.js";
import * as accounting from "../mock/services/accounting.service.js";
import * as finance from "../mock/services/finance.service.js";
import * as hr from "../mock/services/hr.service.js";
import * as inventory from "../mock/services/inventory.service.js";
import * as dashboard from "../mock/services/dashboard.service.js";
import * as patients from "../mock/services/patients.service.js";

/** المستخدم الحالي — يُمرَّر لكل عملية كتابة لتوثيقها في سجل التدقيق. */
const actor = () => ({ user: currentUser() });

/* --------------------------------------------------------------------------
   جدول المسارات
   المفتاح: "METHOD /path"، والمقاطع المتغيرة بصيغة :param
   -------------------------------------------------------------------------- */

const ROUTES = {
  /* ======================================================================
     لوحة التحكم
     ====================================================================== */

  "GET /dashboard/summary": () => ({ data: dashboard.getSummary() }),

  /* ======================================================================
     1. المحاسبة العامة
     ====================================================================== */

  /* --- دليل الحسابات --- */
  "GET /gl/accounts": ({ params }) => query("accounts", params),
  "GET /gl/accounts/tree": ({ params }) => ({ data: accounting.accountsTree(params) }),
  "GET /gl/accounts/postable": () => ({ data: accounting.postableAccounts() }),
  "GET /gl/accounts/:id": ({ params }) => {
    const account = find("accounts", params.id);
    if (!account) throw notFound("الحساب غير موجود.");
    return { data: account };
  },
  "POST /gl/accounts": ({ body }) => ({ data: accounting.createAccount(body, actor()) }),
  "PUT /gl/accounts/:id": ({ params, body }) => ({
    data: accounting.updateAccount(params.id, body, actor()),
  }),

  /* --- قيود اليومية --- */
  "GET /gl/journal": ({ params }) => accounting.listJournalEntries(params),
  "GET /gl/journal/:id": ({ params }) => ({ data: accounting.getJournalEntry(params.id) }),
  "POST /gl/journal": ({ body }) => ({
    data: posting.createManualEntry(body, { ...actor(), submit: body?.submit === true }),
  }),
  "POST /gl/journal/:id/submit": ({ params }) => ({
    data: posting.submitJournalEntry(params.id, actor()),
  }),
  "POST /gl/journal/:id/approve": ({ params }) => ({
    data: posting.approveJournalEntry(params.id, actor()),
  }),
  "POST /gl/journal/:id/post": ({ params }) => ({
    data: posting.postJournalEntry(params.id, actor()),
  }),
  "POST /gl/journal/:id/reverse": ({ params, body }) => ({
    data: posting.reverseJournalEntry(params.id, { ...body, ...actor() }),
  }),

  /* --- دفتر الأستاذ العام --- */
  "GET /gl/ledger": ({ params }) => ({ data: accounting.generalLedger(params) }),

  /* --- ميزان المراجعة --- */
  "GET /gl/trial-balance": ({ params }) => ({ data: accounting.getTrialBalance(params) }),

  /* --- الفترات والسنوات المالية --- */
  "GET /gl/fiscal-years": ({ params }) => query("fiscalYears", params),
  "GET /gl/periods": ({ params }) => accounting.listPeriods(params),
  "POST /gl/periods/:id/close": ({ params }) => ({
    data: accounting.closePeriod(params.id, actor()),
  }),
  "POST /gl/periods/:id/reopen": ({ params, body }) => ({
    data: accounting.reopenPeriod(params.id, { ...body, ...actor() }),
  }),
  "GET /gl/fiscal-years/:id/closing-preview": ({ params }) => ({
    data: accounting.previewYearClosing(params.id),
  }),

  /* --- مراكز التكلفة --- */
  "GET /gl/cost-centers": ({ params }) => query("costCenters", params),
  "GET /gl/cost-centers/analysis": ({ params }) => ({
    data: accounting.getCostCenterAnalysis(params),
  }),

  /* ======================================================================
     2. المحاسبة المالية
     ====================================================================== */

  /* --- العملاء --- */
  "GET /fin/customers": ({ params }) => finance.listCustomers(params),
  "GET /fin/customers/:id": ({ params }) => {
    const customer = find("customers", params.id);
    if (!customer) throw notFound("العميل غير موجود.");
    return { data: customer };
  },
  "GET /fin/customers/:id/account": ({ params }) => ({
    data: finance.getCustomerAccount(params.id),
  }),
  "POST /fin/customers": ({ body }) => ({ data: insert("customers", { ...body, status: "active" }) }),
  "PUT /fin/customers/:id": ({ params, body }) => {
    const next = update("customers", params.id, body);
    if (!next) throw notFound("العميل غير موجود.");
    return { data: next };
  },

  /* --- فواتير العملاء --- */
  "GET /fin/customer-invoices": ({ params }) => query("customerInvoices", params),
  "GET /fin/customer-invoices/:id": ({ params }) => ({
    data: finance.getCustomerInvoice(params.id),
  }),
  "POST /fin/customer-invoices": ({ body }) => ({
    data: finance.createCustomerInvoice(body, actor()),
  }),

  /* --- التحصيلات --- */
  "GET /fin/receipts": ({ params }) => query("customerReceipts", params),
  "POST /fin/receipts": ({ body }) => ({ data: finance.createCustomerReceipt(body, actor()) }),

  /* --- إشعارات الدائن --- */
  "GET /fin/credit-notes": ({ params }) => query("customerCreditNotes", params),
  "POST /fin/credit-notes/:id/approve": ({ params }) => ({
    data: finance.approveCreditNote(params.id, actor()),
  }),

  /* --- الموردون --- */
  "GET /fin/suppliers": ({ params }) => finance.listSuppliers(params),
  "GET /fin/suppliers/:id": ({ params }) => {
    const supplier = find("suppliers", params.id);
    if (!supplier) throw notFound("المورد غير موجود.");
    return { data: supplier };
  },
  "GET /fin/suppliers/:id/account": ({ params }) => ({
    data: finance.getSupplierAccount(params.id),
  }),
  "POST /fin/suppliers": ({ body }) => ({ data: insert("suppliers", { ...body, status: "active" }) }),
  "PUT /fin/suppliers/:id": ({ params, body }) => {
    const next = update("suppliers", params.id, body);
    if (!next) throw notFound("المورد غير موجود.");
    return { data: next };
  },

  /* --- فواتير الموردين ومدفوعاتهم --- */
  "GET /fin/supplier-invoices": ({ params }) => query("supplierInvoices", params),
  "GET /fin/supplier-invoices/:id": ({ params }) => ({
    data: finance.getSupplierInvoice(params.id),
  }),
  "GET /fin/supplier-payments": ({ params }) => query("supplierPayments", params),
  "POST /fin/supplier-payments": ({ body }) => ({
    data: finance.createSupplierPayment(body, actor()),
  }),

  /* --- التقادم --- */
  "GET /fin/receivables/aging": ({ params }) => ({ data: finance.receivablesAging(params) }),
  "GET /fin/payables/aging": ({ params }) => ({ data: finance.payablesAging(params) }),

  /* --- الخزينة --- */
  "GET /fin/cash-boxes": ({ params }) => finance.listCashBoxes(params),
  "GET /fin/cash-boxes/:id": ({ params }) => {
    const box = find("cashBoxes", params.id);
    if (!box) throw notFound("الخزينة غير موجودة.");
    return {
      data: {
        ...box,
        movements: where("cashMovements", (row) => String(row.cashBoxId) === String(box.id)),
        reconciliations: where("cashReconciliations", (row) => String(row.cashBoxId) === String(box.id)),
      },
    };
  },
  "GET /fin/cash-movements": ({ params }) => query("cashMovements", params),
  "POST /fin/cash-movements": ({ body }) => ({ data: finance.createCashVoucher(body, actor()) }),
  "GET /fin/cash-reconciliations": ({ params }) => query("cashReconciliations", params),

  /* --- التحويلات بين الخزائن والبنوك --- */
  "POST /fin/transfers": ({ body }) => ({ data: finance.createTransfer(body, actor()) }),

  /* --- البنوك --- */
  "GET /fin/bank-accounts": ({ params }) => finance.listBankAccounts(params),
  "GET /fin/bank-accounts/:id": ({ params }) => {
    const bank = find("bankAccounts", params.id);
    if (!bank) throw notFound("الحساب البنكي غير موجود.");
    return {
      data: {
        ...bank,
        transactions: where("bankTransactions", (row) => String(row.bankAccountId) === String(bank.id)),
      },
    };
  },
  "GET /fin/bank-transactions": ({ params }) => query("bankTransactions", params),
  "GET /fin/bank-reconciliations": ({ params }) => query("bankReconciliations", params),
  "POST /fin/bank-reconciliations": ({ body }) => ({ data: finance.reconcileBank(body, actor()) }),

  /* --- الأصول الثابتة --- */
  "GET /fin/assets": ({ params }) => finance.listAssets(params),
  "GET /fin/assets/register": () => ({ data: finance.getAssetRegister() }),
  "GET /fin/assets/:id": ({ params }) => ({ data: finance.getAsset(params.id) }),
  "GET /fin/asset-categories": ({ params }) => query("assetCategories", params),
  "POST /fin/assets/:id/dispose": ({ params, body }) => ({
    data: finance.disposeAsset(params.id, body, actor()),
  }),

  /* --- الإهلاك --- */
  "GET /fin/depreciation/runs": ({ params }) => query("depreciationRuns", params),
  "GET /fin/depreciation/preview": ({ params }) => ({ data: finance.previewDepreciation(params) }),
  "POST /fin/depreciation/run": ({ body }) => ({ data: finance.processDepreciation(body, actor()) }),

  /* --- الضرائب --- */
  "GET /fin/taxes": ({ params }) => query("taxes", params),
  "GET /fin/tax-returns": ({ params }) => query("taxReturns", params),
  "POST /fin/taxes": ({ body }) => ({ data: insert("taxes", { ...body, status: "active" }) }),
  "PUT /fin/taxes/:id": ({ params, body }) => {
    const next = update("taxes", params.id, body);
    if (!next) throw notFound("الضريبة غير موجودة.");
    return { data: next };
  },

  /* --- القوائم المالية --- */
  "GET /fin/statements/income": ({ params }) => ({ data: accounting.getIncomeStatement(params) }),
  "GET /fin/statements/balance-sheet": ({ params }) => ({ data: accounting.getBalanceSheet(params) }),
  "GET /fin/statements/cash-flow": ({ params }) => ({ data: accounting.getCashFlow(params) }),

  /* --- المطابقة مع الحسابات الرقابية --- */
  "GET /fin/reconciliation-summary": () => ({ data: finance.reconciliationSummary() }),

  /* ======================================================================
     حسابات المرضى والخدمات الطبية
     ====================================================================== */

  "GET /patients": ({ params }) => patients.listPatients(params),
  "GET /patients/stats": () => ({ data: patients.getPatientStats() }),
  "GET /patients/insurance-providers": () => ({ data: all("insuranceProviders") }),
  "GET /patients/:id": ({ params }) => ({ data: patients.getPatient(params.id) }),
  "POST /patients": ({ body }) => ({ data: patients.createPatient(body, actor()) }),
  "PUT /patients/:id": ({ params, body }) => ({ data: patients.updatePatient(params.id, body, actor()) }),
  "GET /patients/:id/statement": ({ params }) => ({ data: patients.getPatientStatement(params.id) }),

  /* --- دليل الخدمات الطبية --- */
  "GET /patients/services/list": ({ params }) => patients.listServices(params),
  "GET /patients/services/:id": ({ params }) => ({ data: patients.getService(params.id) }),
  "POST /patients/services": ({ body }) => ({ data: patients.createService(body, actor()) }),

  /* --- الإقامة والعمليات والعناية المركزة --- */
  "GET /patients/admissions/list": ({ params }) => patients.listAdmissions(params),
  "GET /patients/admissions/:id": ({ params }) => ({ data: patients.getAdmission(params.id) }),
  "POST /patients/admissions": ({ body }) => ({ data: patients.createAdmission(body, actor()) }),
  "POST /patients/admissions/:id/discharge": ({ params, body }) => ({ data: patients.dischargeAdmission(params.id, body, actor()) }),

  /* --- فواتير المرضى --- */
  "GET /patients/invoices/list": ({ params }) => patients.listPatientInvoices(params),
  "GET /patients/invoices/:id": ({ params }) => ({ data: patients.getPatientInvoice(params.id) }),
  "POST /patients/invoices": ({ body }) => ({ data: patients.createPatientInvoice(body, actor()) }),

  /* --- سندات القبض والدفعات --- */
  "GET /patients/receipts/list": ({ params }) => patients.listPatientReceipts(params),
  "POST /patients/receipts": ({ body }) => ({ data: patients.createPatientReceipt(body, actor()) }),

  /* ======================================================================
     الاستقبال واستعلام المرضى
     ====================================================================== */
  "GET /reception/patients": ({ params }) => patients.listPatients(params),
  "GET /reception/patients/:id/summary": ({ params }) => ({ data: patients.getReceptionPatientSummary(params.id) }),
  "GET /reception/receipts": ({ params }) => patients.listPatientReceipts(params),
  "POST /reception/receipts": ({ body }) => ({ data: patients.createPatientReceipt(body, actor()) }),

  /* ======================================================================
     3. الموارد البشرية
     ====================================================================== */

  /* --- الموظفون --- */
  "GET /hr/employees": ({ params }) => hr.listEmployees(params),
  "GET /hr/employees/:id": ({ params }) => ({ data: hr.getEmployee(params.id) }),
  "POST /hr/employees": ({ body }) => ({
    data: insert("employees", { ...body, status: body?.status ?? "probation" }),
  }),
  "PUT /hr/employees/:id": ({ params, body }) => {
    const next = update("employees", params.id, body);
    if (!next) throw notFound("الموظف غير موجود.");
    return { data: next };
  },

  /* --- الهيكل التنظيمي --- */
  "GET /hr/departments": ({ params }) => query("departments", params),
  "GET /hr/positions": ({ params }) => query("positions", params),
  "GET /hr/shifts": ({ params }) => query("shifts", params),
  "GET /hr/org-chart": () => ({ data: hr.organizationChart() }),

  /* --- الحضور --- */
  "GET /hr/attendance": ({ params }) => query("attendanceRecords", params),
  "GET /hr/attendance/report": ({ params }) => ({ data: hr.getAttendanceReport(params) }),
  "PUT /hr/attendance/:id": ({ params, body }) => ({
    data: hr.correctAttendance(params.id, body, actor()),
  }),
  "GET /hr/holidays": ({ params }) => query("holidays", params),

  /* --- الإجازات --- */
  "GET /hr/leave-types": () => ({ data: all("leaveTypes") }),
  "GET /hr/leave-requests": ({ params }) => hr.listLeaveRequests(params),
  "POST /hr/leave-requests": ({ body }) => ({ data: hr.createLeaveRequest(body, actor()) }),
  "POST /hr/leave-requests/:id/approve": ({ params }) => ({
    data: hr.approveLeaveRequest(params.id, actor()),
  }),
  "POST /hr/leave-requests/:id/reject": ({ params, body }) => ({
    data: hr.rejectLeaveRequest(params.id, { ...body, ...actor() }),
  }),
  "GET /hr/leave-balances": ({ params }) => ({ data: hr.leaveBalancesReport(params) }),

  /* --- السلف --- */
  "GET /hr/advances": ({ params }) => query("employeeAdvances", params),
  "POST /hr/advances": ({ body }) => ({ data: hr.createAdvance(body, actor()) }),

  /* --- الرواتب --- */
  "GET /hr/payroll/runs": ({ params }) => hr.listPayrollRuns(params),
  "GET /hr/payroll/runs/:id": ({ params }) => ({ data: hr.getPayrollRun(params.id) }),
  "POST /hr/payroll/process": ({ body }) => ({ data: hr.processPayroll(body, actor()) }),
  "POST /hr/payroll/runs/:id/approve": ({ params }) => ({
    data: hr.approvePayroll(params.id, actor()),
  }),
  "POST /hr/payroll/runs/:id/pay": ({ params, body }) => ({
    data: hr.payPayroll(params.id, body, actor()),
  }),
  "GET /hr/payslips": ({ params }) => query("payslips", params),
  "GET /hr/payslips/:id": ({ params }) => ({ data: hr.getPayslip(params.id) }),
  "GET /hr/payroll/settings": () => ({ data: singleton("payrollSettings") }),
  "PUT /hr/payroll/settings": ({ body }) => ({ data: updateSingleton("payrollSettings", body) }),

  /* ======================================================================
     4. المخازن
     ====================================================================== */

  /* --- الأصناف --- */
  "GET /inv/items": ({ params }) => inventory.listItems(params),
  "GET /inv/items/:id": ({ params }) => ({ data: inventory.getItem(params.id) }),
  "POST /inv/items": ({ body }) => ({ data: insert("items", { ...body, status: "active" }) }),
  "PUT /inv/items/:id": ({ params, body }) => {
    const next = update("items", params.id, body);
    if (!next) throw notFound("الصنف غير موجود.");
    return { data: next };
  },
  "GET /inv/categories": ({ params }) => query("itemCategories", params),
  "GET /inv/units": ({ params }) => query("units", params),

  /* --- المخازن --- */
  "GET /inv/warehouses": ({ params }) => query("warehouses", params),
  "GET /inv/warehouses/:id": ({ params }) => {
    const warehouse = find("warehouses", params.id);
    if (!warehouse) throw notFound("المخزن غير موجود.");
    return {
      data: {
        ...warehouse,
        balances: where("stockBalances", (row) => String(row.warehouseId) === String(warehouse.id)),
      },
    };
  },

  /* --- الأرصدة والحركات --- */
  "GET /inv/balances": ({ params }) => inventory.listBalances(params),
  "GET /inv/balance": ({ params }) => ({
    data: inventory.currentBalance(params.itemId, params.warehouseId),
  }),
  "GET /inv/movements": ({ params }) => inventory.listMovements(params),
  "GET /inv/movements/history": ({ params }) => ({
    data: inventory.itemMovementHistory(params),
  }),

  "POST /inv/receipts": ({ body }) => ({ data: inventory.createReceipt(body, actor()) }),
  "POST /inv/issues": ({ body }) => ({ data: inventory.createIssue(body, actor()) }),
  "POST /inv/transfers": ({ body }) => ({ data: inventory.createTransfer(body, actor()) }),
  "POST /inv/adjustments": ({ body }) => ({ data: inventory.createAdjustment(body, actor()) }),
  "POST /inv/adjustments/:id/approve": ({ params }) => ({
    data: inventory.approveAdjustment(params.id, actor()),
  }),

  /* --- التشغيلات والصلاحية --- */
  "GET /inv/batches": ({ params }) => query("batches", params),
  "GET /inv/expiry": ({ params }) => ({ data: inventory.getExpiryReport(params) }),

  /* --- التقييم --- */
  "GET /inv/valuation": ({ params }) => ({ data: inventory.getValuation(params) }),
  "GET /inv/valuation/compare": ({ params }) => ({
    data: inventory.compareCostingMethods(params),
  }),
  "GET /inv/low-stock": () => ({ data: inventory.lowStockReport() }),
  "GET /inv/alerts": () => ({ data: inventory.getAlerts() }),

  /* --- الجرد الفعلي --- */
  "GET /inv/counts": ({ params }) => query("stockCounts", params),
  "GET /inv/counts/:id": ({ params }) => ({ data: inventory.getStockCount(params.id) }),
  "POST /inv/counts/:id/start": ({ params }) => ({
    data: inventory.startStockCount(params.id, actor()),
  }),
  "POST /inv/counts/:id/close": ({ params, body }) => ({
    data: inventory.closeStockCount(params.id, body, actor()),
  }),

  /* --- مراجعة وتحديث أسعار البيع (خاص بمدير الحسابات والمحاسب) --- */
  "GET /inv/price-reviews": ({ params }) => inventory.listPriceReviews(params),
  "GET /inv/price-reviews/:id": ({ params }) => ({ data: inventory.getPriceReview(params.id) }),
  "POST /inv/price-reviews/:id/accountant-review": ({ params, body }) => ({
    data: inventory.reviewPriceByAccountant(params.id, body, actor()),
  }),
  "POST /inv/price-reviews/:id/decide": ({ params, body }) => ({
    data: inventory.approvePriceReview(params.id, body, actor()),
  }),

  /* --- طلبات النواقص وتوزيع المخزون بين الفروع --- */
  "GET /inv/requisitions": ({ params }) => inventory.listRequisitions(params),
  "GET /inv/requisitions/:id": ({ params }) => ({ data: inventory.getRequisition(params.id) }),
  "POST /inv/requisitions": ({ body }) => ({ data: inventory.createRequisition(body, actor()) }),
  "GET /inv/requisitions/check-availability/:itemId": ({ params }) => ({
    data: inventory.checkItemAvailability(params.itemId),
  }),
  "POST /inv/requisitions/:id/fulfill-hub": ({ params, body }) => ({
    data: inventory.fulfillFromHub(params.id, body, actor()),
  }),
  "POST /inv/requisitions/:id/transfer-branch": ({ params, body }) => ({
    data: inventory.fulfillByBranchTransfer(params.id, body, actor()),
  }),
  "POST /inv/requisitions/:id/order-supplier": ({ params, body }) => ({
    data: inventory.orderFromSupplier(params.id, body, actor()),
  }),
  "POST /inv/requisitions/:id/inspect-receive": ({ params, body }) => ({
    data: inventory.branchInspectAndReceive(params.id, body, actor()),
  }),

  /* ======================================================================
     5. الإدارة والنظام
     ====================================================================== */

  "GET /admin/users": ({ params }) => query("users", params),
  "GET /admin/users/:id": ({ params }) => {
    const user = find("users", params.id);
    if (!user) throw notFound("المستخدم غير موجود.");
    return { data: user };
  },
  "POST /admin/users": ({ body }) => ({
    data: insert("users", { ...body, status: "active", lastLoginAt: null }),
  }),
  "PUT /admin/users/:id": ({ params, body }) => {
    const next = update("users", params.id, body);
    if (!next) throw notFound("المستخدم غير موجود.");
    return { data: next };
  },

  "GET /admin/roles": ({ params }) => query("roles", params),
  "GET /admin/permissions": () => ({ data: permissionCatalog() }),
  "GET /admin/audit": ({ params }) => query("auditLogs", params),

  /* --- الإعدادات --- */
  "GET /settings/company": () => ({ data: singleton("companyInfo") }),
  "PUT /settings/company": ({ body }) => ({ data: updateSingleton("companyInfo", body) }),
  "GET /settings/preferences": () => ({ data: singleton("systemPreferences") }),
  "PUT /settings/preferences": ({ body }) => ({ data: updateSingleton("systemPreferences", body) }),
  "GET /settings/posting-map": () => ({ data: postingMapView() }),
  "PUT /settings/posting-map": ({ body }) => {
    updateSingleton("postingMap", body);
    return { data: postingMapView() };
  },
  "GET /settings/notifications": ({ params }) => query("notificationPreferences", params),

  /* ======================================================================
     6. قوائم مرجعية (للقوائم المنسدلة)
     ====================================================================== */

  "GET /lookups/accounts": () => ({ data: accounting.postableAccounts() }),
  "GET /lookups/cost-centers": () => ({ data: all("costCenters") }),
  "GET /lookups/customers": () => ({ data: activeOnly("customers") }),
  "GET /lookups/suppliers": () => ({ data: activeOnly("suppliers") }),
  "GET /lookups/cash-boxes": () => ({ data: activeOnly("cashBoxes") }),
  "GET /lookups/bank-accounts": () => ({ data: activeOnly("bankAccounts") }),
  "GET /lookups/taxes": () => ({ data: activeOnly("taxes") }),
  "GET /lookups/departments": () => ({ data: all("departments") }),
  "GET /lookups/positions": () => ({ data: all("positions") }),
  "GET /lookups/shifts": () => ({ data: all("shifts") }),
  "GET /lookups/employees": () => ({
    data: all("employees")
      .filter((row) => ["employed", "probation"].includes(row.status))
      .map((row) => ({ id: row.id, code: row.code, name: row.name, jobTitle: row.jobTitle })),
  }),
  "GET /lookups/items": () => ({
    data: activeOnly("items").map((row) => ({
      id: row.id, code: row.code, name: row.name, unit: row.unit,
      costPrice: row.costPrice, sellingPrice: row.sellingPrice,
      warehouseIds: row.warehouseIds, trackBatches: row.trackBatches,
      trackExpiry: row.trackExpiry, trackSerials: row.trackSerials,
    })),
  }),
  "GET /lookups/warehouses": () => ({ data: activeOnly("warehouses") }),
  "GET /lookups/categories": () => ({ data: activeOnly("itemCategories") }),
  "GET /lookups/units": () => ({ data: all("units") }),
  "GET /lookups/payment-methods": () => ({ data: all("paymentMethods") }),
  "GET /lookups/governorates": () => ({ data: all("governorates") }),
  "GET /lookups/periods": () => ({ data: all("accountingPeriods") }),
  "GET /lookups/document-sources": () => ({ data: all("documentSources") }),
  "GET /lookups/asset-categories": () => ({ data: all("assetCategories") }),

  /* ======================================================================
     7. الجلسة
     ====================================================================== */

  /** نائب عن المصادقة — تُنفَّذ فعليًا في الباك-إند. */
  "GET /auth/me": () => {
    const user = currentUser();
    return {
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        jobTitle: user.jobTitle,
        company: db.companyInfo.name,
      },
    };
  },
};

/* --------------------------------------------------------------------------
   مساعدات
   -------------------------------------------------------------------------- */

/** السجلات النشطة فقط — ما تحتاجه القوائم المنسدلة. */
function activeOnly(collection) {
  return all(collection).filter((row) => !row.status || row.status === "active");
}

/**
 * خريطة الربط المحاسبي بشكل صالح للعرض: المفتاح ووصفه والحساب المرتبط.
 * شاشة الإعدادات تبني نموذجها من هذه القائمة، فإضافة مفتاح تظهر تلقائيًا.
 */
function postingMapView() {
  const accounts = all("accounts");
  const map = singleton("postingMap");

  return Object.entries(MAP_LABELS).map(([key, label]) => {
    const account = accounts.find((row) => String(row.id) === String(map[key]));

    return {
      key,
      label,
      accountId: map[key] ?? null,
      accountCode: account?.code ?? null,
      accountName: account?.name ?? null,
      /** المفتاح غير المُعَد يُعطّل كل عملية تحتاجه — نُعلنه بوضوح. */
      isConfigured: Boolean(account),
    };
  });
}

/** كتالوج الصلاحيات بشكل مجموعات — لشاشة إدارة الأدوار. */
function permissionCatalog() {
  const groups = new Map();

  for (const [key, label] of Object.entries(PERMISSION_LABELS)) {
    const domain = key.split(".")[0];
    if (!groups.has(domain)) {
      groups.set(domain, { domain, label: DOMAIN_LABELS[domain] ?? domain, permissions: [] });
    }
    groups.get(domain).permissions.push({ key, label });
  }

  return [...groups.values()];
}

const DOMAIN_LABELS = {
  dashboard: "لوحة التحكم",
  gl: "المحاسبة العامة",
  fin: "المحاسبة المالية",
  hr: "الموارد البشرية",
  inv: "المخازن",
  reports: "التقارير",
  admin: "الإدارة والنظام",
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

/**
 * قائمة المسارات المنفَّذة — تظهر في صفحة نظام التصميم وتفيد التوثيق.
 *
 * المسارات الثابتة تُطابَق قبل المتغيرة: `/gl/accounts/tree` يجب أن يسبق
 * `/gl/accounts/:id`، وإلا التقط النمط المتغيّر الكلمة «tree» كمُعرِّف.
 */
export function registeredEndpoints() {
  return COMPILED.map(({ method, pattern }) => `${method} ${pattern}`).sort();
}

/* الترتيب: الأقل عددًا من المعاملات أولًا — فتسبق المسارات الثابتة المتغيرة. */
COMPILED.sort((a, b) => a.keys.length - b.keys.length || b.pattern.length - a.pattern.length);

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
