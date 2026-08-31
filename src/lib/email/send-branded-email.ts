import { createResendSender } from "./resend-sender";
import { brandedEmailHtml } from "./branded-template";
import type { EmailSender } from "./types";

let cachedSender: EmailSender | null = null;
function getSender(): EmailSender {
  if (!cachedSender) cachedSender = createResendSender();
  return cachedSender;
}

// why the one call site every transactional email should go through: wraps
// content in the branded template, then sends via the swappable
// EmailSender — same pattern as Heirloom's send-branded-email.ts.
export async function sendBrandedEmail(params: {
  to: string;
  subject: string;
  heading: string;
  bodyHtml: string;
  footerNote?: string;
  /** Inbox-list preview snippet — see brandedEmailHtml's own doc comment.
   * Defaults to `heading` if omitted. */
  previewText?: string;
}): Promise<void> {
  const html = brandedEmailHtml({
    heading: params.heading,
    bodyHtml: params.bodyHtml,
    footerNote: params.footerNote,
    previewText: params.previewText,
  });
  await getSender().send({ to: params.to, subject: params.subject, html });
}
