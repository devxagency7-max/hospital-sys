/**
 * خدمة المحاسبة العامة — الدليل، الأستاذ، الميزان، الفترات.
 *
 * تُحاكي طبقة خدمات الباك-إند وتُعدّ مواصفتها. كل حساب رقمي هنا مُفوَّض إلى
 * js/domain/ledger.js — هذه الوحدة تقرأ وتكتب فقط.
 */

import { ruleViolation, notFound, validationError } from "../../core/errors.js";
import * as money from "../../core/money.js";
import {
  flattenTree,
  leafAccounts,
  nextChildCode,
  validateChart,
  accountPath,
  natureOf,
  NATURAL_NATURE,
  TYPE_LABELS,
} from "../../domain/accounts.js";
import {
  toMovements,
  rollUpBalances,
  accountStatement,
  trialBalance,
  incomeStatement,
  balanceSheet,
  cashFlowStatement,
  costCenterAnalysis,
} from "../../domain/ledger.js";
import { EntryStatus, SOURCE_LABELS } from "../../domain/posting.js";
import { db, all, find, insert, update, query } from "../db.js";
import { audit } from "./posting.service.js";

/* ==========================================================================
   1) الحركات — تُحسب مرة لكل طلب
   ========================================================================== */

/**
 * حركات الدفتر كلها.
 *
 * تُعاد الحسبة في كل طلب عن قصد: الذاكرة المؤقتة (cache) هنا تعني أن قيدًا
 * يُرحَّل ولا يظهر في الميزان حتى تُفرَّغ الذاكرة — وهو بالضبط نوع التناقض
 * الذي تتجنبه هذه المعمارية بالاشتقاق من القيود.
 */
export function movements() {
  return toMovements(all("journalEntries"));
}

/* ==========================================================================
   2) دليل الحسابات
   ========================================================================== */

/**
 * الدليل بشكل شجري مُسطَّح مع الأرصدة المُجمَّعة.
 * الحساب الأب يحمل مجموع أبنائه، والورقة تحمل حركاتها المباشرة.
 */
export function accountsTree({ dateFrom, dateTo, costCenterId } = {}) {
  const accounts = all("accounts");
  const scoped = movements().filter((movement) => {
    const day = String(movement.date).slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    if (costCenterId && String(movement.costCenterId) !== String(costCenterId)) return false;
    return true;
  });

  const balances = rollUpBalances(accounts, scoped);

  const rows = flattenTree(accounts).map((account) => {
    const computed = balances.get(String(account.id));

    return {
      ...account,
      typeLabel: TYPE_LABELS[account.type] ?? account.type,
      natureLabel: natureOf(account) === "debit" ? "مدين" : "دائن",
      isContra: natureOf(account) !== NATURAL_NATURE[account.type],
      /** الرصيد المُجمَّع — هو ما يُعرض في الشجرة. */
      balance: computed?.rolled.balance ?? 0,
      debit: computed?.rolled.debit ?? 0,
      credit: computed?.rolled.credit ?? 0,
      movementsCount: computed?.rolled.movements ?? 0,
      /** الرصيد من الحركات المباشرة — صفر لكل حساب أب. */
      ownBalance: computed?.own.balance ?? 0,
      ownMovements: computed?.own.movements ?? 0,
      isPostable: account.isLeaf && account.status === "active",
    };
  });

  const byType = Object.fromEntries(
    Object.keys(TYPE_LABELS).map((type) => {
      const root = rows.find((row) => row.type === type && row.depth === 0);
      return [type, root?.balance ?? 0];
    }),
  );

  return {
    rows,
    totals: byType,
    problems: validateChart(accounts),
    counts: {
      total: accounts.length,
      postable: leafAccounts(accounts).length,
      inactive: accounts.filter((account) => account.status !== "active").length,
    },
  };
}

/** ينشئ حسابًا جديدًا في الدليل. */
export function createAccount(payload, { user } = {}) {
  const accounts = all("accounts");
  const errors = {};

  if (!String(payload?.name ?? "").trim()) errors.name = "اسم الحساب مطلوب.";
  if (!payload?.type) errors.type = "نوع الحساب مطلوب.";

  const parent = payload?.parentId ? find("accounts", payload.parentId) : null;
  if (payload?.parentId && !parent) errors.parentId = "الحساب الأب غير موجود.";

  if (parent && parent.type !== payload.type) {
    errors.type = `الفرع يتبع نوع أبيه (${TYPE_LABELS[parent.type] ?? parent.type}).`;
  }

  const code = String(payload?.code ?? "").trim() || (parent ? nextChildCode(accounts, parent.id) : "");
  if (!code) errors.code = "كود الحساب مطلوب.";
  if (code && accounts.some((account) => String(account.code) === code)) {
    errors.code = `الكود ${code} مستخدم بالفعل.`;
  }

  if (Object.keys(errors).length) throw validationError(errors);

  /*
   * الترحيل ممنوع على حساب له أبناء. إضافة فرع لحساب يحمل حركات تجعله أبًا
   * بحركات مباشرة — وهو ما يُنتج عدًّا مزدوجًا في الميزان. نرفض بوضوح.
   */
  if (parent) {
    const parentHasMovements = movements().some(
      (movement) => String(movement.accountId) === String(parent.id),
    );
    if (parentHasMovements) {
      throw ruleViolation(
        `الحساب «${parent.name}» يحمل حركات مُرحَّلة، فلا يمكن إضافة حساب فرعي تحته. ` +
          "انقل حركاته إلى حساب تفصيلي أولًا.",
        { field: "parentId" },
      );
    }
  }

  const account = insert("accounts", {
    code,
    name: String(payload.name).trim(),
    nameEn: payload.nameEn ?? null,
    type: payload.type,
    parentId: parent?.id ?? null,
    level: parent ? (parent.level ?? 1) + 1 : 1,
    nature: payload.nature ?? NATURAL_NATURE[payload.type] ?? "debit",
    status: "active",
  });

  audit({
    action: "account.create", actionLabel: "إضافة حساب للدليل",
    module: "المحاسبة العامة", entity: "account", entityId: account.id,
    details: `${account.code} — ${account.name}`, user,
  });

  return account;
}

export function updateAccount(id, payload, { user } = {}) {
  const account = find("accounts", id);
  if (!account) throw notFound("الحساب غير موجود.");

  /* تغيير النوع على حساب يحمل حركات يقلب إشارته في القوائم المالية. */
  if (payload?.type && payload.type !== account.type) {
    const hasMovements = movements().some(
      (movement) => String(movement.accountId) === String(account.id),
    );
    if (hasMovements) {
      throw ruleViolation(
        `لا يمكن تغيير نوع الحساب «${account.name}» وهو يحمل حركات مُرحَّلة. ` +
          "تغيير النوع يقلب موضعه في القوائم المالية ويُفسد أرقام فترات مُغلقة.",
        { field: "type" },
      );
    }
  }

  const next = update("accounts", id, {
    name: payload?.name ?? account.name,
    nameEn: payload?.nameEn ?? account.nameEn,
    nature: payload?.nature ?? account.nature,
    status: payload?.status ?? account.status,
    ...(payload?.type ? { type: payload.type } : {}),
  });

  audit({
    action: "account.update", actionLabel: "تعديل حساب",
    module: "المحاسبة العامة", entity: "account", entityId: next.id,
    details: `${next.code} — ${next.name}`, user,
  });

  return next;
}

/* ==========================================================================
   3) دفتر اليومية
   ========================================================================== */

/** قائمة القيود مع حقول معروضة مُشتقّة. */
export function listJournalEntries(params = {}) {
  const result = query("journalEntries", params);

  return {
    ...result,
    data: result.data.map(decorateEntry),
  };
}

function decorateEntry(entry) {
  const period = all("accountingPeriods").find((row) => row.id === entry.periodId);

  return {
    ...entry,
    sourceLabel: SOURCE_LABELS[entry.sourceType] ?? entry.sourceType,
    periodName: period?.name ?? "—",
    periodStatus: period?.status ?? null,
    linesCount: entry.lines?.length ?? 0,
    /** القيد المُرحَّل لا يُعدَّل — تقرؤه الشاشة لتعطيل أزرار التعديل. */
    isEditable: entry.status === EntryStatus.DRAFT || entry.status === EntryStatus.PENDING,
    isReversible: entry.status === EntryStatus.POSTED && !entry.isReversal,
  };
}

/** قيد واحد بتفصيل سطوره وأسماء حساباتها. */
export function getJournalEntry(id) {
  const entry = find("journalEntries", id);
  if (!entry) throw notFound("القيد غير موجود.");

  const accounts = all("accounts");
  const centers = all("costCenters");

  return {
    ...decorateEntry(entry),
    lines: (entry.lines ?? []).map((line, index) => {
      const account = accounts.find((row) => String(row.id) === String(line.accountId));
      const center = centers.find((row) => String(row.id) === String(line.costCenterId));

      return {
        ...line,
        lineNumber: line.lineNumber ?? index + 1,
        accountCode: account?.code ?? "—",
        accountName: account?.name ?? "حساب محذوف",
        accountPath: account ? accountPath(accounts, account.id) : "—",
        costCenterName: center?.name ?? null,
      };
    }),
    /** القيد العكسي المرتبط، إن وُجد. */
    reversalEntry: entry.reversedAt
      ? all("journalEntries").find((row) => row.reversalOf === entry.id) ?? null
      : null,
    originalEntry: entry.reversalOf ? find("journalEntries", entry.reversalOf) ?? null : null,
  };
}

/* ==========================================================================
   4) دفتر الأستاذ العام
   ========================================================================== */

/** كشف حساب تفصيلي. */
export function generalLedger({ accountId, dateFrom, dateTo, costCenterId } = {}) {
  const account = find("accounts", accountId);
  if (!account) throw notFound("الحساب غير موجود.");

  const statement = accountStatement(account, movements(), { dateFrom, dateTo, costCenterId });
  const accounts = all("accounts");

  return {
    account: {
      ...account,
      path: accountPath(accounts, account.id),
      typeLabel: TYPE_LABELS[account.type] ?? account.type,
      natureLabel: natureOf(account) === "debit" ? "مدين" : "دائن",
    },
    period: { dateFrom, dateTo, costCenterId: costCenterId ?? null },
    opening: statement.opening,
    rows: statement.rows.map((row) => ({
      ...row,
      sourceLabel: SOURCE_LABELS[row.sourceType] ?? row.sourceType,
    })),
    periodTotals: statement.period,
    closing: statement.closing,
  };
}

/** قائمة الحسابات القابلة للترحيل — لقائمة اختيار الحساب في كل شاشة. */
export function postableAccounts() {
  const accounts = all("accounts");

  return leafAccounts(accounts)
    .filter((account) => account.status === "active")
    .map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      nameEn: account.nameEn,
      type: account.type,
      typeLabel: TYPE_LABELS[account.type] ?? account.type,
      nature: natureOf(account),
      path: accountPath(accounts, account.id),
    }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code), "en", { numeric: true }));
}

/* ==========================================================================
   5) ميزان المراجعة والقوائم المالية
   ========================================================================== */

export function getTrialBalance(params = {}) {
  return trialBalance(all("accounts"), movements(), {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    costCenterId: params.costCenterId,
    includeZero: params.includeZero === "true" || params.includeZero === true,
  });
}

export function getIncomeStatement(params = {}) {
  return incomeStatement(all("accounts"), movements(), {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    costCenterId: params.costCenterId,
  });
}

export function getBalanceSheet(params = {}) {
  const year = all("fiscalYears").find((row) => row.status === "open");

  return balanceSheet(all("accounts"), movements(), {
    asOf: params.asOf ?? params.dateTo,
    fiscalYearStart: params.fiscalYearStart ?? year?.startDate,
    costCenterId: params.costCenterId,
  });
}

export function getCashFlow(params = {}) {
  /* حسابات النقدية والبنوك — من الدليل لا من قائمة مكتوبة. */
  const cashAccountIds = all("accounts")
    .filter((account) => ["111", "112"].includes(String(account.parentId)))
    .map((account) => account.id);

  return cashFlowStatement(all("accounts"), all("journalEntries"), {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    cashAccountIds,
  });
}

export function getCostCenterAnalysis(params = {}) {
  return costCenterAnalysis(all("accounts"), movements(), all("costCenters"), {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
}

/* ==========================================================================
   6) الفترات والسنوات المالية
   ========================================================================== */

/** الفترات مع عدد قيودها الفعلي ومجاميعها. */
export function listPeriods(params = {}) {
  const entries = all("journalEntries");
  const result = query("accountingPeriods", params);

  return {
    ...result,
    data: result.data.map((period) => {
      const own = entries.filter((entry) => entry.periodId === period.id);
      const posted = own.filter((entry) => entry.status === EntryStatus.POSTED);

      return {
        ...period,
        entriesCount: own.length,
        postedCount: posted.length,
        /** القيود غير المُرحَّلة تمنع الإغلاق — تقرؤها الشاشة لتفسير التعطيل. */
        pendingCount: own.filter((entry) =>
          [EntryStatus.DRAFT, EntryStatus.PENDING, EntryStatus.APPROVED].includes(entry.status),
        ).length,
        totalDebit: money.sumBy(posted, "totalDebit"),
        totalCredit: money.sumBy(posted, "totalCredit"),
      };
    }),
  };
}

/**
 * يُغلق فترة محاسبية.
 *
 * يُرفض الإغلاق مع وجود قيود غير مُرحَّلة: إغلاق الفترة يُجمِّد أرقامها
 * ويُصدِر عنها قوائم مالية، وقيد معلَّق يعني أن تلك الأرقام ناقصة — وتصحيحها
 * بعد الإغلاق يحتاج إعادة فتح الفترة وإعادة إصدار القوائم.
 */
export function closePeriod(id, { user } = {}) {
  const period = find("accountingPeriods", id);
  if (!period) throw notFound("الفترة غير موجودة.");

  if (period.status === "closed") {
    throw ruleViolation(`الفترة «${period.name}» مغلقة بالفعل.`);
  }

  const pending = all("journalEntries").filter(
    (entry) =>
      entry.periodId === period.id &&
      [EntryStatus.DRAFT, EntryStatus.PENDING, EntryStatus.APPROVED].includes(entry.status),
  );

  if (pending.length) {
    throw ruleViolation(
      `لا يمكن إغلاق الفترة «${period.name}»: ${pending.length} قيد غير مُرحَّل ` +
        `(${pending.slice(0, 3).map((entry) => entry.entryNumber).join("، ")}${pending.length > 3 ? "…" : ""}). ` +
        "رحّل القيود أو ألغِها أولًا.",
    );
  }

  /* الفترة السابقة يجب أن تكون مغلقة — الإغلاق بالترتيب لا بالقفز. */
  const previous = all("accountingPeriods")
    .filter((row) => row.fiscalYearId === period.fiscalYearId && row.number < period.number)
    .sort((a, b) => b.number - a.number)[0];

  if (previous && previous.status === "open") {
    throw ruleViolation(
      `لا يمكن إغلاق «${period.name}» قبل إغلاق «${previous.name}». ` +
        "الفترات تُغلق بالترتيب، وإلا فُتحت فترة مغلقة بينها فترة مفتوحة.",
    );
  }

  const next = update("accountingPeriods", id, {
    status: "closed",
    closedAt: new Date().toISOString(),
    closedBy: user?.name ?? "—",
  });

  audit({
    action: "period.close", actionLabel: "إغلاق فترة محاسبية", severity: "critical",
    module: "المحاسبة العامة", entity: "accounting_period", entityId: next.id,
    details: next.name, user,
  });

  return next;
}

/** يُعيد فتح فترة مغلقة — إجراء استثنائي يحتاج سببًا. */
export function reopenPeriod(id, { reason, user } = {}) {
  const period = find("accountingPeriods", id);
  if (!period) throw notFound("الفترة غير موجودة.");

  if (period.status !== "closed") {
    throw ruleViolation("لا يُعاد فتح إلا فترة مغلقة.");
  }
  if (!String(reason ?? "").trim()) {
    throw ruleViolation("إعادة فتح فترة تتطلب سببًا — للتدقيق.", { field: "reason" });
  }

  /* الفترات اللاحقة المغلقة تمنع إعادة الفتح — وإلا تناقض التسلسل. */
  const laterClosed = all("accountingPeriods").filter(
    (row) =>
      row.fiscalYearId === period.fiscalYearId &&
      row.number > period.number &&
      row.status === "closed",
  );

  if (laterClosed.length) {
    throw ruleViolation(
      `لا يمكن إعادة فتح «${period.name}» وهناك فترات لاحقة مغلقة ` +
        `(${laterClosed.map((row) => row.name).join("، ")}). أعد فتحها بالترتيب العكسي.`,
    );
  }

  const next = update("accountingPeriods", id, {
    status: "open",
    closedAt: null,
    closedBy: null,
    reopenReason: String(reason).trim(),
    reopenedBy: user?.name ?? "—",
    reopenedAt: new Date().toISOString(),
  });

  audit({
    action: "period.reopen", actionLabel: "إعادة فتح فترة محاسبية", severity: "critical",
    module: "المحاسبة العامة", entity: "accounting_period", entityId: next.id,
    details: `${next.name} — ${reason}`, user,
  });

  return next;
}

/**
 * معاينة إغلاق السنة المالية.
 *
 * تُعيد ما سيحدث **دون تنفيذه**: حسابات النتيجة التي ستُقفل، والمبلغ الذي
 * سيُرحَّل إلى الأرباح المرحلة. إغلاق السنة عملية لا رجعة فيها عمليًا، فعرض
 * نتيجتها قبل تنفيذها ليس رفاهية.
 */
export function previewYearClosing(fiscalYearId) {
  const year = find("fiscalYears", fiscalYearId);
  if (!year) throw notFound("السنة المالية غير موجودة.");

  const result = incomeStatement(all("accounts"), movements(), {
    dateFrom: year.startDate,
    dateTo: year.endDate,
  });

  const openPeriods = all("accountingPeriods").filter(
    (period) => period.fiscalYearId === year.id && period.status === "open",
  );

  return {
    fiscalYear: year,
    revenues: result.revenues,
    expenses: result.expenses,
    totalRevenue: result.totalRevenue,
    totalExpenses: result.totalExpenses,
    netIncome: result.netIncome,
    accountsToClose: result.revenues.length + result.expenses.length,
    retainedEarningsAccountId: db.postingMap.retainedEarnings,
    /** الإغلاق لا يُنفَّذ قبل إغلاق كل فترات السنة. */
    blockers: openPeriods.length
      ? [`${openPeriods.length} فترة لا تزال مفتوحة: ${openPeriods.map((period) => period.name).join("، ")}`]
      : [],
    canClose: openPeriods.length === 0 && year.status === "open",
  };
}
