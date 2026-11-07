/**
 * خريطة الربط المحاسبي (Posting Map).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  شاشة حرجة: الربط الناقص يُعطّل أي ترحيل محاسبي يمس الحساب غير المُعَد.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ترجمة 21 حدث عمل إلى سطور قيد تمر عبر هذه الخريطة لضمان أن دليل الحسابات
 * مستقل وقابل للإعداد لأي منشأة دون تثبيت أكواد صلبة في الكود.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { button, iconButton } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile, statGrid, card } from "../../components/common/card.js";
import { alert } from "../../components/feedback/alert.js";
import { toast } from "../../components/feedback/toast.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { code } from "../../components/common/value.js";
import { integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { getPostingMap, updatePostingMap } from "../../js/api/settings.api.js";
import { getAccounts, toAccountOptions } from "../../js/api/lookups.api.js";

const GROUPS = [
  {
    id: "cash",
    title: "1. النقدية والبنوك",
    description: "حسابات الصناديق النقدية والحسابات الجارية والنقدية المنقولة.",
    keys: ["cashOnHand", "bankAccounts", "cashInTransit"],
  },
  {
    id: "ar_ap",
    title: "2. العملاء والموردون",
    description: "ذمم المدينين والدائنين والدفعات المقدمة للأطراف.",
    keys: ["accountsReceivable", "accountsPayable", "advancesFromCustomers", "advancesToSuppliers"],
  },
  {
    id: "sales",
    title: "3. الإيرادات والمبيعات",
    description: "إيرادات المبيعات والخدمات ومردوداتها والخصومات الممنوحة.",
    keys: ["salesRevenue", "serviceRevenue", "salesReturns", "salesDiscounts", "otherIncome"],
  },
  {
    id: "inventory",
    title: "4. المخزون وتكلفة المبيعات",
    description: "حسابات المخزون وتكلفة البضاعة المباعة وعجز وفائض التسويات.",
    keys: ["inventory", "goodsReceivedNotInvoiced", "costOfGoodsSold", "inventoryShrinkage", "inventorySurplus", "purchaseReturns"],
  },
  {
    id: "taxes",
    title: "5. الضرائب والرسوم",
    description: "ضريبة القيمة المضافة (مدخلات ومخرجات) وضريبة الخصم وكسب العمل.",
    keys: ["outputVat", "inputVat", "withholdingTax", "payrollTaxPayable"],
  },
  {
    id: "payroll",
    title: "6. الرواتب والموارد البشرية",
    description: "مصروفات الرواتب والبدلات والإضافي والتأمينات، والالتزامات والسلف.",
    keys: [
      "salariesExpense",
      "allowancesExpense",
      "overtimeExpense",
      "employerSocialInsuranceExpense",
      "salariesPayable",
      "socialInsurancePayable",
      "employeeAdvances",
      "payrollDeductionsPayable",
    ],
  },
  {
    id: "assets",
    title: "7. الأصول الثابتة والإهلاك",
    description: "الأصول الثابتة ومجمعات الإهلاك ومصروف الإهلاك وأرباح/خسائر الاستبعاد.",
    keys: ["fixedAssets", "accumulatedDepreciation", "depreciationExpense", "gainOnAssetDisposal", "lossOnAssetDisposal"],
  },
  {
    id: "closing",
    title: "8. الإغلاق وحسابات النتيجة",
    description: "الأرباح المرحلة وملخص الدخل لإقفال السنة المالية.",
    keys: ["retainedEarnings", "incomeSummary"],
  },
];

export default async function postingMapPage() {
  const [mapItems, accounts] = await Promise.all([
    getPostingMap(),
    getAccounts(),
  ]);

  const accountOptions = toAccountOptions(accounts);
  const currentMap = {};
  mapItems.forEach((item) => {
    currentMap[item.key] = item.accountId ? String(item.accountId) : "";
  });

  const container = el("div", { class: "space-y-5" });
  let isSaving = false;

  /* --- الترويسة --- */
  const saveBtn = button({
    label: "حفظ خريطة الربط",
    variant: "primary",
    icon: "check",
    permission: "admin.settings.manage",
    onClick: async () => {
      if (isSaving) return;
      isSaving = true;
      saveBtn.disabled = true;
      try {
        const payload = {};
        for (const [k, v] of Object.entries(currentMap)) {
          if (v) payload[k] = Number(v);
        }
        await updatePostingMap(payload);
        toast("تم حفظ خريطة الربط المحاسبي وتحديث الدليل بنجاح.", { tone: "success" });
        refreshStatus();
      } catch (err) {
        toast(err.message || "فشل حفظ خريطة الربط.", { tone: "danger" });
      } finally {
        isSaving = false;
        saveBtn.disabled = false;
      }
    },
  });

  container.appendChild(
    pageHeader({
      title: "خريطة الربط المحاسبي",
      description: "ربط أحداث موديولات النظام بالحسابات الرقابية؛ أي مفتاح ناقص يُعطّل الترحيل فورًا لمنع الترحيل لحسابات خاطئة.",
      actions: [
        saveBtn,
        button({
          label: "دليل الحسابات",
          variant: "secondary",
          icon: "reports",
          onClick: () => navigate("/gl/accounts"),
        }),
      ],
    }),
  );

  /* --- مؤشرات الربط والتحذيرات --- */
  const statsHost = el("div");
  const alertHost = el("div");
  container.appendChild(statsHost);
  container.appendChild(alertHost);

  function refreshStatus() {
    clear(statsHost);
    clear(alertHost);

    const configuredCount = Object.values(currentMap).filter(Boolean).length;
    const totalKeys = mapItems.length;
    const missingCount = totalKeys - configuredCount;

    statsHost.appendChild(
      statGrid(
        statTile({
          label: "إجمالي مفاتيح الربط",
          value: integer(totalKeys),
          tone: "neutral",
          icon: "box",
        }),
        statTile({
          label: "مفاتيح مربوطة بنجاح",
          value: integer(configuredCount),
          tone: "success",
          icon: "checkCircle",
        }),
        statTile({
          label: "مفاتيح غير مربوطة",
          value: integer(missingCount),
          hint: missingCount > 0 ? "تُعطّل الترحيل المحاسبي المرتبط بها" : "الخريطة مكتملة بالكامل",
          tone: missingCount > 0 ? "danger" : "success",
          icon: missingCount > 0 ? "alertTriangle" : "check",
        }),
      ),
    );

    if (missingCount > 0) {
      alertHost.appendChild(
        alert({
          tone: "warning",
          title: `يوجد ${integer(missingCount)} مفتاح ربط غير مربوط بحساب رقابي`,
          message:
            "الترحيل الآلي يرفض أي مستند يحتاج حسابًا غير مُعَد. اختر الحساب الرقابي المناسب من القائمة لكل مفتاح ثم احفظ التعديلات.",
        }),
      );
    }
  }

  refreshStatus();

  /* --- أقسام الخريطة حسب الموديول --- */
  const itemByKey = new Map(mapItems.map((item) => [item.key, item]));

  for (const group of GROUPS) {
    const groupItems = group.keys
      .map((key) => itemByKey.get(key))
      .filter(Boolean);

    if (!groupItems.length) continue;

    const rowsContainer = el("div", { class: "divide-y divide-line/60" });

    groupItems.forEach((item) => {
      const badgeHost = el("span");

      function updateItemBadge() {
        clear(badgeHost);
        const configured = Boolean(currentMap[item.key]);
        badgeHost.appendChild(
          configured
            ? badge("مربوط", { tone: "success", size: "sm" })
            : badge("غير مُعَد — يُعطّل الترحيل", { tone: "danger", size: "sm" }),
        );
      }
      updateItemBadge();

      const selectEl = el(
        "select",
        {
          class:
            "w-full sm:w-80 px-3 py-2 text-xs rounded-[var(--radius-control)] border border-line " +
            "bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow",
          onChange: (evt) => {
            currentMap[item.key] = evt.target.value;
            updateItemBadge();
            refreshStatus();
          },
        },
        el("option", { value: "" }, "— اختر الحساب الرقابي —"),
        ...accountOptions.map((opt) =>
          el(
            "option",
            {
              value: String(opt.value),
              selected: String(opt.value) === String(currentMap[item.key]),
            },
            opt.label,
          ),
        ),
      );

      const row = el(
        "div",
        { class: "py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start" },
        el(
          "div",
          { class: "min-w-0 space-y-1" },
          el(
            "div",
            { class: "flex items-center gap-2" },
            el("span", { class: "text-sm font-semibold text-ink" }, item.label),
            badgeHost,
          ),
          el("div", { class: "flex items-center gap-2 text-xs text-muted" },
            el("span", {}, "المفتاح البرمجي:"),
            code(item.key),
          ),
        ),
        el("div", { class: "shrink-0" }, selectEl),
      );

      rowsContainer.appendChild(row);
    });

    container.appendChild(
      card({
        title: group.title,
        subtitle: group.description,
        body: rowsContainer,
      }),
    );
  }

  return container;
}
