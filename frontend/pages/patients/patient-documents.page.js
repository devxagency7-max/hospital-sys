/**
 * مستندات المرضى والملفات المرفقة (Patient Documents)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { icon } from "../../components/common/icon.js";
import { badge } from "../../components/common/badge.js";
import { toast } from "../../components/feedback/toast.js";

export default function patientDocumentsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "الأرشيف الرقمي ومستندات المرضى",
    description: "التقارير الطبية، بطاقات التأمين، الموافقات المسبقة، وإقرارات العمليات الجراحية الممسوحة ضوئيًا.",
    actions: [
      button({
        label: "رفع مستند جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => toast.info("اختر ملف المريض لرفع مستند بصيغة PDF أو صورة"),
      }),
    ],
  });
  container.appendChild(header);

  const mockDocs = [
    { title: "إقرار وموافقة على عملية جراحية", patient: "محمود عادل السيد", date: "2026-10-04", type: "PDF", size: "1.4 MB", dept: "الجراحة العامة" },
    { title: "صورة بطاقة التأمين الصحي الشامل", patient: "فاطمة إبراهيم خليل", date: "2026-10-02", type: "JPG", size: "850 KB", dept: "الاستقبال" },
    { title: "تقرير خروج واستشفاء - رعاية مركزة", patient: "كمال حسن الشامي", date: "2026-09-28", type: "PDF", size: "2.1 MB", dept: "الرعاية المركزة" },
    { title: "موافقة مسبقة على صرف أدوية مزمنة", patient: "منى عبد العزيز بدر", date: "2026-09-25", type: "PDF", size: "920 KB", dept: "التأمين الطبي" },
  ];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
    ...mockDocs.map((doc) =>
      card({
        title: doc.title,
        subtitle: doc.patient,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge(doc.type, { tone: doc.type === "PDF" ? "danger" : "info", size: "sm" }),
            el("span", { class: "text-muted font-mono" }, doc.size),
          ),
          el("div", { class: "text-muted" }, `القسم: ${doc.dept}`),
          el("div", { class: "text-muted text-[11px]" }, `تاريخ الرفع: ${doc.date}`),
        ),
        footer: el(
          "div",
          { class: "flex justify-between items-center" },
          button({
            label: "معاينة الملف",
            variant: "subtle",
            size: "sm",
            onClick: () => toast.success(`فتح مستند: ${doc.title}`),
          }),
          button({
            label: "تحميل",
            variant: "ghost",
            size: "sm",
            onClick: () => toast.info("بدء تنزيل الملف"),
          }),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}
