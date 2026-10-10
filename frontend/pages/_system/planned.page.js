/**
 * صفحة «شاشة مخطَّطة».
 *
 * تُعرض لكل شاشة مسجَّلة في خريطة التنقل ولم تُنفَّذ بعد. الغرض الصراحة: المستخدم
 * يعرف أن الشاشة قادمة في مرحلة محددة، لا أن النظام مكسور. وهي تُرضي شرط
 * «لا روابط مكسورة» في docs/09-DEFINITION-OF-DONE.md دون التظاهر بأن الشاشة جاهزة.
 *
 * تُحذف تلقائيًا من المسارات بمجرد تسجيل الشاشة الحقيقية في js/config/routes.js.
 */

import { el } from "../../js/core/dom.js";
import { icon } from "../../components/common/icon.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { findScreen, navigation } from "../../js/config/navigation.js";
import { APP } from "../../js/core/config.js";

/** ما تتضمنه كل مرحلة — من docs/08-IMPLEMENTATION-PLAN.md. */
const PHASES = {
  0: "الأساس: اللياوت، نظام التصميم، المكوّنات، طبقة البيانات",
  1: "الأساسيات: لوحة التحكم، المرضى، المواعيد، الفواتير",
  2: "المالية: المحاسبة، شجرة الحسابات، القيود، المدينون والدائنون",
  3: "العمليات: المخازن، المشتريات، الموردون، الصيدلية",
  4: "الإكلينيكي: المختبر، الأشعة، المسارات الطبية",
  5: "التقارير: مركز التقارير، الفلاتر، المعاينة، التصدير",
  6: "الإدارة: المستخدمون، الأدوار، الصلاحيات، سجل التدقيق، الإعدادات",
};

export default function plannedPage({ path, route }) {
  const screen = findScreen(path);
  const phase = screen?.phase ?? route?.meta?.screen?.phase;
  const moduleEntry = navigation.find((entry) => entry.key === screen?.module);

  /** شاشات أخرى في نفس الموديول — تساعد على التنقل بدل الطريق المسدود. */
  const siblings = (moduleEntry?.children ?? [])
    .filter((child) => child.path !== path)
    .slice(0, 6);

  return el(
    "div",
    {},
    pageHeader({
      title: screen?.label ?? route?.title ?? "شاشة مخطَّطة",
      description: moduleEntry ? `موديول ${moduleEntry.label}` : undefined,
      meta: phase ? badge(`المرحلة ${phase}`, { tone: "info" }) : null,
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
        phase
          ? `«${screen?.label}» مخطَّطة في المرحلة ${phase} — ${PHASES[phase] ?? ""}.`
          : "هذه الشاشة مسجَّلة في خريطة النظام ولم يُبنَ محتواها بعد.",
      ),

      el(
        "p",
        { class: "text-xs text-faint mt-3" },
        `المرحلة المنفَّذة حاليًا: ${APP.phase} — ${PHASES[APP.phase] ?? ""}`,
      ),

      el(
        "div",
        { class: "flex flex-wrap items-center justify-center gap-2 mt-6" },
        button({ label: "نظام التصميم والمكوّنات", icon: "palette", variant: "primary", size: "sm", href: "#/design-system" }),
        button({ label: "لوحة التحكم", variant: "secondary", size: "sm", href: "#/" }),
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
