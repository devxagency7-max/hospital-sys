/**
 * خدمة الترحيل المحاسبي المركزية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  كل قيد يومية في النظام — يدويًا كان أو مُولَّدًا من موديول آخر — يُبنى هنا.
 *  لا موديول يكتب قيدًا بنفسه، ولا شاشة تُجمِّع سطور مدين/دائن يدويًا.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * دوال خالصة (pure): تأخذ مستندًا مصدريًا وخريطة حسابات، وتُعيد قيدًا متوازنًا.
 * لا DOM، ولا طلبات شبكة، ولا استيراد من js/mock. تعمل في المتصفح وفي Node
 * وفي الاختبارات بالتساوي.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  لماذا مركزية؟
 *
 *  أربعة موديولات تُولّد قيودًا: الرواتب، المخازن، العملاء، الموردون. لو بنى
 *  كل موديول قيوده بنفسه لاحتجنا أربع نسخ من نفس الضمانات الأربع (التوازن،
 *  الحماية من التكرار، المرجعية، القابلية للعكس) — وستتباعد النسخ. أربع
 *  تطبيقات لقاعدة «المدين = الدائن» تعني أن ثلاثًا منها ستنكسر بصمت.
 *
 *  لذلك: موديول يصف **الحدث** (مسيّر رواتب اعتُمد، إذن صرف نُفِّذ)، وهذه
 *  الوحدة تُترجمه إلى قيد. الموديول لا يعرف أي حساب يُدين أو يُدان.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";
import { ACCOUNTING } from "../core/config.js";

/* ==========================================================================
   1) المفردات
   ========================================================================== */

/** دورة حياة قيد اليومية. */
export const EntryStatus = Object.freeze({
  /** قابل للتعديل الكامل. لا يظهر في أي رصيد. */
  DRAFT: "draft",
  /** مُقدَّم للمراجعة. لا يزال خارج الأرصدة. */
  PENDING: "pending_approval",
  /** مُعتمَد ولم يُرحَّل بعد — بوابة الفصل بين من يعتمد ومن يُرحّل. */
  APPROVED: "approved",
  /** مُرحَّل. يدخل الأرصدة، ولا يُعدَّل ولا يُحذف أبدًا. */
  POSTED: "posted",
  /** مُعكَّس بقيد مقابل. يبقى في الدفتر للتدقيق، وصافي أثره صفر. */
  REVERSED: "reversed",
});

/**
 * أنواع الأحداث التي تُولّد قيودًا تلقائية.
 *
 * `MANUAL` هو النوع الوحيد الذي يُنشئه مستخدم مباشرة؛ الباقي كله يأتي من
 * مستند في موديول آخر، ويحمل `sourceType` + `sourceId` للتتبّع العكسي.
 */
export const SourceType = Object.freeze({
  MANUAL: "manual",

  /* المحاسبة المالية — العملاء */
  CUSTOMER_INVOICE: "customer_invoice",
  CUSTOMER_RECEIPT: "customer_receipt",
  CUSTOMER_CREDIT_NOTE: "customer_credit_note",

  /* المحاسبة المالية — الموردون */
  SUPPLIER_INVOICE: "supplier_invoice",
  SUPPLIER_PAYMENT: "supplier_payment",
  SUPPLIER_RETURN: "supplier_return",

  /* المحاسبة المالية — الخزينة والبنوك */
  CASH_RECEIPT: "cash_receipt",
  CASH_PAYMENT: "cash_payment",
  CASH_TRANSFER: "cash_transfer",
  BANK_DEPOSIT: "bank_deposit",
  BANK_WITHDRAWAL: "bank_withdrawal",

  /* المحاسبة المالية — الأصول الثابتة */
  ASSET_ACQUISITION: "asset_acquisition",
  ASSET_DEPRECIATION: "asset_depreciation",
  ASSET_DISPOSAL: "asset_disposal",

  /* الموارد البشرية */
  PAYROLL_APPROVAL: "payroll_approval",
  PAYROLL_PAYMENT: "payroll_payment",
  EMPLOYEE_ADVANCE: "employee_advance",

  /* المخازن */
  INVENTORY_RECEIPT: "inventory_receipt",
  INVENTORY_ISSUE: "inventory_issue",
  INVENTORY_ADJUSTMENT: "inventory_adjustment",
  INVENTORY_RETURN: "inventory_return",
  INVENTORY_TRANSFER: "inventory_transfer",

  /* المحاسبة العامة */
  PERIOD_CLOSING: "period_closing",
  YEAR_CLOSING: "year_closing",
  OPENING_BALANCE: "opening_balance",
});

/** وصف عربي لكل نوع — يظهر في عمود «المصدر» في دفتر اليومية. */
export const SOURCE_LABELS = Object.freeze({
  [SourceType.MANUAL]: "قيد يدوي",
  [SourceType.CUSTOMER_INVOICE]: "فاتورة عميل",
  [SourceType.CUSTOMER_RECEIPT]: "تحصيل من عميل",
  [SourceType.CUSTOMER_CREDIT_NOTE]: "إشعار دائن لعميل",
  [SourceType.SUPPLIER_INVOICE]: "فاتورة مورد",
  [SourceType.SUPPLIER_PAYMENT]: "دفعة لمورد",
  [SourceType.SUPPLIER_RETURN]: "مرتجع لمورد",
  [SourceType.CASH_RECEIPT]: "إيصال قبض نقدي",
  [SourceType.CASH_PAYMENT]: "إيصال صرف نقدي",
  [SourceType.CASH_TRANSFER]: "تحويل بين الصناديق",
  [SourceType.BANK_DEPOSIT]: "إيداع بنكي",
  [SourceType.BANK_WITHDRAWAL]: "سحب بنكي",
  [SourceType.ASSET_ACQUISITION]: "شراء أصل ثابت",
  [SourceType.ASSET_DEPRECIATION]: "إهلاك دوري",
  [SourceType.ASSET_DISPOSAL]: "استبعاد أصل ثابت",
  [SourceType.PAYROLL_APPROVAL]: "اعتماد مسيّر رواتب",
  [SourceType.PAYROLL_PAYMENT]: "صرف رواتب",
  [SourceType.EMPLOYEE_ADVANCE]: "سلفة موظف",
  [SourceType.INVENTORY_RECEIPT]: "إذن إضافة مخزني",
  [SourceType.INVENTORY_ISSUE]: "إذن صرف مخزني",
  [SourceType.INVENTORY_ADJUSTMENT]: "تسوية مخزنية",
  [SourceType.INVENTORY_RETURN]: "مرتجع مخزني",
  [SourceType.INVENTORY_TRANSFER]: "تحويل مخزني",
  [SourceType.PERIOD_CLOSING]: "إغلاق فترة",
  [SourceType.YEAR_CLOSING]: "إغلاق سنة مالية",
  [SourceType.OPENING_BALANCE]: "رصيد افتتاحي",
});

/* ==========================================================================
   2) سطور القيد والتوازن
   ========================================================================== */

/**
 * ينشئ سطر مدين.
 * @param {number|string} accountId
 * @param {number} amount
 * @param {object} [extra] `{ description, costCenterId, partyId, partyType }`
 */
export function debit(accountId, amount, extra = {}) {
  return line(accountId, amount, 0, extra);
}

/** ينشئ سطر دائن. */
export function credit(accountId, amount, extra = {}) {
  return line(accountId, 0, amount, extra);
}

function line(accountId, debitAmount, creditAmount, extra) {
  if (accountId === undefined || accountId === null || accountId === "") {
    throw ruleViolation(
      "سطر قيد بلا حساب. هذا يعني أن خريطة الربط المحاسبي ناقصة — " +
        "راجع إعدادات الربط المحاسبي قبل تنفيذ العملية.",
      { field: "accountId" },
    );
  }

  return {
    accountId,
    debit: money.round(debitAmount ?? 0),
    credit: money.round(creditAmount ?? 0),
    description: extra.description ?? null,
    costCenterId: extra.costCenterId ?? null,
    partyType: extra.partyType ?? null,
    partyId: extra.partyId ?? null,
  };
}

/**
 * يُهمل السطور صفرية القيمة.
 *
 * ضرورة لا تحسين: فاتورة بنسبة ضريبة صفر تُنتج سطر ضريبة بصفر، وفاتورة
 * بلا خصم تُنتج سطر خصم بصفر. قيد فيه سطور صفرية متوازن حسابيًا لكنه يُربك
 * القارئ ويُضخّم دفتر الأستاذ بحركات لا معنى لها.
 */
export function compactLines(lines = []) {
  return lines.filter((row) => row && !(money.isZero(row.debit) && money.isZero(row.credit)));
}

/** مجموع المدين. */
export function totalDebit(lines = []) {
  return money.sumBy(lines, "debit");
}

/** مجموع الدائن. */
export function totalCredit(lines = []) {
  return money.sumBy(lines, "credit");
}

/** الفرق بين المدين والدائن — صفر في القيد السليم. */
export function imbalance(lines = []) {
  return money.subtract(totalDebit(lines), totalCredit(lines));
}

export function isBalanced(lines = []) {
  return money.toMinor(imbalance(lines)) === ACCOUNTING.balanceTolerance;
}

/**
 * البوابة الوحيدة لقاعدة «المدين = الدائن».
 *
 * تُستدعى من `buildEntry` فيستحيل إنشاء قيد غير متوازن عبر أي مسار. لا هامش
 * تحمّل: الحساب كله بالقروش كأعداد صحيحة في js/core/money.js، فالفرق إما صفر
 * أو خطأ حقيقي في المنطق — و«هامش قرش» يُخفي أخطاء التوزيع لا أخطاء التمثيل.
 */
export function assertBalanced(lines = []) {
  if (!lines.length) {
    throw ruleViolation("القيد بلا سطور. القيد يحتاج سطرًا مدينًا وسطرًا دائنًا على الأقل.");
  }

  const hasDebit = lines.some((row) => money.isPositive(row.debit));
  const hasCredit = lines.some((row) => money.isPositive(row.credit));

  if (!hasDebit || !hasCredit) {
    throw ruleViolation("القيد يحتاج طرفًا مدينًا وطرفًا دائنًا — لا يكفي أحدهما.");
  }

  // سطر مدين ودائن في الوقت نفسه يعني خطأ في البناء لا قيدًا مركبًا.
  const mixed = lines.find((row) => money.isPositive(row.debit) && money.isPositive(row.credit));
  if (mixed) {
    throw ruleViolation(
      `سطر القيد على الحساب ${mixed.accountId} مدين ودائن في نفس الوقت. ` +
        "افصله إلى سطرين.",
    );
  }

  if (lines.some((row) => money.isNegative(row.debit) || money.isNegative(row.credit))) {
    throw ruleViolation("لا يُقبل مبلغ سالب في سطر قيد. استخدم الطرف المقابل بدلًا من ذلك.");
  }

  const difference = imbalance(lines);
  if (money.toMinor(difference) !== ACCOUNTING.balanceTolerance) {
    throw ruleViolation(
      `القيد غير متوازن: المدين ${totalDebit(lines)} والدائن ${totalCredit(lines)} ` +
        `(الفرق ${difference}). لا يمكن ترحيل قيد غير متوازن.`,
    );
  }

  return lines;
}

/* ==========================================================================
   3) الحماية من الترحيل المكرر (Idempotency)
   ========================================================================== */

/**
 * مفتاح التفرّد لكل حدث قابل للترحيل.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذا المفتاح هو كل الحماية من القيود المكررة.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * السيناريو الذي يحمينا منه: مسيّر رواتب اعتُمد فرُحِّل، ثم أُعيد حسابه
 * واعتُمد مرة أخرى. بلا هذا المفتاح يصبح في الدفتر قيدا رواتب لشهر واحد،
 * ومصروف الرواتب ضعف الحقيقة — وهو خطأ لا يكتشفه ميزان المراجعة لأن القيدين
 * متوازنان كلاهما.
 *
 * `event` يفصل أحداث نفس المستند: مسيّر الرواتب يُرحَّل مرتين مشروعتين —
 * مرة عند الاعتماد (مصروف/التزام) ومرة عند الصرف (التزام/نقدية).
 */
export function postingKey({ sourceType, sourceId, event = "default" }) {
  if (!sourceType) throw new Error("postingKey يحتاج sourceType.");
  if (sourceId === undefined || sourceId === null) {
    throw new Error("postingKey يحتاج sourceId.");
  }
  return `${sourceType}:${sourceId}:${event}`;
}

/**
 * يتحقق أن الحدث لم يُرحَّل قبلًا.
 *
 * @param {string} key                 ناتج `postingKey`
 * @param {object[]} existingEntries   قيود الدفتر الحالية
 * @returns {object|null}  القيد السابق إن وُجد
 */
export function findExistingPosting(key, existingEntries = []) {
  return existingEntries.find((entry) => entry?.postingKey === key) ?? null;
}

/**
 * يرفض الترحيل المكرر برسالة تشرح أي مستند وأي قيد.
 *
 * القيد المعكوس لا يحجز المفتاح: عكسه كان قرارًا صريحًا بإلغاء أثره، فإعادة
 * الترحيل بعده عملية تصحيح مشروعة لا تكرارًا.
 */
export function assertNotPosted(key, existingEntries = []) {
  const found = findExistingPosting(key, existingEntries);
  if (!found) return null;
  if (found.status === EntryStatus.REVERSED) return null;

  throw ruleViolation(
    `هذا المستند مُرحَّل محاسبيًا بالفعل بالقيد ${found.entryNumber ?? found.id}. ` +
      "لا يُرحَّل المستند مرتين. لتصحيح القيد، اعكسه ثم أعد الترحيل.",
  );
}

/* ==========================================================================
   4) بناء القيد
   ========================================================================== */

/**
 * يبني قيد يومية متوازنًا. المدخل الوحيد لإنشاء أي قيد في النظام.
 *
 * @param {object} definition
 * @param {string} definition.date                تاريخ القيد (YYYY-MM-DD)
 * @param {string} definition.description         وصف عربي للقيد
 * @param {Array<object>} definition.lines        سطور من `debit()` و `credit()`
 * @param {string} [definition.sourceType]        من `SourceType`
 * @param {number|string} [definition.sourceId]   معرّف المستند المصدري
 * @param {string} [definition.sourceEvent]       لتمييز أحداث نفس المستند
 * @param {string} [definition.reference]         رقم المستند المصدري المقروء
 * @param {number|string} [definition.periodId]
 * @param {number|string} [definition.costCenterId] مركز تكلفة افتراضي للسطور
 * @param {string} [definition.createdBy]
 * @param {string} [definition.status]            الحالة الابتدائية
 * @returns {object} قيد متوازن جاهز للحفظ
 */
export function buildEntry({
  date,
  description,
  lines = [],
  sourceType = SourceType.MANUAL,
  sourceId = null,
  sourceEvent = "default",
  reference = null,
  periodId = null,
  costCenterId = null,
  createdBy = null,
  status = EntryStatus.DRAFT,
  notes = null,
} = {}) {
  if (!date) {
    throw ruleViolation("القيد يحتاج تاريخًا.", { field: "date" });
  }
  if (!String(description ?? "").trim()) {
    throw ruleViolation("القيد يحتاج وصفًا يشرح سببه — للتدقيق.", { field: "description" });
  }

  // مركز التكلفة الافتراضي يُطبَّق على السطور التي لا تحمل واحدًا خاصًا بها.
  const resolved = compactLines(lines).map((row) => ({
    ...row,
    costCenterId: row.costCenterId ?? costCenterId,
  }));

  assertBalanced(resolved);

  return {
    date: String(date).slice(0, 10),
    description: String(description).trim(),
    lines: resolved,
    totalDebit: totalDebit(resolved),
    totalCredit: totalCredit(resolved),
    sourceType,
    sourceId,
    reference,
    periodId,
    costCenterId,
    createdBy,
    notes,
    status,
    /** مفتاح التفرّد — القيود اليدوية لا تحتاجه (لا مستند مصدري يتكرر). */
    postingKey:
      sourceType === SourceType.MANUAL || sourceId === null
        ? null
        : postingKey({ sourceType, sourceId, event: sourceEvent }),
    isAutomatic: sourceType !== SourceType.MANUAL,
  };
}

/* ==========================================================================
   5) انتقالات حالة القيد
   ========================================================================== */

/** القيد المُرحَّل أو المعكوس لا يُعدَّل. البوابة الوحيدة لهذه القاعدة. */
export function assertEntryMutable(entry) {
  if (entry?.status === EntryStatus.POSTED) {
    throw ruleViolation(
      `لا يمكن تعديل القيد ${entry?.entryNumber ?? entry?.id ?? ""} بعد ترحيله. ` +
        "القيد المُرحَّل سجل محاسبي ثابت؛ التصحيح يتم بقيد عكسي ثم قيد جديد.",
    );
  }
  if (entry?.status === EntryStatus.REVERSED) {
    throw ruleViolation(
      `القيد ${entry?.entryNumber ?? entry?.id ?? ""} معكوس. لا يُعدَّل قيد معكوس.`,
    );
  }
}

/** مسوّدة → بانتظار الاعتماد. */
export function submitEntry(entry) {
  assertEntryMutable(entry);
  if (entry?.status !== EntryStatus.DRAFT) {
    throw ruleViolation("لا يُقدَّم للمراجعة إلا قيد في حالة مسوّدة.");
  }
  assertBalanced(entry.lines ?? []);
  return { ...entry, status: EntryStatus.PENDING };
}

/** بانتظار الاعتماد → معتمد. صلاحية `gl.journal.approve`. */
export function approveEntry(entry, { approvedBy, approvedAt = new Date().toISOString() } = {}) {
  assertEntryMutable(entry);
  if (entry?.status !== EntryStatus.PENDING && entry?.status !== EntryStatus.DRAFT) {
    throw ruleViolation(`لا يمكن اعتماد قيد في الحالة «${entry?.status}».`);
  }
  assertBalanced(entry.lines ?? []);
  return { ...entry, status: EntryStatus.APPROVED, approvedBy, approvedAt };
}

/**
 * معتمد → مُرحَّل. من هذه اللحظة يدخل القيد الأرصدة ولا يُعدَّل.
 *
 * `periods` اختيارية لكن تمريرها مطلوب في مسار التطبيق الفعلي: الترحيل إلى
 * فترة مغلقة يُفسد أرصدة ختامية سبق اعتمادها وإصدار قوائم مالية عنها.
 *
 * تُمرَّر **كل** الفترات لا المفتوحة وحدها: `assertPeriodOpen` تحتاج أن تميّز
 * «لا فترة معرَّفة بهذا التاريخ» من «الفترة معرَّفة لكنها مغلقة»، وهما خطآن
 * مختلفان بإصلاحين مختلفين. تمرير المفتوحة وحدها يجعل كل ترحيل إلى فترة
 * مغلقة يُبلِّغ خطأً مُضلِّلًا بأن الفترة غير موجودة.
 */
export function postEntry(entry, { postedBy, postedAt = new Date().toISOString(), periods } = {}) {
  assertEntryMutable(entry);

  if (entry?.status !== EntryStatus.APPROVED) {
    throw ruleViolation(
      "لا يُرحَّل إلا قيد معتمد. اعتمد القيد أولًا — الفصل بين الاعتماد والترحيل ضابط رقابي مقصود.",
    );
  }

  assertBalanced(entry.lines ?? []);

  if (Array.isArray(periods)) {
    assertPeriodOpen(entry.date, periods);
  }

  return { ...entry, status: EntryStatus.POSTED, postedBy, postedAt };
}

/**
 * يرفض الترحيل إلى فترة غير مفتوحة.
 *
 * @param {string} date
 * @param {Array<{startDate:string,endDate:string,status:string,name:string}>} periods
 */
export function assertPeriodOpen(date, periods = []) {
  const day = String(date).slice(0, 10);

  const containing = periods.find(
    (period) => String(period.startDate) <= day && day <= String(period.endDate),
  );

  if (!containing) {
    throw ruleViolation(
      `التاريخ ${day} لا يقع داخل أي فترة محاسبية معرَّفة. ` +
        "أنشئ الفترة أولًا من شاشة الفترات المحاسبية.",
      { field: "date" },
    );
  }

  if (containing.status !== "open") {
    throw ruleViolation(
      `الفترة «${containing.name}» ${containing.status === "closed" ? "مغلقة" : "مُقفلة"}. ` +
        "لا يُقبل الترحيل إليها. أعد فتح الفترة أو انقل القيد إلى فترة مفتوحة.",
      { field: "date" },
    );
  }

  return containing;
}

/**
 * يبني القيد العكسي لقيد مُرحَّل.
 *
 * العكس لا يحذف الأصل ولا يُعدِّله: يُنشئ قيدًا جديدًا بنفس السطور مع تبديل
 * المدين والدائن، فيصبح صافي أثر الاثنين صفرًا ويبقى كلاهما في الدفتر. هذا هو
 * السلوك المحاسبي الصحيح — حذف قيد مُرحَّل يُفقد الدفتر قابليته للتدقيق.
 *
 * @returns {{ reversal:object, original:object }} القيد العكسي والأصل بحالته الجديدة
 */
export function reverseEntry(entry, {
  date = new Date().toISOString().slice(0, 10),
  reason,
  reversedBy,
  reversedAt = new Date().toISOString(),
} = {}) {
  if (entry?.status !== EntryStatus.POSTED) {
    throw ruleViolation("لا يُعكَس إلا قيد مُرحَّل.");
  }
  if (!String(reason ?? "").trim()) {
    throw ruleViolation("عكس القيد يتطلب سببًا — للتدقيق.", { field: "reason" });
  }

  const flipped = (entry.lines ?? []).map((row) => ({
    ...row,
    debit: row.credit,
    credit: row.debit,
  }));

  const reversal = buildEntry({
    date,
    description: `عكس القيد ${entry.entryNumber ?? entry.id} — ${String(reason).trim()}`,
    lines: flipped,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    sourceEvent: `reversal-of-${entry.entryNumber ?? entry.id}`,
    reference: entry.entryNumber ?? entry.reference,
    periodId: entry.periodId,
    costCenterId: entry.costCenterId,
    createdBy: reversedBy,
    status: EntryStatus.APPROVED,
    notes: `قيد عكسي آلي. السبب: ${String(reason).trim()}`,
  });

  return {
    reversal: { ...reversal, reversalOf: entry.id, isReversal: true },
    original: {
      ...entry,
      status: EntryStatus.REVERSED,
      reversedBy,
      reversedAt,
      reversalReason: String(reason).trim(),
    },
  };
}

/** القيد المُرحَّل فقط يؤثر على الأرصدة. */
export const affectsBalances = (entry) => entry?.status === EntryStatus.POSTED;

/* ==========================================================================
   6) ترقيم القيود
   ========================================================================== */

/**
 * يولّد رقم القيد التالي: `JV-2026-00042`.
 *
 * الترقيم متصل داخل السنة المالية ولا تُعاد تعبئة الفراغات: رقم مفقود في
 * التسلسل دليل تدقيق (قيد حُذف أو فشل)، وإعادة استخدامه تمحو الدليل.
 */
export function nextEntryNumber(existingEntries = [], { fiscalYear, prefix = "JV" } = {}) {
  const year = fiscalYear ?? new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);

  const highest = existingEntries.reduce((max, entry) => {
    const matched = pattern.exec(String(entry?.entryNumber ?? ""));
    return matched ? Math.max(max, Number(matched[1])) : max;
  }, 0);

  return `${prefix}-${year}-${String(highest + 1).padStart(5, "0")}`;
}
