/**
 * لوحة إشغال الغرف والأسرّة — الشاشة الأولى لموظف الاستقبال.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  قرار التصميم: **شبكة، لا جدول.**
 *
 *  موظف الاستقبال يُسأل عشرين مرة في الساعة سؤالًا واحدًا: «فيه أوضة
 *  فاضية؟». الجواب يجب أن يأتي بنظرة واحدة لا بقراءة صفوف وفلترة أعمدة.
 *  لذلك كل وحدة مربع ملوّن بحالتها، مجمَّعة بالدور، وكل مربع فاضٍ هو
 *  **زر مباشر لفتح إقامة** — كليك واحد من السؤال إلى الحجز.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { el, clear, cx } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile, statGrid } from "../../components/common/card.js";
import { loadingState, errorState } from "../../components/feedback/states.js";
import { openModal } from "../../components/modals/overlay.js";
import { formModal, selectField, notesField, value } from "../_shared/forms.js";
import { runAction } from "../_shared/list-page.js";
import { toast } from "../../components/feedback/toast.js";
import { currency, integer } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { can } from "../../js/core/permissions.js";
import { getOccupancyBoard, getRoom, setRoomStatus, runDailyBedCharges } from "../../js/api/rooms.api.js";
import { listPatients, createAdmission } from "../../js/api/patients.api.js";

/** لون ودلالة كل حالة — نفس المفتاح في كل الشاشة بلا استثناء. */
const STATUS_STYLE = {
  vacant: {
    label: "فاضية",
    tone: "success",
    tile: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "مشغولة",
    tone: "danger",
    tile: "border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 hover:border-rose-500",
    dot: "bg-rose-500",
  },
  cleaning: {
    label: "تنظيف وتجهيز",
    tone: "warning",
    tile: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 hover:border-amber-500",
    dot: "bg-amber-500",
  },
  maintenance: {
    label: "خارج الخدمة",
    tone: "neutral",
    tile: "border-slate-400/40 bg-slate-100 dark:bg-slate-800/60 hover:border-slate-500",
    dot: "bg-slate-500",
  },
};

export default async function occupancyPage() {
  const container = el("div", { class: "space-y-4" });
  const host = el("div", { class: "space-y-4" });

  let filters = { status: "all", category: "all" };

  container.appendChild(
    pageHeader({
      title: "إشغال الغرف والأسرّة",
      description:
        "كل وحدة إقامة بحالتها اللحظية. المربع الأخضر فاضي — اضغط عليه لفتح إقامة مباشرة.",
      actions: [
        button({
          label: "تشغيل استحقاق اليوم",
          variant: "secondary",
          icon: "refresh",
          permission: "patients.admissions.manage",
          onClick: () =>
            runAction(
              async () => {
                const result = await runDailyBedCharges();
                toast.success(
                  `استحقاق ${result.date}: ${result.linesCreated} سطر جديد ` +
                    `(${currency(result.amountAccrued)}) · ${result.linesSkipped} محمَّل سابقًا`,
                );
              },
              {},
            ),
        }),
        button({
          label: "سجل الإقامات",
          variant: "secondary",
          icon: "reports",
          onClick: () => navigate("/patients/admissions"),
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
    host.appendChild(loadingState({ message: "جاري تحميل لوحة الإشغال…" }));

    let board;
    try {
      board = await getOccupancyBoard(filters);
    } catch (error) {
      clear(host);
      host.appendChild(
        errorState({ error, title: "فشل تحميل لوحة الإشغال", onRetry: render }),
      );
      return;
    }

    clear(host);
    const { summary } = board;

    /* 1) المؤشرات — الأرقام التي تُسأل عنها الموظفة أولًا. */
    host.appendChild(
      statGrid(
        statTile({
          label: "وحدات فاضية جاهزة للحجز",
          value: integer(summary.vacant),
          hint: `من ${integer(summary.inService)} وحدة في الخدمة`,
          icon: "check",
          tone: "success",
        }),
        statTile({
          label: "وحدات مشغولة الآن",
          value: integer(summary.occupied),
          hint: `نسبة الإشغال ${summary.occupancyRate}%`,
          icon: "hospital",
          tone: "danger",
        }),
        statTile({
          label: "تحت التنظيف والتجهيز",
          value: integer(summary.cleaning),
          hint: "تصير فاضية بعد التجهيز",
          icon: "refresh",
          tone: "warning",
        }),
        statTile({
          label: "خارج الخدمة (صيانة)",
          value: integer(summary.maintenance),
          hint: "غير محسوبة في طاقة الاستيعاب",
          icon: "settings",
          tone: "neutral",
        }),
      ),
    );

    /* 2) شريط الفلترة والمفتاح اللوني في سطر واحد. */
    host.appendChild(filterBar());

    /* 3) الشبكة — صف لكل دور. */
    if (!board.floors.length) {
      host.appendChild(
        el(
          "div",
          { class: "p-8 text-center text-sm text-muted rounded-2xl border border-line bg-subtle/40" },
          "لا توجد وحدات مطابقة للفلترة الحالية.",
        ),
      );
      return;
    }

    for (const floor of board.floors) {
      host.appendChild(floorBlock(floor));
    }
  }

  /* ------------------------------------------------------------ filter bar */

  function filterBar() {
    const chip = (label, active, onClick) =>
      el(
        "button",
        {
          type: "button",
          class: cx(
            "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap",
            active
              ? "border-brand-500 bg-brand-500 text-white shadow-2xs"
              : "border-line bg-white dark:bg-slate-800 text-ink hover:border-brand-500/60",
          ),
          onClick,
        },
        label,
      );

    const setStatus = (status) => {
      filters = { ...filters, status };
      render();
    };
    const setCategory = (category) => {
      filters = { ...filters, category };
      render();
    };

    return el(
      "div",
      {
        class:
          "flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-line bg-subtle/40",
      },
      [
        el("div", { class: "flex flex-wrap items-center gap-2" }, [
          el("span", { class: "text-xs font-bold text-muted" }, "الحالة:"),
          chip("الكل", filters.status === "all", () => setStatus("all")),
          chip("فاضية", filters.status === "vacant", () => setStatus("vacant")),
          chip("مشغولة", filters.status === "occupied", () => setStatus("occupied")),
          chip("تنظيف", filters.status === "cleaning", () => setStatus("cleaning")),
          chip("صيانة", filters.status === "maintenance", () => setStatus("maintenance")),
        ]),
        el("div", { class: "flex flex-wrap items-center gap-2" }, [
          el("span", { class: "text-xs font-bold text-muted" }, "النوع:"),
          chip("الكل", filters.category === "all", () => setCategory("all")),
          chip("غرف وأجنحة", filters.category === "room", () => setCategory("room")),
          chip("عناية مركزة", filters.category === "icu", () => setCategory("icu")),
        ]),
      ],
    );
  }

  /* ----------------------------------------------------------- floor block */

  function floorBlock(floor) {
    return el(
      "div",
      { class: "space-y-3" },
      [
        el("div", { class: "flex flex-wrap items-center justify-between gap-2" }, [
          el("h3", { class: "font-bold text-ink text-sm" }, floor.floor),
          el("div", { class: "flex items-center gap-2" }, [
            badge(`فاضي ${floor.vacant}`, { tone: "success", size: "sm", dot: true }),
            badge(`مشغول ${floor.occupied}`, { tone: "danger", size: "sm", dot: true }),
            badge(`إجمالي ${floor.total}`, { tone: "neutral", size: "sm" }),
          ]),
        ]),
        el(
          "div",
          {
            class:
              "grid gap-2.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
          },
          ...floor.rooms.map(roomTile),
        ),
      ],
    );
  }

  /* ------------------------------------------------------------- room tile */

  function roomTile(room) {
    const style = STATUS_STYLE[room.status] ?? STATUS_STYLE.maintenance;

    return el(
      "button",
      {
        type: "button",
        class: cx(
          "text-start p-3 rounded-2xl border-2 transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-raised focus:outline-none focus:ring-2 focus:ring-brand-500/40",
          style.tile,
        ),
        onClick: () => openRoomSheet(room),
      },
      [
        el("div", { class: "flex items-center justify-between gap-2" }, [
          el("span", { class: "font-black text-ink text-sm ltr-isolate num" }, room.code),
          el("span", { class: cx("size-2.5 rounded-full shrink-0", style.dot) }),
        ]),
        el("p", { class: "text-[11px] text-muted truncate-1 mt-1" }, room.roomTypeName),
        el(
          "p",
          { class: "text-[11px] font-bold mt-1.5 truncate-1 text-ink" },
          room.status === "occupied"
            ? `${room.currentPatientName} · ليلة ${room.stayNights}`
            : style.label,
        ),
        el(
          "p",
          { class: "text-[11px] text-muted mt-1 num" },
          `${currency(room.dailyRate)} / يوم`,
        ),
      ],
    );
  }

  /* ------------------------------------------------------------ room sheet */

  async function openRoomSheet(room) {
    /*
      الوحدة الفاضية: الهدف الحجز، فنفتح نموذج الحجز مباشرة — لا نافذة
      وسيطة تُضيف كليكًا بلا معلومة جديدة.
    */
    if (room.status === "vacant") {
      if (!can("patients.admissions.manage")) {
        toast.warning("لا تملك صلاحية فتح إقامة. راجع مدير النظام.");
        return;
      }
      await openAdmitModal(room);
      return;
    }

    let detail;
    try {
      detail = await getRoom(room.id);
    } catch (error) {
      toast.error(error.message || "فشل تحميل بيانات الوحدة");
      return;
    }

    const style = STATUS_STYLE[detail.status] ?? STATUS_STYLE.maintenance;

    openModal({
      title: `${detail.name} — ${detail.roomType.name}`,
      /* الحقول الغائبة تُحذف لا تُطبع: الوحدة لا تحمل حقل قسم أصلًا، وكان
         العنوان ينتهي بـ«· undefined» في كل نافذة وحدة. */
      subtitle: [detail.floor, detail.wing, detail.roomType?.name].filter(Boolean).join(" · "),
      size: "md",
      body: (close) => {
        const content = el("div", { class: "space-y-4 text-sm" });

        content.appendChild(
          el("div", { class: "flex flex-wrap items-center gap-2" }, [
            badge(style.label, { tone: style.tone, dot: true }),
            badge(`${currency(detail.dailyRate)} / يوم`, { tone: "brand", size: "sm" }),
            detail.nursingRate
              ? badge(
                  `إقامة ${currency(detail.roomRate)} + تمريض ${currency(detail.nursingRate)}`,
                  { tone: "info", size: "sm" },
                )
              : null,
          ]),
        );

        if (detail.currentAdmission) {
          const adm = detail.currentAdmission;
          content.appendChild(
            el(
              "div",
              {
                class:
                  "p-4 rounded-2xl border border-line bg-subtle/50 dark:bg-subtle/30 space-y-2",
              },
              [
                el("h4", { class: "font-bold text-ink text-sm" }, "الشاغل الحالي"),
                row("المريض", `${adm.patientName} (${adm.patientCode})`),
                row("كود الإقامة", adm.code),
                row("تاريخ الدخول", adm.admissionDate),
                row("الليالي المحمَّلة حتى اليوم", integer(room.stayNights)),
                row("الطبيب المعالج", adm.attendingDoctor ?? "—"),
                row("التشخيص", adm.diagnosis ?? "—"),
                el("div", { class: "pt-2" }, [
                  button({
                    label: "كشف حساب المريض",
                    variant: "primary",
                    size: "sm",
                    icon: "eye",
                    onClick: () => {
                      close();
                      navigate(`/patients/${adm.patientId}`);
                    },
                  }),
                ]),
              ],
            ),
          );
        }

        if (detail.notes) {
          content.appendChild(
            el(
              "p",
              { class: "text-xs text-muted p-3 rounded-xl bg-subtle/50 border border-line" },
              `ملاحظات: ${detail.notes}`,
            ),
          );
        }

        /* تغيير الحالة متاح للتنظيف والصيانة فقط — لا للإشغال. */
        if (detail.status !== "occupied" && can("patients.admissions.manage")) {
          content.appendChild(
            el("div", { class: "flex flex-wrap gap-2 pt-3 border-t border-line" }, [
              detail.status !== "vacant"
                ? button({
                    label: "إعلان الوحدة جاهزة (فاضية)",
                    variant: "success",
                    size: "sm",
                    icon: "check",
                    onClick: () =>
                      runAction(
                        async () => {
                          await setRoomStatus(detail.id, { status: "vacant" });
                          close();
                          await render();
                        },
                        { success: `${detail.name} صارت جاهزة للحجز` },
                      ),
                  })
                : null,
              detail.status !== "cleaning"
                ? button({
                    label: "تحت التنظيف",
                    variant: "secondary",
                    size: "sm",
                    icon: "refresh",
                    onClick: () =>
                      runAction(
                        async () => {
                          await setRoomStatus(detail.id, { status: "cleaning" });
                          close();
                          await render();
                        },
                        { success: `${detail.name} تحت التنظيف والتجهيز` },
                      ),
                  })
                : null,
              detail.status !== "maintenance"
                ? button({
                    label: "خارج الخدمة (صيانة)",
                    variant: "danger",
                    size: "sm",
                    icon: "warning",
                    onClick: () => {
                      const notes = window.prompt("سبب إخراج الوحدة من الخدمة:");
                      if (!notes?.trim()) return;
                      runAction(
                        async () => {
                          await setRoomStatus(detail.id, { status: "maintenance", notes });
                          close();
                          await render();
                        },
                        { success: `${detail.name} خارج الخدمة` },
                      );
                    },
                  })
                : null,
            ]),
          );
        }

        return content;
      },
      footer: (close) => [
        button({ label: "إغلاق", variant: "secondary", onClick: () => close() }),
      ],
    });
  }

  /* ----------------------------------------------------------- admit modal */

  async function openAdmitModal(room) {
    let patients = [];
    try {
      const result = await listPatients({ perPage: 200 });
      patients = result.data ?? [];
    } catch {
      toast.error("فشل تحميل سجل المرضى");
      return;
    }

    /* المقيم بالفعل لا يُحجز له سرير ثانٍ — نُخفيه من القائمة لا نُفاجئه بخطأ. */
    const options = patients
      .filter((p) => p.status !== "inpatient")
      .map((p) => ({ value: String(p.id), label: `${p.name} (${p.code}) — ${p.phone}` }));

    if (!options.length) {
      toast.warning("لا يوجد مريض غير مقيم لحجز وحدة له. سجّل مريضًا جديدًا أولًا.");
      return;
    }

    const form = { patientId: "", attendingDoctor: "", diagnosis: "", notes: "" };

    formModal({
      title: `فتح إقامة في ${room.name}`,
      subtitle:
        `${room.roomTypeName} · ${room.floor} · التعريفة ${currency(room.dailyRate)} / يوم ` +
        "— تُحمَّل آليًا كل ليلة حتى الخروج",
      submitLabel: "تأكيد الحجز وفتح الإقامة",
      body: () => [
        selectField({
          label: "المريض",
          required: true,
          options: [{ value: "", label: "— اختر المريض —" }, ...options],
          onChange: value((v) => (form.patientId = v)),
        }),
        selectField({
          label: "الطبيب المعالج",
          options: [
            { value: "", label: "— بدون تحديد —" },
            { value: "د. حازم عبد العزيز — استشاري الجراحة العامة", label: "د. حازم عبد العزيز — الجراحة العامة" },
            { value: "د. طارق الشربيني — استشاري الرعاية المركزة", label: "د. طارق الشربيني — الرعاية المركزة" },
            { value: "د. شيرين حسني — استشاري أمراض القلب", label: "د. شيرين حسني — أمراض القلب" },
            { value: "د. محمد سامي — استشاري جراحة العظام", label: "د. محمد سامي — جراحة العظام" },
            { value: "د. نيفين كمال — استشاري الباطنة العامة", label: "د. نيفين كمال — الباطنة العامة" },
          ],
          onChange: value((v) => (form.attendingDoctor = v)),
        }),
        notesField({
          label: "التشخيص / سبب الدخول",
          onInput: value((v) => (form.diagnosis = v)),
        }),
        notesField({
          label: "ملاحظات الاستقبال",
          onInput: value((v) => (form.notes = v)),
        }),
      ],
      onSubmit: async () => {
        if (!form.patientId) {
          toast.warning("اختر المريض أولًا.");
          return false;
        }

        const created = await createAdmission({
          patientId: Number(form.patientId),
          roomId: room.id,
          attendingDoctor: form.attendingDoctor || undefined,
          diagnosis: form.diagnosis || undefined,
          notes: form.notes || undefined,
        });

        await render();
        toast.success(
          `تم فتح الإقامة ${created.code} في ${room.name} ` +
            `وتحميل ${created.accrual?.nights ?? 1} ليلة على حساب المريض`,
        );
        return true;
      },
    });
  }
}

/** صف «تسمية: قيمة» مضغوط. */
function row(label, text) {
  return el("div", { class: "flex items-start justify-between gap-3 text-xs" }, [
    el("span", { class: "text-muted shrink-0" }, label),
    el("span", { class: "font-semibold text-ink text-end" }, String(text ?? "—")),
  ]);
}
