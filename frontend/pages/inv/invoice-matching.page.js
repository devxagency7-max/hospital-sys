/**
 * مطابقة فواتير الموردين — شاشة عمل المحاسب اليومية.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  أمين المخزن أقرّ بالكمية. المحاسب يُدخل السعر. هذه هي الشاشة التي يلتقي
 *  فيها الرقمان.
 *
 *  كل صف هنا = بضاعة على الرف مُقيَّمة **مؤقتًا** ومديونية مورد غير مُثبَّتة
 *  بعد. تأخّر التسعير يعني مخزونًا بقيمة قديمة وميزانية ناقصة التزامًا —
 *  ولذلك يُعرض عمر كل استلام ويُرتَّب الأقدم أولًا.
 *
 *  المعاينة تُظهر الفروق **قبل** الاعتماد: فرق الكمية بين المستلم والمفوتر،
 *  وفرق السعر عن آخر شراء. ولا يُعتمد فرق كبير بلا مبرر مكتوب.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { el, clear, cx } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile, statGrid } from "../../components/common/card.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { openModal } from "../../components/modals/overlay.js";
import { toast } from "../../components/feedback/toast.js";
import { runAction } from "../_shared/list-page.js";
import { currency, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import {
  listReceiptsAwaitingPrice,
  listPurchaseMatches,
  previewMatch,
  matchSupplierInvoice,
} from "../../js/api/procurement.api.js";

export default async function invoiceMatchingPage() {
  const container = el("div", { class: "space-y-4" });
  const host = el("div", { class: "space-y-4" });

  let tab = "awaiting"; // awaiting | matched

  container.appendChild(
    pageHeader({
      title: "مطابقة فواتير الموردين",
      description:
        "المخزن أقرّ بالكمية — أدخل سعر فاتورة المورد هنا. النظام يقارن المستلم " +
        "بالمفوتر ويُظهر فرق السعر قبل الاعتماد.",
      actions: [
        button({
          label: "مراجعة وتسعير الأصناف",
          variant: "secondary",
          icon: "money",
          onClick: () => navigate("/inv/price-reviews"),
        }),
      ],
    }),
  );

  container.appendChild(host);
  await render();
  return container;

  /* ---------------------------------------------------------------- render */

  async function render() {
    clear(host);
    host.appendChild(loadingState({ message: "جاري التحميل…" }));

    let awaiting;
    let matched;
    try {
      [awaiting, matched] = await Promise.all([
        listReceiptsAwaitingPrice({ perPage: 100 }),
        listPurchaseMatches({ perPage: 100 }),
      ]);
    } catch (error) {
      clear(host);
      host.appendChild(errorState({ error, title: "فشل تحميل بيانات المطابقة", onRetry: render }));
      return;
    }

    clear(host);

    host.appendChild(
      statGrid(
        statTile({
          label: "استلامات تنتظر سعر الفاتورة",
          value: integer(awaiting.meta.total),
          hint: awaiting.meta.oldestAgeDays
            ? `أقدمها منذ ${awaiting.meta.oldestAgeDays} يوم`
            : "لا متأخرات",
          icon: "inbox",
          tone: awaiting.meta.total > 0 ? "warning" : "success",
        }),
        statTile({
          label: "قيمة مؤقتة غير مُسعَّرة",
          value: currency(awaiting.meta.provisionalTotal),
          hint: "مخزون على الرف بقيمة تقديرية",
          icon: "money",
          tone: "info",
        }),
        statTile({
          label: "مطابقات منفَّذة",
          value: integer(matched.meta.total),
          hint: `بقيمة ${currency(matched.meta.invoicedTotal)}`,
          icon: "check",
          tone: "success",
        }),
        statTile({
          label: "مطابقات بها فروق",
          value: integer(matched.meta.withExceptions),
          hint: `صافي فرق السعر ${currency(matched.meta.totalVariance)}`,
          icon: "warning",
          tone: matched.meta.withExceptions > 0 ? "danger" : "neutral",
        }),
      ),
    );

    host.appendChild(tabBar(awaiting.meta.total, matched.meta.total));

    if (tab === "awaiting") {
      host.appendChild(awaitingTable(awaiting.data));
    } else {
      host.appendChild(matchedTable(matched.data));
    }
  }

  function tabBar(awaitingCount, matchedCount) {
    const chip = (key, label) =>
      el(
        "button",
        {
          type: "button",
          class: cx(
            "px-4 py-2 rounded-xl text-xs font-bold border transition-colors",
            tab === key
              ? "border-brand-500 bg-brand-500 text-white shadow-2xs"
              : "border-line bg-white dark:bg-slate-800 text-ink hover:border-brand-500/60",
          ),
          onClick: () => {
            tab = key;
            render();
          },
        },
        label,
      );

    return el("div", { class: "flex flex-wrap items-center gap-2" }, [
      chip("awaiting", `بانتظار التسعير (${integer(awaitingCount)})`),
      chip("matched", `سجل المطابقات (${integer(matchedCount)})`),
    ]);
  }

  /* --------------------------------------------------------- awaiting list */

  function awaitingTable(rows) {
    if (!rows.length) {
      return emptyState({
        title: "لا استلامات تنتظر تسعيرًا",
        message: "كل إذون الإضافة مُسعَّرة ومطابَقة بفواتير مورديها.",
      });
    }

    return el(
      "div",
      { class: "space-y-2" },
      ...rows.map((row) =>
        el(
          "div",
          {
            class:
              "flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border " +
              "border-line bg-white dark:bg-slate-900",
          },
          [
            el("div", { class: "min-w-0 flex-1 space-y-1.5" }, [
              el("div", { class: "flex flex-wrap items-center gap-2" }, [
                el("span", { class: "font-bold text-ink text-sm ltr-isolate" }, row.reference),
                badge(`${integer(row.receivedQty)} ${row.unit}`, { tone: "info", size: "sm" }),
                row.ageDays > 7
                  ? badge(`متأخر ${integer(row.ageDays)} يوم`, { tone: "danger", size: "sm", dot: true })
                  : badge(`منذ ${integer(row.ageDays)} يوم`, { tone: "neutral", size: "sm" }),
              ]),
              el("p", { class: "text-xs text-ink font-semibold truncate-1" }, row.itemName),
              el(
                "p",
                { class: "text-[11px] text-muted" },
                `${row.supplierName} · ${row.warehouseName} · استلمه ${row.receivedBy} · ` +
                  `قيمة مؤقتة ${currency(row.provisionalValue)}`,
              ),
            ]),
            button({
              label: "إدخال سعر الفاتورة",
              variant: "primary",
              size: "sm",
              icon: "money",
              permission: "fin.supplier.invoice",
              onClick: () => openMatchModal(row),
            }),
          ],
        ),
      ),
    );
  }

  /* ---------------------------------------------------------- matched list */

  function matchedTable(rows) {
    if (!rows.length) {
      return emptyState({
        title: "لا مطابقات بعد",
        message: "ستظهر هنا كل فاتورة مورد طُوبقت مع إذن استلامها.",
      });
    }

    return el(
      "div",
      { class: "space-y-2" },
      ...rows.map((row) => {
        const hasExceptions = (row.exceptions ?? []).length > 0;

        return el(
          "div",
          {
            class: cx(
              "p-4 rounded-2xl border space-y-2",
              hasExceptions
                ? "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-line bg-white dark:bg-slate-900",
            ),
          },
          [
            el("div", { class: "flex flex-wrap items-center justify-between gap-2" }, [
              el("div", { class: "flex flex-wrap items-center gap-2" }, [
                el(
                  "span",
                  { class: "font-bold text-ink text-sm ltr-isolate" },
                  `${row.receiptReference} ↔ ${row.supplierInvoiceRef}`,
                ),
                badge(
                  `فرق سعر ${row.priceVariancePct}%`,
                  {
                    tone:
                      Math.abs(row.priceVariancePct) >= 5
                        ? "danger"
                        : row.priceVariancePct === 0
                          ? "success"
                          : "warning",
                    size: "sm",
                    dot: true,
                  },
                ),
                row.quantityVariance !== 0
                  ? badge(`فرق كمية ${row.quantityVariance}`, { tone: "danger", size: "sm" })
                  : null,
              ]),
              el("span", { class: "text-xs font-bold num" }, currency(row.invoiceValue)),
            ]),
            el(
              "p",
              { class: "text-xs text-muted" },
              `${row.itemName} · ${row.supplierName} · مستلم ${integer(row.receivedQty)} / ` +
                `مفوتر ${integer(row.invoiceQty)} · سعر ${currency(row.invoiceUnitCost)} ` +
                `(مؤقت كان ${currency(row.provisionalUnitCost)}) · طابقها ${row.matchedBy}`,
            ),
            row.varianceReason
              ? el(
                  "p",
                  { class: "text-[11px] text-ink p-2 rounded-lg bg-subtle/60 border border-line" },
                  `مبرر المورد: ${row.varianceReason}`,
                )
              : null,
            hasExceptions
              ? el(
                  "ul",
                  { class: "space-y-1" },
                  ...row.exceptions.map((ex) =>
                    el("li", { class: "text-[11px] text-amber-700 dark:text-amber-300" }, `⚠ ${ex}`),
                  ),
                )
              : null,
          ],
        );
      }),
    );
  }

  /* ----------------------------------------------------------- match modal */

  function openMatchModal(row) {
    const priceInput = el("input", {
      type: "number",
      step: "0.01",
      min: "0",
      class:
        "w-36 px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-slate-800 " +
        "text-ink text-center font-bold num",
      placeholder: "سعر الوحدة",
    });

    const qtyInput = el("input", {
      type: "number",
      min: "0",
      value: String(row.receivedQty),
      class:
        "w-28 px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-slate-800 " +
        "text-ink text-center font-bold num",
    });

    const refInput = el("input", {
      type: "text",
      class:
        "flex-1 min-w-44 px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-slate-800 " +
        "text-ink text-xs",
      placeholder: "رقم فاتورة المورد (إلزامي)",
    });

    const reasonInput = el("input", {
      type: "text",
      class:
        "w-full px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-slate-800 " +
        "text-ink text-xs",
      placeholder: "مبرر المورد لفرق السعر (إلزامي إن تجاوز الفرق 5%)",
    });

    const previewHost = el("div", { class: "space-y-2" });

    openModal({
      title: `مطابقة فاتورة مورد — ${row.reference}`,
      subtitle: `${row.itemName} · ${row.supplierName} · مستلم ${row.receivedQty} ${row.unit}`,
      size: "lg",
      body: (close) => {
        const content = el("div", { class: "space-y-4 text-sm" });

        content.appendChild(
          el(
            "div",
            {
              class:
                "p-4 rounded-2xl border border-line bg-subtle/50 dark:bg-subtle/30 space-y-2",
            },
            [
              el("h4", { class: "font-bold text-ink text-sm" }, "ما أقرّ به المخزن"),
              dataRow("إذن الإضافة", row.reference),
              dataRow("الكمية المستلمة فعلًا", `${integer(row.receivedQty)} ${row.unit}`),
              dataRow("المستودع", row.warehouseName),
              dataRow("استلمها", row.receivedBy),
              dataRow(
                "التقييم المؤقت",
                `${currency(row.provisionalUnitCost)} / ${row.unit} = ${currency(row.provisionalValue)}`,
              ),
            ],
          ),
        );

        content.appendChild(
          el(
            "div",
            {
              class:
                "p-4 rounded-2xl border-2 border-brand-500/30 bg-brand-50/40 " +
                "dark:bg-brand-950/20 space-y-3",
            },
            [
              el("h4", { class: "font-bold text-ink text-sm" }, "ما في فاتورة المورد"),
              el("div", { class: "flex flex-wrap items-center gap-3" }, [
                el("label", { class: "text-xs font-semibold text-ink" }, "سعر الوحدة:"),
                priceInput,
                el("label", { class: "text-xs font-semibold text-ink" }, "الكمية المفوترة:"),
                qtyInput,
              ]),
              el("div", { class: "flex flex-wrap items-center gap-3" }, [refInput]),
              reasonInput,
              el("div", { class: "pt-1" }, [
                button({
                  label: "معاينة الفروق",
                  variant: "secondary",
                  size: "sm",
                  icon: "search",
                  onClick: () => doPreview(),
                }),
              ]),
            ],
          ),
        );

        content.appendChild(previewHost);
        return content;
      },
      footer: (close) => [
        button({
          label: "اعتماد المطابقة وإثبات مديونية المورد",
          variant: "primary",
          icon: "check",
          permission: "fin.supplier.invoice",
          onClick: () =>
            runAction(async () => {
              const result = await matchSupplierInvoice(row.movementId, payloadFromForm());

              close();
              await render();

              if (result.exceptions.length) {
                toast.warning(
                  `تمت المطابقة مع ${result.exceptions.length} استثناء رقابي موثق — راجع السجل.`,
                );
              } else {
                toast.success("تمت المطابقة بلا فروق وأُثبتت مديونية المورد.");
              }

              if (result.priceReview) {
                toast.info("تغيّر سعر الشراء — فُتح طلب مراجعة سعر بيع لمدير الحسابات.");
              }
            }),
        }),
        button({ label: "إغلاق", variant: "ghost", onClick: () => close() }),
      ],
    });

    function payloadFromForm() {
      return {
        invoiceUnitCost: Number(priceInput.value),
        invoiceQty: Number(qtyInput.value),
        supplierInvoiceRef: refInput.value.trim(),
        varianceReason: reasonInput.value.trim() || undefined,
      };
    }

    async function doPreview() {
      if (!(Number(priceInput.value) > 0)) {
        toast.warning("أدخل سعر الوحدة أولًا.");
        return;
      }

      await runAction(async () => {
        const preview = await previewMatch(row.movementId, payloadFromForm());
        clear(previewHost);

        previewHost.appendChild(
          el(
            "div",
            {
              class: cx(
                "p-4 rounded-2xl border-2 space-y-2",
                preview.isClean
                  ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                  : "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20",
              ),
            },
            [
              el("h4", { class: "font-bold text-ink text-sm" }, "نتيجة المقارنة"),
              dataRow(
                "الكمية",
                `مستلم ${integer(preview.receivedQty)} / مفوتر ${integer(preview.invoiceQty)} ` +
                  `→ المستحق الدفع ${integer(preview.payableQty)}`,
              ),
              dataRow(
                "السعر",
                `${currency(preview.invoiceUnitCost)} مقابل ${currency(preview.provisionalUnitCost)} ` +
                  `→ فرق ${preview.priceVariancePct}%`,
              ),
              dataRow(
                "القيمة",
                `فاتورة ${currency(preview.invoiceValue)} مقابل استحقاق ` +
                  `${currency(preview.accruedValue)} → فرق ${currency(preview.valueVariance)}`,
              ),
              preview.exceptions.length
                ? el(
                    "ul",
                    { class: "space-y-1 pt-1 border-t border-amber-500/20" },
                    ...preview.exceptions.map((ex) =>
                      el(
                        "li",
                        { class: "text-[11px] text-amber-700 dark:text-amber-300" },
                        `⚠ ${ex}`,
                      ),
                    ),
                  )
                : el(
                    "p",
                    { class: "text-[11px] text-emerald-700 dark:text-emerald-300" },
                    "✓ مطابقة نظيفة — لا فروق كمية ولا سعر يستوجب مراجعة.",
                  ),
            ],
          ),
        );
      });
    }
  }
}

/** صف «تسمية: قيمة» مضغوط. */
function dataRow(label, text) {
  return el("div", { class: "flex items-start justify-between gap-3 text-xs" }, [
    el("span", { class: "text-muted shrink-0" }, label),
    el("span", { class: "font-semibold text-ink text-end num" }, String(text ?? "—")),
  ]);
}
