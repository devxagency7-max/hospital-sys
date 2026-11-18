/**
 * اختبارات صرف الأصناف للمريض — الجسر بين المخزون وحساب المريض.
 *
 *   node tests/dispensing-workflow.test.mjs
 *
 * الضمانة الأهم: **الصرف للمريض مزدوج الأثر.** لا كمية تخرج من الرف بلا
 * تحميل على حساب المريض، ولا تحميل بلا كمية خرجت فعلًا.
 */

import { assert, section, report } from "./harness.mjs";
import {
  dispenseItemToPatient,
  dispenseBasketToPatient,
  listDispensableItems,
  listPatientDispenses,
  returnDispensedToPatient,
  listReturnableDispenses,
} from "../js/mock/services/dispensing.service.js";
import { currentBalance } from "../js/mock/services/inventory.service.js";
import { getAdmissionCostSummary } from "../js/mock/services/rooms.service.js";
import { all, find, update } from "../js/mock/db.js";
import * as money from "../js/core/money.js";

const NURSE = { user: { name: "ممرضة الصيدلية — اختبار" } };
const PHARMACY_WH = 2; // مخزن فرع 1 (الصيدلية المركزية)

/** سطور التحميل من الصيدلية لمريض. */
function pharmacyCharges(patientId) {
  return all("admissionCharges").filter(
    (c) => c.source === "pharmacy" && String(c.patientId) === String(patientId),
  );
}

/* ==========================================================================
   1. قائمة المتاح للصرف
   ========================================================================== */

section("قائمة الأصناف المتاحة للصرف من الصيدلية");

const dispensable = listDispensableItems({ warehouseId: PHARMACY_WH });
assert("القائمة تُرجع أصنافًا", dispensable.data.length > 0);
assert("كل صنف معروض له رصيد متاح أكبر من صفر",
  dispensable.data.every((i) => i.available > 0));
assert("كل صنف يُعلن هل يُحمَّل على المريض أم لا",
  dispensable.data.every((i) => typeof i.patientChargeable === "boolean"));
assert("القائمة تحمل اسم المخزن المنصرف منه", Boolean(dispensable.meta.warehouseName));

const chargeableOnly = listDispensableItems({ warehouseId: PHARMACY_WH, chargeableOnly: true });
assert("فلترة «القابل للتحميل» تستبعد غير القابل",
  chargeableOnly.data.every((i) => i.patientChargeable));
assert("القابل للتحميل أقل من أو يساوي الكل",
  chargeableOnly.data.length <= dispensable.data.length);

/* ==========================================================================
   2. الصرف لمريض مقيم — الأثر المزدوج
   ========================================================================== */

section("صرف لمريض مقيم: المخزون ينقص وحساب المريض يُحمَّل");

const inpatient = all("patients").find((p) => p.status === "inpatient");
assert("يوجد مريض مقيم", Boolean(inpatient));

const admission = all("admissions").find(
  (a) => a.status === "active" && String(a.patientId) === String(inpatient.id),
);
assert("للمريض المقيم إقامة قائمة", Boolean(admission));

const drug = chargeableOnly.data[0];
const stockBefore = currentBalance(drug.itemId, PHARMACY_WH).onHand;
const admissionTotalBefore = getAdmissionCostSummary(admission.id).total;
const chargesBefore = pharmacyCharges(inpatient.id).length;

const dispensed = dispenseItemToPatient(
  { patientId: inpatient.id, itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: 3 },
  NURSE,
);

/* --- الطرف الأول: المخزون --- */
assert("الصرف أنشأ حركة مخزنية", Boolean(dispensed.movement?.id));
assert("نوع الحركة إذن صرف", dispensed.movement.type === "issue");
assert("رصيد الصيدلية نقص بالكمية بالضبط",
  currentBalance(drug.itemId, PHARMACY_WH).onHand === stockBefore - 3);
assert("التكلفة من محرك التقييم لا من سعر البيع",
  dispensed.cost.totalCost > 0 && dispensed.cost.unitCost !== drug.sellingPrice);
assert("الحركة مُرحَّلة محاسبياً", Boolean(dispensed.journalEntry));

/* --- الطرف الثاني: حساب المريض --- */
assert("الصرف أنشأ سطر تحميل على حساب المريض", Boolean(dispensed.charge?.id));
assert("سطر التحميل مربوط بالمريض", String(dispensed.charge.patientId) === String(inpatient.id));
assert("سطر التحميل مربوط بالإقامة القائمة",
  String(dispensed.charge.admissionId) === String(admission.id));
assert("سطر التحميل بسعر البيع المعتمد لا بالتكلفة",
  dispensed.charge.unitPrice === drug.sellingPrice);
assert("مبلغ التحميل = السعر × الكمية",
  dispensed.charge.amount === drug.sellingPrice * 3);
assert("سطر التحميل يحمل التكلفة ليكون الهامش مرئياً",
  dispensed.charge.totalCost === dispensed.cost.totalCost);
assert("سطر التحميل مربوط بالحركة المخزنية",
  String(dispensed.charge.movementId) === String(dispensed.movement.id));
assert("سطر التحميل غير مفوتر بعد", dispensed.charge.invoiceId === null);

/* --- الربط العكسي: الحركة تعرف مريضها --- */
assert("الحركة المخزنية تحمل المريض", String(dispensed.movement.patientId) === String(inpatient.id));
assert("الحركة المخزنية تحمل الغرفة", dispensed.movement.roomNumber === admission.roomNumber);

/* --- الإجمالي --- */
const admissionTotalAfter = getAdmissionCostSummary(admission.id).total;
assert("إجمالي الإقامة زاد بمبلغ التحميل",
  admissionTotalAfter === admissionTotalBefore + dispensed.charge.amount);
assert("عدد سطور الصيدلية زاد بواحد",
  pharmacyCharges(inpatient.id).length === chargesBefore + 1);

/* ==========================================================================
   3. الأصناف غير القابلة للتحميل — صرف بلا فاتورة مريض
   ========================================================================== */

section("الصنف غير القابل للتحميل: يُصرف ولا يُفوتر لمريض");

const nonChargeable = all("items").find((i) => !i.patientChargeable);
assert("يوجد صنف غير قابل للتحميل على المريض", Boolean(nonChargeable));

/* نضمن توفره في المخزن المسموح له. */
const nonChargeWh = (nonChargeable.warehouseIds ?? [])[0];
const beforeNonCharge = currentBalance(nonChargeable.id, nonChargeWh).onHand;
assert("الصنف غير القابل للتحميل له رصيد", beforeNonCharge > 0);

const nonChargeResult = dispenseItemToPatient(
  { patientId: inpatient.id, itemId: nonChargeable.id, warehouseId: nonChargeWh, quantity: 1 },
  NURSE,
);

assert("الصنف غير القابل للتحميل خرج من المخزون فعلاً",
  currentBalance(nonChargeable.id, nonChargeWh).onHand === beforeNonCharge - 1);
assert("لم يُنشأ سطر تحميل له", nonChargeResult.charge === null);
assert("الخدمة تُعلن أنه غير قابل للتحميل بدل الصمت",
  nonChargeResult.patientChargeable === false);

/* ==========================================================================
   4. الصنف بلا سعر بيع معتمد — يُرفض قبل خروج الكمية
   ========================================================================== */

section("الصنف بلا سعر بيع معتمد يُرفض قبل أن تخرج الكمية");

const priceless = chargeableOnly.data[1];
const originalPrice = find("items", priceless.itemId).sellingPrice;
update("items", priceless.itemId, { sellingPrice: 0 });

const beforeRejected = currentBalance(priceless.itemId, PHARMACY_WH).onHand;
let rejected = false;
try {
  dispenseItemToPatient(
    { patientId: inpatient.id, itemId: priceless.itemId, warehouseId: PHARMACY_WH, quantity: 1 },
    NURSE,
  );
} catch {
  rejected = true;
}

assert("الصرف مرفوض لصنف بلا سعر بيع معتمد", rejected);
assert("الكمية لم تخرج من المخزن — الرفض قبل الحركة لا بعدها",
  currentBalance(priceless.itemId, PHARMACY_WH).onHand === beforeRejected);

update("items", priceless.itemId, { sellingPrice: originalPrice });

/* ==========================================================================
   5. الصرف بالسلة — والفشل الجزئي معلَن
   ========================================================================== */

section("صرف سلة أصناف والإعلان الصريح عن الفشل الجزئي");

const basketItems = chargeableOnly.data.slice(0, 2);
const basketResult = dispenseBasketToPatient(
  {
    patientId: inpatient.id,
    warehouseId: PHARMACY_WH,
    lines: basketItems.map((i) => ({ itemId: i.itemId, quantity: 1 })),
  },
  NURSE,
);

assert("السلة صرفت كل أصنافها", basketResult.dispensedCount === basketItems.length);
assert("لا فشل في السلة السليمة", basketResult.failedCount === 0);
assert("إجمالي التحميل محسوب", basketResult.totalCharged > 0);
assert("إجمالي التكلفة محسوب من محرك التقييم", basketResult.totalCost > 0);
/*
 * المقارنة تمر من `money` لا من `-` الخام: الطرح العشري المباشر يُنتج
 * 94.19999999999999 بدل 94.2 — وهو بالضبط سبب وجود وحدة المال.
 */
assert("الهامش = التحميل − التكلفة",
  basketResult.margin === money.subtract(basketResult.totalCharged, basketResult.totalCost));

/* سلة فيها كمية مستحيلة — الفشل الجزئي. */
const partial = dispenseBasketToPatient(
  {
    patientId: inpatient.id,
    warehouseId: PHARMACY_WH,
    lines: [
      { itemId: basketItems[0].itemId, quantity: 1 },
      { itemId: basketItems[1].itemId, quantity: 9_999_999 },
    ],
  },
  NURSE,
);

assert("ما نجح من السلة يبقى", partial.dispensedCount === 1);
assert("ما فشل يُعلَن لا يُخفى", partial.failedCount === 1);
assert("الفشل مصحوب بسببه ومسمّى بصنفه",
  Boolean(partial.failed[0].reason) && Boolean(partial.failed[0].itemName));

let emptyBasket = false;
try {
  dispenseBasketToPatient({ patientId: inpatient.id, warehouseId: PHARMACY_WH, lines: [] }, NURSE);
} catch {
  emptyBasket = true;
}
assert("سلة فاضية مرفوضة", emptyBasket);

/* ==========================================================================
   6. مريض العيادات الخارجية — تحميل بلا إقامة
   ========================================================================== */

section("مريض العيادات الخارجية: تحميل بلا إقامة");

const outpatient = all("patients").find((p) => p.status === "outpatient");
assert("يوجد مريض عيادات خارجية", Boolean(outpatient));

const outResult = dispenseItemToPatient(
  { patientId: outpatient.id, itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: 1 },
  NURSE,
);

assert("الصرف لمريض خارجي نجح", Boolean(outResult.movement?.id));
assert("سطر التحميل أُنشئ بلا إقامة", outResult.charge.admissionId === null);
assert("سطر التحميل مربوط بالمريض نفسه",
  String(outResult.charge.patientId) === String(outpatient.id));
assert("لا إقامة قائمة للمريض الخارجي", outResult.admission === null);

/* ==========================================================================
   7. سجل الصرف وهامش الربح لكل بند
   ========================================================================== */

section("سجل ما صُرف للمريض وهامش كل بند");

const log = listPatientDispenses({ patientId: inpatient.id });
assert("السجل يُرجع سطور الصيدلية", log.data.length > 0);
assert("كل سطر يحمل هامشه", log.data.every((r) => typeof r.margin === "number"));
assert("إجمالي التحميل في الملخص يساوي جمع سطور الصفحة",
  log.meta.total === log.data.length
    ? log.meta.totalCharged === log.data.reduce((sum, r) => money.add(sum, r.amount), 0)
    : log.meta.totalCharged > 0);
assert("الهامش الكلي = التحميل − التكلفة",
  log.meta.margin === money.subtract(log.meta.totalCharged, log.meta.totalCost));
assert("السجل مفلتر بالمريض المطلوب",
  log.data.every((r) => String(r.patientId) === String(inpatient.id)));

/* ==========================================================================
   8. حراسة المدخلات
   ========================================================================== */

section("حراسة المدخلات");

const guards = [
  ["بلا مريض", { itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: 1 }],
  ["بلا صنف", { patientId: inpatient.id, warehouseId: PHARMACY_WH, quantity: 1 }],
  ["بلا مخزن", { patientId: inpatient.id, itemId: drug.itemId, quantity: 1 }],
  ["بكمية صفر", { patientId: inpatient.id, itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: 0 }],
  ["بكمية سالبة", { patientId: inpatient.id, itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: -5 }],
];

for (const [label, payload] of guards) {
  let blocked = false;
  try {
    dispenseItemToPatient(payload, NURSE);
  } catch {
    blocked = true;
  }
  assert(`الصرف ${label} مرفوض`, blocked);
}

/* ==========================================================================
   9. الاسترجاع — عكس الصرف بطرفيه
   ========================================================================== */

section("الاسترجاع: الكمية ترجع للرف والمبلغ يُرفع عن حساب المريض");

/* صرف جديد نسترجعه، حتى لا نعتمد على بند صُرف في فحص سابق. */
const retDispense = dispenseItemToPatient(
  { patientId: inpatient.id, itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: 4 },
  NURSE,
);

const retChargeId = retDispense.charge.id;
const balanceAfterDispense = currentBalance(drug.itemId, PHARMACY_WH).onHand;
const unitCostAtDispense = retDispense.charge.unitCost;
const unitPriceAtDispense = retDispense.charge.unitPrice;

/* --- استرجاع جزئي --- */
const partialReturn = returnDispensedToPatient(
  { chargeId: retChargeId, quantity: 1, reason: "المريض رفض الجرعة" },
  NURSE,
);

assert("الاسترجاع الجزئي أنتج حركة مرتجع وارد", partialReturn.movement?.type === "return_in");
assert("الاسترجاع الجزئي أعاد الكمية للرف",
  currentBalance(drug.itemId, PHARMACY_WH).onHand === balanceAfterDispense + 1);
assert("الاسترجاع الجزئي أبقى البند بكمية ناقصة", partialReturn.charge?.quantity === 3);
assert("الاسترجاع الجزئي ليس استرجاعًا كاملًا", partialReturn.fullyReturned === false);
assert("المبلغ المرفوع = سعر الوحدة × المرتجع",
  money.toMinor(partialReturn.refunded) === money.toMinor(money.multiply(unitPriceAtDispense, 1)));

/*
 * الحارس الأهم: الكمية ترجع **بتكلفة صرفها الأصلية** لا بتكلفة اليوم.
 * لو دخلت بتكلفة مختلفة لولّد مجرد الاسترجاع ربحًا أو خسارة من فراغ.
 */
assert("المرتجع دخل بتكلفة الصرف الأصلية",
  money.toMinor(partialReturn.movement.unitCost) === money.toMinor(unitCostAtDispense));
assert("قيد الاسترجاع متوازن ومُرحَّل", Boolean(partialReturn.journalEntry?.id));

/* --- استرجاع الباقي: البند يُحذف بالكامل --- */
const rest = returnDispensedToPatient({ chargeId: retChargeId, quantity: 3 }, NURSE);

assert("استرجاع الباقي يُعلن أنه كامل", rest.fullyReturned === true);
assert("البند اختفى من دفتر الاستحقاق بعد استرجاعه كاملًا",
  !find("admissionCharges", retChargeId));
assert("الرصيد عاد لما كان عليه قبل الصرف",
  currentBalance(drug.itemId, PHARMACY_WH).onHand === balanceAfterDispense + 4);

/* --- الحرّاس --- */
section("حرّاس الاسترجاع");

const freshDispense = dispenseItemToPatient(
  { patientId: inpatient.id, itemId: drug.itemId, warehouseId: PHARMACY_WH, quantity: 2 },
  NURSE,
);

let overReturn = false;
try {
  returnDispensedToPatient({ chargeId: freshDispense.charge.id, quantity: 5 }, NURSE);
} catch {
  overReturn = true;
}
assert("استرجاع أكثر من المصروف مرفوض", overReturn);

let zeroReturn = false;
try {
  returnDispensedToPatient({ chargeId: freshDispense.charge.id, quantity: 0 }, NURSE);
} catch {
  zeroReturn = true;
}
assert("استرجاع بكمية صفر مرفوض", zeroReturn);

/*
 * فاتورة صادرة لا تُعدَّل: بند دخل فاتورة يُعالَج بإشعار دائن لا بالاسترجاع.
 * نُحاكي الفوترة بوسم البند بـ`invoiceId` كما يفعل `createPatientInvoice`.
 */
update("admissionCharges", freshDispense.charge.id, { invoiceId: 9999 });

let invoicedReturn = false;
try {
  returnDispensedToPatient({ chargeId: freshDispense.charge.id, quantity: 1 }, NURSE);
} catch {
  invoicedReturn = true;
}
assert("استرجاع بند مفوتر مرفوض — يُعالج بإشعار دائن", invoicedReturn);

/* والقائمة لا تعرض أصلًا ما لا يُسترجع. */
const returnable = listReturnableDispenses({ patientId: inpatient.id });
assert("قائمة القابل للاسترجاع تستبعد المفوتر",
  returnable.data.every((row) => !row.invoiceId));
assert("قائمة القابل للاسترجاع لا تعرض البند المفوتر بعينه",
  !returnable.data.some((row) => String(row.id) === String(freshDispense.charge.id)));

report();
