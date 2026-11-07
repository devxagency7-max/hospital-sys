/**
 * دليل الحسابات — البنية والطبيعة والترميز.
 *
 * دوال خالصة على شجرة الحسابات: الهرمية، طبيعة الحساب (مدين/دائن)، توليد
 * الأكواد، والتحقق من صحة الدليل. لا DOM ولا شبكة.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  قاعدة مركزية: **لا يُرحَّل قيد إلا على حساب تفصيلي (ورقة في الشجرة).**
 *
 *  السبب: لو قُبل الترحيل على حساب أب، صار رصيده = حركاته المباشرة + مجموع
 *  أبنائه، وهما مفهومان مختلفان يظهران في نفس الخلية. ميزان المراجعة يحتاج
 *  أن يجمع الأوراق فقط؛ وجود حركة على أب يجعل المجموع مزدوج العدّ.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";

/* ==========================================================================
   1) أنواع الحسابات
   ========================================================================== */

export const AccountType = Object.freeze({
  ASSET: "asset",
  LIABILITY: "liability",
  EQUITY: "equity",
  REVENUE: "revenue",
  EXPENSE: "expense",
});

/** الطبيعة الطبيعية لكل نوع — الجانب الذي يزيد فيه الرصيد. */
export const NATURAL_NATURE = Object.freeze({
  [AccountType.ASSET]: "debit",
  [AccountType.LIABILITY]: "credit",
  [AccountType.EQUITY]: "credit",
  [AccountType.REVENUE]: "credit",
  [AccountType.EXPENSE]: "debit",
});

export const TYPE_LABELS = Object.freeze({
  [AccountType.ASSET]: "أصول",
  [AccountType.LIABILITY]: "خصوم والتزامات",
  [AccountType.EQUITY]: "حقوق ملكية",
  [AccountType.REVENUE]: "إيرادات",
  [AccountType.EXPENSE]: "مصروفات",
});

/** الأنواع التي تدخل قائمة المركز المالي (الميزانية). */
export const BALANCE_SHEET_TYPES = Object.freeze([
  AccountType.ASSET,
  AccountType.LIABILITY,
  AccountType.EQUITY,
]);

/** الأنواع التي تدخل قائمة الدخل وتُقفل في نهاية السنة. */
export const INCOME_STATEMENT_TYPES = Object.freeze([
  AccountType.REVENUE,
  AccountType.EXPENSE,
]);

export const isBalanceSheetAccount = (account) => BALANCE_SHEET_TYPES.includes(account?.type);
export const isIncomeStatementAccount = (account) => INCOME_STATEMENT_TYPES.includes(account?.type);

/**
 * طبيعة الحساب الفعلية.
 *
 * تُقرأ من الحساب إن حُدِّدت صراحةً — حسابات المقابلة (contra) تخالف طبيعة
 * نوعها: «مجمع الإهلاك» أصل بطبيعة دائنة، و«مردودات المبيعات» إيراد بطبيعة
 * مدينة. تثبيت الطبيعة على النوع وحده يكسر هذه الحسابات.
 */
export function natureOf(account) {
  return account?.nature ?? NATURAL_NATURE[account?.type] ?? "debit";
}

/** هل هذا حساب مقابلة (طبيعته تخالف طبيعة نوعه)؟ */
export function isContraAccount(account) {
  return natureOf(account) !== NATURAL_NATURE[account?.type];
}

/**
 * يحوّل مدين/دائن إلى رصيد موقَّع حسب طبيعة الحساب.
 * الموجب = الرصيد في جانبه الطبيعي.
 */
export function signedBalance(account, { debit = 0, credit = 0 } = {}) {
  return natureOf(account) === "debit"
    ? money.subtract(debit, credit)
    : money.subtract(credit, debit);
}

/* ==========================================================================
   2) الهرمية
   ========================================================================== */

/** يبني فهرس `parentId → children[]`. */
export function indexChildren(accounts = []) {
  const map = new Map();

  for (const account of accounts) {
    const key = account.parentId ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(account);
  }

  for (const siblings of map.values()) {
    siblings.sort((a, b) => String(a.code).localeCompare(String(b.code), "en", { numeric: true }));
  }

  return map;
}

/** الحسابات الجذرية (بلا أب) مرتبة بالكود. */
export function rootAccounts(accounts = []) {
  return indexChildren(accounts).get(null) ?? [];
}

/** الأبناء المباشرون لحساب. */
export function childrenOf(accounts, accountId) {
  return accounts.filter((account) => String(account.parentId) === String(accountId));
}

/**
 * الحسابات التفصيلية (أوراق الشجرة) — وحدها قابلة للترحيل عليها.
 *
 * الورقة = حساب لا أبناء له. لا نعتمد على `level` لأن عمق الدليل يختلف من
 * فرع لآخر: «رأس المال» ورقة في المستوى الثاني، وحساب بنك ورقة في الرابع.
 */
export function leafAccounts(accounts = []) {
  const parents = new Set(
    accounts.map((account) => account.parentId).filter((id) => id !== null && id !== undefined).map(String),
  );
  return accounts.filter((account) => !parents.has(String(account.id)));
}

export function isLeaf(accounts, accountId) {
  return !accounts.some((account) => String(account.parentId) === String(accountId));
}

/** كل الأجداد من الأقرب إلى الجذر. */
export function ancestorsOf(accounts, accountId) {
  const byId = new Map(accounts.map((account) => [String(account.id), account]));
  const out = [];

  let cursor = byId.get(String(accountId))?.parentId;
  while (cursor !== null && cursor !== undefined) {
    const parent = byId.get(String(cursor));
    if (!parent) break;
    out.push(parent);
    cursor = parent.parentId;
  }

  return out;
}

/** كل الأبناء على كل المستويات. */
export function descendantsOf(accounts, accountId) {
  const index = indexChildren(accounts);
  const out = [];
  const stack = [...(index.get(accountId) ?? index.get(Number(accountId)) ?? [])];

  while (stack.length) {
    const account = stack.pop();
    out.push(account);
    stack.push(...(index.get(account.id) ?? []));
  }

  return out;
}

/**
 * يُسطّح الشجرة بترتيب العرض (أب ثم أبناؤه)، ويُرفق `depth` لكل حساب.
 * هذا هو الترتيب الذي يتوقعه كل عرض شجري وكل ميزان مراجعة هرمي.
 */
export function flattenTree(accounts = [], { parentId = null, depth = 0 } = {}) {
  const index = indexChildren(accounts);
  const out = [];

  const walk = (currentParent, currentDepth) => {
    for (const account of index.get(currentParent) ?? []) {
      out.push({ ...account, depth: currentDepth, isLeaf: !(index.get(account.id) ?? []).length });
      walk(account.id, currentDepth + 1);
    }
  };

  walk(parentId, depth);
  return out;
}

/** المسار المقروء: «الأصول ← الأصول المتداولة ← النقدية». */
export function accountPath(accounts, accountId, separator = " ← ") {
  const account = accounts.find((row) => String(row.id) === String(accountId));
  if (!account) return "";

  return [...ancestorsOf(accounts, accountId).reverse(), account]
    .map((row) => row.name)
    .join(separator);
}

/* ==========================================================================
   3) الترميز
   ========================================================================== */

/**
 * يولّد كود الحساب الفرعي التالي تحت أب.
 *
 * الكود يُبنى بالإضافة لا بالعدّ: `112` + التالي = `1121`. ولا يُعاد استخدام
 * كود حساب موجود حتى لو أُلغي — الكود مرجع تاريخي في مستندات مُرحَّلة.
 */
export function nextChildCode(accounts, parentId, { width = 1 } = {}) {
  const parent = accounts.find((row) => String(row.id) === String(parentId));
  if (!parent) return "";

  const siblings = childrenOf(accounts, parentId);
  const prefix = String(parent.code);

  const highest = siblings.reduce((max, sibling) => {
    const suffix = String(sibling.code).slice(prefix.length);
    const numeric = Number(suffix);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);

  return `${prefix}${String(highest + 1).padStart(width, "0")}`;
}

/* ==========================================================================
   4) التحقق
   ========================================================================== */

/** يرفض الترحيل على حساب غير تفصيلي أو غير نشط. */
export function assertPostable(accounts, accountId) {
  const account = accounts.find((row) => String(row.id) === String(accountId));

  if (!account) {
    throw ruleViolation(`الحساب ${accountId} غير موجود في الدليل.`, { field: "accountId" });
  }

  if (!isLeaf(accounts, accountId)) {
    throw ruleViolation(
      `الحساب «${account.name}» (${account.code}) حساب رئيسي له حسابات فرعية. ` +
        "الترحيل يكون على الحسابات التفصيلية فقط.",
      { field: "accountId" },
    );
  }

  if (account.status && account.status !== "active") {
    throw ruleViolation(
      `الحساب «${account.name}» غير نشط. لا يُقبل الترحيل عليه.`,
      { field: "accountId" },
    );
  }

  return account;
}

/**
 * يفحص سلامة الدليل كله. يُستخدم في شاشة الدليل وفي الاختبارات.
 *
 * @returns {Array<{ code:string, severity:"error"|"warning", message:string }>}
 */
export function validateChart(accounts = []) {
  const problems = [];
  const byId = new Map(accounts.map((account) => [String(account.id), account]));
  const seenCodes = new Map();

  for (const account of accounts) {
    /* --- كود مكرر --- */
    if (seenCodes.has(account.code)) {
      problems.push({
        code: account.code,
        severity: "error",
        message: `كود مكرر «${account.code}» على حسابين: «${seenCodes.get(account.code)}» و«${account.name}».`,
      });
    } else {
      seenCodes.set(account.code, account.name);
    }

    /* --- أب مفقود --- */
    if (account.parentId !== null && account.parentId !== undefined && !byId.has(String(account.parentId))) {
      problems.push({
        code: account.code,
        severity: "error",
        message: `الحساب «${account.name}» يشير إلى حساب أب غير موجود (${account.parentId}).`,
      });
      continue;
    }

    const parent = account.parentId ? byId.get(String(account.parentId)) : null;

    /* --- نوع مخالف للأب --- */
    if (parent && parent.type !== account.type) {
      problems.push({
        code: account.code,
        severity: "error",
        message:
          `«${account.name}» من نوع ${TYPE_LABELS[account.type] ?? account.type} ` +
          `تحت أب من نوع ${TYPE_LABELS[parent.type] ?? parent.type}. ` +
          "الفرع يتبع نوع أبيه.",
      });
    }

    /* --- كود لا يبدأ بكود الأب --- */
    if (parent && !String(account.code).startsWith(String(parent.code))) {
      problems.push({
        code: account.code,
        severity: "warning",
        message: `كود «${account.name}» (${account.code}) لا يبدأ بكود أبيه (${parent.code}).`,
      });
    }
  }

  /* --- دورة في الشجرة --- */
  for (const account of accounts) {
    const seen = new Set([String(account.id)]);
    let cursor = account.parentId;

    while (cursor !== null && cursor !== undefined) {
      if (seen.has(String(cursor))) {
        problems.push({
          code: account.code,
          severity: "error",
          message: `دورة في الهرمية عند الحساب «${account.name}».`,
        });
        break;
      }
      seen.add(String(cursor));
      cursor = byId.get(String(cursor))?.parentId;
    }
  }

  return problems;
}
