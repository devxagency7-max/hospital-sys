/**
 * جدول المسارات.
 *
 * الشاشات المنفَّذة تُسجَّل صراحةً في `IMPLEMENTED`. وكل ما تبقى من
 * js/config/navigation.js يُسجَّل تلقائيًا على صفحة «مخطَّطة» تذكر رقم المرحلة.
 *
 * السبب: docs/09-DEFINITION-OF-DONE.md يشترط «لا روابط أو أزرار مكسورة».
 * وعدم تسجيل الشاشة غير المنفَّذة يعطي 404 يبدو كعطل؛ وتسجيلها بصفحة فارغة
 * يبدو كشاشة انتهت ولا تعمل. الصفحة الصريحة تقول الحقيقة: مخطَّطة، في المرحلة كذا.
 */

import { flatScreens } from "./navigation.js";

/** الشاشات المنفَّذة فعلًا. */
const IMPLEMENTED = [
  {
    path: "/design-system",
    title: "نظام التصميم",
    load: () => import("../../pages/_system/design-system.page.js"),
  },
];

/** مسارات ديناميكية (بمعاملات) تُسجَّل يدويًا — لا تظهر في الشريط الجانبي. */
const DYNAMIC = [
  // أمثلة تُفعَّل مع شاشات Phase 1:
  // { path: "/patients/:id", title: "ملف المريض", permission: "patients.view",
  //   load: () => import("../../pages/patients/patient-profile.page.js") },
];

export function buildRoutes() {
  const implementedPaths = new Set([...IMPLEMENTED, ...DYNAMIC].map((route) => route.path));

  /** كل شاشة في خريطة التنقل ليست منفَّذة بعد → صفحة «مخطَّطة». */
  const planned = flatScreens()
    .filter((screen) => !implementedPaths.has(screen.path))
    .map((screen) => ({
      path: screen.path,
      title: screen.label,
      permission: screen.permission,
      load: () => import("../../pages/_system/planned.page.js"),
      meta: { screen },
    }));

  return [...IMPLEMENTED, ...DYNAMIC, ...planned];
}
