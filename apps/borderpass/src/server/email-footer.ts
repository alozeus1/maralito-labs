import 'server-only';

/**
 * Required transactional email footer (Phase 6). Identical text across templates and locales so the
 * BorderPass identity + monitored support address appear on every message.
 */
export const FOOTER_TEXT =
  'BorderPass · Powered by Maralito Labs\n' +
  'This message relates to your BorderPass account or order. For assistance, reply to this email or contact support@maralito.uk.';

export const FOOTER_HTML =
  '<hr style="border:none;border-top:1px solid #eadfd9;margin:28px 0" />' +
  '<p style="color:#8a8078;font-size:12px;line-height:1.5">BorderPass · Powered by Maralito Labs<br>' +
  'This message relates to your BorderPass account or order. For assistance, reply to this email or contact ' +
  '<a href="mailto:support@maralito.uk" style="color:#8a8078">support@maralito.uk</a>.</p>';
