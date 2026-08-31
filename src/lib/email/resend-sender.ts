import { Resend } from "resend";
import type { EmailSender } from "./types";

// why this throws rather than silently no-op-ing when RESEND_API_KEY is
// absent: a caller (invite/delete in admin.ts) should fail loudly in server
// logs, not look like the notification email sent when it didn't — same
// reasoning as Heirloom's resend-sender.ts (this app's sibling, same
// magenterprises.org sending domain, provisioned via the Vercel Marketplace
// `resend/resend-email` integration).
export function createResendSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Specify <notifications@magenterprises.org>";

  return {
    async send({ to, subject, html }) {
      if (!apiKey) {
        throw new Error(
          "RESEND_API_KEY is not configured — provision the Resend Marketplace integration on this Vercel project, then retry.",
        );
      }
      const client = new Resend(apiKey);
      const { data, error } = await client.emails.send({ from, to, subject, html });
      if (error) {
        throw new Error(`Resend send failed: ${error.message}`);
      }
      return { id: data?.id ?? null };
    },
  };
}
