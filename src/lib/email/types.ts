// why an interface, not calling Resend directly everywhere: the same
// swappable-provider pattern as the RHS scraper's PlantRecord shape — a
// disappointing provider gets swapped behind resend-sender.ts, not rewritten
// around at every call site. Mirrors Heirloom's lib/email module (this app's
// sibling on the same magenterprises.org sending domain).

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export type EmailSender = {
  send(message: EmailMessage): Promise<{ id: string | null }>;
};
