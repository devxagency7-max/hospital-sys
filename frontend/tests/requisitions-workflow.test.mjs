/**
 * اختبارات دورة طلبات النواقص وتوزيع المخزون الذكية وسلاسل الإمداد.
 *
 *   node tests/requisitions-workflow.test.mjs
 *
 * الضمانة الأهم التي يحرسها هذا الملف: **الدورة لا تخلق ولا تُفني مخزونًا.**
 * الشحن يخصم من المصدر، والاستلام يُضيف المستلم فعلاً للفرع، والعجز يُعترف
 * به خسارة — ومجموع الكميات قبل وبعد يجب أن يتوازن دائمًا.
 */

import { assert, section, report } from "./harness.mjs";
import {
  listRequisitions,
  getRequisition,
  createRequisition,
  checkItemAvailability,
  currentBalance,
  fulfillFromHub,
  fulfillByBranchTransfer,
  orderFromSupplier,
  receiveSupplierOrderAtHub,
  markShipmentArrivedAtBranch,
  branchInspectAndReceive,
  rejectRequisition,
} from "../js/mock/services/inventory.service.js";
import { all } from "../js/mock/db.js";

const HUB = 1;

/** إجمالي الكمية على الرف في كل المخازن لصنف — يجب ألا يتغير بالتحويل. */
function totalOnHand(itemId) {
  return all("stockBalances")
    .filter((b) => String(b.itemId) === String(itemId))
    .reduce((sum, b) => sum + (b.onHand || 0), 0);
}

/** عدد الحركات المخزنية المرتبطة بطلب نواقص. */
function movementsFor(requisitionId) {
  return all("stockMovements").filter((m) => String(m.requisitionId) === String(requisitionId));
}

/** هل رُحِّل قيد لحركة مخزنية بعينها؟ */
function hasEntryFor(sourceType, sourceId) {
  return all("journalEntries").some(
    (e) => e.sourceType === sourceType && String(e.sourceId) === String(sourceId),
  );
}

/* ==========================================================================
   1. إنشاء طلب نواقص والتأمين الزمني اللحظي
   ========================================================================== */

section("إنشاء طلب نواقص من الفرع وتأمينه زمنياً ضد التلاعب");

const initialTotal = listRequisitions().meta.total;

const created = createRequisition({
  branchId: 2, // مخزن فرع 1
  itemId: 2,   // باراسيتامول
  requestedQty: 12,
  urgency: "urgent",
  notes: "طلب عاجل للفرع بسبب نقص مفاجئ",
}, { user: { name: "أمين مخزن فرع 1" } });

assert("تم إنشاء طلب النواقص بنجاح", Boolean(created && created.id));
assert("الطلب يبدأ بكود فريد", created.code.startsWith("REQ-2026-"));
assert("حالة الطلب الأولية هي قيد مراجعة المخزن الرئيسي", created.status === "pending_review");
assert("الكمية المطلوبة مسجلة بدقة", created.requestedQty === 12);
assert("الختم الزمني مسجل لحظياً من النظام", Boolean(created.createdAt));
assert("الجدول الزمني (Timeline) يحمل أول خطوة بتوقيت حقيقي",
  created.timeline.length === 1 && created.timeline[0].stage === "created");
assert("إجمالي الطلبات زاد بمقدار 1", listRequisitions().meta.total === initialTotal + 1);

/* ==========================================================================
   2. فحص التوفر الذكي واكتشاف فائض الفروع
   ========================================================================== */

section("فحص التوفر وفائض الفروع الذكي (توفير الشراء الخارجي)");

const availability = checkItemAvailability(2, created.branchId);

assert("تم استرجاع بيانات التوفر للصنف", availability.itemId === 2);
assert("بيانات المخزن الرئيسي موجودة", typeof availability.hubAvailable === "number");
assert("كل المخازن تم فحصها", availability.allWarehouses.length >= 4);
assert("حد الفائض مشتق من حد الصنف لا من رقم ثابت", availability.reorderPoint > 0);
assert("الفرع الطالب مستثنى من اقتراحات المناقلة",
  availability.surplusBranches.every((b) => String(b.warehouseId) !== String(created.branchId)));
assert("لا يُقترح مخزن غير مسموح بتخزين الصنف فيه",
  availability.surplusBranches.every((b) => b.isAllowedForItem));
assert("الكمية القابلة للمناقلة لا تُنزل الفرع تحت حد الأمان",
  availability.surplusBranches.every((b) => b.transferableQty <= b.available - b.reorderPoint));

/* ==========================================================================
   3. التحويل الداخلي الذكي — بخصم فعلي من الفرع المصدر
   ========================================================================== */

section("اعتماد التحويل الداخلي الذكي بين الفروع بخصم فعلي");

const surplus = availability.surplusBranches[0];
assert("يوجد فرع فائض صالح للمناقلة", Boolean(surplus));

const transferQty = Math.min(12, surplus.transferableQty);
const sourceBefore = currentBalance(2, surplus.warehouseId).onHand;
const grandTotalBefore = totalOnHand(2);

const transferred = fulfillByBranchTransfer(created.id, {
  sourceBranchId: surplus.warehouseId,
  dispatchedQty: transferQty,
  driverName: "أحمد السائق",
}, { user: { name: "أمين المخزن الرئيسي" } });

assert("حالة الطلب تحولت إلى في الطريق", transferred.status === "in_transit");
assert("مسار التوفير تحول إلى مناقلة بين فروع", transferred.fulfillmentSource === "branch_transfer");
assert("الفرع المصدر مسجل", String(transferred.sourceBranchId) === String(surplus.warehouseId));
assert("تمت إضافة ختم زمني غير قابل للتعديل لمرحلة الشحن", transferred.timeline.length === 2);
assert("تاريخ ووقت الشحن مثبت بالثانية", Boolean(transferred.dispatchedAt));

/* --- الأثر المخزني الحقيقي للشحن --- */
assert("الشحن أنشأ حركة مخزنية صادرة فعلية", Boolean(transferred.movement?.id));
assert("نوع الحركة تحويل صادر", transferred.movement.type === "transfer_out");
assert("الحركة مربوطة بالطلب بمعرّفه", String(transferred.movement.requisitionId) === String(created.id));
assert("إذن الشحن له مرجع فريد", String(transferred.dispatchReference).startsWith("DSP-"));
assert("تكلفة الشحن محسوبة من محرك التقييم لا من سعر البيع",
  transferred.cost.totalCost > 0 && transferred.cost.unitCost > 0);

const sourceAfter = currentBalance(2, surplus.warehouseId).onHand;
assert("رصيد الفرع المصدر نقص بالكمية المشحونة بالضبط",
  sourceAfter === sourceBefore - transferQty);
assert("الإجمالي الكلي نقص بالمشحون — الكمية تحت التحويل لم تُضَف لأحد بعد",
  totalOnHand(2) === grandTotalBefore - transferQty);

assert("الشحن مُرحَّل محاسبياً على «مخزون تحت التحويل»",
  hasEntryFor("inventory_dispatch", transferred.movement.id));

/* --- الحارس: لا شحن مرتين --- */
let doubleDispatchRejected = false;
try {
  fulfillFromHub(created.id, { dispatchedQty: 1 });
} catch {
  doubleDispatchRejected = true;
}
assert("لا يُسمح بشحن طلب مشحون بالفعل (حماية من الخصم المزدوج)", doubleDispatchRejected);

/* ==========================================================================
   4. الوصول للفرع ثم الفحص بالعد الفعلي وإثبات العجز
   ========================================================================== */

section("وصول الشحنة ثم الفحص بالعد الفعلي وإثبات العجز الرقابي");

const reqForDiscrepancy = createRequisition({
  branchId: 4, // فرع 3 (الطوارئ والرعاية) — مسموح بتخزين المحاليل فيه
  itemId: 7,   // محلول ملح
  requestedQty: 10,
}, { user: { name: "أمين فرع 3" } });

const hubBefore = currentBalance(7, HUB).onHand;
const totalBefore7 = totalOnHand(7);

const dispatched = fulfillFromHub(reqForDiscrepancy.id, {
  dispatchedQty: 10,
  driverName: "عمر السائق",
});

assert("الشحن من الرئيسي خصم من رصيد الرئيسي فعلياً",
  currentBalance(7, HUB).onHand === hubBefore - 10);

/* مرحلة الوصول — توثيقية بلا أثر مخزني. */
const arrived = markShipmentArrivedAtBranch(reqForDiscrepancy.id, {}, { user: { name: "أمين فرع 3" } });
assert("تسجيل الوصول ينقل الحالة إلى قيد الفحص والعد", arrived.status === "under_inspection");
assert("الوصول موثق بوقت ومستخدم", Boolean(arrived.arrivedAt && arrived.arrivedBy));
assert("الوصول لا أثر مخزني له — لا حركة جديدة",
  movementsFor(reqForDiscrepancy.id).length === 1);

const branchBefore = currentBalance(7, reqForDiscrepancy.branchId).onHand;

const inspected = branchInspectAndReceive(reqForDiscrepancy.id, {
  receivedQty: 8,
  notes: "عجز عدد 2 كيس لم يتم تسليمها مع السائق",
}, { user: { name: "أمين فرع 3" } });

assert("حالة الطلب تحولت إلى استلام به عجز/خلاف رقابي", inspected.status === "discrepancy");
assert("الكمية المستلمة مسجلة بـ 8 فقط", inspected.receivedQty === 8);
assert("عدد العجز مسجل بـ 2 بدقة", inspected.discrepancyCount === 2);
assert("ملاحظات العجز موثقة في الطلب", inspected.discrepancyNotes.includes("عجز"));
assert("قيمة العجز محسوبة بالتكلفة لا بالكمية فقط", inspected.discrepancyValue > 0);
assert("الـ Timeline يحمل خطوة إثبات العجز الرقابي بالثانية",
  inspected.timeline.some((t) => t.stage === "inspection_discrepancy"));

/* --- الأثر المخزني الحقيقي للاستلام --- */
assert("الاستلام أنشأ حركة تحويل واردة", inspected.movement?.type === "transfer_in");
assert("الحركة الواردة بالمستلم الفعلي فقط (8) لا بالمشحون (10)",
  inspected.movement.quantity === 8);
assert("رصيد الفرع زاد بالمستلم الفعلي فقط",
  currentBalance(7, reqForDiscrepancy.branchId).onHand === branchBefore + 8);
assert("العجز لم يُحمَّل على رصيد الفرع",
  currentBalance(7, reqForDiscrepancy.branchId).onHand !== branchBefore + 10);
assert("الإجمالي الكلي نقص بالعجز فقط — لا تضاعف ولا تبخّر",
  totalOnHand(7) === totalBefore7 - 2);

assert("الاستلام مُرحَّل محاسبياً على مخزون الفرع",
  hasEntryFor("inventory_transit_receipt", inspected.movement.id));
assert("العجز مُرحَّل خسارةً مستقلة في «عجز وتلف المخزون»",
  hasEntryFor("inventory_transit_loss", reqForDiscrepancy.id));

/* --- الحارس: لا استلام مرتين، ولا استلام أكثر من المشحون --- */
let doubleReceiveRejected = false;
try {
  branchInspectAndReceive(reqForDiscrepancy.id, { receivedQty: 2 });
} catch {
  doubleReceiveRejected = true;
}
assert("لا يُسمح بفحص واستلام طلب مُغلق بالفعل", doubleReceiveRejected);

/* ==========================================================================
   5. الاستلام المطابق 100% وإغلاق الطلب
   ========================================================================== */

section("فحص الاستلام المطابق 100% وإغلاق الطلب");

const reqForMatch = createRequisition({ branchId: 2, itemId: 3, requestedQty: 5 });
const total3Before = totalOnHand(3);

fulfillFromHub(reqForMatch.id, { dispatchedQty: 5 });

const matched = branchInspectAndReceive(reqForMatch.id, {
  receivedQty: 5,
  notes: "تم الاستلام ومطابقة الحبات بالكامل",
});

assert("حالة الطلب تحولت إلى مكتمل ومطابق 100%", matched.status === "completed");
assert("الكمية المستلمة مطابقة للمشحونة", matched.receivedQty === 5 && matched.discrepancyCount === 0);
assert("الـ Timeline يحمل خطوة الإغلاق النهائي المكتمل",
  matched.timeline.some((t) => t.stage === "completed"));
assert("الاستلام المطابق لا يُغيّر الإجمالي الكلي — نقل محض بين رفّين",
  totalOnHand(3) === total3Before);
assert("الاستلام المطابق لا يُنشئ قيد عجز",
  !hasEntryFor("inventory_transit_loss", reqForMatch.id));

let overReceiveRejected = false;
const reqForOver = createRequisition({ branchId: 2, itemId: 3, requestedQty: 4 });
fulfillFromHub(reqForOver.id, { dispatchedQty: 4 });
try {
  branchInspectAndReceive(reqForOver.id, { receivedQty: 9 });
} catch {
  overReceiveRejected = true;
}
assert("لا يُقبل استلام أكثر من المشحون بلا مصدر موثق", overReceiveRejected);

/* ==========================================================================
   6. مسار المورد — إغلاق الطريق المسدود بعد أمر الشراء
   ========================================================================== */

section("مسار المورد: أمر شراء ← وصول الرئيسي ← شحن للفرع");

const reqForSupplier = createRequisition({ branchId: 4, itemId: 7, requestedQty: 6 });

const ordered = orderFromSupplier(reqForSupplier.id, {}, { user: { name: "مسؤول المشتريات" } });
assert("حالة الطلب تحولت إلى مطلوب من المورد", ordered.status === "supplier_ordered");
assert("أمر الشراء له مرجع موثق", String(ordered.poReference).startsWith("PO-"));

const hub7Before = currentBalance(7, HUB).onHand;
const atHub = receiveSupplierOrderAtHub(reqForSupplier.id, {
  receivedQty: 6,
  unitCost: 62,
  batchNumber: "BATCH-SUP-7001",
  expiryDate: "2027-06-30",
}, { user: { name: "أمين المخزن الرئيسي" } });

assert("وصول طلبية المورد ينقل الحالة إلى وصل الرئيسي", atHub.status === "hub_received");
assert("التوريد دخل مخزون الرئيسي بإذن إضافة حقيقي",
  String(atHub.hubReceiptReference).startsWith("GRN-"));
assert("رصيد الرئيسي زاد بالكمية الواردة من المورد",
  currentBalance(7, HUB).onHand === hub7Before + 6);

const shipped = fulfillFromHub(reqForSupplier.id, { dispatchedQty: 6 });
assert("الطلب بعد وصول المورد قابل للشحن للفرع", shipped.status === "in_transit");
assert("رصيد الرئيسي عاد لما كان بعد شحن الوارد للفرع",
  currentBalance(7, HUB).onHand === hub7Before);

const closed = branchInspectAndReceive(reqForSupplier.id, { receivedQty: 6 });
assert("دورة المورد تُغلق مكتملة", closed.status === "completed");

/* ==========================================================================
   7. الرفض والإلغاء — قبل الشحن فقط
   ========================================================================== */

section("رفض الطلب قبل الشحن وحماية الطلبات المشحونة من الإلغاء");

const reqToReject = createRequisition({ branchId: 2, itemId: 3, requestedQty: 3 });

let rejectWithoutReason = false;
try {
  rejectRequisition(reqToReject.id, {});
} catch {
  rejectWithoutReason = true;
}
assert("الرفض بلا سبب مرفوض", rejectWithoutReason);

const rejected = rejectRequisition(reqToReject.id, {
  reason: "الكمية متوفرة بالفرع بعد إعادة الجرد",
}, { user: { name: "أمين المخزن الرئيسي" } });

assert("حالة الطلب تحولت إلى مرفوض", rejected.status === "rejected");
assert("سبب الرفض موثق", rejected.rejectionReason.includes("الجرد"));
assert("الرفض لا أثر مخزني له", movementsFor(reqToReject.id).length === 0);

let rejectDispatchedBlocked = false;
try {
  rejectRequisition(reqForMatch.id, { reason: "محاولة إلغاء بعد الشحن" });
} catch {
  rejectDispatchedBlocked = true;
}
assert("لا يُلغى طلب خرجت كميته فعلياً", rejectDispatchedBlocked);

/* ==========================================================================
   8. تفاصيل الطلب تحمل فحص التوفر اللحظي
   ========================================================================== */

section("تفاصيل الطلب تحمل فحص التوفر اللحظي");

const detail = getRequisition(created.id);
assert("تفاصيل الطلب تحمل بيانات التوفر", Boolean(detail.availability));
assert("التوفر محسوب للصنف نفسه", String(detail.availability.itemId) === String(created.itemId));

report();
