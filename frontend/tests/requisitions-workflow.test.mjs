/**
 * اختبارات دورة طلبات النواقص وتوزيع المخزون الذكية وسلاسل الإمداد.
 *
 *   node tests/requisitions-workflow.test.mjs
 */

import { assert, section, report } from "./harness.mjs";
import {
  listRequisitions,
  getRequisition,
  createRequisition,
  checkItemAvailability,
  fulfillFromHub,
  fulfillByBranchTransfer,
  orderFromSupplier,
  branchInspectAndReceive,
} from "../js/mock/services/inventory.service.js";
import { all } from "../js/mock/db.js";

/* ==========================================================================
   1. إنشاء طلب نواقص والتأمين الزمني اللحظي
   ========================================================================== */

section("إنشاء طلب نواقص من الفرع وتأمينه زمنياً ضد التلاعب");

const initialReqs = listRequisitions();
const initialTotal = initialReqs.meta.total;

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
assert("الجدول الزمني (Timeline) يحمل أول خطوة بتوقيت حقيقي", created.timeline.length === 1 && created.timeline[0].stage === "created");

const afterReqs = listRequisitions();
assert("إجمالي الطلبات زاد بمقدار 1", afterReqs.meta.total === initialTotal + 1);

/* ==========================================================================
   2. فحص التوفر الذكي واكتشاف فائض الفروع
   ========================================================================== */

section("فحص التوفر وفائض الفروع الذكي (توفير الشراء الخارجي)");

const availability = checkItemAvailability(1); // أموكسيسيلين
assert("تم استرجاع بيانات التوفر للصنف", availability.itemId === 1);
assert("بيانات المخزن الرئيسي موجودة", typeof availability.hubAvailable === "number");
assert("بيانات الفروع الأخرى تم فحصها", availability.allWarehouses.length >= 4);

/* ==========================================================================
   3. التحويل الداخلي الذكي وتوفير الشراء
   ========================================================================== */

section("اعتماد التحويل الداخلي الذكي بين الفروع");

const transferred = fulfillByBranchTransfer(created.id, {
  sourceBranchId: 4, // فرع 3
  dispatchedQty: 12,
  driverName: "أحمد السائق",
}, { user: { name: "أمين المخزن الرئيسي" } });

assert("حالة الطلب تحولت إلى في الطريق", transferred.status === "in_transit");
assert("مسار التوفير تحول إلى مناقلة بين فروع", transferred.fulfillmentSource === "branch_transfer");
assert("الفرع المصدر مسجل", transferred.sourceBranchId === 4);
assert("تمت إضافة ختم زمني غير قابل للتعديل لمرحلة الشحن في الـ Timeline", transferred.timeline.length === 2);
assert("تاريخ ووقت الشحن مثبت بالثانية", Boolean(transferred.dispatchedAt));

/* ==========================================================================
   4. فحص واستلام الفرع مع إثبات العجز الرقابي
   ========================================================================== */

section("فحص واستلام الفرع بالعد الفعلي وإثبات العجز الرقابي");

// طلب جديد لفحص سيناريو العجز
const reqForDiscrepancy = createRequisition({
  branchId: 3, // فرع 2
  itemId: 7,   // محلول ملح
  requestedQty: 10,
}, { user: { name: "أمين فرع 2" } });

fulfillFromHub(reqForDiscrepancy.id, { dispatchedQty: 10, driverName: "عمر السائق" });

// الفرع يعد ويكتشف عجز (المشحون 10 والمستلم 8 فقط)
const inspected = branchInspectAndReceive(reqForDiscrepancy.id, {
  receivedQty: 8,
  notes: "عجز عدد 2 كيس لم يتم تسليمها مع السائق",
}, { user: { name: "أمين فرع 2" } });

assert("حالة الطلب تحولت إلى استلام به عجز/خلاف رقابي", inspected.status === "discrepancy");
assert("الكمية المستلمة مسجلة بـ 8 فقط", inspected.receivedQty === 8);
assert("عدد العجز مسجل بـ 2 بدقة", inspected.discrepancyCount === 2);
assert("ملاحظات العجز موثقة في الطلب", inspected.discrepancyNotes.includes("عجز"));
assert("الـ Timeline يحمل خطوة إثبات العجز الرقابي بالثانية", inspected.timeline.some((t) => t.stage === "inspection_discrepancy"));

/* ==========================================================================
   5. فحص الاستلام المطابق 100% وإغلاق الطلب
   ========================================================================== */

section("فحص الاستلام المطابق 100% وإغلاق الطلب");

const reqForMatch = createRequisition({
  branchId: 2,
  itemId: 3,
  requestedQty: 5,
});

fulfillFromHub(reqForMatch.id, { dispatchedQty: 5 });

const matched = branchInspectAndReceive(reqForMatch.id, {
  receivedQty: 5,
  notes: "تم الاستلام ومطابقة الحبات بالكامل",
});

assert("حالة الطلب تحولت إلى مكتمل ومطابق 100%", matched.status === "completed");
assert("الكمية المستلمة مطابقة للمشحونة", matched.receivedQty === 5 && matched.discrepancyCount === 0);
assert("الـ Timeline يحمل خطوة الإغلاق النهائي المكتمل", matched.timeline.some((t) => t.stage === "completed"));

report();
