/**
 * مكوّن النوافذ المنبثقة المشترك.
 *
 * يربط مع `components/modals/overlay.js` ويوفر واجهة موحدة لفتح النوافذ المنبثقة.
 */

import { openModal as openOverlayModal } from "../modals/overlay.js";

export function openModal({ title, subtitle, content, body, actions, footer, size = "md", onClose }) {
  const modalBody = body ?? content;
  return openOverlayModal({
    title,
    subtitle,
    size,
    onClose,
    body: typeof modalBody === "function" ? modalBody : () => modalBody,
    footer: footer ?? ((close) => actions ?? []),
  });
}
