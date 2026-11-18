/**
 * خدمة المخازن — الأصناف، الحركات، التقييم، الجرد.
 *
 * كل حركة مخزنية تُرحَّل محاسبيًا بتكلفتها المحسوبة من محرك التقييم، لا
 * بسعر البيع ولا بآخر سعر شراء.
 */

import { ruleViolation, notFound, validationError } from "../../core/errors.js";
import * as money from "../../core/money.js";
import {
  valuate,
  valuateInventory,
  previewIssueCost,
  deriveStockStatus,
  deriveBatchStatus,
  expiryExposure,
  stockBalance,
  MOVEMENT_LABELS,
  isInbound,
  isOutbound,
} from "../../domain/valuation.js";
import { SourceType } from "../../domain/posting.js";
import { db, all, find, insert, update, where, query } from "../db.js";
import { postDocument, audit, entryForDocument } from "./posting.service.js";
import { canAccessWarehouse, allowedWarehouseIds } from "../../core/permissions.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/** المخزن الرئيسي المركزي — مركز الإمداد الذي تُراجع عنده طلبات الفروع. */
const HUB_WAREHOUSE_ID = 1;

/** حد الفائض الذي يسمح بالمناقلة بدل الشراء الخارجي، حين لا يحدده الصنف. */
const DEFAULT_SURPLUS_THRESHOLD = 15;

/**
 * يرفض التصرف في مخزن خارج نطاق المستخدم.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  إخفاء الزر ليس أمانًا. أمين مخزن فرع 1 قد يصل لمسار صرف من فرع 3 بطلب
 *  مباشر أو بتبويب قديم مفتوح، فالقيد يُفرض عند **تنفيذ العملية** لا عند
 *  رسمها. (وفي الباك-إند الحقيقي يُفرض مرة أخرى على الخادم — هذه الطبقة
 *  مواصفةٌ له لا بديل عنه.)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function assertWarehouseInScope(warehouse, action = "التصرف") {
  if (canAccessWarehouse(warehouse?.id)) return;

  const allowed = (allowedWarehouseIds() ?? [])
    .map((id) => find("warehouses", id)?.name)
    .filter(Boolean);

  throw ruleViolation(
    `${action} في «${warehouse?.name ?? "هذا المخزن"}» خارج نطاق صلاحيتك. ` +
      (allowed.length
        ? `المخازن المسندة إليك: ${allowed.join(" · ")}.`
        : "لا يوجد مخزن مسند إليك — راجع مدير النظام."),
    { field: "warehouseId" },
  );
}

/* ==========================================================================
   1) مساعدات التقييم
   ========================================================================== */

/** حركات (صنف × مخزن). */
function bucketFor(itemId, warehouseId) {
  return all("stockMovements").filter(
    (movement) =>
      String(movement.itemId) === String(itemId) &&
      String(movement.warehouseId) === String(warehouseId),
  );
}

/** طريقة التقييم المعتمدة: الصنف أولًا، ثم المخزن، ثم الافتراضي العام. */
function methodFor(item, warehouse) {
  return item?.costingMethod ?? warehouse?.costingMethod ?? db.systemPreferences.defaultCostingMethod;
}

/** رصيد (صنف × مخزن) الحالي، محسوبًا من الحركات. */
export function currentBalance(itemId, warehouseId) {
  const item = find("items", itemId);
  const warehouse = find("warehouses", warehouseId);
  if (!item) throw notFound("الصنف غير موجود.");
  if (!warehouse) throw notFound("المخزن غير موجود.");

  const stored = all("stockBalances").find(
    (row) => String(row.itemId) === String(itemId) && String(row.warehouseId) === String(warehouseId),
  );

  const result = stockBalance(bucketFor(itemId, warehouseId), {
    reserved: stored?.reserved ?? 0,
    method: methodFor(item, warehouse),
  });

  return { item, warehouse, ...result, method: methodFor(item, warehouse) };
}

/** يُحدّث صف الرصيد المخزَّن بعد حركة — عرض مُشتَق يُعاد حسابه، لا مصدر حقيقة. */
export function refreshBalance(itemId, warehouseId) {
  const item = find("items", itemId);
  const warehouse = find("warehouses", warehouseId);
  const result = valuate(bucketFor(itemId, warehouseId), methodFor(item, warehouse));

  const existing = all("stockBalances").find(
    (row) => String(row.itemId) === String(itemId) && String(row.warehouseId) === String(warehouseId),
  );

  const patch = {
    onHand: result.quantityOnHand,
    available: Math.max(0, result.quantityOnHand - (existing?.reserved ?? 0)),
    averageCost: result.averageCost,
    totalValue: result.totalValue,
    layers: result.layers.length,
    status: deriveStockStatus({
      onHand: result.quantityOnHand,
      minLevel: item.minLevel,
      maxLevel: item.maxLevel,
      reorderPoint: item.reorderPoint,
    }),
    lastMovementDate: TODAY,
  };

  if (existing) return update("stockBalances", existing.id, patch);

  return insert("stockBalances", {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    itemNameEn: item.nameEn,
    categoryId: item.categoryId,
    category: item.category,
    unit: item.unit,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    inventoryAccountId: warehouse.inventoryAccountId ?? item.inventoryAccountId,
    costingMethod: methodFor(item, warehouse),
    reserved: 0,
    minLevel: item.minLevel,
    maxLevel: item.maxLevel,
    reorderPoint: item.reorderPoint,
    ...patch,
  });
}

/* ==========================================================================
   2) الأصناف والأرصدة
   ========================================================================== */

export function listItems(params = {}) {
  const result = query("items", params);
  const balances = all("stockBalances");

  return {
    ...result,
    data: result.data.map((item) => {
      const own = balances.filter((row) => String(row.itemId) === String(item.id));
      const onHand = own.reduce((total, row) => total + row.onHand, 0);

      return {
        ...item,
        onHand,
        reserved: own.reduce((total, row) => total + row.reserved, 0),
        available: own.reduce((total, row) => total + row.available, 0),
        totalValue: money.sumBy(own, "totalValue"),
        warehousesCount: own.length,
        /** الحالة مُشتقّة من الرصيد الكلي لا مخزَّنة على الصنف. */
        status: item.status !== "active" ? item.status : deriveStockStatus({
          onHand,
          minLevel: item.minLevel,
          maxLevel: item.maxLevel,
          reorderPoint: item.reorderPoint,
        }),
      };
    }),
  };
}

export function getItem(id) {
  const item = find("items", id);
  if (!item) throw notFound("الصنف غير موجود.");

  const balances = all("stockBalances").filter((row) => String(row.itemId) === String(item.id));
  const movements = all("stockMovements").filter((row) => String(row.itemId) === String(item.id));

  return {
    ...item,
    balances,
    onHand: balances.reduce((total, row) => total + row.onHand, 0),
    totalValue: money.sumBy(balances, "totalValue"),
    movements: movements.slice(-60).reverse(),
    batches: where("batches", (row) => String(row.itemId) === String(item.id)),
    /** طبقات التكلفة — تُظهر كيف يعمل FIFO فعلًا على هذا الصنف. */
    layers: balances.flatMap((balance) => {
      const result = valuate(
        bucketFor(item.id, balance.warehouseId),
        methodFor(item, find("warehouses", balance.warehouseId)),
      );
      return result.layers.map((layer) => ({ ...layer, warehouseName: balance.warehouseName }));
    }),
  };
}

export function listBalances(params = {}) {
  const result = query("stockBalances", params);

  return {
    ...result,
    totals: {
      quantity: all("stockBalances").reduce((total, row) => total + row.onHand, 0),
      value: money.sumBy(all("stockBalances"), "totalValue"),
      lines: all("stockBalances").length,
    },
  };
}

/* ==========================================================================
   3) الحركات المخزنية
   ========================================================================== */

export function listMovements(params = {}) {
  const result = query("stockMovements", params);

  return {
    ...result,
    data: result.data.map((movement) => ({
      ...movement,
      typeLabel: movement.typeLabel ?? MOVEMENT_LABELS[movement.type] ?? movement.type,
      direction: isInbound(movement) ? "in" : "out",
      journalEntry: null,
    })),
  };
}

/** يتحقق من المدخلات المشتركة لكل حركة. */
function validateMovement(payload) {
  const errors = {};
  if (!payload?.itemId) errors.itemId = "الصنف مطلوب.";
  if (!payload?.warehouseId) errors.warehouseId = "المخزن مطلوب.";
  if (!(Number(payload?.quantity) > 0)) errors.quantity = "الكمية يجب أن تكون أكبر من صفر.";
  if (Object.keys(errors).length) throw validationError(errors);

  const item = find("items", payload.itemId);
  const warehouse = find("warehouses", payload.warehouseId);
  if (!item) throw notFound("الصنف غير موجود.");
  if (!warehouse) throw notFound("المخزن غير موجود.");

  /* المستخدم يتصرف في مخزنه فقط. */
  assertWarehouseInScope(warehouse, "تسجيل حركة مخزنية");

  /* الصنف يُخزَّن في المخازن المسموح بها فقط. */
  if (!(item.warehouseIds ?? []).map(String).includes(String(warehouse.id))) {
    throw ruleViolation(
      `الصنف «${item.name}» غير مسموح بتخزينه في «${warehouse.name}». ` +
        "أضف المخزن إلى مخازن الصنف أولًا.",
      { field: "warehouseId" },
    );
  }

  return { item, warehouse, quantity: Number(payload.quantity) };
}

/** إذن إضافة مخزني. */
export function createReceipt(payload, { user } = {}) {
  const { item, warehouse, quantity } = validateMovement(payload);

  /*
   * ═══════════════════════════════════════════════════════════════════════
   *  السعر ليس مسؤولية أمين المخزن.
   *
   *  أمين المخزن يُقرّ بما استلمه: الصنف والكمية وحالته. سعر الفاتورة يدخله
   *  المحاسب عند مطابقة فاتورة المورد (`procurement.service.js`).
   *
   *  فإن لم يُمرَّر سعر، يُقيَّم الاستلام **مؤقتًا** بآخر سعر شراء معروف
   *  ويُوسَم `pending_invoice`. التقييم المؤقت ليس تخمينًا مُخفى: الفارق
   *  بينه وبين سعر الفاتورة يُرحَّل فرق سعر صريحًا عند المطابقة، والمخزون
   *  يُصحَّح لتكلفته الفعلية.
   *
   *  البديل — رفض الاستلام حتى تصل الفاتورة — يعني بضاعة على الرف لا تظهر
   *  في الأصول، وهو أسوأ من تقييم مؤقت مُعلَن.
   * ═══════════════════════════════════════════════════════════════════════
   */
  const priceProvided = payload?.unitCost !== undefined && payload?.unitCost !== null && payload?.unitCost !== "";
  const unitCost = money.round(priceProvided ? payload.unitCost : (item.lastPurchasePrice ?? item.costPrice));

  if (!money.isPositive(unitCost)) {
    throw validationError({
      unitCost:
        "لا يوجد سعر شراء سابق لهذا الصنف يُقيَّم به الاستلام مؤقتًا — " +
        "أدخل سعر الوحدة في إذن الإضافة.",
    });
  }

  const priceStatus = priceProvided ? "priced" : "pending_invoice";

  if (item.trackBatches && !String(payload?.batchNumber ?? "").trim()) {
    throw validationError({ batchNumber: "هذا الصنف يُتتبَّع بالتشغيلات — رقم التشغيلة مطلوب." });
  }
  if (item.trackExpiry && !payload?.expiryDate) {
    throw validationError({ expiryDate: "هذا الصنف يُتتبَّع بالصلاحية — تاريخ الصلاحية مطلوب." });
  }

  const sequence = all("stockMovements").filter((row) => row.documentType === "goods_receipt").length + 1;
  const totalCost = money.multiply(unitCost, quantity);

  const movement = insert("stockMovements", {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    type: "receipt",
    typeLabel: MOVEMENT_LABELS.receipt,
    date: payload?.date ?? TODAY,
    quantity,
    unitCost,
    totalCost,
    reference: `GRN-2026-${String(sequence).padStart(4, "0")}`,
    documentType: "goods_receipt",

    /** `pending_invoice` = مُقيَّم مؤقتًا بانتظار سعر فاتورة المورد. */
    priceStatus,
    provisionalUnitCost: priceProvided ? null : unitCost,
    invoiceUnitCost: priceProvided ? unitCost : null,
    matchedAt: null,
    matchedBy: null,
    supplierInvoiceRef: null,
    priceVariance: null,

    supplierId: payload?.supplierId ?? null,
    batchNumber: payload?.batchNumber ?? null,
    expiryDate: payload?.expiryDate ?? null,
    performedBy: user?.name ?? "—",
    notes: payload?.notes ?? null,
  });

  if (item.trackBatches) {
    insert("batches", {
      batchNumber: movement.batchNumber,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      receivedDate: movement.date,
      productionDate: payload?.productionDate ?? null,
      expiryDate: movement.expiryDate,
      initialQuantity: quantity,
      quantity,
      unitCost,
      supplierId: movement.supplierId,
      reference: movement.reference,
      status: deriveBatchStatus({ expiryDate: movement.expiryDate }, REFERENCE_DATE),
      value: totalCost,
      notes: null,
    });
  }

  const balance = refreshBalance(item.id, warehouse.id);

  /*
   * كشف تغير سعر الشراء عن السعر السابق:
   * إذا ورد الصنف بسعر شراء يختلف عن آخر سعر شراء مسجل، لا يتغير سعر البيع تلقائيًا،
   * بل يُنشأ طلب مراجعة وتحديث سعر بيع للمريض خاص بمدير الحسابات مع إشعار فوري.
   */
  /*
   * مراجعة السعر تُفتح على **سعر الفاتورة** لا على التقييم المؤقت. التقييم
   * المؤقت هو آخر سعر معروف أصلًا، ففتح مراجعة عليه يُنتج إشعارًا لمدير
   * الحسابات بأن السعر «تغيّر» إلى نفسه.
   */
  const previousCost = item.lastPurchasePrice ?? item.costPrice;
  if (priceProvided && previousCost && Number(unitCost) !== Number(previousCost)) {
    const changePercent = Number((((unitCost - previousCost) / previousCost) * 100).toFixed(1));
    const currentMarginPct = previousCost > 0
      ? Number((((item.sellingPrice - previousCost) / previousCost) * 100).toFixed(1))
      : 0;
    const suggestedSellingPrice = previousCost > 0
      ? money.round(unitCost * (1 + currentMarginPct / 100))
      : unitCost;

    insert("priceReviews", {
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      receiptReference: movement.reference,
      receiptId: movement.id,
      date: movement.date,
      oldPurchasePrice: previousCost,
      newPurchasePrice: unitCost,
      changePercent,
      currentSellingPrice: item.sellingPrice,
      currentMarginPct,
      suggestedSellingPrice,
      status: "pending",
      approvedPrice: null,
      approvedMarginPct: null,
      decisionNotes: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: new Date().toISOString(),
    });

    audit({
      action: "pricing.review.created",
      actionLabel: "طلب مراجعة سعر بيع",
      module: "المخازن",
      entity: "price_review",
      entityId: movement.id,
      details: `تغير سعر شراء «${item.name}» من ${previousCost} إلى ${unitCost} ج.م في إذن ${movement.reference}. إشعار لمدير الحسابات.`,
      user,
    });
  }

  /*
   * آخر سعر شراء يُحدَّث من سعر الفاتورة فقط. تحديثه من التقييم المؤقت
   * يجعل الصنف يُقيَّم أبدًا بسعره القديم: كل استلام يُثبّت القديم من جديد.
   */
  if (priceProvided) {
    update("items", item.id, { lastPurchasePrice: unitCost });
  }

  const posting = postDocument({
    sourceType: SourceType.INVENTORY_RECEIPT,
    sourceId: movement.id,
    document: {
      totalCost,
      warehouseName: warehouse.name,
      supplierId: movement.supplierId,
      supplierName: movement.supplierId ? find("suppliers", movement.supplierId)?.name : null,
      inventoryAccountId: warehouse.inventoryAccountId ?? item.inventoryAccountId,
    },
    date: movement.date,
    description: `إذن إضافة ${movement.reference} — ${item.name}`,
    reference: movement.reference,
    user,
  });

  audit({
    action: "stock.receipt", actionLabel: "إذن إضافة مخزني",
    module: "المخازن", entity: "stock_movement", entityId: movement.id,
    details: `${movement.reference} — ${item.name} — ${quantity} ${item.unit}`, user,
  });

  return {
    movement,
    balance,
    journalEntry: posting.entry,
    priceStatus,
    /** تُعلنه الواجهة صريحًا: الاستلام مُسجَّل لكن سعره لم يُعتمد بعد. */
    awaitingInvoicePrice: priceStatus === "pending_invoice",
  };
}

/**
 * إذن صرف مخزني.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  السيناريو 4 من التكامل: الصرف → التقييم → الاعتراف بالتكلفة → الأستاذ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * التكلفة تأتي من محرك التقييم (FIFO أو المتوسط المرجّح) — لا من حقل مُدخَل
 * ولا من سعر الصنف. ولذلك تُحسب **قبل** تسجيل الحركة ثم تُثبَّت عليها.
 */
export function createIssue(payload, { user } = {}) {
  const { item, warehouse, quantity } = validateMovement(payload);

  const method = methodFor(item, warehouse);
  const history = bucketFor(item.id, warehouse.id);
  const preview = previewIssueCost(history, { quantity, method, date: payload?.date ?? TODAY });

  /* المخزون السالب: مرفوض ما لم يُسمح به صراحةً في إعدادات النظام. */
  if (preview.shortfall > 0 && !(warehouse.allowNegative || db.systemPreferences.allowNegativeInventory)) {
    throw ruleViolation(
      `الكمية المتاحة من «${item.name}» في «${warehouse.name}» هي ${preview.available} ` +
        `${item.unit}، والمطلوب ${quantity}. لا يُسمح برصيد سالب.`,
      { field: "quantity" },
    );
  }

  const stored = all("stockBalances").find(
    (row) => String(row.itemId) === String(item.id) && String(row.warehouseId) === String(warehouse.id),
  );

  /* المحجوز ليس متاحًا — صرفه يسمح ببيع نفس الكمية مرتين. */
  if (stored && quantity > stored.available && !db.systemPreferences.allowNegativeInventory) {
    throw ruleViolation(
      `المتاح ${stored.available} ${item.unit} فقط (${stored.reserved} محجوز من إجمالي ${stored.onHand}). ` +
        "أفرج عن الحجز أو أنقص الكمية.",
      { field: "quantity" },
    );
  }

  const sequence = all("stockMovements").filter((row) => row.documentType === "goods_issue").length + 1;

  const movement = insert("stockMovements", {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    type: "issue",
    typeLabel: MOVEMENT_LABELS.issue,
    date: payload?.date ?? TODAY,
    quantity,
    /** التكلفة المحسوبة تُثبَّت على الحركة للتدقيق — ومصدرها المحرك لا الإدخال. */
    unitCost: preview.unitCost,
    totalCost: preview.totalCost,
    costingMethod: method,
    reference: `ISS-2026-${String(sequence).padStart(4, "0")}`,
    documentType: "goods_issue",
    reason: payload?.reason ?? "صرف مخزني",
    costCenterId: payload?.costCenterId ?? null,
    expenseAccountId: payload?.expenseAccountId ?? null,
    performedBy: user?.name ?? "—",
    notes: payload?.notes ?? null,
  });

  const balance = refreshBalance(item.id, warehouse.id);

  const posting = postDocument({
    sourceType: SourceType.INVENTORY_ISSUE,
    sourceId: movement.id,
    document: {
      totalCost: preview.totalCost,
      warehouseName: warehouse.name,
      reason: movement.reason,
      costCenterId: movement.costCenterId,
      expenseAccountId: movement.expenseAccountId,
      inventoryAccountId: warehouse.inventoryAccountId ?? item.inventoryAccountId,
    },
    date: movement.date,
    description: `إذن صرف ${movement.reference} — ${item.name}`,
    reference: movement.reference,
    costCenterId: movement.costCenterId,
    user,
  });

  audit({
    action: "stock.issue", actionLabel: "إذن صرف مخزني",
    module: "المخازن", entity: "stock_movement", entityId: movement.id,
    details: `${movement.reference} — ${item.name} — ${quantity} ${item.unit} بتكلفة ${preview.totalCost}`,
    user,
  });

  return { movement, balance, cost: preview, journalEntry: posting.entry };
}

/**
 * تحويل مخزني بين مخزنين.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  التحويل الداخلي لا يُنشئ إيرادًا ولا مشترياتٍ ولا تكلفة مبيعات.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * حركتان بنفس المرجع: صادرة من الأول وواردة إلى الثاني بنفس التكلفة. الوارد
 * يدخل بتكلفة الصادر المحسوبة، لا بسعر الصنف — وإلا خلق التحويل قيمة من فراغ.
 */
export function createTransfer(payload, { user } = {}) {
  const { item, warehouse: fromWarehouse, quantity } = validateMovement({
    ...payload,
    warehouseId: payload?.fromWarehouseId,
  });

  const toWarehouse = find("warehouses", payload?.toWarehouseId);
  if (!toWarehouse) throw notFound("المخزن المستقبل غير موجود.");

  /*
   * التحويل يتطلب نطاقًا على **الطرفين**: من يحوّل من مخزنه إلى مخزن لا
   * يملكه ينقل عهدة لغيره بلا إقرار منه. المسار الصحيح لذلك هو طلب نواقص
   * بفحص واستلام، لا تحويل مباشر.
   */
  assertWarehouseInScope(toWarehouse, "التحويل إلى");

  if (String(fromWarehouse.id) === String(toWarehouse.id)) {
    throw ruleViolation("لا يُحوَّل صنف من مخزن إلى نفسه.", { field: "toWarehouseId" });
  }
  if (!(item.warehouseIds ?? []).map(String).includes(String(toWarehouse.id))) {
    throw ruleViolation(
      `الصنف «${item.name}» غير مسموح بتخزينه في «${toWarehouse.name}».`,
      { field: "toWarehouseId" },
    );
  }

  const method = methodFor(item, fromWarehouse);
  const preview = previewIssueCost(bucketFor(item.id, fromWarehouse.id), {
    quantity,
    method,
    date: payload?.date ?? TODAY,
  });

  if (preview.shortfall > 0 && !fromWarehouse.allowNegative) {
    throw ruleViolation(
      `المتاح من «${item.name}» في «${fromWarehouse.name}» هو ${preview.available} ${item.unit} فقط.`,
      { field: "quantity" },
    );
  }

  const sequence = all("stockMovements").filter((row) => row.documentType === "stock_transfer").length / 2 + 1;
  const reference = `TRN-2026-${String(Math.ceil(sequence)).padStart(4, "0")}`;
  const date = payload?.date ?? TODAY;

  const out = insert("stockMovements", {
    itemId: item.id, itemCode: item.code, itemName: item.name,
    warehouseId: fromWarehouse.id, warehouseName: fromWarehouse.name,
    type: "transfer_out", typeLabel: MOVEMENT_LABELS.transfer_out,
    date, quantity,
    unitCost: preview.unitCost, totalCost: preview.totalCost, costingMethod: method,
    reference, documentType: "stock_transfer",
    counterWarehouseId: toWarehouse.id,
    counterWarehouseName: toWarehouse.name,
    performedBy: user?.name ?? "—", notes: payload?.notes ?? null,
  });

  const incoming = insert("stockMovements", {
    itemId: item.id, itemCode: item.code, itemName: item.name,
    warehouseId: toWarehouse.id, warehouseName: toWarehouse.name,
    type: "transfer_in", typeLabel: MOVEMENT_LABELS.transfer_in,
    date, quantity,
    /* نفس تكلفة الصادر — التحويل ينقل القيمة ولا يُنشئها. */
    unitCost: preview.unitCost, totalCost: preview.totalCost, costingMethod: method,
    reference, documentType: "stock_transfer",
    counterWarehouseId: fromWarehouse.id,
    counterWarehouseName: fromWarehouse.name,
    performedBy: user?.name ?? "—", notes: payload?.notes ?? null,
  });

  const fromBalance = refreshBalance(item.id, fromWarehouse.id);
  const toBalance = refreshBalance(item.id, toWarehouse.id);

  const posting = postDocument({
    sourceType: SourceType.INVENTORY_TRANSFER,
    sourceId: out.id,
    document: {
      totalCost: preview.totalCost,
      fromWarehouseName: fromWarehouse.name,
      toWarehouseName: toWarehouse.name,
      fromInventoryAccountId: fromWarehouse.inventoryAccountId,
      toInventoryAccountId: toWarehouse.inventoryAccountId,
    },
    date,
    description: `تحويل مخزني ${reference} — ${item.name}: ${fromWarehouse.name} ← ${toWarehouse.name}`,
    reference,
    user,
  });

  audit({
    action: "stock.transfer", actionLabel: "تحويل مخزني",
    module: "المخازن", entity: "stock_movement", entityId: out.id,
    details: `${reference} — ${item.name} — ${quantity} ${item.unit}`, user,
  });

  return {
    reference,
    movements: [out, incoming],
    fromBalance,
    toBalance,
    cost: preview,
    journalEntry: posting.entry,
    /** التحويل على حساب مخزون واحد لا أثر محاسبي له — نُعلنه بدل الصمت. */
    accountingImpact: posting.skipped ? "لا أثر محاسبي: المخزنان على نفس حساب المخزون." : null,
  };
}

/** تسوية مخزنية — بالزيادة أو بالنقص. */
export function createAdjustment(payload, { user } = {}) {
  const { item, warehouse, quantity } = validateMovement(payload);

  const increase = payload?.direction === "in";

  if (!String(payload?.reason ?? "").trim()) {
    throw ruleViolation("التسوية المخزنية تتطلب سببًا — للتدقيق.", { field: "reason" });
  }

  const method = methodFor(item, warehouse);
  let unitCost;
  let totalCost;

  if (increase) {
    unitCost = money.round(payload?.unitCost ?? item.costPrice);
    totalCost = money.multiply(unitCost, quantity);
  } else {
    const preview = previewIssueCost(bucketFor(item.id, warehouse.id), { quantity, method });
    if (preview.shortfall > 0) {
      throw ruleViolation(
        `لا يمكن خصم ${quantity} ${item.unit} والمتاح ${preview.available} فقط.`,
        { field: "quantity" },
      );
    }
    unitCost = preview.unitCost;
    totalCost = preview.totalCost;
  }

  const sequence = all("stockMovements").filter((row) => row.documentType === "stock_adjustment").length + 1;
  const requiresApproval = db.systemPreferences.requireAdjustmentApproval;

  const movement = insert("stockMovements", {
    itemId: item.id, itemCode: item.code, itemName: item.name,
    warehouseId: warehouse.id, warehouseName: warehouse.name,
    type: increase ? "adjustment_in" : "adjustment_out",
    typeLabel: increase ? MOVEMENT_LABELS.adjustment_in : MOVEMENT_LABELS.adjustment_out,
    date: payload?.date ?? TODAY,
    quantity, unitCost, totalCost, costingMethod: method,
    reference: `ADJ-2026-${String(sequence).padStart(4, "0")}`,
    documentType: "stock_adjustment",
    reason: String(payload.reason).trim(),
    costCenterId: payload?.costCenterId ?? null,
    performedBy: user?.name ?? "—",
    /**
     * التسوية المعلَّقة **لا تؤثر على الرصيد ولا تُرحَّل**: التسوية تُنشئ أو
     * تمحو قيمة بقرار بشري، فهي أخطر حركة مخزنية وتستحق اعتمادًا منفصلًا.
     */
    status: requiresApproval ? "pending_approval" : "approved",
    approvedBy: requiresApproval ? null : (user?.name ?? "—"),
    notes: payload?.notes ?? null,
  });

  audit({
    action: "stock.adjust", actionLabel: "تسجيل تسوية مخزنية", severity: "warning",
    module: "المخازن", entity: "stock_movement", entityId: movement.id,
    details: `${movement.reference} — ${item.name} — ${increase ? "+" : "−"}${quantity}`, user,
  });

  if (requiresApproval) {
    return {
      movement,
      balance: null,
      journalEntry: null,
      pendingApproval: true,
      message: "التسوية مسجَّلة وبانتظار الاعتماد. لن تؤثر على الرصيد قبل اعتمادها.",
    };
  }

  return applyAdjustment(movement, { user });
}

/** يعتمد تسوية معلَّقة فيُطبّقها على الرصيد ويُرحّلها. */
export function approveAdjustment(id, { user } = {}) {
  const movement = find("stockMovements", id);
  if (!movement) throw notFound("حركة التسوية غير موجودة.");

  if (movement.documentType !== "stock_adjustment") {
    throw ruleViolation("هذه الحركة ليست تسوية مخزنية.");
  }
  if (movement.status !== "pending_approval") {
    throw ruleViolation(`التسوية في الحالة «${movement.status}» ولا تحتاج اعتمادًا.`);
  }

  const approved = update("stockMovements", id, {
    status: "approved",
    approvedBy: user?.name ?? "—",
    approvedAt: new Date().toISOString(),
  });

  return applyAdjustment(approved, { user });
}

function applyAdjustment(movement, { user }) {
  const item = find("items", movement.itemId);
  const warehouse = find("warehouses", movement.warehouseId);
  const increase = movement.type === "adjustment_in";

  const balance = refreshBalance(item.id, warehouse.id);

  const posting = postDocument({
    sourceType: SourceType.INVENTORY_ADJUSTMENT,
    sourceId: movement.id,
    document: {
      valueChange: increase ? movement.totalCost : money.multiply(movement.totalCost, -1),
      reason: movement.reason,
      costCenterId: movement.costCenterId,
      inventoryAccountId: warehouse.inventoryAccountId ?? item.inventoryAccountId,
    },
    date: movement.date,
    description: `تسوية مخزنية ${movement.reference} — ${item.name}`,
    reference: movement.reference,
    costCenterId: movement.costCenterId,
    user,
  });

  return { movement, balance, journalEntry: posting.entry, pendingApproval: false };
}

/* ==========================================================================
   4) التقييم والتقارير
   ========================================================================== */

export function getValuation(params = {}) {
  const result = valuateInventory(all("items"), all("stockMovements"), {
    warehouses: all("warehouses"),
    asOf: params.asOf,
    defaultMethod: db.systemPreferences.defaultCostingMethod,
  });

  const rows = params.warehouseId
    ? result.rows.filter((row) => String(row.warehouseId) === String(params.warehouseId))
    : result.rows;

  /* التجميع حسب المخزن — للمقارنة مع أرصدة حسابات المخزون. */
  const byWarehouse = new Map();
  for (const row of result.rows) {
    const key = String(row.warehouseId);
    const bucket = byWarehouse.get(key) ?? { warehouseId: row.warehouseId, warehouseName: row.warehouseName, quantity: 0, value: 0, items: 0 };
    bucket.quantity += row.quantity;
    bucket.value = money.add(bucket.value, row.totalValue);
    bucket.items += 1;
    byWarehouse.set(key, bucket);
  }

  return {
    rows,
    byWarehouse: [...byWarehouse.values()].sort((a, b) => money.toMinor(b.value) - money.toMinor(a.value)),
    totals: { ...result.totals, totalValue: money.sumBy(rows, "totalValue") },
    asOf: params.asOf ?? null,
    method: db.systemPreferences.defaultCostingMethod,
  };
}

/**
 * مقارنة طريقتي التقييم على صنف واحد.
 *
 * شاشة تعليمية ومُفيدة عمليًا: تُظهر الفرق الفعلي بين FIFO والمتوسط المرجّح
 * على بيانات المنشأة نفسها، فيكون قرار اختيار الطريقة مبنيًا على رقم.
 */
export function compareCostingMethods({ itemId, warehouseId }) {
  const item = find("items", itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  const bucket = bucketFor(itemId, warehouseId ?? item.defaultWarehouseId);
  const fifo = valuate(bucket, "fifo");
  const weighted = valuate(bucket, "weighted_average");

  return {
    item: { id: item.id, code: item.code, name: item.name, unit: item.unit, costingMethod: item.costingMethod },
    warehouseId: warehouseId ?? item.defaultWarehouseId,
    movementsCount: bucket.length,
    fifo: {
      quantityOnHand: fifo.quantityOnHand,
      totalValue: fifo.totalValue,
      averageCost: fifo.averageCost,
      totalIssuedCost: fifo.totalIssuedCost,
      layers: fifo.layers,
    },
    weightedAverage: {
      quantityOnHand: weighted.quantityOnHand,
      totalValue: weighted.totalValue,
      averageCost: weighted.averageCost,
      totalIssuedCost: weighted.totalIssuedCost,
    },
    difference: {
      closingValue: money.subtract(fifo.totalValue, weighted.totalValue),
      issuedCost: money.subtract(fifo.totalIssuedCost, weighted.totalIssuedCost),
    },
  };
}

/** الأصناف تحت الحد الأدنى — تقرير إعادة الطلب. */
export function lowStockReport() {
  const rows = all("stockBalances")
    .filter((row) => ["low_stock", "out_of_stock"].includes(row.status))
    .map((row) => {
      const item = find("items", row.itemId);
      return {
        ...row,
        reorderQuantity: Math.max(0, (item?.maxLevel ?? row.maxLevel) - row.onHand),
        leadTimeDays: item?.leadTimeDays ?? null,
        lastPurchasePrice: item?.lastPurchasePrice ?? row.averageCost,
        estimatedCost: money.multiply(
          item?.lastPurchasePrice ?? row.averageCost,
          Math.max(0, (item?.maxLevel ?? row.maxLevel) - row.onHand),
        ),
      };
    })
    .sort((a, b) => a.onHand / Math.max(1, a.minLevel) - b.onHand / Math.max(1, b.minLevel));

  return {
    rows,
    totals: {
      items: rows.length,
      outOfStock: rows.filter((row) => row.status === "out_of_stock").length,
      estimatedCost: money.sumBy(rows, "estimatedCost"),
    },
  };
}

export function getExpiryReport(params = {}) {
  const exposure = expiryExposure(all("batches"), {
    asOf: params.asOf ?? TODAY,
    nearExpiryDays: Number(params.days) || db.systemPreferences.nearExpiryWarningDays,
  });

  return {
    ...exposure,
    rows: [...exposure.expired, ...exposure.nearExpiry].sort((a, b) =>
      String(a.expiryDate ?? "").localeCompare(String(b.expiryDate ?? "")),
    ),
  };
}

/** حركة صنف تفصيلية بالرصيد المتحرك — كشف حساب الصنف. */
export function itemMovementHistory({ itemId, warehouseId, dateFrom, dateTo }) {
  const item = find("items", itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  const warehouse = warehouseId ? find("warehouses", warehouseId) : null;
  const method = methodFor(item, warehouse);

  const bucket = warehouseId
    ? bucketFor(itemId, warehouseId)
    : all("stockMovements").filter((row) => String(row.itemId) === String(itemId));

  const result = valuate(bucket, method);

  const rows = result.movements
    .filter((row) => {
      const day = String(row.date).slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    })
    .map((row) => ({
      ...row,
      typeLabel: MOVEMENT_LABELS[row.type] ?? row.type,
      quantityIn: isInbound(row) ? row.quantity : 0,
      quantityOut: isOutbound(row) ? row.quantity : 0,
    }));

  return {
    item: { id: item.id, code: item.code, name: item.name, unit: item.unit },
    warehouse: warehouse ? { id: warehouse.id, name: warehouse.name } : null,
    method,
    rows,
    closing: {
      quantity: result.quantityOnHand,
      value: result.totalValue,
      averageCost: result.averageCost,
    },
    shortfalls: result.shortfalls,
  };
}

/**
 * تنبيهات المخزون — تُغذّي لوحة الإشعارات ولوحة التحكم.
 *
 * نفس المصدر للعرضين: لوحة تُظهر «3 أصناف نافدة» وشاشة تُظهر 5 تعني أن
 * أحدهما يحسب بطريقته. الحقول مُسمّاة بما تتوقعه لوحة الإشعارات بالضبط.
 */
export function getAlerts() {
  const balances = all("stockBalances");
  const exposure = expiryExposure(all("batches"), {
    asOf: TODAY,
    nearExpiryDays: db.systemPreferences.nearExpiryWarningDays,
  });

  const pendingReviews = all("priceReviews").filter((r) => r.status === "pending");

  const stockRow = (row) => ({
    itemId: row.itemId,
    name: row.itemName,
    itemName: row.itemName,
    code: row.itemCode,
    warehouseName: row.warehouseName,
    quantity: row.onHand,
    minimumQuantity: row.minLevel,
    unit: row.unit,
  });

  const batchRow = (row) => ({
    itemId: row.itemId,
    name: row.itemName,
    itemName: row.itemName,
    batchNumber: row.batchNumber,
    warehouseName: row.warehouseName,
    expiryDate: row.expiryDate,
    quantity: row.quantity,
    value: row.value,
  });

  const priceReviewRow = (row) => ({
    id: row.id,
    itemId: row.itemId,
    name: row.itemName,
    itemName: row.itemName,
    code: row.itemCode,
    oldPurchasePrice: row.oldPurchasePrice,
    newPurchasePrice: row.newPurchasePrice,
    changePercent: row.changePercent,
    currentSellingPrice: row.currentSellingPrice,
    receiptReference: row.receiptReference,
  });

  return {
    priceReviews: pendingReviews.map(priceReviewRow),
    outOfStock: balances.filter((row) => row.status === "out_of_stock").map(stockRow),
    lowStock: balances.filter((row) => row.status === "low_stock").map(stockRow),
    expired: exposure.expired.map(batchRow),
    nearExpiry: exposure.nearExpiry.map(batchRow),
    totals: {
      priceReviews: pendingReviews.length,
      outOfStock: balances.filter((row) => row.status === "out_of_stock").length,
      lowStock: balances.filter((row) => row.status === "low_stock").length,
      expired: exposure.expired.length,
      nearExpiry: exposure.nearExpiry.length,
      expiryExposure: exposure.totalExposure,
    },
  };
}

/* ==========================================================================
   5) الجرد الفعلي
   ========================================================================== */

export function getStockCount(id) {
  const count = find("stockCounts", id);
  if (!count) throw notFound("الجرد غير موجود.");

  const lines = where("stockCountLines", (row) => String(row.stockCountId) === String(count.id));

  return {
    ...count,
    lines,
    totals: {
      lines: lines.length,
      withVariance: lines.filter((row) => row.variance !== 0).length,
      varianceQuantity: lines.reduce((total, row) => total + row.variance, 0),
      varianceValue: money.sumBy(lines, "varianceValue"),
    },
  };
}

/** يبدأ جردًا: يُجمّد الأرصدة الدفترية لحظة البدء. */
export function startStockCount(id, { user } = {}) {
  const count = find("stockCounts", id);
  if (!count) throw notFound("الجرد غير موجود.");

  if (count.status !== "scheduled") {
    throw ruleViolation(`الجرد في الحالة «${count.status}» ولا يمكن بدؤه.`);
  }

  const scope = all("stockBalances").filter((row) => row.warehouseId === count.warehouseId);

  /*
   * الرصيد الدفتري يُجمَّد لحظة البدء لا يُقرأ لحظة الإغلاق: أي حركة تحدث
   * أثناء الجرد ستُحسب فرقًا وهميًا لو قُرئ الرصيد في النهاية.
   */
  scope.forEach((row, index) => {
    insert("stockCountLines", {
      stockCountId: count.id,
      itemId: row.itemId,
      itemCode: row.itemCode,
      itemName: row.itemName,
      unit: row.unit,
      bookQuantity: row.onHand,
      countedQuantity: null,
      variance: null,
      unitCost: row.averageCost,
      varianceValue: null,
      reason: null,
      lineNumber: index + 1,
    });
  });

  const next = update("stockCounts", id, {
    status: "counting",
    startedAt: new Date().toISOString(),
    countedBy: user?.name ?? "—",
    itemsCounted: scope.length,
  });

  audit({
    action: "stock.count.start", actionLabel: "بدء جرد فعلي",
    module: "المخازن", entity: "stock_count", entityId: next.id,
    details: `${next.countNumber} — ${scope.length} صنف`, user,
  });

  return getStockCount(id);
}

/**
 * يُغلق الجرد ويُنشئ تسويات الفروق.
 *
 * كل فرق يُنتج حركة تسوية منفصلة بمرجع الجرد، فيكون أثر الجرد على المخزون
 * مُتتبَّعًا صنفًا بصنف لا مبلغًا واحدًا مُجمَّعًا.
 */
export function closeStockCount(id, payload, { user } = {}) {
  const count = find("stockCounts", id);
  if (!count) throw notFound("الجرد غير موجود.");

  if (count.status !== "counting") {
    throw ruleViolation("لا يُغلق إلا جرد جارٍ.");
  }

  const lines = where("stockCountLines", (row) => String(row.stockCountId) === String(count.id));
  const counted = new Map((payload?.lines ?? []).map((row) => [String(row.id), Number(row.countedQuantity)]));

  const uncounted = lines.filter((row) => !counted.has(String(row.id)) && row.countedQuantity === null);
  if (uncounted.length) {
    throw ruleViolation(
      `${uncounted.length} صنف لم يُعدّ بعد. أكمل العدّ أو استبعد الأصناف من الجرد.`,
    );
  }

  const adjustments = [];

  for (const line of lines) {
    const quantity = counted.has(String(line.id)) ? counted.get(String(line.id)) : line.countedQuantity;
    const variance = quantity - line.bookQuantity;

    update("stockCountLines", line.id, {
      countedQuantity: quantity,
      variance,
      varianceValue: money.multiply(line.unitCost, variance),
    });

    if (variance === 0) continue;

    const result = createAdjustment(
      {
        itemId: line.itemId,
        warehouseId: count.warehouseId,
        quantity: Math.abs(variance),
        direction: variance > 0 ? "in" : "out",
        unitCost: line.unitCost,
        reason: `فرق جرد ${count.countNumber}`,
        date: payload?.date ?? TODAY,
      },
      { user },
    );

    adjustments.push(result.movement);
  }

  const next = update("stockCounts", id, {
    status: "completed",
    completedAt: new Date().toISOString(),
    itemsWithVariance: adjustments.length,
    adjustmentReference: adjustments.map((row) => row.reference).join("، ") || null,
  });

  audit({
    action: "stock.count", actionLabel: "إغلاق جرد فعلي", severity: "warning",
    module: "المخازن", entity: "stock_count", entityId: next.id,
    details: `${next.countNumber} — ${adjustments.length} فرق`, user,
  });

  return { count: getStockCount(id), adjustments };
}

/* ==========================================================================
   6) مراجعة وتحديث أسعار البيع (خاص بمدير الحسابات)
   ========================================================================== */

/**
 * قائمة طلبات مراجعة وتحديث أسعار البيع بعد ورود الأصناف بتكاليف شراء جديدة.
 */
export function listPriceReviews(params = {}) {
  const allReviews = all("priceReviews");
  const filtered = allReviews.filter((row) => {
    if (params.status && params.status !== "all" && row.status !== params.status) return false;
    if (params.itemId && String(row.itemId) !== String(params.itemId)) return false;
    if (params.search) {
      const q = String(params.search).toLowerCase();
      const match =
        String(row.itemName || "").toLowerCase().includes(q) ||
        String(row.itemCode || "").toLowerCase().includes(q) ||
        String(row.receiptReference || "").toLowerCase().includes(q) ||
        String(row.category || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // فرز الأحدث أولاً
  filtered.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return (b.id || 0) - (a.id || 0);
  });

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 20);
  const start = (page - 1) * perPage;
  const paged = filtered.slice(start, start + perPage);

  const pendingRows = allReviews.filter((r) => r.status === "pending");
  const approvedRows = allReviews.filter((r) => r.status === "approved");
  const keptRows = allReviews.filter((r) => r.status === "kept_unchanged");

  const avgMargin =
    approvedRows.length > 0
      ? Number(
          (approvedRows.reduce((sum, r) => sum + (r.approvedMarginPct || 0), 0) / approvedRows.length).toFixed(1),
        )
      : 35.0;

  return {
    data: paged,
    meta: {
      total: filtered.length,
      page,
      perPage,
      totalPages: Math.ceil(filtered.length / perPage) || 1,
      pendingCount: pendingRows.length,
      approvedCount: approvedRows.length,
      keptCount: keptRows.length,
      averageMargin: avgMargin,
    },
  };
}

export function getPriceReview(id) {
  const review = find("priceReviews", id);
  if (!review) throw notFound("طلب مراجعة السعر غير موجود.");
  return review;
}

/**
 * اعتماد وتحديث سعر البيع للصنف من مدير الحسابات.
 *
 * المدير يقرر إما:
 * 1) تحديث سعر البيع بقيمة جديدة أو نسبة هامش ربح محددة.
 * 2) تثبيت السعر الحالي دون تغيير وتحمل فارق التكلفة.
 */
export function approvePriceReview(id, payload, { user } = {}) {
  const review = find("priceReviews", id);
  if (!review) throw notFound("طلب مراجعة السعر غير موجود.");

  const item = find("items", review.itemId);
  if (!item) throw notFound("الصنف المرتبط غير موجود.");

  const action = payload?.action ?? "update_price"; // "update_price" | "keep_price"
  let newSellingPrice = item.sellingPrice;

  if (action === "update_price") {
    newSellingPrice = money.round(Number(payload?.newSellingPrice));
    if (!money.isPositive(newSellingPrice)) {
      throw validationError({ newSellingPrice: "سعر البيع الجديد يجب أن يكون قيمة رقمية موجبة." });
    }
  }

  const approvedMarginPct =
    review.newPurchasePrice > 0
      ? Number((((newSellingPrice - review.newPurchasePrice) / review.newPurchasePrice) * 100).toFixed(1))
      : 0;

  // تحديث الصنف الفعلي ليصبح سعر البيع المعتمد متاحاً لفواتير وخدمات المرضى
  update("items", item.id, {
    sellingPrice: newSellingPrice,
    costPrice: review.newPurchasePrice,
  });

  const status = action === "update_price" ? "approved" : "kept_unchanged";
  const notes =
    payload?.decisionNotes?.trim() ||
    (action === "update_price"
      ? `تم تعديل واعتماد سعر البيع إلى ${newSellingPrice} ج.م بهامش ربح ${approvedMarginPct}%`
      : "تم تثبيت سعر البيع الحالي للمريض دون زيادة بقرار مدير الحسابات");

  const updatedReview = update("priceReviews", id, {
    status,
    approvedPrice: newSellingPrice,
    approvedMarginPct,
    decisionNotes: notes,
    decidedBy: user?.name ?? "أحمد منصور (مدير الحسابات)",
    decidedAt: new Date().toISOString(),
  });

  audit({
    action: action === "update_price" ? "pricing.review.approved" : "pricing.review.kept",
    actionLabel: action === "update_price" ? "اعتماد تحديث سعر البيع" : "تثبيت سعر البيع بدون تغيير",
    module: "المخازن",
    entity: "price_review",
    entityId: review.id,
    details: `${item.name} — سعر البيع: ${newSellingPrice} ج.م (هامش ربح ${approvedMarginPct}%)`,
    user,
  });

  return { review: updatedReview, item: find("items", item.id) };
}

/**
 * مراجعة المحاسب لطلب تغير سعر الشراء مع المورد قبل اعتماده من مدير الحسابات.
 */
export function reviewPriceByAccountant(id, payload, { user } = {}) {
  const review = find("priceReviews", id);
  if (!review) throw notFound("طلب مراجعة السعر غير موجود.");

  const supplierReason = payload?.supplierReason?.trim();
  const accountantNotes = payload?.accountantNotes?.trim();

  if (!supplierReason) {
    throw validationError({ supplierReason: "سبب زيادة المورد مطلوب لتوثيق المراجعة المحاسبية." });
  }

  const updatedReview = update("priceReviews", id, {
    status: "reviewed_by_accountant",
    supplierReason,
    accountantNotes: accountantNotes || "تمت المراجعة مع المورد والتأكد من مبررات فرق السعر",
    reviewedBy: user?.name ?? "محمد إبراهيم (المحاسب المسؤول)",
    reviewedAt: new Date().toISOString(),
  });

  audit({
    action: "pricing.review.accountant_verified",
    actionLabel: "مراجعة المحاسب لفارق السعر",
    module: "المخازن",
    entity: "price_review",
    entityId: review.id,
    details: `${review.itemName} — مبرر المورد: ${supplierReason}`,
    user,
  });

  return updatedReview;
}

/* ==========================================================================
   7) دورة طلبات النواقص وتوزيع المخزون بين الفروع (Smart Supply Chain)
   ========================================================================== */

/**
 * قائمة طلبات النواقص والتوريد مع الفلترة والإحصائيات اللحظية.
 */
export function listRequisitions(params = {}) {
  /*
   * اللوحة مقصورة على نطاق المستخدم.
   *
   * أمين مخزن فرع 1 لا شأن له بطلبات فرع 3: رؤيتها تكشف احتياجات أقسام
   * ليست مسؤوليته، وتُغرق لوحته بما لا يملك التصرف فيه أصلًا. أما من بلا
   * نطاق — مدير المخازن وأمين الرئيسي — فيرى الجميع لأن التوزيع عمله.
   */
  const scope = allowedWarehouseIds();

  const allReqs = all("requisitions").filter(
    (row) =>
      scope === null ||
      scope.includes(String(row.branchId)) ||
      scope.includes(String(row.sourceBranchId)),
  );

  const filtered = allReqs.filter((row) => {
    if (params.status && params.status !== "all" && row.status !== params.status) return false;
    if (params.branchId && String(row.branchId) !== String(params.branchId)) return false;
    if (params.urgency && params.urgency !== "all" && row.urgency !== params.urgency) return false;
    if (params.search) {
      const q = String(params.search).toLowerCase();
      const match =
        String(row.code || "").toLowerCase().includes(q) ||
        String(row.itemName || "").toLowerCase().includes(q) ||
        String(row.itemCode || "").toLowerCase().includes(q) ||
        String(row.branchName || "").toLowerCase().includes(q) ||
        String(row.notes || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // فرز الأحدث والأكثر إلحاحاً أولاً
  filtered.sort((a, b) => {
    if (a.status === "pending_review" && b.status !== "pending_review") return -1;
    if (b.status === "pending_review" && a.status !== "pending_review") return 1;
    if (a.urgency === "urgent" && b.urgency !== "urgent") return -1;
    if (b.urgency === "urgent" && a.urgency !== "urgent") return 1;
    return (b.id || 0) - (a.id || 0);
  });

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 20);
  const start = (page - 1) * perPage;
  const paged = filtered.slice(start, start + perPage);

  const pendingCount = allReqs.filter((r) => r.status === "pending_review").length;
  const inTransitCount = allReqs.filter((r) => r.status === "in_transit" || r.status === "under_inspection").length;
  const discrepancyCount = allReqs.filter((r) => r.status === "discrepancy").length;
  const completedCount = allReqs.filter((r) => r.status === "completed").length;

  return {
    data: paged,
    meta: {
      total: filtered.length,
      page,
      perPage,
      totalPages: Math.ceil(filtered.length / perPage) || 1,
      pendingCount,
      inTransitCount,
      discrepancyCount,
      completedCount,
    },
  };
}

export function getRequisition(id) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");
  const availability = checkItemAvailability(req.itemId, req.branchId);
  return { ...req, availability };
}

/**
 * فحص رصيد الصنف عبر كل المخازن (الرئيسي والفروع) لاكتشاف الفائض وتوفير الشراء.
 */
export function checkItemAvailability(itemId, requestingBranchId = null) {
  const item = find("items", itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  const allWh = all("warehouses");
  const balances = all("stockBalances");

  /*
   * «الفائض» يُقاس بحد الصنف نفسه لا برقم ثابت: الفرع لا يُطلب منه التنازل
   * عن كمية تُنزله تحت حده الأدنى، وإلا حلّينا نقص فرع بخلق نقص في آخر.
   * المناقلة مسموحة فقط من الكمية الزائدة عن نقطة إعادة الطلب.
   */
  const reorderPoint = Number(item.reorderPoint ?? item.minLevel ?? DEFAULT_SURPLUS_THRESHOLD);

  /*
   * المخازن المسموح بتخزين الصنف فيها فقط. اقتراح مناقلة من مخزن لا يُخزَّن
   * فيه الصنف يُنتج رصيدًا وهميًا، ويُرفض لاحقًا عند الشحن — فالأفضل ألا
   * يُقترح من أصله.
   */
  const allowedIds = (item.warehouseIds ?? []).map(String);

  const results = allWh.map((wh) => {
    const bal = balances.find(
      (b) => String(b.itemId) === String(itemId) && String(b.warehouseId) === String(wh.id),
    );
    const onHand = bal?.onHand || 0;
    const available = bal?.available || onHand;

    /* الكمية القابلة للمناقلة = المتاح فوق حد الأمان، وليست المتاح كله. */
    const transferableQty = Math.max(0, available - reorderPoint);
    const hasSurplus = transferableQty > 0;

    return {
      warehouseId: wh.id,
      warehouseCode: wh.code,
      warehouseName: wh.name,
      isHub: Boolean(wh.isHub || wh.id === HUB_WAREHOUSE_ID),
      isAllowedForItem: allowedIds.includes(String(wh.id)),
      onHand,
      available,
      reorderPoint,
      transferableQty,
      hasSurplus,
    };
  });

  const hubBalance = results.find((r) => r.isHub) || results[0];
  const surplusBranches = results.filter(
    (r) =>
      !r.isHub &&
      r.hasSurplus &&
      r.isAllowedForItem &&
      (!requestingBranchId || String(r.warehouseId) !== String(requestingBranchId)),
  );

  return {
    itemId: item.id,
    itemName: item.name,
    itemCode: item.code,
    unit: item.unit,
    reorderPoint,
    hubAvailable: hubBalance?.available || 0,
    canFulfillFromHub: (hubBalance?.available || 0) > 0,
    hasSurplusBranches: surplusBranches.length > 0,
    surplusBranches,
    allWarehouses: results,
  };
}

/**
 * إنشاء طلب نواقص جديد من فرع بتوقيت لحظي غير قابل للتعديل.
 */
export function createRequisition(payload, { user } = {}) {
  const errors = {};
  if (!payload?.itemId) errors.itemId = "الصنف مطلوب.";
  if (!payload?.branchId) errors.branchId = "الفرع الطالب مطلوب.";
  if (!(Number(payload?.requestedQty) > 0)) errors.requestedQty = "الكمية المطلوبة يجب أن تكون أكبر من صفر.";
  if (Object.keys(errors).length) throw validationError(errors);

  const item = find("items", payload.itemId);
  if (!item) throw notFound("الصنف غير موجود.");
  const branch = find("warehouses", payload.branchId);
  if (!branch) throw notFound("مخزن الفرع غير موجود.");

  /*
   * الصنف يُطلب لمخزن مسموح بتخزينه فيه فقط — والرفض هنا عند الطلب لا عند
   * الاستلام. قبول الطلب ثم رفضه بعد الشحن يترك كمية خرجت من المصدر ولا
   * يصح دخولها للفرع: عجز مصطنع لا ذنب لأحد فيه.
   */
  if (!(item.warehouseIds ?? []).map(String).includes(String(branch.id))) {
    throw ruleViolation(
      `الصنف «${item.name}» غير مسموح بتخزينه في «${branch.name}» — ` +
        "أضف المخزن إلى مخازن الصنف أولًا قبل طلبه.",
      { field: "itemId" },
    );
  }

  const sequence = all("requisitions").length + 1;
  const now = new Date().toISOString();
  const userName = user?.name || "أمين مخزن الفرع";

  const newReq = insert("requisitions", {
    code: `REQ-2026-${String(sequence).padStart(3, "0")}`,
    branchId: branch.id,
    branchName: branch.name,
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    category: item.category || "أدوية ومستلزمات",
    unit: item.unit,
    requestedQty: Number(payload.requestedQty),
    status: "pending_review",
    urgency: payload?.urgency || "normal",
    fulfillmentSource: null,
    sourceBranchId: null,
    sourceBranchName: null,
    supplierId: null,
    supplierName: null,
    poReference: null,
    dispatchedQty: null,
    dispatchedAt: null,
    dispatchedBy: null,
    driverName: null,
    receivedQty: null,
    discrepancyCount: null,
    discrepancyNotes: null,
    inspectedAt: null,
    inspectedBy: null,
    createdAt: now,
    createdBy: userName,
    notes: payload?.notes?.trim() || "طلب احتياج رصيد للفرع",
    timeline: [
      {
        stage: "created",
        title: "إنشاء طلب النواقص بالفرع",
        timestamp: now,
        user: userName,
        notes: `طلب احتياج ${payload.requestedQty} ${item.unit}`,
        statusLabel: "قيد المراجعة بالرئيسي",
      },
    ],
  });

  audit({
    action: "requisition.created",
    actionLabel: "إنشاء طلب نواقص",
    module: "المخازن",
    entity: "requisition",
    entityId: newReq.id,
    details: `${newReq.code} — ${branch.name} — ${item.name} (${payload.requestedQty} ${item.unit})`,
    user,
  });

  return newReq;
}

/* --------------------------------------------------------------------------
   7.أ.0) حرّاس دورة الحياة

   الحالات التي يُسمح بالشحن منها محدَّدة بالاسم. بدون هذا الحارس يمكن شحن
   طلب مشحون بالفعل فيُخصم الرصيد مرتين من غير أن يلاحظ أحد.
   -------------------------------------------------------------------------- */

/** الحالات التي يصح الشحن منها. */
const DISPATCHABLE_STATUSES = Object.freeze(["pending_review", "supplier_ordered", "hub_received"]);

/** الحالات التي يصح الفحص والاستلام منها. */
const RECEIVABLE_STATUSES = Object.freeze(["in_transit", "under_inspection"]);

/** حالات نهائية لا يُعاد فتحها. */
const TERMINAL_STATUSES = Object.freeze(["completed", "discrepancy", "rejected"]);

function assertDispatchable(req) {
  if (!DISPATCHABLE_STATUSES.includes(req.status)) {
    throw ruleViolation(
      `لا يمكن الشحن والطلب ${req.code} في حالة «${REQUISITION_STATUS_LABELS[req.status] ?? req.status}». ` +
        "الشحن مسموح من: بانتظار المراجعة، أو مطلوب من المورد، أو وصل الرئيسي.",
      { field: "status" },
    );
  }
}

function assertReceivable(req) {
  if (!RECEIVABLE_STATUSES.includes(req.status)) {
    throw ruleViolation(
      `لا يمكن الفحص والاستلام والطلب ${req.code} في حالة «${REQUISITION_STATUS_LABELS[req.status] ?? req.status}». ` +
        "الاستلام مسموح فقط لطلب في الطريق أو قيد الفحص.",
      { field: "status" },
    );
  }
}

function assertNotTerminal(req, action) {
  if (TERMINAL_STATUSES.includes(req.status)) {
    throw ruleViolation(
      `الطلب ${req.code} مُغلق بحالة «${REQUISITION_STATUS_LABELS[req.status] ?? req.status}» — ` +
        `${action} غير مسموح على طلب مغلق.`,
      { field: "status" },
    );
  }
}

/** وصف عربي لكل حالة — تُستخدم في رسائل الأخطاء وفي سطور التدقيق. */
export const REQUISITION_STATUS_LABELS = Object.freeze({
  pending_review: "بانتظار مراجعة المخزن الرئيسي",
  supplier_ordered: "تم إصدار أمر شراء للمورد",
  hub_received: "وصل المخزن الرئيسي — جاري التوجيه",
  in_transit: "في الطريق للفرع",
  under_inspection: "وصل الفرع — قيد الفحص والعد",
  discrepancy: "استلام به عجز أو خلاف رقابي",
  completed: "مكتمل ومطابق 100%",
  rejected: "طلب ملغي أو مرفوض",
});

/** مرجع إذن شحن فريد مشتق من كود الطلب — يربط الحركة بالطلب في أي تقرير. */
function dispatchReference(req) {
  return `DSP-${String(req.code || "").replace(/^REQ-/, "")}`;
}

/* --------------------------------------------------------------------------
   7.أ) محرك الشحن والاستلام المخزني لطلبات النواقص

   قاعدة مُلزِمة: **دورة النواقص لا تُعدّل جدول الأرصدة مباشرة أبدًا.**
   كل تغيّر في الرصيد ينشأ من حركة مخزنية مُسجَّلة (`stockMovements`) ثم
   يُشتق الرصيد منها عبر `refreshBalance` — تمامًا كبقية حركات المخزن.

   الشحن والاستلام مرحلتان منفصلتان يفصل بينهما حساب وسيط
   «مخزون تحت التحويل». السبب: الكمية تخرج من المصدر لحظة الشحن لكنها لا
   تصل رف الفرع إلا بعد الفحص والعد، والفرق بينهما هو العجز الذي يجب أن
   يبقى له أثر رقابي ومحاسبي مستقل.
   -------------------------------------------------------------------------- */

/**
 * يُخرج الكمية من مخزن المصدر إلى «مخزون تحت التحويل» ويُرحّلها محاسبيًا.
 *
 * @returns {{movement: object, cost: object, balance: object, journalEntry: object|null}}
 */
function dispatchRequisitionStock({ req, fromWarehouse, quantity, reference, date, user, notes }) {
  const item = find("items", req.itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  assertWarehouseInScope(fromWarehouse, "الشحن من");

  /* الصنف يُشحن من مخزن مسموح بتخزينه فيه فقط. */
  if (!(item.warehouseIds ?? []).map(String).includes(String(fromWarehouse.id))) {
    throw ruleViolation(
      `الصنف «${item.name}» غير مسموح بتخزينه في «${fromWarehouse.name}» — لا يمكن الشحن منه.`,
      { field: "sourceBranchId" },
    );
  }

  const method = methodFor(item, fromWarehouse);
  const preview = previewIssueCost(bucketFor(item.id, fromWarehouse.id), {
    quantity,
    method,
    date,
  });

  /*
   * الرصيد غير كافٍ → نرفض الشحن بخطأ صريح. إرجاع «تم الشحن» على رصيد غير
   * موجود هو بالضبط ما يُنتج أرصدة سالبة لا يستطيع أحد تفسيرها لاحقًا.
   */
  if (preview.shortfall > 0 && !fromWarehouse.allowNegative) {
    throw ruleViolation(
      `المتاح من «${item.name}» في «${fromWarehouse.name}» هو ${preview.available} ${item.unit} فقط — ` +
        `والمطلوب شحنه ${quantity}. راجع مسار التوفير قبل الشحن.`,
      { field: "dispatchedQty" },
    );
  }

  const movement = insert("stockMovements", {
    itemId: item.id, itemCode: item.code, itemName: item.name,
    warehouseId: fromWarehouse.id, warehouseName: fromWarehouse.name,
    type: "transfer_out", typeLabel: MOVEMENT_LABELS.transfer_out,
    date, quantity,
    unitCost: preview.unitCost, totalCost: preview.totalCost, costingMethod: method,
    reference, documentType: "requisition_dispatch",
    counterWarehouseId: req.branchId,
    counterWarehouseName: req.branchName,
    requisitionId: req.id,
    requisitionCode: req.code,
    performedBy: user?.name ?? "—",
    notes: notes ?? `شحن طلبية نواقص ${req.code} إلى ${req.branchName}`,
  });

  const balance = refreshBalance(item.id, fromWarehouse.id);

  const posting = postDocument({
    sourceType: SourceType.INVENTORY_DISPATCH,
    sourceId: movement.id,
    document: {
      totalCost: preview.totalCost,
      fromWarehouseName: fromWarehouse.name,
      toWarehouseName: req.branchName,
      fromInventoryAccountId: fromWarehouse.inventoryAccountId ?? item.inventoryAccountId,
    },
    date,
    description: `شحن طلبية ${req.code} — ${item.name}: ${fromWarehouse.name} → ${req.branchName}`,
    reference,
    user,
  });

  return { movement, cost: preview, balance, journalEntry: posting.entry };
}

/**
 * يُدخل **المستلم الفعلي فقط** إلى مخزن الفرع، ويُعترف بالعجز خسارةً مستقلة.
 *
 * العجز لا يُحمَّل على مخزون الفرع ولا على عهدة أمين مخزنه — يُصفّى من
 * الحساب الوسيط إلى «عجز وتلف المخزون» ويبقى موثقًا باسم ووقت الفاحص.
 */
function receiveRequisitionStock({ req, dispatchedQty, receivedQty, shortfallQty, unitCost, reference, date, user, notes }) {
  const item = find("items", req.itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  const branch = find("warehouses", req.branchId);
  if (!branch) throw notFound("مخزن الفرع غير موجود.");

  if (!(item.warehouseIds ?? []).map(String).includes(String(branch.id))) {
    throw ruleViolation(
      `الصنف «${item.name}» غير مسموح بتخزينه في «${branch.name}» — أضف المخزن إلى مخازن الصنف أولًا.`,
      { field: "receivedQty" },
    );
  }

  const result = { movement: null, balance: null, receiptEntry: null, lossEntry: null };

  if (receivedQty > 0) {
    const totalCost = money.multiply(unitCost, receivedQty);

    /* التحويل ينقل القيمة ولا يُنشئها — نفس تكلفة وحدة الشحن. */
    result.movement = insert("stockMovements", {
      itemId: item.id, itemCode: item.code, itemName: item.name,
      warehouseId: branch.id, warehouseName: branch.name,
      type: "transfer_in", typeLabel: MOVEMENT_LABELS.transfer_in,
      date, quantity: receivedQty,
      unitCost, totalCost,
      reference, documentType: "requisition_receipt",
      counterWarehouseId: req.sourceBranchId ?? HUB_WAREHOUSE_ID,
      counterWarehouseName: req.sourceBranchName ?? "المخزن الرئيسي (المركزي)",
      requisitionId: req.id,
      requisitionCode: req.code,
      performedBy: user?.name ?? "—",
      notes: notes ?? `استلام طلبية ${req.code} بعد الفحص والعد الفعلي`,
    });

    result.balance = refreshBalance(item.id, branch.id);

    const posting = postDocument({
      sourceType: SourceType.INVENTORY_TRANSIT_RECEIPT,
      sourceId: result.movement.id,
      document: {
        totalCost,
        toWarehouseName: branch.name,
        toInventoryAccountId: branch.inventoryAccountId ?? item.inventoryAccountId,
      },
      date,
      description: `استلام طلبية ${req.code} — ${item.name} بـ ${branch.name} (${receivedQty} ${item.unit})`,
      reference,
      user,
    });
    result.receiptEntry = posting.entry;
  }

  if (shortfallQty > 0) {
    const lossValue = money.multiply(unitCost, shortfallQty);

    const posting = postDocument({
      sourceType: SourceType.INVENTORY_TRANSIT_LOSS,
      sourceId: req.id,
      sourceEvent: "requisition_shortfall",
      document: {
        totalCost: lossValue,
        reference,
        reason: `عجز شحنة ${req.code} بين ${req.sourceBranchName ?? "المخزن الرئيسي"} و${branch.name}`,
      },
      date,
      description:
        `إثبات عجز شحنة ${req.code} — ${item.name}: ` +
        `مشحون ${dispatchedQty} / مستلم ${receivedQty} ${item.unit}`,
      reference,
      user,
    });
    result.lossEntry = posting.entry;
  }

  return result;
}

/**
 * صرف مباشر وتجهيز شحن من المخزن الرئيسي للفرع.
 *
 * الشحن يُخرج الكمية فعليًا من رصيد المخزن الرئيسي إلى «مخزون تحت التحويل»
 * — لا يكتفي بتغيير حالة الطلب. الكمية المشحونة لم تصل الفرع بعد ولا تُضاف
 * لرصيده إلا بعد الفحص والعد.
 */
export function fulfillFromHub(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  assertDispatchable(req);

  const hub = find("warehouses", HUB_WAREHOUSE_ID);
  if (!hub) throw notFound("المخزن الرئيسي غير موجود.");

  const now = new Date().toISOString();
  const date = payload.date ?? TODAY;
  const qty = Number(payload.dispatchedQty ?? req.requestedQty);
  if (!(qty > 0)) throw validationError({ dispatchedQty: "الكمية المشحونة يجب أن تكون أكبر من صفر." });

  const driver = payload.driverName?.trim() || "سائق الحركة والتوصيل";
  const userName = user?.name || "أمين المخزن الرئيسي";
  const reference = dispatchReference(req);

  /* الحركة المخزنية والترحيل أولًا — فإن رفض الرصيد، لا تتغير حالة الطلب. */
  const dispatch = dispatchRequisitionStock({
    req, fromWarehouse: hub, quantity: qty, reference, date, user,
  });

  const timeline = [...(req.timeline || [])];
  timeline.push({
    stage: "dispatched",
    title: "شحن البضاعة وإذن خروج للفرع",
    timestamp: now,
    user: userName,
    notes:
      `تم شحن ${qty} ${req.unit} مع السائق ${driver}. ` +
      `خرجت من رصيد ${hub.name} بإذن ${reference} بتكلفة ${dispatch.cost.totalCost} ج.م ` +
      `وحُجزت في «مخزون تحت التحويل». الختم الزمني مسجل لحظياً لمنع التلاعب`,
    statusLabel: "في الطريق للفرع",
    reference,
    movementId: dispatch.movement.id,
  });

  const updated = update("requisitions", id, {
    status: "in_transit",
    fulfillmentSource: "hub",
    sourceBranchId: hub.id,
    sourceBranchName: hub.name,
    dispatchedQty: qty,
    dispatchedAt: now,
    dispatchedBy: userName,
    driverName: driver,
    dispatchReference: reference,
    dispatchMovementId: dispatch.movement.id,
    dispatchUnitCost: dispatch.cost.unitCost,
    dispatchTotalCost: dispatch.cost.totalCost,
    timeline,
  });

  audit({
    action: "requisition.dispatched_hub",
    actionLabel: "شحن طلبية من الرئيسي للفرع",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — تم الشحن إلى ${req.branchName} (${qty} ${req.unit}) بإذن ${reference}`,
    user,
  });

  return {
    ...updated,
    movement: dispatch.movement,
    cost: dispatch.cost,
    sourceBalance: dispatch.balance,
    journalEntry: dispatch.journalEntry,
  };
}

/**
 * تحويل داخلي ذكي بين الفروع (استغلال الفائض وتوفير الشراء).
 *
 * الكمية تخرج من رصيد الفرع المصدر فعليًا — المناقلة ليست ملاحظة إدارية.
 */
export function fulfillByBranchTransfer(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  assertDispatchable(req);

  const sourceBranchId = payload.sourceBranchId;
  if (!sourceBranchId) throw validationError({ sourceBranchId: "الفرع المصدر مطلوب للمناقلة." });

  const sourceBranch = find("warehouses", sourceBranchId);
  if (!sourceBranch) throw notFound("الفرع المحول منه غير موجود.");

  /* لا يُناقَل فرع إلى نفسه — وهذا ما يستثنيه فحص الفائض أصلًا. */
  if (String(sourceBranch.id) === String(req.branchId)) {
    throw ruleViolation("لا تُناقَل كمية من الفرع الطالب إلى نفسه.", { field: "sourceBranchId" });
  }

  const now = new Date().toISOString();
  const date = payload.date ?? TODAY;
  const qty = Number(payload.dispatchedQty ?? req.requestedQty);
  if (!(qty > 0)) throw validationError({ dispatchedQty: "الكمية المشحونة يجب أن تكون أكبر من صفر." });

  const userName = user?.name || "أمين المخزن الرئيسي";
  const driver = payload.driverName?.trim() || "سيارة التوزيع الداخلي";
  const reference = dispatchReference(req);

  const dispatch = dispatchRequisitionStock({
    req, fromWarehouse: sourceBranch, quantity: qty, reference, date, user,
    notes: `مناقلة داخلية ${req.code}: ${sourceBranch.name} → ${req.branchName}`,
  });

  const timeline = [...(req.timeline || [])];
  timeline.push({
    stage: "branch_transfer",
    title: "تحويل داخلي ذكي من فرع آخر",
    timestamp: now,
    user: userName,
    notes:
      `تم اعتماد المناقلة من ${sourceBranch.name} لوجود فائض، وتوفير الشراء الخارجي. ` +
      `خرجت ${qty} ${req.unit} من رصيده بإذن ${reference} بتكلفة ${dispatch.cost.totalCost} ج.م`,
    statusLabel: "في الطريق بين الفروع",
    reference,
    movementId: dispatch.movement.id,
  });

  const updated = update("requisitions", id, {
    status: "in_transit",
    fulfillmentSource: "branch_transfer",
    sourceBranchId: sourceBranch.id,
    sourceBranchName: sourceBranch.name,
    dispatchedQty: qty,
    dispatchedAt: now,
    dispatchedBy: userName,
    driverName: driver,
    dispatchReference: reference,
    dispatchMovementId: dispatch.movement.id,
    dispatchUnitCost: dispatch.cost.unitCost,
    dispatchTotalCost: dispatch.cost.totalCost,
    timeline,
  });

  audit({
    action: "requisition.transfer_branch",
    actionLabel: "مناقلة داخلية بين الفروع",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — تحويل من ${sourceBranch.name} إلى ${req.branchName} بإذن ${reference}`,
    user,
  });

  return {
    ...updated,
    movement: dispatch.movement,
    cost: dispatch.cost,
    sourceBalance: dispatch.balance,
    journalEntry: dispatch.journalEntry,
  };
}

/**
 * طلب الصنف من المورد الخارجي في حالة العجز العام.
 */
export function orderFromSupplier(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  const supplierId = payload.supplierId || 2;
  const supplier = find("suppliers", supplierId);
  const now = new Date().toISOString();
  const userName = user?.name || "المخزن الرئيسي / المشتريات";
  const poRef = payload.poReference || `PO-2026-${String(Math.floor(100 + Math.random() * 900))}`;

  const timeline = [...(req.timeline || [])];
  timeline.push({
    stage: "supplier_ordered",
    title: "إصدار أمر شراء للمورد",
    timestamp: now,
    user: userName,
    notes: `تم ضم النواقص لطلبية المورد (${supplier?.name || "المورد المعتمد"}) بأمر شراء ${poRef}`,
    statusLabel: "تم الطلب من المورد",
  });

  const updated = update("requisitions", id, {
    status: "supplier_ordered",
    fulfillmentSource: "supplier",
    supplierId: supplier?.id || null,
    supplierName: supplier?.name || "المورد المعتمد",
    poReference: poRef,
    timeline,
  });

  audit({
    action: "requisition.ordered_supplier",
    actionLabel: "طلب نواقص من المورد",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — طلبية توريد ${poRef} للمورد ${supplier?.name}`,
    user,
  });

  return updated;
}

/**
 * فحص واستلام الشحنة في مخزن الفرع (مع كشف وتوثيق العجز والتلف بالثانية).
 *
 * يُدخل **المستلم الفعلي فقط** لرصيد الفرع عبر حركة مخزنية حقيقية، ويُعترف
 * بالعجز خسارةً مستقلة لا تُحمَّل على عهدة أمين مخزن الفرع.
 */
export function branchInspectAndReceive(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  assertReceivable(req);

  const receivedQty = Number(payload.receivedQty);
  if (isNaN(receivedQty) || receivedQty < 0) {
    throw validationError({ receivedQty: "الكمية المستلمة فعلياً مطلوبة ويجب أن تكون صفراً أو أكثر." });
  }

  const dispatchedQty = Number(req.dispatchedQty ?? req.requestedQty);

  /* استلام أكثر من المشحون يعني خطأ عدّ أو كمية من مصدر غير موثق. */
  if (receivedQty > dispatchedQty) {
    throw ruleViolation(
      `المستلم (${receivedQty}) أكبر من المشحون (${dispatchedQty} ${req.unit}). ` +
        "راجع العد أو صحّح كمية الشحن — لا يُقبل إدخال فائض بلا مصدر موثق.",
      { field: "receivedQty" },
    );
  }

  const now = new Date().toISOString();
  const date = payload.date ?? TODAY;
  const userName = user?.name || "أمين مخزن الفرع المستلم";
  const isMatch = receivedQty === dispatchedQty;
  const discrepancyCount = Math.max(0, dispatchedQty - receivedQty);
  const discrepancyNotes =
    payload.notes?.trim() || (isMatch ? null : `عجز بعدد ${discrepancyCount} ${req.unit} لم يتم استلامها`);

  /*
   * تكلفة الوحدة تأتي من إذن الشحن — التحويل ينقل القيمة ولا يُنشئها.
   * الطلبات التي شُحنت قبل تفعيل محرك الحركات لا تحمل تكلفة، فنسقط على
   * آخر سعر شراء للصنف بدلًا من ترحيل قيمة صفرية صامتة.
   */
  const item = find("items", req.itemId);
  const unitCost = money.round(req.dispatchUnitCost ?? item?.lastPurchasePrice ?? item?.costPrice ?? 0);

  const stock = receiveRequisitionStock({
    req, dispatchedQty, receivedQty, shortfallQty: discrepancyCount, unitCost,
    reference: req.dispatchReference ?? dispatchReference(req),
    date, user,
  });

  const discrepancyValue = money.multiply(unitCost, discrepancyCount);
  const timeline = [...(req.timeline || [])];

  if (isMatch) {
    timeline.push({
      stage: "completed",
      title: "✅ فحص مطابق 100% واستلام كامل",
      timestamp: now,
      user: userName,
      notes:
        `تم استلام الكمية بالكامل (${receivedQty} ${req.unit}) بحالة سليمة ` +
        `وإضافتها لرصيد ${req.branchName} بحركة مخزنية مُرحَّلة`,
      statusLabel: "مكتمل ومطابق 100%",
      movementId: stock.movement?.id ?? null,
    });
  } else {
    timeline.push({
      stage: "inspection_discrepancy",
      title: "⚠️ إثبات عجز وخلاف رقابي بالثانية",
      timestamp: now,
      user: userName,
      notes:
        `المشحون: ${dispatchedQty} — المستلم الفعلي: ${receivedQty}. ` +
        `تم تسجيل عجز (${discrepancyCount} ${req.unit}) بقيمة ${discrepancyValue} ج.م ` +
        `واعتُرف به خسارة في «عجز وتلف المخزون» — لم يُحمَّل على عهدة الفرع. ` +
        `ملاحظات: ${discrepancyNotes}`,
      statusLabel: "استلام مع عجز وخلاف رقابي",
      movementId: stock.movement?.id ?? null,
    });
  }

  const updated = update("requisitions", id, {
    status: isMatch ? "completed" : "discrepancy",
    receivedQty,
    discrepancyCount,
    discrepancyNotes,
    discrepancyValue,
    receiptMovementId: stock.movement?.id ?? null,
    inspectedAt: now,
    inspectedBy: userName,
    timeline,
  });

  audit({
    action: isMatch ? "requisition.completed" : "requisition.discrepancy",
    actionLabel: isMatch ? "استلام مطابق بالفرع" : "استلام مع تقرير عجز",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — استلم الفرع ${receivedQty} من ${dispatchedQty} ${req.unit}`,
    user,
  });

  return {
    ...updated,
    movement: stock.movement,
    branchBalance: stock.balance,
    journalEntry: stock.receiptEntry,
    lossEntry: stock.lossEntry,
  };
}

/**
 * وصول طلبية المورد للمخزن الرئيسي — يُغلق الطريق المسدود بعد أمر الشراء.
 *
 * الكمية تدخل مخزون الرئيسي عبر إذن إضافة عادي (`createReceipt`) بكل ما
 * يستتبعه: تقييم، ترحيل، ومراجعة سعر إن تغيّر سعر الشراء. ثم يصبح الطلب
 * جاهزًا للشحن للفرع الطالب.
 */
export function receiveSupplierOrderAtHub(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  if (req.status !== "supplier_ordered") {
    throw ruleViolation(
      `الطلب ${req.code} ليس في حالة «مطلوب من المورد» — لا يصح تسجيل وصول طلبية مورد له.`,
      { field: "status" },
    );
  }

  const qty = Number(payload.receivedQty ?? req.requestedQty);
  if (!(qty > 0)) throw validationError({ receivedQty: "الكمية الواردة من المورد مطلوبة." });

  const now = new Date().toISOString();
  const userName = user?.name || "أمين المخزن الرئيسي";

  /* إذن إضافة حقيقي — نفس المسار الذي يمر منه أي توريد خارجي. */
  const receipt = createReceipt(
    {
      itemId: req.itemId,
      warehouseId: HUB_WAREHOUSE_ID,
      quantity: qty,
      unitCost: payload.unitCost,
      supplierId: req.supplierId,
      batchNumber: payload.batchNumber,
      expiryDate: payload.expiryDate,
      date: payload.date ?? TODAY,
      notes: `توريد مورد لطلبية نواقص ${req.code} — أمر شراء ${req.poReference ?? "—"}`,
    },
    { user },
  );

  const timeline = [...(req.timeline || [])];
  timeline.push({
    stage: "hub_received",
    title: "وصول طلبية المورد للمخزن الرئيسي",
    timestamp: now,
    user: userName,
    notes:
      `وردت ${qty} ${req.unit} من ${req.supplierName ?? "المورد"} بإذن إضافة ` +
      `${receipt.movement.reference}. الطلب جاهز للشحن إلى ${req.branchName}`,
    statusLabel: "وصل المخزن الرئيسي — جاري التوجيه",
    reference: receipt.movement.reference,
    movementId: receipt.movement.id,
  });

  const updated = update("requisitions", id, {
    status: "hub_received",
    hubReceivedQty: qty,
    hubReceivedAt: now,
    hubReceiptReference: receipt.movement.reference,
    hubReceiptMovementId: receipt.movement.id,
    timeline,
  });

  audit({
    action: "requisition.hub_received",
    actionLabel: "وصول طلبية مورد للرئيسي",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — وردت ${qty} ${req.unit} بإذن ${receipt.movement.reference}`,
    user,
  });

  return { ...updated, receipt };
}

/**
 * تسجيل وصول الشحنة لمقر الفرع قبل بدء العد — حالة وسيطة توثيقية.
 *
 * لا أثر مخزني لها: الكمية ما زالت في «مخزون تحت التحويل» حتى يكتمل العد.
 * قيمتها أنها تُثبّت لحظة الوصول باسم من استقبلها، فيُقاس زمن الطريق وزمن
 * العد بشكل مستقل عند أي خلاف.
 */
export function markShipmentArrivedAtBranch(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  if (req.status !== "in_transit") {
    throw ruleViolation(
      `الطلب ${req.code} ليس في الطريق — لا يصح تسجيل وصوله للفرع.`,
      { field: "status" },
    );
  }

  const now = new Date().toISOString();
  const userName = user?.name || "أمين مخزن الفرع";

  const timeline = [...(req.timeline || [])];
  timeline.push({
    stage: "arrived",
    title: "وصول الشحنة لمقر الفرع — بدء الفحص والعد",
    timestamp: now,
    user: userName,
    notes:
      payload.notes?.trim() ||
      `استُلمت الشحنة من ${req.driverName ?? "السائق"} وبدأ العد الفعلي. ` +
        "الكمية ما زالت تحت التحويل حتى يكتمل الفحص",
    statusLabel: "وصل الفرع — قيد الفحص والعد",
  });

  const updated = update("requisitions", id, {
    status: "under_inspection",
    arrivedAt: now,
    arrivedBy: userName,
    timeline,
  });

  audit({
    action: "requisition.arrived",
    actionLabel: "وصول شحنة لمقر الفرع",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — وصلت ${req.branchName} وبدأ العد`,
    user,
  });

  return updated;
}

/**
 * رفض أو إلغاء طلب نواقص قبل الشحن — بسبب إلزامي.
 *
 * الرفض مسموح فقط قبل خروج أي كمية. بعد الشحن لا يُرفض الطلب لأن هناك
 * قيمة فعلية تحت التحويل تحتاج تصفية بالفحص لا بالإلغاء.
 */
export function rejectRequisition(id, payload = {}, { user } = {}) {
  const req = find("requisitions", id);
  if (!req) throw notFound("طلب النواقص غير موجود.");

  assertNotTerminal(req, "الرفض");

  if (req.dispatchedQty) {
    throw ruleViolation(
      `الطلب ${req.code} شُحن بالفعل (${req.dispatchedQty} ${req.unit}) — ` +
        "أغلقه بالفحص والعد لإثبات ما وصل، لا بالرفض.",
      { field: "status" },
    );
  }

  const reason = payload.reason?.trim();
  if (!reason) throw validationError({ reason: "سبب الرفض مطلوب لتوثيق القرار." });

  const now = new Date().toISOString();
  const userName = user?.name || "أمين المخزن الرئيسي";

  const timeline = [...(req.timeline || [])];
  timeline.push({
    stage: "rejected",
    title: "رفض / إلغاء الطلب",
    timestamp: now,
    user: userName,
    notes: `سبب الرفض: ${reason}`,
    statusLabel: "طلب ملغي أو مرفوض",
  });

  const updated = update("requisitions", id, {
    status: "rejected",
    rejectionReason: reason,
    rejectedAt: now,
    rejectedBy: userName,
    timeline,
  });

  audit({
    action: "requisition.rejected",
    actionLabel: "رفض طلب نواقص",
    module: "المخازن",
    entity: "requisition",
    entityId: req.id,
    details: `${req.code} — ${reason}`,
    user,
  });

  return updated;
}

