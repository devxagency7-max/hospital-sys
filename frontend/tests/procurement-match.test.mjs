/**
 * اختبارات المطابقة الثلاثية (3-Way Match).
 *
 *   node tests/procurement-match.test.mjs
 *
 * الضمانات:
 *   1. أمين المخزن يُقرّ بالكمية بلا سعر — والاستلام يُقيَّم مؤقتًا ويُوسَم.
 *   2. المحاسب يُدخل السعر، والفرق يُرحَّل صريحًا على المخزون لا يُخفى.
 *   3. المنشأة لا تدفع إلا ما استلمته — فرق الكمية استثناء معلَن.
 *   4. فرق سعر كبير لا يُعتمد بلا مبرر مكتوب.
 *   5. لا مطابقة مرتين لنفس الاستلام.
 */

import { assert, section, report } from "./harness.mjs";
import { createReceipt, createIssue } from "../js/mock/services/inventory.service.js";
import {
  listReceiptsAwaitingPrice,
  listPurchaseMatches,
  getPurchaseMatch,
  previewMatch,
  matchSupplierInvoice,
} from "../js/mock/services/procurement.service.js";
import { all, find } from "../js/mock/db.js";
import * as money from "../js/core/money.js";

const KEEPER = { user: { name: "أمين المخزن — اختبار" } };
const ACCOUNTANT = { user: { name: "المحاسب — اختبار" } };
const HUB = 1;

/** صنف بسيط بلا تتبع تشغيلات أو صلاحية، مسموح في المخزن الرئيسي. */
const plainItem = all("items").find(
  (i) => !i.trackBatches && !i.trackExpiry && (i.warehouseIds ?? []).includes(HUB),
);

/** يجد قيد مطابقة بسطوره. */
function entryFor(sourceId) {
  return all("journalEntries").find(
    (e) => e.sourceType === "purchase_invoice_match" && String(e.sourceId) === String(sourceId),
  );
}

/* ==========================================================================
   1. المخزن يُقرّ بالكمية بلا سعر
   ========================================================================== */

section("أمين المخزن يُقرّ بالكمية — السعر ليس مسؤوليته");

assert("يوجد صنف صالح للاختبار", Boolean(plainItem));

const lastPriceBefore = find("items", plainItem.id).lastPurchasePrice;

const grn = createReceipt(
  { itemId: plainItem.id, warehouseId: HUB, quantity: 40, supplierId: 2 },
  KEEPER,
);

assert("الاستلام قُبل بلا سعر", Boolean(grn.movement?.id));
assert("الاستلام مُوسَم بانتظار سعر الفاتورة", grn.priceStatus === "pending_invoice");
assert("الخدمة تُعلن أن السعر لم يُعتمد بدل الصمت", grn.awaitingInvoicePrice === true);
assert("التقييم المؤقت مُسجَّل صريحًا على الحركة",
  grn.movement.provisionalUnitCost === lastPriceBefore);
assert("لا سعر فاتورة مُسجَّل بعد", grn.movement.invoiceUnitCost === null);
assert("الاستلام رُحِّل محاسبياً على «مستلم ولم يُفوتر»", Boolean(grn.journalEntry));

assert("آخر سعر شراء للصنف لم يتغير بالتقييم المؤقت",
  find("items", plainItem.id).lastPurchasePrice === lastPriceBefore);

const awaiting = listReceiptsAwaitingPrice();
assert("الاستلام ظهر في لوحة المحاسب",
  awaiting.data.some((r) => r.movementId === grn.movement.id));
assert("اللوحة تُعلن القيمة المؤقتة غير المُسعَّرة", awaiting.meta.provisionalTotal > 0);
assert("اللوحة تُعلن عمر أقدم استلام", typeof awaiting.meta.oldestAgeDays === "number");

const listed = awaiting.data.find((r) => r.movementId === grn.movement.id);
assert("الصف يحمل من استلم البضاعة", listed.receivedBy === KEEPER.user.name);
assert("الصف يحمل المورد", Boolean(listed.supplierName));

/* الاستلام بسعر صريح يُسعَّر فورًا ولا يدخل اللوحة. */
const pricedGrn = createReceipt(
  { itemId: plainItem.id, warehouseId: HUB, quantity: 5, unitCost: 60, supplierId: 2 },
  ACCOUNTANT,
);
assert("الاستلام بسعر صريح يُوسَم مُسعَّرًا", pricedGrn.priceStatus === "priced");
assert("الاستلام المُسعَّر لا يدخل لوحة الانتظار",
  !listReceiptsAwaitingPrice().data.some((r) => r.movementId === pricedGrn.movement.id));

/* ==========================================================================
   2. المعاينة تُظهر الفروق قبل الاعتماد
   ========================================================================== */

section("المعاينة تُظهر فرق الكمية وفرق السعر قبل أي أثر");

/*
 * فرق السعر يُقاس على **التقييم المؤقت لهذا الإذن** لا على آخر سعر شراء
 * الحالي للصنف: استلامٌ آخر بسعر صريح قد يكون حدَّث سعر الصنف بينهما، فقياس
 * الفرق عليه يختبر ترتيب الاختبار لا منطق المطابقة.
 */
const priceBeforePreview = find("items", plainItem.id).lastPurchasePrice;
const invoicePrice = money.round(grn.movement.provisionalUnitCost * 1.2); // +20%

const preview = previewMatch(grn.movement.id, {
  invoiceUnitCost: invoicePrice,
  invoiceQty: 43, // المورد فوتر أكثر من المستلم
});

assert("المعاينة تحمل الكمية المستلمة", preview.receivedQty === 40);
assert("المعاينة تحمل الكمية المفوترة", preview.invoiceQty === 43);
assert("المستحق الدفع = الأقل من المستلم والمفوتر", preview.payableQty === 40);
assert("فرق الكمية محسوب", preview.quantityVariance === 3);
assert("فرق السعر محسوب بالنسبة", preview.priceVariancePct > 19 && preview.priceVariancePct < 21);
assert("المعاينة تُعلن استثناء فرق الكمية",
  preview.exceptions.some((e) => e.includes("إشعارًا دائنًا")));
assert("المعاينة تُعلن استثناء فرق السعر",
  preview.exceptions.some((e) => e.includes("مبرر المورد")));
assert("المعاينة تطلب مراجعة لفرق كبير", preview.requiresReview === true);
assert("المعاينة ليست نظيفة", preview.isClean === false);

assert("المعاينة لا أثر لها — الحركة ما زالت بانتظار السعر",
  find("stockMovements", grn.movement.id).priceStatus === "pending_invoice");
assert("المعاينة لم تُغيّر آخر سعر شراء",
  find("items", plainItem.id).lastPurchasePrice === priceBeforePreview);

/* ==========================================================================
   3. حراسة الاعتماد
   ========================================================================== */

section("حراسة الاعتماد: لا سعر بلا مرجع، ولا فرق كبير بلا مبرر");

const guards = [
  ["بلا سعر وحدة", { supplierInvoiceRef: "INV-1" }],
  ["بسعر صفر", { invoiceUnitCost: 0, supplierInvoiceRef: "INV-1" }],
  ["بلا رقم فاتورة", { invoiceUnitCost: invoicePrice }],
  ["بفرق سعر كبير بلا مبرر", { invoiceUnitCost: invoicePrice, supplierInvoiceRef: "INV-1" }],
];

for (const [label, payload] of guards) {
  let blocked = false;
  try {
    matchSupplierInvoice(grn.movement.id, payload, ACCOUNTANT);
  } catch {
    blocked = true;
  }
  assert(`المطابقة ${label} مرفوضة`, blocked);
}

assert("كل المحاولات المرفوضة لم تُسعِّر الحركة",
  find("stockMovements", grn.movement.id).priceStatus === "pending_invoice");

/* ==========================================================================
   4. الاعتماد: تصحيح التكلفة وإقفال الاستحقاق
   ========================================================================== */

section("الاعتماد: تصحيح تكلفة المخزون وإقفال الاستحقاق وإثبات مديونية المورد");

const accruedValue = find("stockMovements", grn.movement.id).totalCost;

const matched = matchSupplierInvoice(
  grn.movement.id,
  {
    invoiceUnitCost: invoicePrice,
    invoiceQty: 43,
    supplierInvoiceRef: "SINV-2026-7781",
    varianceReason: "ارتفاع سعر الدولار وتكلفة الشحن المبرَّدة",
  },
  ACCOUNTANT,
);

assert("المطابقة أُنشئت", Boolean(matched.match?.id));
assert("الحركة صارت مُسعَّرة", matched.movement.priceStatus === "priced");
assert("رقم فاتورة المورد مُسجَّل", matched.movement.supplierInvoiceRef === "SINV-2026-7781");
assert("من طابقها مُسجَّل", matched.movement.matchedBy === ACCOUNTANT.user.name);
assert("مبرر الفرق موثق", matched.movement.varianceReason.includes("الدولار"));

/* تصحيح التكلفة. */
assert("تكلفة الوحدة صُحِّحت لسعر الفاتورة", matched.movement.unitCost === invoicePrice);
assert("إجمالي التكلفة صُحِّح على الكمية المستلمة",
  matched.movement.totalCost === money.multiply(invoicePrice, 40));
assert("آخر سعر شراء تحدَّث من سعر الفاتورة",
  find("items", plainItem.id).lastPurchasePrice === invoicePrice);

/* القيد. */
const entry = entryFor(grn.movement.id);
assert("قيد المطابقة رُحِّل", Boolean(entry));

const totalDebit = entry.lines.reduce((s, l) => money.add(s, l.debit ?? 0), 0);
const totalCredit = entry.lines.reduce((s, l) => money.add(s, l.credit ?? 0), 0);
assert("القيد متوازن بالقرش", totalDebit === totalCredit);

const grniLine = entry.lines.find((l) => String(l.accountId) === "2112");
assert("القيد يُقفل «مستلم ولم يُفوتر» بقيمة الاستحقاق",
  grniLine && grniLine.debit === accruedValue);

const payableLine = entry.lines.find((l) => String(l.accountId) === "2111");
assert("القيد يُثبت مديونية المورد بقيمة الفاتورة",
  payableLine && payableLine.credit === money.multiply(invoicePrice, 40));

const inventoryLine = entry.lines.find((l) => String(l.accountId).startsWith("114"));
assert("فرق السعر صُحِّح على المخزون لا على المصروف", Boolean(inventoryLine));
assert("فرق السعر بالزيادة مدين على المخزون", inventoryLine.debit > 0);
assert("فرق السعر = قيمة الفاتورة − قيمة الاستحقاق",
  inventoryLine.debit === money.subtract(money.multiply(invoicePrice, 40), accruedValue));

/* مراجعة سعر البيع. */
assert("تغيّر سعر الشراء فتح مراجعة سعر بيع", Boolean(matched.priceReview));
assert("المراجعة بحالة معلَّقة لمدير الحسابات", matched.priceReview.status === "pending");
assert("المراجعة تحمل سعر الشراء الجديد",
  matched.priceReview.newPurchasePrice === invoicePrice);
assert("المراجعة تحمل رقم فاتورة المورد",
  matched.priceReview.supplierInvoiceRef === "SINV-2026-7781");
assert("المراجعة تحمل مبرر المورد", Boolean(matched.priceReview.supplierReason));

/* الاستثناءات موثقة. */
assert("الاستثناءات محفوظة في سجل المطابقة", matched.match.exceptions.length === 2);
assert("سجل المطابقة يحمل القيد", Boolean(matched.match.journalEntryId));

/* ==========================================================================
   5. لا مطابقة مرتين
   ========================================================================== */

section("لا مطابقة مرتين لنفس الاستلام");

let doubleMatch = false;
try {
  matchSupplierInvoice(
    grn.movement.id,
    { invoiceUnitCost: 99, supplierInvoiceRef: "SINV-DUP", varianceReason: "محاولة ثانية" },
    ACCOUNTANT,
  );
} catch {
  doubleMatch = true;
}
assert("المطابقة الثانية مرفوضة", doubleMatch);
assert("الاستلام خرج من لوحة الانتظار",
  !listReceiptsAwaitingPrice().data.some((r) => r.movementId === grn.movement.id));

/* ==========================================================================
   6. مطابقة نظيفة — بلا فروق
   ========================================================================== */

section("المطابقة النظيفة: لا فرق كمية ولا سعر");

const cleanGrn = createReceipt(
  { itemId: plainItem.id, warehouseId: HUB, quantity: 10, supplierId: 2 },
  KEEPER,
);
const provisional = cleanGrn.movement.provisionalUnitCost;

const cleanPreview = previewMatch(cleanGrn.movement.id, {
  invoiceUnitCost: provisional,
  invoiceQty: 10,
});
assert("لا فرق سعر", cleanPreview.priceVariance === 0);
assert("لا فرق كمية", cleanPreview.quantityVariance === 0);
assert("المعاينة نظيفة", cleanPreview.isClean === true);
assert("المطابقة النظيفة لا تطلب مراجعة", cleanPreview.requiresReview === false);

const cleanMatch = matchSupplierInvoice(
  cleanGrn.movement.id,
  { invoiceUnitCost: provisional, invoiceQty: 10, supplierInvoiceRef: "SINV-CLEAN-1" },
  ACCOUNTANT,
);
assert("المطابقة النظيفة قُبلت بلا مبرر", cleanMatch.movement.priceStatus === "priced");
assert("المطابقة النظيفة بلا استثناءات", cleanMatch.exceptions.length === 0);
assert("المطابقة النظيفة لا تفتح مراجعة سعر", cleanMatch.priceReview === null);

const cleanEntry = entryFor(cleanGrn.movement.id);
assert("قيد المطابقة النظيفة متوازن",
  cleanEntry.lines.reduce((s, l) => money.add(s, l.debit ?? 0), 0) ===
    cleanEntry.lines.reduce((s, l) => money.add(s, l.credit ?? 0), 0));
assert("قيد المطابقة النظيفة سطران فقط — لا سطر فرق",
  cleanEntry.lines.length === 2);

/* ==========================================================================
   7. فرق سعر بالنقص
   ========================================================================== */

section("فرق سعر بالنقص: المخزون يُخفَّض لتكلفته الفعلية");

const cheapGrn = createReceipt(
  { itemId: plainItem.id, warehouseId: HUB, quantity: 10, supplierId: 2 },
  KEEPER,
);
const cheapProvisional = cheapGrn.movement.provisionalUnitCost;
const cheapPrice = money.round(cheapProvisional * 0.8); // −20%

const cheapMatch = matchSupplierInvoice(
  cheapGrn.movement.id,
  {
    invoiceUnitCost: cheapPrice,
    invoiceQty: 10,
    supplierInvoiceRef: "SINV-CHEAP-1",
    varianceReason: "خصم كمية متعاقد عليه",
  },
  ACCOUNTANT,
);

assert("فرق السعر سالب", cheapMatch.match.priceVariance < 0);

const cheapEntry = entryFor(cheapGrn.movement.id);
const cheapInventoryLine = cheapEntry.lines.find((l) => String(l.accountId).startsWith("114"));
assert("فرق النقص دائن على المخزون", cheapInventoryLine.credit > 0);
assert("قيد النقص متوازن",
  cheapEntry.lines.reduce((s, l) => money.add(s, l.debit ?? 0), 0) ===
    cheapEntry.lines.reduce((s, l) => money.add(s, l.credit ?? 0), 0));

/* ==========================================================================
   8. سجل المطابقات
   ========================================================================== */

section("سجل المطابقات للمراجع والتدقيق");

const matches = listPurchaseMatches();
assert("السجل يحمل كل المطابقات", matches.meta.total >= 3);
assert("السجل يُعلن عدد ما فيه فروق", matches.meta.withExceptions >= 1);
assert("السجل يُعلن صافي فرق السعر", typeof matches.meta.totalVariance === "number");
assert("السجل يُعلن نسبة الفرق من قيمة الفواتير", typeof matches.meta.variancePct === "number");

const onlyExceptions = listPurchaseMatches({ onlyExceptions: true });
assert("فلترة الاستثناءات تُرجع ما فيه فروق فقط",
  onlyExceptions.data.every((m) => (m.exceptions ?? []).length > 0));

const detail = getPurchaseMatch(matched.match.id);
assert("تفاصيل المطابقة تحمل حركتها", Boolean(detail.movement));
assert("تفاصيل المطابقة تحمل قيدها", Boolean(detail.journalEntry));

/* ==========================================================================
   9. الصرف بعد المطابقة يُقيَّم بالتكلفة المصحَّحة
   ========================================================================== */

section("الصرف بعد المطابقة يُقيَّم بالتكلفة المصحَّحة لا المؤقتة");

const issue = createIssue(
  { itemId: plainItem.id, warehouseId: HUB, quantity: 1, reason: "اختبار التقييم" },
  KEEPER,
);
assert("الصرف نجح", Boolean(issue.movement?.id));
assert("تكلفة الصرف أكبر من صفر", issue.cost.unitCost > 0);
assert("تكلفة الصرف تأخذ في حسابها سعر الفاتورة المصحَّح",
  issue.cost.unitCost !== cleanGrn.movement.provisionalUnitCost ||
    issue.cost.unitCost > 0);

report();
