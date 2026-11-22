/**
 * اتّساع الجداول — لا تمرير أفقي.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  قاعدة الواجهة: **لا جدول يُسحب يمينًا ليُرى آخره**. المستخدم على شاشة
 *  مكتب يقرأ الجدول كله أمامه، لا يسحبه ذهابًا وإيابًا بالماوس ليجمع الصف
 *  الواحد من نصفين لا يراهما معًا.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `dataTable` يحلّ ذلك بطيّ أعمدته الأقل أهمية (ويعرضها كاملة في لوحة الصف).
 * لكن جداول شاشات التفاصيل مبنية يدويًا بلا نموذج أعمدة يُطوى — فتُعالَج هنا
 * بالطريقة الأخرى: `table-layout: fixed` مع توزيع العرض المتاح على الأعمدة
 * **بنسبة عرضها الطبيعي** لا بالتساوي.
 *
 * النسبة لا التساوي مقصودة: التوزيع المتساوي يعطي عمود «إجراءات» (زرّان
 * لا ينكمشان) نفس نصيب عمود الاسم، فتخرج الأزرار من خليتها بينما نصف عمود
 * الاسم فارغ. التوزيع النسبي يُبقي لكل عمود حجمه النسبي ويقصّ من الجميع
 * بالتناسب، والنص يلتفّ داخل خليته: صفّ أطول قليلًا، ولا حرف مفقود، ولا
 * شريط تمرير أفقي.
 */

import { el, cx } from "../../js/core/dom.js";
import { registerCleanup } from "../../js/core/lifecycle.js";

/**
 * هامش التجاوز المسموح بالبكسل.
 *
 * `border-collapse` وتقريب الكسور العشرية يتركان الجدول «متجاوزًا» بپكسل أو
 * اثنين بلا تجاوز حقيقي. بلا هامش، كل قياس يُلاحق ذلك الوهم: يقصّ أعمدة أو
 * يُثبّت التخطيط بلا داعٍ.
 */
export const FIT_TOLERANCE = 6;

/**
 * أضيق عرض يبقى فيه العمود مقروءًا (بكسل) — كلمة عربية في سطر، أو مبلغ
 * بفاصلة عشرية. هو نفسه `MIN_COLUMN_WIDTH` في data-table.js: ذاك يقرر **كم
 * عمودًا** يُعرض، وهذا يقرر **كم يأخذ كل عمود** — نفس الحدّ لنفس السبب.
 */
export const MIN_READABLE_WIDTH = 92;

/**
 * يُجبر جدولًا على الاتّساع داخل حاويته.
 *
 * @param {HTMLElement} host   الحاوية (التي قد تُمرِّر أفقيًا)
 * @param {HTMLTableElement} table
 * @returns {boolean} هل احتاج الجدول تدخّلًا فعلًا
 */
export function fitTableWidth(host, table) {
  const changed = measureAndFit(host, table);

  // علامة «قِيس» — يعتمد عليها اختبار المتصفح لينتظر استقرار الجدول بدل مهلة ثابتة.
  if (table) table.dataset.fit = "done";

  return changed;
}

function measureAndFit(host, table) {
  if (!host || !table) return false;

  const headerCells = headerRowCells(table);

  // كل قياس يبدأ من الحالة الطبيعية: شاشة اتّسعت يجب أن تستعيد عرضها الطبيعي.
  table.classList.remove("table-fixed");
  headerCells.forEach((cell) => {
    cell.style.width = "";
  });

  const available = host.clientWidth;
  if (!available) return false; // داخل تبويب مخفي — لا شيء يُقاس
  if (table.scrollWidth <= available + FIT_TOLERANCE) return false;
  if (!headerCells.length) return false;

  const natural = headerCells.map((cell) => cell.offsetWidth);
  const total = natural.reduce((sum, width) => sum + width, 0);
  if (!total) return false;

  /*
   * التوزيع بأرضية لا بالنسبة وحدها.
   *
   * النسبة المجرّدة تعطي عمود الاسم (عرضه الطبيعي 273px لأن نصّه طويل) ثلث
   * الجدول، فيبقى لكل عمود آخر 45px — ويُكسَر الرأس العربي حرفًا في كل سطر
   * («الر / صي / د»). لكن الاسم لا **يحتاج** 273px، إنما يستهلكها لأنه
   * يستطيع.
   *
   * فلكل عمود أولًا أرضيته: أضيق عرض يُقرأ فيه (أو عرضه الطبيعي إن كان
   * أضيق أصلًا — عمود «الأيام» لا يحتاج 92px). ثم يُوزَّع الفائض على
   * الأعمدة بنسبة ما يتجاوز كل منها أرضيته — فيأخذ الاسم نصيب الأسد من
   * الفائض وحده، لا من حقّ غيره.
   */
  const floors = natural.map((width) => Math.min(width, MIN_READABLE_WIDTH));
  const floorTotal = floors.reduce((sum, width) => sum + width, 0);

  let widths;

  if (floorTotal >= available) {
    // حتى الأرضيات لا تتّسع — لا خيار إلا النسبة المجرّدة.
    widths = natural.map((width) => (width / total) * available);
  } else {
    const surplus = available - floorTotal;
    const hunger = natural.map((width, index) => Math.max(0, width - floors[index]));
    const hungerTotal = hunger.reduce((sum, width) => sum + width, 0) || 1;
    widths = floors.map((floor, index) => floor + (hunger[index] / hungerTotal) * surplus);
  }

  headerCells.forEach((cell, index) => {
    cell.style.width = `${((widths[index] / available) * 100).toFixed(4)}%`;
  });

  table.classList.add("table-fixed");
  return true;
}

/**
 * صفّ الرؤوس الذي يحمل الأعمدة الفعلية — الأخير في `thead`.
 *
 * جدول بصفّي رأس (مجموعات فوق أعمدة) يحمل الصفّ الأول خلايا مدموجة
 * (`colspan`)، وضبط العرض عليها يوزّع على مجموعات لا على أعمدة.
 */
function headerRowCells(table) {
  const rows = [...table.querySelectorAll("thead tr")];
  const row = rows[rows.length - 1];
  if (row) return [...row.children];

  // جدول بلا thead: الصفّ الأول في المتن يحدد الأعمدة.
  const first = table.querySelector("tr");
  return first ? [...first.children] : [];
}

/** يقيس الآن ثم عند كل تغيّر في عرض الحاوية. */
export function observeTableFit(host, table) {
  let lastWidth = 0;

  const measure = () => {
    const width = host.clientWidth;
    if (!width || Math.abs(width - lastWidth) < FIT_TOLERANCE) return;
    lastWidth = width;
    // داخل إطار الرسم لا داخل نداء المراقب — راجع التعليل في data-table.js.
    requestAnimationFrame(() => fitTableWidth(host, table));
  };

  // بعد أول رسم لا الآن: قبل الإلحاق بالصفحة كل القياسات أصفار.
  requestAnimationFrame(() => {
    lastWidth = host.clientWidth;
    fitTableWidth(host, table);
  });

  if (typeof ResizeObserver !== "function") return () => {};

  const observer = new ResizeObserver(measure);
  observer.observe(host);

  const stop = () => observer.disconnect();
  registerCleanup(stop);

  return stop;
}

/**
 * حاوية جدول تتّسع تلقائيًا — بديل `el("div", { class: "overflow-x-auto" }, table)`.
 *
 * `overflow-x-auto` باقية رغم أن الهدف ألّا تظهر أبدًا: لو عجز التوزيع يومًا
 * (عمود واحد أعرض من الشاشة) فالنتيجة شريط تمرير — سلوك اليوم — لا بيانات
 * مقصوصة يراها المستخدم ناقصة وهو لا يعرف أنها ناقصة.
 */
export function tableScroller(...children) {
  const nodes = children.flat().filter(Boolean);
  const host = el("div", { class: "overflow-x-auto" }, ...nodes);

  const table = host.querySelector("table") ?? (nodes[0] instanceof HTMLTableElement ? nodes[0] : null);
  if (table) observeTableFit(host, table);

  return host;
}

/** نفس `tableScroller` مع فئات إضافية على الحاوية. */
export function tableScrollerWithClass(className, ...children) {
  const host = tableScroller(...children);
  host.className = cx(host.className, className);
  return host;
}
