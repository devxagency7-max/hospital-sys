/**
 * تفضيلات وسياسات النظام.
 *
 * إدارة قواعد العمل والتشغيل المالي والمخزني وسياسات الاعتماد والترحيل.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { getPreferences, updatePreferences } from "../../js/api/settings.api.js";

export default async function preferencesPage() {
  const prefs = await getPreferences().catch(() => ({}));

  const state = {
    requireJournalApproval: prefs.requireJournalApproval ?? true,
    allowPostingToClosedPeriods: prefs.allowPostingToClosedPeriods ?? false,
    autoPostModuleDocuments: prefs.autoPostModuleDocuments ?? true,
    allowNegativeInventory: prefs.allowNegativeInventory ?? false,
    requireAdjustmentApproval: prefs.requireAdjustmentApproval ?? true,
    enforceWarehousePermissions: prefs.enforceWarehousePermissions ?? true,
    defaultCostingMethod: prefs.defaultCostingMethod ?? "weighted_average",
    nearExpiryWarningDays: prefs.nearExpiryWarningDays ?? 90,
    journalNumberPrefix: prefs.journalNumberPrefix ?? "JV",
    invoiceNumberPrefix: prefs.invoiceNumberPrefix ?? "SI",
    maxAdvanceInstalments: prefs.maxAdvanceInstalments ?? 12,
  };

  const container = el("div", { class: "page-container page-preferences", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "تفضيلات وسياسات النظام"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "ضبط محددات التشغيل، الرقابة على الصرف، وسياسات الترحيل والاعتماد المحاسبي.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "الربط المحاسبي",
        variant: "secondary",
        icon: "settings",
        onClick: () => navigate("/settings/posting-map"),
      }),
      button({
        label: "حفظ السياسات والتفضيلات",
        variant: "primary",
        icon: "check",
        onClick: handleSave,
      })
    )
  );

  const grid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;",
  });

  // 1. سياسات المحاسبة والقيود
  const glCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "المحاسبة العامة والقيود")
  );

  glCard.appendChild(createToggle("طلب اعتماد المدير المالي لقيود اليومية اليدوية", state.requireJournalApproval, (val) => { state.requireJournalApproval = val; }));
  glCard.appendChild(createToggle("السماح بالترحيل للفترات المحاسبية المغلقة (ممنوع افتراضياً)", state.allowPostingToClosedPeriods, (val) => { state.allowPostingToClosedPeriods = val; }));
  glCard.appendChild(createToggle("الترحيل التلقائي للمستندات التشغيلية (فواتير، رواتب، مخازن)", state.autoPostModuleDocuments, (val) => { state.autoPostModuleDocuments = val; }));
  glCard.appendChild(createInput("بادئة ترقيم قيود اليومية", state.journalNumberPrefix, (val) => { state.journalNumberPrefix = val; }));

  grid.appendChild(glCard);

  // 2. سياسات المخازن والرقابة السلعية
  const invCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "المخازن والرقابة السلعية")
  );

  invCard.appendChild(createToggle("السماح بالرصيد السالب بالمخازن (ممنوع للحفاظ على دقة التكلفة)", state.allowNegativeInventory, (val) => { state.allowNegativeInventory = val; }));
  invCard.appendChild(createToggle("طلب اعتماد الإدارة لتسويات الجرد والعجز المخزني", state.requireAdjustmentApproval, (val) => { state.requireAdjustmentApproval = val; }));
  invCard.appendChild(createToggle("تقييد حركات الصرف والإضافة بصلاحيات أمين المخزن المسؤول", state.enforceWarehousePermissions, (val) => { state.enforceWarehousePermissions = val; }));
  invCard.appendChild(createInput("عدد أيام التحذير المبكر لانتهاء الصلاحية", state.nearExpiryWarningDays, (val) => { state.nearExpiryWarningDays = parseInt(val, 10) || 90; }, "number"));

  grid.appendChild(invCard);

  // 3. سياسات الفوترة والائتمان
  const finCard = el(
    "div",
    {
      class: "surface-card",
      style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
    },
    el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;" }, "الفوترة والموارد البشرية")
  );

  finCard.appendChild(createInput("بادئة ترقيم فواتير العملاء", state.invoiceNumberPrefix, (val) => { state.invoiceNumberPrefix = val; }));
  finCard.appendChild(createInput("الحد الأقصى لعدد أقساط سلف الموظفين (أشهر)", state.maxAdvanceInstalments, (val) => { state.maxAdvanceInstalments = parseInt(val, 10) || 12; }, "number"));

  grid.appendChild(finCard);

  function createToggle(label, initialVal, onChange) {
    const row = el(
      "label",
      {
        style: "display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-color); cursor: pointer;",
      },
      el("span", { style: "font-size: 0.875rem; color: var(--text-primary); font-weight: 500;" }, label),
      (() => {
        const chk = el("input", { type: "checkbox", style: "width: 1.25rem; height: 1.25rem; cursor: pointer;" });
        chk.checked = Boolean(initialVal);
        chk.addEventListener("change", (e) => onChange(e.target.checked));
        return chk;
      })()
    );
    return row;
  }

  function createInput(label, initialVal, onChange, type = "text") {
    const row = el(
      "div",
      { style: "padding: 0.75rem 0;" },
      el("label", { style: "display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.25rem;" }, label),
      (() => {
        const inp = el("input", {
          type,
          value: initialVal,
          class: "form-input",
          style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
        });
        inp.addEventListener("input", (e) => onChange(e.target.value));
        return inp;
      })()
    );
    return row;
  }

  async function handleSave() {
    try {
      await updatePreferences(state);
      toast.success("تم حفظ وتطبيق تفضيلات وسياسات النظام بنجاح.");
    } catch (err) {
      toast.error(err.message ?? "تعذر حفظ التفضيلات.");
    }
  }

  container.appendChild(header);
  container.appendChild(grid);

  return container;
}
