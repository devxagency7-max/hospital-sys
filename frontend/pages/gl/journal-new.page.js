/**
 * إنشاء قيد يومية يدوي.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  الشاشة تُظهر التوازن **لحظيًا** ولا تسمح بالحفظ قبل تحققه.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * الخادم يرفض القيد غير المتوازن على كل حال (`assertBalanced` في
 * js/domain/posting.js)، لكن انتظار الرفض بعد ملء عشرة سطور تجربة سيئة:
 * المحاسب يعرف أن قيده غير متوازن وهو يكتبه، والشاشة يجب أن تعرف معه.
 * الفحص هنا راحة، والفحص هناك هو الضمانة.
 */

import { el, cx, clear } from "../../js/core/dom.js";
import { pageHeader } from "../../components/layout/breadcrumbs.js";
import { card } from "../../components/common/card.js";
import { button, iconButton } from "../../components/common/button.js";
import { badge } from "../../components/common/badge.js";
import { alert } from "../../components/feedback/alert.js";
import { toast } from "../../components/feedback/toast.js";
import { icon } from "../../components/common/icon.js";
import { textField, moneyInput, select, formGrid } from "../../components/forms/fields.js";
import { currency, amount } from "../../js/core/format.js";
import { navigate } from "../../js/core/router.js";
import { describeError } from "../../js/core/errors.js";
import * as money from "../../js/core/money.js";
import { selectField, dateFieldWithLabel, notesField, asyncButton, value, numberValue } from "../_shared/forms.js";
import { createJournalEntry } from "../../js/api/accounting.api.js";
import { getAccounts, getCostCenters, toOptions, toAccountOptions } from "../../js/api/lookups.api.js";

/** السطر الفارغ — نبدأ بسطرين لأن القيد يحتاج طرفين على الأقل. */
const emptyLine = () => ({ accountId: "", debit: 0, credit: 0, description: "", costCenterId: "" });

export default async function journalNewPage() {
  const [accounts, costCenters] = await Promise.all([getAccounts(), getCostCenters()]);

  const accountOptions = toAccountOptions(accounts);
  const accountById = new Map(accounts.map((account) => [String(account.id), account]));

  const form = {
    date: new Date().toISOString().slice(0, 10),
    description: "",
    costCenterId: "",
    notes: "",
  };

  let lines = [emptyLine(), emptyLine()];

  const container = el("div", { class: "space-y-4" });
  const linesHost = el("tbody");
  const balanceHost = el("div");
  const actionsHost = el("div", { class: "flex flex-wrap items-center gap-2" });

  /* ------------------------------------------------------------- الحساب الحي */

  function totals() {
    const debit = money.sum(lines.map((line) => line.debit));
    const credit = money.sum(lines.map((line) => line.credit));

    return {
      debit,
      credit,
      difference: money.subtract(debit, credit),
      isBalanced: money.equals(debit, credit) && money.isPositive(debit),
      /** سطر مدين ودائن معًا خطأ بناء لا قيد مركب. */
      mixedLines: lines.filter((line) => money.isPositive(line.debit) && money.isPositive(line.credit)),
      filledLines: lines.filter(
        (line) => line.accountId && (money.isPositive(line.debit) || money.isPositive(line.credit)),
      ),
    };
  }

  function renderBalance() {
    const summary = totals();
    clear(balanceHost);

    const chip = (label, text, tone) =>
      el(
        "div",
        {
          class: cx(
            "flex items-center justify-between gap-4 px-3.5 py-2.5 rounded-xl border",
            tone === "danger" && "bg-danger-50/60 border-danger-200/60 text-danger-400",
            tone === "success" && "bg-success-50/60 border-success-200/60 text-success-400",
            tone === "neutral" && "bg-subtle border-line text-ink",
          ),
        },
        el("span", { class: "text-xs font-medium" }, label),
        el("span", { class: "text-sm font-semibold tabular font-mono" }, text),
      );

    balanceHost.appendChild(
      el(
        "div",
        { class: "grid gap-2 sm:grid-cols-3" },
        chip("مجموع المدين", amount(summary.debit), "neutral"),
        chip("مجموع الدائن", amount(summary.credit), "neutral"),
        chip(
          summary.isBalanced ? "القيد متوازن" : "الفرق",
          summary.isBalanced ? "✓" : amount(summary.difference),
          summary.isBalanced ? "success" : "danger",
        ),
      ),
    );

    if (summary.mixedLines.length) {
      balanceHost.appendChild(
        alert({
          tone: "danger",
          title: "سطر مدين ودائن في الوقت نفسه",
          message:
            `${summary.mixedLines.length} سطر يحمل قيمة في العمودين. افصله إلى سطرين — ` +
            "السطر الواحد إما مدين أو دائن.",
        }),
      );
    }

    renderActions(summary);
  }

  function renderActions(summary) {
    clear(actionsHost);

    const blocked = !summary.isBalanced || summary.mixedLines.length > 0 || summary.filledLines.length < 2;

    const payload = () => ({
      date: form.date,
      description: form.description.trim(),
      costCenterId: form.costCenterId || null,
      notes: form.notes.trim() || null,
      lines: summary.filledLines.map((line) => ({
        accountId: Number(line.accountId),
        debit: line.debit,
        credit: line.credit,
        description: line.description.trim() || null,
        costCenterId: line.costCenterId || null,
      })),
    });

    const validate = () => {
      if (!form.description.trim()) {
        toast.warning("وصف القيد مطلوب — هو ما يشرح سببه عند المراجعة.");
        return false;
      }
      return true;
    };

    actionsHost.appendChild(
      asyncButton({
        label: "حفظ كمسوّدة",
        variant: "secondary",
        icon: "edit",
        disabled: blocked,
        onClick: async () => {
          if (!validate()) return undefined;
          return createJournalEntry(payload());
        },
        success: "حُفظ القيد كمسوّدة.",
        onDone: (entry) => entry && navigate(`/gl/journal/${entry.id}`),
      }),
    );

    actionsHost.appendChild(
      asyncButton({
        label: "حفظ وتقديم للمراجعة",
        variant: "primary",
        icon: "upload",
        disabled: blocked,
        onClick: async () => {
          if (!validate()) return undefined;
          return createJournalEntry({ ...payload(), submit: true });
        },
        success: "حُفظ القيد وقُدِّم للمراجعة.",
        onDone: (entry) => entry && navigate(`/gl/journal/${entry.id}`),
      }),
    );

    actionsHost.appendChild(
      button({ label: "إلغاء", variant: "ghost", onClick: () => navigate("/gl/journal") }),
    );

    /* السبب يُعرض بجوار الزر المعطَّل: زر معطَّل بلا تفسير يبدو عطلًا. */
    if (blocked) {
      actionsHost.appendChild(
        el(
          "span",
          { class: "flex items-center gap-1.5 text-xs text-warning-400 ms-1" },
          icon("warning", { size: 14 }),
          summary.filledLines.length < 2
            ? "القيد يحتاج سطرين على الأقل بحساب ومبلغ."
            : summary.mixedLines.length
              ? "صحّح السطور المدينة والدائنة معًا."
              : "المدين لا يساوي الدائن — لا يمكن الحفظ.",
        ),
      );
    }
  }

  /* ---------------------------------------------------------------- السطور */

  function renderLines() {
    clear(linesHost);

    lines.forEach((line, index) => {
      const account = accountById.get(String(line.accountId));

      linesHost.appendChild(
        el(
          "tr",
          { class: "border-b border-line/60" },
          el("td", { class: "px-2 py-2 text-xs text-faint tabular w-10 text-center" }, String(index + 1)),

          /* الحساب */
          el(
            "td",
            { class: "px-2 py-2 min-w-[16rem]" },
            select({
              value: String(line.accountId),
              placeholder: "اختر الحساب…",
              options: accountOptions,
              onChange: value((next) => {
                line.accountId = next;
                renderLines();
              }),
            }),
            account
              ? el(
                  "div",
                  { class: "flex items-center gap-1.5 mt-1" },
                  badge(account.typeLabel, { size: "sm" }),
                  badge(account.nature === "debit" ? "مدين بطبيعته" : "دائن بطبيعته", {
                    tone: account.nature === "debit" ? "info" : "warning",
                    size: "sm",
                  }),
                )
              : null,
          ),

          /* الوصف */
          el(
            "td",
            { class: "px-2 py-2 min-w-[12rem]" },
            textField({
              value: line.description,
              placeholder: "وصف السطر (اختياري)",
              onInput: value((next) => (line.description = next)),
            }),
          ),

          /* مركز التكلفة */
          el(
            "td",
            { class: "px-2 py-2 min-w-[10rem]" },
            select({
              value: String(line.costCenterId),
              placeholder: "من القيد",
              options: toOptions(costCenters),
              onChange: value((next) => (line.costCenterId = next)),
            }),
          ),

          /* مدين */
          el(
            "td",
            { class: "px-2 py-2 w-40" },
            moneyInput({
              value: line.debit || "",
              onInput: numberValue((next) => {
                line.debit = next;
                /* إدخال قيمة في المدين يُصفّر الدائن — السطر طرف واحد. */
                if (next > 0 && line.credit > 0) {
                  line.credit = 0;
                  renderLines();
                }
                renderBalance();
              }),
            }),
          ),

          /* دائن */
          el(
            "td",
            { class: "px-2 py-2 w-40" },
            moneyInput({
              value: line.credit || "",
              onInput: numberValue((next) => {
                line.credit = next;
                if (next > 0 && line.debit > 0) {
                  line.debit = 0;
                  renderLines();
                }
                renderBalance();
              }),
            }),
          ),

          el(
            "td",
            { class: "px-2 py-2 w-12" },
            lines.length > 2
              ? iconButton("trash", {
                  label: "حذف السطر",
                  size: "icon-sm",
                  variant: "danger-ghost",
                  onClick: () => {
                    lines.splice(index, 1);
                    renderLines();
                    renderBalance();
                  },
                })
              : null,
          ),
        ),
      );
    });

    renderBalance();
  }

  /* --------------------------------------------------------------- الترويسة */

  container.appendChild(
    pageHeader({
      title: "إنشاء قيد يومية",
      description:
        "قيد يدوي. يُحفظ كمسوّدة أو يُقدَّم للمراجعة — ولا يدخل الأرصدة قبل اعتماده وترحيله.",
    }),
  );

  container.appendChild(
    card({
      title: "بيانات القيد",
      body: el(
        "div",
        { class: "space-y-4" },
        formGrid(
          dateFieldWithLabel({
            label: "تاريخ القيد",
            required: true,
            value: form.date,
            hint: "التاريخ يحدد الفترة المحاسبية — والترحيل إلى فترة مغلقة مرفوض.",
            onChange: value((next) => (form.date = next)),
          }),
          selectField({
            label: "مركز التكلفة الافتراضي",
            value: form.costCenterId,
            placeholder: "بلا مركز تكلفة",
            hint: "يُطبَّق على السطور التي لا تحمل مركزًا خاصًا بها.",
            options: toOptions(costCenters),
            onChange: value((next) => (form.costCenterId = next)),
          }),
        ),
        textField({
          label: "وصف القيد",
          required: true,
          value: form.description,
          placeholder: "مثال: تسوية مصروفات الكهرباء للربع الرابع",
          hint: "الوصف هو ما يشرح سبب القيد عند المراجعة بعد شهور.",
          onInput: value((next) => {
            form.description = next;
            renderBalance();
          }),
        }),
        notesField({
          label: "ملاحظات",
          placeholder: "مرفقات أو تفاصيل إضافية…",
          onInput: value((next) => (form.notes = next)),
        }),
      ),
    }),
  );

  container.appendChild(
    card({
      title: "سطور القيد",
      subtitle: "كل سطر إما مدين أو دائن — لا الاثنين معًا",
      actions: button({
        label: "إضافة سطر",
        variant: "secondary",
        size: "sm",
        icon: "plus",
        onClick: () => {
          lines.push(emptyLine());
          renderLines();
        },
      }),
      flush: true,
      body: el(
        "div",
        { class: "overflow-x-auto" },
        el(
          "table",
          { class: "w-full text-sm border-collapse" },
          el(
            "thead",
            {},
            el(
              "tr",
              { class: "bg-subtle text-xs text-muted" },
              el("th", { class: "px-2 py-2.5 w-10" }, "#"),
              el("th", { class: "px-2 py-2.5 text-start" }, "الحساب"),
              el("th", { class: "px-2 py-2.5 text-start" }, "الوصف"),
              el("th", { class: "px-2 py-2.5 text-start" }, "مركز التكلفة"),
              el("th", { class: "px-2 py-2.5 text-start" }, "مدين"),
              el("th", { class: "px-2 py-2.5 text-start" }, "دائن"),
              el("th", { class: "px-2 py-2.5 w-12" }, ""),
            ),
          ),
          linesHost,
        ),
      ),
    }),
  );

  container.appendChild(card({ title: "التوازن", body: balanceHost }));
  container.appendChild(el("div", { class: "pt-1" }, actionsHost));

  renderLines();
  return container;
}
