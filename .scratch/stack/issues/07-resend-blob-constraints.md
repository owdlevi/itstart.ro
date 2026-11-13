# Do Resend, Vercel Blob and sharp meet the M1 constraints?

Type: research
Status: resolved

## Question

Using vendor and Next.js docs:

- **Resend:** EU sending region; one-click unsubscribe (`List-Unsubscribe` + `List-Unsubscribe-Post`) for reminder e-mails (§11); React Email with Romanian diacritics; free-tier limits; domain setup for a no-reply sender with a real reply-to.
- **Vercel Blob:** EU region choice; public vs private blobs for project screenshots; free-tier limits.
- **Uploads:** 2–4 images up to 5 MB each. Next.js server actions have a default body size limit: what is it, how to raise it, and is client-side direct upload to Blob (with a server token) better? Vercel's function request-size limit.
- **sharp** on Vercel functions with pnpm: does it install and run without extra configuration? Resizing to webp: memory and time for a 5 MB image.

## Answer

Findings: [research/07-resend-blob-constraints.md](../research/07-resend-blob-constraints.md)

- **Uploads cannot go through a server action.** Vercel caps a function request body at 4.5 MB, so one 5 MB screenshot already fails (413). Next 16.3.8's server-action limit (1 MB default) can be raised, but that doesn't help.
- **Upload flow for M1:** one public Vercel Blob store in `fra1` with random-suffix URLs → the browser uploads each file directly to Blob through a token route that checks the session and enforces png/jpg/webp ≤ 5 MB → the launch server action receives only blob paths and verifies the user owns them → sharp resizes each to webp, stores the result, deletes the original.
- **sharp** installs and runs on Vercel with pnpm 11 without extra config. Memory and time per 5 MB image are estimated well under limits; confirm on a preview deploy.
- **Resend problems** (taken to the "Is Resend acceptable for e-mail?" ticket):
  - It sends from `eu-west-1` but stores customer data in the US under a DPA + SCCs. That breaks the EU-residency posture.
  - The free plan allows 100 e-mails/day, and over-quota sends are dropped, not queued.
- **Unconfirmed, needs one test send:** whether DKIM covers the `List-Unsubscribe` headers, and how React Email encodes Romanian diacritics.
