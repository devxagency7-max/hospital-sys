/**
 * فحص دورة عمل تسعير الأصناف وهوامش الربح:
 *
 * 1. استلام صنف بسعر شراء جديد لا يغير سعر بيعه للمريض تلقائيًا.
 * 2. ينشئ إذن الإضافة طلب مراجعة وتحديث سعر بيع للمريض في قائمة الانتظار.
 * 3. تظهر التنبيهات في لوحة الإشعارات لمدير الحسابات.
 * 4. مدير الحسابات فقط هو من يعتمد السعر الجديد أو يثبت السعر القديم.
 * 5. أمين المخزن ليس لديه صلاحية تسعير الأصناف.
 */

import { section, assert, assertEqual, report } from "./harness.mjs";
import { all, find } from "../js/mock/db.js";
import * as inventory from "../js/mock/services/inventory.service.js";
import { can, setRole } from "../js/core/permissions.js";

section("صلاحيات التسعير محصورة في مدير الحسابات والإدارة ولا يملكها أمين المخزن");

// أمين المخزن
setRole("inv");
assert("أمين المخزن لا يملك صلاحية إدارة أسعار البيع", !can("pricing.manage"));
assert("أمين المخزن يملك صلاحية إنشاء إذن إضافة", can("inv.receipt.create"));

// مدير الحسابات
setRole("gl");
assert("مدير الحسابات يملك صلاحية إدارة واعتماد أسعار البيع", can("pricing.manage"));
assert("مدير الحسابات يملك صلاحية عرض المخازن", can("inv.view"));

// مدير النظام
setRole("admin");
assert("مدير النظام يملك كل الصلاحيات", can("pricing.manage"));

section("استلام توريد بسعر شراء جديد ينشئ طلب مراجعة ولا يغير سعر البيع تلقائيًا");

const item = find("items", 1);
const oldPurchasePrice = item.lastPurchasePrice || item.costPrice;
const initialSellingPrice = item.sellingPrice;
const newPurchaseCost = oldPurchasePrice + 10; // زيادة 10 جنيه

const initialPendingCount = all("priceReviews").filter((r) => r.status === "pending").length;

const result = inventory.createReceipt({
  itemId: item.id,
  warehouseId: item.warehouseIds[0] ?? 1,
  quantity: 5,
  unitCost: newPurchaseCost,
  batchNumber: "BATCH-TEST-PRICE",
  expiryDate: "2027-12-31",
  date: "2026-11-11",
  reason: "توريد تجريبي لاختبار تغير السعر",
}, { user: { name: "أمين المخزن التجريبي" } });

assert("تم إنشاء حركة إذن الإضافة", Boolean(result.movement));

// تحقق من أن سعر البيع لم يتغير تلقائيًا
const updatedItem = find("items", item.id);
assertEqual("سعر البيع للمريض ظل ثابتًا ولم يتغير تلقائيًا", updatedItem.sellingPrice, initialSellingPrice);

// تحقق من إنشاء طلب مراجعة تسعير معلق
const currentPending = all("priceReviews").filter((r) => r.status === "pending");
assertEqual("تمت إضافة طلب مراجعة تسعير جديد إلى قائمة الانتظار", currentPending.length, initialPendingCount + 1);

const latestReview = currentPending.find((r) => r.receiptReference === result.movement.reference);
assert("طلب المراجعة يحمل نفس مرجع إذن الإضافة", Boolean(latestReview));
assertEqual("السعر الجديد مسجل بدقة", latestReview.newPurchasePrice, newPurchaseCost);
assertEqual("السعر القديم مسجل بدقة", latestReview.oldPurchasePrice, oldPurchasePrice);
assertEqual("حالة الطلب قيد المراجعة المعلقة", latestReview.status, "pending");

section("تنبيهات المخزون تعيد طلبات مراجعة الأسعار المعلقة للوحة الإشعارات");

const alerts = inventory.getAlerts();
assert("يوجد مصفوفة priceReviews في التنبيهات", Array.isArray(alerts.priceReviews));
assert("يوجد تنبيهات لتغيرات الأسعار", alerts.priceReviews.length > 0);
assertEqual("إجمالي تنبيهات الأسعار متطابق مع طول المصفوفة", alerts.totals.priceReviews, alerts.priceReviews.length);

section("مدير الحسابات يعتمد سعر بيع جديد ويتم تحديث الصنف فورًا");

const pending = all("priceReviews").find((r) => r.status === "pending");
assert("يوجد طلب تسعير معلق للمراجعة", Boolean(pending));

const newApprovedPrice = Math.round(pending.newPurchasePrice * 1.4 * 100) / 100; // هامش 40%

const approval = inventory.approvePriceReview(pending.id, {
  action: "update_price",
  newSellingPrice: newApprovedPrice,
  decisionNotes: "تم اعتماد السعر الجديد بهامش ربح 40% للمريض",
}, { user: { name: "أحمد منصور (مدير الحسابات)" } });

assertEqual("تم تغيير حالة المراجعة إلى معتمد", approval.review.status, "approved");
assertEqual("سعر البيع المعتمد مسجل بدقة", approval.review.approvedPrice, newApprovedPrice);

// تحقق من تحديث الصنف الفعلي
const itemAfter = find("items", pending.itemId);
assertEqual("سعر بيع الصنف للمريض تم تحديثه في الدليل بالكامل", itemAfter.sellingPrice, newApprovedPrice);

report();
