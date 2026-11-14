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
import { listPage } from "../_shared/list-page.js";
import { codeColumn, nameColumn, dateColumn } from "../_shared/cells.js";
import { formModal, selectField, notesField, value, numberValue } from "../_shared/forms.js";
import { openModal } from "../../components/modals/overlay.js";
import { textField } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";
import {
  listRequisitions,
  getRequisition,
  createRequisition,
  fulfillFromHub,
  fulfillByBranchTransfer,
  orderFromSupplier,
  branchInspectAndReceive,
} from "../../js/api/inventory.api.js";
import { getWarehouses, getItems } from "../../js/api/lookups.api.js";

const STATUS_CONFIG = {
  pending_review: {
    label: "بانتظار المراجعة",
    fullLabel: "بانتظار مراجعة المخزن الرئيسي",
    tone: "warning",
  },
  supplier_ordered: {
    label: "مطلوب من المورد",
    fullLabel: "تم إصدار أمر شراء للمورد",
    tone: "brand",
  },
  hub_received: {
    label: "وصل الرئيسي",
    fullLabel: "وصل المخزن الرئيسي - جاري التوجيه",
    tone: "info",
  },
  in_transit: {
    label: "في الطريق للفرع",
    fullLabel: "في الطريق لمقر الفرع",
    tone: "info",
  },
  under_inspection: {
    label: "قيد الفحص والعد",
    fullLabel: "وصل الفرع - قيد الفحص والعد الفعلي",
    tone: "info",
  },
  discrepancy: {
    label: "عجز / خلاف رقابي",
    fullLabel: "استلام به عجز أو خلاف رقابي",
    tone: "danger",
  },
  completed: {
    label: "مكتمل ومطابق 100%",
    fullLabel: "مكتمل ومطابق 100%",
    tone: "success",
  },
  rejected: {
    label: "ملغي / مرفوض",
    fullLabel: "طلب ملغي أو مرفوض",
    tone: "neutral",
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
          { value: "pending_review", label: "بانتظار مراجعة الرئيسي (جديد)" },
          { value: "in_transit", label: "في الطريق للفرع" },
          { value: "under_inspection", label: "وصلت الفرع - قيد الفحص والعد" },
          { value: "discrepancy", label: "استلامات بها عجز وخلاف رقابي" },
          { value: "completed", label: "مكتمل ومطابق 100%" },
          { value: "supplier_ordered", label: "مطلوب من المورد" },
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

    stats: (rows) => {
      const list = Array.isArray(rows) ? rows : (rows?.data || []);
      const pending = list.filter((r) => r.status === "pending_review").length;
      const inTransit = list.filter((r) => r.status === "in_transit" || r.status === "under_inspection").length;
      const discrepancy = list.filter((r) => r.status === "discrepancy").length;
      const completed = list.filter((r) => r.status === "completed").length;

      return [
        statTile({
          title: "بانتظار مراجعة الرئيسي",
          value: pending,
          tone: pending > 0 ? "warning" : "neutral",
          hint: pending > 0 ? "⚠️ يتطلب قرار توفير فوري أو مناقلة" : "لا توجد طلبات معلقة",
        }),
        statTile({
          title: "في الطريق للفروع",
          value: inTransit,
          tone: "brand",
          hint: "شحنات جاري توصيلها للمخازن الفرعية",
        }),
        statTile({
          title: "استلامات بها عجز / خلاف",
          value: discrepancy,
          tone: discrepancy > 0 ? "danger" : "neutral",
          hint: "فروقات بين المحول والمستلم الفعلي",
        }),
        statTile({
          title: "طلبات مكتملة ومطابقة",
          value: completed,
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
        width: "11rem",
        align: "center",
        render: (row) => {
          const cfg = STATUS_CONFIG[row.status] || { label: row.status, tone: "neutral" };
          return badge(cfg.label, {
            tone: cfg.tone,
            dot: true,
            size: "sm",
            class: "shadow-2xs font-medium whitespace-nowrap px-2.5 py-0.5",
          });
        },
      },
      {
        key: "fulfillmentSource",
        label: "مسار التوفير",
        width: "11rem",
        align: "center",
        render: (row) => {
          if (row.fulfillmentSource === "hub") {
            return badge("صرف من الرئيسي", { tone: "brand", size: "sm", dot: true });
          }
          if (row.fulfillmentSource === "branch_transfer") {
            const branchName = row.sourceBranchName || "فرع آخر";
            const shortName = branchName.replace(/مخزن\s*/, "");
            return badge(`مناقلة: ${shortName}`, {
              tone: "info",
              size: "sm",
              dot: true,
            });
          }
          if (row.fulfillmentSource === "supplier") {
            return badge("أمر شراء مورد", { tone: "warning", size: "sm", dot: true });
          }
          return el("span", { class: "text-muted text-xs font-medium" }, "— قيد التحديد");
        },
      },
      {
        key: "deliveryStatus",
        label: "المشحون / المستلم",
        width: "10rem",
        align: "center",
        render: (row) => {
          if (row.status === "completed") {
            return badge(`${row.receivedQty} / ${row.dispatchedQty} (مطابق)`, {
              tone: "success",
              size: "sm",
              class: "font-mono num font-semibold",
            });
          }
          if (row.status === "discrepancy") {
            return badge(`${row.receivedQty} / ${row.dispatchedQty} (عجز ${row.discrepancyCount})`, {
              tone: "danger",
              size: "sm",
              class: "font-mono num font-bold",
            });
          }
          if (row.dispatchedQty) {
            return el("span", { class: "text-xs text-muted num font-mono" }, `مشحون: ${row.dispatchedQty}`);
          }
          return el("span", { class: "text-faint text-xs" }, "—");
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

  openModal({
    title: `تفاصيل ومسار طلب النواقص: ${req.code}`,
    subtitle: `الفرع الطالب: ${req.branchName} · أنشئ في: ${formatIsoTimestamp(req.createdAt)}`,
    size: "lg",
    body: (close) => {
      const content = el("div", { class: "space-y-5 text-sm" });

      /* 1) بطاقة بيانات الطلب والصنف */
      const headerCard = el(
        "div",
        {
          class:
            "p-5 rounded-2xl bg-subtle/50 dark:bg-subtle/30 border border-line space-y-4 shadow-2xs",
        },
        [
          /* الشريط العلوي للبطاقة: الكود، الحالة، درجة الأهمية */
          el("div", { class: "flex flex-wrap items-center justify-between gap-3" }, [
            el("div", { class: "flex items-center gap-2" }, [
              el(
                "span",
                {
                  class:
                    "font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-line text-ink num shadow-2xs",
                },
                req.code,
              ),
              badge(STATUS_CONFIG[req.status]?.fullLabel || STATUS_CONFIG[req.status]?.label || req.status, {
                tone: STATUS_CONFIG[req.status]?.tone || "neutral",
                dot: true,
                size: "sm",
              }),
            ]),
            badge(
              req.urgency === "urgent"
                ? "أهمية: عاجل جداً"
                : req.urgency === "high"
                  ? "أهمية: مرتفعة"
                  : "أهمية: عادي",
              {
                tone: req.urgency === "urgent" ? "danger" : req.urgency === "high" ? "warning" : "neutral",
                size: "sm",
              },
            ),
          ]),

          /* اسم الصنف والكمية */
          el("div", { class: "flex flex-wrap items-center justify-between gap-3 pt-1" }, [
            el("div", { class: "space-y-0.5" }, [
              el("h3", { class: "text-base font-bold text-ink" }, req.itemName),
              req.itemCode ? el("span", { class: "text-xs font-mono text-muted num" }, req.itemCode) : null,
            ]),
            badge(`الكمية المطلوبة: ${req.requestedQty} ${req.unit}`, {
              tone: "brand",
              size: "md",
              class: "font-bold text-xs px-3 py-1",
            }),
          ]),

          /* شبكة البيانات الوصفية (3 أعمدة) */
          el(
            "div",
            {
              class:
                "grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-line/60 text-xs",
            },
            [
              el("div", { class: "space-y-1" }, [
                el("span", { class: "text-muted block" }, "الفرع الطالب:"),
                el("span", { class: "font-semibold text-ink block" }, req.branchName),
              ]),
              el("div", { class: "space-y-1" }, [
                el("span", { class: "text-muted block" }, "المسؤول المُنشئ:"),
                el("span", { class: "font-semibold text-ink block" }, req.createdBy),
              ]),
              el("div", { class: "space-y-1" }, [
                el("span", { class: "text-muted block" }, "تاريخ وتوقيت الطلب:"),
                el("span", { class: "font-mono font-semibold text-ink block num" }, formatIsoTimestamp(req.createdAt)),
              ]),
            ],
          ),

          /* الملاحظات إن وجدت */
          req.notes
            ? el(
                "div",
                {
                  class:
                    "p-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-line/60 text-xs text-muted leading-relaxed flex items-start gap-2",
                },
                [
                  el("span", { class: "font-bold text-ink shrink-0" }, "ملاحظات الطلب:"),
                  el("span", {}, req.notes),
                ],
              )
            : null,
        ],
      );
      content.appendChild(headerCard);

      /* 2) كارت مسار التوفير والقرار الذكي (Smart Decision Cockpit) */
      if (req.status === "pending_review") {
        const balanceCard = el(
          "div",
          {
            class:
              "p-5 rounded-2xl border-2 border-brand-500/25 bg-brand-50/40 dark:bg-brand-950/20 space-y-4 shadow-2xs",
          },
          [
            el("div", { class: "flex flex-wrap items-center justify-between gap-3" }, [
              el("h4", { class: "font-bold text-ink text-sm flex items-center gap-2" }, [
                el("span", { class: "text-base" }, "💡"),
                "مركز القرار وتوفير الاحتياج (فحص التوفر الذكي)",
              ]),
              badge(
                canFulfillHub
                  ? `متوفر بالمخزن الرئيسي: ${availability.hubAvailable} ${req.unit}`
                  : `المخزن الرئيسي: غير متوفر (رصيد 0)`,
                {
                  tone: canFulfillHub ? "success" : "warning",
                  dot: true,
                  size: "sm",
                },
              ),
            ]),
            el(
              "p",
              { class: "text-xs text-muted leading-relaxed" },
              canFulfillHub
                ? `الكمية المطلوبة متوفرة بالكامل داخل المخزن الرئيسي. يمكنك اعتماد الصرف المباشر والشحن الفوري للفرع الطالب.`
                : hasSurplus
                  ? `تنبيه التوزيع الذكي: المخزن الرئيسي لا يملك رصيداً كافياً، لكن يوجد فائض عن الاستهلاك في (${availability.surplusBranches
                      .map((b) => `${b.warehouseName}: متوفر ${b.available} ${req.unit}`)
                      .join(" · ")}). يمكنك المناقلة الداخلية فوراً وتوفير السيولة للمؤسسة دون الحاجة لشراء خارجي جديد.`
                  : "الصنف غير متوفر بالمخزن الرئيسي ولا يوجد أي فائض في الفروع الأخرى. يُرجى إصدار أمر شراء وتوريد للمورد المعتمد.",
            ),
            el("div", { class: "flex flex-wrap items-center gap-2.5 pt-2 border-t border-brand-500/20" }, [
              canFulfillHub
                ? button({
                    label: `صرف فوري وشحن من المخزن الرئيسي (${req.requestedQty} ${req.unit})`,
                    variant: "primary",
                    size: "sm",
                    icon: "check",
                    onClick: async () => {
                      await fulfillFromHub(req.id, { dispatchedQty: req.requestedQty });
                      close();
                      ctx.refresh?.();
                      toast.success("تم اعتماد الصرف والشحن من المخزن الرئيسي وتثبيت الختم الزمني");
                    },
                  })
                : null,
              hasSurplus
                ? button({
                    label: `مناقلة وتحويل من ${availability.surplusBranches[0].warehouseName}`,
                    variant: "secondary",
                    size: "sm",
                    icon: "refresh",
                    onClick: async () => {
                      await fulfillByBranchTransfer(req.id, {
                        sourceBranchId: availability.surplusBranches[0].warehouseId,
                        dispatchedQty: req.requestedQty,
                      });
                      close();
                      ctx.refresh?.();
                      toast.success("تم اعتماد المناقلة الداخلية بين الفروع وتوفير الشراء");
                    },
                  })
                : null,
              button({
                label: "إصدار أمر شراء للمورد",
                variant: canFulfillHub ? "ghost" : "primary",
                size: "sm",
                icon: "plus",
                onClick: async () => {
                  await orderFromSupplier(req.id, { supplierId: 2 });
                  close();
                  ctx.refresh?.();
                  toast.success("تم إصدار طلبية التوريد للمورد المعتمد بنجاح");
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
            "w-32 px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-slate-800 text-ink text-center font-bold num shadow-2xs focus:border-brand-500",
          value: String(req.dispatchedQty || req.requestedQty),
          min: "0",
          max: "9999",
        });

        const notesInput = el("input", {
          type: "text",
          class:
            "flex-1 px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-slate-800 text-ink text-xs shadow-2xs focus:border-brand-500",
          placeholder: "اكتب ملاحظات الفحص أو سبب العجز/التلف إن وجد…",
        });

        const inspectCard = el(
          "div",
          {
            class:
              "p-5 rounded-2xl border-2 border-warning-500/25 bg-warning-50/40 dark:bg-warning-950/20 space-y-4 shadow-2xs",
          },
          [
            el("div", { class: "flex items-center justify-between" }, [
              el("h4", { class: "font-bold text-ink flex items-center gap-2" }, [
                el("span", { class: "text-base" }, "📦"),
                "فحص واستلام الشحنة في مخزن الفرع (بالعد الفعلي)",
              ]),
              badge(`المشحون من الرئيسي: ${req.dispatchedQty || req.requestedQty} ${req.unit}`, {
                tone: "info",
                size: "sm",
              }),
            ]),
            el(
              "p",
              { class: "text-xs text-muted leading-relaxed" },
              "أمين مخزن الفرع: قم بعد الحبات الفعلية المستلمة. إذا كان هناك عجز أو كسر، اكتب المستلم الفعلي وسيتم توثيق العجز لحظياً بالساعة وإضافته فقط لعهدتك.",
            ),
            el("div", { class: "flex flex-wrap items-center gap-3 pt-1" }, [
              el("label", { class: "text-xs font-semibold text-ink" }, "المستلم الفعلي:"),
              qtyInput,
              el("label", { class: "text-xs font-semibold text-ink" }, "ملاحظات الفحص:"),
              notesInput,
            ]),
            el("div", { class: "flex items-center gap-2.5 pt-2 border-t border-warning-500/20" }, [
              button({
                label: "اعتماد استلام مطابق 100%",
                variant: "success",
                size: "sm",
                icon: "check",
                onClick: async () => {
                  await branchInspectAndReceive(req.id, {
                    receivedQty: Number(qtyInput.value),
                    notes: notesInput.value,
                  });
                  close();
                  ctx.refresh?.();
                  toast.success("تم اعتماد استلام الشحنة ومطابقتها ودخولها عهدة الفرع");
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
                  await branchInspectAndReceive(req.id, {
                    receivedQty: val,
                    notes: notesInput.value || `عجز بعدد ${dispatched - val} ${req.unit}`,
                  });
                  close();
                  ctx.refresh?.();
                  toast.warning("تم إثبات العجز الرقابي بالثانية وحماية عهدة الفرع");
                },
              }),
            ]),
          ],
        );
        content.appendChild(inspectCard);
      }

      /* 4) خط السير والختم الزمني غير القابل للتعديل (Tamper-Proof Timeline Audit Trail) */
      const timelineCard = el("div", { class: "space-y-4 pt-3 border-t border-line" }, [
        el(
          "div",
          { class: "flex items-center justify-between pb-1" },
          [
            el("h4", { class: "font-bold text-ink flex items-center gap-2 text-xs" }, [
              el("span", { class: "text-sm" }, "🔒"),
              "سجل المسار الزمني الموثق بالثانية (مؤمّن ضد التلاعب)",
            ]),
            el("span", { class: "text-[11px] text-muted font-medium" }, "مأخوذ آلياً من الخادم"),
          ],
        ),
        el(
          "div",
          {
            class:
              "space-y-4 relative before:absolute before:right-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line-strong pr-1",
          },
          (req.timeline || []).map((t) =>
            el("div", { class: "relative pr-6 flex flex-col gap-1" }, [
              el("span", {
                class:
                  "absolute right-[3px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-white dark:ring-slate-900",
              }),
              el("div", { class: "flex items-center gap-2" }, [
                el("span", { class: "font-bold text-xs text-ink" }, t.title),
                el(
                  "span",
                  { class: "text-[11px] text-muted font-mono num bg-subtle px-1.5 py-0.5 rounded border border-line/60" },
                  formatIsoTimestamp(t.timestamp),
                ),
              ]),
              el("p", { class: "text-xs text-muted" }, `المسؤول: ${t.user} · ${t.notes || ""}`),
            ]),
          ),
        ),
      ]);
      content.appendChild(timelineCard);

      return content;
    },
    footer: (close) => [
      button({
        label: "إغلاق النافذة",
        variant: "ghost",
        onClick: () => close(),
      }),
    ],
  });
}

/**
 * نافذة إنشاء طلب نواقص جديد من الفرع.
 */
function openNewRequisitionModal(ctx, { warehouses, items }) {
  const branchOptions = warehouses
    .filter((w) => !w.isHub && w.id !== 1)
    .map((w) => ({ value: String(w.id), label: w.name }));

  const itemOptions = items.map((i) => ({
    value: String(i.id),
    label: `${i.name} (${i.code || ""})`,
  }));

  const form = {
    branchId: branchOptions[0]?.value ?? "2",
    itemId: itemOptions[0]?.value ?? "1",
    requestedQty: 10,
    urgency: "normal",
    notes: "طلب احتياج رصيد للفرع",
  };

  formModal({
    title: "إنشاء طلب نواقص واحتياج للفرع",
    subtitle: "إرسال طلب عاجل من الفرع للمخزن الرئيسي بتوثيق زمني لحظي",
    size: "md",
    submitLabel: "إرسال الطلب للمخزن الرئيسي",
    success: "تم إنشاء طلب النواقص بنجاح وإشعار المخزن الرئيسي",

    body: () =>
      el(
        "div",
        { class: "space-y-4" },
        selectField({
          label: "الفرع الطالب (المخزن الفرعي)",
          required: true,
          value: form.branchId,
          options: branchOptions,
          onChange: value((v) => (form.branchId = v)),
        }),
        selectField({
          label: "الصنف المطلوب",
          required: true,
          value: form.itemId,
          options: itemOptions,
          onChange: value((v) => (form.itemId = v)),
        }),
        textField({
          label: "الكمية المطلوبة",
          type: "number",
          value: String(form.requestedQty),
          required: true,
          onInput: numberValue((v) => (form.requestedQty = v)),
        }),
        selectField({
          label: "درجة الأهمية",
          value: form.urgency,
          options: [
            { value: "normal", label: "عادي" },
            { value: "high", label: "مرتفع" },
            { value: "urgent", label: "عاجل وطارئ" },
          ],
          onChange: value((v) => (form.urgency = v)),
        }),
        notesField({
          label: "ملاحظات وتبرير الاحتياج",
          value: form.notes,
          placeholder: "سبب طلب النواقص أو ضغط الحالات بالفرع…",
          onInput: value((v) => (form.notes = v)),
        }),
      ),

    onSubmit: async () => {
      if (!form.branchId || !form.itemId || !(Number(form.requestedQty) > 0)) {
        throw new Error("يرجى تحديد الفرع والصنف والكمية المطلوبة بدقة.");
      }
      await createRequisition({
        branchId: Number(form.branchId),
        itemId: Number(form.itemId),
        requestedQty: Number(form.requestedQty),
        urgency: form.urgency,
        notes: form.notes,
      });
      ctx.refresh?.();
    },
  });
}

function formatIsoTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("ar-EG")} ${d.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
  } catch {
    return iso;
  }
}
