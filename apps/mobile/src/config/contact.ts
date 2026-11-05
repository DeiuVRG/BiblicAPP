// Where mail from the interface goes (docs/ui-spec-v2.md, OQ-10): feedback in P1 is a mail link,
// the form comes in P2. The address is a public value (it is on the page); until the owner gives
// one the link opens a new message without a recipient.

/** The feedback and report inbox: `EXPO_PUBLIC_FEEDBACK_EMAIL`, inlined by Metro at build time. */
export const FEEDBACK_EMAIL: string = process.env.EXPO_PUBLIC_FEEDBACK_EMAIL ?? '';

/** A `mailto:` link to the feedback inbox with a subject (and, optionally, a body). */
export function mailtoHref(
  subject: string,
  body?: string,
  address: string = FEEDBACK_EMAIL,
): string {
  const query = [`subject=${encodeURIComponent(subject)}`];
  if (body) query.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${address}?${query.join('&')}`;
}
