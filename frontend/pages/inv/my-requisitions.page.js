/**
 * نواقص قسمي — شاشة التمريض.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  «يطلب نواقص» ≠ «يدير طلبات النواقص».
 *
 *  شاشة `/inv/requisitions` لوحة إدارة سلاسل إمداد: طلبات كل الفروع،
 *  وأزرار شحن ومناقلة وأوامر شراء، وتصدير. الممرضة كانت تراها كاملة —
 *  وتملك فيها زر شحن من المخزن الرئيسي.
 *
 *  ما تحتاجه فعلًا سؤالان لا أكثر:
 *    1. أطلب الناقص.      2. طلبي فين وصل؟
 *
 *  فهذه الشاشة سؤالان: زر طلب، وقائمة حالة. بلا تصدير، بلا فروع أخرى،
 *  وبلا إجراء واحد على طلب غيرها.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { el, clear, cx, render as renderNode } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { button, iconButton } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { formModal, selectField, notesField, value, numberValue } from "../_shared/forms.js";
import { runAction } from "../_shared/list-page.js";
import { toast } from "../../components/feedback/toast.js";
import { integer } from "../../js/core/format.js";
import { currentUser } from "../../js/core/permissions.js";
import { listRequisitions, createRequisition } from "../../js/api/inventory.api.js";
import { getWarehouses, getItems } from "../../js/api/lookups.api.js";

/** حالة الطلب كما تهمّ الطالب: أين وصل طلبي؟ */
const STATUS = {
  pending_review: { label: "بانتظار المراجعة", tone: "warning", hint: "المخزن الرئيسي يراجع التوفير" },
  supplier_ordered: { label: "مطلوب من المورد", tone: "brand", hint: "صدر أمر شراء — في انتظار التوريد" },
  hub_received: { label: "وصل الرئيسي", tone: "info", hint: "وردت الكمية وجارٍ توجيهها لك" },
  in_transit: { label: "في الطريق إليك", tone: "info", hint: "شُحنت وفي الطريق" },
  under_inspection: { label: "وصل وجارٍ العد", tone: "info", hint: "وصلت ويجري فحصها وعدّها" },
  completed: { label: "تم الاستلام", tone: "success", hint: "استُلمت بالكامل ودخلت الرصيد" },
  discrepancy: { label: "استُلم بعجز", tone: "danger", hint: "استُلمت ناقصة — موثق بالعجز" },
  rejected: { label: "مرفوض", tone: "neutral", hint: "رُفض الطلب — راجع السبب" },
};

export default async function myRequisitionsPage() {
  const container = el("div", { class: "space-y-4" });
  const host = el("div", { class: "space-y-3" });

  /*
   * قسم الطالب = المخزن المسنَد للمستخدم. ممرضة بلا مخزن مسنَد لا تستطيع
   * الطلب — ونقولها صراحة بدل قائمة مخازن تختار منها ما ليس قسمها.
   */
  const scope = currentUser()?.warehouseIds;
  const myWarehouseId = Array.isArray(scope) && scope.length ? scope[0] : null;

  let warehouses = [];
  let items = [];

  container.appendChild(
    pageHeader({
      title: "نواقص قسمي",
      description: "اطلب ما نقص من قسمك، وتابع أين وصل طلبك.",
    }),
  );

  container.appendChild(host);

  try {
    [warehouses, items] = await Promise.all([getWarehouses(), getItems()]);
  } catch (error) {
    host.appendChild(errorState({ error, title: "فشل تحميل البيانات" }));
    return container;
  }

  const myWarehouse = warehouses.find((w) => String(w.id) === String(myWarehouseId)) ?? null;

  await render();
  return container;

  /* ---------------------------------------------------------------- render */

  async function render() {
    clear(host);

    if (!myWarehouse) {
      host.appendChild(
        emptyState({
          title: "لا يوجد مخزن مسنَد إليك",
          message:
            "طلب النواقص يُقدَّم باسم مخزن القسم، ولا يوجد مخزن مسنَد لحسابك. " +
            "راجع مدير النظام لإسناد مخزن قسمك.",
          icon: "lock",
        }),
      );
      return;
    }

    host.appendChild(
      el(
        "div",
        {
          class:
            "flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl " +
            "border border-line bg-subtle/40",
        },
        [
          el("div", { class: "space-y-0.5" }, [
            el("p", { class: "text-xs text-muted" }, "القسم الطالب"),
            el("p", { class: "font-bold text-ink text-sm" }, myWarehouse.name),
          ]),
          button({
            label: "+ طلب نواقص جديد",
            variant: "primary",
            icon: "plus",
            permission: "inv.requisition.create",
            onClick: openNewRequest,
          }),
        ],
      ),
    );

    host.appendChild(loadingState({ message: "جاري تحميل طلباتك…" }));

    let result;
    try {
      result = await listRequisitions({ branchId: myWarehouse.id, perPage: 50 });
    } catch (error) {
      host.lastElementChild.remove();
      host.appendChild(errorState({ error, title: "فشل تحميل الطلبات", onRetry: render }));
      return;
    }

    host.lastElementChild.remove();

    const rows = result.data ?? [];
    if (!rows.length) {
      host.appendChild(
        emptyState({
          title: "لا طلبات بعد",
          message: "اضغط «طلب نواقص جديد» لطلب ما نقص من قسمك.",
        }),
      );
      return;
    }

    host.appendChild(el("div", { class: "space-y-2" }, ...rows.map(requestCard)));
  }

  /* ------------------------------------------------------------ عرض الطلب */

  function requestCard(req) {
    const status = STATUS[req.status] ?? { label: req.status, tone: "neutral", hint: "" };

    return el(
      "div",
      { class: "p-4 rounded-2xl border border-line bg-white dark:bg-slate-900 space-y-2" },
      [
        el("div", { class: "flex flex-wrap items-start justify-between gap-2" }, [
          el("div", { class: "min-w-0 flex-1 space-y-1" }, [
            el("p", { class: "font-bold text-ink text-sm truncate-1" }, req.itemName),
            el(
              "p",
              { class: "text-[11px] text-muted" },
              `${req.code} · طلبت ${integer(req.requestedQty)} ${req.unit}`,
            ),
          ]),
          badge(status.label, { tone: status.tone, dot: true, size: "sm" }),
        ]),

        el("p", { class: "text-[11px] text-muted" }, status.hint),

        /* الكمية التي وصلت فعلًا — هي ما يهمّ الطالب بعد الحالة. */
        req.receivedQty !== null && req.receivedQty !== undefined
          ? el(
              "p",
              {
                class: cx(
                  "text-[11px] font-bold",
                  req.discrepancyCount
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400",
                ),
              },
              req.discrepancyCount
                ? `استُلم ${integer(req.receivedQty)} من ${integer(req.dispatchedQty)} ${req.unit} — عجز ${integer(req.discrepancyCount)}`
                : `استُلم بالكامل: ${integer(req.receivedQty)} ${req.unit}`,
            )
          : null,

        req.status === "rejected" && req.rejectionReason
          ? el(
              "p",
              { class: "text-[11px] text-muted p-2 rounded-lg bg-subtle/60 border border-line" },
              `سبب الرفض: ${req.rejectionReason}`,
            )
          : null,
      ],
    );
  }

  /* ------------------------------------------------------------ طلب جديد */

  function openNewRequest() {
    /* الأصناف المسموح تخزينها في مخزن القسم فقط. */
    const allowed = items.filter((i) => (i.warehouseIds ?? []).map(String).includes(String(myWarehouse.id)));

    if (!allowed.length) {
      toast.warning("لا توجد أصناف مسموح تخزينها في مخزن قسمك. راجع مدير المخازن.");
      return;
    }

    const itemOptions = [
      { value: "", label: "— اختر الصنف —" },
      ...allowed.map((i) => ({ value: String(i.id), label: `${i.name} (${i.code})` })),
    ];

    /* طلب واحد قد يضم أكثر من صنف ناقص — لا تفتح نافذة جديدة لكل صنف. */
    const form = { lines: [{ itemId: "", requestedQty: 1 }], notes: "" };

    const linesHost = el("div", { class: "space-y-2.5" });

    function paintLines() {
      renderNode(
        linesHost,
        ...form.lines.map((line, index) =>
          el(
            "div",
            { class: "flex items-end gap-2" },
            el(
              "div",
              { class: "flex-1" },
              selectField({
                label: index === 0 ? "الصنف الناقص" : null,
                required: true,
                value: line.itemId,
                options: itemOptions,
                onChange: value((v) => (line.itemId = v)),
              }),
            ),
            el(
              "div",
              { class: "w-24 shrink-0" },
              selectField({
                label: index === 0 ? "الكمية" : null,
                required: true,
                type: "number",
                min: "1",
                value: String(line.requestedQty),
                onInput: numberValue((v) => (line.requestedQty = v)),
              }),
            ),
            form.lines.length > 1
              ? iconButton("trash", {
                  label: "حذف هذا الصنف",
                  onClick: () => {
                    form.lines.splice(index, 1);
                    paintLines();
                  },
                })
              : el("span", { class: "size-9 shrink-0" }),
          ),
        ),
      );
    }

    paintLines();

    formModal({
      title: "طلب نواقص جديد",
      subtitle: `باسم ${myWarehouse.name} — صنف واحد أو أكثر في نفس الطلب`,
      submitLabel: "إرسال الطلب",
      body: () => [
        linesHost,
        button({
          label: "+ إضافة صنف آخر",
          variant: "secondary",
          size: "sm",
          onClick: () => {
            form.lines.push({ itemId: "", requestedQty: 1 });
            paintLines();
          },
        }),
        notesField({
          label: "سبب الاحتياج",
          onInput: value((v) => (form.notes = v)),
        }),
      ],
      onSubmit: async () => {
        if (form.lines.some((line) => !line.itemId)) {
          toast.warning("اختر الصنف في كل سطر.");
          return false;
        }
        if (form.lines.some((line) => !(Number(line.requestedQty) > 0))) {
          toast.warning("أدخل كمية أكبر من صفر في كل سطر.");
          return false;
        }

        const codes = [];
        for (const line of form.lines) {
          const created = await createRequisition({
            branchId: myWarehouse.id,
            itemId: Number(line.itemId),
            requestedQty: Number(line.requestedQty),
            notes: form.notes || undefined,
          });
          codes.push(created.code);
        }

        await render();
        toast.success(
          codes.length > 1
            ? `أُرسلت ${codes.length} طلبات (${codes.join("، ")}) — بانتظار مراجعة المخزن الرئيسي`
            : `أُرسل الطلب ${codes[0]} — بانتظار مراجعة المخزن الرئيسي`,
        );
        return true;
      },
    });
  }
}
