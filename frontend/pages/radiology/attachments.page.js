/**
 * أرشيف ومرفقات صور الأشعة وDICOM (Radiology PACS Attachments)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { toast } from "../../components/feedback/toast.js";

export default function radiologyAttachmentsPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "مرفقات وصور الأشعة الرقمية (PACS / DICOM)",
    description: "استعراض أفلام الأشعة الرقمية وصور الرنين المقطعية ومشاركتها مع الأطباء الاستشاريين.",
  });
  container.appendChild(header);

  const mockFiles = [
    { title: "سلسلة صور مقطعية متعددة (DICOM Series)", patient: "يوسف شريف الديب", scan: "CT Abdomen", slices: "128 مقطع", size: "48 MB", date: "2026-10-05" },
    { title: "صورة أشعة سينية رقمية عالية الدقة", patient: "سارة محمود حسن", scan: "Chest X-Ray PA", slices: "صورة واحدة", size: "12 MB", date: "2026-10-04" },
    { title: "مقاطع الرنين المغناطيسي T1 / T2", patient: "إبراهيم خالد الجندي", scan: "MRI Brain", slices: "64 مقطع", size: "82 MB", date: "2026-10-03" },
    { title: "تسجيل فيديو إيكو ملون للقلب (Doppler)", patient: "فاطمة أحمد السعيد", scan: "Echo Doppler", slices: "مقطع فيديو", size: "24 MB", date: "2026-10-02" },
  ];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" },
    ...mockFiles.map((f) =>
      card({
        title: f.title,
        subtitle: f.patient,
        body: el(
          "div",
          { class: "space-y-2 text-xs" },
          el(
            "div",
            { class: "flex justify-between items-center" },
            badge(f.scan, { tone: "info", size: "sm" }),
            el("span", { class: "font-mono text-muted text-[11px]" }, f.size),
          ),
          el("div", { class: "text-muted" }, `عدد المقاطع: ${f.slices}`),
          el("div", { class: "text-muted text-[11px]" }, `تاريخ التصوير: ${f.date}`),
        ),
        footer: el(
          "div",
          { class: "flex justify-between" },
          button({
            label: "معاينة DICOM",
            variant: "subtle",
            size: "sm",
            onClick: () => toast.success(`فتح عارض الأشعة PACS لـ ${f.patient}`),
          }),
          button({
            label: "تحميل",
            variant: "ghost",
            size: "sm",
            onClick: () => toast.info("جارٍ تحميل حزمة الصور"),
          }),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}
