/**
 * نقطة صرف الأدوية المباشرة (Pharmacy Dispensing POS)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button } from "../../components/common/button.js";
import { select, textField } from "../../components/forms/fields.js";
import { listPrescriptions, dispensePrescription } from "../../js/api/pharmacy.api.js";
import { currency } from "../../js/core/format.js";
import { toast } from "../../components/feedback/toast.js";

export default async function pharmacyDispensingPage() {
  const container = el("div", { class: "space-y-4 max-w-3xl" });

  let pendingRx = [];
  try {
    const res = await listPrescriptions({ status: "pending", perPage: 20 });
    pendingRx = res.data || [];
  } catch (e) {}

  const header = pageHeader({
    title: "نافذة صرف الأدوية الفوري",
    description: "فحص ومطابقة الوصفات الطبية وتسليم العلاج للمريض مع طباعة تعليمات الجرعات.",
  });
  container.appendChild(header);

  let selectedRxId = pendingRx[0]?.id ? String(pendingRx[0].id) : "";

  const posCard = card({
    title: "بيانات الصرف للمريض",
    body: el(
      "div",
      { class: "space-y-4" },
      pendingRx.length
        ? select({
            label: "اختر روشتة معلقة للصرف",
            value: selectedRxId,
            options: pendingRx.map((r) => ({
              value: String(r.id),
              label: `${r.prescriptionNumber} — ${r.patientName} (${currency(r.totalAmount)})`,
            })),
            onChange: (v) => (selectedRxId = v),
          })
        : el("div", { class: "py-6 text-center text-muted text-xs" }, "لا توجد روشتات معلقة في قائمة الانتظار حاليًا"),
      textField({
        label: "إرشادات الاستخدام الإضافية للصيدلي",
        placeholder: "مثال: يرجى شرب كميات وافرة من الماء وتجنب القيادة",
      }),
    ),
    footer: el(
      "div",
      { class: "flex justify-end gap-2" },
      button({
        label: "صرف وتسليم الدواء للمريض 💊",
        variant: "primary",
        icon: "check",
        onClick: async () => {
          if (!selectedRxId) {
            toast.warning("لا توجد روشتة محددة");
            return;
          }
          await dispensePrescription(selectedRxId);
          toast.success("تم صرف الأدوية بنجاح وخصمها من مخزون الصيدلية");
        },
      }),
    ),
  });

  container.appendChild(posCard);
  return container;
}
