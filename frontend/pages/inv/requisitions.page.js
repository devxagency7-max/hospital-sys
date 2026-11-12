/**
 * إدارة طلبات النواقص وتوزيع المخزون بين الفروع وسلاسل الإمداد الذكية.
 *
 * الفلو الذكي:
 * 1) الفرع ينشئ طلب نواقص بكود فريد وتوقيت لحظي آلي غير قابل للتعديل.
 * 2) المخزن الرئيسي يتلقى إشعارًا فوريًا (بينج).
 * 3) الفحص الذكي: هل الصنف متوفر بالرئيسي أم يوجد فائض في فرع آخر؟ (توفير الشراء وتدوير الراكد).
 * 4) الشحن للفرع مع تثبيت التاريخ والوقت واسم السائق لمنع ادعاء التأخير أو التنصل.
 * 5) مرحلة الفحص والعد عند الاستلام بالفرع: تسجيل الفعلي، وإثبات أي عجز أو تلف بلحظته.
 */

import { el, cx } from "../../js/core/dom.js";
import { button, buttonGroup } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { listPage, runAction } from "../_shared/list-page.js";
import { codeColumn, nameColumn, textColumn, dateColumn } from "../_shared/cells.js";
import { formModal, value, numberValue } from "../_shared/forms.js";
import { selectField, textField, textarea } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";
import {
  listRequisitions,
  getRequisition,
  createRequisition,
  checkItemAvailability,
  fulfillFromHub,
  fulfillByBranchTransfer,
  orderFromSupplier,
  branchInspectAndReceive,
} from "../../js/api/inventory.api.js";
import { getWarehouses, getItems, toOptions } from "../../js/api/lookups.api.js";

const STATUS_CONFIG = {
  pending_review: {
    label: "🟡 بانتظار مراجعة الرئيسي",
    tone: "warning",
    badgeClass: "bg-warning-500/10 text-warning-400 border border-warning-500/30",
  },
  supplier_ordered: {
    label: "🟣 تم الطلب من المورد",
    tone: "info",
    badgeClass: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
  },
  hub_received: {
    label: "🟠 وصل الرئيسي - جاري التوجيه",
    tone: "info",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  },
  in_transit: {
    label: "🚚 في الطريق للفرع",
    tone: "brand",
    badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  },
  under_inspection: {
    label: "🔍 قيد الفحص والعد بالفرع",
    tone: "info",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30",
  },
  discrepancy: {
    label: "⚠️ استلام به عجز / خلاف رقابي",
    tone: "danger",
    badgeClass: "bg-danger-500/10 text-danger-400 border border-danger-500/30 font-bold",
  },
  completed: {
    label: "✅ مكتمل ومطابق 100%",
    tone: "success",
    badgeClass: "bg-success-500/10 text-success-400 border border-success-500/30",
  },
  rejected: {
    label: "❌ ملغي / مرفوض",
    tone: "neutral",
    badgeClass: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  },
};

export default async function requisitionsPage() {
  const [warehouses, items] = await Promise.all([getWarehouses(), getItems()]);

  return listPage({
    title: "طلبات النواقص والتوريد بين الفروع",
    description:
      "الدورة الذكية لإدارة احتياجات الفروع: فحص الفائض بين المخازن، التوريد، التوزيع، والفحص بالعد الفعلي وتوثيق العجز بالساعة.",
    tableId: "inv-requisitions",
    searchPlaceholder: "بحث بكود الطلب أو اسم الصنف أو الفرع…",
    initialParams: { sort: "id", order: "desc" },
    fetch: listRequisitions,

    actions: (ctx) => [
      button({
        label: "طلب نواقص جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => openNewRequisitionModal(ctx, { warehouses, items }),
      }),
    ],

    filters: [
      {
        key: "status",
        label: "حالة الطلب",
        options: [
          { value: "all", label: "جميع الحالات" },
          { value: "pending_review", label: "🟡 بانتظار مراجعة الرئيسي (جديد)" },
          { value: "in_transit", label: "🚚 في الطريق للفرع" },
          { value: "under_inspection", label: "🔍 وصلت الفرع - قيد الفحص والعد" },
          { value: "discrepancy", label: "⚠️ استلامات بها عجز وخلاف رقابي" },
          { value: "completed", label: "✅ مكتمل ومطابق 100%" },
          { value: "supplier_ordered", label: "🟣 مطلوب من المورد" },
        ],
      },
      {
        key: "branchId",
        label: "الفرع الطالب",
        options: [
          { value: "", label: "جميع الفروع" },
          ...warehouses.filter((w) => !w.isHub && w.id !== 1).map((w) => ({ value: w.id, label: w.name })),
        ],
      },
      {
        key: "urgency",
        label: "درجة الأهمية",
        options: [
          { value: "all", label: "الكل" },
          { value: "urgent", label: "عاجل جداً" },
          { value: "high", label: "مرتفع" },
          { value: "normal", label: "عادي" },
        ],
      },
    ],

    stats: (result) => {
      const meta = result?.meta ?? {};
      const pending = meta.pendingCount ?? 0;
      return [
        statTile({
          title: "بانتظار مراجعة الرئيسي",
          value: pending,
          tone: pending > 0 ? "warning" : "neutral",
          hint: pending > 0 ? "⚠️ يتطلب قرار توفير فوري أو مناقلة" : "لا توجد طلبات معلقة",
        }),
        statTile({
          title: "في الطريق للفروع",
          value: meta.inTransitCount ?? 0,
          tone: "brand",
          hint: "شحنات جاري توصيلها للمخازن الفرعية",
        }),
        statTile({
          title: "استلامات بها عجز / خلاف",
          value: meta.discrepancyCount ?? 0,
          tone: meta.discrepancyCount > 0 ? "danger" : "neutral",
          hint: "فروقات بين المحول والمستلم الفعلي",
        }),
        statTile({
          title: "طلبات مكتملة ومطابقة",
          value: meta.completedCount ?? 0,
          tone: "success",
          hint: "تم استلامها ومطابقتها 100% بالفرع",
        }),
      ];
    },

    columns: [
      codeColumn("code", "كود الطلب", { width: "8.5rem" }),
      {
        key: "branchName",
        label: "الفرع الطالب",
        width: "13rem",
        render: (row) => el("span", { class: "font-semibold text-text-primary" }, row.branchName),
      },
      nameColumn("itemName", "itemCode", "الصنف المطلوب", { width: "16rem" }),
      {
        key: "requestedQty",
        label: "الكمية المطلوبة",
        width: "7.5rem",
        align: "center",
        render: (row) =>
          el(
            "span",
            { class: "font-bold num text-brand-600 dark:text-brand-400" },
            `${row.requestedQty} ${row.unit || ""}`,
          ),
      },
      {
        key: "status",
        label: "حالة الطلب",
        width: "12rem",
        align: "center",
        render: (row) => {
          const cfg = STATUS_CONFIG[row.status] || { label: row.status, tone: "neutral" };
          return el(
            "span",
            {
              class: cx(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-xs",
                cfg.badgeClass || "bg-surface-200 text-text-secondary",
              ),
            },
            cfg.label,
          );
        },
      },
      {
        key: "fulfillmentSource",
        label: "مسار التوفير",
        width: "10rem",
        render: (row) => {
          if (row.fulfillmentSource === "hub") {
            return badge("صرف من الرئيسي", { tone: "brand", size: "sm" });
          }
          if (row.fulfillmentSource === "branch_transfer") {
            return badge(`مناقلة من ${row.sourceBranchName || "فرع"}`, { tone: "info", size: "sm" });
          }
          if (row.fulfillmentSource === "supplier") {
            return badge("أمر شراء مورد", { tone: "warning", size: "sm" });
          }
          return el("span", { class: "text-text-muted text-xs" }, "— قيد التحديد");
        },
      },
      {
        key: "deliveryStatus",
        label: "المشحون / المستلم",
        width: "8.5rem",
        align: "center",
        render: (row) => {
          if (row.status === "completed") {
            return el(
              "span",
              { class: "text-xs font-semibold text-success-600 num" },
              `${row.receivedQty} / ${row.dispatchedQty} (مطابق)`,
            );
          }
          if (row.status === "discrepancy") {
            return el(
              "span",
              { class: "text-xs font-bold text-danger-600 num" },
              `${row.receivedQty} / ${row.dispatchedQty} (عجز ${row.discrepancyCount})`,
            );
          }
          if (row.dispatchedQty) {
            return el("span", { class: "text-xs text-text-muted num" }, `مشحون: ${row.dispatchedQty}`);
          }
          return el("span", { class: "text-xs text-text-muted" }, "—");
        },
      },
      dateColumn("createdAt", "تاريخ ووقت الطلب", { width: "9.5rem" }),
    ],

    rowActions: (row, ctx) =>
      buttonGroup([
        button({
          label: "متابعة وإجراءات الطلب",
          variant: row.status === "pending_review" ? "primary" : "secondary",
          size: "xs",
          icon: "eye",
          onClick: () => openRequisitionDetailsModal(row.id, ctx, { warehouses }),
        }),
      ]),
  });
}

/**
 * نافذة تفاصيل ومتابعة الطلب الذكية (توفير، شحن، فحص بالفرع، ومسار زمني موثق بالثانية).
 */
async function openRequisitionDetailsModal(reqId, ctx, { warehouses }) {
  let req;
  try {
    req = await getRequisition(reqId);
  } catch (err) {
    toast.error(err.message || "فشل تحميل بيانات الطلب");
    return;
  }

  const availability = req.availability || { surplusBranches: [] };
  const canFulfillHub = availability.canFulfillFromHub;
  const hasSurplus = availability.hasSurplusBranches;

  const content = el("div", { class: "space-y-6 text-sm" });

  /* 1) كارت ترويسة الطلب */
  content.appendChild(
    el(
      "div",
      {
        class:
          "p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 flex flex-wrap items-center justify-between gap-4",
      },
      [
        el("div", { class: "space-y-1" }, [
          el("div", { class: "flex items-center gap-2" }, [
            el("span", { class: "text-xs text-text-muted font-mono num" }, req.code),
            badge(STATUS_CONFIG[req.status]?.label || req.status, {
              tone: STATUS_CONFIG[req.status]?.tone || "neutral",
              size: "sm",
            }),
          ]),
          el(
            "h3",
            { class: "text-base font-bold text-text-primary" },
            `${req.itemName} — مطلوب: ${req.requestedQty} ${req.unit}`,
          ),
          el(
            "p",
            { class: "text-xs text-text-secondary" },
            `الفرع الطالب: ${req.branchName} · أنشأه: ${req.createdBy} · ملاحظات: ${req.notes || "لا توجد"}`,
          ),
        ]),
      ],
    ),
  );

  /* 2) كارت مسار التوفير الذكي (Smart Inter-Branch Balancing Card) */
  if (req.status === "pending_review") {
    const balanceCard = el(
      "div",
      {
        class:
          "p-4 rounded-xl border border-brand-500/30 bg-brand-500/5 dark:bg-brand-950/20 space-y-4",
      },
      [
        el("div", { class: "flex items-center justify-between" }, [
          el("h4", { class: "font-bold text-brand-700 dark:text-brand-300 flex items-center gap-2" }, [
            el("span", { class: "text-base" }, "💡"),
            "فحص التوفر وفائض الفروع الذكي (توفير الشراء الخارجي)",
          ]),
          el(
            "span",
            { class: "text-xs text-brand-600 dark:text-brand-400 font-semibold num" },
            `رصيد المخزن الرئيسي: ${availability.hubAvailable} ${req.unit}`,
          ),
        ]),
        el(
          "p",
          { class: "text-xs text-text-secondary leading-relaxed" },
          hasSurplus
            ? `تنبيه ذكي: يوجد فائض عن الاستهلاك في المخازن الفرعية الأخرى (${availability.surplusBranches
                .map((b) => `${b.warehouseName}: متوفر ${b.available} ${req.unit}`)
                .join(" · ")}). يمكنك تحويل الكمية فوراً دون الحاجة لشراء جديد وتوفير السيولة للمؤسسة.`
            : "لا توجد فروع أخرى لديها فائض كبير من هذا الصنف. يمكنك الصرف من الرئيسي أو إرسال أمر شراء للمورد.",
        ),
        el("div", { class: "flex flex-wrap items-center gap-2 pt-2 border-t border-brand-500/20" }, [
          canFulfillHub
            ? button({
                label: `صرف فوري من المخزن الرئيسي (${req.requestedQty} ${req.unit})`,
                variant: "primary",
                size: "sm",
                icon: "check",
                onClick: async () => {
                  await runAction(ctx, async () => {
                    await fulfillFromHub(req.id, { dispatchedQty: req.requestedQty });
                    modal.close();
                    toast.success("تم اعتماد الصرف والشحن من المخزن الرئيسي وتثبيت الختم الزمني");
                  });
                },
              })
            : null,
          hasSurplus
            ? button({
                label: `تحويل داخلي من ${availability.surplusBranches[0].warehouseName}`,
                variant: "secondary",
                size: "sm",
                icon: "refresh",
                onClick: async () => {
                  await runAction(ctx, async () => {
                    await fulfillByBranchTransfer(req.id, {
                      sourceBranchId: availability.surplusBranches[0].warehouseId,
                      dispatchedQty: req.requestedQty,
                    });
                    modal.close();
                    toast.success("تم اعتماد المناقلة الداخلية بين الفروع وتوفير الشراء");
                  });
                },
              })
            : null,
          button({
            label: "إصدار أمر شراء للمورد",
            variant: "ghost",
            size: "sm",
            icon: "plus",
            onClick: async () => {
              await runAction(ctx, async () => {
                await orderFromSupplier(req.id, { supplierId: 2 });
                modal.close();
                toast.success("تم إصدار طلبية التوريد للمورد المعتمد بنجاح");
              });
            },
          }),
        ]),
      ],
    );
    content.appendChild(balanceCard);
  }

  /* 3) شاشة فحص واستلام الفرع (Branch Receiving & Discrepancy Inspection Card) */
  if (req.status === "in_transit" || req.status === "under_inspection") {
    const qtyInput = el("input", {
      type: "number",
      class:
        "w-32 px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 text-text-primary text-center font-bold num",
      value: String(req.dispatchedQty || req.requestedQty),
      min: "0",
      max: "9999",
    });

    const notesInput = el("input", {
      type: "text",
      class:
        "flex-1 px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-800 text-text-primary text-xs",
      placeholder: "اكتب ملاحظات الفحص أو سبب العجز/التلف إن وجد…",
    });

    const inspectCard = el(
      "div",
      {
        class:
          "p-4 rounded-xl border border-warning-500/30 bg-warning-500/5 dark:bg-warning-950/20 space-y-4",
      },
      [
        el("div", { class: "flex items-center justify-between" }, [
          el("h4", { class: "font-bold text-warning-700 dark:text-warning-300 flex items-center gap-2" }, [
            el("span", { class: "text-base" }, "📦"),
            "فحص واستلام الشحنة في مخزن الفرع (بالعد الفعلي)",
          ]),
          el(
            "span",
            { class: "text-xs font-semibold text-text-secondary num" },
            `المشحون من الرئيسي: ${req.dispatchedQty || req.requestedQty} ${req.unit}`,
          ),
        ]),
        el(
          "p",
          { class: "text-xs text-text-secondary leading-relaxed" },
          "أمين مخزن الفرع: قم بعد الحبات الفعلية المستلمة. إذا كان هناك عجز أو كسر، اكتب المستلم الفعلي وسيتم توثيق العجز لحظياً بالساعة وإضافته فقط لعهدتك.",
        ),
        el("div", { class: "flex flex-wrap items-center gap-3 pt-1" }, [
          el("label", { class: "text-xs font-semibold text-text-primary" }, "المستلم الفعلي:"),
          qtyInput,
          el("label", { class: "text-xs font-semibold text-text-primary" }, "ملاحظات الفحص:"),
          notesInput,
        ]),
        el("div", { class: "flex items-center gap-2 pt-2 border-t border-warning-500/20" }, [
          button({
            label: "اعتماد استلام مطابق 100%",
            variant: "success",
            size: "sm",
            icon: "check",
            onClick: async () => {
              await runAction(ctx, async () => {
                await branchInspectAndReceive(req.id, {
                  receivedQty: Number(qtyInput.value),
                  notes: notesInput.value,
                });
                modal.close();
                toast.success("تم اعتماد استلام الشحنة ومطابقتها ودخولها عهدة الفرع");
              });
            },
          }),
          button({
            label: "إثبات استلام مع عجز / خلاف رقابي",
            variant: "danger",
            size: "sm",
            icon: "alert",
            onClick: async () => {
              const val = Number(qtyInput.value);
              const dispatched = Number(req.dispatchedQty || req.requestedQty);
              if (val >= dispatched) {
                toast.warning("لتسجيل عجز، يجب أن تكون الكمية المستلمة أقل من المشحونة.");
                return;
              }
              await runAction(ctx, async () => {
                await branchInspectAndReceive(req.id, {
                  receivedQty: val,
                  notes: notesInput.value || `عجز بعدد ${dispatched - val} ${req.unit}`,
                });
                modal.close();
                toast.warning("تم إثبات العجز الرقابي بالثانية وحماية عهدة الفرع");
              });
            },
          }),
        ]),
      ],
    );
    content.appendChild(inspectCard);
  }

  /* 4) خط السير والختم الزمني غير القابل للتعديل (Tamper-Proof Timeline Audit Trail) */
  const timelineCard = el("div", { class: "space-y-3 pt-2" }, [
    el("div", { class: "flex items-center justify-between border-b border-surface-200 dark:border-surface-700 pb-2" }, [
      el("h4", { class: "font-bold text-text-primary flex items-center gap-2" }, [
        el("span", { class: "text-base" }, "🔒"),
        "سجل المسار الزمني الموثق بالثانية (مؤمّن ضد التلاعب)",
      ]),
      el("span", { class: "text-[11px] text-text-muted" }, "مأخوذ آلياً من الخادم"),
    ]),
    el("div", { class: "space-y-3 relative before:absolute before:right-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-700 pr-2" },
      (req.timeline || []).map((t) =>
        el("div", { class: "relative pr-6 flex flex-col gap-0.5" }, [
          el("span", {
            class:
              "absolute right-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-brand-500 border-2 border-surface-0 dark:border-surface-900",
          }),
          el("div", { class: "flex items-center gap-2" }, [
            el("span", { class: "font-bold text-xs text-text-primary" }, t.title),
            el("span", { class: "text-[11px] text-brand-600 dark:text-brand-400 font-mono num" }, formatIsoTimestamp(t.timestamp)),
          ]),
          el("p", { class: "text-xs text-text-secondary" }, `المسؤول: ${t.user} · ${t.notes || ""}`),
        ]),
      ),
    ),
  ]);
  content.appendChild(timelineCard);

  const modal = formModal({
    title: `تفاصيل ومسار طلب النواقص: ${req.code}`,
    content,
    submitLabel: null,
    cancelLabel: "إغلاق",
  });

  document.body.appendChild(modal.element);
}

/**
 * نافذة إنشاء طلب نواقص جديد من الفرع.
 */
function openNewRequisitionModal(ctx, { warehouses, items }) {
  const branchOptions = warehouses
    .filter((w) => !w.isHub && w.id !== 1)
    .map((w) => ({ value: w.id, label: w.name }));

  const itemOptions = items.map((i) => ({
    value: i.id,
    label: `${i.name} (${i.code || ""})`,
  }));

  const form = el("form", { class: "space-y-4 text-sm" });

  const branchSel = selectField({
    label: "الفرع الطالب (المخزن الفرعي)",
    options: branchOptions,
    required: true,
  });

  const itemSel = selectField({
    label: "الصنف المطلوب",
    options: itemOptions,
    required: true,
  });

  const qtyInput = textField({
    label: "الكمية المطلوبة",
    type: "number",
    value: "10",
    required: true,
    placeholder: "مثال: 15",
  });

  const urgencySel = selectField({
    label: "درجة الأهمية",
    options: [
      { value: "normal", label: "عادي" },
      { value: "high", label: "مرتفع" },
      { value: "urgent", label: "عاجل وطارئ" },
    ],
  });

  const notesInput = textarea({
    label: "ملاحظات وتبرير الاحتياج",
    placeholder: "سبب طلب النواقص أو ضغط الحالات بالفرع…",
  });

  form.appendChild(branchSel.element);
  form.appendChild(itemSel.element);
  form.appendChild(qtyInput.element);
  form.appendChild(urgencySel.element);
  form.appendChild(notesInput.element);

  const modal = formModal({
    title: "إنشاء طلب نواقص واحتياج للفرع",
    content: form,
    submitLabel: "إرسال الطلب للمخزن الرئيسي",
    onSubmit: async () => {
      const bId = value(branchSel);
      const iId = value(itemSel);
      const q = numberValue(qtyInput);

      if (!bId || !iId || !(q > 0)) {
        toast.error("يرجى تحديد الفرع والصنف والكمية المطلوبة بدقة.");
        return;
      }

      await runAction(ctx, async () => {
        const created = await createRequisition({
          branchId: Number(bId),
          itemId: Number(iId),
          requestedQty: q,
          urgency: value(urgencySel) || "normal",
          notes: value(notesInput) || "",
        });
        modal.close();
        toast.success(`تم إنشاء طلب النواقص بنجاح برقم ${created.code} وإشعار المخزن الرئيسي`);
      });
    },
  });

  document.body.appendChild(modal.element);
}

function formatIsoTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("ar-EG")} ${d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch {
    return iso;
  }
}
