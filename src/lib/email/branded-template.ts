// Public, always-on URL for the app's real logo — the same PWA icon used as
// the favicon/home-screen icon everywhere else (public/icon-192.png).
// Hardcoded rather than derived from the request, same reasoning as
// Heirloom's branded-template.ts (this app's sibling): this template is
// composed server-side from an admin action, with no request/origin to
// derive a URL from, and email clients can't render inline SVG reliably or
// reach a preview/localhost URL — a real hosted URL is the only reliable way
// to put a logo in an email. Uses the raster PNG (not icon.svg) for the same
// client-compatibility reason.
const LOGO_URL = "https://specify-seven.vercel.app/icon-192.png";

/**
 * Reusable branded transactional email shell — centred, 600px wide, white
 * content card on Specify's pastel cream background, olive-green wordmark
 * header, matching src/app/globals.css's palette and manifest.ts's
 * background_color/theme_color. Every transactional email (invite,
 * account-removed) should render through this rather than hand-rolling its
 * own HTML, so the brand stays consistent as more email types arrive —
 * mirrors Heirloom's brandedEmailHtml (this app's sibling on the same
 * magenterprises.org sending domain), swapped to Specify's own colours,
 * logo, and sans-serif font (this app's actual UI font, Geist, isn't
 * available in email clients — a system sans-serif stack is the closest
 * reliable equivalent, unlike Heirloom's deliberate editorial serif).
 *
 * Table-based layout, not flexbox/grid: email clients' CSS support is
 * decades behind browsers — nested `<table>`s are still the only genuinely
 * reliable way to get consistent rendering across Gmail/Outlook/Apple Mail.
 *
 * `bodyHtml` is trusted, caller-composed HTML — callers are responsible for
 * escaping any user-supplied text they interpolate into it (see
 * `escapeHtml` below), same expectation as anywhere else in the app that
 * builds HTML server-side.
 *
 * `previewText` becomes a hidden preheader — the snippet inbox list views
 * show after the subject line. Padded with non-breaking/zero-width
 * characters so a client that doesn't fully hide it doesn't show a run of
 * trailing whitespace instead.
 */
export function brandedEmailHtml({
  heading,
  bodyHtml,
  footerNote,
  previewText,
}: {
  heading: string;
  bodyHtml: string;
  footerNote?: string;
  previewText?: string;
}): string {
  const preheader = escapeHtml(previewText ?? heading);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#faf9f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      ${preheader}${"&#8199;&zwnj;&nbsp;".repeat(40)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
            <tr>
              <td style="background:#4c6429;padding:28px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:14px;vertical-align:middle;">
                      <img src="${LOGO_URL}" width="40" height="40" alt="" style="display:block;border-radius:10px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#faf9f0;font-size:24px;font-weight:700;">Specify</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;color:#3a4d1e;font-size:22px;font-weight:700;">${escapeHtml(heading)}</h1>
                <div style="color:#2a2e20;font-size:16px;line-height:1.6;">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#faf9f0;color:#6b7355;font-size:13px;">
                ${escapeHtml(footerNote ?? "Specify — learn your plants.")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Exported for callers building bodyHtml themselves (e.g. interpolating a
 * user-supplied name/email) — see this function's own doc comment above on
 * the escaping contract. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
