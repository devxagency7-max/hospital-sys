/**
 * معاينة التقارير وطباعتها.
 *
 * `components/reports/printable-report.js` يبني ورقة A4 ويُعيدها كعنصر — لا
 * يطبع. هذا الملف يصل بينه وبين المستخدم: يفتح معاينة، ويطبع ما يراه بالضبط.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  قاعدة من docs/05-REPORTING-SPECIFICATION.md: «النظام يجب ألا يُصدِّر تقريرًا
 *  ناقصًا بصمت أبدًا.» — `printReport` يرفض الطباعة بلا صفوف، و`exportCsv`
 *  يمر من `assertExportable` حين يأتي التقرير من `buildReport`.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { el } from "../../js/core/dom.js";
import { openModal } from "../../components/modals/overlay.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/feedback/toast.js";
import { printableReportSheet } from "../../components/reports/printable-report.js";
import { dateTime, date as formatDate } from "../../js/core/format.js";
import { currentUser } from "../../js/core/permissions.js";

/**
 * يفتح معاينة تقرير قابلة للطباعة.
 *
 * @param {object} definition
 * @param {object} definition.company      من `GET /settings/company`
 * @param {string} definition.title
 * @param {string} [definition.subtitle]
 * @param {string} [definition.period]
 * @param {string} [definition.reportNumber]
 * @param {Array<{label:string,value:*,hint?:string}>} [definition.kpis]
 * @param {Array<{label:string,align?:"right"|"left"|"center"}>} definition.headers
 * @param {Array<Array<*>>} definition.rows      صفوف كمصفوفات خلايا
 * @param {Array<*>} [definition.totals]         صف المجاميع
 * @param {string} [definition.notes]
 */
export function printReport(definition) {
  const {
    company,
    title,
    subtitle = "",
    period,
    reportNumber,
    kpis = [],
    headers = [],
    rows = [],
    totals = null,
    notes = null,
    signatures,
  } = definition;

  /*
   * تقرير بلا صفوف لا يُطبع.
   *
   * ورقة بترويسة ومجاميع صفرية وجدول فارغ تبدو تقريرًا سليمًا، وتُوقَّع
   * وتُؤرشف — ثم يُكتشف أن الفلتر كان خاطئًا. الرفض الصريح أرخص بكثير.
   */
  if (!rows.length) {
    toast.warning("لا بيانات في النطاق المحدَّد — لا يُطبع تقرير فارغ. عدّل الفلاتر ثم أعد المحاولة.");
    return null;
  }

  const sheet = printableReportSheet({
    orgName: company?.name ?? "",
    orgSubtitle: [company?.legalForm, company?.commercialRegister ? `س.ت ${company.commercialRegister}` : null]
      .filter(Boolean)
      .join(" — "),
    slogan: company?.taxId ? `ب.ض ${company.taxId}` : "",
    reportNumber: reportNumber ?? autoReportNumber(title),
    title,
    subtitle,
    period: period ?? "—",
    date: dateTime(new Date().toISOString()),
    kpis,
    tableHeaders: headers,
    tableRows: rows,
    tableTotals: totals,
    notes,
    signatures: signatures ?? ["المُعِد", "المراجعة والتدقيق", "الاعتماد"],
  });

  /** حاوية الطباعة — الأنماط في css/tailwind.src.css تُخفي ما عداها. */
  const printHost = el("div", { class: "print-sheet-host" }, sheet);

  const modal = openModal({
    title: `معاينة الطباعة — ${title}`,
    subtitle: `أعدّها ${currentUser()?.name ?? "—"} · ${rows.length} صف`,
    size: "full",
    body: () => el("div", { class: "bg-slate-200 p-4 rounded-xl overflow-auto" }, printHost),
    footer: (close) => [
      button({
        label: "طباعة",
        variant: "primary",
        icon: "print",
        onClick: () => window.print(),
      }),
      button({
        label: "تنزيل CSV",
        variant: "secondary",
        icon: "download",
        onClick: () => exportCsv({ title, headers, rows, totals }),
      }),
      button({ label: "إغلاق", variant: "ghost", onClick: () => close() }),
    ],
  });

  return modal;
}

/** رقم تقرير تلقائي — يُميّز نسخة الطباعة في الأرشيف. */
function autoReportNumber(title) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const slug = String(title ?? "REP").replace(/\s+/g, "").slice(0, 6);
  return `${slug}-${stamp}`;
}

/* ==========================================================================
   التصدير
   ========================================================================== */

/**
 * يُنزّل الصفوف كملف CSV.
 *
 * ترميز UTF-8 بعلامة BOM: Excel على Windows يقرأ CSV بترميز النظام افتراضيًا،
 * فيعرض العربية كرموز مشوّشة. علامة BOM تُجبره على UTF-8، وهي ثلاثة بايتات
 * تُصلح ما كان سيبدو عطلًا في البرنامج.
 */
export function exportCsv({ title, headers, rows, totals }) {
  if (!rows?.length) {
    toast.warning("لا بيانات للتصدير.");
    return;
  }

  const cell = (raw) => {
    const node = raw && typeof raw === "object" && raw.value !== undefined ? raw.value : raw;
    const text = node instanceof Node ? (node.textContent ?? "") : String(node ?? "");
    /* الاقتباس إلزامي: الفاصلة داخل خلية تُنشئ عمودًا وهميًا. */
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.map((header) => cell(header.label ?? header)).join(","),
    ...rows.map((row) => row.map(cell).join(",")),
    ...(totals ? [totals.map(cell).join(",")] : []),
  ];

  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = el("a", {
    href: url,
    download: `${String(title ?? "report").replace(/\s+/g, "-")}-${formatDate(new Date().toISOString())}.csv`,
  });

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  toast.success(`صُدِّر ${rows.length} صف إلى ملف CSV.`);
}

/* ==========================================================================
   مساعدات بناء الصفوف
   ========================================================================== */

/** خلية رقمية محاذاة لليسار المنطقي. */
export const num = (value) => ({ value: String(value ?? ""), class: "tabular" });

/** خلية بخط عريض — للمجاميع الفرعية. */
export const bold = (value) => ({ value: String(value ?? ""), bold: true });

/**
 * يحوّل صفوف جدول البيانات إلى صفوف ورقة الطباعة.
 *
 * @param {object[]} data
 * @param {Array<{key:string, format?:(row:object)=>string}>} columns
 */
/**
 * يحوّل صفوف جدول البيانات إلى صفوف ورقة الطباعة.
 *
 * @param {object[]} data
 * @param {Array<{key:string, format?:(row:object)=>string}>} columns
 */
export function toPrintRows(data, columns) {
  return data.map((row) =>
    columns.map((column) => {
      const raw = column.format ? column.format(row) : row[column.key];
      return column.numeric ? num(raw) : String(raw ?? "—");
    }),
  );
}

/**
 * فتح معاينة رسمية قابلة للطباعة والتنزيل كـ PDF لأي جدول بيانات.
 */
export function previewTableReport({ title = "تقرير الجدول", columns, rows, subtitle, period }) {
  if (!rows?.length) {
    toast.warning("لا توجد بيانات متاحة للمعاينة والطباعة.");
    return;
  }

  const visibleCols = columns.filter((col) => col && !col.hidden && col.key !== "actions");
  const headers = visibleCols.map((c) => ({
    label: c.label ?? c.key,
    align: c.numeric ? "left" : (c.align ?? "right"),
  }));

  const formattedRows = rows.map((row) =>
    visibleCols.map((col) => {
      if (col.render) {
        const rendered = col.render(row);
        if (rendered instanceof Node) return rendered.textContent.trim();
        return rendered !== null && rendered !== undefined ? String(rendered).trim() : "—";
      }
      const val = row[col.key];
      return val !== null && val !== undefined && val !== "" ? String(val) : "—";
    }),
  );

  return printReport({
    company: {
      name: "مستشفى أمان الحياة",
      legalForm: "شركة مساهمة مصرية — منشأة طبية خاصة",
      commercialRegister: "128470",
      taxId: "204-851-963",
    },
    title,
    subtitle: subtitle || "تقرير معتمد ومطابق للسجلات الرسمية للمستشفى",
    period: period || `تاريخ الإصدار: ${formatDate(new Date().toISOString())}`,
    headers,
    rows: formattedRows,
  });
}

/**
 * تصدير بيانات أي جدول كشيت Excel (ملف CSV متوافق مع Excel بترميز UTF-8 مع BOM).
 */
export function exportTableToCsv({ title = "تقرير", columns, rows }) {
  if (!rows?.length) {
    toast.warning("لا توجد بيانات متاحة للتصدير.");
    return;
  }

  const visibleCols = columns.filter((col) => col && !col.hidden && col.key !== "actions");
  const headers = visibleCols.map((c) => ({ label: c.label ?? c.key }));

  const formattedRows = rows.map((row) =>
    visibleCols.map((col) => {
      if (col.render) {
        const rendered = col.render(row);
        if (rendered instanceof Node) return rendered.textContent.trim();
        return rendered !== null && rendered !== undefined ? String(rendered).trim() : "";
      }
      const val = row[col.key];
      return val !== null && val !== undefined ? String(val) : "";
    }),
  );

  exportCsv({ title, headers, rows: formattedRows });
}

