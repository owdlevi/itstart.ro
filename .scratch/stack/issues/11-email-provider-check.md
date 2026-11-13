# Is Resend acceptable for e-mail?

Type: grilling
Status: resolved

## Question

The upload/e-mail research found that Resend sends from `eu-west-1` but stores customer data in the US (DPA + SCCs), and that its free plan allows 100 e-mails/day with over-quota sends dropped. A reminder day (§11.2) plus sign-in links can exceed that. Do we accept Resend as an exception to the EU-residency posture, on a paid plan from the first deadline? Or switch to an EU-resident provider (e.g. AWS SES `eu-central-1`, Scaleway TEM, Brevo), which would then need its own fact check for one-click unsubscribe and templating?

Input from "Choose the job runner": the owner tightened the EU rule. Use an EU option wherever one exists; a US processor only when none exists, recorded with the reason. EU-resident e-mail providers exist, so Resend now needs a reason to stay.

## Answer

Decided with the owner on 2026-11-13: **keep Resend, on the Pro plan, as a recorded exception to the EU-residency rule.**

- **Plan:** Resend **Pro**, $20/month: 50,000 e-mails/month, **no daily limit**. This removes the free plan's 100/day cap, so reminder bursts don't need spreading across days. Resend is the **one extra paid vendor** for M1.
- **Sending region:** `eu-west-1` (Ireland), chosen when the domain is added (`mail.itstart.ro`). Changing it later means re-adding the domain.
- **Data note (the exception):**
  - Resend stores customer data **in the United States**: recipient addresses, message content, delivery logs.
  - Its GDPR page (fetched 2026-11-13): "The region you select when adding a sending domain (for example, `eu-west-1`) controls where email is routed and sent from. It does not control where data is stored, and there is no setting today that moves stored data to the EU." No plan offers EU storage.
  - **Legal basis:** Resend's pre-signed GDPR Art. 28 DPA, Standard Contractual Clauses, and the EU-US Data Privacy Framework.
  - **Why accepted although EU providers exist:** the owner chose Resend's developer experience and React Email integration over switching.
  - **Consequences:**
    - Record it in `docs/DECISIONS.md` as an EU-rule exception.
    - The privacy policy (Confidențialitate) must name Resend as a US processor of e-mail data.
    - Keep e-mail content minimal: links and short excerpts, never full reviews.
    - Revisit if Resend adds EU storage.
- **Still to verify with one test send** (from "Do Resend, Vercel Blob and sharp meet the M1 constraints?"): DKIM covers the `List-Unsubscribe` headers; Romanian diacritics render correctly in Gmail, Outlook and Apple Mail.
