/**
 * دليل الحسابات — عرض شجري بالأرصدة المُجمَّعة.
 *
 * الأرصدة المعروضة **مُشتقّة من القيود المُرحَّلة** لا من حقل مخزَّن: الحساب
 * الأب يحمل مجموع أبنائه، والورقة تحمل حركاتها المباشرة. راجع `rollUpBalances`
 * في js/domain/ledger.js.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statGrid, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { icon } from "../../components/common/icon.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { alert } from "../../components/feedback/alert.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { currency, integer } from "../../js/core/format.js";
import { searchInput, textField } from "../../components/forms/fields.js";
import { selectField, dateRange, formModal, value } from "../_shared/forms.js";
import { can } from "../../js/core/permissions.js";
import { getAccountsTree, createAccount } from "../../js/api/accounting.api.js";
import { invalidateLookups } from "../../js/api/lookups.api.js";

const TYPE_TABS = [
  { key: "all", label: "كل الحسابات" },
  { key: "asset", label: "الأصول", code: "1" },
  { key: "liability", label: "الخصوم", code: "2" },
  { key: "equity", label: "حقوق الملكية", code: "3" },
  { key: "revenue", label: "الإيرادات", code: "4" },
  { key: "expense", label: "المصروفات", code: "5" },
];

const TYPE_TONES = {
  asset: "info",
  liability: "warning",
  equity: "brand",
  revenue: "success",
  expense: "danger",
};

export default async function accountsPage() {
  const container = el("div", { class: "space-y-4" });

  let tree = null;
  let expanded = new Set();
  let search = "";
  let activeType = "all";
  let range = { dateFrom: "", dateTo: "" };

  const statsHost = el("div");
  const problemsHost = el("div");
  const treeHost = el("div", { class: "space-y-1 min-h-[22rem]" });

  /* --------------------------------------------------------------- الترويسة */

  container.appendChild(
    pageHeader({
      title: "دليل الحسابات",
      description:
        "الدليل المحاسبي الموحَّد. الترحيل على الحسابات التفصيلية فقط — الحساب الأب مجموع أبنائه.",
      actions: [
        button({
          label: "توسيع الكل",
          variant: "ghost",
          icon: "folder",
          onClick: () => {
            expanded = new Set((tree?.rows ?? []).map((row) => row.id));
            renderTree();
          },
        }),
        button({
          label: "طي الكل",
          variant: "ghost",
          onClick: () => {
            expanded = new Set();
            renderTree();
          },
        }),
        can("gl.account.manage")
          ? button({
              label: "إضافة حساب",
              variant: "primary",
              icon: "plus",
              onClick: () => openAccountModal({ onSaved: load }),
            })
          : null,
      ].filter(Boolean),
    }),
  );

  container.appendChild(statsHost);
  container.appendChild(problemsHost);

  /* ----------------------------------------------------------- شريط الأدوات */

  const toolbar = el(
    "div",
    {
      class:
        "flex flex-wrap items-end justify-between gap-3 bg-surface/80 p-3 rounded-2xl border border-line",
    },
    el(
      "div",
      { class: "flex items-center gap-1.5 overflow-x-auto" },
      ...TYPE_TABS.map((tab) =>
        el(
          "button",
          {
            class: cx(
              "px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap",
              activeType === tab.key
                ? "bg-brand-600 text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-subtle",
            ),
            "data-type": tab.key,
            onClick: (event) => {
              activeType = tab.key;
              for (const node of event.currentTarget.parentElement.children) {
                const isActive = node.dataset.type === activeType;
                node.classList.toggle("bg-brand-600", isActive);
                node.classList.toggle("text-white", isActive);
                node.classList.toggle("shadow-sm", isActive);
                node.classList.toggle("text-muted", !isActive);
              }
              renderTree();
            },
          },
          tab.code ? `${tab.label} (${tab.code})` : tab.label,
        ),
      ),
    ),
    el(
      "div",
      { class: "flex items-end gap-3" },
      /*
       * نطاق التاريخ يُغيّر الأرصدة المعروضة لا الحسابات: الدليل ثابت،
       * والرصيد سؤال عن فترة. بلا هذا الفلتر يُقرأ الدليل برصيد «كل الزمن»
       * ولا طريقة لرؤية حركة شهر واحد.
       */
      dateRange({
        from: range.dateFrom,
        to: range.dateTo,
        onChange: (next) => {
          range = next;
          load();
        },
      }),
      el(
        "div",
        { class: "w-64" },
        searchInput({
          placeholder: "بحث بالكود أو الاسم…",
          onInput: value((next) => {
            search = next.trim().toLowerCase();
            /* البحث يفتح الشجرة كلها — وإلا اختفت النتائج داخل عقد مطوية. */
            if (search) expanded = new Set((tree?.rows ?? []).map((row) => row.id));
            renderTree();
          }),
        }),
      ),
    ),
  );

  container.appendChild(toolbar);

  container.appendChild(
    card({
      title: "هيكل الدليل",
      subtitle: "عرض هرمي بأربعة مستويات — الرصيد المعروض للأب هو مجموع أبنائه",
      body: treeHost,
    }),
  );

  /* ------------------------------------------------------------------ العرض */

  function renderStats() {
    clear(statsHost);
    if (!tree) return;

    const totals = tree.totals;

    statsHost.appendChild(
      statGrid(
        statTile({ label: "إجمالي الأصول", value: currency(totals.asset ?? 0), tone: "info", icon: "building" }),
        statTile({ label: "إجمالي الخصوم", value: currency(totals.liability ?? 0), tone: "warning", icon: "shield" }),
        statTile({ label: "حقوق الملكية", value: currency(totals.equity ?? 0), tone: "brand", icon: "crown" }),
        statTile({ label: "الإيرادات", value: currency(totals.revenue ?? 0), tone: "success", icon: "arrowUp" }),
        statTile({ label: "المصروفات", value: currency(totals.expense ?? 0), tone: "danger", icon: "arrowDown" }),
        statTile({
          label: "حسابات قابلة للترحيل",
          value: `${integer(tree.counts.postable)} من ${integer(tree.counts.total)}`,
          hint: tree.counts.inactive ? `${integer(tree.counts.inactive)} غير نشط` : null,
          tone: "neutral",
          icon: "columns",
        }),
      ),
    );
  }

  /**
   * مشاكل سلامة الدليل.
   *
   * تُعرض في أعلى الشاشة لا تُخفى: كود مكرر أو فرع يخالف نوع أبيه يُفسد كل
   * تقرير مبنيّ على الدليل، وإخفاؤه يجعل الخطأ يظهر لاحقًا في رقم لا يُفسَّر.
   */
  function renderProblems() {
    clear(problemsHost);
    if (!tree?.problems?.length) return;

    const errors = tree.problems.filter((problem) => problem.severity === "error");
    const warnings = tree.problems.filter((problem) => problem.severity === "warning");

    if (errors.length) {
      problemsHost.appendChild(
        alert({
          tone: "danger",
          title: `${errors.length} خطأ في بنية الدليل`,
          message: el(
            "ul",
            { class: "list-disc ps-5 space-y-1 text-xs" },
            ...errors.slice(0, 6).map((problem) => el("li", {}, problem.message)),
          ),
        }),
      );
    }

    if (warnings.length) {
      problemsHost.appendChild(
        alert({
          tone: "warning",
          title: `${warnings.length} تنبيه على ترميز الدليل`,
          message: el(
            "ul",
            { class: "list-disc ps-5 space-y-1 text-xs" },
            ...warnings.slice(0, 4).map((problem) => el("li", {}, problem.message)),
          ),
        }),
      );
    }
  }

  function renderTree() {
    clear(treeHost);
    if (!tree) return;

    const rows = tree.rows;
    const byId = new Map(rows.map((row) => [row.id, row]));

    /** الحسابات المطابقة للفلتر والبحث. */
    const matches = rows.filter((row) => {
      if (activeType !== "all" && row.type !== activeType) return false;
      if (!search) return true;
      return (
        String(row.name).toLowerCase().includes(search) ||
        String(row.nameEn ?? "").toLowerCase().includes(search) ||
        String(row.code).includes(search)
      );
    });

    if (!matches.length) {
      treeHost.appendChild(
        emptyState({
          title: "لا حسابات مطابقة",
          message: search ? `لا حساب يطابق «${search}».` : "لا حسابات من هذا النوع.",
        }),
      );
      return;
    }

    /*
     * الآباء يُعرضون دائمًا حتى لو لم يطابقوا البحث: عرض حساب فرعي بلا أبيه
     * يُفقد الكود معناه الهرمي — «1121» معلَّق في الهواء بلا «النقدية».
     */
    const visible = new Set();
    for (const row of matches) {
      visible.add(row.id);
      let cursor = row.parentId;
      while (cursor !== null && cursor !== undefined) {
        visible.add(cursor);
        cursor = byId.get(cursor)?.parentId;
      }
    }

    for (const row of rows) {
      if (!visible.has(row.id)) continue;

      /* العقدة المطوية تُخفي أبناءها. */
      let hidden = false;
      let cursor = row.parentId;
      while (cursor !== null && cursor !== undefined) {
        if (!expanded.has(cursor)) { hidden = true; break; }
        cursor = byId.get(cursor)?.parentId;
      }
      if (hidden) continue;

      treeHost.appendChild(renderNode(row, matches.includes(row)));
    }
  }

  function renderNode(row, isMatch) {
    const hasChildren = !row.isLeaf;
    const isExpanded = expanded.has(row.id);

    return el(
      "div",
      {
        class: cx(
          "group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-transparent transition-colors text-xs",
          row.depth === 0 && "bg-brand-50/50 border-brand-200/50 font-bold",
          row.depth === 1 && "bg-surface/60 font-semibold",
          row.depth >= 2 && "hover:bg-surface/80",
          !isMatch && "opacity-55",
        ),
        style: `margin-inline-start: ${row.depth * 1.5}rem`,
      },
      el(
        "div",
        { class: "flex items-center gap-2 min-w-0" },
        hasChildren
          ? el(
              "button",
              {
                class: "p-1 rounded hover:bg-black/5 text-muted shrink-0",
                "aria-expanded": String(isExpanded),
                "aria-label": isExpanded ? "طي" : "توسيع",
                onClick: () => {
                  if (isExpanded) expanded.delete(row.id);
                  else expanded.add(row.id);
                  renderTree();
                },
              },
              icon(isExpanded ? "chevronDown" : "chevronStart", { size: 14 }),
            )
          : el("span", { class: "w-6 shrink-0" }),

        ref(row.code, { class: "px-2 py-0.5 rounded bg-subtle text-ink font-mono text-[11px] shrink-0" }),
        el("span", { class: "text-ink truncate-1" }, row.name),

        badge(row.typeLabel, { tone: TYPE_TONES[row.type] ?? "neutral", size: "sm" }),
        badge(row.natureLabel, { tone: row.nature === "debit" ? "info" : "warning", size: "sm" }),

        /* حساب المقابلة يستحق وسمًا: طبيعته تخالف نوعه وهذا ليس خطأً. */
        row.isContra ? badge("مقابلة", { tone: "purple", size: "sm" }) : null,
        row.status !== "active" ? badge("غير نشط", { tone: "muted", size: "sm" }) : null,
        !row.isLeaf ? null : badge("قابل للترحيل", { tone: "success", size: "sm", dot: true }),
      ),

      el(
        "div",
        { class: "flex items-center gap-3 shrink-0" },
        row.movementsCount
          ? el("span", { class: "text-[11px] text-faint tabular" }, `${integer(row.movementsCount)} حركة`)
          : el("span", { class: "text-[11px] text-faint" }, "بلا حركة"),
        el("span", { class: "font-mono font-semibold text-ink tabular w-32 text-end" }, currency(row.balance)),

        can("gl.account.manage") && !row.movementsCount
          ? button({
              label: "فرعي",
              variant: "ghost",
              size: "sm",
              icon: "plus",
              class: "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
              onClick: () => openAccountModal({ parent: row, onSaved: load }),
            })
          : el("span", { class: "w-16" }),
      ),
    );
  }

  /* ------------------------------------------------------------------ الجلب */

  async function load() {
    clear(treeHost);
    treeHost.appendChild(loadingState({ message: "جاري تحميل الدليل…" }));

    try {
      tree = await getAccountsTree(range);

      /* أول تحميل: نفتح المستويين الأعلى فقط — الدليل كله مفتوح غير مقروء. */
      if (!expanded.size) {
        expanded = new Set(tree.rows.filter((row) => row.depth <= 1).map((row) => row.id));
      }

      renderStats();
      renderProblems();
      renderTree();
    } catch (error) {
      clear(treeHost);
      treeHost.appendChild(errorState({ error, onRetry: load }));
    }
  }

  await load();
  return container;
}

/* ==========================================================================
   نافذة إضافة حساب
   ========================================================================== */

function openAccountModal({ parent = null, onSaved }) {
  const form = {
    code: "",
    name: "",
    nameEn: "",
    type: parent?.type ?? "asset",
    nature: parent?.nature ?? "debit",
    parentId: parent?.id ?? null,
  };

  formModal({
    title: parent ? `إضافة حساب فرعي تحت: ${parent.name}` : "إضافة حساب رئيسي",
    size: "md",
    submitLabel: "حفظ الحساب",
    success: "أُضيف الحساب إلى الدليل.",
    fieldLabels: { name: "اسم الحساب", code: "كود الحساب", type: "نوع الحساب" },

    validate: () => {
      const errors = {};
      if (!form.name.trim()) errors.name = "اسم الحساب مطلوب.";
      if (!parent && !form.code.trim()) errors.code = "كود الحساب مطلوب للحساب الرئيسي.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "space-y-3.5" },
        parent
          ? alert({
              tone: "info",
              message:
                `الحساب الجديد يتبع نوع أبيه (${parent.typeLabel}). اترك الكود فارغًا ` +
                `ليُولَّد تلقائيًا بعد كود الأب ${parent.code}.`,
            })
          : null,

        textField({
          label: "كود الحساب",
          value: form.code,
          placeholder: parent ? `يُولَّد تلقائيًا بعد ${parent.code}` : "مثال: 6",
          hint: "لا يُعاد استخدام كود حساب موجود — الكود مرجع في مستندات مُرحَّلة.",
          onInput: value((next) => (form.code = next)),
        }),

        textField({
          label: "اسم الحساب",
          value: form.name,
          required: true,
          placeholder: "مثال: حساب جاري بنك الإسكندرية",
          onInput: value((next) => (form.name = next)),
        }),

        textField({
          label: "الاسم بالإنجليزية",
          value: form.nameEn,
          placeholder: "Alexandria Bank — Current",
          onInput: value((next) => (form.nameEn = next)),
        }),

        selectField({
          label: "نوع الحساب",
          value: form.type,
          disabled: Boolean(parent),
          hint: parent ? "محدَّد من الحساب الأب ولا يُخالفه." : null,
          options: [
            { value: "asset", label: "أصول" },
            { value: "liability", label: "خصوم والتزامات" },
            { value: "equity", label: "حقوق ملكية" },
            { value: "revenue", label: "إيرادات" },
            { value: "expense", label: "مصروفات" },
          ],
          onChange: (event) => {
            form.type = event.target.value;
            form.nature = ["asset", "expense"].includes(form.type) ? "debit" : "credit";
          },
        }),

        selectField({
          label: "طبيعة الحساب",
          value: form.nature,
          hint: "اختر خلاف الطبيعة الافتراضية للنوع فقط إن كان حساب مقابلة (مثل مجمع الإهلاك).",
          options: [
            { value: "debit", label: "مدين" },
            { value: "credit", label: "دائن" },
          ],
          onChange: (event) => (form.nature = event.target.value),
        }),
      ),

    onSubmit: () =>
      createAccount({
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || null,
        type: form.type,
        nature: form.nature,
        parentId: form.parentId,
      }),

    onDone: async () => {
      /* قوائم اختيار الحساب في الشاشات الأخرى يجب أن ترى الحساب الجديد فورًا. */
      invalidateLookups("accounts");
      await onSaved?.();
    },
  });
}
