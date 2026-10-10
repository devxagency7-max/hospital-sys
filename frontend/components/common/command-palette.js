/**
 * لوحة البحث السريع (Command Palette).
 *
 * بحث واحد يغطي ثلاثة مصادر حقيقية: شاشات النظام (محليًا من خريطة التنقل)،
 * والمرضى والفواتير (عبر الـ API الفعلي، بنفس طبقة البيانات التي تستخدمها
 * الجداول). لا نتائج مُختلقة — فراغ كلمة البحث يُظهر اختصارات شائعة فقط،
 * وكل قسم يملك حالتي تحميل وفراغ مستقلتين.
 */

import { el, cx, render, debounce } from "../../js/core/dom.js";
import { openOverlay } from "../modals/overlay.js";
import { icon } from "./icon.js";
import { flatScreens, navigation } from "../../js/config/navigation.js";
import { matchesQuery } from "../../js/core/text.js";
import { can } from "../../js/core/permissions.js";
import { navigate } from "../../js/core/router.js";
import { listPatients } from "../../js/api/patients.api.js";
import { listInvoices } from "../../js/api/billing.api.js";
import { TABLE } from "../../js/core/config.js";
import * as fmt from "../../js/core/format.js";

/** شاشات مرشَّحة بالصلاحية — تُحسب مرة واحدة، القائمة لا تتغيّر أثناء الجلسة. */
const SCREENS = flatScreens().filter((screen) => can(screen.permission));

/** اختصارات تُعرض قبل أي كتابة — أكثر الوجهات استخدامًا يوميًا. */
const QUICK_PATHS = ["/", "/patients", "/billing/invoices", "/billing/outstanding"];

export function openCommandPalette() {
  let selectedIndex = 0;
  /** كل عنصر قابل للتنقل الحالي، بالترتيب المعروض — للتنقل بالأسهم. */
  let flatItems = [];
  let searchToken = 0;

  const input = el("input", {
    type: "text",
    placeholder: "ابحث عن شاشة، مريض، أو رقم فاتورة…",
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
     نتائج شبكية مؤجَّلة: المرضى والفواتير
     -------------------------------------------------------------------- */

  async function runSearch(query) {
    const token = ++searchToken;

    const screens = screenMatches(query);
    paint({ screens, patients: query ? "loading" : [], invoices: query ? "loading" : [] });

    if (!query) return; // لا نستدعي الشبكة من أجل شاشة فارغة

    const [patientsResult, invoicesResult] = await Promise.allSettled([
      listPatients({ search: query, perPage: 5 }),
      listInvoices({ search: query, perPage: 5 }),
    ]);

    if (token !== searchToken) return; // استعلام أحدث سبقه

    paint({
      screens,
      patients: patientsResult.status === "fulfilled" ? patientsResult.value.data : "error",
      invoices: invoicesResult.status === "fulfilled" ? invoicesResult.value.data : "error",
    });
  }

  const onInput = debounce((value) => runSearch(value.trim()), TABLE.searchDebounceMs);
  input.addEventListener("input", (evt) => onInput(evt.target.value));

  /* --------------------------------------------------------------------
     الرسم
     -------------------------------------------------------------------- */

  function paint({ screens, patients, invoices }) {
    flatItems = [];
    selectedIndex = 0;

    const sections = [
      section("الشاشات", screens.map(screenRow), { emptyLabel: null }),
      section("المرضى", resolveRows(patients, patientRow), {
        emptyLabel: patients === "error" ? null : "لا مرضى مطابقون",
        error: patients === "error",
      }),
      section("الفواتير", resolveRows(invoices, invoiceRow), {
        emptyLabel: invoices === "error" ? null : "لا فواتير مطابقة",
        error: invoices === "error",
      }),
    ].filter(Boolean);

    if (!sections.length) {
      render(
        resultsHost,
        el(
          "div",
          { class: "py-10 text-center text-sm text-faint" },
          "اكتب للبحث في الشاشات والمرضى والفواتير",
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
   * الوجهة قائمة المريض لا ملفه الشخصي: شاشة تفاصيل المريض (`/patients/:id`)
   * لم تُبنَ بعد — توجيه النتيجة إليها كان سيصطدم بـ 404 حقيقي. القائمة
   * مسجَّلة فعلًا (كصفحة «مخطَّطة» صريحة حتى تُبنى)، فلا رابط مكسور.
   * معامل `search` تمهيدي يبقى بلا أثر الآن حتى تُبنى الشاشة الفعلية.
   */
  function patientRow(patient) {
    return resultRow({
      path: `/patients?search=${encodeURIComponent(patient.patientCode)}`,
      icon: "patients",
      primary: patient.name,
      secondary: `${patient.patientCode} — ${fmt.phone(patient.phone)}`,
    });
  }

  function invoiceRow(invoice) {
    return resultRow({
      path: `/billing/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`,
      icon: "billing",
      primary: invoice.invoiceNumber,
      secondary: `${invoice.patientName} — ${fmt.amount(invoice.total)}`,
    });
  }

  paint({ screens: screenMatches(""), patients: [], invoices: [] });
  input.focus();

  return close;
}
