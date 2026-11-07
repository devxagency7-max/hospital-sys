/**
 * خدمة الترحيل — التنسيق بين الموديولات ودفتر الأستاذ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذه الوحدة تُحاكي **طبقة خدمات الباك-إند**، وهي في الوقت نفسه مواصفتها.
 *  مطوّر الباك-إند ينفّذ هذه الدوال بنفس الضمانات: معاملة واحدة، حماية من
 *  التكرار، وسجل تدقيق لكل ترحيل.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * التقسيم بين الطبقات:
 *   js/domain/posting.js        القواعد الخالصة (التوازن، العكس، المفاتيح)
 *   js/domain/posting-rules.js  أي حساب يُدين وأي حساب يُدان
 *   هذا الملف                  القراءة من قاعدة البيانات والكتابة فيها
 *
 * لا شيء في هذا الملف يحسب مبلغًا أو يقرر حسابًا — كل ذلك في طبقة المجال.
 */

import { ruleViolation, notFound } from "../../core/errors.js";
import {
  buildEntry,
  postEntry,
  approveEntry,
  reverseEntry,
  assertNotPosted,
  nextEntryNumber,
  postingKey,
  EntryStatus,
  SourceType,
} from "../../domain/posting.js";
import { buildLinesFor, shouldPost } from "../../domain/posting-rules.js";
import { assertPostable } from "../../domain/accounts.js";
import { db, all, find, insert, update } from "../db.js";
import { FISCAL_YEAR } from "../seed.js";

/* ==========================================================================
   1) سجل التدقيق
   ========================================================================== */

/**
 * يُسجّل حدثًا في سجل التدقيق.
 *
 * كل ترحيل يُسجَّل، بلا استثناء: قيد ظهر في الدفتر ولا يُعرف من أنشأه ولا
 * متى هو بالضبط ما يُفقد الدفتر قيمته كدليل.
 */
export function audit({ action, actionLabel, module, entity, entityId, severity = "info", details, user }) {
  return insert("auditLogs", {
    timestamp: new Date().toISOString(),
    userId: user?.id ?? 1,
    user: user?.name ?? "النظام",
    userRole: user?.jobTitle ?? "—",
    action,
    actionLabel,
    module,
    entity,
    entityId,
    severity,
    ip: "—",
    userAgent: "—",
    details,
    result: "success",
  });
}

/* ==========================================================================
   2) إنشاء القيود
   ========================================================================== */

/**
 * كل الفترات المحاسبية — يقرؤها `postEntry` ليرفض الترحيل إلى فترة مغلقة.
 *
 * نُمرّر الكل لا المفتوحة وحدها حتى تُميّز رسالة الخطأ بين فترة غير معرَّفة
 * وفترة معرَّفة ومغلقة.
 */
function allPeriods() {
  return all("accountingPeriods");
}

/** يتحقق أن كل سطر على حساب تفصيلي نشط. */
function assertLinesPostable(lines) {
  const accounts = all("accounts");
  for (const line of lines) assertPostable(accounts, line.accountId);
  return lines;
}

/** يُرفق الفترة المحاسبية بتاريخ القيد. */
function periodFor(date) {
  const day = String(date).slice(0, 10);
  return all("accountingPeriods").find(
    (period) => period.startDate <= day && day <= period.endDate,
  );
}

/**
 * يحفظ قيدًا في الدفتر مع رقمه والفترة.
 * المدخل الوحيد للكتابة في مجموعة `journalEntries`.
 */
function persistEntry(entry, { user } = {}) {
  const period = periodFor(entry.date);

  const stored = insert("journalEntries", {
    ...entry,
    entryNumber: nextEntryNumber(all("journalEntries"), { fiscalYear: FISCAL_YEAR }),
    periodId: period?.id ?? null,
    createdBy: entry.createdBy ?? user?.name ?? "النظام",
    createdAt: new Date().toISOString(),
  });

  audit({
    action: "journal.create",
    actionLabel: entry.isAutomatic ? "ترحيل آلي من موديول" : "إنشاء قيد يومية",
    module: "المحاسبة العامة",
    entity: "journal_entry",
    entityId: stored.id,
    severity: entry.isAutomatic ? "info" : "info",
    details: `${stored.entryNumber} — ${stored.description}`,
    user,
  });

  return stored;
}

/**
 * ينشئ قيدًا يدويًا.
 *
 * @param {object} payload `{ date, description, lines, costCenterId, notes }`
 * @param {{ user?:object, submit?:boolean }} [options]
 */
export function createManualEntry(payload, { user, submit = false } = {}) {
  const lines = (payload?.lines ?? []).map((line) => ({
    accountId: line.accountId,
    debit: Number(line.debit) || 0,
    credit: Number(line.credit) || 0,
    description: line.description ?? null,
    costCenterId: line.costCenterId ?? null,
    partyType: line.partyType ?? null,
    partyId: line.partyId ?? null,
  }));

  assertLinesPostable(lines.filter((line) => line.debit || line.credit));

  const entry = buildEntry({
    date: payload?.date,
    description: payload?.description,
    lines,
    sourceType: SourceType.MANUAL,
    costCenterId: payload?.costCenterId ?? null,
    notes: payload?.notes ?? null,
    createdBy: user?.name,
    status: submit ? EntryStatus.PENDING : EntryStatus.DRAFT,
  });

  return persistEntry(entry, { user });
}

/* ==========================================================================
   3) الترحيل الآلي من الموديولات
   ========================================================================== */

/**
 * يُرحّل مستند موديول إلى الدفتر.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  نقطة الدخول الموحَّدة لكل الموديولات: الرواتب، المخازن، العملاء، الموردون.
 *  الموديول يُسلّم المستند ونوع الحدث، وهذه الدالة تتولى الباقي.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الضمانات الأربع:
 *   1. الحماية من التكرار — `assertNotPosted` على مفتاح الحدث
 *   2. التوازن            — `buildEntry` يرفض أي قيد غير متوازن
 *   3. الفترة المفتوحة    — `postEntry` يرفض الترحيل لفترة مغلقة
 *   4. سجل التدقيق        — كل ترحيل يُسجَّل
 *
 * @param {object} options
 * @param {string} options.sourceType  من `SourceType`
 * @param {number|string} options.sourceId
 * @param {string} [options.sourceEvent]
 * @param {object} options.document     المستند المصدري
 * @param {string} options.date
 * @param {string} options.description
 * @returns {{ entry:object|null, skipped:boolean, reason?:string }}
 */
export function postDocument({
  sourceType,
  sourceId,
  sourceEvent = "default",
  document,
  date,
  description,
  reference = null,
  costCenterId = null,
  user,
}) {
  const key = postingKey({ sourceType, sourceId, event: sourceEvent });

  /* 1) الحماية من التكرار — ترمي خطأً صريحًا لا تتجاهل بصمت. */
  assertNotPosted(key, all("journalEntries"));

  /* 2) ترجمة الحدث إلى سطور عبر قواعد الربط. */
  const lines = buildLinesFor(sourceType, document, db.postingMap);

  /*
   * حدث بلا أثر محاسبي — التحويل المخزني على حساب مخزون واحد مثلًا. نُعيد
   * `skipped` بدل رمي خطأ: «لا أثر» ليس فشلًا، والشاشة تحتاج أن تميّزهما.
   */
  if (!shouldPost(lines)) {
    return { entry: null, skipped: true, reason: "هذا المستند لا أثر محاسبي له." };
  }

  assertLinesPostable(lines);

  /* 3) البناء — يتحقق من التوازن. */
  const entry = buildEntry({
    date,
    description,
    lines,
    sourceType,
    sourceId,
    sourceEvent,
    reference,
    costCenterId,
    createdBy: user?.name ?? "النظام (ترحيل آلي)",
    status: EntryStatus.APPROVED,
  });

  const stored = persistEntry(entry, { user });

  /* 4) الترحيل — يتحقق من أن الفترة مفتوحة. */
  const posted = update(
    "journalEntries",
    stored.id,
    postEntry({ ...stored, status: EntryStatus.APPROVED }, {
      postedBy: user?.name ?? "النظام (ترحيل آلي)",
      periods: allPeriods(),
    }),
  );

  audit({
    action: "journal.post",
    actionLabel: "ترحيل قيد آلي",
    module: "المحاسبة العامة",
    entity: "journal_entry",
    entityId: posted.id,
    severity: "warning",
    details: `${posted.entryNumber} — ${description}`,
    user,
  });

  return { entry: posted, skipped: false };
}

/* ==========================================================================
   4) انتقالات حالة القيد
   ========================================================================== */

function requireEntry(id) {
  const entry = find("journalEntries", id);
  if (!entry) throw notFound("القيد غير موجود.");
  return entry;
}

export function submitJournalEntry(id, { user } = {}) {
  const entry = requireEntry(id);

  if (entry.status !== EntryStatus.DRAFT) {
    throw ruleViolation("لا يُقدَّم للمراجعة إلا قيد في حالة مسوّدة.");
  }

  const next = update("journalEntries", id, { status: EntryStatus.PENDING });

  audit({
    action: "journal.submit", actionLabel: "تقديم قيد للمراجعة",
    module: "المحاسبة العامة", entity: "journal_entry", entityId: next.id,
    details: next.entryNumber, user,
  });

  return next;
}

export function approveJournalEntry(id, { user } = {}) {
  const entry = requireEntry(id);
  const approved = approveEntry(entry, { approvedBy: user?.name ?? "—" });
  const next = update("journalEntries", id, approved);

  audit({
    action: "journal.approve", actionLabel: "اعتماد قيد يومية", severity: "warning",
    module: "المحاسبة العامة", entity: "journal_entry", entityId: next.id,
    details: next.entryNumber, user,
  });

  return next;
}

export function postJournalEntry(id, { user } = {}) {
  const entry = requireEntry(id);
  assertLinesPostable(entry.lines ?? []);

  const posted = postEntry(entry, {
    postedBy: user?.name ?? "—",
    periods: allPeriods(),
  });

  const next = update("journalEntries", id, posted);

  audit({
    action: "journal.post", actionLabel: "ترحيل قيد يومية", severity: "warning",
    module: "المحاسبة العامة", entity: "journal_entry", entityId: next.id,
    details: next.entryNumber, user,
  });

  return next;
}

/**
 * يعكس قيدًا مُرحَّلًا.
 *
 * عمليتان في معاملة واحدة منطقية: إنشاء القيد العكسي وتعليم الأصل كمعكوس.
 * تنفيذ إحداهما دون الأخرى يُنتج إما أثرًا مزدوجًا أو قيدًا معكوسًا بلا عكس —
 * ولذلك يُلزم الباك-إند بتنفيذهما في معاملة قاعدة بيانات واحدة.
 */
export function reverseJournalEntry(id, { reason, date, user } = {}) {
  const entry = requireEntry(id);

  const { reversal, original } = reverseEntry(entry, {
    reason,
    date: date ?? new Date().toISOString().slice(0, 10),
    reversedBy: user?.name ?? "—",
  });

  const storedReversal = persistEntry(reversal, { user });

  const postedReversal = update(
    "journalEntries",
    storedReversal.id,
    postEntry({ ...storedReversal, status: EntryStatus.APPROVED }, {
      postedBy: user?.name ?? "—",
      periods: allPeriods(),
    }),
  );

  update("journalEntries", entry.id, original);

  audit({
    action: "journal.reverse", actionLabel: "عكس قيد مُرحَّل", severity: "critical",
    module: "المحاسبة العامة", entity: "journal_entry", entityId: entry.id,
    details: `عكس ${entry.entryNumber} بالقيد ${postedReversal.entryNumber} — ${reason}`,
    user,
  });

  return { reversal: postedReversal, original: find("journalEntries", entry.id) };
}

/* ==========================================================================
   5) استعلامات مساعدة
   ========================================================================== */

/** القيد المُرحَّل لمستند موديول — لعرض زر «عرض القيد» في شاشة المستند. */
export function entryForDocument(sourceType, sourceId, event = "default") {
  const key = postingKey({ sourceType, sourceId, event });
  return all("journalEntries").find((entry) => entry.postingKey === key) ?? null;
}

/** هل هذا المستند مُرحَّل؟ تقرؤه الشاشة لتعطيل زر الترحيل. */
export function isDocumentPosted(sourceType, sourceId, event = "default") {
  const entry = entryForDocument(sourceType, sourceId, event);
  return Boolean(entry) && entry.status !== EntryStatus.REVERSED;
}
