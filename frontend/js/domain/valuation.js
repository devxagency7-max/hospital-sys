/**
 * محرك تقييم المخزون — FIFO والمتوسط المرجّح.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  هذه الوحدة هي المصدر الوحيد لتكلفة أي صنف منصرف. إذن الصرف لا يحسب
 *  تكلفته، وقيد الأستاذ لا يحسبها، وتقرير التقييم لا يحسبها — كلها تقرأ
 *  من هنا.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * السبب: لو حسب إذن الصرف التكلفة بطريقة وحسبها تقرير التقييم بطريقة أخرى،
 * لاختلف «مخزون آخر المدة» في الميزانية عن «قيمة المخزون» في تقرير المخازن،
 * وهما نفس الرقم. وهذا فرق لا يُسوَّى إلا بجرد كامل.
 *
 * دوال خالصة: تأخذ حركات وتُعيد تكاليف وأرصدة. لا DOM ولا شبكة.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  اتفاقية الحركات: كل حركة `{ type, quantity, unitCost?, date }` حيث
 *  `quantity` موجبة دائمًا، و`type` يحدد الاتجاه:
 *
 *    إضافة  (in):  opening | receipt | return_in  | adjustment_in  | transfer_in
 *    صرف    (out): issue   | sale    | return_out | adjustment_out | transfer_out
 *
 *  الاتجاه من النوع لا من إشارة الكمية: كمية سالبة في بيانات مُدخَلة يدويًا
 *  تنقلب بصمت إلى إضافة وتُفسد الرصيد. النوع صريح ولا يُخطئ قارئه.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import * as money from "../core/money.js";
import { ruleViolation } from "../core/errors.js";

/* ==========================================================================
   1) اتجاه الحركة
   ========================================================================== */

export const INBOUND_TYPES = Object.freeze([
  "opening",
  "receipt",
  "purchase",
  "return_in",
  "adjustment_in",
  "transfer_in",
  "production_in",
]);

export const OUTBOUND_TYPES = Object.freeze([
  "issue",
  "sale",
  "consumption",
  "return_out",
  "adjustment_out",
  "transfer_out",
  "damage",
]);

export const MOVEMENT_LABELS = Object.freeze({
  opening: "رصيد افتتاحي",
  receipt: "إذن إضافة",
  purchase: "شراء",
  return_in: "مرتجع وارد",
  adjustment_in: "تسوية بالزيادة",
  transfer_in: "تحويل وارد",
  production_in: "إنتاج تام",
  issue: "إذن صرف",
  sale: "بيع",
  consumption: "استهلاك",
  return_out: "مرتجع صادر",
  adjustment_out: "تسوية بالنقص",
  transfer_out: "تحويل صادر",
  damage: "تلف",
});

export const isInbound = (movement) => INBOUND_TYPES.includes(movement?.type);
export const isOutbound = (movement) => OUTBOUND_TYPES.includes(movement?.type);

/** يرفض نوع حركة غير معروف بدل تجاهله بصمت. */
export function assertKnownMovement(movement) {
  if (!isInbound(movement) && !isOutbound(movement)) {
    throw ruleViolation(
      `نوع حركة مخزنية غير معروف: «${movement?.type}». ` +
        "أضفه إلى INBOUND_TYPES أو OUTBOUND_TYPES في js/domain/valuation.js.",
    );
  }
  return movement;
}

/** يرتّب الحركات زمنيًا — التقييم يعتمد على الترتيب لا على ترتيب الإدخال. */
export function sortMovements(movements = []) {
  return [...movements].sort(
    (a, b) =>
      String(a.date ?? "").localeCompare(String(b.date ?? "")) ||
      Number(a.id ?? 0) - Number(b.id ?? 0),
  );
}

/* ==========================================================================
   2) FIFO — الوارد أولًا صادر أولًا
   ========================================================================== */

/**
 * يُشغّل تقييم FIFO على حركات صنف واحد في مخزن واحد.
 *
 * المنطق: كل إضافة تفتح «طبقة» بكميتها وتكلفتها. كل صرف يستهلك أقدم الطبقات
 * حتى يستوفي كميته، وتكلفته = مجموع ما استهلكه من كل طبقة بتكلفتها الخاصة.
 *
 * الكمية غير المتوفرة (`shortfall`) تُسجَّل ولا تُقدَّر بتكلفة: تقدير تكلفة
 * كمية غير موجودة في الطبقات يُخفي عيبًا في البيانات تحت رقم يبدو سليمًا.
 *
 * @param {object[]} movements حركات صنف واحد
 * @returns {{
 *   layers: object[], movements: object[],
 *   quantityOnHand: number, totalValue: number, averageCost: number,
 *   totalIssuedCost: number, shortfalls: object[]
 * }}
 */
export function runFifo(movements = []) {
  const ordered = sortMovements(movements).map(assertKnownMovement);

  /** الطبقات المفتوحة: `{ quantity, unitCost, date, reference }` */
  const layers = [];
  const trace = [];
  const shortfalls = [];

  let totalIssuedCost = 0;

  for (const movement of ordered) {
    const quantity = Math.abs(Number(movement.quantity) || 0);

    if (isInbound(movement)) {
      const unitCost = money.round(movement.unitCost ?? 0);

      layers.push({
        quantity,
        remaining: quantity,
        unitCost,
        date: movement.date,
        reference: movement.reference ?? movement.id,
      });

      trace.push({
        ...movement,
        direction: "in",
        quantity,
        unitCost,
        totalCost: money.multiply(unitCost, quantity),
        quantityAfter: quantityOf(layers),
        valueAfter: valueOf(layers),
      });

      continue;
    }

    /* --- صرف: استهلاك أقدم الطبقات --- */
    let needed = quantity;
    let cost = 0;
    const consumed = [];

    for (const layer of layers) {
      if (needed <= 0) break;
      if (layer.remaining <= 0) continue;

      const take = Math.min(layer.remaining, needed);
      layer.remaining -= take;
      needed -= take;

      cost = money.add(cost, money.multiply(layer.unitCost, take));
      consumed.push({ quantity: take, unitCost: layer.unitCost, layerDate: layer.date });
    }

    if (needed > 0) {
      shortfalls.push({
        reference: movement.reference ?? movement.id,
        date: movement.date,
        requested: quantity,
        unavailable: needed,
      });
    }

    totalIssuedCost = money.add(totalIssuedCost, cost);

    trace.push({
      ...movement,
      direction: "out",
      quantity,
      /** متوسط تكلفة هذا الصرف تحديدًا — يختلف من صرف لآخر في FIFO. */
      unitCost: quantity - needed > 0 ? money.round(cost / (quantity - needed)) : 0,
      totalCost: cost,
      consumedLayers: consumed,
      shortfall: needed,
      quantityAfter: quantityOf(layers),
      valueAfter: valueOf(layers),
    });
  }

  const quantityOnHand = quantityOf(layers);
  const totalValue = valueOf(layers);

  return {
    method: "fifo",
    layers: layers.filter((layer) => layer.remaining > 0),
    movements: trace,
    quantityOnHand,
    totalValue,
    averageCost: quantityOnHand > 0 ? money.round(totalValue / quantityOnHand) : 0,
    totalIssuedCost,
    shortfalls,
  };
}

function quantityOf(layers) {
  return layers.reduce((total, layer) => total + layer.remaining, 0);
}

function valueOf(layers) {
  return money.sum(layers.map((layer) => money.multiply(layer.unitCost, layer.remaining)));
}

/* ==========================================================================
   3) المتوسط المرجّح المتحرك
   ========================================================================== */

/**
 * يُشغّل تقييم المتوسط المرجّح المتحرك على حركات صنف واحد.
 *
 * المتوسط يُعاد حسابه عند كل **إضافة** فقط:
 *
 *     المتوسط الجديد = (قيمة المخزون + قيمة الإضافة) ÷ (الكمية + كمية الإضافة)
 *
 * والصرف يخرج بالمتوسط السائد لحظة الصرف ولا يُغيّره. إعادة الحساب عند الصرف
 * خطأ شائع يجعل المتوسط يتغيّر بلا سبب اقتصادي ويُنتج قيمة مخزون سالبة عند
 * تصفير الكمية.
 */
export function runWeightedAverage(movements = []) {
  const ordered = sortMovements(movements).map(assertKnownMovement);
  const trace = [];

  let quantity = 0;
  let value = 0;
  let averageCost = 0;
  let totalIssuedCost = 0;
  const shortfalls = [];

  for (const movement of ordered) {
    const moved = Math.abs(Number(movement.quantity) || 0);

    if (isInbound(movement)) {
      const unitCost = money.round(movement.unitCost ?? 0);
      const addedValue = money.multiply(unitCost, moved);

      quantity += moved;
      value = money.add(value, addedValue);
      averageCost = quantity > 0 ? money.round(value / quantity) : 0;

      trace.push({
        ...movement,
        direction: "in",
        quantity: moved,
        unitCost,
        totalCost: addedValue,
        quantityAfter: quantity,
        valueAfter: value,
        averageCostAfter: averageCost,
      });

      continue;
    }

    /* --- صرف بالمتوسط السائد --- */
    const available = Math.min(moved, quantity);
    const shortfall = moved - available;

    if (shortfall > 0) {
      shortfalls.push({
        reference: movement.reference ?? movement.id,
        date: movement.date,
        requested: moved,
        unavailable: shortfall,
      });
    }

    const cost = money.multiply(averageCost, available);

    quantity -= available;
    value = money.subtract(value, cost);

    /*
     * تصفير القيمة عند تصفير الكمية: التقريب المتكرر للمتوسط قد يُبقي قروشًا
     * عالقة بعد خروج آخر وحدة، فتظهر «قيمة مخزون بكمية صفر» في التقرير.
     */
    if (quantity === 0) value = 0;

    averageCost = quantity > 0 ? money.round(value / quantity) : averageCost;
    totalIssuedCost = money.add(totalIssuedCost, cost);

    trace.push({
      ...movement,
      direction: "out",
      quantity: moved,
      unitCost: averageCost,
      totalCost: cost,
      shortfall,
      quantityAfter: quantity,
      valueAfter: value,
      averageCostAfter: averageCost,
    });
  }

  return {
    method: "weighted_average",
    layers: [],
    movements: trace,
    quantityOnHand: quantity,
    totalValue: value,
    averageCost,
    totalIssuedCost,
    shortfalls,
  };
}

/* ==========================================================================
   4) الواجهة الموحَّدة
   ========================================================================== */

/**
 * يُشغّل التقييم بالطريقة المطلوبة.
 * @param {object[]} movements
 * @param {"fifo"|"weighted_average"} method
 */
export function valuate(movements = [], method = "weighted_average") {
  if (method === "fifo") return runFifo(movements);
  if (method === "weighted_average") return runWeightedAverage(movements);

  throw ruleViolation(
    `طريقة تقييم غير مدعومة: «${method}». المدعوم: fifo أو weighted_average.`,
    { field: "costingMethod" },
  );
}

/**
 * تكلفة صرف مُقترَح **قبل تنفيذه** — لعرضها في شاشة إذن الصرف.
 *
 * تُشغّل التقييم على الحركات التاريخية ثم تُضيف الصرف المقترح، فتُعيد تكلفته
 * دون تغيير أي بيانات. هذا ما يجعل الشاشة تُظهر التكلفة الفعلية قبل الحفظ
 * بدل تقدير يُخالف ما سيُرحَّل بعد لحظة.
 *
 * @returns {{ totalCost:number, unitCost:number, available:number, shortfall:number }}
 */
export function previewIssueCost(historyMovements = [], { quantity, method = "weighted_average", date } = {}) {
  const requested = Math.abs(Number(quantity) || 0);

  const result = valuate(
    [
      ...historyMovements,
      { type: "issue", quantity: requested, date: date ?? "9999-12-31", id: Number.MAX_SAFE_INTEGER },
    ],
    method,
  );

  const simulated = result.movements[result.movements.length - 1] ?? {};
  const before = valuate(historyMovements, method);

  return {
    totalCost: money.round(simulated.totalCost ?? 0),
    unitCost: money.round(simulated.unitCost ?? 0),
    available: before.quantityOnHand,
    shortfall: Math.max(0, requested - before.quantityOnHand),
    method,
  };
}

/* ==========================================================================
   5) التقييم على مستوى النظام
   ========================================================================== */

/**
 * يُقيّم كل الأصناف في كل المخازن.
 *
 * التقييم لكل (صنف × مخزن) على حدة لا لكل صنف مُجمَّعًا: المخزنان قد
 * استلما نفس الصنف بتكلفتين مختلفتين، وتجميع حركاتهما قبل التقييم يخلط
 * الطبقتين فيخرج صرف المخزن الأول بتكلفة شحنة المخزن الثاني.
 *
 * @param {object[]} items   الأصناف `{ id, code, name, costingMethod }`
 * @param {object[]} movements كل الحركات `{ itemId, warehouseId, type, quantity, unitCost }`
 * @param {object} options
 * @param {object[]} [options.warehouses]
 * @param {string} [options.asOf]            تقييم حتى تاريخ
 * @param {string} [options.defaultMethod]
 */
export function valuateInventory(items = [], movements = [], options = {}) {
  const { warehouses = [], asOf, defaultMethod = "weighted_average" } = options;

  const warehouseById = new Map(warehouses.map((warehouse) => [String(warehouse.id), warehouse]));

  const scoped = asOf
    ? movements.filter((movement) => String(movement.date).slice(0, 10) <= asOf)
    : movements;

  /** تجميع الحركات في دلاء `itemId|warehouseId`. */
  const buckets = new Map();
  for (const movement of scoped) {
    const key = `${movement.itemId}|${movement.warehouseId ?? "__none__"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(movement);
  }

  const rows = [];

  for (const item of items) {
    const method = item.costingMethod ?? defaultMethod;

    for (const [key, bucket] of buckets) {
      const [itemId, warehouseId] = key.split("|");
      if (String(itemId) !== String(item.id)) continue;

      const result = valuate(bucket, method);
      if (result.quantityOnHand === 0 && money.isZero(result.totalValue)) continue;

      rows.push({
        itemId: item.id,
        code: item.code,
        name: item.name,
        nameEn: item.nameEn ?? null,
        unit: item.unit ?? null,
        category: item.category ?? null,
        warehouseId: warehouseId === "__none__" ? null : warehouseId,
        warehouseName: warehouseById.get(String(warehouseId))?.name ?? "—",
        method,
        quantity: result.quantityOnHand,
        averageCost: result.averageCost,
        totalValue: result.totalValue,
        layers: result.layers.length,
        shortfalls: result.shortfalls.length,
      });
    }
  }

  const totals = {
    itemsCount: new Set(rows.map((row) => String(row.itemId))).size,
    linesCount: rows.length,
    totalQuantity: rows.reduce((total, row) => total + row.quantity, 0),
    totalValue: money.sumBy(rows, "totalValue"),
    /** عدد الحركات التي صرفت كمية غير متوفرة — عيب بيانات يستحق الظهور. */
    shortfalls: rows.reduce((total, row) => total + row.shortfalls, 0),
  };

  return {
    rows: rows.sort((a, b) => money.toMinor(b.totalValue) - money.toMinor(a.totalValue)),
    totals,
    asOf: asOf ?? null,
  };
}

/**
 * رصيد صنف في مخزن — الكمية المتاحة والمحجوزة.
 *
 * `available = onHand − reserved`. الكمية المحجوزة ليست منصرفة بعد (أمر بيع
 * مؤكَّد أو طلب صرف معتمد)، فهي داخل المخزون محاسبيًا وخارجه عمليًا. خلط
 * الرقمين يسمح ببيع كمية محجوزة مرتين.
 */
export function stockBalance(movements = [], { reserved = 0, method = "weighted_average" } = {}) {
  const result = valuate(movements, method);
  const onHand = result.quantityOnHand;

  return {
    onHand,
    reserved,
    available: Math.max(0, onHand - reserved),
    averageCost: result.averageCost,
    totalValue: result.totalValue,
  };
}

/**
 * يشتق حالة الصنف من رصيده وحدوده.
 *
 * مُشتقّة لا مخزَّنة: حالة مخزَّنة تتناقض مع الكمية بعد أول حركة لا تُحدّثها.
 */
export function deriveStockStatus({ onHand = 0, minLevel = 0, maxLevel = 0, reorderPoint = 0 } = {}) {
  if (onHand <= 0) return "out_of_stock";
  if (minLevel > 0 && onHand <= minLevel) return "low_stock";
  if (reorderPoint > 0 && onHand <= reorderPoint) return "low_stock";
  if (maxLevel > 0 && onHand > maxLevel) return "over_stock";
  return "available";
}

/* ==========================================================================
   6) الصلاحية والتشغيلات
   ========================================================================== */

/**
 * يشتق حالة تشغيلة من تاريخ صلاحيتها.
 * @param {object} batch `{ expiryDate, quantity }`
 * @param {Date|string} [asOf]
 * @param {number} [nearExpiryDays=90]
 */
export function deriveBatchStatus(batch, asOf = new Date(), nearExpiryDays = 90) {
  if (!batch?.expiryDate) return "available";

  const reference = String(asOf instanceof Date ? asOf.toISOString() : asOf).slice(0, 10);
  const expiry = String(batch.expiryDate).slice(0, 10);

  if (expiry < reference) return "expired";

  const threshold = new Date(`${reference}T00:00:00Z`);
  threshold.setUTCDate(threshold.getUTCDate() + nearExpiryDays);

  return expiry <= threshold.toISOString().slice(0, 10) ? "near_expiry" : "available";
}

/**
 * قيمة المخزون المعرَّض للتلف: المنتهي والقارب على الانتهاء.
 * رقم يستحق الظهور في لوحة التحكم — خسارة محتملة لم تُسجَّل بعد.
 */
export function expiryExposure(batches = [], { asOf = new Date(), nearExpiryDays = 90 } = {}) {
  const expired = [];
  const nearExpiry = [];

  for (const batch of batches) {
    const status = deriveBatchStatus(batch, asOf, nearExpiryDays);
    const value = money.multiply(batch.unitCost ?? 0, batch.quantity ?? 0);
    const record = { ...batch, status, value };

    if (status === "expired") expired.push(record);
    else if (status === "near_expiry") nearExpiry.push(record);
  }

  return {
    expired,
    nearExpiry,
    expiredValue: money.sumBy(expired, "value"),
    nearExpiryValue: money.sumBy(nearExpiry, "value"),
    totalExposure: money.add(money.sumBy(expired, "value"), money.sumBy(nearExpiry, "value")),
  };
}
