/**
 * اختبارات الأدوار ونطاق المخازن.
 *
 *   node tests/roles-scope.test.mjs
 *
 * الضمانات:
 *   1. لكل دور تشغيلي دور فعلي في النظام — لا صلاحية معرَّفة بلا دور يحملها.
 *   2. الصلاحية والنطاق سؤالان مختلفان: «يملك الصرف» ≠ «يصرف من أي مخزن».
 *   3. النطاق يُفرض عند **تنفيذ** العملية لا عند رسم الزر.
 *   4. التمريض يصرف للمريض ولا يملك سلطة أمين المخزن.
 */

import { assert, section, report } from "./harness.mjs";
import {
  PERMISSIONS,
  ROLES,
  can,
  canAccessWarehouse,
  allowedWarehouseIds,
  setSession,
  setRole,
  currentRole,
  effectivePermissions,
} from "../js/core/permissions.js";
import { createIssue, createTransfer, createReceipt } from "../js/mock/services/inventory.service.js";
import { dispenseItemToPatient } from "../js/mock/services/dispensing.service.js";
import {
  navigation,
  flatScreens,
  shortcutsForRole,
  ROLE_SHORTCUTS,
} from "../js/config/navigation.js";
import { all, find } from "../js/mock/db.js";

const HUB = 1;
const PHARMACY = 2;

const plainItem = all("items").find(
  (i) => !i.trackBatches && !i.trackExpiry && (i.warehouseIds ?? []).includes(HUB) && (i.warehouseIds ?? []).includes(PHARMACY),
);

/** يُسجّل جلسة بدور ونطاق محددين. */
function loginAs(role, warehouseIds, name = "مستخدم اختبار") {
  setSession({
    authenticated: true,
    user: { id: 999, name, role, departmentId: null, warehouseIds },
  });
}

/** يُعيد الجلسة لمدير النظام بلا قيد. */
function loginAsAdmin() {
  setSession({
    authenticated: true,
    user: { id: 1, name: "مدير النظام", role: "admin", departmentId: null, warehouseIds: null },
  });
}

/* ==========================================================================
   1. كتالوج الأدوار
   ========================================================================== */

section("كتالوج الأدوار يغطي كل دور تشغيلي فعلي");

const expectedRoles = ["admin", "reception", "gl", "fin", "hr", "inv", "nurse", "pharmacy", "billing"];
for (const key of expectedRoles) {
  assert(`الدور «${key}» معرَّف`, Boolean(ROLES[key]));
}
assert("كل دور له اسم عربي معروض",
  Object.values(ROLES).every((r) => typeof r.label === "string" && r.label.length > 2));
assert("كل دور له صلاحيات غير فارغة",
  Object.values(ROLES).every((r) => (r.permissions ?? []).length > 0));

/*
 * كل صلاحية في الكتالوج يجب أن يحملها دور واحد على الأقل. صلاحية معرَّفة
 * ولا دور يملكها = شاشة لا يستطيع أحد فتحها (هذا بالضبط ما كان يحدث
 * لصلاحيات `reception.*` قبل إسناد مستخدمين لها).
 */
const orphanPermissions = Object.keys(PERMISSIONS).filter((key) => {
  for (const role of Object.values(ROLES)) {
    const perms = role.permissions ?? [];
    if (perms.includes("*") || perms.includes(key)) return false;
    const segments = key.split(".");
    for (let i = segments.length - 1; i > 0; i -= 1) {
      if (perms.includes(`${segments.slice(0, i).join(".")}.*`)) return false;
    }
  }
  return true;
});
assert(
  `لا صلاحية بلا دور يحملها${orphanPermissions.length ? ` (${orphanPermissions.join(", ")})` : ""}`,
  orphanPermissions.length === 0,
);

/* ==========================================================================
   2. حدود الدور
   ========================================================================== */

section("حدود كل دور: التمريض لا يملك سلطة أمين المخزن");

loginAs("nurse", [PHARMACY], "ممرضة القسم الداخلي");
assert("الدور الحالي تمريض", currentRole().key === "nurse");
assert("التمريض يملك الصرف للمريض", can("inv.dispense.patient"));
assert("التمريض يملك طلب نواقص قسمه", can("inv.requisition.create"));
assert("التمريض يملك رؤية إشغال الغرف", can("reception.occupancy.view"));
assert("التمريض يملك سجل المرضى", can("patients.view"));

/*
 * التضييق مقصود: `inv.view` وحدها كانت تفتح قسم المخازن كاملًا للممرضة —
 * دليل الأصناف وحركات المخزون وإدارة المستودعات. وهي تصرف لمريضها وتطلب
 * نواقص قسمها، لا تدير مخزنًا.
 */
assert("التمريض لا يملك عرض المخازن العام", !can("inv.view"));
assert("التمريض لا يملك دليل الأصناف", !can("inv.items.view"));
assert("التمريض لا يملك حركات المخزون", !can("inv.movements.view"));
assert("التمريض لا يملك إدارة المستودعات", !can("inv.warehouse.view"));
assert("التمريض لا يملك العمليات التفصيلية", !can("inv.operations.view"));
assert("التمريض لا يملك استعلام وسداد الحسابات", !can("reception.view"));
assert("التمريض لا يملك فواتير المرضى", !can("patients.invoices.view"));
assert("التمريض لا يملك تسجيل استلام من مورد", !can("inv.receipt.create"));
assert("التمريض لا يملك تسوية جرد", !can("inv.adjustment.create"));
assert("التمريض لا يملك إدارة الأصناف", !can("inv.item.manage"));
assert("التمريض لا يملك اعتماد الأسعار", !can("pricing.manage"));
assert("التمريض لا يملك الموارد البشرية", !can("hr.view"));

loginAs("pharmacy", [PHARMACY], "أمين صيدلية فرعية");
assert("الصيدلية الفرعية تملك فحص واستلام الشحنات", can("inv.requisition.inspect"));
assert("الصيدلية الفرعية تملك طلب النواقص", can("inv.requisition.create"));
assert("الصيدلية الفرعية تملك الجرد", can("inv.count.manage"));
assert("الصيدلية الفرعية تملك العمليات التفصيلية", can("inv.operations.view"));
assert("الصيدلية الفرعية لا تملك استلام مورد خارجي", !can("inv.receipt.create"));
assert("الصيدلية الفرعية لا تملك إدارة المستودعات", !can("inv.warehouse.view"));
assert("الصيدلية الفرعية لا تملك اعتماد الأسعار", !can("pricing.manage"));

loginAs("reception", [], "موظفة استقبال");
assert("الاستقبال يملك فتح الإقامة", can("patients.admissions.manage"));
assert("الاستقبال يملك إدارة الغرف", can("patients.rooms.manage"));
assert("الاستقبال يملك سندات القبض", can("patients.receipt"));
assert("الاستقبال لا يملك المخزون", !can("inv.issue.create"));
assert("الاستقبال لا يملك الترحيل المحاسبي", !can("gl.journal.post"));
assert("الاستقبال لا يملك الرواتب", !can("hr.payroll.view"));

loginAs("inv", null, "مدير المخازن");
assert("مدير المخازن يملك كل المخزون", can("inv.receipt.create") && can("inv.adjustment.approve"));
assert("مدير المخازن لا يملك اعتماد أسعار البيع", !can("pricing.manage"));

loginAsAdmin();
assert("مدير النظام يملك كل شيء",
  effectivePermissions().length === Object.keys(PERMISSIONS).length);

/* ==========================================================================
   3. النطاق منفصل عن الصلاحية
   ========================================================================== */

section("النطاق سؤال مستقل عن الصلاحية");

loginAsAdmin();
assert("مدير النظام بلا قيد نطاق", allowedWarehouseIds() === null);
assert("مدير النظام يصل لأي مخزن", canAccessWarehouse(HUB) && canAccessWarehouse(4));

loginAs("pharmacy", [PHARMACY], "أمين فرع 1");
assert("نطاق أمين الفرع محدد", allowedWarehouseIds().length === 1);
assert("يصل لمخزنه", canAccessWarehouse(PHARMACY));
assert("لا يصل للمخزن الرئيسي", !canAccessWarehouse(HUB));
assert("لا يصل لمخزن فرع آخر", !canAccessWarehouse(4));
assert("يملك صلاحية الصرف عمومًا", can("inv.issue.create"));

loginAs("reception", [], "موظفة استقبال");
assert("نطاق فارغ لا يصل لأي مخزن",
  !canAccessWarehouse(HUB) && !canAccessWarehouse(PHARMACY));

assert("مخزن غير محدد لا يُعد داخل النطاق", !canAccessWarehouse(null));

/* ==========================================================================
   4. النطاق يُفرض عند التنفيذ لا عند رسم الزر
   ========================================================================== */

section("النطاق يُفرض عند تنفيذ العملية — إخفاء الزر ليس أمانًا");

assert("يوجد صنف متاح في الرئيسي والصيدلية", Boolean(plainItem));

loginAs("pharmacy", [PHARMACY], "أمين فرع 1");

let outOfScopeIssue = false;
try {
  createIssue({ itemId: plainItem.id, warehouseId: HUB, quantity: 1, reason: "محاولة" });
} catch {
  outOfScopeIssue = true;
}
assert("الصرف من مخزن خارج النطاق مرفوض عند التنفيذ", outOfScopeIssue);

let outOfScopeReceipt = false;
try {
  createReceipt({ itemId: plainItem.id, warehouseId: HUB, quantity: 1, unitCost: 50 });
} catch {
  outOfScopeReceipt = true;
}
assert("الاستلام في مخزن خارج النطاق مرفوض", outOfScopeReceipt);

/* الصرف من مخزنه يمر. */
const inScope = createIssue(
  { itemId: plainItem.id, warehouseId: PHARMACY, quantity: 1, reason: "صرف داخل النطاق" },
  { user: { name: "أمين فرع 1" } },
);
assert("الصرف من مخزنه مسموح", Boolean(inScope.movement?.id));

/* التحويل يتطلب نطاقًا على الطرفين. */
let transferOutOfScope = false;
try {
  createTransfer({
    itemId: plainItem.id,
    fromWarehouseId: PHARMACY,
    toWarehouseId: HUB,
    quantity: 1,
  });
} catch {
  transferOutOfScope = true;
}
assert("التحويل إلى مخزن خارج النطاق مرفوض", transferOutOfScope);

/* ==========================================================================
   5. الصرف للمريض يخضع للنطاق كذلك
   ========================================================================== */

section("الصرف للمريض يخضع لنطاق المخزن");

const patient = all("patients").find((p) => p.status === "inpatient");
const chargeable = all("items").find(
  (i) => i.patientChargeable && (i.warehouseIds ?? []).includes(PHARMACY) && !i.trackBatches,
);

loginAs("nurse", [PHARMACY], "ممرضة");

let nurseOutOfScope = false;
try {
  dispenseItemToPatient({
    patientId: patient.id,
    itemId: chargeable?.id ?? plainItem.id,
    warehouseId: HUB,
    quantity: 1,
  });
} catch {
  nurseOutOfScope = true;
}
assert("الممرضة لا تصرف من المخزن الرئيسي", nurseOutOfScope);

if (chargeable) {
  const nurseDispense = dispenseItemToPatient(
    { patientId: patient.id, itemId: chargeable.id, warehouseId: PHARMACY, quantity: 1 },
    { user: { name: "ممرضة" } },
  );
  assert("الممرضة تصرف من صيدليتها", Boolean(nurseDispense.movement?.id));
  assert("الصرف حمَّل المريض", Boolean(nurseDispense.charge?.id));
}

/* ==========================================================================
   6. تبديل الدور يُعيد بناء الصلاحيات
   ========================================================================== */

section("تبديل الدور يُعيد بناء الصلاحيات فورًا");

setRole("hr");
assert("بعد التبديل لـ HR: يملك الموارد البشرية", can("hr.view"));
assert("بعد التبديل لـ HR: لا يملك المخزون", !can("inv.issue.create"));

setRole("inv");
assert("بعد التبديل للمخازن: يملك المخزون", can("inv.issue.create"));
assert("بعد التبديل للمخازن: لا يملك الموارد البشرية", !can("hr.view"));

loginAsAdmin();
assert("العودة لمدير النظام تُعيد كل الصلاحيات", can("hr.view") && can("inv.issue.create"));

/* ==========================================================================
   7. بيانات المستخدمين مُسندة لمخازنها
   ========================================================================== */

section("بيانات المستخدمين: كل أمين مخزن مُسند لمخزنه");

const users = all("users");
assert("يوجد مستخدمون بأدوار تشغيلية جديدة",
  users.some((u) => u.role === "nurse") &&
    users.some((u) => u.role === "pharmacy") &&
    users.some((u) => u.role === "reception"));

const storeUsers = users.filter((u) => ["inv", "pharmacy", "nurse"].includes(u.role));
assert("كل مستخدم مخزني له حقل نطاق معرَّف",
  storeUsers.every((u) => u.warehouseIds === null || Array.isArray(u.warehouseIds)));

const scopedStoreUsers = storeUsers.filter((u) => Array.isArray(u.warehouseIds) && u.warehouseIds.length);
assert("النطاقات تشاور على مخازن موجودة",
  scopedStoreUsers.every((u) => u.warehouseIds.every((id) => Boolean(find("warehouses", id)))));
assert("يوجد أمين للمخزن الرئيسي",
  storeUsers.some((u) => Array.isArray(u.warehouseIds) && u.warehouseIds.includes(HUB)));
assert("يوجد أمين لكل مخزن فرعي على الأقل",
  all("warehouses")
    .filter((w) => !w.isHub)
    .every((w) =>
      users.some((u) => Array.isArray(u.warehouseIds) && u.warehouseIds.includes(w.id)),
    ));

assert("كل دور مستخدم معرَّف في كتالوج الأدوار",
  users.every((u) => Boolean(ROLES[u.role])));

/* ==========================================================================
   8. حجم القائمة لكل دور — حارس ضد تضخّم الشريط
   ========================================================================== */

section("حجم الشريط الجانبي لكل دور");

/** الشاشات التي يراها دور فعلًا في الشريط. */
function visibleScreensFor(roleKey) {
  setRole(roleKey);
  const out = [];

  for (const entry of navigation) {
    if (!entry.children) {
      if (can(entry.permission)) out.push(entry.label);
      continue;
    }
    for (const child of entry.children) {
      if (!can(child.permission)) continue;
      if (child.children) {
        out.push(...child.children.filter((g) => can(g.permission)).map((g) => g.label));
      } else {
        out.push(child.label);
      }
    }
  }

  return out;
}

/*
 * حارس ضد العودة للمشكلة: صلاحية واسعة واحدة (`inv.view`) كانت تفتح للممرضة
 * أحد عشر شاشة وهي تحتاج خمسًا. الحد ليس رقمًا جماليًا — هو إنذار مبكر بأن
 * صلاحية اتّسعت أكثر من دورها.
 */
const SIDEBAR_BUDGET = {
  nurse: 6,
  reception: 8,
  pharmacy: 18,
  inv: 20,
  billing: 12,
};

for (const [role, budget] of Object.entries(SIDEBAR_BUDGET)) {
  const screens = visibleScreensFor(role);
  assert(
    `«${ROLES[role].label}» يرى ${screens.length} شاشة (الحد ${budget})`,
    screens.length <= budget,
  );
}

/* الاختصارات: ثلاثة كحد أقصى، وكلها مسارات حقيقية يملكها الدور. */
for (const roleKey of Object.keys(ROLES)) {
  const shortcuts = shortcutsForRole(roleKey);
  assert(`اختصارات «${roleKey}» ثلاثة فأقل`, shortcuts.length <= 3);

  setRole(roleKey);
  const owned = shortcuts.filter((sc) => can(sc.permission));
  assert(
    `كل اختصارات «${roleKey}» ضمن صلاحياته`,
    owned.length === shortcuts.length,
  );
}

/*
 * لا مسار يظهر مرتين في الشريط. تكرر فعلًا: `/inv/price-reviews` كان
 * مُدرجًا في «المحاسبة المالية» و«المخازن» باسمين مختلفين، فكان صاحب
 * الدورين يرى الشاشة نفسها مرتين ولا يعرف الفرق.
 */
const allPaths = flatScreens().map((s) => s.path);
const duplicatePaths = allPaths.filter((path, i) => allPaths.indexOf(path) !== i);
assert(
  `لا شاشة مكررة في الشريط${duplicatePaths.length ? ` (${[...new Set(duplicatePaths)].join(", ")})` : ""}`,
  duplicatePaths.length === 0,
);

const navPaths = new Set(allPaths);
for (const [roleKey, shortcuts] of Object.entries(ROLE_SHORTCUTS)) {
  assert(
    `اختصارات «${roleKey}» تشاور على شاشات مسجَّلة`,
    shortcuts.every((sc) => navPaths.has(sc.path)),
  );
}

/*
 * الشاشات المفقودة من الشريط: كانت تسع شاشات مخزون بمسارات بلا رابط —
 * أمين المخزن لا يصل للجرد الفعلي ولا للتسويات من أصله.
 */
loginAs("inv", null, "مدير المخازن");
const invScreens = visibleScreensFor("inv");
for (const essential of ["الجرد الفعلي", "التسويات المخزنية", "تتبّع الصلاحية", "إذن إضافة"]) {
  assert(`أمين المخزن يصل إلى «${essential}» من الشريط`, invScreens.includes(essential));
}

loginAsAdmin();

report();
