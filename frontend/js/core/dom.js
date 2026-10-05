/**
 * بناء عناصر DOM.
 *
 * كل المكوّنات تُبنى عبر `el()` وليس عبر innerHTML. السبب ليس أسلوبيًا: بيانات
 * المرضى والفواتير تأتي من مصدر خارجي، وتمريرها كنصوص (textNode) يجعل الحقن
 * (XSS) مستحيلًا بنيويًا. الحقن النصي متاح عبر الخاصية `html` فقط — وباختيار صريح.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** خصائص يجب ضبطها كـ properties لا attributes، وإلا تتعطل حقول النماذج. */
const PROPERTIES = new Set([
  "value",
  "checked",
  "selected",
  "disabled",
  "readOnly",
  "indeterminate",
  "multiple",
  "textContent",
  "innerText",
]);

/** يحوّل class إلى نص: يقبل نصًا، أو مصفوفة، أو كائن شروط. */
export function cx(...inputs) {
  const out = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string") {
      out.push(input);
    } else if (Array.isArray(input)) {
      const nested = cx(...input);
      if (nested) out.push(nested);
    } else if (typeof input === "object") {
      for (const [key, active] of Object.entries(input)) {
        if (active) out.push(key);
      }
    }
  }

  return out.join(" ");
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;

    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
}

function applyProps(node, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;

    // معالجات الأحداث: onClick / onInput / on: { click, keydown }
    if (key === "on" && typeof value === "object") {
      for (const [event, handler] of Object.entries(value)) {
        if (typeof handler === "function") node.addEventListener(event, handler);
      }
      continue;
    }
    if (key.startsWith("on") && key.length > 2 && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }

    switch (key) {
      case "class":
      case "className": {
        const resolved = cx(value);
        if (resolved) node.setAttribute("class", `${node.getAttribute("class") ?? ""} ${resolved}`.trim());
        continue;
      }
      case "dataset":
        for (const [dataKey, dataValue] of Object.entries(value)) {
          if (dataValue !== undefined && dataValue !== null) node.dataset[dataKey] = String(dataValue);
        }
        continue;
      case "style":
        if (typeof value === "string") node.setAttribute("style", value);
        else Object.assign(node.style, value);
        continue;
      case "attrs":
        for (const [attr, attrValue] of Object.entries(value)) {
          if (attrValue !== undefined && attrValue !== null && attrValue !== false) {
            node.setAttribute(attr, attrValue === true ? "" : String(attrValue));
          }
        }
        continue;
      case "text":
        node.textContent = String(value);
        continue;
      case "html":
        // مخرج صريح: استخدمه فقط مع ترميز نثق به (أيقونات SVG مثلاً).
        node.innerHTML = value;
        continue;
      case "ref":
        if (typeof value === "function") value(node);
        continue;
      default:
        break;
    }

    if (PROPERTIES.has(key)) {
      node[key] = value;
      continue;
    }

    // السمات المنطقية: true تُضيف السمة، false تحذفها.
    if (value === false) continue;
    node.setAttribute(key, value === true ? "" : String(value));
  }
}

/**
 * ينشئ عنصرًا.
 *
 *   el("div")
 *   el("div.card.p-4", "نص")
 *   el("button", { class: "btn", onClick: save, disabled: busy }, "حفظ")
 */
export function el(tag, props, ...children) {
  const [name, ...classes] = String(tag).split(".");
  const node = document.createElement(name || "div");

  if (classes.length) node.setAttribute("class", classes.join(" "));

  // الوسيط الثاني يكون خصائص فقط لو كان كائنًا عاديًا — لا عنصر DOM ولا مصفوفة.
  const hasProps =
    props !== null &&
    typeof props === "object" &&
    !Array.isArray(props) &&
    !(props instanceof Node);

  if (hasProps) applyProps(node, props);
  else if (props !== undefined) children.unshift(props);

  appendChildren(node, children);
  return node;
}

/** مثل `el` لكن في نطاق SVG — ضروري وإلا لا تُرسم الأيقونات. */
export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class" || key === "className") node.setAttribute("class", cx(value));
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? "" : String(value));
  }

  appendChildren(node, children);
  return node;
}

/** قطعة (fragment) لإرجاع عدة عناصر من دالة واحدة. */
export function frag(...children) {
  const fragment = document.createDocumentFragment();
  appendChildren(fragment, children);
  return fragment;
}

/** نص خالص كعقدة — للاستخدام داخل `frag`. */
export function text(value) {
  return document.createTextNode(String(value));
}

/** يفرّغ عنصرًا من كل أبنائه. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** يستبدل محتوى عنصر بالكامل. */
export function render(container, ...children) {
  clear(container);
  appendChildren(container, children);
  return container;
}

export function mount(container, ...children) {
  appendChildren(container, children);
  return container;
}

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/**
 * تفويض الأحداث — نربط مستمعًا واحدًا على الجدول بدل مستمع لكل صف.
 * يُعيد دالة لإلغاء الربط.
 */
export function delegate(root, event, selector, handler) {
  const listener = (evt) => {
    const match = evt.target.closest(selector);
    if (match && root.contains(match)) handler(evt, match);
  };

  root.addEventListener(event, listener);
  return () => root.removeEventListener(event, listener);
}

/** يُعيد دالة مؤجَّلة — تُستخدم لمربعات البحث. */
export function debounce(fn, waitMs) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** مُعرّف فريد لربط label بـ input وسمات aria. */
let uidCounter = 0;
export function uid(prefix = "hx") {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

/**
 * يحصر التركيز داخل عنصر (نافذة/درج) — مطلب وصولية للنوافذ المنبثقة.
 * يُعيد دالة للتنظيف.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(container) {
  const previouslyFocused = document.activeElement;

  const onKeydown = (evt) => {
    if (evt.key !== "Tab") return;

    const targets = qsa(FOCUSABLE, container).filter((node) => node.offsetParent !== null);
    if (!targets.length) return;

    const first = targets[0];
    const last = targets[targets.length - 1];

    if (evt.shiftKey && document.activeElement === first) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault();
      first.focus();
    }
  };

  container.addEventListener("keydown", onKeydown);

  const initial = qsa(FOCUSABLE, container).find((node) => node.offsetParent !== null);
  (initial ?? container).focus({ preventScroll: true });

  return () => {
    container.removeEventListener("keydown", onKeydown);
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
  };
}
