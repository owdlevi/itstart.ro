# Does Better Auth cover ITStart's sign-in rules?

Type: research
Status: resolved

## Question

Confirm Better Auth (current stable) against HANDOVER §6 screens 06–07, §11.1 and the domain model, citing its docs/source:

- Magic link valid **15 minutes, single use**; resend allowed after 30 s; the link e-mail is sent through our own Resend template.
- Google + GitHub OAuth; account linking when the same e-mail uses magic link and a provider.
- Works with Next.js 16 App Router (server components, server actions, middleware/proxy).
- Drizzle adapter: which tables it requires, and whether its `user` table can carry our fields (handle, avatarFill, isAgent, agentModel, role, remindersOptIn, city, bio, links, toolsInterest) or needs a separate profile table.
- Hooks for: "first sign-in → `/bun-venit`", "signed in from a challenge → also join it", return to the same page after sign-in (rule 12).
- A dev-only `GET /dev/login-as/<handle>` for design-fixtures mode (§9.1): can a session be minted for a user server-side?
- Agents are users that never sign in: any problem with users that have no account/credential rows?
- Rate limiting of magic-link sends, built in or not.

Verdict: fits / fits with workarounds (list them) / doesn't fit (name the alternative).

## Answer

Findings: [research/02-better-auth-fit.md](../research/02-better-auth-fit.md)

**Verdict: fits, with workarounds.** Better Auth 1.7.22 (stable, released 2026-11-12) covers magic link, Google, GitHub, account linking, the Next 16 proxy and server actions, Drizzle on Postgres, server-side session minting and agent users. Our installed next 16.3.8, drizzle-orm 0.45.4, drizzle-kit 0.31.11 and pg 8.23.1 are inside its supported ranges.

Workarounds we own:
- **Link lifetime:** the default is 5 minutes, so set `expiresIn: 900` for 15. Links are always single use. Sending a new link does not cancel the old one.
- **Link scanners:** the first open uses up the link, so mail scanners (e.g. Outlook Safe Links) can burn it before the person clicks. The e-mail links to our own confirm page with one button. An upstream fix (issue #9690, PR #9697) is still unreleased.
- **Rate limiting:**
  - Built-in limits count per IP and path, never per e-mail.
  - They skip server-side `auth.api` calls, so server actions aren't covered.
  - They are off in development.
  - Their default store is in memory, which doesn't work on Vercel.
  - The 30-second resend rule and any per-address limit are our code (see "Where do rate-limit counters live?").
- **Users table:** our product fields can live on Better Auth's `user` table. Every NOT NULL column it doesn't write needs a default, or startup throws `SchemaMismatchError`. Mark product fields `input: false` so clients can't set `role` or `isAgent`.
- **Linking side effect:** if a user's e-mail was never verified and they then use a magic link, all their provider links and sessions are deleted. Mark provider-verified e-mails as verified.
- **Dev login:** `/dev/login-as/<handle>` uses the `testUtils` plugin, never enabled in production.
- **Agents:** user rows with no account rows and an `.invalid` placeholder e-mail.
