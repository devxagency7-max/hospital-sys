/**
 * جدول البيانات.
 *
 * المكوّن الأكثر استخدامًا في النظام — أغلب الـ 105 شاشة جدول في جوهرها.
 *
 * قرار معماري: البحث والفلترة والترتيب والترقيم كلها **على الخادم**. الجدول
 * يطلب صفحة ويعرضها، ولا يحتفظ بكل البيانات في الذاكرة. الفلترة المحلية تبدو
 * أسرع على 148 صفًا تجريبيًا ثم تنهار على 80 ألف فاتورة حقيقية — وتلك إعادة
 * كتابة للمكوّن بعد بناء الشاشات عليه.
 *
 * الحالة في الـ URL: الفلاتر والصفحة والترتيب تُكتب في معاملات الاستعلام، حتى
 * يكون رابط «الفواتير غير المسددة لقسم الجراحة» قابلاً للمشاركة والعودة إليه.
 */

import { el, cx, render, clear, debounce, delegate } from "../../js/core/dom.js";
import { TABLE } from "../../js/core/config.js";
import { icon } from "../common/icon.js";
import { button, iconButton } from "../common/button.js";
import { searchInput, select } from "../forms/fields.js";
import { ref } from "../common/value.js";
import { tableSkeleton, emptyState, errorState } from "../feedback/states.js";
import { readPreference, writePreference } from "../../js/core/store.js";
import { registerCleanup } from "../../js/core/lifecycle.js";
import { toApiError } from "../../js/core/errors.js";

/**
 * @typedef {object} Column
 * @property {string} key                 مفتاح الحقل في الصف
 * @property {string} label               رأس العمود
 * @property {(row:object)=>Node|string} [render]  عرض مخصص للخلية
 * @property {boolean} [sortable]
 * @property {"start"|"center"|"end"} [align="start"]
 * @property {string} [width]             قيمة CSS، مثل "8rem"
 * @property {boolean} [numeric]          محاذاة نهاية + أرقام بعرض ثابت
 * @property {boolean} [hidden]           مخفي ابتداءً (يظهر من قائمة الأعمدة)
 * @property {boolean} [alwaysVisible]    لا يمكن إخفاؤه
 */

/**
 * @typedef {object} TableFilter
 * @property {string} key
 * @property {string} label
 * @property {Array<{value:*,label:string}>} options
 * @property {Node} [control]             عنصر مخصص بدل القائمة المنسدلة
 */

/**
 * ينشئ جدول بيانات.
 *
 * @param {object} options
 * @param {string} options.id                     مُعرّف ثابت — يُخزَّن به تفضيل الأعمدة
 * @param {Column[]} options.columns
 * @param {(params:object)=>Promise<{data:object[],meta:object}>} options.fetch
 * @param {TableFilter[]} [options.filters]
 * @param {string} [options.searchPlaceholder]
 * @param {(row:object)=>Node|null} [options.rowActions]
 * @param {(row:object)=>void} [options.onRowClick]
 * @param {object} [options.initialParams]
 * @param {Node|Node[]} [options.toolbarActions]  أزرار على يسار شريط الأدوات
 * @param {boolean} [options.selectable]          خانات اختيار + إجراءات جماعية
 * @param {(rows:object[], clear:Function)=>Node} [options.bulkActions]
 * @param {boolean} [options.syncUrl=true]
 * @param {string} [options.emptyMessage]
 * @param {(rows:object[])=>Node} [options.summaryRow]  صف مجاميع في التذييل
 * @returns {{ element: HTMLElement, reload: Function, getParams: Function, destroy: Function }}
 */
export function dataTable({
  id,
  columns,
  fetch: fetchPage,
  filters = [],
  searchPlaceholder = "بحث…",
  rowActions,
  onRowClick,
  initialParams = {},
  toolbarActions,
  selectable = false,
  bulkActions,
  syncUrl = true,
  emptyMessage,
  emptyAction,
  summaryRow,
} = {}) {
  /* ---------------------------------------------------------------- الحالة */

  const COLUMNS_PREFERENCE = `table:${id}:hiddenColumns`;

  let hiddenColumns = new Set(readPreference(COLUMNS_PREFERENCE, []) ?? []);
  columns.forEach((column) => {
    if (column.hidden && !readPreference(COLUMNS_PREFERENCE)) hiddenColumns.add(column.key);
  });

  let params = {
    page: 1,
    perPage: TABLE.defaultPageSize,
    ...initialParams,
    ...(syncUrl ? readUrlParams() : {}),
  };

  let rows = [];
  let meta = { page: 1, perPage: params.perPage, total: 0, totalPages: 1 };
  let state = "loading"; // loading | ready | empty | error
  let error = null;
  let selection = new Set();
  /** يُلغي تطبيق استجابة قديمة وصلت بعد أحدث منها. */
  let requestToken = 0;

  /* ---------------------------------------------------------------- العناصر */

  const tableBody = el("tbody");
  const tableHead = el("thead");
  const tableFoot = el("tfoot");
  const stateHost = el("div");
  const bulkBar = el("div", { class: "hidden" });
  const paginationHost = el("div");
  const filterHost = el("div", { class: "hidden flex-wrap items-end gap-3 px-3 pb-3" });

  const tableScroll = el(
    "div",
    { class: "overflow-x-auto" },
    el("table", { class: "w-full text-sm border-collapse" }, tableHead, tableBody, tableFoot),
  );

  /* ---------------------------------------------------------------- مساعدات */

  function visibleColumns() {
    return columns.filter((column) => !hiddenColumns.has(column.key));
  }

  function readUrlParams() {
    const raw = window.location.hash.split("?")[1] ?? "";
    const search = new URLSearchParams(raw);
    const out = {};

    for (const [key, value] of search.entries()) {
      out[key] = key === "page" || key === "perPage" ? Number(value) || 1 : value;
    }

    return out;
  }

  function writeUrlParams() {
    if (!syncUrl) return;

    const [path] = window.location.hash.replace(/^#/, "").split("?");
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      // القيم الافتراضية لا تُكتب في الرابط — تُبقيه قابلاً للقراءة.
      if (value === "" || value === null || value === undefined) continue;
      if (key === "page" && value === 1) continue;
      if (key === "perPage" && value === TABLE.defaultPageSize) continue;
      search.append(key, String(value));
    }

    const queryString = search.toString();
    const target = `#${path}${queryString ? `?${queryString}` : ""}`;

    // replaceState لا pushState: كل ضغطة فلتر لا تستحق مدخلاً في سجل المتصفح.
    window.history.replaceState(null, "", window.location.href.split("#")[0] + target);
  }

  function hasActiveFilters() {
    return Boolean(
      params.search ||
        params.dateFrom ||
        params.dateTo ||
        filters.some((filter) => params[filter.key]),
    );
  }

  /* ---------------------------------------------------------------- الجلب */

  async function load() {
    const token = ++requestToken;
    state = "loading";
    paint();

    try {
      const result = await fetchPage({ ...params });
      if (token !== requestToken) return;

      rows = result.data ?? [];
      meta = result.meta ?? meta;
      state = rows.length ? "ready" : "empty";
      error = null;

      // التحديد يُلغى عند تغيير الصفحة — الإبقاء عليه يعني إجراءً جماعيًا على
      // صفوف لم تعد مرئية، وهو مصدر أخطاء مكلف في الإجراءات المالية.
      selection.clear();
    } catch (caught) {
      if (token !== requestToken) return;
      error = toApiError(caught);
      state = "error";
      rows = [];
    }

    if (token === requestToken) paint();
  }

  function setParams(patch, { resetPage = true } = {}) {
    params = { ...params, ...patch };
    if (resetPage && !("page" in patch)) params.page = 1;
    writeUrlParams();
    load();
  }

  /* ---------------------------------------------------------------- الرسم */

  function paintHead() {
    const cells = visibleColumns().map((column) => {
      const isSorted = params.sort === column.key;
      const alignment = column.numeric ? "end" : (column.align ?? "start");

      const content = column.sortable
        ? el(
            "button",
            {
              type: "button",
              class: cx(
                "inline-flex items-center gap-1 font-semibold hover:text-ink transition-colors",
                isSorted ? "text-ink" : "text-muted",
              ),
              onClick: () =>
                setParams({
                  sort: column.key,
                  // النقر على عمود مرتَّب يقلب الاتجاه؛ على عمود آخر يبدأ تصاعديًا.
                  order: isSorted && params.order === "asc" ? "desc" : "asc",
                }),
              "aria-label": `ترتيب حسب ${column.label}`,
            },
            el("span", {}, column.label),
            icon(isSorted ? (params.order === "desc" ? "arrowDown" : "arrowUp") : "sort", {
              size: 13,
              class: isSorted ? "text-brand-600" : "text-faint",
            }),
          )
        : el("span", { class: "font-semibold text-muted" }, column.label);

      return el(
        "th",
        {
          scope: "col",
          class: cx(
            "px-3 py-2.5 text-xs whitespace-nowrap border-b border-line",
            alignment === "end" ? "text-end" : alignment === "center" ? "text-center" : "text-start",
          ),
          style: column.width ? { width: column.width } : undefined,
          "aria-sort": isSorted ? (params.order === "desc" ? "descending" : "ascending") : undefined,
        },
        content,
      );
    });

    render(
      tableHead,
      el(
        "tr",
        { class: "bg-subtle" },
        selectable
          ? el(
              "th",
              { class: "w-10 px-3 py-2.5 border-b border-line", scope: "col" },
              el("input", {
                type: "checkbox",
                class: "size-4 accent-brand-600 cursor-pointer align-middle",
                "aria-label": "تحديد كل الصفوف المعروضة",
                checked: rows.length > 0 && selection.size === rows.length,
                onChange: (evt) => {
                  if (evt.target.checked) rows.forEach((row) => selection.add(row.id));
                  else selection.clear();
                  paintBody();
                  paintBulkBar();
                },
              }),
            )
          : null,
        ...cells,
        rowActions
          ? el("th", { class: "w-px px-3 py-2.5 border-b border-line", scope: "col" }, el("span", { class: "sr-only" }, "إجراءات"))
          : null,
      ),
    );
  }

  function paintBody() {
    clear(tableBody);

    for (const row of rows) {
      const isSelected = selection.has(row.id);

      const cells = visibleColumns().map((column) => {
        const alignment = column.numeric ? "end" : (column.align ?? "start");
        const value = column.render ? column.render(row) : row[column.key];

        return el(
          "td",
          {
            class: cx(
              "px-3 py-2.5 border-b border-line align-middle",
              alignment === "end" ? "text-end" : alignment === "center" ? "text-center" : "text-start",
              column.numeric && "tabular",
            ),
          },
          value instanceof Node ? value : el("span", {}, value === null || value === undefined || value === "" ? "—" : String(value)),
        );
      });

      const tr = el(
        "tr",
        {
          class: cx(
            "transition-colors",
            isSelected ? "bg-brand-50" : "hover:bg-subtle",
            onRowClick && "cursor-pointer",
          ),
          dataset: { rowId: row.id },
          ...(onRowClick
            ? {
                tabindex: "0",
                onKeydown: (evt) => {
                  if (evt.key === "Enter") onRowClick(row);
                },
              }
            : {}),
        },
        selectable
          ? el(
              "td",
              { class: "px-3 py-2.5 border-b border-line" },
              el("input", {
                type: "checkbox",
                class: "size-4 accent-brand-600 cursor-pointer align-middle",
                "aria-label": "تحديد الصف",
                checked: isSelected,
                onClick: (evt) => evt.stopPropagation(),
                onChange: (evt) => {
                  if (evt.target.checked) selection.add(row.id);
                  else selection.delete(row.id);
                  tr.classList.toggle("bg-brand-50", evt.target.checked);
                  paintBulkBar();
                  paintHead();
                },
              }),
            )
          : null,
        ...cells,
        rowActions
          ? el(
              "td",
              {
                class: "px-3 py-2.5 border-b border-line w-px",
                // النقر على منطقة الإجراءات لا يفتح الصف.
                onClick: (evt) => evt.stopPropagation(),
              },
              rowActions(row) ?? el("span"),
            )
          : null,
      );

      tableBody.appendChild(tr);
    }

    /* --- صف المجاميع --- */
    clear(tableFoot);
    if (summaryRow && rows.length) {
      const summary = summaryRow(rows);
      if (summary) tableFoot.appendChild(summary);
    }
  }

  function paintBulkBar() {
    if (!selectable || !selection.size) {
      bulkBar.className = "hidden";
      clear(bulkBar);
      return;
    }

    const selectedRows = rows.filter((row) => selection.has(row.id));

    const clearSelection = () => {
      selection.clear();
      paintBody();
      paintHead();
      paintBulkBar();
    };

    bulkBar.className =
      "flex items-center justify-between gap-3 px-3 py-2 bg-brand-50 border-b border-brand-200";

    render(
      bulkBar,
      el(
        "span",
        { class: "text-xs font-medium text-brand-300" },
        `تم تحديد ${selection.size} ${selection.size === 1 ? "صف" : "صفوف"}`,
      ),
      el(
        "div",
        { class: "flex items-center gap-2" },
        bulkActions?.(selectedRows, clearSelection) ?? null,
        button({ label: "إلغاء التحديد", variant: "ghost", size: "sm", onClick: clearSelection }),
      ),
    );
  }

  function paintPagination() {
    if (state !== "ready" || meta.totalPages <= 1) {
      render(
        paginationHost,
        state === "ready"
          ? el(
              "div",
              { class: "px-3 py-2.5 text-xs text-muted border-t border-line" },
              `${meta.total} ${meta.total === 1 ? "سجل" : "سجل"}`,
            )
          : el("div"),
      );
      return;
    }

    const from = (meta.page - 1) * meta.perPage + 1;
    const to = Math.min(meta.page * meta.perPage, meta.total);

    render(
      paginationHost,
      el(
        "div",
        { class: "flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-line" },
        el(
          "div",
          { class: "flex items-center gap-3" },
          el(
            "span",
            { class: "text-xs text-muted tabular" },
            `${from}–${to} من ${meta.total}`,
          ),
          el(
            "label",
            { class: "flex items-center gap-1.5 text-xs text-muted" },
            el("span", {}, "لكل صفحة"),
            select({
              value: String(meta.perPage),
              size: "sm",
              class: "w-16",
              options: TABLE.pageSizeOptions.map((size) => ({ value: size, label: String(size) })),
              onChange: (evt) => setParams({ perPage: Number(evt.target.value) }),
            }),
          ),
        ),
        el(
          "div",
          { class: "flex items-center gap-1" },
          iconButton("chevronStart", {
            label: "الصفحة السابقة",
            size: "icon-sm",
            disabled: meta.page <= 1,
            onClick: () => setParams({ page: meta.page - 1 }, { resetPage: false }),
          }),
          ...pageNumbers(meta.page, meta.totalPages).map((entry) =>
            entry === "…"
              ? el("span", { class: "px-1 text-xs text-faint" }, "…")
              : button({
                  label: String(entry),
                  size: "icon-sm",
                  variant: entry === meta.page ? "primary" : "ghost",
                  class: "tabular",
                  onClick: () => setParams({ page: entry }, { resetPage: false }),
                }),
          ),
          iconButton("chevronEnd", {
            label: "الصفحة التالية",
            size: "icon-sm",
            disabled: meta.page >= meta.totalPages,
            onClick: () => setParams({ page: meta.page + 1 }, { resetPage: false }),
          }),
        ),
      ),
    );
  }

  function paint() {
    paintHead();

    if (state === "loading") {
      tableScroll.classList.add("hidden");
      render(stateHost, tableSkeleton({ columns: visibleColumns().length || 4 }));
    } else if (state === "error") {
      tableScroll.classList.add("hidden");
      render(stateHost, errorState({ error, onRetry: load, compact: true }));
    } else if (state === "empty") {
      tableScroll.classList.add("hidden");
      render(
        stateHost,
        emptyState({
          compact: true,
          filtered: hasActiveFilters(),
          message: emptyMessage,
          actions: emptyAction,
          onClearFilters: () =>
            setParams({
              search: "",
              dateFrom: "",
              dateTo: "",
              ...Object.fromEntries(filters.map((filter) => [filter.key, ""])),
            }),
        }),
      );
    } else {
      clear(stateHost);
      tableScroll.classList.remove("hidden");
      paintBody();
    }

    paintBulkBar();
    paintPagination();
  }

  /* ---------------------------------------------------------------- الفلاتر */

  function paintFilters() {
    if (!filters.length) return;

    render(
      filterHost,
      ...filters.map((filter) =>
        el(
          "div",
          { class: "min-w-[10rem]" },
          el("label", { class: "block text-[11px] font-medium text-muted mb-1" }, filter.label),
          filter.control ??
            select({
              value: params[filter.key] ?? "",
              size: "sm",
              placeholder: filter.placeholder ?? "الكل",
              options: filter.options ?? [],
              onChange: (evt) => setParams({ [filter.key]: evt.target.value }),
            }),
        ),
      ),
      el(
        "div",
        { class: "flex items-end" },
        button({
          label: "مسح الفلاتر",
          variant: "ghost",
          size: "sm",
          icon: "close",
          disabled: !hasActiveFilters(),
          onClick: () =>
            setParams({
              search: "",
              dateFrom: "",
              dateTo: "",
              ...Object.fromEntries(filters.map((filter) => [filter.key, ""])),
            }),
        }),
      ),
    );
  }

  /* ---------------------------------------------------------------- الأدوات */

  const onSearch = debounce((value) => setParams({ search: value }), TABLE.searchDebounceMs);

  const columnsMenu = el("div", { class: "relative" });

  /*
   * حالة قائمة الأعمدة على مستوى المكوّن لا داخل دالة الرسم: مستمع النقر
   * الخارجي معلّق على `document`، فلو غادر المستخدم الشاشة والقائمة مفتوحة
   * لبقي المستمع حيًا بعد اختفاء الجدول.
   */
  let columnsPanel = null;
  let detachOutsideClick = () => {};

  function closeColumnsMenu() {
    columnsPanel?.remove();
    columnsPanel = null;
    detachOutsideClick();
    detachOutsideClick = () => {};
  }

  function paintColumnsMenu() {
    const hideable = columns.filter((column) => !column.alwaysVisible);
    if (!hideable.length) return;

    const toggle = iconButton("columns", {
      label: "الأعمدة الظاهرة",
      size: "icon",
      onClick: () => {
        if (columnsPanel) {
          closeColumnsMenu();
          return;
        }

        columnsPanel = el(
          "div",
          {
            class:
              "absolute top-full end-0 mt-1 z-20 w-56 max-h-72 overflow-y-auto bg-surface border border-line " +
              "rounded-[var(--radius-control)] shadow-raised p-1.5",
          },
          el("p", { class: "px-2 py-1 text-[11px] font-semibold text-faint" }, "الأعمدة الظاهرة"),
          ...hideable.map((column) =>
            el(
              "label",
              { class: "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-subtle cursor-pointer" },
              el("input", {
                type: "checkbox",
                class: "size-3.5 accent-brand-600",
                checked: !hiddenColumns.has(column.key),
                onChange: (evt) => {
                  if (evt.target.checked) hiddenColumns.delete(column.key);
                  else hiddenColumns.add(column.key);

                  writePreference(COLUMNS_PREFERENCE, [...hiddenColumns]);
                  paint();
                },
              }),
              el("span", { class: "text-xs text-ink" }, column.label),
            ),
          ),
        );

        columnsMenu.appendChild(columnsPanel);

        // الإغلاق بالنقر خارج القائمة — نؤجّل الربط دورة حتى لا يُلغيه نفس النقر.
        const timer = setTimeout(() => {
          const onOutside = (evt) => {
            if (!columnsMenu.contains(evt.target)) closeColumnsMenu();
          };

          document.addEventListener("mousedown", onOutside);
          detachOutsideClick = () => document.removeEventListener("mousedown", onOutside);
        }, 0);

        // لو أُغلقت القائمة قبل انقضاء المهلة، نُلغيها حتى لا يُربط مستمع يتيم.
        detachOutsideClick = () => clearTimeout(timer);
      },
    });

    render(columnsMenu, toggle);
  }

  const filtersToggle = filters.length
    ? button({
        label: "فلاتر",
        icon: "filter",
        variant: "secondary",
        size: "md",
        onClick: () => {
          const isHidden = filterHost.classList.toggle("hidden");
          filterHost.classList.toggle("flex", !isHidden);
        },
      })
    : null;

  const toolbar = el(
    "div",
    { class: "flex flex-wrap items-center justify-between gap-3 p-3" },
    el(
      "div",
      { class: "flex items-center gap-2 flex-1 min-w-[12rem] max-w-md" },
      searchInput({
        value: params.search ?? "",
        placeholder: searchPlaceholder,
        onInput: (evt) => onSearch(evt.target.value),
        onClear: () => onSearch.cancel(),
      }),
    ),
    el(
      "div",
      { class: "flex items-center gap-2" },
      ...[toolbarActions].flat().filter(Boolean),
      filtersToggle,
      columnsMenu,
      iconButton("refresh", { label: "تحديث", size: "icon", onClick: load }),
    ),
  );

  /* ---------------------------------------------------------------- التركيب */

  const element = el(
    "div",
    {
      class: "glass-card rounded-2xl shadow-card overflow-hidden",
    },
    el("div", { class: "no-print" }, toolbar, filterHost),
    bulkBar,
    tableScroll,
    stateHost,
    el("div", { class: "no-print" }, paginationHost),
  );

  const unbindRowClick = onRowClick
    ? delegate(tableBody, "click", "tr[data-row-id]", (_evt, tr) => {
        const row = rows.find((candidate) => String(candidate.id) === tr.dataset.rowId);
        if (row) onRowClick(row);
      })
    : () => {};

  function destroy() {
    requestToken += 1; // يُبطل أي استجابة في الطريق
    onSearch.cancel();
    unbindRowClick();
    closeColumnsMenu();
  }

  /*
   * التنظيف يُسجَّل تلقائيًا: الصفحة لا تملك مرجعًا للجدول حين يُنشأ داخل
   * تبويب كسول، فلا يمكن الاعتماد على أن تستدعي `destroy` بنفسها. بدون هذا
   * كان البحث المؤجَّل يُنفَّذ بعد مغادرة الشاشة فيكتب فلاتره في رابط الصفحة
   * التالية.
   */
  registerCleanup(destroy);

  paintColumnsMenu();
  paintFilters();
  load();

  return {
    element,
    reload: load,
    getParams: () => ({ ...params }),
    setParams,
    getRows: () => [...rows],
    getSelection: () => rows.filter((row) => selection.has(row.id)),
    destroy,
  };
}

/**
 * أرقام الصفحات مع اختصار.
 * نعرض الأولى والأخيرة وجارات الحالية فقط — 400 صفحة لا تُعرض كلها.
 */
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_unused, index) => index + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((page) => pages.add(page));

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const out = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("…");
    out.push(page);
    previous = page;
  }

  return out;
}

/**
 * خلية من سطرين — «الاسم» فوق و«الكود» تحت، نمط متكرر في الجداول.
 *
 * السطر الثاني يُعزل اتجاهيًا افتراضيًا لأنه كود أو مرجع في أغلب الحالات
 * (P-1001، INV-2026-0042). مرّر `{ isolateSecondary: false }` لو كان نصًا عربيًا.
 */
export function twoLineCell(primary, secondary, { isolateSecondary = true } = {}) {
  return el(
    "div",
    { class: "min-w-0" },
    el("div", { class: "text-ink truncate-1" }, primary ?? "—"),
    secondary
      ? el(
          "div",
          { class: "text-xs text-faint truncate-1 mt-0.5" },
          isolateSecondary ? ref(secondary) : secondary,
        )
      : null,
  );
}

/** صف مجاميع للتذييل. */
export function summaryCells(cells) {
  return el(
    "tr",
    { class: "bg-subtle font-semibold" },
    ...cells.map((cell) =>
      el(
        "td",
        {
          class: cx(
            "px-3 py-2.5 border-t-2 border-line-strong text-xs",
            cell.numeric ? "text-end tabular" : "text-start",
          ),
          colspan: cell.colspan,
        },
        cell.value ?? "",
      ),
    ),
  );
}
