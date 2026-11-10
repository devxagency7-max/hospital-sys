/**
 * خدمة المحاسبة المالية — العملاء، الموردون، الخزينة، البنوك، الأصول، الضرائب.
 *
 * كل مستند مالي يُنشأ هنا يُرحَّل محاسبيًا عبر `postDocument` في
 * posting.service.js — لا موديول يكتب قيدًا بنفسه.
 */

import { ruleViolation, notFound, validationError } from "../../core/errors.js";
import * as money from "../../core/money.js";
import {
  settleInvoice,
  summarizePartyAccount,
  buildInvoiceTimeline,
  maxRefundable,
  maxCreditable,
  calculateInvoiceTotals,
  assertDocumentMutable,
  DocumentStatus,
} from "../../domain/invoicing.js";
import { agingReport, agingDistribution, collectionHealth, dueSoon } from "../../domain/aging.js";
import {
  runDepreciation,
  disposalResult,
  assertDisposable,
  depreciationSchedule,
  assetRegister,
  bookValue,
  METHOD_LABELS,
} from "../../domain/depreciation.js";
import { SourceType } from "../../domain/posting.js";
import { db, all, find, insert, update, where, query } from "../db.js";
import { postDocument, audit, entryForDocument } from "./posting.service.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/* ==========================================================================
   1) أطراف التعامل — عملاء وموردون
   ========================================================================== */

/**
 * يبني ملخص حساب طرف (عميل أو مورد).
 *
 * دالة واحدة للجهتين: الحساب نفسه، والفرق في مجموعة المستندات المقروءة.
 */
function partyAccount({ party, invoices, receipts, creditNotes = [], partyKey }) {
  const own = invoices.filter((invoice) => String(invoice[partyKey]) === String(party.id));
  const ids = new Set(own.map((invoice) => invoice.id));

  const ownReceipts = receipts.filter((row) => ids.has(row.invoiceId));
  const ownCreditNotes = creditNotes.filter((row) => ids.has(row.invoiceId));

  const { invoices: settled, summary } = summarizePartyAccount({
    invoices: own,
    payments: ownReceipts.map((row) => ({ ...row, amount: row.amount })),
    refunds: [],
    creditNotes: ownCreditNotes,
  });

  return { party, invoices: settled, receipts: ownReceipts, creditNotes: ownCreditNotes, summary };
}

export function getCustomerAccount(id) {
  const customer = find("customers", id);
  if (!customer) throw notFound("العميل غير موجود.");

  const result = partyAccount({
    party: customer,
    invoices: all("customerInvoices"),
    receipts: all("customerReceipts"),
    creditNotes: all("customerCreditNotes"),
    partyKey: "customerId",
  });

  return {
    ...result,
    creditLimit: customer.creditLimit,
    /** صفر الحد يعني «لا حد مُعَد» لا «حد صفر» — راجع js/domain/aging.js. */
    availableCredit: money.isZero(customer.creditLimit)
      ? null
      : money.subtract(customer.creditLimit, result.summary.remainingBalance),
    overLimit: money.isZero(customer.creditLimit)
      ? false
      : money.compare(result.summary.remainingBalance, customer.creditLimit) > 0,
  };
}

export function getSupplierAccount(id) {
  const supplier = find("suppliers", id);
  if (!supplier) throw notFound("المورد غير موجود.");

  return partyAccount({
    party: supplier,
    invoices: all("supplierInvoices"),
    receipts: all("supplierPayments"),
    partyKey: "supplierId",
  });
}

/** قائمة العملاء بأرصدتهم المُشتقّة — لا رصيد مخزَّن على سجل العميل. */
export function listCustomers(params = {}) {
  const result = query("customers", params);
  const invoices = all("customerInvoices");

  return {
    ...result,
    data: result.data.map((customer) => {
      const own = invoices.filter((invoice) => String(invoice.customerId) === String(customer.id));
      const balance = money.sumBy(own, "remaining");

      return {
        ...customer,
        invoicesCount: own.length,
        openInvoicesCount: own.filter((invoice) => money.isPositive(invoice.remaining)).length,
        balance,
        overLimit: !money.isZero(customer.creditLimit) && money.compare(balance, customer.creditLimit) > 0,
        lastInvoiceDate: own.map((invoice) => invoice.date).sort().at(-1) ?? null,
      };
    }),
  };
}

export function listSuppliers(params = {}) {
  const result = query("suppliers", params);
  const invoices = all("supplierInvoices");

  return {
    ...result,
    data: result.data.map((supplier) => {
      const own = invoices.filter((invoice) => String(invoice.supplierId) === String(supplier.id));

      return {
        ...supplier,
        invoicesCount: own.length,
        openInvoicesCount: own.filter((invoice) => money.isPositive(invoice.remaining)).length,
        balance: money.sumBy(own, "remaining"),
        lastInvoiceDate: own.map((invoice) => invoice.date).sort().at(-1) ?? null,
      };
    }),
  };
}

/* ==========================================================================
   2) فواتير العملاء
   ========================================================================== */

export function getCustomerInvoice(id) {
  const invoice = find("customerInvoices", id);
  if (!invoice) throw notFound("الفاتورة غير موجودة.");

  const lines = where("customerInvoiceLines", (row) => String(row.invoiceId) === String(invoice.id));
  const receipts = where("customerReceipts", (row) => String(row.invoiceId) === String(invoice.id));
  const creditNotes = where("customerCreditNotes", (row) => String(row.invoiceId) === String(invoice.id));

  const settlement = settleInvoice(invoice, { payments: receipts, refunds: [], creditNotes });

  return {
    ...invoice,
    ...settlement,
    lines,
    receipts,
    creditNotes,
    timeline: buildInvoiceTimeline(invoice, { payments: receipts, refunds: [], creditNotes }),
    maxCreditable: maxCreditable(invoice, { creditNotes }),
    maxRefundable: maxRefundable(invoice, { payments: receipts, refunds: [] }),
    journalEntry: entryForDocument(SourceType.CUSTOMER_INVOICE, invoice.id),
  };
}

/**
 * يُصدر فاتورة عميل ويُرحّلها محاسبيًا.
 *
 * الترحيل جزء من العملية لا خطوة تالية: فاتورة صادرة بلا قيد تعني مديونية
 * موجودة في الموديول وغائبة عن الميزان.
 */
export function createCustomerInvoice(payload, { user } = {}) {
  const errors = {};
  if (!payload?.customerId) errors.customerId = "العميل مطلوب.";
  if (!payload?.date) errors.date = "تاريخ الفاتورة مطلوب.";
  if (!(payload?.lines ?? []).length) errors.lines = "الفاتورة تحتاج بندًا واحدًا على الأقل.";
  if (Object.keys(errors).length) throw validationError(errors);

  const customer = find("customers", payload.customerId);
  if (!customer) throw notFound("العميل غير موجود.");

  const tax = find("taxes", payload.taxId ?? 1);
  const totals = calculateInvoiceTotals({
    lines: payload.lines,
    discount: payload.discount,
    discountRate: payload.discountRate,
    taxRate: customer.accountId === 1132 ? 0 : (tax?.rate ?? 0),
  });

  /* حد الائتمان: تحذير لا منع — القرار للمدير المالي، والنظام يُظهره. */
  const currentBalance = money.sumBy(
    where("customerInvoices", (row) => String(row.customerId) === String(customer.id)),
    "remaining",
  );
  const willExceed =
    !money.isZero(customer.creditLimit) &&
    money.compare(money.add(currentBalance, totals.total), customer.creditLimit) > 0;

  const sequence = all("customerInvoices").length + 1;

  const invoice = insert("customerInvoices", {
    invoiceNumber: `SI-2026-${String(sequence).padStart(4, "0")}`,
    number: `SI-2026-${String(sequence).padStart(4, "0")}`,
    date: payload.date,
    dueDate: payload.dueDate ?? addDaysLocal(payload.date, customer.paymentTermsDays ?? 30),
    customerId: customer.id,
    customerName: customer.name,
    customerCode: customer.code,
    partyName: customer.name,
    partyCode: customer.code,
    accountId: customer.accountId,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    paid: 0,
    remaining: totals.total,
    currency: "EGP",
    paymentTermsLabel: customer.paymentTermsLabel,
    lifecycleStatus: "issued",
    status: "unpaid",
    costCenterId: payload.costCenterId ?? 4,
    issuedAt: new Date().toISOString(),
    createdBy: user?.name ?? "—",
    notes: payload.notes ?? null,
  });

  payload.lines.forEach((line, index) => {
    insert("customerInvoiceLines", {
      invoiceId: invoice.id,
      lineNumber: index + 1,
      itemId: line.itemId ?? null,
      description: line.description ?? "",
      quantity: Number(line.quantity) || 0,
      unitPrice: money.round(line.unitPrice),
      lineTotal: money.multiply(line.unitPrice, line.quantity ?? 1),
      revenueAccountId: line.revenueAccountId ?? null,
      taxRate: customer.accountId === 1132 ? 0 : (tax?.rate ?? 0),
    });
  });

  const posting = postDocument({
    sourceType: SourceType.CUSTOMER_INVOICE,
    sourceId: invoice.id,
    document: {
      ...invoice,
      lines: where("customerInvoiceLines", (row) => row.invoiceId === invoice.id),
    },
    date: invoice.date,
    description: `فاتورة خدمات طبية ${invoice.invoiceNumber} — ${customer.name}`,
    reference: invoice.invoiceNumber,
    costCenterId: invoice.costCenterId,
    user,
  });

  audit({
    action: "invoice.create", actionLabel: "إصدار فاتورة عميل",
    module: "المحاسبة المالية", entity: "customer_invoice", entityId: invoice.id,
    details: `${invoice.invoiceNumber} — ${customer.name} — ${invoice.total}`, user,
  });

  return {
    invoice,
    journalEntry: posting.entry,
    warnings: willExceed
      ? [
          `هذه الفاتورة تجعل رصيد ${customer.name} يتجاوز حد ائتمانه ` +
            `(${customer.creditLimit}). صدرت الفاتورة ووُثِّق التجاوز.`,
        ]
      : [],
  };
}

/** يسجّل تحصيلًا من عميل ويُرحّله. */
export function createCustomerReceipt(payload, { user } = {}) {
  const invoice = find("customerInvoices", payload?.invoiceId);
  if (!invoice) throw notFound("الفاتورة غير موجودة.");

  const amount = money.round(payload?.amount ?? 0);
  if (!money.isPositive(amount)) {
    throw validationError({ amount: "المبلغ يجب أن يكون أكبر من صفر." });
  }

  const receipts = where("customerReceipts", (row) => String(row.invoiceId) === String(invoice.id));
  const creditNotes = where("customerCreditNotes", (row) => String(row.invoiceId) === String(invoice.id));
  const settlement = settleInvoice(invoice, { payments: receipts, refunds: [], creditNotes });

  if (money.compare(amount, settlement.remaining) > 0) {
    throw ruleViolation(
      `المبلغ ${amount} يتجاوز المتبقي على الفاتورة (${settlement.remaining}). ` +
        "لتسجيل مبلغ أكبر، وزّعه على فواتير أخرى أو سجّله كدفعة مقدمة.",
      { field: "amount" },
    );
  }

  const sequence = all("customerReceipts").length + 1;
  const method = payload.method ?? "bank_transfer";

  const receipt = insert("customerReceipts", {
    receiptNumber: `RCV-2026-${String(sequence).padStart(4, "0")}`,
    date: payload.date ?? TODAY,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    amount,
    method,
    methodLabel: find("paymentMethods", method)?.name ?? method,
    accountId: payload.accountId ?? (method === "cash" ? 1111 : 1121),
    reference: payload.reference ?? null,
    receivedBy: user?.name ?? "—",
    status: "posted",
    notes: payload.notes ?? null,
  });

  /* تحديث التسوية على الفاتورة — مُشتقّة لا مُدخَلة. */
  const nextSettlement = settleInvoice(invoice, {
    payments: [...receipts, receipt],
    refunds: [],
    creditNotes,
  });

  update("customerInvoices", invoice.id, {
    paid: nextSettlement.paid,
    remaining: nextSettlement.remaining,
    status: nextSettlement.status,
  });

  const posting = postDocument({
    sourceType: SourceType.CUSTOMER_RECEIPT,
    sourceId: receipt.id,
    document: receipt,
    date: receipt.date,
    description: `تحصيل ${receipt.receiptNumber} من ${invoice.customerName}`,
    reference: receipt.receiptNumber,
    user,
  });

  audit({
    action: "receipt.create", actionLabel: "تسجيل تحصيل",
    module: "المحاسبة المالية", entity: "customer_receipt", entityId: receipt.id,
    details: `${receipt.receiptNumber} — ${amount}`, user,
  });

  return { receipt, invoice: find("customerInvoices", invoice.id), journalEntry: posting.entry };
}

/** يعتمد إشعارًا دائنًا ويُرحّله. */
export function approveCreditNote(id, { user } = {}) {
  const creditNote = find("customerCreditNotes", id);
  if (!creditNote) throw notFound("إشعار الدائن غير موجود.");

  assertDocumentMutable(creditNote, "إشعار الدائن");

  const invoice = find("customerInvoices", creditNote.invoiceId);
  if (!invoice) throw notFound("الفاتورة المرتبطة غير موجودة.");

  const existing = where(
    "customerCreditNotes",
    (row) => String(row.invoiceId) === String(invoice.id) && row.id !== creditNote.id,
  );

  const allowed = maxCreditable(invoice, { creditNotes: existing });
  if (money.compare(creditNote.amount, allowed) > 0) {
    throw ruleViolation(
      `مبلغ الإشعار ${creditNote.amount} يتجاوز القابل للتصحيح على الفاتورة (${allowed}).`,
    );
  }

  const approved = update("customerCreditNotes", id, {
    status: DocumentStatus.APPROVED,
    approvedBy: user?.name ?? "—",
    approvedAt: new Date().toISOString(),
  });

  const receipts = where("customerReceipts", (row) => String(row.invoiceId) === String(invoice.id));
  const settlement = settleInvoice(invoice, {
    payments: receipts,
    refunds: [],
    creditNotes: [...existing, approved],
  });

  update("customerInvoices", invoice.id, {
    remaining: settlement.remaining,
    status: settlement.status,
  });

  const posting = postDocument({
    sourceType: SourceType.CUSTOMER_CREDIT_NOTE,
    sourceId: approved.id,
    document: approved,
    date: approved.date,
    description: `إشعار دائن ${approved.creditNoteNumber} — ${approved.customerName}`,
    reference: approved.creditNoteNumber,
    user,
  });

  audit({
    action: "creditnote.approve", actionLabel: "اعتماد إشعار دائن", severity: "warning",
    module: "المحاسبة المالية", entity: "credit_note", entityId: approved.id,
    details: `${approved.creditNoteNumber} — ${approved.amount}`, user,
  });

  return { creditNote: approved, invoice: find("customerInvoices", invoice.id), journalEntry: posting.entry };
}

/* ==========================================================================
   3) فواتير الموردين ومدفوعاتهم
   ========================================================================== */

export function getSupplierInvoice(id) {
  const invoice = find("supplierInvoices", id);
  if (!invoice) throw notFound("فاتورة المورد غير موجودة.");

  const payments = where("supplierPayments", (row) => String(row.invoiceId) === String(invoice.id));
  const settlement = settleInvoice(invoice, { payments, refunds: [], creditNotes: [] });

  return {
    ...invoice,
    ...settlement,
    payments,
    timeline: buildInvoiceTimeline(invoice, { payments, refunds: [], creditNotes: [] }),
    journalEntry: entryForDocument(SourceType.SUPPLIER_INVOICE, invoice.id),
  };
}

export function createSupplierPayment(payload, { user } = {}) {
  const invoice = find("supplierInvoices", payload?.invoiceId);
  if (!invoice) throw notFound("فاتورة المورد غير موجودة.");

  const amount = money.round(payload?.amount ?? 0);
  if (!money.isPositive(amount)) {
    throw validationError({ amount: "المبلغ يجب أن يكون أكبر من صفر." });
  }

  const payments = where("supplierPayments", (row) => String(row.invoiceId) === String(invoice.id));
  const settlement = settleInvoice(invoice, { payments, refunds: [], creditNotes: [] });

  if (money.compare(amount, settlement.remaining) > 0) {
    throw ruleViolation(
      `المبلغ ${amount} يتجاوز المتبقي على الفاتورة (${settlement.remaining}).`,
      { field: "amount" },
    );
  }

  const account = find("bankAccounts", payload.bankAccountId) ?? null;
  const cashBox = find("cashBoxes", payload.cashBoxId) ?? null;
  const method = payload.method ?? "bank_transfer";

  /* الرصيد المتاح: السداد من حساب لا يحتمله يُنتج رصيدًا سالبًا. */
  const source = method === "cash" ? cashBox : account;
  if (source && money.compare(amount, money.add(source.balance, source.overdraftLimit ?? 0)) > 0) {
    throw ruleViolation(
      `رصيد ${source.name ?? source.bankName} (${source.balance}) لا يكفي لسداد ${amount}.`,
      { field: "amount" },
    );
  }

  const sequence = all("supplierPayments").length + 1;

  const payment = insert("supplierPayments", {
    paymentNumber: `PAY-2026-${String(sequence).padStart(4, "0")}`,
    date: payload.date ?? TODAY,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    supplierId: invoice.supplierId,
    supplierName: invoice.supplierName,
    amount,
    method,
    accountId: payload.accountId ?? (method === "cash" ? 1111 : (account?.accountId ?? 1121)),
    reference: payload.reference ?? null,
    clearanceStatus: method === "cheque" ? "outstanding" : "cleared",
    paidBy: user?.name ?? "—",
    approvedBy: payload.approvedBy ?? null,
    status: "posted",
    notes: payload.notes ?? null,
  });

  const nextSettlement = settleInvoice(invoice, {
    payments: [...payments, payment],
    refunds: [],
    creditNotes: [],
  });

  update("supplierInvoices", invoice.id, {
    paid: nextSettlement.paid,
    remaining: nextSettlement.remaining,
    status: nextSettlement.status,
  });

  const posting = postDocument({
    sourceType: SourceType.SUPPLIER_PAYMENT,
    sourceId: payment.id,
    document: payment,
    date: payment.date,
    description: `دفعة ${payment.paymentNumber} إلى ${invoice.supplierName}`,
    reference: payment.paymentNumber,
    user,
  });

  audit({
    action: "payment.create", actionLabel: "تسجيل دفعة لمورد",
    module: "المحاسبة المالية", entity: "supplier_payment", entityId: payment.id,
    details: `${payment.paymentNumber} — ${amount}`, user,
  });

  return { payment, invoice: find("supplierInvoices", invoice.id), journalEntry: posting.entry };
}

/* ==========================================================================
   4) تقادم الذمم
   ========================================================================== */

export function receivablesAging(params = {}) {
  const invoices = all("customerInvoices").map((invoice) => ({
    ...invoice,
    partyId: invoice.customerId,
  }));

  const report = agingReport(invoices, {
    asOf: params.asOf ?? TODAY,
    parties: all("customers"),
  });

  return {
    ...report,
    distribution: agingDistribution(report.totals),
    collectionHealth: collectionHealth(report.totals),
    dueSoon: dueSoon(invoices, { asOf: params.asOf ?? TODAY, withinDays: 14 }).slice(0, 15),
  };
}

export function payablesAging(params = {}) {
  const invoices = all("supplierInvoices").map((invoice) => ({
    ...invoice,
    partyId: invoice.supplierId,
  }));

  const report = agingReport(invoices, {
    asOf: params.asOf ?? TODAY,
    parties: all("suppliers"),
  });

  return {
    ...report,
    distribution: agingDistribution(report.totals),
    dueSoon: dueSoon(invoices, { asOf: params.asOf ?? TODAY, withinDays: 14 }).slice(0, 15),
  };
}

/* ==========================================================================
   5) الخزينة
   ========================================================================== */

/** الخزائن بأرصدتها المُشتقّة من حركاتها. */
export function listCashBoxes(params = {}) {
  const result = query("cashBoxes", params);
  const movements = all("cashMovements");

  return {
    ...result,
    data: result.data.map((box) => {
      const own = movements.filter((row) => row.cashBoxId === box.id);
      const inflow = money.sumBy(own.filter((row) => row.direction === "in"), "amount");
      const outflow = money.sumBy(own.filter((row) => row.direction === "out"), "amount");

      return {
        ...box,
        inflow,
        outflow,
        movementsCount: own.length,
        /** تجاوز الحد الأقصى — تنبيه خزينة واقعي. */
        overLimit: box.maxLimit > 0 && money.compare(box.balance, box.maxLimit) > 0,
        lastMovementDate: own.map((row) => row.date).sort().at(-1) ?? null,
      };
    }),
  };
}

/** إيصال قبض أو صرف نقدي عام (لا يخص عميلًا ولا موردًا). */
export function createCashVoucher(payload, { user } = {}) {
  const box = find("cashBoxes", payload?.cashBoxId);
  if (!box) throw notFound("الخزينة غير موجودة.");

  const amount = money.round(payload?.amount ?? 0);
  if (!money.isPositive(amount)) {
    throw validationError({ amount: "المبلغ يجب أن يكون أكبر من صفر." });
  }

  const direction = payload.direction === "in" ? "in" : "out";

  if (direction === "out" && money.compare(amount, box.balance) > 0) {
    throw ruleViolation(
      `رصيد الخزينة «${box.name}» (${box.balance}) لا يكفي لصرف ${amount}.`,
      { field: "amount" },
    );
  }
  if (!payload?.counterAccountId) {
    throw validationError({ counterAccountId: "الحساب المقابل مطلوب." });
  }

  const sequence = all("cashMovements").length + 1;
  const prefix = direction === "in" ? "CRV" : "CPV";

  const movement = insert("cashMovements", {
    voucherNumber: `${prefix}-2026-${String(sequence).padStart(4, "0")}`,
    date: payload.date ?? TODAY,
    cashBoxId: box.id,
    direction,
    type: direction === "in" ? "receipt" : "expense",
    amount,
    description: payload.description ?? (direction === "in" ? "قبض نقدي" : "صرف نقدي"),
    partyType: null,
    partyId: null,
    counterAccountId: payload.counterAccountId,
    costCenterId: payload.costCenterId ?? null,
    reference: payload.reference ?? null,
    sourceType: direction === "in" ? SourceType.CASH_RECEIPT : SourceType.CASH_PAYMENT,
    performedBy: user?.name ?? "—",
    status: "posted",
  });

  update("cashBoxes", box.id, {
    balance: direction === "in"
      ? money.add(box.balance, amount)
      : money.subtract(box.balance, amount),
  });

  const posting = postDocument({
    sourceType: movement.sourceType,
    sourceId: movement.id,
    document: {
      ...movement,
      accountId: box.accountId,
      counterAccountId: payload.counterAccountId,
    },
    date: movement.date,
    description: `${movement.voucherNumber} — ${movement.description}`,
    reference: movement.voucherNumber,
    costCenterId: movement.costCenterId,
    user,
  });

  return { movement, cashBox: find("cashBoxes", box.id), journalEntry: posting.entry };
}

/**
 * تحويل بين خزينتين أو بين خزينة وبنك.
 *
 * لا إيراد ولا مصروف — راجع `cashTransferLines` في js/domain/posting-rules.js.
 */
export function createTransfer(payload, { user } = {}) {
  const amount = money.round(payload?.amount ?? 0);
  if (!money.isPositive(amount)) {
    throw validationError({ amount: "المبلغ يجب أن يكون أكبر من صفر." });
  }

  const from = resolveTreasuryNode(payload?.fromType, payload?.fromId);
  const to = resolveTreasuryNode(payload?.toType, payload?.toId);

  if (from.accountId === to.accountId) {
    throw ruleViolation("لا يُحوَّل مبلغ من حساب إلى نفسه.", { field: "toId" });
  }
  if (money.compare(amount, money.add(from.balance, from.overdraftLimit ?? 0)) > 0) {
    throw ruleViolation(`رصيد ${from.name} (${from.balance}) لا يكفي لتحويل ${amount}.`, {
      field: "amount",
    });
  }

  const date = payload.date ?? TODAY;
  const sequence = all("cashMovements").length + 1;
  const reference = `TRF-2026-${String(sequence).padStart(4, "0")}`;

  from.debit(money.subtract(from.balance, amount));
  to.debit(money.add(to.balance, amount));

  const sourceType =
    from.kind === "cash" && to.kind === "bank"
      ? SourceType.BANK_DEPOSIT
      : from.kind === "bank" && to.kind === "cash"
        ? SourceType.BANK_WITHDRAWAL
        : SourceType.CASH_TRANSFER;

  const posting = postDocument({
    sourceType,
    sourceId: sequence,
    document: {
      amount,
      fromAccountId: from.accountId,
      toAccountId: to.accountId,
      fromName: from.name,
      toName: to.name,
    },
    date,
    description: `تحويل ${reference}: ${from.name} ← ${to.name}`,
    reference,
    user,
  });

  audit({
    action: "treasury.transfer", actionLabel: "تحويل بين الخزائن والبنوك",
    module: "المحاسبة المالية", entity: "transfer", entityId: sequence,
    details: `${reference} — ${amount} من ${from.name} إلى ${to.name}`, user,
  });

  return { reference, amount, from: from.name, to: to.name, journalEntry: posting.entry };
}

function resolveTreasuryNode(kind, id) {
  if (kind === "cash") {
    const box = find("cashBoxes", id);
    if (!box) throw notFound("الخزينة غير موجودة.");
    return {
      kind: "cash",
      name: box.name,
      accountId: box.accountId,
      balance: box.balance,
      overdraftLimit: 0,
      debit: (next) => update("cashBoxes", box.id, { balance: next }),
    };
  }

  const bank = find("bankAccounts", id);
  if (!bank) throw notFound("الحساب البنكي غير موجود.");
  return {
    kind: "bank",
    name: `${bank.bankName} — ${bank.accountNumber}`,
    accountId: bank.accountId,
    balance: bank.balance,
    overdraftLimit: bank.overdraftLimit ?? 0,
    debit: (next) => update("bankAccounts", bank.id, { balance: next }),
  };
}

/* ==========================================================================
   6) البنوك
   ========================================================================== */

export function listBankAccounts(params = {}) {
  const result = query("bankAccounts", params);
  const transactions = all("bankTransactions");

  return {
    ...result,
    data: result.data.map((bank) => {
      const own = transactions.filter((row) => row.bankAccountId === bank.id);
      const unreconciled = own.filter((row) => !row.reconciled);

      return {
        ...bank,
        transactionsCount: own.length,
        unreconciledCount: unreconciled.length,
        unreconciledAmount: money.sum(
          unreconciled.map((row) =>
            row.direction === "out" ? row.amount : money.multiply(row.amount, -1),
          ),
        ),
        available: money.add(bank.balance, bank.overdraftLimit ?? 0),
        isOverdrawn: money.isNegative(bank.balance),
      };
    }),
  };
}

/**
 * مطابقة بنكية: يُعلّم حركات كمُطابَقة ويُعيد حساب الفرق.
 *
 * الفرق المحسوب = رصيد الكشف − (الرصيد الدفتري + المعلَّق). صفر يعني مطابقة
 * تامة، وغير الصفر يعني حركة في الكشف لا مقابل لها في الدفتر — وهي بالضبط
 * الحالة التي تستحق تحقيقًا، فنُظهرها بدل تسويتها تلقائيًا.
 */
export function reconcileBank(payload, { user } = {}) {
  const bank = find("bankAccounts", payload?.bankAccountId);
  if (!bank) throw notFound("الحساب البنكي غير موجود.");

  const statementDate = payload?.statementDate ?? TODAY;
  const statementBalance = money.round(payload?.statementBalance ?? 0);
  const matchedIds = new Set((payload?.matchedTransactionIds ?? []).map(String));

  for (const transaction of all("bankTransactions")) {
    if (transaction.bankAccountId !== bank.id) continue;
    if (!matchedIds.has(String(transaction.id))) continue;
    update("bankTransactions", transaction.id, { reconciled: true, statementDate });
  }

  const outstanding = all("bankTransactions").filter(
    (row) => row.bankAccountId === bank.id && !row.reconciled,
  );

  const outstandingAmount = money.sum(
    outstanding.map((row) =>
      row.direction === "out" ? row.amount : money.multiply(row.amount, -1),
    ),
  );

  const expected = money.add(bank.balance, outstandingAmount);
  const difference = money.subtract(statementBalance, expected);

  const record = insert("bankReconciliations", {
    bankAccountId: bank.id,
    bankName: bank.bankName,
    statementDate,
    statementBalance,
    bookBalance: bank.balance,
    outstandingCount: outstanding.length,
    outstandingAmount,
    difference,
    status: money.isZero(difference) ? "reconciled" : "unreconciled",
    reconciledBy: user?.name ?? "—",
    notes: money.isZero(difference)
      ? "مطابقة تامة."
      : `فرق غير مُفسَّر ${difference} — راجع حركات الكشف غير المسجَّلة في الدفتر.`,
  });

  if (money.isZero(difference)) {
    update("bankAccounts", bank.id, { lastReconciledAt: statementDate });
  }

  audit({
    action: "bank.reconcile", actionLabel: "مطابقة كشف بنكي",
    module: "المحاسبة المالية", entity: "bank_reconciliation", entityId: record.id,
    details: `${bank.bankName} — ${statementDate} — فرق ${difference}`, user,
  });

  return record;
}

/* ==========================================================================
   7) الأصول الثابتة
   ========================================================================== */

export function listAssets(params = {}) {
  const result = query("fixedAssets", params);

  return {
    ...result,
    data: result.data.map((asset) => ({
      ...asset,
      methodLabel: METHOD_LABELS[asset.method] ?? asset.method,
      netBookValue: bookValue(asset),
      depreciationRate: money.isZero(asset.acquisitionCost)
        ? 0
        : asset.accumulatedDepreciation / asset.acquisitionCost,
    })),
  };
}

export function getAsset(id) {
  const asset = find("fixedAssets", id);
  if (!asset) throw notFound("الأصل غير موجود.");

  return {
    ...asset,
    methodLabel: METHOD_LABELS[asset.method] ?? asset.method,
    netBookValue: bookValue(asset),
    schedule: depreciationSchedule(asset),
    disposalPreview: asset.status === "disposed"
      ? disposalResult(asset, { proceeds: asset.disposalProceeds ?? 0 })
      : null,
  };
}

export function getAssetRegister() {
  return assetRegister(all("fixedAssets"), all("assetCategories"));
}

/** معاينة تشغيل الإهلاك — دون تنفيذ. */
export function previewDepreciation(params = {}) {
  const period = params.period ?? TODAY.slice(0, 7);

  const existing = all("depreciationRuns").find((run) => run.period === period);
  const result = runDepreciation(all("fixedAssets"), { period });

  return {
    ...result,
    alreadyRun: Boolean(existing),
    existingRun: existing ?? null,
  };
}

/** يُشغّل الإهلاك الدوري ويُرحّله. */
export function processDepreciation(payload, { user } = {}) {
  const period = payload?.period ?? TODAY.slice(0, 7);

  if (all("depreciationRuns").some((run) => run.period === period)) {
    throw ruleViolation(
      `إهلاك الفترة ${period} مُشغَّل بالفعل. لإعادة تشغيله: اعكس قيده ثم ألغِ التشغيل.`,
    );
  }

  const result = runDepreciation(all("fixedAssets"), { period });

  if (!money.isPositive(result.totalDepreciation)) {
    throw ruleViolation("لا أصول قابلة للإهلاك في هذه الفترة.");
  }

  const run = insert("depreciationRuns", {
    runNumber: `DEP-${period.replace("-", "")}`,
    period,
    date: result.date,
    assetsCount: result.assetsCount,
    totalDepreciation: result.totalDepreciation,
    rows: result.rows,
    skipped: result.skipped,
    status: "posted",
    runBy: user?.name ?? "—",
    postedAt: new Date().toISOString(),
  });

  /* تحديث مجمع الإهلاك على كل أصل. */
  for (const row of result.rows) {
    update("fixedAssets", row.assetId, {
      accumulatedDepreciation: row.accumulatedAfter,
      status: row.isFullyDepreciatedAfter ? "fully_depreciated" : "in_service",
    });
  }

  const posting = postDocument({
    sourceType: SourceType.ASSET_DEPRECIATION,
    sourceId: run.id,
    document: { totalDepreciation: result.totalDepreciation, periodLabel: period },
    date: result.date,
    description: `إهلاك دوري — ${period}`,
    reference: run.runNumber,
    user,
  });

  audit({
    action: "asset.depreciate", actionLabel: "تشغيل الإهلاك الدوري", severity: "warning",
    module: "المحاسبة المالية", entity: "depreciation_run", entityId: run.id,
    details: `${run.runNumber} — ${result.totalDepreciation}`, user,
  });

  return { run, journalEntry: posting.entry, skipped: result.skipped };
}

/** يستبعد أصلًا ويُرحّل نتيجة الاستبعاد. */
export function disposeAsset(id, payload, { user } = {}) {
  const asset = find("fixedAssets", id);
  if (!asset) throw notFound("الأصل غير موجود.");

  assertDisposable(asset);

  const proceeds = money.round(payload?.proceeds ?? 0);
  const result = disposalResult(asset, { proceeds });

  const next = update("fixedAssets", id, {
    status: "disposed",
    disposalDate: payload?.date ?? TODAY,
    disposalProceeds: proceeds,
    disposalResult: result.result,
    disposalReason: payload?.reason ?? null,
  });

  const posting = postDocument({
    sourceType: SourceType.ASSET_DISPOSAL,
    sourceId: asset.id,
    document: {
      name: asset.name,
      acquisitionCost: result.acquisitionCost,
      accumulatedDepreciation: result.accumulatedDepreciation,
      proceeds,
      assetAccountId: asset.assetAccountId,
      accumulatedAccountId: asset.accumulatedAccountId,
      proceedsAccountId: payload?.proceedsAccountId ?? 1111,
    },
    date: next.disposalDate,
    description: `استبعاد الأصل ${asset.code} — ${asset.name}`,
    reference: asset.code,
    user,
  });

  audit({
    action: "asset.dispose", actionLabel: "استبعاد أصل ثابت", severity: "critical",
    module: "المحاسبة المالية", entity: "fixed_asset", entityId: asset.id,
    details: `${asset.code} — ${result.isGain ? "ربح" : "خسارة"} ${Math.abs(result.result)}`, user,
  });

  return { asset: next, result, journalEntry: posting.entry };
}

/* ==========================================================================
   8) المطابقة بين الأستاذ المساعد والحساب الرقابي
   ========================================================================== */

/**
 * ملخص المطابقة.
 *
 * شاشة واحدة تُجيب على السؤال الذي يسأله كل مراجع: هل مجموع كشوف العملاء
 * يساوي رصيد حساب العملاء في الميزان؟ الفرق هنا عيب بيانات يستحق الظهور لا
 * الإخفاء.
 */
export function reconciliationSummary() {
  return db.subsidiaryReconciliation;
}

/* -------------------------------------------------------------------------- */

function addDaysLocal(isoDate, days) {
  const date = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days ?? 0));
  return date.toISOString().slice(0, 10);
}
