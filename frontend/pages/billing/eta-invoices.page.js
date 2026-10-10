/**
 * منظومة الفاتورة الإلكترونية والإيصال الإلكتروني (ETA E-Invoicing)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card, statTile } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { badge, statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { currency } from "../../js/core/format.js";
import { toast } from "../../components/feedback/toast.js";

export default function etaInvoicesPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "منظومة الفاتورة الإلكترونية المصرية (ETA)",
    description: "الربط مع مصلحة الضرائب المصرية، التوقيع الإلكتروني، وإرسال الفواتير والإيصالات اللحظية.",
    actions: [
      button({
        label: "إرسال الدفعة المعلقة للضرائب",
        variant: "primary",
        icon: "refresh",
        onClick: () => toast.success("تم إرسال كافة الفواتير المعلقة وتوقيعها إلكترونيًا بنجاح (Valid)"),
      }),
    ],
  });
  container.appendChild(header);

  const kpis = el(
    "div",
    { class: "grid grid-cols-2 md:grid-cols-4 gap-3" },
    statTile({ label: "فواتير مرسلة ومعتمدة", value: "1,248", tone: "success", icon: "check" }),
    statTile({ label: "قيد المراجعة في البوابة", value: "12", tone: "warning", icon: "refresh" }),
    statTile({ label: "مرفوضة / بحاجة لتعديل", value: "0", tone: "neutral", icon: "x" }),
    statTile({ label: "حالة اتصال الـ ERP مع ETA", value: "متصل ولحظي", tone: "brand", icon: "shield" }),
  );
  container.appendChild(kpis);

  const mockEtaRows = [
    { uuid: "c18f2940-e1b2-4d29-a5e2-9b248911001", internalId: "INV-2026-00101", date: "2026-10-06 09:30", total: 1450, tax: 203, status: "Valid" },
    { uuid: "d991b34a-91f4-411a-82bc-81203488219", internalId: "INV-2026-00102", date: "2026-10-06 08:45", total: 850, tax: 0, status: "Valid" },
    { uuid: "ea2018cc-1110-4820-a021-99201928341", internalId: "INV-2026-00103", date: "2026-10-05 16:15", total: 3200, tax: 448, status: "Valid" },
    { uuid: "ff82910a-3381-4991-8812-77192834102", internalId: "INV-2026-00104", date: "2026-10-05 14:00", total: 600, tax: 0, status: "Valid" },
  ];

  const etaCard = card({
    title: "آخر المستندات المرسلة لمصلحة الضرائب",
    flush: true,
    body: el(
      "table",
      { class: "w-full text-right text-xs border-collapse" },
      el(
        "thead",
        { class: "bg-subtle text-muted border-b border-line" },
        el(
          "tr",
          {},
          el("th", { class: "p-3" }, "الرقم الداخلي"),
          el("th", { class: "p-3" }, "المعرف الضريبي الموحد (UUID)"),
          el("th", { class: "p-3" }, "وقت الإرسال"),
          el("th", { class: "p-3 text-end" }, "قيمة الفاتورة"),
          el("th", { class: "p-3 text-end" }, "ضريبة القيمة المضافة"),
          el("th", { class: "p-3 text-center" }, "حالة البوابة"),
        ),
      ),
      el(
        "tbody",
        {},
        ...mockEtaRows.map((r) =>
          el(
            "tr",
            { class: "border-b border-line hover:bg-subtle" },
            el("td", { class: "p-3 font-mono font-bold text-brand-600" }, ref(r.internalId)),
            el("td", { class: "p-3 font-mono text-[11px] text-muted truncate max-w-xs" }, ref(r.uuid)),
            el("td", { class: "p-3 text-muted" }, r.date),
            el("td", { class: "p-3 font-mono text-end font-semibold tabular" }, currency(r.total)),
            el("td", { class: "p-3 font-mono text-end text-muted tabular" }, currency(r.tax)),
            el("td", { class: "p-3 text-center" }, badge("معتمدة (Valid)", { tone: "success", size: "sm" })),
          ),
        ),
      ),
    ),
  });

  container.appendChild(etaCard);
  return container;
}
