/**
 * إدارة مستخدمي النظام (Users Management)
 */

import { el } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { dataTable } from "../../components/tables/data-table.js";
import { button } from "../../components/common/button.js";
import { statusBadge } from "../../components/common/badge.js";
import { ref } from "../../components/common/value.js";
import { listUsers, createUser } from "../../js/api/admin.api.js";
import { openModal } from "../../components/modals/overlay.js";
import { textField, select } from "../../components/forms/fields.js";
import { toast } from "../../components/feedback/toast.js";

export default function usersListPage() {
  const container = el("div", { class: "space-y-4" });

  let tableInstance = null;

  const header = pageHeader({
    title: "إدارة المستخدمين وحسابات الموظفين",
    description: "إدارة حسابات الأطباء، موظفي الاستقبال، المحاسبين، والصيادلة في النظام.",
    actions: [
      button({
        label: "إضافة مستخدم جديد",
        variant: "primary",
        icon: "plus",
        onClick: () => showAddUserModal(() => tableInstance?.reload()),
      }),
    ],
  });
  container.appendChild(header);

  tableInstance = dataTable({
    id: "system-users-table",
    fetch: listUsers,
    searchPlaceholder: "بحث باسم المستخدم أو البريد أو الهاتف أو الدور…",
    columns: [
      {
        key: "name",
        label: "اسم الموظف / المستخدم",
        render: (row) => el("span", { class: "font-semibold text-ink" }, row.name),
      },
      {
        key: "username",
        label: "اسم الدخول",
        render: (row) => ref(row.username, { class: "font-mono text-muted text-xs" }),
      },
      {
        key: "roleName",
        label: "الدور الوظيفي",
        render: (row) => el("span", { class: "font-medium text-brand-700" }, row.roleName),
      },
      {
        key: "department",
        label: "القسم",
        render: (row) => el("span", { class: "text-muted text-xs" }, row.department),
      },
      {
        key: "phone",
        label: "الهاتف",
        render: (row) => ref(row.phone, { class: "font-mono text-xs text-muted" }),
      },
      {
        key: "lastLogin",
        label: "آخر تسجيل دخول",
        render: (row) => el("span", { class: "text-muted text-xs font-mono" }, row.lastLogin || "—"),
      },
      {
        key: "status",
        label: "الحالة",
        render: (row) => statusBadge("active"),
      },
    ],
  });

  container.appendChild(tableInstance.element);
  return container;
}

function showAddUserModal(onSaved) {
  let name = "";
  let username = "";
  let email = "";
  let phone = "";
  let role = "receptionist";
  let roleName = "موظف استقبال";
  let dept = "الاستقبال وشؤون المرضى";

  openModal({
    title: "إضافة مستخدم جديد للنظام",
    size: "md",
    body: (close) =>
      el(
        "div",
        { class: "space-y-3 p-1" },
        textField({
          label: "الاسم الرباعي",
          required: true,
          placeholder: "مثال: هاني عادل إبراهيم",
          onInput: (v) => (name = v),
        }),
        el(
          "div",
          { class: "grid grid-cols-2 gap-3" },
          textField({
            label: "اسم الدخول (Username)",
            required: true,
            placeholder: "hani.adel",
            onInput: (v) => (username = v),
          }),
          textField({
            label: "رقم الهاتف",
            placeholder: "010xxxxxxxx",
            onInput: (v) => (phone = v),
          }),
        ),
        textField({
          label: "البريد الإلكتروني",
          type: "email",
          placeholder: "hani@hospital.local",
          onInput: (v) => (email = v),
        }),
        select({
          label: "الدور والصلاحيات",
          value: role,
          options: [
            { value: "receptionist", label: "موظف استقبال وتسكين" },
            { value: "accountant", label: "محاسب مالي" },
            { value: "pharmacist", label: "صيدلي" },
            { value: "doctor", label: "طبيب استشاري / أخصائي" },
            { value: "lab_technician", label: "فني مختبر" },
          ],
          onChange: (val) => {
            role = val;
            const labels = {
              receptionist: "موظف استقبال",
              accountant: "محاسب مالي",
              pharmacist: "صيدلي",
              doctor: "طبيب استشاري",
              lab_technician: "فني مختبر",
            };
            roleName = labels[val] || val;
          },
        }),
      ),
    footer: (close) => [
      button({ label: "إلغاء", variant: "subtle", onClick: () => close() }),
      button({
        label: "إنشاء الحساب",
        variant: "primary",
        onClick: async () => {
          if (!name.trim() || !username.trim()) {
            toast.warning("يرجى إدخال الاسم واسم الدخول");
            return;
          }
          await createUser({ name, username, email, phone, role, roleName, department: dept });
          toast.success("تم إنشاء حساب المستخدم بنجاح");
          close();
          onSaved();
        },
      }),
    ],
  });
}
