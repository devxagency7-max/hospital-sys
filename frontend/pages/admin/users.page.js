/**
 * إدارة مستخدمي النظام.
 *
 * إدارة حسابات المستخدمين، تعيين الأدوار والصلاحيات، ومتابعة آخر تسجيل دخول.
 */

import { el } from "../../js/core/dom.js";
import { button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { integer } from "../../js/core/format.js";
import { toast } from "../../components/common/toast.js";
import { navigate } from "../../js/core/router.js";
import { listPage } from "../_shared/list-page.js";
import {
  nameColumn,
  textColumn,
  statusColumn,
} from "../_shared/cells.js";
import { listUsers, createUser, listRoles } from "../../js/api/admin.api.js";
import { openModal } from "../../components/common/modal.js";

export default async function usersPage() {
  return listPage({
    title: "المستخدمون",
    description: "إدارة حسابات مستخدمي النظام، الأدوار الممنوحة، وسجلات النشاط وحالة الحساب.",
    tableId: "admin-users",
    searchPlaceholder: "بحث باسم المستخدم أو البريد الإلكتروني…",
    initialParams: { sort: "name", order: "asc" },
    fetch: async (params) => listUsers(params),

    actions: () => [
      button({
        label: "+ مستخدم جديد",
        variant: "primary",
        icon: "check",
        onClick: () => openNewUserModal(),
      }),
      button({
        label: "الأدوار والصلاحيات",
        variant: "secondary",
        icon: "shield",
        onClick: () => navigate("/admin/roles"),
      }),
      button({
        label: "سجل التدقيق",
        variant: "ghost",
        icon: "audit",
        onClick: () => navigate("/admin/audit"),
      }),
    ],

    columns: [
      nameColumn("name", "nameEn", "اسم المستخدم", { width: "16rem" }),
      {
        key: "email",
        header: "البريد الإلكتروني",
        width: "18rem",
        render: (row) => el("span", { class: "ltr-isolate", style: "font-family: monospace;" }, row.email),
      },
      {
        key: "role",
        header: "الدور الوظيفي",
        width: "14rem",
        render: (row) => badge(row.roleName ?? row.role ?? "مستخدم", { variant: "info" }),
      },
      {
        key: "lastLoginAt",
        header: "آخر تسجيل دخول",
        width: "13rem",
        render: (row) => el("span", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, row.lastLoginAt ? row.lastLoginAt.slice(0, 16).replace("T", " ") : "لم يسجل دخول"),
      },
      statusColumn(),
    ],

    stats: async () => {
      const res = await listUsers();
      const rows = res.data ?? [];
      const activeCount = rows.filter((r) => r.status === "active").length;

      return [
        statTile({
          label: "إجمالي حسابات المستخدمين",
          value: integer(rows.length),
          hint: "مستخدمين مسجلين",
        }),
        statTile({
          label: "المستخدمون النشطون",
          value: integer(activeCount),
          hint: "حسابات فعالة",
          trend: "positive",
        }),
        statTile({
          label: "الحسابات المعطلة",
          value: integer(rows.length - activeCount),
          hint: "موقوفة مؤقتاً",
        }),
      ];
    },
  });

  async function openNewUserModal() {
    const rolesRes = await listRoles();
    const roles = rolesRes.data ?? [];

    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    const nameInput = el("input", {
      type: "text",
      placeholder: "الاسم الكامل للمستخدم",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const emailInput = el("input", {
      type: "email",
      placeholder: "username@company.com",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface); text-align: left;",
    });

    const roleSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    roles.forEach((r) => roleSelect.appendChild(el("option", { value: r.key ?? r.id }, r.name ?? r.title)));

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "اسم المستخدم *"), nameInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "البريد الإلكتروني *"), emailInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الدور والصلاحيات *"), roleSelect));

    const modal = openModal({
      title: "إضافة مستخدم جديد",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "إنشاء الحساب",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            if (!nameInput.value.trim() || !emailInput.value.trim()) {
              toast.warning("يرجى ملء الاسم والبريد الإلكتروني.");
              return;
            }
            try {
              await createUser({
                name: nameInput.value.trim(),
                email: emailInput.value.trim(),
                role: roleSelect.value,
                roleName: roleSelect.options[roleSelect.selectedIndex]?.text,
                status: "active",
              });
              toast.success("تم إنشاء حساب المستخدم بنجاح.");
              modal.close();
              navigate("/admin/users");
            } catch (err) {
              toast.error(err.message ?? "تعذر إنشاء الحساب.");
            }
          },
        }),
      ],
    });
  }
}
