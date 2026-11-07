/**
 * تقادم ذمم الموردين.
 *
 * نفس شاشة تقادم العملاء بجهة مختلفة — الحساب واحد والعنوان ومسار الطرف
 * مختلفان. راجع `agingPage` في receivables-aging.page.js.
 */

import { agingPage } from "./receivables-aging.page.js";

export default agingPage({ side: "payables" });
