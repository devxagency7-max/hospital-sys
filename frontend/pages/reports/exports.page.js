/**
 * مركز التصدير الموحد.
 *
 * تصدير البيانات المحاسبية وسجلات النظام إلى ملفات CSV متوافقة مع Excel
 * ومعاينات طباعة A4 رسمية بضغطة زر واحدة.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { exportCsv, printReport } from "../_shared/print.js";
import { listJournalEntries, listAccounts } from "../../js/api/accounting.api.js";
import { listCustomerInvoices, listSupplierInvoices, listAssets } from "../../js/api/finance.api.js";
import { listEmployees } from "../../js/api/hr.api.js";
import { listBalances } from "../../js/api/inventory.api.js";
import { getCompanyInfo } from "../../js/api/settings.api.js";
import { amount } from "../../js/core/format.js";

const EXPORT_DATASETS = [
  {
    id: "journal",
    title: "دفتر اليومية العامة",
    desc: "كافة القيود المحاسبية المرحلة والآلية مع تفاصيل المدين والدائن والتاريخ.",
    icon: "accounting",
    load: async () => {
      const res = await listJournalEntries({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "دفتر اليومية العامة",
        headers: ["رقم القيد", "التاريخ", "البيان", "المرجع", "إجمالي القيد", "الحالة"],
        rows: rows.map((r) => [r.entryNumber, r.date, r.description, r.reference ?? "—", amount(r.totalDebit ?? 0), r.status]),
      };
    },
  },
  {
    id: "customer_invoices",
    title: "فواتير العملاء (المبيعات)",
    desc: "سجل فواتير البيع الصادرة شاملة الضرائب والمبالغ المسددة والمتبقية.",
    icon: "billing",
    load: async () => {
      const res = await listCustomerInvoices({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "فواتير العملاء",
        headers: ["رقم الفاتورة", "التاريخ", "العميل", "الإجمالي", "الضريبة", "المتبقي", "الحالة"],
        rows: rows.map((r) => [r.invoiceNumber ?? r.number, r.date, r.customerName, amount(r.total), amount(r.taxAmount ?? 0), amount(r.remaining), r.status]),
      };
    },
  },
  {
    id: "supplier_invoices",
    title: "فواتير الموردين (المشتريات)",
    desc: "سجل فواتير المشتريات ومواعيد الاستحقاق وأرصدة الموردين المستحقة.",
    icon: "billing",
    load: async () => {
      const res = await listSupplierInvoices({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "فواتير الموردين",
        headers: ["رقم الفاتورة", "فاتورة المورد", "التاريخ", "المورد", "الإجمالي", "المتبقي", "الحالة"],
        rows: rows.map((r) => [r.invoiceNumber ?? r.number, r.supplierInvoiceNumber ?? "—", r.date, r.supplierName, amount(r.total), amount(r.remaining), r.status]),
      };
    },
  },
  {
    id: "employees",
    title: "سجل الموظفين والرواتب",
    desc: "بيانات العاملين، الإدارات، الوظائف، والرواتب الأساسية وتواريخ التعيين.",
    icon: "users",
    load: async () => {
      const res = await listEmployees({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "سجل الموظفين",
        headers: ["كود الموظف", "الاسم", "الإدارة", "المسمى الوظيفي", "الراتب الأساسي", "الحالة"],
        rows: rows.map((r) => [r.code, r.name, r.departmentName ?? "—", r.jobTitle ?? "—", amount(r.basicSalary ?? 0), r.status]),
      };
    },
  },
  {
    id: "inventory_balances",
    title: "أرصدة المخزون السلعي",
    desc: "كشف كميات وقيم المخزون المتاحة بكافة المخازن وحدود إعادة الطلب.",
    icon: "inventory",
    load: async () => {
      const res = await listBalances({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "أرصدة المخزون",
        headers: ["كود الصنف", "اسم الصنف", "المخزن", "الرصيد المتاح", "الوحدة", "القيمة الإجمالية"],
        rows: rows.map((r) => [r.itemCode ?? r.code, r.itemName ?? r.name, r.warehouseName ?? "—", String(r.quantity ?? r.balance ?? 0), r.unit ?? "قطعة", amount(r.totalValue ?? 0)]),
      };
    },
  },
  {
    id: "fixed_assets",
    title: "سجل الأصول الثابتة",
    desc: "بيان الأصول الثابتة، تكلفة الشراء، مجمع الإهلاك، وصافي القيمة الدفترية.",
    icon: "reports",
    load: async () => {
      const res = await listAssets({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "سجل الأصول الثابتة",
        headers: ["كود الأصل", "اسم الأصل", "التصنيف", "تاريخ الشراء", "التكلفة", "مجمع الإهلاك", "القيمة الدفترية"],
        rows: rows.map((r) => [r.code, r.name, r.categoryName ?? "—", r.purchaseDate ?? "—", amount(r.purchaseCost ?? 0), amount(r.accumulatedDepreciation ?? 0), amount(r.bookValue ?? 0)]),
      };
    },
  },
  {
    id: "accounts",
    title: "دليل الحسابات المعتمد",
    desc: "شجرة الحسابات المالية بكافة المستويات الحسابية وطبيعة الحسابات.",
    icon: "inventory",
    load: async () => {
      const res = await listAccounts({ perPage: 500 });
      const rows = res.data ?? [];
      return {
        title: "دليل الحسابات",
        headers: ["كود الحساب", "اسم الحساب", "النوع", "الطبيعة", "المستوى", "قابل للترحيل"],
        rows: rows.map((r) => [r.code, r.name, r.type, r.nature, String(r.level ?? 1), r.isPostable ? "نعم" : "حساب رئيسي"]),
      };
    },
  },
];

export default async function exportsHubPage() {
  const company = await getCompanyInfo().catch(() => ({ name: "الشركة النموذجية للتجارة والتوزيع" }));

  const container = el("div", { class: "page-container page-exports-hub", dir: "rtl" });

  const header = el(
    "header",
    {
      class: "page-header",
      style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;",
    },
    el(
      "div",
      null,
      el("h1", { class: "page-title", style: "font-size: 1.625rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;" }, "مركز التصدير الموحد"),
      el("p", { class: "page-description", style: "color: var(--text-secondary); font-size: 0.9375rem;" }, "تصدير مجموعات البيانات الرئيسية إلى ملفات Excel/CSV ومعاينات الطباعة الرسمية.")
    ),
    el(
      "div",
      { style: "display: flex; gap: 0.75rem;" },
      button({
        label: "مركز التقارير",
        variant: "secondary",
        icon: "reports",
        onClick: () => navigate("/reports"),
      }),
      button({
        label: "لوحة التحكم",
        variant: "ghost",
        icon: "dashboard",
        onClick: () => navigate("/"),
      })
    )
  );

  const grid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;",
  });

  EXPORT_DATASETS.forEach((ds) => {
    const card = el(
      "div",
      {
        class: "surface-card",
        style: "background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0.5rem; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;",
      },
      el(
        "div",
        null,
        el(
          "div",
          { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;" },
          el("h3", { style: "font-size: 1.0625rem; font-weight: 700; margin: 0;" }, ds.title),
          badge("CSV + A4", { variant: "info" })
        ),
        el("p", { style: "font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;" }, ds.desc)
      ),
      el(
        "div",
        { style: "display: flex; gap: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;" },
        button({
          label: "تنزيل CSV",
          variant: "secondary",
          size: "small",
          icon: "download",
          onClick: async () => {
            try {
              toast.info("جاري تجهيز وتصدير البيانات…");
              const data = await ds.load();
              exportCsv({
                title: data.title,
                headers: data.headers.map((h) => ({ label: h })),
                rows: data.rows,
              });
            } catch (err) {
              toast.error(err.message ?? "تعذر التصدير.");
            }
          },
        }),
        button({
          label: "معاينة الطباعة",
          variant: "ghost",
          size: "small",
          icon: "print",
          onClick: async () => {
            try {
              const data = await ds.load();
              printReport({
                company,
                title: data.title,
                period: "2026",
                headers: data.headers.map((h) => ({ label: h, align: "right" })),
                rows: data.rows,
              });
            } catch (err) {
              toast.error(err.message ?? "تعذر فتح معاينة الطباعة.");
            }
          },
        })
      )
    );
    grid.appendChild(card);
  });

  container.appendChild(header);
  container.appendChild(grid);

  return container;
}
