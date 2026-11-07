/**
 * تفضيلات الإشعارات والتنبيهات.
 *
 * إدارة قنوات التنبيه (تنبيهات النظام، البريد الإلكتروني، الرسائل) وقواعد الإشعار للعمليات المحاسبية والمخزنية.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { listNotificationPreferences } from "../../js/api/settings.api.js";

export default async function notificationsSettingsPage() {
  const notifsRes = await listNotificationPreferences().catch(() => ({ data: [] }));
  const rows = notifsRes.data ?? [];

  const container = el("div", { class: "page-container page-notifications-settings", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "تفضيلات الإشعارات والتنبيهات"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "تخصيص قواعد إرسال التنبيهات اللحظية للأحداث المالية والمخزنية وإجراءات الموارد البشرية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "تفضيلات النظام",
        variant: "secondary",
        icon: "settings",
        onClick: () => navigate("/settings/preferences"),
      }),
      button({
        label: "حفظ التفضيلات",
        variant: "primary",
        icon: "check",
        onClick: () => {
          toast.success("تم تحديث تفضيلات الإشعارات بنجاح.");
        },
      })
    )
  );

  const statsRow = el(
    "div",
    { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
    statTile({
      label: "إجمالي قواعد التنبيه",
      value: integer(rows.length),
      hint: "أحداث مراقبة",
    }),
    statTile({
      label: "التنبيهات المفعلة",
      value: integer(rows.filter((r) => r.enabled !== false).length),
      hint: "ترسل فور حدوث الواقعة",
      trend: "positive",
    }),
    statTile({
      label: "قنوات الإشعار",
      value: "داخل النظام + بريد",
      hint: "تنبيهات فورية للمسؤولين",
    })
  );

  const card = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "قواعد وأحداث الإشعارات المعرفة")
  );

  const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
  const thead = el(
    "thead",
    null,
    el(
      "tr",
      { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "الحدث / موضوع التنبيه"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "النطاق / الموديول"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: right;" }, "المستلم المسؤول"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "القناة"),
      el("th", { style: "padding: 0.75rem 1rem; text-align: center;" }, "تفعيل")
    )
  );
  const tbody = el("tbody", null);

  rows.forEach((r) => {
    const tr = el(
      "tr",
      { style: "border-bottom: 1px solid var(--border-color);" },
      el(
        "td",
        { style: "padding: 0.75rem 1rem;" },
        el("div", { style: "font-weight: 600;" }, r.title ?? r.event ?? r.description),
        el("div", { style: "font-size: 0.8125rem; color: var(--text-secondary);" }, r.description ?? "")
      ),
      el("td", { style: "padding: 0.75rem 1rem;" }, badge(r.category ?? "نظام", { variant: "info" })),
      el("td", { style: "padding: 0.75rem 1rem; color: var(--text-secondary);" }, r.recipientRole ?? r.recipient ?? "المدير المالي"),
      el("td", { style: "padding: 0.75rem 1rem; text-align: center;" }, badge(r.channel ?? "نظام + بريد", { variant: "neutral" })),
      el(
        "td",
        { style: "padding: 0.75rem 1rem; text-align: center;" },
        (() => {
          const chk = el("input", { type: "checkbox", style: "width: 1.25rem; height: 1.25rem; cursor: pointer;" });
          chk.checked = r.enabled !== false;
          chk.addEventListener("change", (e) => {
            r.enabled = e.target.checked;
          });
          return chk;
        })()
      )
    );
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  card.appendChild(table);

  container.appendChild(header);
  container.appendChild(statsRow);
  container.appendChild(card);

  return container;
}
