/**
 * الخزائن النقدية — الأرصدة والحركات والتحويلات.
 *
 * رصيد الخزينة يُطابق حساب النقدية في الميزان (شاشة المطابقة). إيصال القبض
 * والصرف والتحويل كلها تُرحَّل محاسبيًا لحظة تسجيلها، والتحويل بين وعاءين
 * لا يُنتج إيرادًا ولا مصروفًا.
 */

import { el, cx } from "../../js/core/dom.js";
import { buttonGroup, iconButton, button } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { statTile } from "../../components/common/card.js";
import { alert } from "../../components/feedback/alert.js";
import { textField } from "../../components/forms/fields.js";
import { amount, integer, date as formatDate } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import * as money from "../../js/core/money.js";
import { listPage } from "../_shared/list-page.js";
import { moneyColumn, nameColumn, textColumn, countColumn, dateColumn, statusColumn, progressCell } from "../_shared/cells.js";
import { formModal, selectField, moneyField, dateFieldWithLabel, value } from "../_shared/forms.js";
import { listCashBoxes, createCashVoucher, createTransfer } from "../../js/api/finance.api.js";
import { getAccounts, getCostCenters, getBankAccounts, toAccountOptions, toOptions, invalidateLookups } from "../../js/api/lookups.api.js";

const TODAY = new Date().toISOString().slice(0, 10);

export default async function cashBoxesPage() {
  const [accounts, costCenters, banks] = await Promise.all([
    getAccounts(),
    getCostCenters(),
    getBankAccounts(),
  ]);

  return listPage({
    title: "الخزائن النقدية",
    description: "أرصدة الخزائن وحدودها وحركاتها. كل حركة تُرحَّل محاسبيًا لحظة تسجيلها.",
    tableId: "fin-cash-boxes",
    searchPlaceholder: "بحث باسم الخزينة أو أمينها…",
    fetch: listCashBoxes,

    actions: (context) => [
      button({
        label: "إيصال قبض",
        variant: "secondary",
        icon: "arrowDown",
        permission: "fin.cashbox.transact",
        onClick: () => openVoucherModal({ direction: "in", context, accounts, costCenters }),
      }),
      button({
        label: "إيصال صرف",
        variant: "secondary",
        icon: "arrowUp",
        permission: "fin.cashbox.transact",
        onClick: () => openVoucherModal({ direction: "out", context, accounts, costCenters }),
      }),
      button({
        label: "تحويل",
        variant: "primary",
        icon: "refresh",
        permission: "fin.cashbox.transact",
        onClick: () => openTransferModal({ context, banks }),
      }),
    ],

    before: async () => {
      /* تنبيه تجاوز الحد — خطر أمني حقيقي لا مجرد مؤشر. */
      const { data } = await listCashBoxes({ perPage: 100 });
      const over = data.filter((row) => row.overLimit);
      if (!over.length) return null;

      return alert({
        tone: "warning",
        title: `${integer(over.length)} خزينة تجاوزت حدها المسموح`,
        message:
          over.map((row) => `${row.name}: ${amount(row.balance)} من حد ${amount(row.maxLimit)}`).join(" · ") +
          " — وردّ الفائض إلى البنك.",
      });
    },

    columns: [
      nameColumn("name", "code", "الخزينة", { width: "14rem" }),
      textColumn("custodian", "الأمين", { width: "14rem", muted: true }),
      textColumn("location", "الموقع", { width: "14rem", muted: true, hidden: true }),
      moneyColumn("openingBalance", "افتتاحي", { hidden: true }),
      moneyColumn("inflow", "وارد", { hidden: true }),
      moneyColumn("outflow", "صادر", { hidden: true }),
      moneyColumn("balance", "الرصيد الحالي"),
      {
        key: "maxLimit",
        label: "من الحد الأقصى",
        width: "10rem",
        render: (row) => {
          if (!row.maxLimit) return el("span", { class: "text-faint text-xs" }, "بلا حد");
          return el(
            "div",
            { class: "flex items-center gap-2" },
            progressCell(row.balance / row.maxLimit, { tone: row.overLimit ? "danger" : "success" }),
            row.overLimit ? badge("تجاوز", { tone: "danger", size: "sm" }) : null,
          );
        },
      },
      countColumn("movementsCount", "الحركات"),
      dateColumn("lastReconciledAt", "آخر جرد"),
      statusColumn(),
    ],

    onRowClick: (row) => navigate(`/fin/cash-boxes/${row.id}`),

    rowActions: (row) =>
      buttonGroup(
        iconButton("eye", { label: "كشف الخزينة", onClick: () => navigate(`/fin/cash-boxes/${row.id}`) }),
      ),

    stats: async () => {
      const { data } = await listCashBoxes({ perPage: 100 });
      const active = data.filter((row) => row.status === "active");

      return [
        statTile({ label: "إجمالي النقدية", value: amount(money.sumBy(data, "balance")), tone: "brand", icon: "wallet" }),
        statTile({ label: "خزائن نشطة", value: integer(active.length), tone: "neutral", icon: "building" }),
        statTile({ label: "إجمالي الوارد", value: amount(money.sumBy(data, "inflow")), tone: "success", icon: "arrowDown" }),
        statTile({ label: "إجمالي الصادر", value: amount(money.sumBy(data, "outflow")), tone: "warning", icon: "arrowUp" }),
        statTile({
          label: "تجاوز الحد",
          value: integer(data.filter((row) => row.overLimit).length),
          tone: data.some((row) => row.overLimit) ? "danger" : "success",
          icon: "alertTriangle",
        }),
      ];
    },
  });
}

/* ========================================================================== */

async function openVoucherModal({ direction, context, accounts, costCenters }) {
  const { data: boxes } = await listCashBoxes({ perPage: 100 });
  const active = boxes.filter((row) => row.status === "active");

  const form = {
    cashBoxId: String(active[0]?.id ?? ""),
    amount: 0,
    counterAccountId: "",
    costCenterId: "",
    description: "",
    reference: "",
    date: TODAY,
    direction,
  };

  const isIn = direction === "in";

  formModal({
    title: isIn ? "إيصال قبض نقدي" : "إيصال صرف نقدي",
    subtitle: isIn ? "مبلغ يدخل الخزينة مقابل حساب إيراد أو حساب آخر" : "مبلغ يخرج من الخزينة مقابل حساب مصروف أو حساب آخر",
    size: "lg",
    submitLabel: isIn ? "تسجيل القبض" : "تسجيل الصرف",
    success: isIn ? "سُجّل إيصال القبض ورُحِّل محاسبيًا." : "سُجّل إيصال الصرف ورُحِّل محاسبيًا.",
    fieldLabels: { amount: "المبلغ", counterAccountId: "الحساب المقابل", description: "البيان" },

    validate: () => {
      const errors = {};
      if (!(form.amount > 0)) errors.amount = "المبلغ يجب أن يكون أكبر من صفر.";
      if (!form.counterAccountId) errors.counterAccountId = "الحساب المقابل مطلوب — هو ما يُحدد طبيعة الحركة.";
      if (!form.description.trim()) errors.description = "البيان مطلوب.";
      return errors;
    },

    body: () =>
      el(
        "div",
        { class: "grid gap-3.5 sm:grid-cols-2" },
        selectField({
          label: "الخزينة",
          required: true,
          value: form.cashBoxId,
          options: active.map((row) => ({ value: row.id, label: `${row.name} — رصيد ${amount(row.balance)}` })),
          onChange: value((v) => (form.cashBoxId = v)),
        }),
        dateFieldWithLabel({ label: "التاريخ", required: true, value: form.date, onChange: value((v) => (form.date = v)) }),
        moneyField({ label: "المبلغ", required: true, onInput: value((v) => (form.amount = Number(v) || 0)) }),
        selectField({
          label: "الحساب المقابل",
          required: true,
          placeholder: "اختر الحساب…",
          hint: isIn ? "حساب الإيراد أو المدين الذي جاء منه المبلغ." : "حساب المصروف أو الدائن الذي صُرف له المبلغ.",
          options: toAccountOptions(accounts),
          onChange: value((v) => (form.counterAccountId = v)),
        }),
        selectField({
          label: "مركز التكلفة",
          placeholder: "بلا مركز",
          options: toOptions(costCenters),
          onChange: value((v) => (form.costCenterId = v)),
        }),
        textField({ label: "المرجع", placeholder: "رقم مستند خارجي", onInput: value((v) => (form.reference = v)) }),
        textField({ label: "البيان", required: true, span: "full", onInput: value((v) => (form.description = v)) }),
      ),

    onSubmit: () =>
      createCashVoucher({
        ...form,
        cashBoxId: Number(form.cashBoxId),
        counterAccountId: Number(form.counterAccountId),
        costCenterId: form.costCenterId ? Number(form.costCenterId) : null,
        description: form.description.trim(),
      }),

    onDone: () => context.reload(),
  });
}

async function openTransferModal({ context, banks }) {
  const { data: boxes } = await listCashBoxes({ perPage: 100 });
  const active = boxes.filter((row) => row.status === "active");

  const form = {
    fromType: "cash",
    fromId: String(active[0]?.id ?? ""),
    toType: "bank",
    toId: String(banks[0]?.id ?? ""),
    amount: 0,
    date: TODAY,
  };

  const nodeOptions = (type) =>
    type === "cash"
      ? active.map((row) => ({ value: row.id, label: `${row.name} — ${amount(row.balance)}` }))
      : banks.map((row) => ({ value: row.id, label: `${row.bankName} — ${row.accountNumber}` }));

  formModal({
    title: "تحويل بين الخزائن والبنوك",
    subtitle: "نقل نقدية بين وعاءين — لا إيراد ولا مصروف",
    size: "lg",
    submitLabel: "تنفيذ التحويل",
    success: "نُفِّذ التحويل ورُحِّل محاسبيًا.",
    fieldLabels: { amount: "المبلغ", toId: "الجهة المستقبلة" },

    validate: () => {
      const errors = {};
      if (!(form.amount > 0)) errors.amount = "المبلغ يجب أن يكون أكبر من صفر.";
      if (form.fromType === form.toType && form.fromId === form.toId) {
        errors.toId = "لا يُحوَّل مبلغ من حساب إلى نفسه.";
      }
      return errors;
    },

    body: () => {
      const fromSelect = el("div");
      const toSelect = el("div");

      const paint = () => {
        fromSelect.replaceChildren(
          selectField({
            label: "من",
            required: true,
            value: form.fromId,
            options: nodeOptions(form.fromType),
            onChange: value((v) => (form.fromId = v)),
          }),
        );
        toSelect.replaceChildren(
          selectField({
            label: "إلى",
            required: true,
            value: form.toId,
            options: nodeOptions(form.toType),
            onChange: value((v) => (form.toId = v)),
          }),
        );
      };

      paint();

      return el(
        "div",
        { class: "space-y-3.5" },
        el(
          "div",
          { class: "rounded-xl border border-line bg-subtle p-3 text-xs text-muted leading-relaxed" },
          "التحويل الداخلي لا يُغيّر مجموع الأصول — تنتقل النقدية من وعاء إلى وعاء. " +
            "القيد نقل بين حسابين، بلا أي أثر على الإيراد أو المصروف.",
        ),
        el(
          "div",
          { class: "grid gap-3.5 sm:grid-cols-2" },
          selectField({
            label: "نوع الجهة المحوِّلة",
            value: form.fromType,
            options: [{ value: "cash", label: "خزينة نقدية" }, { value: "bank", label: "حساب بنكي" }],
            onChange: value((v) => {
              form.fromType = v;
              form.fromId = String(nodeOptions(v)[0]?.value ?? "");
              paint();
            }),
          }),
          selectField({
            label: "نوع الجهة المستقبلة",
            value: form.toType,
            options: [{ value: "cash", label: "خزينة نقدية" }, { value: "bank", label: "حساب بنكي" }],
            onChange: value((v) => {
              form.toType = v;
              form.toId = String(nodeOptions(v)[0]?.value ?? "");
              paint();
            }),
          }),
          fromSelect,
          toSelect,
          moneyField({ label: "المبلغ", required: true, onInput: value((v) => (form.amount = Number(v) || 0)) }),
          dateFieldWithLabel({ label: "التاريخ", required: true, value: form.date, onChange: value((v) => (form.date = v)) }),
        ),
      );
    },

    onSubmit: () =>
      createTransfer({
        fromType: form.fromType,
        fromId: Number(form.fromId),
        toType: form.toType,
        toId: Number(form.toId),
        amount: form.amount,
        date: form.date,
      }),

    onDone: async () => {
      invalidateLookups("cashBoxes");
      invalidateLookups("bankAccounts");
      await context.reload();
    },
  });
}
