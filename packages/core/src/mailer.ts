// The mailer seam. Core decides what to send; the adapter renders and delivers
// it (Resend + React Email in production).

export type Email = { kind: "sign_in_link"; to: string; url: string };

export type Mailer = {
  send(email: Email): Promise<void>;
};

/** Keeps every e-mail in `sent`. For tests, and for local dev until the Resend adapter exists. */
export function createMemoryMailer(): Mailer & { sent: Email[] } {
  const sent: Email[] = [];
  return {
    sent,
    send: async (email) => {
      sent.push(email);
    },
  };
}
