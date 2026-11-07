/**
 * مساعدات النماذج المشتركة.
 *
 * `components/forms/fields.js` يفصل الحقل (`field`) عن أداة الإدخال (`select`،
 * `dateField`) — فصل صحيح يسمح بتركيبات غير قياسية. لكن 90% من الاستخدام
 * تركيبة قياسية واحدة، وتكرارها في كل شاشة يُنتج تفاوتًا في التسميات والتلميحات.
 * هذا الملف يُغلّف التركيبات القياسية ويترك `field` متاحًا لما يخرج عنها.
 */

import { el } from "../../js/core/dom.js";
import { field, select, dateField, dateRangeField, moneyInput, quantityInput, textarea } from "../../components/forms/fields.js";
import { button } from "../../components/common/button.js";
import { toast } from "../../components/feedback/toast.js";
import { openModal } from "../../components/modals/overlay.js";
import { formErrorSummary } from "../../components/feedback/alert.js";
import { describeError } from "../../js/core/errors.js";

/* ==========================================================================
   محوّل القيمة
   ========================================================================== */

/**
 * يحوّل معالج **قيمة** إلى معالج **حدث**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  `onInput` و `onChange` في components/forms/fields.js تُمرّران الحدث الخام
 *  (`Event`) لا القيمة — وهو الصحيح لأداة إدخال عامة.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * لكن الشاشات تحتاج القيمة دائمًا، وكتابة `(event) => event.target.value` في
 * كل حقل في سبعين شاشة يُنتج أخطاءً صامتة: `onInput: (v) => (name = v)` يبدو
 * صحيحًا ويضع كائن `Event` في `name`، فيُرسَل إلى الخادم أو يُرمى عند
 * `name.trim()`. هذا المحوّل يجعل النية صريحة في موضع الاستخدام:
 *
 *     textField({ label: "الاسم", onInput: value((next) => (form.name = next)) })
 */
export const value = (handler) => (event) => handler(event.target.value);

/** مثله للحقول الرقمية — يُعيد رقمًا لا نصًا. */
export const numberValue = (handler) => (event) => {
  const parsed = Number(event.target.value);
  handler(Number.isFinite(parsed) ? parsed : 0);
};

/** مثله لمربعات الاختيار. */
export const checkedValue = (handler) => (event) => handler(event.target.checked);

/* ==========================================================================
   حقول مُغلَّفة
   ========================================================================== */

/** قائمة منسدلة بتسمية وتلميح. */
export function selectField({ label, hint, error, required, span, ...options } = {}) {
  return field({
    label,
    hint,
    error,
    required,
    span,
    control: select({ invalid: Boolean(error), ...options }),
  });
}

/** حقل تاريخ بتسمية. */
export function dateFieldWithLabel({ label, hint, error, required, span, ...options } = {}) {
  return field({
    label,
    hint,
    error,
    required,
    span,
    control: dateField({ invalid: Boolean(error), ...options }),
  });
}

/** حقل مبلغ بتسمية. */
export function moneyField({ label, hint, error, required, span, ...options } = {}) {
  return field({
    label,
    hint,
    error,
    required,
    span,
    control: moneyInput({ invalid: Boolean(error), ...options }),
  });
}

/** حقل كمية بتسمية. */
export function quantityField({ label, hint, error, required, span, ...options } = {}) {
  return field({
    label,
    hint,
    error,
    required,
    span,
    control: quantityInput({ invalid: Boolean(error), ...options }),
  });
}

/** حقل ملاحظات. */
export function notesField({ label = "ملاحظات", hint, span = "full", ...options } = {}) {
  return field({ label, hint, span, control: textarea({ rows: 3, ...options }) });
}

/**
 * نطاق تاريخين يُبلِّغ القيمتين معًا.
 *
 * `dateRangeField` الأساسي يُمرّر حدث الإدخال الخام، فتحتاج كل شاشة أن تقرأ
 * القيمتين من عناصر الـ DOM بنفسها. هذا الغلاف يقرؤهما ويُبلّغ
 * `{ dateFrom, dateTo }` — وهو ما تحتاجه كل شاشة فعلًا.
 */
export function dateRange({ label, from = "", to = "", onChange, span } = {}) {
  const host = el("div");

  const control = dateRangeField({
    from,
    to,
    onChange: () => {
      const inputs = host.querySelectorAll("input[type=date]");
      onChange?.({
        dateFrom: inputs[0]?.value ?? "",
        dateTo: inputs[1]?.value ?? "",
      });
    },
  });

  host.appendChild(control);

  return label ? field({ label, span, control: host }) : host;
}

/* ==========================================================================
   زر غير متزامن
   ========================================================================== */

/**
 * زر ينفّذ عملية غير متزامنة ويُظهر حالة التنفيذ بنفسه.
 *
 * ضرورة لا تحسين: زر «حفظ» يبقى قابلاً للنقر أثناء الطلب يسمح بنقرتين فتُنشأ
 * فاتورتان. التعطيل أثناء التنفيذ يمنع ذلك بنيويًا، ومؤشر التحميل يُخبر
 * المستخدم أن شيئًا يحدث بدل أن يظن أن الزر لا يعمل.
 */
export function asyncButton({ label, onClick, success, onDone, ...options } = {}) {
  let running = false;

  const node = button({
    ...options,
    label,
    onClick: async (event) => {
      if (running) return;
      running = true;

      const spinner = el("span", { class: "hx-spinner size-4", "aria-hidden": "true" });
      const original = [...node.childNodes];

      node.disabled = true;
      node.setAttribute("aria-busy", "true");
      node.replaceChildren(spinner, el("span", {}, label ?? "جاري التنفيذ…"));

      try {
        const result = await onClick?.(event);
        if (success) toast.success(success);
        await onDone?.(result);
        return result;
      } catch (error) {
        toast.error(describeError(error));
      } finally {
        running = false;
        /* العنصر قد يكون أُزيل من الشجرة (أُغلقت النافذة) — الفحص ضروري. */
        if (node.isConnected) {
          node.disabled = false;
          node.removeAttribute("aria-busy");
          node.replaceChildren(...original);
        }
      }
    },
  });

  return node;
}

/* ==========================================================================
   نافذة نموذج
   ========================================================================== */

/**
 * نافذة نموذج بزر حفظ غير متزامن وملخص أخطاء.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {"sm"|"md"|"lg"|"xl"|"full"} [options.size]
 * @param {(ctx:{ setErrors:Function })=>Node} options.body
 * @param {string} [options.submitLabel]
 * @param {() => Promise<any>} options.onSubmit
 * @param {string} [options.success]
 * @param {(result:any)=>any} [options.onDone]
 * @param {() => Record<string,string>|null} [options.validate] يُعيد أخطاء الحقول
 * @param {Record<string,string>} [options.fieldLabels]
 */
export function formModal({
  title,
  subtitle,
  size = "md",
  body,
  submitLabel = "حفظ",
  submitVariant = "primary",
  onSubmit,
  success,
  onDone,
  validate,
  fieldLabels = {},
  extraActions,
}) {
  const errorHost = el("div");

  const modal = openModal({
    title,
    subtitle,
    size,
    body: () => el("div", { class: "space-y-4" }, errorHost, body?.()),
    footer: (close) => [
      button({ label: "إلغاء", variant: "ghost", onClick: () => close() }),
      ...[extraActions].flat().filter(Boolean),
      asyncButton({
        label: submitLabel,
        variant: submitVariant,
        onClick: async () => {
          /*
           * التحقق المحلي أولًا: إظهار أخطاء الحقول قبل إرسال طلب نعرف أنه
           * سيُرفض أسرع وأوضح — ولا يُغني عن تحقق الخادم، فهو الحاكم.
           */
          const errors = validate?.();
          errorHost.replaceChildren();

          if (errors && Object.keys(errors).length) {
            errorHost.appendChild(formErrorSummary(errors, fieldLabels));
            /* الخطأ لا يُرمى: الملخص معروض، ورمي خطأ يُظهر toast مكررًا. */
            return undefined;
          }

          const result = await onSubmit();
          close();
          return result;
        },
        success,
        onDone,
      }),
    ],
  });

  return modal;
}

/**
 * يعرض أخطاء حقول قادمة من الخادم في النموذج.
 * `ApiError.fields` هو الشكل المتفق عليه — راجع docs/11-FRONTEND-CONVENTIONS.md.
 */
export function showFieldErrors(host, error, labels = {}) {
  host.replaceChildren();
  if (error?.fields && Object.keys(error.fields).length) {
    host.appendChild(formErrorSummary(error.fields, labels));
    return true;
  }
  return false;
}
