/**
 * صرف أدوية ومستلزمات لمريض — شاشة الصيدلية الفرعية والتمريض.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  قرار التصميم: **شاشة واحدة، ثلاث خطوات، بلا تنقّل.**
 *
 *  الممرضة تنزل الصيدلية وهي تعرف غرفتها وأصنافها. فلا تُجبر على المرور
 *  بقائمة مرضى ثم ملف مريض ثم نموذج صرف: تختار الغرفة من شبكة المشغول،
 *  تضيف الأصناف من قائمة المتاح فعلًا بأرصدتها، وتضغط «صرف». الحساب
 *  والهامش يظهران قبل التنفيذ لا بعده.
 *
 *  الصرف هنا **مزدوج الأثر**: الكمية تخرج من المخزن والقيمة تُحمَّل على
 *  حساب المريض في نفس اللحظة.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { el, clear, cx } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { button, iconButton } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile, statGrid } from "../../components/common/card.js";
import { loadingState, errorState, emptyState } from "../../components/feedback/states.js";
import { toast } from "../../components/feedback/toast.js";
import { runAction } from "../_shared/list-page.js";
import { currency, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import {
  listDispensableItems,
  dispenseBasketToPatient,
  listPatientDispenses,
} from "../../js/api/dispensing.api.js";
import { listRooms } from "../../js/api/rooms.api.js";
import { listPatients } from "../../js/api/patients.api.js";
import { listWarehouses } from "../../js/api/inventory.api.js";
import { allowedWarehouseIds } from "../../js/core/permissions.js";

export default async function dispensePage() {
  const container = el("div", { class: "space-y-4" });
  const host = el("div", { class: "space-y-4" });

  /** سلة الصرف: itemId → { item, quantity }. */
  const basket = new Map();

  let warehouses = [];
  let warehouseId = null;
  let selected = null; // { patientId, patientName, patientCode, roomLabel }
  let itemSearch = "";

  /*
   * يُعلَن مع بقية حالة الشاشة لا قبل استخدامه بأسطر: `basketPanel()` تُنادى
   * من `render()` عند أول رسم، و`let` لا تُرفَع كالدوال — فإعلانه لاحقًا
   * يرمي ReferenceError قبل أن تُرسم الشاشة من أصلها.
   */
  let basketHost = null;

  container.appendChild(
    pageHeader({
      title: "صرف أدوية ومستلزمات لمريض",
      description:
        "اختر المريض أو الغرفة، أضف الأصناف، واضغط صرف. الكمية تخرج من المخزن " +
        "وتُحمَّل على حساب المريض بسعر البيع المعتمد في نفس اللحظة.",
      actions: [
        button({
          label: "حركات المخزون",
          variant: "secondary",
          icon: "reports",
          onClick: () => navigate("/inv/movements"),
        }),
      ],
    }),
  );

  container.appendChild(host);

  try {
    const result = await listWarehouses({ perPage: 50 });
    const active = (result.data ?? []).filter((w) => w.status === "active");

    /*
     * أمين المخزن الفرعي يصرف من مخزنه هو فقط — عرض كل الفروع كأزرار جنب
     * بعضها (مخزن 1، مخزن 2، مخزن 3...) كان يلخبطه بمخازن غيره لا شغل له
     * بها. `allowedWarehouseIds` تُعيد `null` لمن بلا قيد (مدير النظام
     * ومدير المخازن) فيبقى الاختيار بينها متاحًا لهما فقط.
     */
    const allowed = allowedWarehouseIds();
    warehouses = allowed === null ? active : active.filter((w) => allowed.includes(String(w.id)));

    /* الافتراضي أول مخزن فرعي — أمين المخزن الفرعي هو من يصرف للمريض لا المركزي. */
    warehouseId = (warehouses.find((w) => !w.isHub) ?? warehouses[0])?.id ?? null;
  } catch (error) {
    host.appendChild(errorState({ error, title: "فشل تحميل المخازن" }));
    return container;
  }

  await render();
  return container;

  /* ---------------------------------------------------------------- render */

  async function render() {
    clear(host);
    host.appendChild(loadingState({ message: "جاري التحميل…" }));

    let rooms = [];
    let patients = [];
    let items = { data: [], meta: {} };

    try {
      [rooms, patients, items] = await Promise.all([
        listRooms({ status: "occupied" }).then((r) => r.data ?? []),
        listPatients({ perPage: 200 }).then((r) => r.data ?? []),
        warehouseId
          ? listDispensableItems({ warehouseId, search: itemSearch })
          : Promise.resolve({ data: [], meta: {} }),
      ]);
    } catch (error) {
      clear(host);
      host.appendChild(errorState({ error, title: "فشل تحميل بيانات الصرف", onRetry: render }));
      return;
    }

    clear(host);

    host.appendChild(warehousePicker());
    host.appendChild(
      el("div", { class: "grid gap-4 lg:grid-cols-[1fr_360px] items-start" }, [
        el("div", { class: "space-y-4" }, [patientPicker(rooms, patients), itemPicker(items)]),
        basketPanel(),
      ]),
    );
  }

  /* ------------------------------------------------------ warehouse picker */

  function warehousePicker() {
    /* مخزن واحد في النطاق — تسمية لا اختيار. لا داعي لصف أزرار على سؤال له جواب واحد. */
    if (warehouses.length <= 1) {
      return el(
        "div",
        {
          class:
            "flex items-center gap-2 p-3 rounded-2xl border border-line bg-subtle/40 text-xs",
        },
        el("span", { class: "font-bold text-muted" }, "الصرف من مخزن:"),
        el("span", { class: "font-bold text-ink" }, warehouses[0]?.name ?? "—"),
      );
    }

    return el(
      "div",
      {
        class:
          "flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-line bg-subtle/40",
      },
      [
        el("span", { class: "text-xs font-bold text-muted" }, "الصرف من مخزن:"),
        ...warehouses.map((w) =>
          el(
            "button",
            {
              type: "button",
              class: cx(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap",
                String(w.id) === String(warehouseId)
                  ? "border-brand-500 bg-brand-500 text-white shadow-2xs"
                  : "border-line bg-white dark:bg-slate-800 text-ink hover:border-brand-500/60",
              ),
              onClick: () => {
                if (String(w.id) === String(warehouseId)) return;
                /* تغيير المخزن يُبطل السلة: الأرصدة والأسعار مرتبطة بالمخزن. */
                basket.clear();
                warehouseId = w.id;
                render();
              },
            },
            w.name,
          ),
        ),
      ],
    );
  }

  /* -------------------------------------------------------- patient picker */

  function patientPicker(rooms, patients) {
    const body = el("div", { class: "space-y-3" });

    if (selected) {
      body.appendChild(
        el(
          "div",
          {
            class:
              "flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl " +
              "border-2 border-brand-500/40 bg-brand-50/50 dark:bg-brand-950/25",
          },
          [
            el("div", { class: "space-y-1" }, [
              el("p", { class: "font-bold text-ink text-sm" }, selected.patientName),
              el(
                "p",
                { class: "text-xs text-muted" },
                `${selected.patientCode} · ${selected.roomLabel}`,
              ),
            ]),
            button({
              label: "تغيير المريض",
              variant: "ghost",
              size: "sm",
              icon: "refresh",
              onClick: () => {
                selected = null;
                render();
              },
            }),
          ],
        ),
      );
      return section("1 · المريض المستلم", body);
    }

    /* المرضى المقيمون أولًا، معروضين كغرف — هي الطريقة التي تفكر بها الممرضة. */
    if (rooms.length) {
      body.appendChild(el("p", { class: "text-xs font-bold text-muted" }, "الغرف المشغولة:"));
      body.appendChild(
        el(
          "div",
          { class: "grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" },
          ...rooms.map((room) =>
            el(
              "button",
              {
                type: "button",
                class:
                  "text-start p-3 rounded-2xl border-2 border-line bg-white dark:bg-slate-800 " +
                  "hover:border-brand-500 hover:-translate-y-0.5 transition-all duration-200",
                onClick: () => {
                  selected = {
                    patientId: room.currentPatientId,
                    patientName: room.currentPatientName,
                    patientCode:
                      patients.find((p) => String(p.id) === String(room.currentPatientId))?.code ?? "—",
                    roomLabel: `${room.name} · ليلة ${room.stayNights}`,
                  };
                  render();
                },
              },
              [
                el("p", { class: "font-black text-ink text-sm ltr-isolate num" }, room.code),
                el("p", { class: "text-[11px] text-muted truncate-1 mt-1" }, room.currentPatientName),
              ],
            ),
          ),
        ),
      );
    }

    /* مرضى العيادات الخارجية — صرف بلا إقامة. */
    const outpatients = patients.filter((p) => p.status !== "inpatient");
    const search = el("input", {
      type: "search",
      class:
        "w-full px-3 py-2 rounded-xl border border-line bg-white dark:bg-slate-800 text-ink text-sm",
      placeholder: "أو ابحث عن مريض عيادات خارجية بالاسم أو الكود…",
      onInput: (event) => {
        const q = String(event.target.value || "").trim().toLowerCase();
        clear(resultHost);
        if (q.length < 2) return;

        const hits = outpatients
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              String(p.code).toLowerCase().includes(q) ||
              String(p.phone).includes(q),
          )
          .slice(0, 8);

        if (!hits.length) {
          resultHost.appendChild(
            el("p", { class: "text-xs text-muted px-1 py-2" }, "لا نتائج مطابقة."),
          );
          return;
        }

        for (const p of hits) {
          resultHost.appendChild(
            el(
              "button",
              {
                type: "button",
                class:
                  "w-full text-start px-3 py-2 rounded-xl border border-line bg-white " +
                  "dark:bg-slate-800 hover:border-brand-500 text-xs transition-colors",
                onClick: () => {
                  selected = {
                    patientId: p.id,
                    patientName: p.name,
                    patientCode: p.code,
                    roomLabel: "عيادات خارجية — بلا إقامة",
                  };
                  render();
                },
              },
              `${p.name} (${p.code}) · ${p.phone}`,
            ),
          );
        }
      },
    });

    const resultHost = el("div", { class: "space-y-1.5" });
    body.appendChild(el("div", { class: "space-y-2 pt-1" }, [search, resultHost]));

    return section("1 · المريض المستلم", body);
  }

  /* ----------------------------------------------------------- item picker */

  function itemPicker(items) {
    if (!selected) {
      return section(
        "2 · الأصناف",
        el(
          "p",
          { class: "text-xs text-muted p-4 text-center" },
          "اختر المريض أولًا ليُعرض المتاح في المخزن.",
        ),
      );
    }

    const search = el("input", {
      type: "search",
      class:
        "w-full px-3 py-2 rounded-xl border border-line bg-white dark:bg-slate-800 text-ink text-sm",
      placeholder: "ابحث باسم الصنف أو كوده…",
      value: itemSearch,
      onChange: (event) => {
        itemSearch = String(event.target.value || "");
        render();
      },
    });

    const body = el("div", { class: "space-y-3" }, [search]);

    if (!items.data.length) {
      body.appendChild(
        emptyState({
          title: "لا أصناف متاحة",
          message: "لا يوجد رصيد متاح في هذا المخزن مطابق للبحث.",
        }),
      );
      return section("2 · الأصناف", body);
    }

    body.appendChild(
      el(
        "div",
        { class: "max-h-96 overflow-y-auto space-y-1.5 pe-1" },
        ...items.data.map((item) => {
          const inBasket = basket.get(item.itemId);

          return el(
            "div",
            {
              class: cx(
                "flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors",
                inBasket
                  ? "border-brand-500/50 bg-brand-50/50 dark:bg-brand-950/25"
                  : "border-line bg-white dark:bg-slate-800",
              ),
            },
            [
              el("div", { class: "min-w-0 flex-1 space-y-0.5" }, [
                el("p", { class: "text-xs font-bold text-ink truncate-1" }, item.itemName),
                el("div", { class: "flex flex-wrap items-center gap-1.5" }, [
                  badge(`متاح ${integer(item.available)} ${item.unit}`, {
                    tone: "info",
                    size: "sm",
                  }),
                  item.patientChargeable
                    ? badge(`${currency(item.sellingPrice)} / ${item.unit}`, {
                        tone: "success",
                        size: "sm",
                      })
                    : badge("غير محمَّل على المريض", { tone: "neutral", size: "sm" }),
                ]),
              ]),
              el("div", { class: "flex items-center gap-1.5 shrink-0" }, [
                el("input", {
                  type: "number",
                  min: "1",
                  max: String(item.available),
                  value: String(inBasket?.quantity ?? 1),
                  class:
                    "w-16 px-2 py-1 rounded-lg border border-line bg-white dark:bg-slate-900 " +
                    "text-ink text-center text-xs font-bold num",
                  onChange: (event) => {
                    const qty = Number(event.target.value);
                    if (inBasket) {
                      if (qty > 0) inBasket.quantity = qty;
                      refreshBasketPanel();
                    }
                  },
                }),
                inBasket
                  ? iconButton("close", {
                      label: "إزالة من السلة",
                      onClick: () => {
                        basket.delete(item.itemId);
                        render();
                      },
                    })
                  : button({
                      label: "إضافة",
                      variant: "secondary",
                      size: "sm",
                      icon: "plus",
                      onClick: (event) => {
                        const input = event.currentTarget
                          .closest("div")
                          ?.querySelector("input[type=number]");
                        const qty = Math.max(1, Number(input?.value || 1));

                        if (qty > item.available) {
                          toast.warning(
                            `المتاح من «${item.itemName}» هو ${item.available} ${item.unit} فقط.`,
                          );
                          return;
                        }

                        basket.set(item.itemId, { item, quantity: qty });
                        render();
                      },
                    }),
              ]),
            ],
          );
        }),
      ),
    );

    return section("2 · الأصناف", body);
  }

  /* --------------------------------------------------------- basket panel */

  function basketPanel() {
    basketHost = el("div", { class: "space-y-3" });
    refreshBasketPanel();

    return el(
      "div",
      {
        class:
          "rounded-2xl border-2 border-brand-500/25 bg-brand-50/30 dark:bg-brand-950/20 " +
          "p-4 space-y-3 lg:sticky lg:top-4",
      },
      [
        el("h3", { class: "font-bold text-ink text-sm flex items-center gap-2" }, [
          el("span", {}, "🧺"),
          "3 · سلة الصرف والتحميل",
        ]),
        basketHost,
      ],
    );
  }

  function refreshBasketPanel() {
    if (!basketHost) return;
    clear(basketHost);

    if (!basket.size) {
      basketHost.appendChild(
        el(
          "p",
          { class: "text-xs text-muted py-4 text-center" },
          "السلة فاضية. أضف صنفًا من القائمة.",
        ),
      );
      return;
    }

    let totalCharge = 0;
    let unitsCount = 0;

    /*
     * المعروض هنا تقدير بسعر البيع المعتمد فقط. التكلفة الحقيقية يحسبها
     * محرك التقييم (FIFO / متوسط) في الخدمة لحظة الصرف — ولا تُقدَّر هنا.
     */
    for (const { item, quantity } of basket.values()) {
      if (item.patientChargeable) totalCharge += item.sellingPrice * quantity;
      unitsCount += quantity;
    }

    basketHost.appendChild(
      el(
        "div",
        { class: "space-y-1.5" },
        ...[...basket.values()].map(({ item, quantity }) =>
          el("div", { class: "flex items-start justify-between gap-2 text-xs" }, [
            el("span", { class: "text-ink truncate-1 flex-1" }, `${item.itemName} × ${quantity}`),
            el(
              "span",
              { class: "font-bold num shrink-0" },
              item.patientChargeable ? currency(item.sellingPrice * quantity) : "—",
            ),
          ]),
        ),
      ),
    );

    basketHost.appendChild(
      el("div", { class: "pt-3 border-t border-brand-500/20 space-y-1.5" }, [
        el("div", { class: "flex items-center justify-between text-xs" }, [
          el("span", { class: "text-muted" }, "عدد الوحدات المنصرفة"),
          el("span", { class: "font-bold num" }, integer(unitsCount)),
        ]),
        el("div", { class: "flex items-center justify-between text-sm" }, [
          el("span", { class: "font-bold text-ink" }, "المحمَّل على حساب المريض"),
          el("span", { class: "font-black num text-brand-700 dark:text-brand-300" }, currency(totalCharge)),
        ]),
      ]),
    );

    basketHost.appendChild(
      button({
        label: `صرف وتحميل على حساب ${selected?.patientName ?? "المريض"}`,
        variant: "primary",
        icon: "check",
        class: "w-full justify-center",
        permission: "inv.issue.create",
        onClick: submitBasket,
      }),
    );
  }

  /* -------------------------------------------------------------- submit */

  async function submitBasket() {
    if (!selected) {
      toast.warning("اختر المريض أولًا.");
      return;
    }
    if (!basket.size) {
      toast.warning("السلة فاضية.");
      return;
    }

    await runAction(async () => {
      const result = await dispenseBasketToPatient({
        patientId: selected.patientId,
        warehouseId,
        lines: [...basket.values()].map(({ item, quantity }) => ({
          itemId: item.itemId,
          quantity,
        })),
      });

      /*
       * الفشل الجزئي يُعلَن صريحًا. إظهار «تم الصرف» على عملية فشل نصفها
       * يجعل الممرضة تظن أن الدواء صُرف وهو لم يخرج.
       */
      if (result.failedCount > 0) {
        toast.warning(
          `صُرف ${result.dispensedCount} صنف، وفشل ${result.failedCount}: ` +
            result.failed.map((f) => `${f.itemName} (${f.reason})`).join(" · "),
        );
      }

      if (result.dispensedCount > 0) {
        toast.success(
          `تم صرف ${result.dispensedCount} صنف وتحميل ${currency(result.totalCharged)} ` +
            `على حساب ${selected.patientName} · هامش ${currency(result.margin)}`,
        );
      }

      basket.clear();
      await render();
    });
  }
}

/** قسم بترويسة — يُبقي الخطوات الثلاث مرئية في شاشة واحدة. */
function section(title, body) {
  return el(
    "div",
    { class: "rounded-2xl border border-line bg-white dark:bg-slate-900 p-4 space-y-3" },
    [el("h3", { class: "font-bold text-ink text-sm" }, title), body],
  );
}
