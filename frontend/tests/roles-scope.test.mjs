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
  landingPathForRole,
  ROLE_SHORTCUTS,
} from "../js/config/navigation.js";
import { buildRoutes } from "../js/config/routes.js";
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

const expectedRoles = ["admin", "reception", "gl", "fin", "hr", "inv", "pharmacy", "billing"];
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

section("حدود كل دور: المخزن الفرعي لا يُدخل كمية ولا يُخرجها بقراره");

loginAs("pharmacy", [PHARMACY], "أمين مخزن فرعي");
assert("الدور الحالي مخزن فرعي", currentRole().key === "pharmacy");

/* ما يملكه: الصرف لمريضه، واسترجاعه، وطلب نواقصه وتتبّعها وفحص الوارد. */
assert("المخزن الفرعي يملك الصرف للمريض", can("inv.dispense.patient"));
assert("المخزن الفرعي يملك استرجاع ما صُرف", can("inv.dispense.return"));
assert("المخزن الفرعي يملك طلب النواقص", can("inv.requisition.create"));
assert("المخزن الفرعي يتتبّع طلباته", can("inv.requisition.view"));
assert("المخزن الفرعي يفحص ويستلم الوارد", can("inv.requisition.inspect"));
assert("المخزن الفرعي يملك الجرد", can("inv.count.manage"));
assert("المخزن الفرعي يملك العمليات التفصيلية", can("inv.operations.view"));

/*
 * الحدّ الجوهري: رصيد الفرع لا يزيد إلا بشحنة من الرئيسي يفحصها، ولا ينقص
 * إلا بصرف لمريض. فلا استلام من مورد، ولا إضافة صنف، ولا تحويل بقراره
 * لفرع آخر — التحويل يبدأ بأمر من الرئيسي عبر طلب نواقص.
 */
assert("المخزن الفرعي لا يستلم من مورد", !can("inv.receipt.create"));
assert("المخزن الفرعي لا يضيف صنفًا ولا يعدّله", !can("inv.item.manage"));
assert("المخزن الفرعي لا يُحوّل لفرع آخر بقراره", !can("inv.transfer.create"));
assert("المخزن الفرعي لا يشحن للفروع", !can("inv.requisition.fulfill"));
assert("المخزن الفرعي لا يدير المستودعات", !can("inv.warehouse.view"));
assert("المخزن الفرعي لا يعتمد الأسعار", !can("pricing.manage"));
assert("المخزن الفرعي لا يرى ملفات المرضى", !can("patients.view"));
assert("المخزن الفرعي لا يرى فواتير المرضى", !can("patients.invoices.view"));
assert("المخزن الفرعي لا يملك استعلام وسداد الحسابات", !can("reception.view"));
assert("المخزن الفرعي لا يملك الموارد البشرية", !can("hr.view"));

loginAs("reception", [], "موظفة استقبال");
assert("الاستقبال يملك فتح الإقامة", can("patients.admissions.manage"));
assert("الاستقبال يملك إدارة الغرف", can("patients.rooms.manage"));
assert("الاستقبال يملك سندات القبض", can("patients.receipt"));
assert("الاستقبال لا يملك المخزون", !can("inv.issue.create"));
assert("الاستقبال لا يملك الترحيل المحاسبي", !can("gl.journal.post"));
assert("الاستقبال لا يملك الرواتب", !can("hr.payroll.view"));

loginAs("inv", null, "أمين المخزن الرئيسي");
assert("المخزن الرئيسي يملك كل المخزون", can("inv.receipt.create") && can("inv.adjustment.approve"));
assert("المخزن الرئيسي يُحوّل بين المخازن", can("inv.transfer.create"));
assert("المخزن الرئيسي يملك الاسترجاع كالفرع", can("inv.dispense.return"));
assert("المخزن الرئيسي لا يملك اعتماد أسعار البيع", !can("pricing.manage"));

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

loginAs("pharmacy", [PHARMACY], "أمين مخزن فرعي");

let branchOutOfScope = false;
try {
  dispenseItemToPatient({
    patientId: patient.id,
    itemId: chargeable?.id ?? plainItem.id,
    warehouseId: HUB,
    quantity: 1,
  });
} catch {
  branchOutOfScope = true;
}
assert("المخزن الفرعي لا يصرف من المخزن الرئيسي", branchOutOfScope);

if (chargeable) {
  const branchDispense = dispenseItemToPatient(
    { patientId: patient.id, itemId: chargeable.id, warehouseId: PHARMACY, quantity: 1 },
    { user: { name: "أمين مخزن فرعي" } },
  );
  assert("المخزن الفرعي يصرف من مخزنه", Boolean(branchDispense.movement?.id));
  assert("الصرف حمَّل المريض", Boolean(branchDispense.charge?.id));
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
  users.some((u) => u.role === "inv") &&
    users.some((u) => u.role === "pharmacy") &&
    users.some((u) => u.role === "reception"));

const storeUsers = users.filter((u) => ["inv", "pharmacy"].includes(u.role));
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
 * حارس ضد العودة للمشكلة: صلاحية واسعة واحدة (`inv.view`) كانت تفتح للمخزن
 * الفرعي أحد عشر شاشة وهو يحتاج خمسًا. الحد ليس رقمًا جماليًا — هو إنذار
 * مبكر بأن صلاحية اتّسعت أكثر من دورها.
 */
const SIDEBAR_BUDGET = {
  reception: 8,
  pharmacy: 16,
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
for (const essential of ["الجرد الفعلي", "التسويات المخزنية", "تتبّع الصلاحية", "المستودعات والفروع"]) {
  assert(`أمين المخزن يصل إلى «${essential}» من الشريط`, invScreens.includes(essential));
}

/* ==========================================================================
   9. منطقية الشريط — لا قسم خارج دور صاحبه
   ========================================================================== */

section("منطقية الشريط: لا يرى الدور قسمًا ليس من شغله");

/** أسماء الأقسام التي يراها دور. */
function sectionsFor(roleKey) {
  setRole(roleKey);
  return navigation
    .filter((entry) =>
      entry.children
        ? entry.children.some(
            (c) => can(c.permission) && (!c.children || c.children.some((g) => can(g.permission))),
          )
        : can(entry.permission),
    )
    .map((entry) => entry.label);
}

/*
 * الأقسام تُسمّى بالوظيفة لا بالإدارة المالكة.
 *
 * كان القسم اسمه «الاستقبال والغرف»، فكان أمين المخزن الفرعي يرى قسم
 * «استقبال» ليصل إلى ما يخصه — والنظام بذلك يصف عمله بعمل غيره. وكان يرى
 * «المرضى والفواتير» وهو لا يملك فاتورة واحدة.
 */
const FORBIDDEN_SECTIONS = {
  pharmacy: ["الاستقبال", "الفواتير", "التحصيل", "المحاسبة", "الموارد البشرية", "المرضى"],
  reception: ["المحاسبة", "الموارد البشرية", "المخازن"],
  hr: ["المخازن", "المرضى", "الغرف", "التحصيل"],
};

for (const [role, forbidden] of Object.entries(FORBIDDEN_SECTIONS)) {
  const sections = sectionsFor(role);
  for (const word of forbidden) {
    const offender = sections.find((label) => label.includes(word));
    assert(
      `«${ROLES[role].label}» لا يرى قسمًا فيه «${word}»${offender ? ` — وجد: ${offender}` : ""}`,
      !offender,
    );
  }
}

/*
 * دور بلا لوحة تحكم يجب أن تكون له شاشة بداية، وإلا فُتح النظام على
 * «غير مصرح» عند أول دخول.
 */
for (const roleKey of Object.keys(ROLES)) {
  setRole(roleKey);
  if (can("dashboard.view")) continue;

  const landing = landingPathForRole(roleKey);
  assert(`«${roleKey}» بلا لوحة تحكم له شاشة بداية`, landing !== "/");
}

/* ==========================================================================
   10. لا رابط يَعِد ثم يُخلف — الحارس الأهم
   ========================================================================== */

section("كل رابط يراه الدور يفتح فعلًا");

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  كانت الصلاحية مكتوبة مرتين: في `navigation.js` لتقرير ما يظهر في
 *  الشريط، وفي `routes.js` لتقرير ما يُفتح فعلًا. فتباعدت القائمتان
 *  وصارت اثنتا عشرة شاشة تظهر للمستخدم ثم تردّه بـ«لا تملك صلاحية الوصول».
 *
 *  وهذا أسوأ من منعه ابتداءً: النظام يَعِد ثم يُخلف.
 *
 *  هذا الفحص هو ما يمنع عودتها: لكل دور، كل رابط مرئي في شريطه — ومعه كل
 *  اختصار — يجب أن يقابله مسار مسجَّل يملك الدور صلاحيته.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const builtRoutes = buildRoutes();
const staticRoute = (path) =>
  builtRoutes.find((route) => !route.path.includes(":") && route.path === path);

/* أولًا: لا تعارض بين صلاحية الشريط وصلاحية المسار — أيًّا كان الدور. */
const permissionConflicts = flatScreens()
  .map((screen) => ({ screen, route: staticRoute(screen.path) }))
  .filter(({ screen, route }) => !route || String(route.permission) !== String(screen.permission));

assert(
  `لا شاشة بصلاحيتين مختلفتين بين الشريط والمسار${
    permissionConflicts.length
      ? ` (${permissionConflicts.map((c) => c.screen.path).join(", ")})`
      : ""
  }`,
  permissionConflicts.length === 0,
);

/* ثانيًا: الفحص الفعلي لكل دور. */
function visibleLinksFor(roleKey) {
  setRole(roleKey);
  const out = [];

  for (const entry of navigation) {
    if (!entry.children) {
      if (can(entry.permission)) out.push(entry);
      continue;
    }
    for (const child of entry.children) {
      if (child.children) {
        out.push(...child.children.filter((g) => can(g.permission)));
        continue;
      }
      if (can(child.permission)) out.push(child);
    }
  }

  return out;
}

for (const roleKey of Object.keys(ROLES)) {
  setRole(roleKey);

  const links = [...visibleLinksFor(roleKey), ...shortcutsForRole(roleKey).filter((sc) => can(sc.permission))];

  const broken = links.filter((link) => {
    const route = staticRoute(link.path);
    return !route || !can(route.permission);
  });

  assert(
    `«${ROLES[roleKey].label}» — كل روابطه الـ${links.length} تفتح${
      broken.length ? ` (مكسور: ${broken.map((b) => b.label).join(", ")})` : ""
    }`,
    broken.length === 0,
  );
}

/* ==========================================================================
   11. شاشات الإدارة لا تُعرض لمن يُنفِّذ فقط
   ========================================================================== */

section("فصل شاشة الإدارة عن شاشة التنفيذ");

/*
 * «يطلب ويتتبّع» ≠ «يشحن ويوزّع».
 *
 * الشاشة واحدة (`/inv/requisitions`) والفارق صلاحية `fulfill` وحدها: الفرع
 * يطلب ويتابع ويفحص الوارد، والرئيسي وحده يشحن ويُناقل ويُصدر أمر الشراء.
 */
loginAs("pharmacy", [PHARMACY], "أمين مخزن فرعي");
assert("المخزن الفرعي يطلب نواقصه", can("inv.requisition.create"));
assert("المخزن الفرعي يتتبّع طلباته على نفس الشاشة", can("inv.requisition.view"));
assert("المخزن الفرعي يفحص ويستلم", can("inv.requisition.inspect"));
assert("المخزن الفرعي لا يشحن للفروع", !can("inv.requisition.fulfill"));

loginAs("inv", null, "أمين المخزن الرئيسي");
assert("المخزن الرئيسي يشحن ويوزّع", can("inv.requisition.fulfill"));
assert("المخزن الرئيسي يفحص الوارد من المورد", can("inv.requisition.inspect"));

/*
 * نطاق المخازن مشترك بين ثلاثة فاعلين: المخزن الفرعي يصرف ويطلب ويستلم،
 * وأمين الرئيسي يشحن ويوزّع ويستلم من المورد، والمحاسب يُسعّر. فالـwildcard
 * عليه يمنح كل واحد منهم عمل الآخرَين — وهو أصل كل ما سبق.
 *
 * (`gl.*` لمحاسب عام أمر آخر: النطاق كله عمله، ولا يشاركه فيه فاعل بدور
 * مختلف. القاعدة ليست «لا wildcards» بل «لا wildcard على نطاق مشترك».)
 */
for (const [key, role] of Object.entries(ROLES)) {
  if (key === "admin") continue;
  assert(
    `«${role.label}» لا يملك inv.* — نطاق المخازن مشترك بين أدوار مختلفة`,
    !(role.permissions ?? []).includes("inv.*"),
  );
}

loginAsAdmin();

report();
