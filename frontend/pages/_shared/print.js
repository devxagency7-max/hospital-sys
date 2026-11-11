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
import { HOSPITAL_LOGO_BASE64 } from "../../js/core/logo-base64.js";

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
        label: "طباعة (PDF)",
        variant: "primary",
        icon: "print",
        onClick: () => window.print(),
      }),
      button({
        label: "تصدير شيت Excel منسق",
        variant: "secondary",
        icon: "download",
        onClick: () => exportStyledExcel({ title, headers, rows, totals, company, period }),
      }),
      button({
        label: "تنزيل CSV خام",
        variant: "ghost",
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
   التصدير المنسق لشيتات Excel والـ CSV
   ========================================================================== */

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  const str = String(unsafe);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * تصدير شيت Excel احترافي ومنسق بالكامل:
 * - شعار المستشفى المعتمد (Base64).
 * - اسم المستشفى والسجل والبطاقة الضريبية وتاريخ ووقت التصدير واسم الشيت.
 * - خلفية بيضاء نقية تماماً للترويسة العلوية بدون خطوط شبكة Excel خلف الشعار والبيانات.
 * - هيدر الجداول بلون أزرق ملكي أنيق (#1e40af) ونص أبيض ناصع عريض.
 * - صفوف البيانات متبادلة الألوان (Zebra Striping) بتدريجات الأبيض النقي (#ffffff) والأبيض الثلجي (#f8fafc).
 * - تنسيق أرقام العملات والتواريخ ومحاذاة اليمين للنصوص واليسار للأرقام.
 */
export function exportStyledExcel({
  title = "تقرير",
  headers = [],
  rows = [],
  totals = null,
  company = {
    name: "مستشفى أمان الحياة",
    legalForm: "شركة مساهمة مصرية — منشأة طبية خاصة",
    commercialRegister: "128470",
    taxId: "204-851-963",
  },
  period = null,
}) {
  if (!rows?.length) {
    toast.warning("لا توجد بيانات متاحة للتصدير إلى Excel.");
    return;
  }

  const exportDate = dateTime(new Date().toISOString());
  const user = currentUser()?.name ?? "إدارة المستشفى";
  const colCount = Math.max(headers.length, 3);

  // حساب تقسيم الأعمدة للترويسة العلوية لتمتد على كامل عرض الشيت
  let centerCols = Math.max(1, Math.round(colCount * 0.28));
  const rem = colCount - centerCols;
  let rightCols = Math.ceil(rem / 2);
  let leftCols = colCount - centerCols - rightCols;
  if (leftCols < 1 && colCount >= 3) {
    leftCols = 1;
    rightCols = Math.max(1, colCount - centerCols - leftCols);
  }

  const escapeXml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const rawBase64 = HOSPITAL_LOGO_BASE64.replace(/^data:image\/[^;]+;base64,/, "");
  const wrappedBase64 = rawBase64.match(/.{1,76}/g).join("\r\n");
  const boundary = "----=_NextBoundary_Hospital_2026";

  const excelHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>${escapeXml(title).slice(0, 31)}</x:Name>
          <x:WorksheetOptions>
            <x:DisplayRightToLeft/>
            <x:DoNotDisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #ffffff;
    }
    table {
      border-collapse: collapse;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      text-align: right;
      width: 100%;
    }
  </style>
</head>
<body dir="rtl">
  <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
    <!-- 1. هامش علوي أبيض مفرغ بدون خطوط شبكة -->
    <tr style="height: 14px; background-color: #ffffff;">
      <td colspan="${colCount}" style="border: none; background-color: #ffffff; height: 14px;"></td>
    </tr>

    <!-- 2. الترويسة الرئيسية ممتدة عبر كامل أعمدة الشيت بدون جداول متداخلة وبدون خطوط شبكة -->
    <tr style="height: 85px; background-color: #ffffff;">
      <!-- اليمين: اسم المنشأة الطبية وبياناتها القانونية والضريبية -->
      <td colspan="${rightCols}" style="border: none; background-color: #ffffff; text-align: right; vertical-align: middle; padding: 10px 16px;">
        <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 17pt; font-weight: bold; color: #1e3a8a; line-height: 1.3;">
          ${escapeXml(company.name || "مستشفى أمان الحياة")}
        </div>
        <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 9.5pt; color: #475569; margin-top: 3px;">
          ${escapeXml(company.legalForm || "شركة مساهمة مصرية — منشأة طبية خاصة")}
        </div>
        <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 8.5pt; color: #94a3b8; margin-top: 2px;">
          س.ت: ${escapeXml(company.commercialRegister || "128470")} · ب.ض: ${escapeXml(company.taxId || "204-851-963")}
        </div>
      </td>

      <!-- المنتصف: شعار مستشفى أمان الحياة بدقة عالية ومضمّن داخل الملف -->
      <td colspan="${centerCols}" style="border: none; background-color: #ffffff; text-align: center; vertical-align: middle; padding: 6px 10px;">
        <img src="cid:logo.png@excel.export" width="70" height="70" alt="لوجو مستشفى أمان الحياة" style="border: none; vertical-align: middle;" />
      </td>

      <!-- اليسار: تاريخ وتوقيت التصدير والمُعِد والفترة وعدد السجلات -->
      ${
        leftCols > 0
          ? `
      <td colspan="${leftCols}" style="border: none; background-color: #ffffff; text-align: left; vertical-align: middle; padding: 10px 16px; font-size: 9pt; color: #475569; line-height: 1.5;">
        <div>تاريخ التصدير: <strong style="color: #0f172a;">${escapeXml(exportDate)}</strong></div>
        <div>المُعِد / المسؤول: <strong style="color: #0f172a;">${escapeXml(user)}</strong></div>
        ${period ? `<div>الفترة: ${escapeXml(period)}</div>` : ""}
        <div>عدد السجلات: <strong style="color: #0284c7;">${rows.length} سجل</strong></div>
      </td>`
          : ""
      }
    </tr>

    <!-- 3. شريط عنوان التقرير البارز ممتد بعرض الشيت بالكامل -->
    <tr style="height: 38px; background-color: #eff6ff;">
      <td colspan="${colCount}" style="border-top: 1px solid #bfdbfe; border-bottom: 2px solid #1e40af; border-left: none; border-right: none; background-color: #eff6ff; text-align: center; vertical-align: middle; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13.5pt; font-weight: bold; color: #1e40af; padding: 6px 12px; height: 38px;">
        تقرير: ${escapeXml(title)}
      </td>
    </tr>

    <!-- 4. فاصل أبيض ناصع مفرغ قبل الجدول -->
    <tr style="height: 12px; background-color: #ffffff;">
      <td colspan="${colCount}" style="border: none; background-color: #ffffff; height: 12px;"></td>
    </tr>

    <!-- 5. عناوين الأعمدة (هيدر الجدول أزرق كحلي ملكي فخم بنص أبيض عريض) -->
    <tr style="height: 36px; background-color: #1e40af; color: #ffffff;">
      ${headers
        .map(
          (h) => `
        <th style="
          background-color: #1e40af;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          font-size: 10.5pt;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
          border: 1px solid #172554;
          padding: 10px 12px;
        ">
          ${escapeXml(h.label ?? h)}
        </th>`,
        )
        .join("")}
    </tr>

    <!-- 6. صفوف البيانات بتدريجات الأبيض النقي والأبيض الثلجي الناعم (Zebra Striping) -->
    ${rows
      .map((row, rIdx) => {
        const isEven = rIdx % 2 === 1;
        const rowBg = isEven ? "#f8fafc" : "#ffffff";
        return `
        <tr style="height: 28px; background-color: ${rowBg};">
          ${row
            .map((cellVal, cIdx) => {
              const raw =
                cellVal && typeof cellVal === "object" && cellVal.value !== undefined
                  ? cellVal.value
                  : cellVal;
              const text = raw instanceof Node ? (raw.textContent ?? "") : String(raw ?? "");
              const isNum =
                !isNaN(Number(text.replace(/[, ج.م]/g, "").trim())) &&
                text.trim() !== "" &&
                (text.includes(".") || !isNaN(Number(text)));
              const align = isNum ? "left" : cIdx === 0 ? "right" : "center";
              const msoFormat = isNum
                ? 'mso-number-format: "\\#\\,\\#\\#0\\.00";'
                : 'mso-number-format: "\\@";';
              return `
              <td style="
                background-color: ${rowBg};
                color: #0f172a;
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                font-size: 10pt;
                text-align: ${align};
                vertical-align: middle;
                border: 1px solid #e2e8f0;
                padding: 6px 10px;
                ${msoFormat}
              ">
                ${escapeXml(text)}
              </td>`;
            })
            .join("")}
        </tr>`;
      })
      .join("")}

    <!-- 7. صف المجاميع الإجمالية إن وُجد -->
    ${
      totals
        ? `
      <tr style="height: 34px; background-color: #e0f2fe; font-weight: bold;">
        ${totals
          .map((t, idx) => {
            const text = t && typeof t === "object" && t.value !== undefined ? t.value : String(t ?? "");
            return `
            <td style="
              background-color: #e0f2fe;
              color: #0369a1;
              font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
              font-size: 10.5pt;
              font-weight: bold;
              text-align: ${idx === 0 ? "right" : "left"};
              vertical-align: middle;
              border-top: 2px solid #1e40af;
              border-bottom: 3px double #1e40af;
              border-left: 1px solid #bfdbfe;
              border-right: 1px solid #bfdbfe;
              padding: 8px 10px;
            ">
              ${escapeXml(text)}
            </td>`;
          })
          .join("")}
      </tr>`
        : ""
    }

    <!-- 8. فاصل وتوقيعات الاعتماد الرسمية بدون خطوط شبكة -->
    <tr style="height: 20px; background-color: #ffffff;">
      <td colspan="${colCount}" style="border: none; background-color: #ffffff; height: 20px;"></td>
    </tr>
    <tr style="background-color: #ffffff;">
      <td colspan="${colCount}" style="background-color: #ffffff; border: none; border-top: 1px dashed #cbd5e1; padding: 16px 12px;">
        <table border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; border: none; font-size: 9.5pt; color: #475569;">
          <tr>
            <td style="border: none; text-align: right; width: 33%;">
              <strong>المُعِد / المسؤول:</strong> ________________________
            </td>
            <td style="border: none; text-align: center; width: 33%;">
              <strong>المراجعة والتدقيق:</strong> ________________________
            </td>
            <td style="border: none; text-align: left; width: 33%;">
              <strong>الاعتماد المالي:</strong> ________________________
            </td>
          </tr>
          <tr>
            <td colspan="3" style="border: none; text-align: center; font-size: 8pt; color: #94a3b8; padding-top: 16px;">
              نظام الإدارة المالية لمستشفى أمان الحياة — تم تصدير هذا المستند آلياً وهو معتمد وموثق
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const mhtmlPayload = `MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${boundary}"

--${boundary}
Content-Type: image/png; name="hospital_logo.png"
Content-Transfer-Encoding: base64
Content-ID: <logo.png@excel.export>
Content-Location: hospital_logo.png

${wrappedBase64}
--${boundary}
Content-Type: text/html; charset="utf-8"

${excelHtml}
--${boundary}--
`;

  const blob = new Blob([mhtmlPayload], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const cleanName = String(title ?? "تقرير")
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_");
  const link = el("a", {
    href: url,
    download: `مستشفى_أمان_الحياة_${cleanName}_${formatDate(new Date().toISOString())}.xls`,
  });

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  toast.success(`تم تصدير ${rows.length} صف إلى شيت Excel منسق بنجاح.`);
}

/**
 * تصدير الصفوف كملف CSV خام مع علامة BOM.
 */
export function exportCsv({ title, headers, rows, totals }) {
  if (!rows?.length) {
    toast.warning("لا بيانات للتصدير.");
    return;
  }

  const cell = (raw) => {
    const node = raw && typeof raw === "object" && raw.value !== undefined ? raw.value : raw;
    const text = node instanceof Node ? (node.textContent ?? "") : String(node ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.map((header) => cell(header.label ?? header)).join(","),
    ...rows.map((row) => row.map(cell).join(",")),
    ...(totals ? [totals.map(cell).join(",")] : []),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
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

export const num = (value) => ({ value: String(value ?? ""), class: "tabular" });
export const bold = (value) => ({ value: String(value ?? ""), bold: true });

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
 * تصدير بيانات أي جدول كشيت Excel منسق بالكامل (شعار المستشفى، هيدر أزرق، تدريجات بيضاء للصفوف).
 */
export function exportTableToExcel({ title = "تقرير", columns, rows, subtitle, period, totals }) {
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

  exportStyledExcel({
    title,
    headers,
    rows: formattedRows,
    totals,
    period: period || `تاريخ الإصدار: ${formatDate(new Date().toISOString())}`,
  });
}

/** توافقية الاسم القديم: يوجه تلقائياً إلى التصدير المنسق */
export function exportTableToCsv(options) {
  exportTableToExcel(options);
}


