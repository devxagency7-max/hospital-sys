/**
 * خدمة لوحة التحكم — المؤشرات العليا عبر الموديولات الأربعة.
 *
 * كل رقم هنا مُشتَق من نفس المحركات التي تُغذّي الشاشات التفصيلية، لا محسوب
 * بطريقة ثانية: مؤشر في لوحة التحكم يخالف الشاشة التي يفتحها بالنقر عليه
 * يُفقد اللوحة كلها الثقة.
 */

import * as money from "../../core/money.js";
import { incomeStatement, balanceSheet, toMovements } from "../../domain/ledger.js";
import { agingReport, agingDistribution, collectionHealth } from "../../domain/aging.js";
import { EntryStatus } from "../../domain/posting.js";
import { PayrollStatus } from "../../domain/payroll.js";
import { expiryExposure } from "../../domain/valuation.js";
import { db, all } from "../db.js";
import { REFERENCE_DATE, CURRENT_PERIOD, endOfMonth } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);
const YEAR_START = `${TODAY.slice(0, 4)}-01-01`;
const MONTH_START = `${CURRENT_PERIOD}-01`;

export function getSummary() {
  const accounts = all("accounts");
  const entries = all("journalEntries");
  const movements = toMovements(entries);

  /* ===================== المحاسبة ===================== */

  const yearToDate = incomeStatement(accounts, movements, { dateFrom: YEAR_START, dateTo: TODAY });
  const thisMonth = incomeStatement(accounts, movements, { dateFrom: MONTH_START, dateTo: TODAY });
  const lastMonth = incomeStatement(accounts, movements, {
    dateFrom: previousPeriodStart(),
    dateTo: endOfMonth(previousPeriod()),
  });

  const position = balanceSheet(accounts, movements, {
    asOf: TODAY,
    fiscalYearStart: YEAR_START,
  });

  const pendingEntries = entries.filter((entry) =>
    [EntryStatus.DRAFT, EntryStatus.PENDING, EntryStatus.APPROVED].includes(entry.status),
  );

  /* ===================== الذمم ===================== */

  const receivables = agingReport(
    all("customerInvoices").map((invoice) => ({ ...invoice, partyId: invoice.customerId })),
    { asOf: TODAY, parties: all("customers") },
  );

  const payables = agingReport(
    all("supplierInvoices").map((invoice) => ({ ...invoice, partyId: invoice.supplierId })),
    { asOf: TODAY, parties: all("suppliers") },
  );

  /* ===================== النقدية ===================== */

  const cashBoxes = all("cashBoxes");
  const bankAccounts = all("bankAccounts");

  const cashTotal = money.sumBy(cashBoxes, "balance");
  const bankTotal = money.sumBy(bankAccounts, "balance");

  /* ===================== الموارد البشرية ===================== */

  const employees = all("employees");
  const active = employees.filter((row) => ["employed", "probation"].includes(row.status));
  const currentRun = all("payrollRuns").find((run) => run.period === CURRENT_PERIOD);

  const monthAttendance = all("attendanceRecords").filter(
    (row) => String(row.date).slice(0, 7) === CURRENT_PERIOD,
  );

  /* ===================== المخازن ===================== */

  const balances = all("stockBalances");
  const exposure = expiryExposure(all("batches"), {
    asOf: TODAY,
    nearExpiryDays: db.systemPreferences.nearExpiryWarningDays,
  });

  return {
    asOf: REFERENCE_DATE.toISOString(),
    period: CURRENT_PERIOD,
    company: { name: db.companyInfo.name, currency: db.companyInfo.currencyLabel },

    /* --- نبض الشهر --- */
    performance: {
      revenueThisMonth: thisMonth.totalRevenue,
      expensesThisMonth: thisMonth.totalExpenses,
      profitThisMonth: thisMonth.netIncome,
      revenueLastMonth: lastMonth.totalRevenue,
      profitLastMonth: lastMonth.netIncome,
      revenueGrowth: growth(thisMonth.totalRevenue, lastMonth.totalRevenue),
      profitGrowth: growth(thisMonth.netIncome, lastMonth.netIncome),

      revenueYearToDate: yearToDate.totalRevenue,
      expensesYearToDate: yearToDate.totalExpenses,
      profitYearToDate: yearToDate.netIncome,
      netMarginYearToDate: yearToDate.netMargin,
    },

    /* --- المركز المالي --- */
    position: {
      totalAssets: position.totalAssets,
      totalLiabilities: position.totalLiabilities,
      totalEquity: position.totalEquity,
      isBalanced: position.isBalanced,
      /** نسبة التداول — مؤشر سيولة أساسي. */
      workingCapital: money.subtract(
        money.sum([cashTotal, bankTotal, receivables.totals.total, inventoryValue(balances)]),
        payables.totals.total,
      ),
    },

    /* --- النقدية --- */
    treasury: {
      cashTotal,
      bankTotal,
      liquidTotal: money.add(cashTotal, bankTotal),
      cashBoxesCount: cashBoxes.filter((row) => row.status === "active").length,
      bankAccountsCount: bankAccounts.filter((row) => row.status === "active").length,
      overdrawnAccounts: bankAccounts.filter((row) => money.isNegative(row.balance)).length,
      unreconciledTransactions: all("bankTransactions").filter((row) => !row.reconciled).length,
    },

    /* --- الذمم --- */
    receivables: {
      total: receivables.totals.total,
      overdue: money.sum([
        receivables.totals.d1_30, receivables.totals.d31_60, receivables.totals.d61_90,
        receivables.totals.d91_180, receivables.totals.over_180,
      ]),
      current: receivables.totals.current,
      customersCount: receivables.totals.partiesCount,
      invoicesCount: receivables.totals.invoicesCount,
      overLimit: receivables.totals.overLimit,
      collectionHealth: collectionHealth(receivables.totals),
      distribution: agingDistribution(receivables.totals),
      /** أكبر خمسة أرصدة — بداية متابعة التحصيل. */
      top: receivables.rows.slice(0, 5).map((row) => ({
        id: row.partyId, code: row.code, name: row.name,
        balance: row.total, oldestDays: row.oldestDays, overLimit: row.overLimit,
      })),
    },

    payables: {
      total: payables.totals.total,
      current: payables.totals.current,
      overdue: money.sum([
        payables.totals.d1_30, payables.totals.d31_60, payables.totals.d61_90,
        payables.totals.d91_180, payables.totals.over_180,
      ]),
      suppliersCount: payables.totals.partiesCount,
      invoicesCount: payables.totals.invoicesCount,
      distribution: agingDistribution(payables.totals),
      top: payables.rows.slice(0, 5).map((row) => ({
        id: row.partyId, code: row.code, name: row.name,
        balance: row.total, oldestDays: row.oldestDays,
      })),
    },

    /* --- الموارد البشرية --- */
    hr: {
      headcount: active.length,
      totalEmployees: employees.length,
      onProbation: employees.filter((row) => row.status === "probation").length,
      departments: all("departments").length,
      payrollCostThisMonth: currentRun?.totals.employerCost ?? 0,
      netPayThisMonth: currentRun?.totals.netPay ?? 0,
      payrollStatus: currentRun?.status ?? null,
      payrollStatusLabel: PAYROLL_STATUS_LABELS[currentRun?.status] ?? "—",
      presentToday: monthAttendance.filter((row) => row.date === TODAY && ["present", "late"].includes(row.status)).length,
      absentToday: monthAttendance.filter((row) => row.date === TODAY && row.status === "absent").length,
      onLeaveToday: monthAttendance.filter((row) => row.date === TODAY && row.status === "on_leave").length,
      pendingLeaveRequests: all("leaveRequests").filter((row) => row.status === "pending").length,
      outstandingAdvances: money.sumBy(all("employeeAdvances"), "outstanding"),
    },

    /* --- المخازن --- */
    inventory: {
      itemsCount: all("items").filter((row) => row.status === "active").length,
      warehousesCount: all("warehouses").filter((row) => row.status === "active").length,
      totalValue: inventoryValue(balances),
      lowStock: balances.filter((row) => row.status === "low_stock").length,
      outOfStock: balances.filter((row) => row.status === "out_of_stock").length,
      overStock: balances.filter((row) => row.status === "over_stock").length,
      expiredBatches: exposure.expired.length,
      nearExpiryBatches: exposure.nearExpiry.length,
      expiryExposure: exposure.totalExposure,
      movementsThisMonth: all("stockMovements").filter(
        (row) => String(row.date).slice(0, 7) === CURRENT_PERIOD,
      ).length,
    },

    /* --- ما يحتاج إجراءً --- */
    approvals: buildApprovals({ entries, pendingEntries }),

    /* --- الفترة المحاسبية --- */
    accounting: {
      openPeriods: all("accountingPeriods").filter((row) => row.status === "open").length,
      currentPeriod: all("accountingPeriods").find((row) => row.periodKey === CURRENT_PERIOD) ?? null,
      entriesThisMonth: entries.filter((entry) => String(entry.date).slice(0, 7) === CURRENT_PERIOD).length,
      postedThisMonth: entries.filter(
        (entry) => String(entry.date).slice(0, 7) === CURRENT_PERIOD && entry.status === EntryStatus.POSTED,
      ).length,
      unbalancedEntries: entries.filter(
        (entry) => !money.equals(entry.totalDebit, entry.totalCredit),
      ).length,
    },

    /* --- سلسلة 12 شهرًا للرسم البياني --- */
    monthlyTrend: monthlyTrend(accounts, movements),

    /* --- توزيع الإيراد والمصروف على مراكز التكلفة --- */
    costCenters: costCenterBreakdown(accounts, movements),

    /* --- أحدث النشاط --- */
    recentEntries: entries
      .filter((entry) => entry.status === EntryStatus.POSTED)
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        entryNumber: entry.entryNumber,
        date: entry.date,
        description: entry.description,
        amount: entry.totalDebit,
        sourceType: entry.sourceType,
      })),

    recentAudit: all("auditLogs").slice(0, 10),

    /* --- صحة البيانات: المطابقة بين الأستاذ المساعد والحساب الرقابي --- */
    reconciliation: db.subsidiaryReconciliation.map((row) => ({
      key: row.key,
      label: row.label,
      difference: row.difference,
      isReconciled: row.isReconciled,
    })),
  };
}

/* -------------------------------------------------------------------------- */

const PAYROLL_STATUS_LABELS = {
  [PayrollStatus.DRAFT]: "مسوّدة",
  [PayrollStatus.CALCULATED]: "محسوب — بانتظار الاعتماد",
  [PayrollStatus.PENDING]: "بانتظار الاعتماد",
  [PayrollStatus.APPROVED]: "معتمد — بانتظار الصرف",
  [PayrollStatus.PAID]: "مصروف",
  [PayrollStatus.CANCELLED]: "ملغى",
};

function inventoryValue(balances) {
  return money.sumBy(balances, "totalValue");
}

/**
 * ما ينتظر قرارًا، موزَّعًا على نوعه.
 *
 * `total` مجموع البنود لا رقم مستقل: بطاقة «12 إجراء معلَّق» يجب أن تساوي
 * مجموع ما تفتحه الشاشة بالنقر عليها، وإلا لم يُعرف أيهما الصحيح.
 */
function buildApprovals({ entries, pendingEntries }) {
  const items = {
    journalEntries: pendingEntries.length,
    journalDrafts: entries.filter((entry) => entry.status === EntryStatus.DRAFT).length,
    creditNotes: all("customerCreditNotes").filter((row) => row.status === "pending").length,
    stockAdjustments: all("stockMovements").filter((row) => row.status === "pending_approval").length,
    leaveRequests: all("leaveRequests").filter((row) => row.status === "pending").length,
    payrollRuns: all("payrollRuns").filter((run) => run.status === PayrollStatus.CALCULATED).length,
    stockCounts: all("stockCounts").filter((row) => row.status === "counting").length,
  };

  /*
   * `journalDrafts` مُستبعدة من المجموع: المسوّدة عمل لم يُقدَّم بعد ولا
   * تنتظر قرار أحد. عدّها ضمن «المعلَّق» يُظهر لمدير الحسابات طابورًا لا
   * يستطيع تفريغه.
   */
  const total = Object.entries(items)
    .filter(([key]) => key !== "journalDrafts")
    .reduce((sum, [, value]) => sum + value, 0);

  return { ...items, total };
}

/** النمو بين فترتين. القاعدة الصفرية لا يُقسَّم عليها. */
function growth(current, previous) {
  if (money.isZero(previous)) return null;
  return money.subtract(current, previous) / Math.abs(previous);
}

function previousPeriod() {
  const [year, month] = CURRENT_PERIOD.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return date.toISOString().slice(0, 7);
}

function previousPeriodStart() {
  return `${previousPeriod()}-01`;
}

/** إيراد ومصروف وربح كل شهر من بداية السنة. */
function monthlyTrend(accounts, movements) {
  const months = [];
  const currentMonth = Number(CURRENT_PERIOD.slice(5, 7));

  for (let month = 1; month <= currentMonth; month += 1) {
    const period = `${CURRENT_PERIOD.slice(0, 4)}-${String(month).padStart(2, "0")}`;
    const result = incomeStatement(accounts, movements, {
      dateFrom: `${period}-01`,
      dateTo: endOfMonth(period),
    });

    months.push({
      period,
      label: MONTH_NAMES[month - 1],
      revenue: result.totalRevenue,
      expenses: result.totalExpenses,
      profit: result.netIncome,
      /** الشهر الجاري ناقص بطبيعته — تُعلِمه الشاشة بوضوح. */
      isPartial: period === CURRENT_PERIOD,
    });
  }

  return months;
}

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function costCenterBreakdown(accounts, movements) {
  const byId = new Map(accounts.map((account) => [String(account.id), account]));
  const centers = all("costCenters");
  const buckets = new Map();

  for (const movement of movements) {
    const account = byId.get(String(movement.accountId));
    if (!account || !["revenue", "expense"].includes(account.type)) continue;
    if (String(movement.date).slice(0, 4) !== CURRENT_PERIOD.slice(0, 4)) continue;

    const key = String(movement.costCenterId ?? "__unassigned__");
    const bucket = buckets.get(key) ?? { revenue: 0, expense: 0 };

    const amount =
      account.type === "revenue"
        ? money.subtract(movement.credit, movement.debit)
        : money.subtract(movement.debit, movement.credit);

    if (account.type === "revenue") bucket.revenue = money.add(bucket.revenue, amount);
    else bucket.expense = money.add(bucket.expense, amount);

    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const center = centers.find((row) => String(row.id) === key);
      return {
        costCenterId: key === "__unassigned__" ? null : Number(key),
        code: center?.code ?? "—",
        name: center?.name ?? "غير موزَّع",
        revenue: bucket.revenue,
        expense: bucket.expense,
        profit: money.subtract(bucket.revenue, bucket.expense),
      };
    })
    .sort((a, b) => money.toMinor(b.expense) - money.toMinor(a.expense))
    .slice(0, 8);
}
