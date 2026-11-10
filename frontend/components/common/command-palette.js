/**
 * لوحة البحث السريع (Command Palette).
 *
 * بحث واحد يغطي أربعة مصادر حقيقية: شاشات النظام (محليًا من خريطة التنقل)،
 * وأطراف التعامل والأصناف وقيود اليومية (عبر الـ API الفعلي، بنفس طبقة
 * البيانات التي تستخدمها الجداول). لا نتائج مُختلقة — فراغ كلمة البحث يُظهر
 * اختصارات شائعة فقط، وكل قسم يملك حالتي تحميل وفراغ مستقلتين.
 */

import { el, cx, render, debounce } from "../../js/core/dom.js";
import { openOverlay } from "../modals/overlay.js";
import { icon } from "./icon.js";
import { flatScreens, navigation } from "../../js/config/navigation.js";
import { matchesQuery } from "../../js/core/text.js";
import { can } from "../../js/core/permissions.js";
import { navigate } from "../../js/core/router.js";
import { listCustomers } from "../../js/api/finance.api.js";
import { listItems } from "../../js/api/inventory.api.js";
import { listJournalEntries } from "../../js/api/accounting.api.js";
import { TABLE } from "../../js/core/config.js";
import * as fmt from "../../js/core/format.js";

/** شاشات مرشَّحة بالصلاحية — تُحسب مرة واحدة، القائمة لا تتغيّر أثناء الجلسة. */
const SCREENS = flatScreens().filter((screen) => can(screen.permission));

/** اختصارات تُعرض قبل أي كتابة — أكثر الوجهات استخدامًا يوميًا. */
const QUICK_PATHS = ["/", "/gl/journal", "/fin/customer-invoices", "/fin/receipts", "/inv/balances"];

export function openCommandPalette() {
  let selectedIndex = 0;
  /** كل عنصر قابل للتنقل الحالي، بالترتيب المعروض — للتنقل بالأسهم. */
  let flatItems = [];
  let searchToken = 0;

  const input = el("input", {
    type: "text",
    placeholder: "ابحث عن شاشة، عميل، صنف، أو رقم قيد…",
    class:
      "w-full bg-transparent text-base text-ink placeholder:text-faint outline-none h-12 px-1",
    autocomplete: "off",
    "aria-label": "بحث سريع",
    "aria-expanded": "true",
    role: "combobox",
    "aria-controls": "command-palette-results",
  });

  const resultsHost = el("div", {
    id: "command-palette-results",
    class: "max-h-[60vh] overflow-y-auto px-2 pb-2",
    role: "listbox",
  });

  const { close } = openOverlay({
    align: "top",
    dismissible: true,
    onClose: () => {
      onInput.cancel();
    },
    panel: (closeOverlay) => {
      const panel = el(
        "div",
        {
          class:
            "hx-rise glass w-full max-w-xl rounded-[var(--radius-card)] shadow-overlay " +
            "border border-line overflow-hidden flex flex-col",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "بحث سريع",
          tabindex: "-1",
        },
        el(
          "div",
          { class: "flex items-center gap-2.5 px-3.5 border-b border-line" },
          el("span", { class: "text-faint shrink-0" }, icon("search", { size: 18 })),
          input,
          el(
            "kbd",
            {
              class:
                "shrink-0 hidden sm:inline-block text-[10px] text-faint border border-line-strong " +
                "rounded px-1.5 py-0.5 num",
            },
            "Esc",
          ),
        ),
        resultsHost,
      );

      input.addEventListener("keydown", (evt) => {
        if (evt.key === "ArrowDown") {
          evt.preventDefault();
          moveSelection(1);
        } else if (evt.key === "ArrowUp") {
          evt.preventDefault();
          moveSelection(-1);
        } else if (evt.key === "Enter") {
          evt.preventDefault();
          activate(flatItems[selectedIndex]);
        }
      });

      // يُغلق عند النقر على أي نتيجة — تفويض حدث واحد بدل مستمع لكل عنصر.
      resultsHost.addEventListener("click", (evt) => {
        const row = evt.target.closest("[data-nav-path]");
        if (row) activate({ path: row.dataset.navPath });
      });

      function activate(item) {
        if (!item?.path) return;
        closeOverlay();
        navigate(item.path);
      }

      return panel;
    },
  });

  function moveSelection(delta) {
    if (!flatItems.length) return;
    selectedIndex = (selectedIndex + delta + flatItems.length) % flatItems.length;
    paintSelection();
  }

  function paintSelection() {
    const rows = [...resultsHost.querySelectorAll("[data-nav-path]")];
    rows.forEach((row, index) => {
      row.classList.toggle("bg-subtle", index === selectedIndex);
      row.setAttribute("aria-selected", String(index === selectedIndex));
    });
    rows[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }

  /* --------------------------------------------------------------------
     نتائج محلية فورية: الشاشات — لا تنتظر أي شبكة
     -------------------------------------------------------------------- */

  function screenMatches(query) {
    if (!query) {
      return QUICK_PATHS.map((path) => SCREENS.find((screen) => screen.path === path)).filter(Boolean);
    }
    return SCREENS.filter((screen) => matchesQuery(screen.label, query)).slice(0, 6);
  }

  /* --------------------------------------------------------------------
     نتائج شبكية مؤجَّلة: العملاء والأصناف والقيود
     -------------------------------------------------------------------- */

  async function runSearch(query) {
    const token = ++searchToken;

    const screens = screenMatches(query);
    const pending = query ? "loading" : [];
    paint({ screens, customers: pending, items: pending, entries: pending });

    if (!query) return; // لا نستدعي الشبكة من أجل شاشة فارغة

    /*
     * `allSettled` لا `all`: فشل بحث واحد لا يُسقط البقية. قسم يفشل يُعرض
     * كخطأ مستقل، والمستخدم يرى ما نجح — بدل لوحة فارغة بلا تفسير.
     */
    const [customers, items, entries] = await Promise.allSettled([
      listCustomers({ search: query, perPage: 4 }),
      listItems({ search: query, perPage: 4 }),
      listJournalEntries({ search: query, perPage: 4 }),
    ]);

    if (token !== searchToken) return; // استعلام أحدث سبقه

    const unwrap = (result) => (result.status === "fulfilled" ? result.value.data : "error");

    paint({
      screens,
      customers: unwrap(customers),
      items: unwrap(items),
      entries: unwrap(entries),
    });
  }

  const onInput = debounce((value) => runSearch(value.trim()), TABLE.searchDebounceMs);
  input.addEventListener("input", (evt) => onInput(evt.target.value));

  /* --------------------------------------------------------------------
     الرسم
     -------------------------------------------------------------------- */

  function paint({ screens, customers, items, entries }) {
    flatItems = [];
    selectedIndex = 0;

    const sections = [
      section("الشاشات", screens.map(screenRow), { emptyLabel: null }),
      section("العملاء", resolveRows(customers, customerRow), {
        emptyLabel: customers === "error" ? null : "لا عملاء مطابقون",
        error: customers === "error",
      }),
      section("الأصناف", resolveRows(items, itemRow), {
        emptyLabel: items === "error" ? null : "لا أصناف مطابقة",
        error: items === "error",
      }),
      section("قيود اليومية", resolveRows(entries, entryRow), {
        emptyLabel: entries === "error" ? null : "لا قيود مطابقة",
        error: entries === "error",
      }),
    ].filter(Boolean);

    if (!sections.length) {
      render(
        resultsHost,
        el(
          "div",
          { class: "py-10 text-center text-sm text-faint" },
          "اكتب للبحث في الشاشات والعملاء والأصناف والقيود",
        ),
      );
      return;
    }

    render(resultsHost, ...sections);
    paintSelection();
  }

  function resolveRows(value, mapRow) {
    if (value === "loading") return "loading";
    if (value === "error") return "error";
    return value.map(mapRow);
  }

  function section(title, rows, { emptyLabel, error } = {}) {
    if (rows === "loading") {
      return el(
        "div",
        { class: "px-2 pt-3" },
        sectionTitle(title),
        el(
          "div",
          { class: "space-y-1.5 px-1" },
          ...Array.from({ length: 2 }, () => el("div", { class: "hx-skeleton h-9 w-full" })),
        ),
      );
    }

    if (error) {
      return el(
        "div",
        { class: "px-2 pt-3" },
        sectionTitle(title),
        el("p", { class: "px-2.5 py-2 text-xs text-danger-300" }, `تعذّر البحث في ${title}.`),
      );
    }

    if (!rows.length) {
      return emptyLabel
        ? el(
            "div",
            { class: "px-2 pt-3" },
            sectionTitle(title),
            el("p", { class: "px-2.5 py-2 text-xs text-faint" }, emptyLabel),
          )
        : null;
    }

    flatItems.push(...rows.map((row) => row.item));

    return el("div", { class: "px-2 pt-3" }, sectionTitle(title), ...rows.map((row) => row.node));
  }

  function sectionTitle(title) {
    return el("p", { class: "px-2.5 pb-1 text-[11px] font-semibold text-faint" }, title);
  }

  function resultRow({ path, icon: iconName, primary, secondary }) {
    const item = { path };

    const node = el(
      "div",
      {
        class: cx(
          "flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] cursor-pointer",
          "text-sm text-ink hover:bg-subtle transition-colors",
        ),
        dataset: { navPath: path },
        role: "option",
      },
      el("span", { class: "shrink-0 text-faint" }, icon(iconName, { size: 16 })),
      el(
        "div",
        { class: "min-w-0 flex-1" },
        el("p", { class: "truncate-1" }, primary),
        secondary ? el("p", { class: "text-xs text-faint truncate-1" }, secondary) : null,
      ),
    );

    return { item, node };
  }

  function screenRow(screen) {
    const moduleIcon = navigation.find((entry) => entry.key === screen.module)?.icon ?? "dashboard";
    return resultRow({ path: screen.path, icon: moduleIcon, primary: screen.label, secondary: screen.moduleLabel });
  }

  /*
   * الوجهة هي المستند نفسه لا القائمة التي تحتويه: من يبحث عن «شركة النور»
   * يريد كشف حسابها، لا قائمة العملاء مفلترة باسمها. المسارات الثلاثة أدناه
   * كلها مسجَّلة في js/config/routes.js كمسارات ديناميكية، فلا رابط مكسور.
   */
  function customerRow(customer) {
    return resultRow({
      path: `/fin/customers/${customer.id}`,
      icon: "users",
      primary: customer.name,
      secondary: `${customer.code} — رصيد ${fmt.amount(customer.balance ?? 0)}`,
    });
  }

  function itemRow(item) {
    return resultRow({
      path: `/inv/items/${item.id}`,
      icon: "inventory",
      primary: item.name,
      secondary: `${item.code} — متاح ${fmt.integer(item.available ?? item.onHand ?? 0)} ${item.unit ?? ""}`,
    });
  }

  function entryRow(entry) {
    return resultRow({
      path: `/gl/journal/${entry.id}`,
      icon: "accounting",
      primary: entry.entryNumber,
      secondary: `${entry.description} — ${fmt.amount(entry.totalDebit)}`,
    });
  }

  paint({ screens: screenMatches(""), customers: [], items: [], entries: [] });
  input.focus();

  return close;
}
