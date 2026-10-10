/**
 * جدول وفهرس الصلاحيات الكامل (Permissions Catalog)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { badge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";

export default function permissionsListPage() {
  const container = el("div", { class: "space-y-4" });

  const header = pageHeader({
    title: "فهرس صلاحيات النظام الشامل",
    description: "مصفوفة مفاتيح الأذونات البرمجية وتوزيعها على الشاشات والوظائف الحساسة.",
  });
  container.appendChild(header);

  const modules = [
    { module: "المرضى", perms: [{ k: "patients.view", desc: "عرض قائمة وملفات المرضى" }, { k: "patients.create", desc: "إضافة ملف مريض جديد" }, { k: "patients.account.view", desc: "الاطلاع على الحسابات المالية للمريض" }] },
    { module: "الفواتير", perms: [{ k: "billing.view", desc: "استعراض الفواتير والمدفوعات" }, { k: "billing.invoice.create", desc: "إصدار فاتورة طبية جديدة" }, { k: "billing.refund.create", desc: "إصدار استرداد مالي (مرتجع)" }, { k: "billing.discount.approve", desc: "اعتماد خصومات وتخفيضات" }] },
    { module: "المحاسبة", perms: [{ k: "accounting.view", desc: "عرض شجرة الحسابات واليومية العامة" }, { k: "accounting.period.close", desc: "إغلاق وترحيل الفترات المالية" }] },
    { module: "المخازن", perms: [{ k: "inventory.view", desc: "عرض الأصناف وأرصدة المستودعات" }, { k: "inventory.movement.create", desc: "إصدار أذون صرف وتحويل مخزني" }] },
    { module: "الصيدلية والمختبر", perms: [{ k: "pharmacy.dispense", desc: "صرف الروشتات الطبية" }, { k: "laboratory.sample.collect", desc: "سحب العينات وإدخال النتائج" }] },
    { module: "الإدارة والنظام", perms: [{ k: "roles.manage", desc: "تعديل صلاحيات وأدوار المستخدمين" }, { k: "audit.view", desc: "الاطلاع على سجل التدقيق الأمني" }] },
  ];

  const grid = el(
    "div",
    { class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
    ...modules.map((m) =>
      card({
        title: m.module,
        flush: true,
        body: el(
          "table",
          { class: "w-full text-right text-xs border-collapse" },
          el(
            "thead",
            { class: "bg-subtle text-muted border-b border-line" },
            el("tr", {}, el("th", { class: "p-2.5" }, "مفتاح الصلاحية"), el("th", { class: "p-2.5" }, "الوصف والوظيفة")),
          ),
          el(
            "tbody",
            {},
            ...m.perms.map((p) =>
              el(
                "tr",
                { class: "border-b border-line" },
                el("td", { class: "p-2.5 font-mono text-brand-700 font-medium" }, ref(p.k)),
                el("td", { class: "p-2.5 text-muted" }, p.desc),
              ),
            ),
          ),
        ),
      }),
    ),
  );

  container.appendChild(grid);
  return container;
}
