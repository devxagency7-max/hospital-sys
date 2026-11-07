/**
 * محرك دفتر الأستاذ — من القيود إلى الأرصدة والقوائم المالية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  كل رقم محاسبي في النظام يُحسَب من القيود المُرحَّلة هنا — لا من حقل
 *  `balance` مخزَّن على الحساب.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * السبب: الرصيد المخزَّن مصدر حقيقة ثانٍ. وأي مصدر حقيقة ثانٍ يتباعد عن
 * الأول — قيد يُرحَّل ويفشل تحديث الرصيد، أو يُعكَس قيد ولا يُخفَّض الرصيد،
 * فيعرض الميزان أرقامًا لا تجمعها حركات الدفتر ولا يُعرف أيهما الصحيح.
 * الاشتقاق من الحركات أبطأ قليلًا وصحيح دائمًا.
 *
 * دوال خالصة. لا DOM ولا شبكة ولا استيراد من js/mock.
 */

import * as money from "../core/money.js";
import {
  AccountType,
  natureOf,
  signedBalance,
  statementAmount,
  indexChildren,
  leafAccounts,
  isIncomeStatementAccount,
} from "./accounts.js";
import { affectsBalances } from "./posting.js";

/* ==========================================================================
   1) تسطيح الحركات
   ========================================================================== */

/**
 * يحوّل القيود إلى حركات مفردة على مستوى السطر.
 *
 * القيود المُرحَّلة فقط: المسوّدة والمعتمدة لم تدخل الدفتر بعد، والمعكوسة
 * بقي أثرها الأصلي في الدفتر مقابل قيدها العكسي فيصير الصافي صفرًا تلقائيًا
 * — لا نستبعدها، وإلا بقي القيد العكسي وحده وانعكس الرصيد خطأً.
 *
 * @param {object[]} entries قيود اليومية
 * @returns {Array<object>} حركات `{ accountId, debit, credit, date, entryId, ... }`
 */
export function toMovements(entries = []) {
  const out = [];

  for (const entry of entries) {
    // القيد المعكوس يبقى: قيده العكسي مُرحَّل أيضًا والصافي صفر.
    if (!affectsBalances(entry) && entry?.status !== "reversed") continue;

    for (const line of entry.lines ?? []) {
      out.push({
        accountId: line.accountId,
        debit: money.round(line.debit ?? 0),
        credit: money.round(line.credit ?? 0),
        date: entry.date,
        entryId: entry.id,
        entryNumber: entry.entryNumber,
        entryDescription: entry.description,
        lineDescription: line.description,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        reference: entry.reference,
        costCenterId: line.costCenterId ?? entry.costCenterId ?? null,
        partyType: line.partyType ?? null,
        partyId: line.partyId ?? null,
      });
    }
  }

  return out;
}

/** يُرشِّح الحركات بنطاق تاريخ ومركز تكلفة. */
export function filterMovements(movements = [], { dateFrom, dateTo, costCenterId, accountIds } = {}) {
  const wantedAccounts = accountIds ? new Set(accountIds.map(String)) : null;

  return movements.filter((movement) => {
    const day = String(movement.date ?? "").slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    if (costCenterId && String(movement.costCenterId) !== String(costCenterId)) return false;
    if (wantedAccounts && !wantedAccounts.has(String(movement.accountId))) return false;
    return true;
  });
}

/* ==========================================================================
   2) أرصدة الحسابات
   ========================================================================== */

/**
 * يجمع المدين والدائن لكل حساب من الحركات.
 * @returns {Map<string, { debit:number, credit:number, count:number }>}
 */
export function aggregateByAccount(movements = []) {
  const map = new Map();

  for (const movement of movements) {
    const key = String(movement.accountId);
    const bucket = map.get(key) ?? { debit: 0, credit: 0, count: 0 };

    bucket.debit = money.add(bucket.debit, movement.debit);
    bucket.credit = money.add(bucket.credit, movement.credit);
    bucket.count += 1;

    map.set(key, bucket);
  }

  return map;
}

/**
 * رصيد حساب واحد في لحظة.
 *
 * @param {object} account
 * @param {object[]} movements حركات هذا الحساب فقط
 * @returns {{ debit:number, credit:number, balance:number, nature:string }}
 */
export function accountBalance(account, movements = []) {
  const debit = money.sumBy(movements, "debit");
  const credit = money.sumBy(movements, "credit");

  return {
    debit,
    credit,
    balance: signedBalance(account, { debit, credit }),
    nature: natureOf(account),
  };
}

/**
 * أرصدة كل الحسابات مع التجميع الهرمي.
 *
 * رصيد الحساب الأب = مجموع أرصدة أبنائه. وبما أن الترحيل ممنوع على الأب
 * (راجع `assertPostable`) فلا خطر عدّ مزدوج: الأوراق وحدها تحمل حركات.
 *
 * @returns {Map<string, { own:object, rolled:object }>}
 *   `own` من الحركات المباشرة، `rolled` بعد تجميع الأبناء.
 */
export function rollUpBalances(accounts = [], movements = []) {
  const aggregated = aggregateByAccount(movements);
  const childIndex = indexChildren(accounts);
  const result = new Map();

  const compute = (account) => {
    const key = String(account.id);
    if (result.has(key)) return result.get(key);

    const direct = aggregated.get(key) ?? { debit: 0, credit: 0, count: 0 };
    const own = {
      debit: direct.debit,
      credit: direct.credit,
      balance: signedBalance(account, direct),
      movements: direct.count,
    };

    let rolledDebit = direct.debit;
    let rolledCredit = direct.credit;
    let rolledCount = direct.count;

    for (const child of childIndex.get(account.id) ?? []) {
      const childResult = compute(child);
      rolledDebit = money.add(rolledDebit, childResult.rolled.debit);
      rolledCredit = money.add(rolledCredit, childResult.rolled.credit);
      rolledCount += childResult.rolled.movements;
    }

    const entry = {
      account,
      own,
      rolled: {
        debit: rolledDebit,
        credit: rolledCredit,
        balance: signedBalance(account, { debit: rolledDebit, credit: rolledCredit }),
        movements: rolledCount,
      },
    };

    result.set(key, entry);
    return entry;
  };

  for (const account of accounts) compute(account);
  return result;
}

/* ==========================================================================
   3) كشف حساب (دفتر الأستاذ العام)
   ========================================================================== */

/**
 * كشف حركة حساب واحد خلال فترة، برصيد متحرك.
 *
 * الرصيد الافتتاحي يُحسَب من كل الحركات **قبل** `dateFrom` — لا يُقرأ من
 * حقل مخزَّن. فتح الكشف على أي نطاق تاريخ يُنتج رصيدًا افتتاحيًا صحيحًا دائمًا.
 *
 * @param {object} account
 * @param {object[]} allMovements كل حركات النظام (تُرشَّح داخليًا)
 * @param {{ dateFrom?:string, dateTo?:string, costCenterId?:string }} range
 * @returns {{
 *   account:object, opening:object, rows:object[], period:object, closing:object
 * }}
 */
export function accountStatement(account, allMovements = [], range = {}) {
  const own = allMovements.filter(
    (movement) => String(movement.accountId) === String(account.id),
  );

  const scoped = range.costCenterId
    ? own.filter((movement) => String(movement.costCenterId) === String(range.costCenterId))
    : own;

  const openingMovements = range.dateFrom
    ? scoped.filter((movement) => String(movement.date).slice(0, 10) < range.dateFrom)
    : [];

  const periodMovements = filterMovements(scoped, {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  }).sort(
    (a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.entryNumber ?? "").localeCompare(String(b.entryNumber ?? "")),
  );

  const opening = accountBalance(account, openingMovements);

  // الرصيد المتحرك: كل سطر يحمل الرصيد بعده مباشرة.
  let running = opening.balance;
  const isDebitNature = natureOf(account) === "debit";

  const rows = periodMovements.map((movement) => {
    const delta = isDebitNature
      ? money.subtract(movement.debit, movement.credit)
      : money.subtract(movement.credit, movement.debit);

    running = money.add(running, delta);

    return { ...movement, runningBalance: running };
  });

  const period = accountBalance(account, periodMovements);

  return {
    account,
    opening,
    rows,
    period,
    closing: {
      debit: money.add(opening.debit, period.debit),
      credit: money.add(opening.credit, period.credit),
      balance: running,
      nature: natureOf(account),
    },
  };
}

/* ==========================================================================
   4) ميزان المراجعة
   ========================================================================== */

/**
 * ميزان المراجعة: افتتاحي + حركة الفترة = ختامي، لكل حساب.
 *
 * الحسابات التفصيلية فقط في العرض التفصيلي — جمع الأب مع أبنائه يُضاعف
 * المجاميع. العرض المُلخَّص يستخدم الأرصدة المُجمَّعة للمستويات العليا.
 *
 * @param {object[]} accounts
 * @param {object[]} movements كل حركات النظام
 * @param {{ dateFrom?:string, dateTo?:string, costCenterId?:string, includeZero?:boolean }} options
 */
export function trialBalance(accounts = [], movements = [], options = {}) {
  const { dateFrom, dateTo, costCenterId, includeZero = false } = options;

  const scoped = costCenterId
    ? movements.filter((movement) => String(movement.costCenterId) === String(costCenterId))
    : movements;

  const leaves = leafAccounts(accounts);

  const rows = leaves
    .map((account) => {
      const own = scoped.filter((movement) => String(movement.accountId) === String(account.id));

      const openingMovements = dateFrom
        ? own.filter((movement) => String(movement.date).slice(0, 10) < dateFrom)
        : [];
      const periodMovements = filterMovements(own, { dateFrom, dateTo });

      const opening = accountBalance(account, openingMovements);
      const period = accountBalance(account, periodMovements);

      const closingDebit = money.add(opening.debit, period.debit);
      const closingCredit = money.add(opening.credit, period.credit);
      const closingBalance = signedBalance(account, {
        debit: closingDebit,
        credit: closingCredit,
      });

      /*
       * عرض الرصيد في جانب واحد: الرصيد الموجب في جانب الطبيعة، والسالب في
       * الجانب المقابل. حساب مدين برصيد سالب يظهر في عمود «دائن» — وهذا هو
       * الشكل المتعارف عليه في ميزان المراجعة.
       */
      const nature = natureOf(account);
      const inNaturalSide = money.isPositive(closingBalance) || money.isZero(closingBalance);

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        nameEn: account.nameEn ?? null,
        type: account.type,
        nature,

        openingDebit: nature === "debit" ? money.max(opening.balance, 0) : 0,
        openingCredit: nature === "credit" ? money.max(opening.balance, 0) : 0,

        periodDebit: period.debit,
        periodCredit: period.credit,

        closingDebit:
          nature === "debit"
            ? inNaturalSide
              ? closingBalance
              : 0
            : inNaturalSide
              ? 0
              : money.multiply(closingBalance, -1),
        closingCredit:
          nature === "credit"
            ? inNaturalSide
              ? closingBalance
              : 0
            : inNaturalSide
              ? 0
              : money.multiply(closingBalance, -1),

        balance: closingBalance,
        movementsCount: periodMovements.length,
      };
    })
    .filter((row) => includeZero || row.movementsCount > 0 || !money.isZero(row.balance))
    .sort((a, b) => String(a.code).localeCompare(String(b.code), "en", { numeric: true }));

  const totals = {
    openingDebit: money.sumBy(rows, "openingDebit"),
    openingCredit: money.sumBy(rows, "openingCredit"),
    periodDebit: money.sumBy(rows, "periodDebit"),
    periodCredit: money.sumBy(rows, "periodCredit"),
    closingDebit: money.sumBy(rows, "closingDebit"),
    closingCredit: money.sumBy(rows, "closingCredit"),
  };

  return {
    rows,
    totals,
    /**
     * الميزان متوازن متى تساوى المدين والدائن في الأعمدة الثلاثة. عدم
     * التوازن هنا يعني قيدًا غير متوازن تسرّب إلى الدفتر — وهو عيب بيانات
     * لا عيب عرض، فنكشفه صريحًا بدل إخفائه.
     */
    isBalanced:
      money.equals(totals.periodDebit, totals.periodCredit) &&
      money.equals(totals.closingDebit, totals.closingCredit),
    difference: money.subtract(totals.closingDebit, totals.closingCredit),
  };
}

/* ==========================================================================
   5) القوائم المالية
   ========================================================================== */

/**
 * قائمة الدخل.
 *
 * الإيراد والمصروف يُقاسان على **حركة الفترة** لا على الرصيد الختامي:
 * حسابات النتيجة تُقفل في نهاية السنة، فرصيدها الختامي يخلط سنتين.
 */
export function incomeStatement(accounts = [], movements = [], { dateFrom, dateTo, costCenterId } = {}) {
  const scoped = filterMovements(movements, { dateFrom, dateTo, costCenterId });
  const aggregated = aggregateByAccount(scoped);

  const pick = (type) =>
    leafAccounts(accounts)
      .filter((account) => account.type === type)
      .map((account) => {
        const bucket = aggregated.get(String(account.id)) ?? { debit: 0, credit: 0 };
        return {
          accountId: account.id,
          code: account.code,
          name: account.name,
          /** التوقيع بحسب النوع — حسابات المقابلة تخرج سالبة فتُخصم. */
          amount: statementAmount(account, bucket),
        };
      })
      .filter((row) => !money.isZero(row.amount))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), "en", { numeric: true }));

  const revenues = pick(AccountType.REVENUE);
  const expenses = pick(AccountType.EXPENSE);

  const totalRevenue = money.sumBy(revenues, "amount");
  const totalExpenses = money.sumBy(expenses, "amount");
  const netIncome = money.subtract(totalRevenue, totalExpenses);

  return {
    period: { dateFrom, dateTo },
    revenues,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome,
    /** هامش صافي الربح. صفر الإيراد لا يُقسَّم عليه. */
    netMargin: money.isZero(totalRevenue) ? 0 : netIncome / totalRevenue,
  };
}

/**
 * قائمة المركز المالي (الميزانية) في تاريخ.
 *
 * صافي ربح الفترة الجارية يُضاف إلى حقوق الملكية صراحةً: حسابات النتيجة لم
 * تُقفل بعد، فبدون هذه الإضافة لا تتوازن الميزانية — وهو أشهر سبب لعدم
 * توازن ميزانية في نظام يُولّد القوائم من الحركات.
 */
export function balanceSheet(accounts = [], movements = [], { asOf, fiscalYearStart, costCenterId } = {}) {
  const upToDate = filterMovements(movements, { dateTo: asOf, costCenterId });
  const aggregated = aggregateByAccount(upToDate);

  const pick = (type) =>
    leafAccounts(accounts)
      .filter((account) => account.type === type)
      .map((account) => {
        const bucket = aggregated.get(String(account.id)) ?? { debit: 0, credit: 0 };
        return {
          accountId: account.id,
          code: account.code,
          name: account.name,
          /** التوقيع بحسب النوع — حسابات المقابلة تخرج سالبة فتُخصم. */
          amount: statementAmount(account, bucket),
        };
      })
      .filter((row) => !money.isZero(row.amount))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), "en", { numeric: true }));

  const assets = pick(AccountType.ASSET);
  const liabilities = pick(AccountType.LIABILITY);
  const equity = pick(AccountType.EQUITY);

  const totalAssets = money.sumBy(assets, "amount");
  const totalLiabilities = money.sumBy(liabilities, "amount");
  const postedEquity = money.sumBy(equity, "amount");

  const currentResult = incomeStatement(accounts, movements, {
    dateFrom: fiscalYearStart,
    dateTo: asOf,
    costCenterId,
  }).netIncome;

  const totalEquity = money.add(postedEquity, currentResult);

  return {
    asOf,
    assets,
    liabilities,
    equity,
    currentPeriodResult: currentResult,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: money.add(totalLiabilities, totalEquity),
    isBalanced: money.equals(totalAssets, money.add(totalLiabilities, totalEquity)),
    difference: money.subtract(totalAssets, money.add(totalLiabilities, totalEquity)),
  };
}

/**
 * قائمة التدفقات النقدية بالطريقة المباشرة.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  الطريقة المباشرة: نقرأ حركات حسابات النقدية والبنوك فعليًا ونصنّف كل
 *  حركة حسب الحساب المقابل لها في نفس القيد.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * مقصود أن تكون مباشرة لا غير مباشرة: الطريقة غير المباشرة تبدأ من صافي
 * الربح وتُعدّله بالبنود غير النقدية، وهي أسهل حسابيًا لكنها تُخفي من أين
 * جاء النقد فعلًا. والنظام يملك الحركات التفصيلية، فلا داعي للتقدير.
 *
 * @param {object[]} entries القيود كاملة (نحتاج السطر المقابل داخل كل قيد)
 * @param {Set<string>|string[]} cashAccountIds حسابات النقدية والبنوك
 */
export function cashFlowStatement(accounts = [], entries = [], { dateFrom, dateTo, cashAccountIds = [] } = {}) {
  const cashSet = new Set([...cashAccountIds].map(String));
  const byId = new Map(accounts.map((account) => [String(account.id), account]));

  const sections = {
    operating: { label: "التدفقات من الأنشطة التشغيلية", inflows: [], outflows: [] },
    investing: { label: "التدفقات من الأنشطة الاستثمارية", inflows: [], outflows: [] },
    financing: { label: "التدفقات من الأنشطة التمويلية", inflows: [], outflows: [] },
  };

  /** تصنيف النشاط من نوع الحساب المقابل. */
  const classify = (counterAccount) => {
    if (!counterAccount) return "operating";
    if (counterAccount.type === AccountType.EQUITY) return "financing";
    if (counterAccount.type === AccountType.ASSET && counterAccount.isFixedAsset) return "investing";
    if (counterAccount.cashFlowSection) return counterAccount.cashFlowSection;
    return "operating";
  };

  let opening = 0;
  let closing = 0;

  for (const entry of entries) {
    if (!affectsBalances(entry) && entry?.status !== "reversed") continue;

    const day = String(entry.date).slice(0, 10);
    const cashLines = (entry.lines ?? []).filter((line) => cashSet.has(String(line.accountId)));
    if (!cashLines.length) continue;

    const netCash = money.subtract(
      money.sumBy(cashLines, "debit"),
      money.sumBy(cashLines, "credit"),
    );

    if (dateFrom && day < dateFrom) {
      opening = money.add(opening, netCash);
      continue;
    }
    if (dateTo && day > dateTo) continue;

    closing = money.add(closing, netCash);

    // الطرف المقابل: أكبر سطر غير نقدي في القيد يُحدد طبيعة النشاط.
    const counterLines = (entry.lines ?? [])
      .filter((line) => !cashSet.has(String(line.accountId)))
      .sort(
        (a, b) =>
          money.toMinor(money.add(b.debit, b.credit)) - money.toMinor(money.add(a.debit, a.credit)),
      );

    const counterAccount = byId.get(String(counterLines[0]?.accountId));
    const bucket = sections[classify(counterAccount)];

    const record = {
      date: day,
      entryNumber: entry.entryNumber,
      description: entry.description,
      counterAccount: counterAccount?.name ?? "—",
      amount: money.isNegative(netCash) ? money.multiply(netCash, -1) : netCash,
    };

    if (money.isPositive(netCash)) bucket.inflows.push(record);
    else if (money.isNegative(netCash)) bucket.outflows.push(record);
  }

  const summarize = (bucket) => {
    const inflow = money.sumBy(bucket.inflows, "amount");
    const outflow = money.sumBy(bucket.outflows, "amount");
    return { ...bucket, inflow, outflow, net: money.subtract(inflow, outflow) };
  };

  const operating = summarize(sections.operating);
  const investing = summarize(sections.investing);
  const financing = summarize(sections.financing);

  const netChange = money.sum([operating.net, investing.net, financing.net]);

  return {
    period: { dateFrom, dateTo },
    operating,
    investing,
    financing,
    openingCash: opening,
    netChange,
    closingCash: money.add(opening, netChange),
    /** فحص تماسك: الافتتاحي + التغير = الختامي المحسوب من الحركات. */
    isConsistent: money.equals(money.add(opening, closing), money.add(opening, netChange)),
  };
}

/* ==========================================================================
   6) مراكز التكلفة
   ========================================================================== */

/**
 * تحليل مركز تكلفة: إيراداته ومصروفاته وربحيته خلال فترة.
 *
 * الحركات بلا مركز تكلفة تُجمَّع تحت «غير موزَّع» بدل إهمالها — إهمالها يجعل
 * مجموع المراكز أقل من قائمة الدخل بفرق لا يُفسَّر.
 */
export function costCenterAnalysis(accounts = [], movements = [], costCenters = [], { dateFrom, dateTo } = {}) {
  const scoped = filterMovements(movements, { dateFrom, dateTo });
  const byId = new Map(accounts.map((account) => [String(account.id), account]));

  const buckets = new Map();
  const bucketFor = (key) => {
    if (!buckets.has(key)) buckets.set(key, { revenue: 0, expense: 0, movements: 0 });
    return buckets.get(key);
  };

  for (const movement of scoped) {
    const account = byId.get(String(movement.accountId));
    if (!account || !isIncomeStatementAccount(account)) continue;

    const bucket = bucketFor(movement.costCenterId ?? "__unassigned__");
    const amount = statementAmount(account, { debit: movement.debit, credit: movement.credit });

    if (account.type === AccountType.REVENUE) bucket.revenue = money.add(bucket.revenue, amount);
    else bucket.expense = money.add(bucket.expense, amount);

    bucket.movements += 1;
  }

  const rows = [...buckets.entries()].map(([key, bucket]) => {
    const center = costCenters.find((row) => String(row.id) === String(key));
    const profit = money.subtract(bucket.revenue, bucket.expense);

    return {
      costCenterId: key === "__unassigned__" ? null : key,
      code: center?.code ?? "—",
      name: center?.name ?? (key === "__unassigned__" ? "غير موزَّع على مركز تكلفة" : `مركز ${key}`),
      revenue: bucket.revenue,
      expense: bucket.expense,
      profit,
      margin: money.isZero(bucket.revenue) ? 0 : profit / bucket.revenue,
      movements: bucket.movements,
    };
  });

  return {
    rows: rows.sort((a, b) => money.toMinor(b.profit) - money.toMinor(a.profit)),
    totals: {
      revenue: money.sumBy(rows, "revenue"),
      expense: money.sumBy(rows, "expense"),
      profit: money.sumBy(rows, "profit"),
    },
  };
}
