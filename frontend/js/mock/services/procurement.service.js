/**
 * خدمة المشتريات والمطابقة الثلاثية (3-Way Match).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  توزيع المسؤولية الذي تُنفّذه هذه الخدمة:
 *
 *    أمين المخزن  →  يُقرّ بالكمية والحالة. **لا يُدخل سعرًا.**
 *    المحاسب      →  يُطابق فاتورة المورد ويُدخل السعر.
 *    المراجع      →  يُراجع فروق السعر ويأخذ مبرر المورد.
 *
 *  الفصل ليس تنظيميًا فقط — هو ضابط رقابي: من يستلم البضاعة لا يُقرر ثمنها،
 *  فلا يستطيع فرد واحد استلام كمية بسعر يختاره ثم صرف قيمتها.
 *
 *  والمطابقة تُقارن ثلاثة مصادر:
 *    1. ما طُلب   (أمر الشراء — إن وُجد)
 *    2. ما وصل    (إذن الإضافة — كميات أمين المخزن)
 *    3. ما فُوتِر (فاتورة المورد — كميات وأسعار)
 *
 *  وأي فارق يُعلَن ويُوثَّق، لا يُسوّى بصمت.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { notFound, validationError, ruleViolation } from "../../core/errors.js";
import * as money from "../../core/money.js";
import { db, all, find, insert, update } from "../db.js";
import { SourceType } from "../../domain/posting.js";
import { postDocument, audit } from "./posting.service.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/** نسبة فارق الكمية المسموح بها دون تسجيل استثناء رقابي. */
const QTY_TOLERANCE_PCT = 0;

/** نسبة فارق السعر التي تستوجب مراجعة المراجع قبل الاعتماد. */
const PRICE_REVIEW_THRESHOLD_PCT = 5;

/* ==========================================================================
   1) قائمة الاستلامات المنتظرة سعرًا — لوحة المحاسب
   ========================================================================== */

/**
 * إذون الإضافة التي استلمها المخزن ولم يُدخل المحاسب سعر فاتورتها بعد.
 *
 * هذه هي شاشة عمل المحاسب اليومية: بضاعة على الرف بقيمة مؤقتة تنتظر
 * التسعير. تركها دون متابعة يعني مخزونًا مُقيَّمًا بسعر قديم ومديونية مورد
 * غير مُثبَّتة.
 */
export function listReceiptsAwaitingPrice(params = {}) {
  const rows = all("stockMovements")
    .filter((m) => m.documentType === "goods_receipt")
    .filter((m) => m.priceStatus === "pending_invoice")
    .filter((m) => !params.supplierId || String(m.supplierId) === String(params.supplierId))
    .filter((m) => !params.warehouseId || String(m.warehouseId) === String(params.warehouseId))
    .filter((m) => {
      if (!params.search) return true;
      const q = String(params.search).toLowerCase();
      return [m.reference, m.itemName, m.itemCode, m.warehouseName].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      );
    })
    .map((m) => {
      const supplier = m.supplierId ? find("suppliers", m.supplierId) : null;
      const item = find("items", m.itemId);

      return {
        movementId: m.id,
        reference: m.reference,
        date: m.date,
        itemId: m.itemId,
        itemCode: m.itemCode,
        itemName: m.itemName,
        unit: item?.unit ?? "—",
        warehouseId: m.warehouseId,
        warehouseName: m.warehouseName,
        receivedQty: m.quantity,
        supplierId: m.supplierId,
        supplierName: supplier?.name ?? "مورد غير محدد",

        /** التقييم المؤقت — ليس سعر الفاتورة. */
        provisionalUnitCost: m.provisionalUnitCost ?? m.unitCost,
        provisionalValue: m.totalCost,

        receivedBy: m.performedBy,
        notes: m.notes,
        ageDays: daysBetween(m.date, TODAY),
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays || b.movementId - a.movementId);

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 20);
  const start = (page - 1) * perPage;

  const provisionalTotal = rows.reduce((sum, r) => money.add(sum, r.provisionalValue), 0);

  return {
    data: rows.slice(start, start + perPage),
    meta: {
      total: rows.length,
      page,
      perPage,
      totalPages: Math.ceil(rows.length / perPage) || 1,
      provisionalTotal,
      /** أقدم استلام بلا سعر — مؤشر تأخر التسعير. */
      oldestAgeDays: rows[0]?.ageDays ?? 0,
    },
  };
}

function daysBetween(fromDate, toDate) {
  const a = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const b = new Date(`${toDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/* ==========================================================================
   2) المطابقة الثلاثية
   ========================================================================== */

/**
 * يقارن الأرقام الثلاثة ويُرجع الفروق **قبل** الترحيل — معاينة للمحاسب.
 *
 * @returns {{quantityVariance, priceVariance, exceptions: string[]}}
 */
export function previewMatch(movementId, payload = {}) {
  const movement = find("stockMovements", movementId);
  if (!movement) throw notFound("إذن الإضافة غير موجود.");

  if (movement.documentType !== "goods_receipt") {
    throw ruleViolation("المطابقة تخص إذون الإضافة فقط.", { field: "movementId" });
  }

  const receivedQty = Number(movement.quantity);
  const invoiceQty = Number(payload.invoiceQty ?? receivedQty);
  const invoiceUnitCost = money.round(payload.invoiceUnitCost ?? 0);

  const provisionalUnitCost = money.round(movement.provisionalUnitCost ?? movement.unitCost);
  const accruedValue = money.round(movement.totalCost);

  /*
   * قيمة الفاتورة تُحسب على **الكمية المستلمة** لا المفوترة: المنشأة لا تدفع
   * إلا ما استلمته. الفارق يُعلَن استثناءً ليُسوّى مع المورد بإشعار دائن.
   */
  const payableQty = Math.min(invoiceQty, receivedQty);
  const invoiceValue = money.multiply(invoiceUnitCost, payableQty);

  const quantityVariance = invoiceQty - receivedQty;
  const priceVariance = money.subtract(invoiceUnitCost, provisionalUnitCost);
  const priceVariancePct =
    provisionalUnitCost > 0
      ? Number(((priceVariance / provisionalUnitCost) * 100).toFixed(2))
      : 0;
  const valueVariance = money.subtract(invoiceValue, accruedValue);

  const exceptions = [];

  if (quantityVariance > QTY_TOLERANCE_PCT) {
    exceptions.push(
      `المورد فوتر ${invoiceQty} والمستلم فعلًا ${receivedQty} — ` +
        `فرق ${quantityVariance} لن يُدفع. اطلب إشعارًا دائنًا من المورد.`,
    );
  }
  if (quantityVariance < 0) {
    exceptions.push(
      `المستلم ${receivedQty} أكثر من المفوتر ${invoiceQty} — ` +
        "راجع العد أو اطلب فاتورة تكميلية.",
    );
  }
  if (Math.abs(priceVariancePct) >= PRICE_REVIEW_THRESHOLD_PCT) {
    exceptions.push(
      `فرق السعر ${priceVariancePct}% عن آخر سعر شراء — ` +
        "يستوجب مراجعة مبرر المورد قبل الاعتماد.",
    );
  }

  return {
    movementId: movement.id,
    receiptReference: movement.reference,
    itemId: movement.itemId,
    itemName: movement.itemName,
    supplierId: movement.supplierId,
    supplierName: movement.supplierId ? find("suppliers", movement.supplierId)?.name : null,

    receivedQty,
    invoiceQty,
    payableQty,
    quantityVariance,

    provisionalUnitCost,
    invoiceUnitCost,
    priceVariance,
    priceVariancePct,

    accruedValue,
    invoiceValue,
    valueVariance,

    exceptions,
    requiresReview: Math.abs(priceVariancePct) >= PRICE_REVIEW_THRESHOLD_PCT,
    isClean: exceptions.length === 0,
  };
}

/**
 * يعتمد مطابقة فاتورة مورد: يُسعِّر الاستلام ويُقفل الاستحقاق.
 *
 * الأثر:
 *   1. تصحيح تكلفة الحركة المخزنية لسعر الفاتورة (فيُقيَّم الصرف اللاحق صح)
 *   2. تحديث آخر سعر شراء للصنف
 *   3. قيد: إقفال «مستلم ولم يُفوتر» + فرق السعر على المخزون + مديونية المورد
 *   4. فتح مراجعة سعر بيع إن تغيّر سعر الشراء (دورة التسعير القائمة)
 */
export function matchSupplierInvoice(movementId, payload = {}, { user } = {}) {
  const movement = find("stockMovements", movementId);
  if (!movement) throw notFound("إذن الإضافة غير موجود.");

  if (movement.priceStatus === "priced") {
    throw ruleViolation(
      `إذن الإضافة ${movement.reference} مُسعَّر بالفعل ` +
        `${movement.matchedBy ? `بواسطة ${movement.matchedBy}` : ""} — لا يُطابق مرتين.`,
      { field: "movementId" },
    );
  }

  const errors = {};
  if (!(Number(payload.invoiceUnitCost) > 0)) {
    errors.invoiceUnitCost = "سعر الوحدة في فاتورة المورد مطلوب.";
  }
  if (!String(payload.supplierInvoiceRef ?? "").trim()) {
    errors.supplierInvoiceRef = "رقم فاتورة المورد مطلوب لتوثيق المطابقة.";
  }
  if (Object.keys(errors).length) throw validationError(errors);

  const preview = previewMatch(movementId, payload);

  /*
   * فرق سعر كبير لا يُعتمد إلا بمبرر مكتوب. «الاعتماد ثم المراجعة لاحقًا»
   * يعني صرف فلوس على زيادة لم يُسألْ عنها أحد.
   */
  if (preview.requiresReview && !String(payload.varianceReason ?? "").trim()) {
    throw validationError({
      varianceReason:
        `فرق السعر ${preview.priceVariancePct}% يتجاوز حد المراجعة ` +
        `(${PRICE_REVIEW_THRESHOLD_PCT}%) — اكتب مبرر المورد قبل الاعتماد.`,
    });
  }

  const item = find("items", movement.itemId);
  const warehouse = find("warehouses", movement.warehouseId);
  const supplier = movement.supplierId ? find("suppliers", movement.supplierId) : null;
  const date = payload.date ?? TODAY;

  /* 1) تصحيح تكلفة الحركة لسعر الفاتورة — ليُقيَّم الصرف اللاحق صحيحًا. */
  const correctedTotal = money.multiply(preview.invoiceUnitCost, movement.quantity);

  const updatedMovement = update("stockMovements", movementId, {
    unitCost: preview.invoiceUnitCost,
    totalCost: correctedTotal,
    invoiceUnitCost: preview.invoiceUnitCost,
    priceStatus: "priced",
    supplierInvoiceRef: String(payload.supplierInvoiceRef).trim(),
    invoiceQty: preview.invoiceQty,
    quantityVariance: preview.quantityVariance,
    priceVariance: preview.priceVariance,
    priceVariancePct: preview.priceVariancePct,
    varianceReason: payload.varianceReason?.trim() ?? null,
    matchedAt: new Date().toISOString(),
    matchedBy: user?.name ?? "المحاسب المسؤول",
  });

  /* 2) آخر سعر شراء — يُحدَّث من سعر الفاتورة وحده. */
  const previousCost = item?.lastPurchasePrice ?? item?.costPrice ?? 0;
  if (item) update("items", item.id, { lastPurchasePrice: preview.invoiceUnitCost });

  /* 3) القيد — إقفال الاستحقاق وإثبات مديونية المورد. */
  const posting = postDocument({
    sourceType: SourceType.PURCHASE_INVOICE_MATCH,
    sourceId: movement.id,
    document: {
      accruedValue: preview.accruedValue,
      invoiceValue: money.multiply(preview.invoiceUnitCost, movement.quantity),
      itemName: movement.itemName,
      receiptReference: movement.reference,
      supplierInvoiceRef: updatedMovement.supplierInvoiceRef,
      supplierId: movement.supplierId,
      supplierName: supplier?.name ?? null,
      inventoryAccountId: warehouse?.inventoryAccountId ?? item?.inventoryAccountId,
    },
    date,
    description:
      `مطابقة فاتورة ${updatedMovement.supplierInvoiceRef} مع إذن ${movement.reference} — ` +
      `${movement.itemName}`,
    reference: updatedMovement.supplierInvoiceRef,
    user,
  });

  /* 4) سجل المطابقة — الأثر الرقابي الذي يُراجَع لاحقًا. */
  const matchRecord = insert("purchaseMatches", {
    movementId: movement.id,
    receiptReference: movement.reference,
    supplierInvoiceRef: updatedMovement.supplierInvoiceRef,
    date,
    itemId: movement.itemId,
    itemCode: movement.itemCode,
    itemName: movement.itemName,
    warehouseId: movement.warehouseId,
    warehouseName: movement.warehouseName,
    supplierId: movement.supplierId,
    supplierName: supplier?.name ?? null,

    receivedQty: preview.receivedQty,
    invoiceQty: preview.invoiceQty,
    payableQty: preview.payableQty,
    quantityVariance: preview.quantityVariance,

    provisionalUnitCost: preview.provisionalUnitCost,
    invoiceUnitCost: preview.invoiceUnitCost,
    priceVariance: preview.priceVariance,
    priceVariancePct: preview.priceVariancePct,

    accruedValue: preview.accruedValue,
    invoiceValue: preview.invoiceValue,
    valueVariance: preview.valueVariance,

    exceptions: preview.exceptions,
    varianceReason: payload.varianceReason?.trim() ?? null,
    requiredReview: preview.requiresReview,
    journalEntryId: posting.entry?.id ?? null,
    matchedBy: user?.name ?? "المحاسب المسؤول",
    matchedAt: new Date().toISOString(),
  });

  /*
   * 5) مراجعة سعر البيع — تُفتح الآن على سعر الفاتورة المعتمد.
   *
   * أمين المخزن لا يملك تعديل سعر البيع، والمحاسب يُدخل سعر الشراء فقط.
   * تعديل سعر البيع قرار مدير الحسابات في شاشة مراجعة التسعير.
   */
  let priceReview = null;
  if (item && previousCost > 0 && Number(preview.invoiceUnitCost) !== Number(previousCost)) {
    const changePercent = Number(
      (((preview.invoiceUnitCost - previousCost) / previousCost) * 100).toFixed(1),
    );
    const currentMarginPct = Number(
      (((item.sellingPrice - previousCost) / previousCost) * 100).toFixed(1),
    );

    priceReview = insert("priceReviews", {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      receiptReference: movement.reference,
      receiptId: movement.id,
      supplierInvoiceRef: updatedMovement.supplierInvoiceRef,
      date,
      oldPurchasePrice: previousCost,
      newPurchasePrice: preview.invoiceUnitCost,
      changePercent,
      currentSellingPrice: item.sellingPrice,
      currentMarginPct,
      suggestedSellingPrice: money.round(preview.invoiceUnitCost * (1 + currentMarginPct / 100)),
      status: "pending",
      approvedPrice: null,
      approvedMarginPct: null,
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      supplierReason: payload.varianceReason?.trim() ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  audit({
    action: "purchase.invoice_matched",
    actionLabel: "مطابقة فاتورة مورد مع إذن الاستلام",
    module: "المخازن",
    entity: "stock_movement",
    entityId: movement.id,
    details:
      `${movement.reference} ↔ ${updatedMovement.supplierInvoiceRef} — ${movement.itemName} · ` +
      `مستلم ${preview.receivedQty} · مفوتر ${preview.invoiceQty} · ` +
      `سعر ${preview.invoiceUnitCost} (فرق ${preview.priceVariancePct}%)` +
      (preview.exceptions.length ? ` · استثناءات: ${preview.exceptions.length}` : ""),
    user,
  });

  return {
    match: matchRecord,
    movement: updatedMovement,
    journalEntry: posting.entry,
    priceReview,
    exceptions: preview.exceptions,
  };
}

/* ==========================================================================
   3) سجل المطابقات والفروق
   ========================================================================== */

/** سجل المطابقات المنفَّذة — للمراجع والتدقيق. */
export function listPurchaseMatches(params = {}) {
  const rows = all("purchaseMatches")
    .filter((m) => !params.supplierId || String(m.supplierId) === String(params.supplierId))
    .filter((m) => !params.itemId || String(m.itemId) === String(params.itemId))
    .filter((m) => {
      if (params.onlyExceptions) return (m.exceptions ?? []).length > 0;
      return true;
    })
    .filter((m) => {
      if (!params.search) return true;
      const q = String(params.search).toLowerCase();
      return [m.receiptReference, m.supplierInvoiceRef, m.itemName, m.supplierName].some((v) =>
        String(v ?? "").toLowerCase().includes(q),
      );
    })
    .sort((a, b) => String(b.matchedAt).localeCompare(String(a.matchedAt)));

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 20);
  const start = (page - 1) * perPage;

  const withExceptions = rows.filter((m) => (m.exceptions ?? []).length > 0).length;
  const totalVariance = rows.reduce((sum, m) => money.add(sum, m.valueVariance ?? 0), 0);
  const invoicedTotal = rows.reduce((sum, m) => money.add(sum, m.invoiceValue ?? 0), 0);

  return {
    data: rows.slice(start, start + perPage),
    meta: {
      total: rows.length,
      page,
      perPage,
      totalPages: Math.ceil(rows.length / perPage) || 1,
      withExceptions,
      totalVariance,
      invoicedTotal,
      variancePct:
        invoicedTotal > 0 ? Number(((totalVariance / invoicedTotal) * 100).toFixed(2)) : 0,
    },
  };
}

/** تفاصيل مطابقة واحدة. */
export function getPurchaseMatch(id) {
  const match = find("purchaseMatches", id);
  if (!match) throw notFound("سجل المطابقة غير موجود.");
  return {
    ...match,
    movement: find("stockMovements", match.movementId) ?? null,
    journalEntry: match.journalEntryId ? find("journalEntries", match.journalEntryId) : null,
  };
}
