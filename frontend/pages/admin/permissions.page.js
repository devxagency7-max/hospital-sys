/**
 * كتالوج الصلاحيات.
 *
 * استعراض كتالوج صلاحيات النظام مُجمَّعة حسب النطاقات الوظيفية (المحاسبة، المالية، HR، المخازن، الإدارة).
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { getPermissionCatalog } from "../../js/api/admin.api.js";

export default async function permissionsPage() {
  const catalog = await getPermissionCatalog();
  const groups = Array.isArray(catalog) ? catalog : [];
  let totalPerms = 0;
  groups.forEach((g) => {
    totalPerms += g.permissions?.length ?? 0;
  });

  const container = el("div", { class: "page-container page-permissions", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "كتالوج الصلاحيات"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "الدليل المرجعي لكافة الصلاحيات الدقيقة المعرفة في النظام ومطابقتها للشاشات.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "إدارة الأدوار",
        variant: "secondary",
        icon: "shield",
        onClick: () => navigate("/admin/roles"),
      }),
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
      label: "إجمالي الصلاحيات الدقيقة",
      value: integer(totalPerms),
      hint: "مفتاح صلاحية مفصل",
      trend: "positive",
    }),
    statTile({
      label: "النطاقات الوظيفية الرئيسية",
      value: integer(groups.length),
      hint: "موديولات النظام",
    }),
    statTile({
      label: "نموذج الأمان",
      value: "RBAC (دور وصلاحية)",
      hint: "فحص مسبق في الراوتر والمكونات",
    })
  );

  // شريط البحث
  const searchInput = el("input", {
    type: "search",
    placeholder: "بحث في الصلاحيات بالاسم أو المفتاح (مثل: gl.view أو فواتير)…",
    class: "form-input",
    style: "width: 100%; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--bg-surface); margin-bottom: 1.5rem; font-size: 0.9375rem;",
  });

  const listHost = el("div", {
    style: "display: flex; flex-direction: column; gap: 1.25rem;",
  });

  function renderGroups(filter = "") {
    clear(listHost);
    const q = filter.trim().toLowerCase();

    groups.forEach((g) => {
      const filteredPerms = (g.permissions ?? []).filter(
        (p) => !q || p.key.toLowerCase().includes(q) || (p.label ?? "").toLowerCase().includes(q)
      );

      if (!filteredPerms.length) return;

      const groupCard = el(
        "div",
        {
          class: "surface-card",
          style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.25rem;",
        },
        el(
          "div",
          { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" },
          el(
            "div",
            { style: "display: flex; align-items: center; gap: 0.5rem;" },
            el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin: 0; color: var(--text-primary);" }, g.label),
            el("span", { class: "ltr-isolate", style: "font-family: monospace; font-size: 0.8125rem; color: var(--text-muted);" }, `(${g.domain})`)
          ),
          badge(`${filteredPerms.length} صلاحية`, { variant: "info" })
        )
      );

      const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
      const tbody = el("tbody", null);

      filteredPerms.forEach((p) => {
        const tr = el(
          "tr",
          { style: "border-bottom: 1px solid var(--border-color);" },
          el(
            "td",
            { style: "padding: 0.625rem 0.75rem; font-family: monospace; font-size: 0.84375rem; width: 35%; color: var(--primary);" },
            el("span", { class: "ltr-isolate" }, p.key)
          ),
          el("td", { style: "padding: 0.625rem 0.75rem; font-size: 0.875rem; font-weight: 500;" }, p.label)
        );
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      groupCard.appendChild(table);
      listHost.appendChild(groupCard);
    });
  }

  searchInput.addEventListener("input", (e) => {
    renderGroups(e.target.value);
  });

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(searchInput);
  container.appendChild(listHost);

  renderGroups();

  return container;
}
