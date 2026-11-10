/**
 * الأدوار والصلاحيات.
 *
 * إدارة مصفوفة الأدوار الوظيفية والصلاحيات الممنوحة لكل دور داخل المنظومة.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { listRoles, getPermissionCatalog } from "../../js/api/admin.api.js";

export default async function rolesPage() {
  const [rolesRes, catalog] = await Promise.all([
    listRoles(),
    getPermissionCatalog(),
  ]);

  const roles = rolesRes.data ?? [];

  const container = el("div", { class: "page-container page-roles", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "الأدوار ومجموعات الصلاحيات"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تحديد الأدوار الوظيفية (مدير مالي، محاسب، أمين مخزن، مدير HR) وضبط مصفوفة الصلاحيات.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "المستخدمون",
        variant: "ghost",
        icon: "users",
        onClick: () => navigate("/admin/users"),
      })
    )
  );

  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "إجمالي الأدوار المعرفة",
      value: integer(roles.length),
      hint: "أدوار قياسية وتشغيلية",
    }),
    statTile({
      label: "إجمالي الصلاحيات في النظام",
      value: integer(Array.isArray(catalog) ? catalog.length : Object.keys(catalog ?? {}).length),
      hint: "صلاحيات دقيقة (RBAC)",
      trend: "positive",
    }),
    statTile({
      label: "مستوى الأمان والتحكم",
      value: "عالي (Enterprise)",
      hint: "مراقبة الصلاحيات والتدقيق",
    })
  );

  const grid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;",
  });

  roles.forEach((role) => {
    const perms = role.permissions ?? [];
    const isAll = perms.includes("*");

    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;",
      },
      el(
        "div",
        null,
        el(
          "div",
          { style: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;" },
          el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin: 0; color: var(--text-primary);" }, role.name ?? role.title),
          badge(isAll ? "صلاحيات كاملة" : `${perms.length} صلاحية`, { variant: isAll ? "danger" : "info" })
        ),
        el("p", { style: "font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 1rem;" }, role.description ?? "دور وظيفي قياسي في النظام."),
        el(
          "div",
          { style: "display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 1rem;" },
          ...(isAll
            ? [badge("كافة الصلاحيات (*)", { variant: "success" })]
            : perms.slice(0, 6).map((p) => badge(p, { variant: "neutral" })))
        )
      ),
      el(
        "div",
        { style: "border-top: 1px solid var(--border-color); padding-top: 0.75rem; font-size: 0.8125rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;" },
        el("span", null, `المعرف: ${role.key ?? role.id}`),
        badge(role.status === "active" ? "نشط" : "معطل", { variant: "success" })
      )
    );
    grid.appendChild(card);
  });

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(grid);

  return container;
}
