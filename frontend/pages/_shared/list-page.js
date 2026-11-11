/**
 * مصنع شاشات القوائم.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  أغلب شاشات النظام قائمة في جوهرها: ترويسة + بطاقات مؤشرات + جدول مفلتر.
 *  هذا المصنع يبني ذلك الهيكل، وكل شاشة تُصرّح بأعمدتها وفلاترها ومؤشراتها.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الفائدة ليست التوفير في الكتابة بل الاتساق: حالة التحميل والخطأ والفراغ،
 * وموضع الأزرار، وشكل المؤشرات، وسلوك التحديث بعد أي إجراء — كلها واحدة في
 * كل الشاشات. سبعون نسخة من نفس الهيكل تتباعد بعد أول تعديل على إحداها.
 *
 * الشاشات التي ليست قائمة (القوائم المالية، شجرة الحسابات، لوحة التحكم)
 * تُبنى يدويًا ولا تمر من هنا.
 */

import { el, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid } from "../../components/common/card.js";
import { dataTable, summaryCells } from "../../components/tables/data-table.js";
import { errorState } from "../../components/feedback/states.js";
import { toast } from "../../components/feedback/toast.js";
import { button } from "../../components/common/button.js";
import { exportTableToCsv, previewTableReport } from "./print.js";
import { describeError } from "../../js/core/errors.js";

/**
 * يبني شاشة قائمة.
 *
 * @param {object} definition
 * @param {string} definition.title
 * @param {string} [definition.description]
 * @param {string} definition.tableId              مُعرّف ثابت — يُخزَّن به تفضيل الأعمدة
 * @param {Array} definition.columns               أعمدة الجدول
 * @param {(params:object)=>Promise<object>} definition.fetch
 * @param {Array} [definition.filters]
 * @param {string} [definition.searchPlaceholder]
 * @param {() => Promise<Array>|Array} [definition.stats]  بطاقات المؤشرات
 * @param {(ctx:object)=>Array} [definition.actions]       أزرار الترويسة
 * @param {(row:object, ctx:object)=>Node|null} [definition.rowActions]
 * @param {(row:object)=>void} [definition.onRowClick]
 * @param {object} [definition.initialParams]
 * @param {(rows:object[])=>Node} [definition.summaryRow]
 * @param {string} [definition.emptyMessage]
 * @param {boolean} [definition.selectable]
 * @param {(rows:object[], clear:Function, ctx:object)=>Node} [definition.bulkActions]
 * @param {(ctx:object)=>Node|Node[]|null} [definition.before]  محتوى قبل الجدول
 * @param {(ctx:object)=>Node|Node[]|null} [definition.after]   محتوى بعد الجدول
 * @returns {Promise<HTMLElement>}
 */
export async function listPage(definition) {
  const {
    title,
    description,
    tableId,
    columns,
    fetch: fetchPage,
    filters = [],
    searchPlaceholder = "بحث…",
    stats,
    actions,
    rowActions,
    onRowClick,
    initialParams = {},
    summaryRow,
    emptyMessage,
    selectable = false,
    bulkActions,
    before,
    after,
    cardTitle,
    cardSubtitle,
  } = definition;

  const container = el("div", { class: "space-y-4" });
  const statsHost = el("div");
  const beforeHost = el("div");
  const afterHost = el("div");

  /**
   * السياق المُمرَّر لكل دالة بناء.
   *
   * `reload` يُعيد تحميل الجدول **والمؤشرات** معًا: إجراء يُغيّر صفًا يُغيّر
   * مجاميعه أيضًا، وتحديث الجدول وحده يترك بطاقة المؤشر على رقم قديم.
   */
  const context = {
    reload: async () => {
      table.reload();
      await refreshStats();
      await refreshSurroundings();
    },
    reloadTable: () => table.reload(),
    getParams: () => table.getParams(),
    getRows: () => (table?.getRows ? table.getRows() : []),
  };

  /* --- الترويسة --- */
  container.appendChild(
    pageHeader({
      title,
      description,
      actions: typeof actions === "function" ? actions(context) : actions,
    }),
  );

  /* --- بطاقات المؤشرات --- */
  if (stats) container.appendChild(statsHost);

  async function refreshStats() {
    if (!stats) return;

    try {
      const rows = table?.getRows ? table.getRows() : [];
      const cards = await stats(rows, context);
      clear(statsHost);
      if (cards?.length) statsHost.appendChild(statGrid(...cards.filter(Boolean)));
    } catch (error) {
      /*
       * فشل المؤشرات لا يُسقط الشاشة: الجدول هو المحتوى الأساسي والمؤشرات
       * ملخص له. لكن الفشل لا يُخفى أيضًا — يُعرض مكان البطاقات.
       */
      clear(statsHost);
      statsHost.appendChild(errorState({ error, compact: true }));
    }
  }

  /* --- محتوى إضافي حول الجدول --- */
  if (before) container.appendChild(beforeHost);

  async function refreshSurroundings() {
    for (const [host, builder] of [[beforeHost, before], [afterHost, after]]) {
      if (!builder) continue;

      try {
        const content = await builder(context);
        clear(host);
        for (const node of [content].flat().filter(Boolean)) host.appendChild(node);
      } catch (error) {
        clear(host);
        host.appendChild(errorState({ error, compact: true }));
      }
    }
  }

  /* --- أزرار التصدير والمعاينة لكل جدول --- */
  const exportBtn = button({
    label: "تصدير Excel",
    icon: "download",
    variant: "secondary",
    size: "md",
    onClick: async () => {
      let exportRows = table.getRows();
      if (fetchPage && exportRows.length < 500) {
        try {
          const allRes = await fetchPage({ ...table.getParams(), page: 1, perPage: 1000 });
          if (allRes?.data?.length) exportRows = allRes.data;
        } catch {
          // fallback
        }
      }
      exportTableToCsv({ title, columns, rows: exportRows });
    },
  });

  const printBtn = button({
    label: "معاينة وطباعة",
    icon: "print",
    variant: "secondary",
    size: "md",
    onClick: () => {
      previewTableReport({ title, columns, rows: table.getRows() });
    },
  });

  /* --- الجدول --- */
  const table = dataTable({
    id: tableId,
    columns,
    fetch: fetchPage,
    filters,
    searchPlaceholder,
    toolbarActions: [exportBtn, printBtn],
    rowActions: rowActions ? (row) => rowActions(row, context) : undefined,
    onRowClick,
    initialParams,
    /*
     * `dataTable` يتوقع **عنصرًا** في صف المجاميع (`<tr>`)، و`summaryCells`
     * هو ما يبنيه من أوصاف الخلايا. تمرير المصفوفة مباشرة يرمي
     * «appendChild: parameter 1 is not of type Node» عند أول صفحة نتائج.
     *
     * السماح بالاثنين هنا يجعل الشاشة تُصرّح بالخلايا وحدها — وهو الشكل
     * الأوضح — دون أن تتذكر كل شاشة أن تُغلّفها بنفسها.
     */
    summaryRow: summaryRow
      ? (rows) => {
          const built = summaryRow(rows);
          if (!built) return null;
          return Array.isArray(built) ? summaryCells(built) : built;
        }
      : undefined,
    emptyMessage,
    selectable,
    bulkActions: bulkActions ? (rows, clearSelection) => bulkActions(rows, clearSelection, context) : undefined,
  });

  container.appendChild(
    cardTitle
      ? card({ title: cardTitle, subtitle: cardSubtitle, body: table.element, flush: true })
      : table.element,
  );

  if (after) container.appendChild(afterHost);

  await Promise.all([refreshStats(), refreshSurroundings()]);

  return container;
}

/**
 * يلفّ إجراءً على صف: ينفّذه، يُظهر النتيجة، ويُحدّث الشاشة.
 *
 * يوحّد ثلاث قواعد من docs/07-FRONTEND-RULES.md في مكان واحد:
 *   - لا رسالة نجاح لعملية لم تُنفَّذ فعلًا (النجاح بعد انتهاء الطلب)
 *   - لا خطأ يُخفى بصمت (كل فشل يُعرض برسالته الحقيقية)
 *   - الشاشة تُحدَّث بعد الإجراء فلا يبقى صف على حالة قديمة
 *
 * @param {() => Promise<any>} action
 * @param {object} options
 * @param {string} options.success رسالة النجاح
 * @param {object} [options.context] سياق الشاشة — لإعادة التحميل
 * @param {(result:any)=>void} [options.onDone]
 * @param {boolean} [options.rethrow=false] لمن يحتاج التعامل مع الفشل بنفسه
 * @returns {Promise<any|undefined>} `undefined` عند الفشل
 */
export async function runAction(action, { success, context, onDone, rethrow = false } = {}) {
  try {
    const result = await action();

    if (success) toast.success(success);
    if (context?.reload) await context.reload();
    onDone?.(result);

    return result;
  } catch (error) {
    toast.error(describeError(error));

    /*
     * لا نُعيد رمي الخطأ افتراضيًا.
     *
     * معالج `onClick` في زر الصف لا يُنتظَر (`await`)، فإعادة الرمي تُنتج
     * وعدًا مرفوضًا بلا معالجة يلتقطه الحارس العام في js/app.js ويُظهر
     * «حدث خطأ غير متوقع» — فيرى المستخدم إشعارين لفشل واحد: الرسالة
     * الحقيقية ثم رسالة عامة تُناقضها. من يحتاج الخطأ يطلبه بـ `rethrow`.
     */
    if (rethrow) throw error;
    return undefined;
  }
}

/**
 * يسأل أولًا ثم ينفّذ.
 *
 * `confirmAction` يُعيد وعدًا بقيمة منطقية ولا يقبل معالجًا — تمرير `onConfirm`
 * إليه لا يفعل شيئًا والإجراء لا يُنفَّذ أبدًا، وهو فشل صامت. هذا الغلاف
 * يجعل الترتيب الصحيح هو الوحيد المتاح.
 *
 * @param {object} prompt     معاملات `confirmAction`
 * @param {() => Promise<any>} action
 * @param {object} options    `{ success, context, onDone }`
 */
export async function confirmThenRun(prompt, action, options = {}) {
  const confirmed = await confirmAction(prompt);
  if (!confirmed) return undefined;
  return runAction(action, options);
}
