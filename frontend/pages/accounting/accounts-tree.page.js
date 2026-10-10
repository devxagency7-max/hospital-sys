/**
 * شجرة الحسابات (Chart of Accounts)
 *
 * عرض شجري تفاعلي كامل للحسابات المحاسبية مصنفة حسب الأصول، الخصوم، حقوق الملكية،
 * الإيرادات، والمصروفات، مع إمكانية التوسيع والطي والبحث الفوري وإضافة حساب جديد.
 */

import { el, cx, render, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { icon } from "../../components/common/icon.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { listAccounts, createAccount } from "../../js/api/accounting.api.js";
import { searchInput, textField, select } from "../../components/forms/fields.js";
import { openModal } from "../../components/modals/overlay.js";
import { toast } from "../../components/feedback/toast.js";

const TYPE_NAMES = {
  asset: "أصول",
  liability: "خصوم",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

const TYPE_COLORS = {
  asset: "info",
  liability: "warning",
  equity: "brand",
  revenue: "success",
  expense: "danger",
};

export default async function accountsTreePage() {
  const container = el("div", { class: "space-y-4" });

  let accounts = [];
  let expanded = new Set([1, 11, 2, 21, 3, 4, 41, 5, 51]);
  let searchQuery = "";
  let activeTab = "all";

  // ترويسة الصفحة
  const header = pageHeader({
    title: "شجرة الحسابات العامة",
    description: "الدليل المحاسبي الموحد لمستشفى أمان الحياة وفق المعايير المحاسبية المعتمدة.",
    actions: [
      button({
        label: "توسيع الكل",
        variant: "subtle",
        icon: "folder",
        onClick: () => {
          accounts.forEach((a) => expanded.add(a.id));
          renderTree();
        },
      }),
      button({
        label: "طي الكل",
        variant: "subtle",
        onClick: () => {
          expanded.clear();
          renderTree();
        },
      }),
      button({
        label: "إضافة حساب",
        variant: "primary",
        icon: "plus",
        onClick: () => showAddAccountModal(accounts, async () => {
          await loadData();
          renderTree();
        }),
      }),
    ],
  });
  container.appendChild(header);

  // شريط المؤشرات المالية
  const statsContainer = el("div", { class: "grid grid-cols-2 md:grid-cols-5 gap-3" });
  container.appendChild(statsContainer);

  function updateStats() {
    const assets = accounts.find((a) => a.code === "1")?.balance || 0;
    const liabilities = accounts.find((a) => a.code === "2")?.balance || 0;
    const equity = accounts.find((a) => a.code === "3")?.balance || 0;
    const revenue = accounts.find((a) => a.code === "4")?.balance || 0;
    const expenses = accounts.find((a) => a.code === "5")?.balance || 0;

    clear(statsContainer);
    statsContainer.appendChild(statTile({ label: "إجمالي الأصول", value: currency(assets), tone: "info", icon: "billing" }));
    statsContainer.appendChild(statTile({ label: "إجمالي الخصوم", value: currency(liabilities), tone: "warning", icon: "shield" }));
    statsContainer.appendChild(statTile({ label: "حقوق الملكية", value: currency(equity), tone: "brand", icon: "receipt" }));
    statsContainer.appendChild(statTile({ label: "إجمالي الإيرادات", value: currency(revenue), tone: "success", icon: "check" }));
    statsContainer.appendChild(statTile({ label: "إجمالي المصروفات", value: currency(expenses), tone: "danger", icon: "x" }));
  }

  // فلترة وبحث
  const filterToolbar = el(
    "div",
    { class: "flex flex-wrap items-center justify-between gap-3 bg-surface/80 p-3 rounded-2xl border border-line" },
    el(
      "div",
      { class: "flex items-center gap-1.5 overflow-x-auto" },
      ...["all", "asset", "liability", "equity", "revenue", "expense"].map((tab) => {
        const labels = {
          all: "كل الحسابات",
          asset: "الأصول (1)",
          liability: "الخصوم (2)",
          equity: "حقوق الملكية (3)",
          revenue: "الإيرادات (4)",
          expense: "المصروفات (5)",
        };
        const btn = el(
          "button",
          {
            class: cx(
              "px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap",
              activeTab === tab
                ? "bg-brand-600 text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-subtle",
            ),
            onClick: () => {
              activeTab = tab;
              Array.from(btn.parentElement.children).forEach((c) =>
                c.classList.remove("bg-brand-600", "text-white", "shadow-sm"),
              );
              btn.classList.add("bg-brand-600", "text-white", "shadow-sm");
              renderTree();
            },
          },
          labels[tab],
        );
        return btn;
      }),
    ),
    el(
      "div",
      { class: "w-72" },
      searchInput({
        placeholder: "بحث بالكود أو اسم الحساب…",
        onInput: (q) => {
          searchQuery = q.trim().toLowerCase();
          if (searchQuery) accounts.forEach((a) => expanded.add(a.id));
          renderTree();
        },
      }),
    ),
  );
  container.appendChild(filterToolbar);

  // هيكل الشجرة
  const treeContainer = el("div", { class: "space-y-1.5 min-h-[400px]" });
  const treeCard = card({
    title: "هيكل الدليل المحاسبي",
    subtitle: "عرض هرمي تفاعلي بمستويات الحسابات (رئيسي، فرعي، تفصيلي)",
    body: treeContainer,
  });
  container.appendChild(treeCard);

  function renderTree() {
    clear(treeContainer);

    let filtered = accounts;
    if (activeTab !== "all") {
      filtered = accounts.filter((a) => a.type === activeTab || a.code.startsWith(activeTab === "asset" ? "1" : activeTab === "liability" ? "2" : activeTab === "equity" ? "3" : activeTab === "revenue" ? "4" : "5"));
    }
    if (searchQuery) {
      filtered = accounts.filter((a) => a.name.toLowerCase().includes(searchQuery) || a.code.includes(searchQuery));
    }

    // بناء خريطة الأبناء
    const rootAccounts = filtered.filter((a) => !a.parentId || !accounts.some((p) => p.id === a.parentId && filtered.includes(p)));

    if (!rootAccounts.length) {
      treeContainer.appendChild(
        el("div", { class: "py-12 text-center text-muted text-sm" }, "لا توجد حسابات مطابقة للبحث"),
      );
      return;
    }

    function createNode(acc) {
      const children = accounts.filter((child) => child.parentId === acc.id);
      const hasChildren = children.length > 0;
      const isExpanded = expanded.has(acc.id);

      const row = el(
        "div",
        {
          class: cx(
            "group flex items-center justify-between p-2.5 rounded-xl transition-colors text-xs border border-transparent",
            acc.level === 1
              ? "bg-brand-50/50 font-bold border-brand-200/50 text-ink"
              : acc.level === 2
                ? "bg-white/60 font-semibold text-ink"
                : "hover:bg-white/80 text-muted hover:text-ink",
          ),
          style: `margin-right: ${(acc.level - 1) * 1.5}rem`,
        },
        el(
          "div",
          { class: "flex items-center gap-2 min-w-0" },
          hasChildren
            ? el(
                "button",
                {
                  class: "p-1 rounded hover:bg-black/5 text-muted transition-transform",
                  onClick: () => {
                    if (isExpanded) expanded.delete(acc.id);
                    else expanded.add(acc.id);
                    renderTree();
                  },
                },
                icon(isExpanded ? "chevronDown" : "chevronStart", { size: 14 }),
              )
            : el("span", { class: "w-5 shrink-0" }),
          ref(acc.code, { class: "px-2 py-0.5 rounded bg-subtle text-ink font-mono text-[11px]" }),
          el("span", { class: "font-medium text-ink" }, acc.name),
          badge(TYPE_NAMES[acc.type] || acc.type, { tone: TYPE_COLORS[acc.type] || "neutral", size: "sm" }),
          acc.nature
            ? badge(acc.nature === "debit" ? "مدين" : "دائن", { tone: acc.nature === "debit" ? "info" : "warning", size: "sm" })
            : null,
        ),
        el(
          "div",
          { class: "flex items-center gap-3 shrink-0" },
          el(
            "span",
            { class: "font-mono font-semibold text-ink tabular" },
            currency(acc.balance),
          ),
          button({
            label: "+ فرعي",
            variant: "ghost",
            size: "sm",
            class: "opacity-0 group-hover:opacity-100 transition-opacity",
            onClick: () => showAddAccountModal(accounts, async () => {
              await loadData();
              renderTree();
            }, acc),
          }),
        ),
      );

      const nodeWrapper = el("div", { class: "space-y-1" }, row);

      if (hasChildren && isExpanded) {
        const childrenContainer = el("div", { class: "space-y-1 pr-2 border-r-2 border-line/40 my-1" });
        children.forEach((child) => childrenContainer.appendChild(createNode(child)));
        nodeWrapper.appendChild(childrenContainer);
      }

      return nodeWrapper;
    }

    rootAccounts.forEach((acc) => treeContainer.appendChild(createNode(acc)));
  }

  async function loadData() {
    try {
      const res = await listAccounts({ perPage: 200 });
      accounts = res.data || [];
      updateStats();
    } catch (err) {
      toast.error("تعذر تحميل شجرة الحسابات");
    }
  }

  await loadData();
  renderTree();

  return container;
}

function showAddAccountModal(accounts, onSaved, parentAccount = null) {
  let nameVal = "";
  let codeVal = parentAccount ? `${parentAccount.code}${accounts.filter((a) => a.parentId === parentAccount.id).length + 1}` : "";
  let typeVal = parentAccount?.type || "asset";
  let natureVal = parentAccount?.nature || "debit";
  let parentIdVal = parentAccount?.id || "";

  openModal({
    title: parentAccount ? `إضافة حساب فرعي تحت: ${parentAccount.name}` : "إضافة حساب جديد",
    size: "md",
    body: (close) => {
      return el(
        "div",
        { class: "space-y-3.5 p-1" },
        textField({
          label: "رمز الحساب (الكود)",
          value: codeVal,
          required: true,
          onInput: (v) => (codeVal = v),
        }),
        textField({
          label: "اسم الحساب بالكامل",
          value: nameVal,
          required: true,
          placeholder: "مثال: حساب جاري بنك الإسكندرية",
          onInput: (v) => (nameVal = v),
        }),
        select({
          label: "نوع الحساب",
          value: typeVal,
          options: [
            { value: "asset", label: "أصول" },
            { value: "liability", label: "خصوم" },
            { value: "equity", label: "حقوق ملكية" },
            { value: "revenue", label: "إيرادات" },
            { value: "expense", label: "مصروفات" },
          ],
          onChange: (v) => (typeVal = v),
        }),
        select({
          label: "طبيعة الحساب",
          value: natureVal,
          options: [
            { value: "debit", label: "مدين" },
            { value: "credit", label: "دائن" },
          ],
          onChange: (v) => (natureVal = v),
        }),
      );
    },
    footer: (close) => [
      button({ label: "إلغاء", variant: "subtle", onClick: () => close() }),
      button({
        label: "حفظ الحساب",
        variant: "primary",
        onClick: async () => {
          if (!nameVal.trim() || !codeVal.trim()) {
            toast.warning("يرجى إدخال اسم الحساب وكوده");
            return;
          }
          try {
            await createAccount({
              name: nameVal.trim(),
              code: codeVal.trim(),
              type: typeVal,
              nature: natureVal,
              parentId: parentIdVal ? Number(parentIdVal) : null,
              level: parentAccount ? (parentAccount.level || 1) + 1 : 1,
            });
            toast.success("تمت إضافة الحساب بنجاح إلى الدليل");
            close();
            onSaved();
          } catch (err) {
            toast.error("حدث خطأ أثناء حفظ الحساب");
          }
        },
      }),
    ],
  });
}
