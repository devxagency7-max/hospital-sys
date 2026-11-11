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

  function formatExportDate(d = new Date()) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "م" : "ص";
    hours = hours % 12 || 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${day}/${month}/${year} — ${hoursStr}:${minutes} ${ampm}`;
  }

  const exportDate = formatExportDate(new Date());
  const user = currentUser()?.name ?? "إدارة المستشفى";
  const colCount = Math.max(headers.length, 3);

  // حساب تقسيم الأعمدة المتناسق للترويسة العلوية لتمتد بانسجام كامل عبر عرض الشيت ويكون اللوجو في المنتصف تماماً
  let centerCols = 2;
  if (colCount >= 7) centerCols = 3;
  if (colCount >= 10) centerCols = 4;
  const rem = colCount - centerCols;
  const rightCols = Math.ceil(rem / 2);
  const leftCols = colCount - centerCols - rightCols;

  // تنظيف نص الفترة وحذف أي تكرار لتاريخ التصدير
  let cleanPeriod = period ? String(period).trim() : null;
  if (cleanPeriod) {
    cleanPeriod = cleanPeriod
      .replace(/تاريخ\s+(التصدير|الإصدار)\s*:\s*[^\s·•\n\r,]+\s*[,،]?\s*[^\s·•\n\r]*\s*[·•-]?\s*/gi, "")
      .replace(/^[\s·•-]+|[\s·•-]+$/g, "")
      .trim();
    if (!cleanPeriod) cleanPeriod = null;
  }

  const escapeXml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const colWidths = headers.map((h) => {
    const label = String(h?.label ?? h ?? "");
    if (/بيان|خدمة|إجراء|وصف|اسم|تفاصيل|ملاحظات|مريض|صنف|جهة|عميل|مورد|موظف/.test(label)) return 300;
    if (/قسم|إدارة|وظيفة|مركز|جهة/.test(label)) return 160;
    if (/فاتورة|سند|كود|مرجع|رقم/.test(label)) return 140;
    if (/تاريخ|وقت|استحقاق/.test(label)) return 125;
    if (/مبلغ|تكلفة|إجمالي|تأمين|مطلوب|سعر|صافي|رصيد|مدين|دائن/.test(label)) return 140;
    return 130;
  });

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
    <colgroup>
      ${colWidths.map((w) => `<col width="${w}" style="mso-width-source: userset; width: ${Math.round(w * 0.75)}pt;" />`).join("")}
    </colgroup>

    <!-- 1. هامش علوي أبيض مفرغ بدون خطوط شبكة -->
    <tr style="height: 20px; background-color: #ffffff;">
      <td colspan="${colCount}" style="border: none; background-color: #ffffff; height: 20px; font-size: 1pt;">&nbsp;</td>
    </tr>

    <!-- 2. الترويسة الرئيسية: اليمين هوية المستشفى، المنتصف شعار المستشفى بحواف دائرية وبحجم كبير، واليسار كارت بيانات التقرير -->
    <tr style="height: 155px; background-color: #ffffff;">
      <!-- اليمين: اسم المنشأة الطبية وبياناتها القانونية والضريبية -->
      <td colspan="${rightCols}" style="border: none; background-color: #ffffff; text-align: right; vertical-align: middle; padding: 8px 18px;">
        <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; text-align: right; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
          <tr>
            <td style="border: none; padding: 6px 0 4px 0; font-size: 19pt; font-weight: bold; color: #1e3a8a; line-height: 1.4; white-space: nowrap;">
              ${escapeXml(company.name || "مستشفى أمان الحياة")}
            </td>
          </tr>
          <tr>
            <td style="border: none; padding: 5px 0 4px 0; font-size: 10pt; color: #475569; font-weight: 600; white-space: nowrap;">
              ${escapeXml(company.legalForm || "شركة مساهمة مصرية — منشأة طبية خاصة")}
            </td>
          </tr>
          <tr>
            <td style="border: none; padding: 3px 0; font-size: 9pt; color: #64748b; white-space: nowrap;">
              <span>سجل تجاري: <strong style="color: #1e293b;">&lrm;${escapeXml(company.commercialRegister || "128470")}&lrm;</strong></span>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <span>بطاقة ضريبية: <strong style="color: #1e293b;">&lrm;${escapeXml(company.taxId || "204-851-963")}&lrm;</strong></span>
            </td>
          </tr>
        </table>
      </td>

      <!-- المنتصف: شعار مستشفى أمان الحياة بحواف منحنية ملساء وبحجم كبير وبارز في منتصف الترويسة تماماً -->
      <td colspan="${centerCols}" align="center" style="border: none; background-color: #ffffff; text-align: center; vertical-align: middle; padding: 6px 12px;">
        <center>
          <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; border-collapse: collapse; border: none; text-align: center;">
            <tr>
              <td align="center" style="border: none; text-align: center; vertical-align: middle; padding: 0;">
                <img src="cid:logo.png@excel.export" width="132" height="132" alt="شعار مستشفى أمان الحياة" style="display: block; border: none; outline: none; margin: 0 auto;" />
              </td>
            </tr>
          </table>
        </center>
      </td>

      <!-- اليسار: كارت بيانات التقرير المنظم والمؤطر بدون أي تكدس أو تداخل -->
      ${
        leftCols > 0
          ? `
      <td colspan="${leftCols}" style="border: none; background-color: #ffffff; text-align: left; vertical-align: middle; padding: 6px 14px;">
        <table border="0" cellpadding="0" cellspacing="0" align="left" style="border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; max-width: 320px; margin-left: 0; margin-right: auto; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
          <tr style="height: 22px;">
            <td style="border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; font-size: 8.5pt; color: #64748b; font-weight: 600; white-space: nowrap; text-align: right; width: 36%;">
              تاريخ التصدير:
            </td>
            <td style="border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; font-size: 8.5pt; color: #0f172a; font-weight: bold; white-space: nowrap; text-align: left;" dir="ltr">
              ${escapeXml(exportDate)}
            </td>
          </tr>
          <tr style="height: 22px;">
            <td style="border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; font-size: 8.5pt; color: #64748b; font-weight: 600; white-space: nowrap; text-align: right;">
              المُعِد / المسؤول:
            </td>
            <td style="border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; font-size: 8.5pt; color: #0f172a; font-weight: bold; white-space: nowrap; text-align: left;">
              ${escapeXml(user)}
            </td>
          </tr>
          ${
            cleanPeriod
              ? `
          <tr style="height: 22px;">
            <td style="border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; font-size: 8.5pt; color: #64748b; font-weight: 600; white-space: nowrap; text-align: right;">
              نطاق التقرير:
            </td>
            <td style="border: none; border-bottom: 1px solid #e2e8f0; padding: 4px 8px; font-size: 8.5pt; color: #1e40af; font-weight: bold; white-space: nowrap; text-align: left;">
              ${escapeXml(cleanPeriod)}
            </td>
          </tr>`
              : ""
          }
          <tr style="height: 22px;">
            <td style="border: none; padding: 4px 8px; font-size: 8.5pt; color: #64748b; font-weight: 600; white-space: nowrap; text-align: right;">
              عدد السجلات:
            </td>
            <td style="border: none; padding: 4px 8px; font-size: 8.5pt; color: #0284c7; font-weight: bold; white-space: nowrap; text-align: left;">
              ${rows.length} سجل
            </td>
          </tr>
        </table>
      </td>`
          : ""
      }
    </tr>

    <!-- 3. شريط عنوان التقرير البارز ممتد بعرض الشيت بالكامل -->
    <tr style="height: 42px; background-color: #f0f7ff;">
      <td colspan="${colCount}" style="
        border-top: 1px solid #bfdbfe;
        border-bottom: 2px solid #1e40af;
        border-left: none;
        border-right: none;
        background-color: #f0f7ff;
        text-align: center;
        vertical-align: middle;
        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
        font-size: 13pt;
        font-weight: bold;
        color: #1e40af;
        padding: 8px 16px;
        height: 42px;
      ">
        تقرير: ${escapeXml(title)}
      </td>
    </tr>

    <!-- 4. فاصل أبيض ناصع مفرغ قبل الجدول -->
    <tr style="height: 12px; background-color: #ffffff;">
      <td colspan="${colCount}" style="border: none; background-color: #ffffff; height: 12px; font-size: 1pt;">&nbsp;</td>
    </tr>

    <!-- 5. عناوين الأعمدة (هيدر الجدول أزرق كحلي ملكي فخم بنص أبيض عريض مع تثبيت عرض الأعمدة بدقة) -->
    <tr style="height: 38px; background-color: #1e40af; color: #ffffff;">
      ${headers
        .map(
          (h, idx) => {
            const w = colWidths[idx] || 130;
            return `
        <th width="${w}" style="
          width: ${w}px;
          min-width: ${w}px;
          background-color: #1e40af;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          font-size: 11pt;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
          border: 1px solid #172554;
          padding: 10px 14px;
          white-space: nowrap;
        ">
          ${escapeXml(h.label ?? h)}
        </th>`;
          },
        )
        .join("")}
    </tr>

    <!-- 6. صفوف البيانات بتدريجات الأبيض النقي والأبيض الثلجي الناعم (Zebra Striping) -->
    ${rows
      .map((row, rIdx) => {
        const isEven = rIdx % 2 === 1;
        const rowBg = isEven ? "#f8fafc" : "#ffffff";
        return `
        <tr style="height: 30px; background-color: ${rowBg};">
          ${row
            .map((cellVal, cIdx) => {
              const raw =
                cellVal && typeof cellVal === "object" && cellVal.value !== undefined
                  ? cellVal.value
                  : cellVal;
              const text = raw instanceof Node ? (raw.textContent ?? "") : String(raw ?? "");
              const colHeader = String(headers[cIdx]?.label ?? headers[cIdx] ?? "");
              const isNum =
                !isNaN(Number(text.replace(/[, ج.م]/g, "").trim())) &&
                text.trim() !== "" &&
                (text.includes(".") || !isNaN(Number(text)));
              const isTextName = /اسم|خدمة|بيان|وصف|تفاصيل|ملاحظات|مريض|صنف|جهة|عميل|مورد|موظف/.test(colHeader);
              const align = isNum ? "left" : isTextName ? "right" : "center";
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
                padding: 7px 12px;
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
      // إذا كان العمود اسم صنف/خدمة/مريض وموجود كقيمة خام نظيفة، استخدمه مباشرة
      if (
        col.key &&
        row[col.key] !== undefined &&
        typeof row[col.key] === "string" &&
        /name|title|description/i.test(col.key)
      ) {
        return row[col.key].trim();
      }

      if (col.render) {
        const rendered = col.render(row);
        if (rendered instanceof Node) {
          // إذا كان العنصر خلية ذات سطرين (twoLineCell)، استخرج السطر الأساسي فقط لتجنب التصاق السطرين
          const primaryDiv = rendered.querySelector(".text-ink, div:first-child");
          if (primaryDiv && primaryDiv.textContent?.trim()) {
            return primaryDiv.textContent.trim();
          }
          return rendered.textContent.trim();
        }
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
    period: period || subtitle || null,
  });
}

/** توافقية الاسم القديم: يوجه تلقائياً إلى التصدير المنسق */
export function exportTableToCsv(options) {
  exportTableToExcel(options);
}


