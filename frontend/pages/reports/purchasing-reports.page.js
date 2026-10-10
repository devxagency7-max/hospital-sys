/**
 * تقارير المشتريات والإنفاق مع الموردين (Purchasing Reports)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { currency } from "../../js/core/format.js";
import { listPurchaseOrders, listSupplierInvoices } from "../../js/api/purchasing.api.js";

export default async function purchasingReportsPage() {
  const container = el("div", { class: "space-y-4" });

  let orders = [];
  let invoices = [];
  try {
    const [ordRes, invRes] = await Promise.all([
      listPurchaseOrders({ perPage: 100 }),
      listSupplierInvoices({ perPage: 100 }),
    ]);
    orders = ordRes.data || [];
    invoices = invRes.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "تقرير المشتريات والإنفاق السنوي",
    description: "إجمالي أوامر الشراء المنفذة، فواتير التوريدات، وحجم التعامل مع الشركات الموردة.",
    actions: [
      button({
        label: "طباعة التقرير",
        variant: "primary",
        icon: "download",
        onClick: () => window.print(),
      }),
    ],
  });
  container.appendChild(header);

  const totalPO = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);

  const kpis = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-3 gap-3" },
    statTile({ label: "إجمالي أوامر الشراء الصادرة", value: currency(totalPO), tone: "brand" }),
    statTile({ label: "إجمالي فواتير الموردين", value: currency(totalInvoiced), tone: "info" }),
    statTile({ label: "المسدد للشركات الموردة", value: currency(totalPaid), tone: "success" }),
  );
  container.appendChild(kpis);

  const poCard = card({
    title: "أحدث أوامر الشراء المعتمدة",
    flush: true,
    body: el(
      "table",
      { class: "w-full text-right text-xs border-collapse" },
      el(
        "thead",
        { class: "bg-subtle text-muted border-b border-line" },
        el("tr", {}, el("th", { class: "p-2.5" }, "رقم الأمر"), el("th", { class: "p-2.5" }, "المورد"), el("th", { class: "p-2.5 text-end" }, "الإجمالي"), el("th", { class: "p-2.5 text-center" }, "الحالة")),
      ),
      el(
        "tbody",
        {},
        ...orders.slice(0, 5).map((o) =>
          el(
            "tr",
            { class: "border-b border-line" },
            el("td", { class: "p-2.5 font-mono font-bold text-brand-600" }, o.orderNumber),
            el("td", { class: "p-2.5 font-semibold text-ink" }, o.supplierName),
            el("td", { class: "p-2.5 font-mono text-end font-bold tabular" }, currency(o.totalAmount)),
            el("td", { class: "p-2.5 text-center text-muted" }, o.status),
          ),
        ),
      ),
    ),
  });
  container.appendChild(poCard);

  return container;
}
