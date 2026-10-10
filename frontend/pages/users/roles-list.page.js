/**
 * إدارة الأدوار ومجموعات الصلاحيات (Roles Management)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { listRoles } from "../../js/api/admin.api.js";
import { toast } from "../../components/feedback/toast.js";

export default async function rolesListPage() {
  const container = el("div", { class: "space-y-4" });
  const roles = await listRoles().catch(() => []);

  const header = pageHeader({
    title: "الأدوار ومجموعات الأذونات",
    description: "تحديد مصفوفة الصلاحيات والأدوار الوظيفية المعتمدة لحماية بيانات المستشفى.",
    actions: [
      button({
        label: "إنشاء دور جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("إنشاء دور وظيفي جديد"),
      }),
    ],
  });
  container.appendChild(header);

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
    ...roles.map((r) =>
      card({
        title: r.name,
        subtitle: `كود الدور: ${r.code}`,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el("p", { class: "text-muted leading-relaxed" }, r.description),
          el(
            "div",
            { class: "flex justify-between pt-2 border-t border-line text-[11px]" },
            badge(`${r.usersCount} مستخدم`, { tone: "info", size: "sm" }),
            badge(`${r.permissionsCount} صلاحية`, { tone: "brand", size: "sm" }),
          ),
        ),
        footer: el(
          "div",
          { class: "flex justify-end gap-1.5" },
          button({
            label: "تعديل الصلاحيات",
            variant: "subtle",
            size: "sm",
            onClick: () => toast.success(`فتح محرر صلاحيات الدور: ${r.name}`),
          }),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}
