/**
 * صفحة «شاشة مخطَّطة».
 *
 * تُعرض لكل شاشة مسجَّلة في خريطة التنقل ولم تُنفَّذ بعد. الغرض الصراحة: المستخدم
 * يعرف أن الشاشة قادمة، لا أن النظام مكسور. وهي تُرضي شرط «لا روابط مكسورة» في
 * docs/09-DEFINITION-OF-DONE.md دون التظاهر بأن الشاشة جاهزة.
 *
 * تُحذف تلقائيًا من المسارات بمجرد تسجيل الشاشة الحقيقية في js/config/routes.js.
 */

import { el } from "../../js/core/dom.js";
import { icon } from "../../components/common/icon.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { findScreen, navigation } from "../../js/config/navigation.js";

export default function plannedPage({ path, route }) {
  /*
   * `findScreen` يُطابق مسارات خريطة التنقل الثابتة. شاشات التفاصيل مسارها
   * ديناميكي (`/fin/customers/3`) فلا يُطابق شيئًا — ولذلك يحمل المسار
   * وصفه في `route.meta.screen`. القراءة من الاثنين تُغطي الحالتين.
   */
  const screen = findScreen(path) ?? route?.meta?.screen;
  const moduleEntry = navigation.find((entry) => entry.key === screen?.module);

  /** شاشات أخرى في نفس الموديول — تساعد على التنقل بدل الطريق المسدود. */
  const siblings = (moduleEntry?.children ?? [])
    .filter((child) => child.path !== path)
    .slice(0, 8);

  return el(
    "div",
    {},
    pageHeader({
      title: screen?.label ?? route?.title ?? "شاشة مخطَّطة",
      description: moduleEntry ? `موديول ${moduleEntry.label}` : undefined,
      meta: badge("غير منفَّذة", { tone: "warning" }),
    }),

    el(
      "div",
      {
        class:
          "bg-surface border border-line rounded-[var(--radius-card)] shadow-card " +
          "px-6 py-12 flex flex-col items-center text-center",
      },
      el(
        "span",
        { class: "grid place-items-center size-14 rounded-full bg-subtle text-faint mb-4" },
        icon(moduleEntry?.icon ?? "reports", { size: 26 }),
      ),

      el("h2", { class: "text-base font-semibold text-ink" }, "هذه الشاشة لم تُنفَّذ بعد"),

      el(
        "p",
        { class: "text-sm text-muted mt-2 max-w-lg leading-relaxed" },
        `«${screen?.label ?? route?.title}» مسجَّلة في خريطة النظام ولم يُبنَ محتواها بعد. ` +
          "تظهر هكذا صراحةً بدل أن تكون رابطًا مكسورًا أو شاشة فارغة بلا تفسير.",
      ),

      el(
        "div",
        { class: "flex flex-wrap items-center justify-center gap-2 mt-6" },
        button({ label: "لوحة التحكم", icon: "dashboard", variant: "primary", size: "sm", href: "#/" }),
      ),

      siblings.length
        ? el(
            "div",
            { class: "mt-8 pt-6 border-t border-line w-full max-w-lg" },
            el(
              "p",
              { class: "text-[11px] font-semibold text-faint mb-2.5" },
              `شاشات أخرى في ${moduleEntry.label}`,
            ),
            el(
              "div",
              { class: "flex flex-wrap items-center justify-center gap-1.5" },
              ...siblings.map((sibling) =>
                el(
                  "a",
                  {
                    href: `#${sibling.path}`,
                    class:
                      "px-2.5 py-1 rounded-full border border-line text-xs text-muted " +
                      "hover:border-brand-400 hover:text-brand-300 transition-colors",
                  },
                  sibling.label,
                ),
              ),
            ),
          )
        : null,
    ),
  );
}
