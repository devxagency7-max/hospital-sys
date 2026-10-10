/**
 * الأيقونات.
 *
 * SVG مرسوم inline بدون أي مكتبة خارجية: لا طلب شبكة إضافي، ولا اعتماد على
 * خط أيقونات قد لا يُحمَّل داخل شبكة مستشفى مغلقة، وتلوين عبر `currentColor`.
 * مسارات بنمط خطي موحّد (stroke) بمقاس 24.
 */

import { svg } from "../../js/core/dom.js";

/** كل مسار عبارة عن مصفوفة عناصر: [tag, attributes]. */
const PATHS = {
  /* --- التنقل --- */
  dashboard: [
    ["rect", { x: 3, y: 3, width: 7, height: 9, rx: 1 }],
    ["rect", { x: 14, y: 3, width: 7, height: 5, rx: 1 }],
    ["rect", { x: 14, y: 12, width: 7, height: 9, rx: 1 }],
    ["rect", { x: 3, y: 16, width: 7, height: 5, rx: 1 }],
  ],
  inbox: [
    ["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }],
    ["path", { d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" }],
  ],
  cross: [
    ["circle", { cx: 12, cy: 12, r: 10 }],
    ["path", { d: "M15 9l-6 6M9 9l6 6" }],
  ],
  patients: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: 9, cy: 7, r: 4 }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }],
  ],
  calendar: [
    ["rect", { x: 3, y: 4, width: 18, height: 17, rx: 2 }],
    ["path", { d: "M3 10h18M8 2v4M16 2v4" }],
  ],
  billing: [
    ["path", { d: "M4 3h12l4 4v14H4z" }],
    ["path", { d: "M8 8h6M8 12h8M8 16h5" }],
  ],
  accounting: [
    ["path", { d: "M3 3v18h18" }],
    ["path", { d: "M7 15l4-5 3 3 5-7" }],
  ],
  inventory: [
    ["path", { d: "M3 7l9-4 9 4v10l-9 4-9-4z" }],
    ["path", { d: "M3 7l9 4 9-4M12 11v10" }],
  ],
  purchasing: [
    ["circle", { cx: 9, cy: 20, r: 1.5 }],
    ["circle", { cx: 18, cy: 20, r: 1.5 }],
    ["path", { d: "M2 3h3l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6" }],
  ],
  pharmacy: [
    ["rect", { x: 2.5, y: 8.5, width: 19, height: 11, rx: 5.5 }],
    ["path", { d: "M12 8.5v11M2.5 14h19" }],
  ],
  laboratory: [
    ["path", { d: "M9 2h6M10 2v6.5L5.5 17A3 3 0 0 0 8.2 21.5h7.6A3 3 0 0 0 18.5 17L14 8.5V2" }],
    ["path", { d: "M7 15h10" }],
  ],
  radiology: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M12 3v18M3 12h18" }],
  ],
  reports: [
    ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }],
    ["path", { d: "M14 2v6h6M8 13h8M8 17h5" }],
  ],
  users: [
    ["path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: 9, cy: 7, r: 4 }],
    ["path", { d: "M23 21v-2a4 4 0 0 0-3-3.87M19 3.13a4 4 0 0 1 0 7.75" }],
  ],
  audit: [
    ["path", { d: "M12 2a10 10 0 1 0 10 10" }],
    ["path", { d: "M12 7v5l4 2" }],
    ["path", { d: "M16 2h6v6" }],
  ],
  settings: [
    ["circle", { cx: 12, cy: 12, r: 3 }],
    [
      "path",
      {
        d: "M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.7a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9v.09A1.7 1.7 0 0 0 20.86 10H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z",
      },
    ],
  ],

  /* --- إجراءات --- */
  search: [["circle", { cx: 11, cy: 11, r: 7 }], ["path", { d: "M20 20l-3.5-3.5" }]],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  edit: [
    ["path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }],
    ["path", { d: "M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" }],
  ],
  trash: [
    ["path", { d: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" }],
    ["path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" }],
  ],
  eye: [
    ["path", { d: "M1.5 12S5 5 12 5s10.5 7 10.5 7S19 19 12 19 1.5 12 1.5 12z" }],
    ["circle", { cx: 12, cy: 12, r: 3 }],
  ],
  filter: [["path", { d: "M3 5h18l-7 8v6l-4-2v-4z" }]],
  download: [
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { d: "M7 10l5 5 5-5M12 15V3" }],
  ],
  upload: [
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { d: "M17 8l-5-5-5 5M12 3v12" }],
  ],
  image: [
    ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ["circle", { cx: 8.5, cy: 8.5, r: 1.5 }],
    ["path", { d: "M21 15l-5-5L5 21" }],
  ],
  print: [
    ["path", { d: "M6 9V2h12v7" }],
    ["rect", { x: 3, y: 9, width: 18, height: 8, rx: 2 }],
    ["path", { d: "M6 17h12v5H6z" }],
  ],
  refresh: [
    ["path", { d: "M21 12a9 9 0 1 1-3-6.7L21 8" }],
    ["path", { d: "M21 3v5h-5" }],
  ],
  close: [["path", { d: "M18 6L6 18M6 6l12 12" }]],
  check: [["path", { d: "M20 6L9 17l-5-5" }]],
  columns: [
    ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ["path", { d: "M9 3v18M15 3v18" }],
  ],
  more: [
    ["circle", { cx: 12, cy: 5, r: 1.5 }],
    ["circle", { cx: 12, cy: 12, r: 1.5 }],
    ["circle", { cx: 12, cy: 19, r: 1.5 }],
  ],

  /* --- اتجاهات (في RTL يُعاد تدوير الأسهم عبر خاصية `flipRtl`) --- */
  chevronDown: [["path", { d: "M6 9l6 6 6-6" }]],
  chevronUp: [["path", { d: "M18 15l-6-6-6 6" }]],
  chevronStart: [["path", { d: "M15 18l-6-6 6-6" }]],
  chevronEnd: [["path", { d: "M9 18l6-6-6-6" }]],
  arrowUp: [["path", { d: "M12 19V5M5 12l7-7 7 7" }]],
  arrowDown: [["path", { d: "M12 5v14M19 12l-7 7-7-7" }]],
  sort: [["path", { d: "M8 18V6M8 6L5 9M8 6l3 3M16 6v12M16 18l3-3M16 18l-3-3" }]],

  /* --- حالات --- */
  info: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M12 11v5M12 8h.01" }]],
  warning: [
    ["path", { d: "M10.3 3.2L1.8 17.5A2 2 0 0 0 3.5 20.5h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z" }],
    ["path", { d: "M12 9v4M12 17h.01" }],
  ],
  error: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M15 9l-6 6M9 9l6 6" }]],
  success: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M8.5 12.5l2.5 2.5 4.5-5" }]],
  empty: [
    ["path", { d: "M3 7l2-4h14l2 4" }],
    ["path", { d: "M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
    ["path", { d: "M9 12h6" }],
  ],
  lock: [
    ["rect", { x: 4, y: 11, width: 16, height: 10, rx: 2 }],
    ["path", { d: "M8 11V8a4 4 0 0 1 8 0v3" }],
  ],
  bell: [
    ["path", { d: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" }],
    ["path", { d: "M13.7 21a2 2 0 0 1-3.4 0" }],
  ],
  menu: [["path", { d: "M3 6h18M3 12h18M3 18h18" }]],
  logout: [
    ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }],
    ["path", { d: "M16 17l5-5-5-5M21 12H9" }],
  ],
  user: [
    ["circle", { cx: 12, cy: 8, r: 4 }],
    ["path", { d: "M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" }],
  ],
  money: [
    ["rect", { x: 2, y: 6, width: 20, height: 12, rx: 2 }],
    ["circle", { cx: 12, cy: 12, r: 2.5 }],
    ["path", { d: "M6 12h.01M18 12h.01" }],
  ],
  wallet: [
    ["path", { d: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" }],
    ["rect", { x: 3, y: 7, width: 18, height: 12, rx: 2 }],
    ["path", { d: "M16 13h2" }],
  ],
  building: [
    ["rect", { x: 4, y: 3, width: 16, height: 18, rx: 1 }],
    ["path", { d: "M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" }],
  ],
  code: [["path", { d: "M16 18l6-6-6-6M8 6l-6 6 6 6" }]],
  palette: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["circle", { cx: 9, cy: 9.5, r: 1 }],
    ["circle", { cx: 14.5, cy: 9, r: 1 }],
    ["circle", { cx: 15.5, cy: 14, r: 1 }],
  ],

  /* --- السمة (داكن / فاتح / النظام) --- */
  sun: [
    ["circle", { cx: 12, cy: 12, r: 4.5 }],
    [
      "path",
      { d: "M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12h2.5M19 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8" },
    ],
  ],
  moon: [["path", { d: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" }]],
  monitor: [
    ["rect", { x: 2.5, y: 4, width: 19, height: 13, rx: 2 }],
    ["path", { d: "M8 21h8M12 17v4" }],
  ],

  /* --- استوديو تخصيص المظهر --- */
  image: [
    ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ["circle", { cx: 8.5, cy: 8.5, r: 1.5 }],
    ["path", { d: "M21 15l-5-5L5 21" }],
  ],
  sliders: [
    ["path", { d: "M4 6h7M15 6h5M4 12h11M19 12h1M4 18h3M11 18h9" }],
    ["circle", { cx: 13, cy: 6, r: 2 }],
    ["circle", { cx: 17, cy: 12, r: 2 }],
    ["circle", { cx: 9, cy: 18, r: 2 }],
  ],

  /* --- مؤشرات وتقارير إضافية --- */
  fileText: [
    ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }],
    ["path", { d: "M14 2v6h6M8 13h8M8 17h5" }],
  ],
  checkCircle: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M8.5 12.5l2.5 2.5 4.5-5" }],
  ],
  clock: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M12 6v6l4 2" }],
  ],
  alertTriangle: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M15 9l-6 6M9 9l6 6" }],
  ],
  creditCard: [
    ["rect", { x: 2, y: 5, width: 20, height: 14, rx: 2 }],
    ["path", { d: "M2 10h20M6 15h4" }],
  ],
  truck: [
    ["rect", { x: 1, y: 3, width: 15, height: 13, rx: 1 }],
    ["path", { d: "M16 8h4l3 3v5h-7V8z" }],
    ["circle", { cx: 5.5, cy: 18.5, r: 2.5 }],
    ["circle", { cx: 18.5, cy: 18.5, r: 2.5 }],
  ],
  crown: [
    ["path", { d: "M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" }],
  ],
  folder: [
    ["path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }],
  ],
  mapPin: [
    ["path", { d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" }],
    ["circle", { cx: 12, cy: 10, r: 3 }],
  ],
  heart: [
    ["path", { d: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" }],
  ],
  briefcase: [
    ["rect", { x: 2, y: 7, width: 20, height: 14, rx: 2 }],
    ["path", { d: "M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" }],
  ],
  shield: [
    ["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }],
  ],
};

/** الأيقونات ذات الاتجاه — تُقلب أفقيًا في RTL وإلا أشارت للجهة الخطأ. */
const DIRECTIONAL = new Set(["chevronStart", "chevronEnd", "logout", "sort"]);

export const iconNames = Object.keys(PATHS);

/**
 * ينشئ أيقونة.
 *
 * @param {string} name   مفتاح من `iconNames`
 * @param {object} [options]
 * @param {number} [options.size=18]
 * @param {string} [options.class]
 * @param {number} [options.strokeWidth=1.75]
 * @param {string} [options.title] نص بديل — مرّره فقط إن كانت الأيقونة وحدها
 *                                 تحمل المعنى؛ وإلا تُخفى عن قارئ الشاشة.
 */
export function icon(name, { size = 18, class: className, strokeWidth = 1.75, title } = {}) {
  const definition = PATHS[name];

  if (!definition) {
    console.warn(`[icon] أيقونة غير معروفة: "${name}"`);
    return svg("svg", { width: size, height: size, viewBox: "0 0 24 24" });
  }

  const node = svg(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: ["shrink-0", DIRECTIONAL.has(name) && "rtl:-scale-x-100", className],
      // أيقونة بلا عنوان زخرفية: إعلانها لقارئ الشاشة ضجيج.
      "aria-hidden": title ? null : "true",
      role: title ? "img" : null,
      focusable: "false",
    },
    title ? svg("title", {}, title) : null,
    ...definition.map(([tag, attributes]) => svg(tag, attributes)),
  );

  return node;
}
