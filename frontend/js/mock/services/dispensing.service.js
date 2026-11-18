/**
 * خدمة الصرف للمريض — الجسر بين المخزون وحساب المريض.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  المشكلة التي تحلّها هذه الخدمة:
 *
 *  كانت الصيدلية الفرعية تصرف الدواء للغرفة، فتنزل الكمية من رصيد المخزن
 *  وتُعترف تكلفتها مصروفًا... **ولا يُحمَّل قرش على المريض.** المخزون ينقص
 *  والإيراد لا يُسجَّل. هذا أخطر تسريب مالي ممكن في مستشفى.
 *
 *  الحل: الصرف للمريض حدث **مزدوج الأثر، ذرّي**:
 *    1. حركة مخزنية بالتكلفة  → تخرج الكمية ويُعترف بتكلفتها (محرك التقييم)
 *    2. سطر في دفتر استحقاق المريض بسعر البيع المعتمد → يُسجَّل الإيراد
 *
 *  إن فشل أحدهما لا يُنفَّذ الآخر: لا كمية تخرج بلا تحميل، ولا تحميل بلا
 *  كمية خرجت. وهامش الربح يصير مرئيًا لكل صنف منصرف لأن الطرفين مسجَّلان.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { notFound, validationError, ruleViolation } from "../../core/errors.js";
import * as money from "../../core/money.js";
import { db, all, find, insert, update, query } from "../db.js";
import { audit, postDocument } from "./posting.service.js";
import { SourceType } from "../../domain/posting.js";
import { allowedWarehouseIds } from "../../core/permissions.js";
import { createIssue, refreshBalance, assertWarehouseInScope } from "./inventory.service.js";
import { REFERENCE_DATE } from "../seed.js";

const TODAY = REFERENCE_DATE.toISOString().slice(0, 10);

/** جهات الصرف المعروفة — تُستخدم في التصنيف والتقارير. */
export const DISPENSE_TARGETS = Object.freeze({
  patient: "صرف لمريض",
  department: "صرف تشغيل لقسم",
});

/* ==========================================================================
   1) مساعدات
   ========================================================================== */

/**
 * سعر بيع الصنف للمريض.
 *
 * المصدر هو `sellingPrice` المعتمد في دليل الأصناف — وهو الحقل الذي **لا
 * يملك أمين المخزن تعديله**، ولا يتغير إلا باعتماد مدير الحسابات في دورة
 * مراجعة الأسعار. الصرف يقرأ السعر ولا يُقرره.
 */
function sellingPriceFor(item) {
  const price = money.round(item.sellingPrice ?? 0);

  if (!money.isPositive(price)) {
    throw ruleViolation(
      `الصنف «${item.name}» بلا سعر بيع معتمد — لا يمكن تحميله على حساب مريض. ` +
        "اعتمد سعر البيع من شاشة مراجعة وتسعير الأصناف أولًا.",
      { field: "itemId" },
    );
  }

  return price;
}

/** الإقامة القائمة للمريض، أو `null` لمريض العيادات الخارجية. */
function activeAdmissionFor(patientId) {
  return (
    all("admissions").find(
      (a) => a.status === "active" && String(a.patientId) === String(patientId),
    ) ?? null
  );
}

/* ==========================================================================
   2) الصرف للمريض — الحدث المزدوج
   ========================================================================== */

/**
 * يصرف صنفًا من مخزن لمريض، ويُحمِّله على حسابه في نفس اللحظة.
 *
 * @param {object} payload
 * @param {number} payload.patientId   المريض — إلزامي
 * @param {number} payload.itemId      الصنف
 * @param {number} payload.warehouseId المخزن المنصرف منه (الصيدلية الفرعية)
 * @param {number} payload.quantity    الكمية
 * @param {string} [payload.notes]
 * @returns {{movement, charge, cost, balance, journalEntry, patientChargeable}}
 */
export function dispenseItemToPatient(payload, { user } = {}) {
  const errors = {};
  if (!payload?.patientId) errors.patientId = "المريض مطلوب.";
  if (!payload?.itemId) errors.itemId = "الصنف مطلوب.";
  if (!payload?.warehouseId) errors.warehouseId = "المخزن المنصرف منه مطلوب.";
  if (!(Number(payload?.quantity) > 0)) errors.quantity = "الكمية يجب أن تكون أكبر من صفر.";
  if (Object.keys(errors).length) throw validationError(errors);

  const patient = find("patients", payload.patientId);
  if (!patient) throw notFound("المريض غير موجود.");

  const item = find("items", payload.itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  const warehouse = find("warehouses", payload.warehouseId);
  if (!warehouse) throw notFound("المخزن غير موجود.");

  const quantity = Number(payload.quantity);
  const date = payload.date ?? TODAY;
  const admission = activeAdmissionFor(patient.id);

  /*
   * السعر يُقرأ **قبل** إنشاء الحركة. صنف بلا سعر بيع معتمد يُرفض من هنا،
   * فلا تخرج كمية من المخزن ثم يتعذّر تحميلها فتظل بلا إيراد.
   */
  const chargeable = Boolean(item.patientChargeable);
  const unitPrice = chargeable ? sellingPriceFor(item) : 0;

  /* 1) الحركة المخزنية بالتكلفة — عبر إذن الصرف القياسي بكل حرّاسه. */
  const issue = createIssue(
    {
      itemId: item.id,
      warehouseId: warehouse.id,
      quantity,
      date,
      reason: DISPENSE_TARGETS.patient,
      costCenterId: payload.costCenterId ?? null,
      notes:
        payload.notes ??
        `صرف لمريض ${patient.name} (${patient.code})` +
          (admission ? ` — ${admission.roomNumber}` : " — عيادات خارجية"),
    },
    { user },
  );

  /* ربط الحركة بالمريض والغرفة — يجعل التتبع من الحركة للحساب ممكنًا. */
  const movement = update("stockMovements", issue.movement.id, {
    patientId: patient.id,
    patientName: patient.name,
    patientCode: patient.code,
    admissionId: admission?.id ?? null,
    admissionCode: admission?.code ?? null,
    roomId: admission?.roomId ?? null,
    roomNumber: admission?.roomNumber ?? null,
    dispenseTarget: "patient",
  });

  /*
   * 2) التحميل على حساب المريض.
   *
   * الأصناف غير القابلة للتحميل (مكتبية، نظافة، قطع غيار) لا سطر لها —
   * ونُعلن ذلك في المخرجات بدل تجاهله، فتعرف الشاشة أن الصرف تم بلا تحميل
   * ولا تَعِد المستخدم بإيراد لم يُسجَّل.
   */
  let charge = null;

  if (chargeable) {
    const amount = money.multiply(unitPrice, quantity);

    charge = insert("admissionCharges", {
      admissionId: admission?.id ?? null,
      admissionCode: admission?.code ?? null,
      patientId: patient.id,
      patientName: patient.name,
      date,
      category: "medication",
      categoryLabel: "أدوية ومستهلكات مصروفة",
      serviceId: null,
      itemId: item.id,
      itemCode: item.code,
      serviceName: `${item.name}${admission ? ` — ${admission.roomNumber}` : ""}`,
      quantity,
      unitPrice,
      amount,

      /** التكلفة من محرك التقييم — تُحفظ ليكون هامش الربح مرئيًا للبند. */
      unitCost: issue.cost.unitCost,
      totalCost: issue.cost.totalCost,

      source: "pharmacy",
      sourceRef: movement.reference,
      movementId: movement.id,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      invoiceId: null,
      invoicedAt: null,
      createdBy: user?.name ?? "أمين الصيدلية",
      createdAt: new Date().toISOString(),
    });
  }

  audit({
    action: "dispense.patient",
    actionLabel: "صرف أصناف لمريض",
    module: "المخازن",
    entity: "stock_movement",
    entityId: movement.id,
    details:
      `${movement.reference} — ${item.name} × ${quantity} ${item.unit} ` +
      `لـ ${patient.name} (${patient.code})` +
      (chargeable
        ? ` · حُمِّل ${charge.amount} ج.م على حسابه (تكلفة ${issue.cost.totalCost})`
        : " · صنف غير قابل للتحميل على المريض — مصروف تشغيل"),
    user,
  });

  return {
    movement,
    charge,
    patientChargeable: chargeable,
    cost: issue.cost,
    balance: issue.balance,
    journalEntry: issue.journalEntry,
    admission,
  };
}

/**
 * صرف عدة أصناف لمريض واحد في عملية واحدة — شاشة التمريض.
 *
 * الفشل الجزئي معلَن: ما نجح يبقى، وما فشل يُرجَع بسببه. محاولة التراجع عن
 * أصناف خرجت فعلًا من الرف أسوأ من الإعلان عن فشل جزئي.
 */
export function dispenseBasketToPatient(payload, { user } = {}) {
  if (!payload?.patientId) throw validationError({ patientId: "المريض مطلوب." });
  if (!payload?.warehouseId) throw validationError({ warehouseId: "المخزن المنصرف منه مطلوب." });

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (!lines.length) throw validationError({ lines: "أضف صنفًا واحدًا على الأقل للصرف." });

  const dispensed = [];
  const failed = [];
  let totalCharged = 0;
  let totalCost = 0;

  for (const line of lines) {
    try {
      const result = dispenseItemToPatient(
        {
          patientId: payload.patientId,
          warehouseId: payload.warehouseId,
          itemId: line.itemId,
          quantity: line.quantity,
          date: payload.date,
          notes: payload.notes,
          costCenterId: payload.costCenterId,
        },
        { user },
      );

      dispensed.push(result);
      totalCharged = money.add(totalCharged, result.charge?.amount ?? 0);
      totalCost = money.add(totalCost, result.cost.totalCost);
    } catch (error) {
      const item = find("items", line.itemId);
      failed.push({
        itemId: line.itemId,
        itemName: item?.name ?? `صنف #${line.itemId}`,
        quantity: line.quantity,
        reason: error.message,
      });
    }
  }

  return {
    patientId: payload.patientId,
    dispensedCount: dispensed.length,
    failedCount: failed.length,
    totalCharged,
    totalCost,
    margin: money.subtract(totalCharged, totalCost),
    dispensed,
    failed,
  };
}

/* ==========================================================================
   3) الاسترجاع — عكس الصرف بطرفيه
   ========================================================================== */

/**
 * يسترجع كمية من صنف صُرف لمريض: ترجع للرف، وتُرفع عن حسابه.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  الاسترجاع ليس «صرفًا بكمية سالبة».
 *
 *  لو عاملناه كذلك لدخلت الكمية الرفَّ بتكلفة اليوم (أو بمتوسط الرصيد
 *  الحالي)، فيُولِّد مجرد الاسترجاع ربحًا أو خسارة من فراغ. الكمية عائدة
 *  **بعينها**، فترجع بتكلفة حركة صرفها الأصلية المثبَّتة عليها.
 *
 *  والحارس الأهم: **بند فُوتر لا يُسترجع من هنا.** الفاتورة الصادرة لا
 *  تُعدَّل — يُعالَج فرقها بإشعار دائن. ورفض ذلك صراحةً أسلم من تعديل صامت
 *  لمستند صدر للمريض.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @param {object} payload
 * @param {number} payload.chargeId  سطر التحميل المراد استرجاعه
 * @param {number} payload.quantity  الكمية المرتجعة (≤ المصروفة)
 * @param {string} [payload.reason]
 * @returns {{movement, charge, returnedQuantity, refunded, journalEntry}}
 */
export function returnDispensedToPatient(payload, { user } = {}) {
  const errors = {};
  if (!payload?.chargeId) errors.chargeId = "بند الصرف مطلوب.";
  if (!(Number(payload?.quantity) > 0)) errors.quantity = "الكمية المرتجعة يجب أن تكون أكبر من صفر.";
  if (Object.keys(errors).length) throw validationError(errors);

  const charge = find("admissionCharges", payload.chargeId);
  if (!charge) throw notFound("بند الصرف غير موجود.");

  if (charge.source !== "pharmacy") {
    throw ruleViolation("هذا البند ليس صرفًا من مخزن — لا يُسترجع من هنا.", { field: "chargeId" });
  }

  /* فاتورة صادرة لا تُعدَّل — تُعالج بإشعار دائن لا بحذف سطر من دفترها. */
  if (charge.invoiceId) {
    throw ruleViolation(
      `البند «${charge.serviceName}» مُدرج في فاتورة صادرة بالفعل — لا يُسترجع من هنا. ` +
        "أصدر إشعارًا دائنًا للمريض بدلًا من تعديل فاتورة صدرت.",
      { field: "chargeId" },
    );
  }

  const quantity = Number(payload.quantity);
  if (quantity > charge.quantity) {
    throw ruleViolation(
      `المصروف من «${charge.serviceName}» هو ${charge.quantity} فقط، والمطلوب استرجاعه ${quantity}.`,
      { field: "quantity" },
    );
  }

  const item = find("items", charge.itemId);
  if (!item) throw notFound("الصنف غير موجود.");

  const warehouse = find("warehouses", charge.warehouseId);
  if (!warehouse) throw notFound("المخزن غير موجود.");

  /* المستخدم يسترجع إلى مخزنه هو — نفس حارس أي حركة مخزنية. */
  assertWarehouseInScope(warehouse, "استرجاع صرف");

  const date = payload.date ?? TODAY;

  /*
   * التكلفة والسعر من البند الأصلي لا من قيمة اليوم. البند يحمل
   * `unitCost` المحسوبة بمحرك التقييم لحظة الصرف و`unitPrice` المعتمد
   * وقتها — وهما ما يُعكَس بهما تمامًا.
   */
  const returnedCost = money.multiply(charge.unitCost ?? 0, quantity);
  const refunded = money.multiply(charge.unitPrice ?? 0, quantity);

  const sequence = all("stockMovements").filter((row) => row.documentType === "dispense_return").length + 1;
  const reference = `RET-2026-${String(sequence).padStart(4, "0")}`;

  const movement = insert("stockMovements", {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    type: "return_in",
    typeLabel: "مرتجع وارد",
    date,
    quantity,
    unitCost: charge.unitCost ?? 0,
    totalCost: returnedCost,
    costingMethod: charge.costingMethod ?? null,
    reference,
    documentType: "dispense_return",
    reason: payload.reason?.trim() || "استرجاع صرف من مريض",
    patientId: charge.patientId,
    patientName: charge.patientName,
    admissionId: charge.admissionId ?? null,
    admissionCode: charge.admissionCode ?? null,
    relatedChargeId: charge.id,
    relatedMovementId: charge.movementId ?? null,
    performedBy: user?.name ?? "—",
    notes: payload.notes ?? null,
  });

  const balance = refreshBalance(item.id, warehouse.id);

  /*
   * رفع المبلغ عن حساب المريض: استرجاع جزئي يُنقص الكمية والمبلغ، وكامل
   * يحذف السطر. لا نُبقي سطرًا بكمية صفر — دفتر الاستحقاق يُقرأ كما هو في
   * كشف الحساب، وسطر بصفر يربك قارئه.
   */
  let remainingCharge = null;

  if (quantity === charge.quantity) {
    db.admissionCharges = db.admissionCharges.filter((row) => String(row.id) !== String(charge.id));
  } else {
    const remainingQty = charge.quantity - quantity;
    remainingCharge = update("admissionCharges", charge.id, {
      quantity: remainingQty,
      amount: money.multiply(charge.unitPrice ?? 0, remainingQty),
      totalCost: money.multiply(charge.unitCost ?? 0, remainingQty),
    });
  }

  const posting = postDocument({
    sourceType: SourceType.DISPENSE_RETURN,
    sourceId: movement.id,
    document: {
      totalCost: returnedCost,
      warehouseName: warehouse.name,
      patientName: charge.patientName,
      inventoryAccountId: warehouse.inventoryAccountId ?? item.inventoryAccountId,
      expenseAccountId: null,
      costCenterId: null,
    },
    date,
    description: `استرجاع ${reference} — ${item.name} من ${charge.patientName}`,
    reference,
    user,
  });

  audit({
    action: "dispense.return",
    actionLabel: "استرجاع صرف من مريض",
    module: "المخازن",
    entity: "stock_movement",
    entityId: movement.id,
    details:
      `${reference} — ${item.name} × ${quantity} ${item.unit} ` +
      `رجعت إلى ${warehouse.name} بتكلفة ${returnedCost} ج.م، ` +
      `ورُفع ${refunded} ج.م عن حساب ${charge.patientName}`,
    user,
  });

  return {
    movement,
    balance,
    charge: remainingCharge,
    fullyReturned: remainingCharge === null,
    returnedQuantity: quantity,
    returnedCost,
    refunded,
    journalEntry: posting.entry,
  };
}

/** بنود الصرف القابلة للاسترجاع — غير المفوترة وحدها. */
export function listReturnableDispenses(params = {}) {
  const scope = allowedWarehouseIds();

  const rows = all("admissionCharges")
    .filter((c) => c.source === "pharmacy")
    .filter((c) => !c.invoiceId)
    .filter((c) => (scope === null ? true : scope.includes(String(c.warehouseId))))
    .filter((c) => !params.patientId || String(c.patientId) === String(params.patientId))
    .filter((c) => !params.warehouseId || String(c.warehouseId) === String(params.warehouseId))
    .filter((c) => {
      if (!params.search) return true;
      const q = String(params.search).toLowerCase();
      return (
        String(c.serviceName ?? "").toLowerCase().includes(q) ||
        String(c.patientName ?? "").toLowerCase().includes(q) ||
        String(c.itemCode ?? "").toLowerCase().includes(q) ||
        String(c.sourceRef ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 25);
  const start = (page - 1) * perPage;

  return {
    data: rows.slice(start, start + perPage),
    meta: {
      total: rows.length,
      page,
      perPage,
      totalPages: Math.ceil(rows.length / perPage) || 1,
    },
  };
}

/* ==========================================================================
   4) الاستعلام — ما صُرف لمريض وما حُمِّل عليه
   ========================================================================== */

/** سجل ما صُرف لمريض من أصناف، مع التكلفة وسعر التحميل وهامش كل بند. */
export function listPatientDispenses(params = {}) {
  const rows = all("admissionCharges")
    .filter((c) => c.source === "pharmacy")
    .filter((c) => !params.patientId || String(c.patientId) === String(params.patientId))
    .filter((c) => !params.admissionId || String(c.admissionId) === String(params.admissionId))
    .map((c) => ({
      ...c,
      margin: money.subtract(c.amount ?? 0, c.totalCost ?? 0),
      marginPct:
        c.totalCost > 0
          ? Number((((c.amount - c.totalCost) / c.totalCost) * 100).toFixed(1))
          : null,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);

  const page = Number(params.page || 1);
  const perPage = Number(params.perPage || 50);
  const start = (page - 1) * perPage;

  const totalCharged = rows.reduce((sum, r) => money.add(sum, r.amount ?? 0), 0);
  const totalCost = rows.reduce((sum, r) => money.add(sum, r.totalCost ?? 0), 0);

  return {
    data: rows.slice(start, start + perPage),
    meta: {
      total: rows.length,
      page,
      perPage,
      totalPages: Math.ceil(rows.length / perPage) || 1,
      totalCharged,
      totalCost,
      margin: money.subtract(totalCharged, totalCost),
    },
  };
}

/**
 * الأصناف المتاحة للصرف من مخزن — بسعر البيع المعتمد ورصيده المتاح.
 *
 * تُستخدم في شاشة التمريض: الممرضة تختار من المتاح فعلًا، فلا تطلب صنفًا
 * ليس في الصيدلية ثم تُفاجأ برفض.
 */
export function listDispensableItems(params = {}) {
  const warehouseId = params.warehouseId;
  if (!warehouseId) throw validationError({ warehouseId: "المخزن مطلوب." });

  const warehouse = find("warehouses", warehouseId);
  if (!warehouse) throw notFound("المخزن غير موجود.");

  const balances = all("stockBalances").filter(
    (b) => String(b.warehouseId) === String(warehouseId),
  );

  const rows = balances
    .map((balance) => {
      const item = find("items", balance.itemId);
      if (!item) return null;

      return {
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        available: balance.available ?? balance.onHand ?? 0,
        onHand: balance.onHand ?? 0,
        reserved: balance.reserved ?? 0,
        sellingPrice: item.sellingPrice ?? 0,
        patientChargeable: Boolean(item.patientChargeable),
        trackBatches: Boolean(item.trackBatches),
      };
    })
    .filter(Boolean)
    .filter((row) => row.available > 0)
    .filter((row) => (params.chargeableOnly ? row.patientChargeable : true))
    .filter((row) => {
      if (!params.search) return true;
      const q = String(params.search).toLowerCase();
      return (
        row.itemName.toLowerCase().includes(q) ||
        row.itemCode.toLowerCase().includes(q) ||
        String(row.category).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.itemName.localeCompare(b.itemName, "ar"));

  return {
    data: rows,
    meta: { total: rows.length, warehouseId: warehouse.id, warehouseName: warehouse.name },
  };
}
