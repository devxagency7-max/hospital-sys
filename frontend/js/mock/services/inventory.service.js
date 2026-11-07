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
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

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
function refreshBalance(itemId, warehouseId) {
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

  const unitCost = money.round(payload?.unitCost ?? item.lastPurchasePrice ?? item.costPrice);
  if (!money.isPositive(unitCost)) {
    throw validationError({ unitCost: "تكلفة الوحدة مطلوبة في إذن الإضافة." });
  }

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

  return { movement, balance, journalEntry: posting.entry };
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
