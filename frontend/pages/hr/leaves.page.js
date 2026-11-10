/**
 * طلبات الإجازات.
 *
 * متابعة طلبات إجازات الموظفين، مراجعة الأرصدة، واعتماد أو رفض الطلبات.
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
  codeColumn,
  dateColumn,
  textColumn,
  statusColumn,
} from "../_shared/cells.js";
import {
  listLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  createLeaveRequest,
  getLeaveTypes,
} from "../../js/api/hr.api.js";
import { getEmployeesLookup } from "../../js/api/lookups.api.js";
import { openModal } from "../../components/common/modal.js";

export default async function leavesPage() {
  return listPage({
    title: "طلبات الإجازات",
    description: "إدارة طلبات الإجازات السنوية والمرضية والعارضة ومتابعة موافقات مديري الإدارات.",
    tableId: "hr-leaves",
    searchPlaceholder: "بحث باسم الموظف أو نوع الإجازة…",
    initialParams: { sort: "fromDate", order: "desc" },
    fetch: async (params) => listLeaveRequests(params),

    actions: () => [
      button({
        label: "+ تقديم طلب إجازة جديد",
        variant: "primary",
        icon: "check",
        onClick: () => openNewLeaveModal(),
      }),
      button({
        label: "أرصدة الإجازات",
        variant: "secondary",
        icon: "calendar",
        onClick: () => navigate("/hr/leave-balances"),
      }),
    ],

    columns: [
      codeColumn("employeeCode", "كود الموظف", { width: "10rem" }),
      textColumn("employeeName", "الموظف", { width: "16rem" }),
      {
        key: "typeLabel",
        label: "نوع الإجازة",
        width: "12rem",
        render: (row) => badge(row.typeLabel ?? "سنوية", { tone: "info" }),
      },
      dateColumn("fromDate", "من تاريخ"),
      dateColumn("toDate", "إلى تاريخ"),
      {
        key: "days",
        label: "عدد الأيام",
        width: "9rem",
        render: (row) => el("span", { style: "font-weight: 700; color: var(--primary);" }, `${row.days ?? 1} يوم`),
      },
      textColumn("reason", "السبب / الملاحظات", { width: "15rem", muted: true }),
      statusColumn(),
      {
        key: "actions",
        label: "الإجراءات",
        width: "12rem",
        render: (row) => {
          if (row.status === "pending" || row.status === "submitted") {
            const wrap = el("div", { style: "display: flex; gap: 0.5rem;" });
            wrap.appendChild(
              button({
                label: "موافقة",
                variant: "primary",
                size: "small",
                icon: "check",
                onClick: async () => {
                  try {
                    await approveLeaveRequest(row.id);
                    toast.success("تمت الموافقة على طلب الإجازة وخصمها من الرصيد.");
                    navigate("/hr/leaves");
                  } catch (err) {
                    toast.error(err.message ?? "تعذر قبول الطلب.");
                  }
                },
              })
            );
            wrap.appendChild(
              button({
                label: "رفض",
                variant: "danger",
                size: "small",
                onClick: async () => {
                  try {
                    await rejectLeaveRequest(row.id, { reason: "رفض من الإدارة" });
                    toast.info("تم رفض طلب الإجازة.");
                    navigate("/hr/leaves");
                  } catch (err) {
                    toast.error(err.message ?? "تعذر رفض الطلب.");
                  }
                },
              })
            );
            return wrap;
          }
          return el("span", { style: "color: var(--text-muted); font-size: 0.8125rem;" }, "مكتمل");
        },
      },
    ],

    stats: async () => {
      const res = await listLeaveRequests({ perPage: 200 });
      const rows = res.data ?? [];
      const pendingCount = rows.filter((r) => r.status === "pending" || r.status === "submitted").length;
      const approvedCount = rows.filter((r) => r.status === "approved").length;

      return [
        statTile({
          label: "إجمالي طلبات الإجازات",
          value: integer(rows.length),
          hint: "هذا العام",
        }),
        statTile({
          label: "الطلبات المعلقة للاعتماد",
          value: integer(pendingCount),
          hint: "تتطلب موافقة المدير",
          trend: pendingCount > 0 ? "neutral" : "positive",
        }),
        statTile({
          label: "الطلبات المعتمدة",
          value: integer(approvedCount),
          hint: "مخصومة من الأرصدة",
          trend: "positive",
        }),
      ];
    },
  });

  async function openNewLeaveModal() {
    const [employees, leaveTypes] = await Promise.all([
      getEmployeesLookup(),
      getLeaveTypes(),
    ]);

    const form = el("div", { style: "display: flex; flex-direction: column; gap: 1rem; padding: 0.5rem 0;" });

    const empSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    employees.forEach((e) => empSelect.appendChild(el("option", { value: e.id }, `${e.code} - ${e.name}`)));

    const typeSelect = el("select", {
      class: "form-select",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });
    leaveTypes.forEach((t) => typeSelect.appendChild(el("option", { value: t.id }, t.label)));

    const startDateInput = el("input", {
      type: "date",
      value: new Date().toISOString().split("T")[0],
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const endDateInput = el("input", {
      type: "date",
      value: new Date().toISOString().split("T")[0],
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    const reasonInput = el("input", {
      type: "text",
      placeholder: "سبب الإجازة…",
      class: "form-input",
      style: "width: 100%; padding: 0.5rem; border-radius: 0.375rem; border: 1px solid var(--border-color); background: var(--bg-surface);",
    });

    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "الموظف *"), empSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "نوع الإجازة *"), typeSelect));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "من تاريخ *"), startDateInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "إلى تاريخ *"), endDateInput));
    form.appendChild(el("div", null, el("label", { style: "display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 0.25rem;" }, "السبب"), reasonInput));

    const modal = openModal({
      title: "تقديم طلب إجازة",
      content: form,
      actions: [
        button({
          label: "إلغاء",
          variant: "ghost",
          onClick: () => modal.close(),
        }),
        button({
          label: "إرسال الطلب للاعتماد",
          variant: "primary",
          icon: "check",
          onClick: async () => {
            try {
              await createLeaveRequest({
                employeeId: empSelect.value,
                type: typeSelect.value,
                fromDate: startDateInput.value,
                toDate: endDateInput.value,
                reason: reasonInput.value || "إجازة",
              });
              toast.success("تم إرسال طلب الإجازة بنجاح وهو قيد الاعتماد.");
              modal.close();
              navigate("/hr/leaves");
            } catch (err) {
              toast.error(err.message ?? "تعذر تقديم الطلب.");
            }
          },
        }),
      ],
    });
  }
}
