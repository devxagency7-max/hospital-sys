/**
 * الإهلاك الدوري للأصول الثابتة.
 *
 * حساب ومعاينة الإهلاك الشهري للأصول، تطبيق حدود الخردة، وتوليد قيود الإهلاك الآلية.
 */

import { el, clear } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { amount, integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import {
  previewDepreciation,
  runDepreciation,
  listDepreciationRuns,
} from "../../js/api/finance.api.js";

export default async function depreciationPage() {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  let selectedPeriod = currentPeriod;

  const container = el("div", { class: "page-container page-depreciation", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "الإهلاك الدوري للأصول"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.875rem;" }, "معاينة وتشغيل دورة إهلاك الأصول الثابتة وتوليد قيد الإهلاك المحاسبي الشهري.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "سجل الأصول الثابتة",
        variant: "secondary",
        icon: "inventory",
        onClick: () => navigate("/fin/assets"),
      }),
      button({
        label: "قيود اليومية",
        variant: "ghost",
        icon: "reports",
        onClick: () => navigate("/gl/journal"),
      })
    )
  );

  // شريط اختيار الفترة
  const periodBar = el(
    "div",
    {
      class: "surface-card",
      style: "padding: 1rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;",
    },
    el(
      "div",
      { style: "display: flex; align-items: center; gap: 1rem;" },
      el("label", { style: "font-weight: 600; color: var(--text-primary); font-size: 0.9375rem;" }, "فترة الإهلاك:"),
      (() => {
        const inp = el("input", {
          type: "month",
          class: "form-input",
          value: selectedPeriod,
          style: "padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); font-weight: 600;",
        });
        inp.addEventListener("change", (e) => {
          selectedPeriod = e.target.value;
          loadPreview();
        });
        return inp;
      })()
    ),
    el("div", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "يحسب النظام الإهلاك بالقسط الثابت مع مراعاة قيمة الخردة وحد الاستبعاد")
  );

  const previewHost = el("div", { class: "depreciation-preview-host" });

  async function loadPreview() {
    clear(previewHost);
    previewHost.appendChild(
      el("div", { style: "padding: 3rem; text-align: center; color: var(--text-muted);" }, "جاري تجهيز معاينة الإهلاك…")
    );

    try {
      const [preview, runsRes] = await Promise.all([
        previewDepreciation({ period: selectedPeriod }),
        listDepreciationRuns({ perPage: 20 }),
      ]);
      const pastRuns = runsRes.data ?? [];

      clear(previewHost);

      // بطاقات الإحصاءات
      const statsRow = el(
        "div",
        { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;" },
        statTile({
          label: `إهلاك شهر ${selectedPeriod}`,
          value: amount(preview.totalDepreciation ?? 0),
          hint: "القسط الشهري المحسوب",
          trend: "neutral",
        }),
        statTile({
          label: "الأصول المشمولة بالإهلاك",
          value: integer(preview.assetsCount ?? 0),
          hint: "أصول نشطة قيد الخدمة",
        }),
        statTile({
          label: "الأصول المستثناة",
          value: integer(preview.skipped?.length ?? 0),
          hint: "مهلكة بالكامل أو مستبعدة",
        })
      );
      previewHost.appendChild(statsRow);

      // شريط الإجراء
      const actionCard = el(
        "div",
        {
          class: "surface-card",
          style: `padding: 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border: 1px solid ${
            preview.alreadyRun ? "var(--warning-border, #fcd34d)" : "var(--border-color)"
          }; background: ${preview.alreadyRun ? "var(--warning-bg, #fffbeb)" : "var(--bg-surface)"};`,
        },
        el(
          "div",
          null,
          el(
            "h3",
            { style: "font-weight: 700; font-size: 0.9375rem; margin-bottom: 0.25rem; color: var(--text-primary);" },
            preview.alreadyRun ? "تم تشغيل وترحيل إهلاك هذه الفترة مسبقاً" : "جاهز لتشغيل الإهلاك الدوري"
          ),
          el(
            "p",
            { style: "font-size: 0.8125rem; color: var(--text-secondary); margin: 0;" },
            preview.alreadyRun
              ? `تم الترحيل في ${preview.existingRun?.postedAt?.slice(0, 10) ?? "تاريخ سابق"} برقم ${preview.existingRun?.runNumber ?? ""}.`
              : "سيقوم النظام بتوليد قيد الإهلاك المحاسبي وتحديث مجمع الإهلاك لكل أصل."
          )
        ),
        preview.alreadyRun
          ? badge("مُرحّل ومُعتمد", { variant: "warning" })
          : button({
              label: "تشغيل الإهلاك الدوري وترحيله",
              variant: "primary",
              icon: "check",
              disabled: (preview.assetsCount ?? 0) === 0,
              onClick: async () => {
                try {
                  await runDepreciation({ period: selectedPeriod });
                  toast.success(`تم تشغيل إهلاك الفترة ${selectedPeriod} وترحيل القيد المحاسبي بنجاح.`);
                  loadPreview();
                } catch (err) {
                  toast.error(err.message ?? "تعذر تشغيل الإهلاك.");
                }
              },
            })
      );
      previewHost.appendChild(actionCard);

      // جدول تفاصيل إهلاك الأصول للفترة
      const tableCard = el(
        "div",
        {
          class: "surface-card",
          style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1.5rem;",
        },
        el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "تفاصيل إهلاك أصول المنشأة لهذه الفترة")
      );

      const table = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
      const thead = el(
        "thead",
        null,
        el(
          "tr",
          { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "كود الأصل"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "اسم الأصل"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "تكلفة الاقتناء"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "مجمع الإهلاك السابق"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "إهلاك هذه الفترة"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "مجمع الإهلاك اللاحق"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "صافي القيمة الدفترية")
        )
      );
      const tbody = el("tbody", null);

      const rows = preview.rows ?? [];
      if (!rows.length) {
        tbody.appendChild(
          el("tr", null, el("td", { colspan: 7, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "لا توجد أصول مستحقة للإهلاك في هذه الفترة."))
        );
      } else {
        rows.forEach((r) => {
          const tr = el(
            "tr",
            { style: "border-bottom: 1px solid var(--border-color);" },
            el("td", { style: "padding: 0.5rem 0.75rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, r.assetCode)),
            el("td", { style: "padding: 0.5rem 0.75rem; font-weight: 500;" }, r.assetName),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.cost))),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.accumulatedBefore))),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: left; font-weight: 700; color: var(--primary);" }, el("span", { class: "ltr-isolate" }, amount(r.depreciationAmount))),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, el("span", { class: "ltr-isolate" }, amount(r.accumulatedAfter))),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(r.bookValueAfter)))
          );
          tbody.appendChild(tr);
        });
      }

      table.appendChild(thead);
      table.appendChild(tbody);
      tableCard.appendChild(table);
      previewHost.appendChild(tableCard);

      // سجل تشغيلات الإهلاك السابقة
      const historyCard = el(
        "div",
        {
          class: "surface-card",
          style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.5rem;",
        },
        el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin-bottom: 1rem;" }, "سجل تشغيلات الإهلاك السابقة")
      );

      const hTable = el("table", { class: "data-table", style: "width: 100%; border-collapse: collapse;" });
      const hThead = el(
        "thead",
        null,
        el(
          "tr",
          { style: "background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);" },
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "رقم التشغيل"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "الفترة"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: right;" }, "تاريخ الترحيل"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, "عدد الأصول"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: left;" }, "إجمالي الإهلاك"),
          el("th", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, "الحالة")
        )
      );
      const hTbody = el("tbody", null);

      if (!pastRuns.length) {
        hTbody.appendChild(
          el("tr", null, el("td", { colspan: 6, style: "padding: 2rem; text-align: center; color: var(--text-muted);" }, "لا توجد دورات إهلاك سابقة."))
        );
      } else {
        pastRuns.forEach((run) => {
          const row = el(
            "tr",
            { style: "border-bottom: 1px solid var(--border-color);" },
            el("td", { style: "padding: 0.5rem 0.75rem; font-family: monospace;" }, el("span", { class: "ltr-isolate" }, run.runNumber)),
            el("td", { style: "padding: 0.5rem 0.75rem;" }, run.period),
            el("td", { style: "padding: 0.5rem 0.75rem;" }, run.date ?? run.postedAt?.slice(0, 10)),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, integer(run.assetsCount ?? 0)),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: left; font-weight: 600;" }, el("span", { class: "ltr-isolate" }, amount(run.totalDepreciation))),
            el("td", { style: "padding: 0.5rem 0.75rem; text-align: center;" }, badge("مُرحَّل", { variant: "success" }))
          );
          hTbody.appendChild(row);
        });
      }

      hTable.appendChild(hThead);
      hTable.appendChild(hTbody);
      historyCard.appendChild(hTable);
      previewHost.appendChild(historyCard);
    } catch (err) {
      clear(previewHost);
      previewHost.appendChild(
        el("div", { class: "notice-banner", style: "color: var(--danger-text); padding: 2rem; text-align: center;" }, `حدث خطأ أثناء تحميل المعاينة: ${err.message}`)
      );
    }
  }

  container.appendChild(header);
  container.appendChild(periodBar);
  container.appendChild(previewHost);

  loadPreview();

  return container;
}
