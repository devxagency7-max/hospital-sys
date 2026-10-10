/**
 * القوائم المالية الختامية (Financial Statements)
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { currency } from "../../js/core/format.js";
import { listAccounts } from "../../js/api/accounting.api.js";

export default async function financialStatementsPage() {
  const container = el("div", { class: "space-y-4" });

  let accounts = [];
  try {
    const res = await listAccounts({ perPage: 200 });
    accounts = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "القوائم المالية الختامية",
    description: "قائمة الدخل الشامل، قائمة المركز المالي (الميزانية العمومية)، وقائمة التدفقات النقدية.",
    actions: [
      button({
        label: "تصدير التقرير المالي",
        variant: "primary",
        icon: "download",
        onClick: () => window.print(),
      }),
    ],
  });
  container.appendChild(header);

  // حساب أرقام القوائم
  const revenues = accounts.filter((a) => a.type === "revenue" && a.level === 3);
  const totalRevenue = revenues.reduce((s, a) => s + Math.abs(a.balance), 0);

  const expenses = accounts.filter((a) => a.type === "expense" && a.level === 3);
  const totalExpense = expenses.reduce((s, a) => s + Math.abs(a.balance), 0);
  const netIncome = totalRevenue - totalExpense;

  const currentAssets = accounts.filter((a) => a.parentId === 11 && a.level === 3);
  const fixedAssets = accounts.filter((a) => a.parentId === 12 && a.level === 3);
  const totalAssets = accounts.find((a) => a.code === "1")?.balance || 0;

  const liabilities = accounts.filter((a) => a.type === "liability" && a.level === 3);
  const totalLiabilities = accounts.find((a) => a.code === "2")?.balance || 0;

  const equities = accounts.filter((a) => a.type === "equity" && a.level === 2);
  const totalEquity = accounts.find((a) => a.code === "3")?.balance || 0;

  // ملخص علوي
  const kpiRow = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
    statTile({ label: "إجمالي إيرادات النشاط", value: currency(totalRevenue), tone: "success", icon: "check" }),
    statTile({ label: "إجمالي المصروفات التشغيلية", value: currency(totalExpense), tone: "warning", icon: "x" }),
    statTile({ label: "صافي الأرباح التشغيلية", value: currency(netIncome), tone: "brand", icon: "billing" }),
  );
  container.appendChild(kpiRow);

  // تبويبات العرض (قائمة الدخل / المركز المالي)
  const incomeCard = card({
    title: "قائمة الدخل الشامل (أرباح وخسائر)",
    subtitle: "عن السنة المالية المنتهية في أكتوبر 2026",
    body: el(
      "div",
      { class: "space-y-4 text-xs" },
      el("div", { class: "font-semibold text-ink text-sm border-b pb-1.5" }, "الإيرادات الطبية والتشغيلية"),
      el(
        "div",
        { class: "space-y-1.5" },
        ...revenues.map((r) =>
          el(
            "div",
            { class: "flex justify-between py-1 border-b border-line/60" },
            el("span", { class: "text-muted" }, r.name),
            el("span", { class: "font-mono font-semibold text-emerald-700" }, currency(r.balance)),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex justify-between py-2 font-bold text-ink bg-emerald-50/50 px-2 rounded-lg" },
        el("span", {}, "إجمالي الإيرادات"),
        el("span", { class: "font-mono" }, currency(totalRevenue)),
      ),
      el("div", { class: "font-semibold text-ink text-sm border-b pb-1.5 pt-2" }, "المصروفات وتكلفة الخدمات"),
      el(
        "div",
        { class: "space-y-1.5" },
        ...expenses.map((e) =>
          el(
            "div",
            { class: "flex justify-between py-1 border-b border-line/60" },
            el("span", { class: "text-muted" }, e.name),
            el("span", { class: "font-mono font-semibold text-rose-700" }, currency(e.balance)),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex justify-between py-2 font-bold text-ink bg-rose-50/50 px-2 rounded-lg" },
        el("span", {}, "إجمالي المصروفات"),
        el("span", { class: "font-mono" }, currency(totalExpense)),
      ),
      el(
        "div",
        { class: "flex justify-between p-3 font-bold text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-xl mt-3" },
        el("span", {}, "صافي ربح النشاط قبل الضرائب"),
        el("span", { class: "font-mono text-base" }, currency(netIncome)),
      ),
    ),
  });

  const balanceSheetCard = card({
    title: "قائمة المركز المالي (الميزانية العمومية)",
    subtitle: "كما في تاريخ اليوم",
    body: el(
      "div",
      { class: "space-y-4 text-xs" },
      el("div", { class: "font-semibold text-ink text-sm border-b pb-1.5" }, "الأصول المتداولة والثابتة"),
      el(
        "div",
        { class: "space-y-1.5" },
        ...currentAssets.concat(fixedAssets).map((a) =>
          el(
            "div",
            { class: "flex justify-between py-1 border-b border-line/60" },
            el("span", { class: "text-muted" }, a.name),
            el("span", { class: "font-mono font-semibold text-ink" }, currency(a.balance)),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex justify-between py-2 font-bold text-ink bg-brand-50/50 px-2 rounded-lg" },
        el("span", {}, "إجمالي الأصول"),
        el("span", { class: "font-mono" }, currency(totalAssets)),
      ),
      el("div", { class: "font-semibold text-ink text-sm border-b pb-1.5 pt-2" }, "الالتزامات وحقوق المساهمين"),
      el(
        "div",
        { class: "space-y-1.5" },
        ...liabilities.concat(equities).map((l) =>
          el(
            "div",
            { class: "flex justify-between py-1 border-b border-line/60" },
            el("span", { class: "text-muted" }, l.name),
            el("span", { class: "font-mono font-semibold text-ink" }, currency(l.balance)),
          ),
        ),
      ),
      el(
        "div",
        { class: "flex justify-between py-2 font-bold text-ink bg-amber-50/50 px-2 rounded-lg" },
        el("span", {}, "إجمالي الخصوم وحقوق الملكية"),
        el("span", { class: "font-mono" }, currency(totalLiabilities + totalEquity)),
      ),
    ),
  });

  const layout = el("div", { class: "grid grid-cols-1 lg:grid-cols-2 gap-4" }, incomeCard, balanceSheetCard);
  container.appendChild(layout);

  return container;
}
