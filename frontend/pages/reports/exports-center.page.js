/**
 * مركز تصدير البيانات والأرشفة (Exports Center)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { toast } from "../../components/feedback/toast.js";

export default function exportsCenterPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "مركز تصدير البيانات والجداول",
    description: "تنزيل تقارير وقواعد بيانات المرضى والفواتير والمخزون بصيغ Excel (XLSX)، CSV، وPDF.",
  });
  container.appendChild(header);

  const exportJobs = [
    { title: "قاعدة بيانات المرضى الكاملة", format: "Excel (XLSX)", rows: "1,420 سجل", date: "2026-10-06 09:00" },
    { title: "سجل الفواتير والمدفوعات الشهري", format: "Excel (XLSX)", rows: "450 فاتورة", date: "2026-10-06 08:30" },
    { title: "كشف جرد وأرصدة المخزون السلعي", format: "CSV", rows: "320 صنف", date: "2026-10-05 18:00" },
    { title: "ميزان المراجعة والقوائم المالية", format: "PDF", rows: "45 حساب", date: "2026-10-05 16:30" },
  ];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
    ...exportJobs.map((j) =>
      card({
        title: j.title,
        subtitle: `عدد السجلات: ${j.rows}`,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge(j.format, { tone: j.format.includes("Excel") ? "success" : j.format === "PDF" ? "danger" : "info" }),
            el("span", { class: "text-muted" }, j.date),
          ),
        ),
        footer: el(
          "div",
          { class: "flex justify-end" },
          button({
            label: "تنزيل الملف الآن 📥",
            variant: "subtle",
            size: "sm",
            onClick: () => toast.success(`بدء تنزيل ملف ${j.title}`),
          }),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}
