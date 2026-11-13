# 07 · Do Resend, Vercel Blob and sharp meet the M1 constraints?

Researched 2026-11-13 against vendor docs, the installed Next.js 16.3.8 docs (`apps/web/node_modules/next/dist/docs`), sharp 0.35.x docs and RFC 8058. Ticket: `../issues/07-resend-blob-constraints.md`. Every claim has a source in [Sources](#sources). Anything I could not confirm from a primary source is marked **UNCONFIRMED**.

## Verdict and recommended upload flow

**Verdict: yes, all three work for M1 on free tiers, with one design change and two caveats.**

- **Design change (uploads):** screenshots **cannot** go through a Server Action or Route Handler body. Vercel caps a function request body at **4.5 MB** [V-LIM], so even one 5 MB screenshot fails with `413 FUNCTION_PAYLOAD_TOO_LARGE`, and 2–4 of them certainly do. Raising Next's `serverActions.bodySizeLimit` (default 1 MB) [N-SA] does not lift Vercel's cap. Use **browser-direct upload to Blob**, then resize on the server by reading the blob back.
- **Caveat 1 (EU residency, Resend):** sending can run from `eu-west-1` (Ireland), but **Resend stores customer data in the US**. The EU region "does not control where data is stored" [R-GDPR]. Transfers are covered by a pre-signed DPA plus SCCs. This is legal, but it is not EU residency.
- **Caveat 2 (Resend free quota):** **100 e-mails/day** (UTC day) and 3,000/month. Over the quota the API returns `429` and Resend "doesn't queue or retry" [R-QUOTA]. A 7-day reminder to about 100 participants, plus sign-in links on the same day, can exceed 100. The send job must spread reminders across days or batch them, or the plan needs a paid tier.
- Vercel Blob in `fra1`, public store, fits the Hobby allowance with a wide margin. sharp needs no extra config on Vercel with pnpm 11.
- Side note: Vercel's Hobby plan is "for your personal or non-commercial use" [V-TOS]. This is fine while ITStart is non-commercial. Revisit if sponsorship or paid features arrive.

**Recommended upload flow (screen 09)**

1. **Store:** one **public** Blob store created in **`fra1`**. You choose the region at creation and cannot change it later [V-BLOB].
2. **Client (Lansează form):** check type (png/jpg/webp) and size (≤ 5 MB) on selection for fast feedback. Then call `uploadPresigned()` (or `upload()`) from `@vercel/blob/client`, one call per file, to a temporary path such as `tmp/<userId>/<random>.<ext>` [V-SIGN][V-CU].
3. **Token route** (`app/api/uploads/screenshot/route.ts`, a Route Handler, not a Server Action): `handleUploadPresigned` (works with OIDC, so no long-lived token) or `handleUpload` (needs `BLOB_READ_WRITE_TOKEN`) [V-CU][V-SIGN]. **Authenticate the user in the callback.** Enforce `allowedContentTypes: ['image/png','image/jpeg','image/webp']`, `maximumSizeInBytes: 5 * 1024 * 1024` and `addRandomSuffix: true`. Blob enforces these server-side [V-SIGN]. Optionally set `ttlDays: 1` so abandoned originals expire. A TTL costs one extra advanced op [V-PRICE].
4. **Submit** ("Lansează proiectul" / "Salvează ciorna" Server Action): send only the **blob pathnames and their order**, a few hundred bytes, well under the 1 MB action limit. The action checks that each pathname sits under `tmp/<session.userId>/`, reads each blob, and uses sharp to `.rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 })`, plus a thumbnail for the first image. It then `put()`s them to `projects/<projectId>/<n>.webp`, `del()`s the originals (deletes are free [V-PRICE]), and saves the URLs in Postgres in one transaction. This keeps "resize server-side" (§6 screen 09) without relying on the `onUploadCompleted` webhook, which does not reach localhost [V-CU].
5. **Render** the stored `.webp` with `next/image` using `unoptimized`, or add a `remotePatterns` entry and accept Vercel Image Optimization (Hobby: 5,000 transformations/month [V-HOBBY]). Pre-resized webp makes `unoptimized` reasonable.

## Resend

| Bullet | Finding | Source |
|---|---|---|
| EU sending region | Regions: `us-east-1`, **`eu-west-1` (Ireland)**, `sa-east-1`, `ap-northeast-1`. You choose the region **per domain when adding it**. To change it, delete the domain, add it again and update DNS. The page names no plan restriction. | [R-REG] |
| EU data storage | **Does not meet the EU-residency preference.** "Resend stores customer data in the United States". The EU region affects sending, not storage. A GDPR Art. 28 DPA is pre-signed for every account. EEA transfers use SCCs, and Resend also takes part in the EU-US DPF. | [R-GDPR] |
| One-click unsubscribe | Resend has no automatic header for API (transactional) sends. Add both headers yourself through the `headers` object on `emails.send`: `List-Unsubscribe: <https://itstart.ro/api/dezabonare?t=…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Resend's guide: the POST must return a blank 200/202, a GET shows a normal page, and unsubscribes must take effect within 48 h. Gmail/Yahoo require RFC 8058 above 5,000/day, so ITStart is below that, but §11 requires it anyway. | [R-UNSUB][R-SEND] |
| RFC 8058 rules for the endpoint | The header must contain **one HTTPS URI**. The POST body is `List-Unsubscribe=One-Click`. The POST carries **no cookies or auth**, so the URL itself must carry a signed, opaque token. The sender **must not redirect**. Both headers must be **covered by the DKIM signature**. | [RFC8058 §3.1, §3.2, §4] |
| DKIM covers custom headers? | **UNCONFIRMED.** Resend's docs do not say whether its DKIM signature includes `List-Unsubscribe` and `List-Unsubscribe-Post`. Check by sending a test to Gmail and reading the `h=` tag in `DKIM-Signature` under "Show original". | n/a |
| React Email + Romanian diacritics | React Email's `<Html>` takes `lang` (set `lang="ro"`, and the same on `<Body>`, because some clients strip `html`/`body`). The docs **do not say** whether the render adds a UTF-8 charset meta tag or how non-ASCII is encoded. **UNCONFIRMED.** Mitigation: add `<meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />` in `<Head>` and test ă/â/î/ș/ț (comma-below) in Gmail, Outlook and Apple Mail before M1. Also send a `text` part. `react` on `emails.send` is Node SDK only. | [RE-HTML][RE-HEAD][R-SEND] |
| Free tier | **3,000 e-mails/month, 100/day** (UTC calendar day, resets at midnight UTC). Each To/CC/BCC recipient counts separately. Received e-mails count too. Over quota: `429 daily_quota_exceeded` / `monthly_quota_exceeded`, **not queued or retried**. **3 domains** on Free. 30-day data retention. API rate limit **10 req/s per team** on every plan. | [R-PRICE][R-QUOTA][R-RATE] |
| Volume check | §11 load for ~100 builders: sign-in links (bursty), reminders at 7 d and 1 d (each up to ~100 recipients on the same day), review notifications (max 1/project/hour), and review-assignment nudges. The monthly total is far below 3,000, but a **reminder day plus normal traffic can cross 100/day**. The reminder job must split sends across hours or days, or the account must upgrade before the first challenge deadline. Use the `Idempotency-Key` header (24 h, ≤ 256 chars) so job retries do not double-send. | [R-QUOTA][R-SEND] |
| No-reply sender, real reply-to | Any address on a verified domain can be the `from` without creating it first, e.g. `ITStart <nu-raspunde@mail.itstart.ro>`. Resend nonetheless recommends addresses that can receive replies. Set `reply_to: 'salut@itstart.ro'` (string or array). | [R-SENDER][R-SEND] |
| Domain setup | Resend recommends sending from a **subdomain** (e.g. `mail.itstart.ro`) to isolate reputation. DNS records: `MX send` → Resend's feedback SMTP host (priority 10), `TXT send` → `v=spf1 include:amazonses.com ~all`, `TXT resend._domainkey` → DKIM key. Receiving MX only if you want inbound. Add DMARC after verification (Resend recommends it, gives no policy). A custom Return-Path subdomain is possible. **Pick `eu-west-1` at domain creation**, because changing it later means re-adding the domain. | [R-DOM][R-CF] |

## Vercel Blob

| Bullet | Finding | Source |
|---|---|---|
| EU region | A store lives in **one region you choose at creation**, from any of the 19 compute regions, which include **`fra1` (eu-central-1, Frankfurt)**. The region **cannot be changed**. Pricing is regional. The CDN caches blobs globally (up to 1 month by default). | [V-BLOB][V-REG] |
| Public vs private | Access mode is per **store** and **cannot be changed** after creation. Public: anyone with the URL can read, served directly from the CDN, cheaper Blob Data Transfer. Private: every read needs auth and goes through your Function (or a signed URL), paying Fast Data Transfer on the Function response. Screenshots are shown publicly on launch boards, so use **public with `addRandomSuffix`** (unguessable URLs). Search engines can still index linked blobs. Optionally upload a `robots.txt` to the store and turn on the store firewall against hotlinking. | [V-BLOB][V-PRICE][V-PUB] |
| Drafts | A draft's screenshots on a public store are readable by anyone who has the random URL. **Open product question** for §13: acceptable for M1? Otherwise use a second private store for drafts and copy on launch. | [V-BLOB] |
| Free tier (Hobby) | **1 GB** storage (monthly average), **10,000 simple ops**, **2,000 advanced ops** (uploads, copies, lists, TTL, store creation, dashboard browsing), **10 GB** Blob Data Transfer. Rate limits: 900 advanced/min, 1,200 simple/min. Max file 5 TB. **Over a Hobby limit, Blob is blocked until 30 days pass** (no charge). Client uploads incur no upload transfer charge. Server uploads incur Fast Data Transfer. | [V-PRICE] |
| Volume check | 50 launches × 4 images × (1 client upload + 2 server `put`s for full and thumb + 1 TTL op) ≈ **800 advanced ops/month**, under 2,000 but not by a huge margin. Edits, re-uploads and **dashboard browsing** count too, so drop the TTL op or the thumbnail if it gets close. Storage at ~300 KB × 5 files × 50 = ~75 MB/month, so 1 GB lasts about a year. **Estimate, not measured.** | [V-PRICE][V-BLOB] |
| Auth | Connected projects use OIDC by default (`BLOB_STORE_ID`, auto-rotated `VERCEL_OIDC_TOKEN`). `handleUpload` additionally needs the long-lived `BLOB_READ_WRITE_TOKEN`. `handleUploadPresigned` does not (it uses OIDC plus `BLOB_WEBHOOK_PUBLIC_KEY`). | [V-BLOB][V-CU][V-SIGN] |

## Uploads: body limits and direct-to-Blob

| Bullet | Finding | Source |
|---|---|---|
| Next 16.3.8 Server Action default body limit | **1 MB**, applied to the raw request body including `multipart/form-data` overhead (allow 10–20 KB extra). | [N-SA][N-SAG] |
| How to raise it | `next.config.ts` → `experimental: { serverActions: { bodySizeLimit: '25mb' } }` (bytes or a `bytes` string). Note that in 16.3.8 this still sits under `experimental`. | [N-SA] |
| `proxy.ts` | If a `proxy.ts` (ex-middleware) runs on the route, Next buffers the body up to `experimental.proxyClientMaxBodySize`, **default 10 MB**. Irrelevant with direct upload. | [N-PROXY] |
| Vercel Function request-size limit | **4.5 MB** for request or (non-streamed) response body. Above it, `413 FUNCTION_PAYLOAD_TOO_LARGE`. This applies to Server Actions too, because they run as Functions, so `bodySizeLimit` above 4.5 MB is pointless on Vercel. | [V-LIM] |
| Is direct upload better? | **Yes, and required.** Vercel's own guidance is client uploads for anything over 4.5 MB: "The file goes directly from the browser to Vercel Blob, secured by a token exchange". It also removes the upload Fast Data Transfer charge. The token route **must** authenticate the user, or anyone can upload. Content type and size limits are enforced by Blob, not just the browser. | [V-CU][V-SIGN][V-PRICE] |
| `onUploadCompleted` | Called by Vercel Blob via webhook. Does **not** work on localhost without a tunnel (`VERCEL_BLOB_CALLBACK_URL`). Retries up to 5× on 5xx/429, none on 400. That is why the recommended flow does the resize in the submit action instead. | [V-CU] |
| Function budget for the resize | Hobby functions: **2 GB / 1 vCPU**, max duration **300 s**. | [V-LIM] |

## sharp on Vercel with pnpm

| Bullet | Finding | Source |
|---|---|---|
| Installs without extra config? | **Yes, as far as the docs and the installed package show.** sharp ships prebuilt binaries for **Linux x64 (glibc ≥ 2.28)** as optional `@img/sharp-*` packages, and needs Node ≥ 20.9.0 (repo requires ≥ 24). The package manager must install optional dependencies (pnpm does by default). The installed `sharp@0.35.4` has **no `install`/`postinstall` script** (checked `package.json`), so pnpm 11's `allowBuilds` / `strictDepBuilds` gate does not apply. `supportedArchitectures` only matters if you install on macOS and ship that `node_modules` to Linux. Vercel installs on Linux, so it does not. | [S-INST][P-BUILD]; local `node_modules/.pnpm/sharp@0.35.4…/package.json` |
| Next.js bundling | `sharp` is on Next's built-in `serverExternalPackages` list, so it is loaded with native `require`, not bundled. No config needed. `next@16.3.8` also lists `sharp ^0.35.4` as an optional dependency. Add `sharp` as a direct dependency of `apps/web` anyway, because code that imports it should declare it. | [N-SEP]; local `next/package.json` |
| Vercel-specific doc | sharp's docs do not mention Vercel. The AWS Lambda notes (linux binaries in `node_modules`, more memory gives more CPU) are the closest analogue. Vercel Functions run on AWS Lambda infrastructure. **UNCONFIRMED** that nothing else is needed. Prove it with one preview deploy early in M1. | [S-INST][V-LIM] |
| Memory for a 5 MB image | **Estimate, UNCONFIRMED by measurement.** A 5 MB PNG/JPEG screenshot is typically 3–15 MP. Fully decoded RGBA that is ~12–60 MB, and libvips streams rather than holding several full copies, so peak RSS is likely around 100–200 MB, far under 2 GB. JPEG/WebP use shrink-on-load (`fastShrinkOnLoad` default true), which lowers it further. Set `limitInputPixels` (default 268,402,689 px) lower, e.g. 50 MP, to reject decompression bombs. On glibc Linux sharp defaults to concurrency 1 to limit fragmentation. Process the 2–4 images sequentially. | [S-CTOR][S-RESIZE][S-PERF][S-UTIL] |
| Time for a 5 MB image | **Estimate, UNCONFIRMED.** sharp's benchmark (resize to 720×588: JPEG input ~89 ops/s, PNG input ~47 ops/s, on a 4-vCPU AMD EPYC, cache off) puts one image at tens of ms. Scaled to 1 vCPU, larger inputs and webp encoding, expect roughly 0.1–1 s per image, or a few seconds for 4 including Blob reads and writes. That is well under the 300 s cap. Add a cold start for loading libvips. Measure on a preview deploy. | [S-PERF][V-LIM] |

## Constraints that break or change an existing choice

1. **Server Action file upload (implied by "resized server-side")**: broken by Vercel's 4.5 MB body cap. Switch to direct-to-Blob, then resize in the action [V-LIM][N-SA].
2. **"EU data residency" for e-mail**: Resend only sends from the EU and stores data in the US [R-GDPR]. Record this as an accepted exception (DPA + SCCs), or evaluate an EU-hosted provider. Not evaluated here.
3. **Resend Free 100/day** vs. reminder bursts: the reminder job needs spreading or batching, or a paid plan before the first deadline [R-QUOTA].
4. Not a break, but note: Vercel Hobby is non-commercial only [V-TOS], and exceeding a Blob Hobby limit blocks Blob for 30 days [V-PRICE].

## Sources

- [N-SA] Next.js 16.3.8 `serverActions` config (installed docs `01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`): https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions
- [N-SAG] Next.js Server Actions guide (installed `01-app/02-guides/server-actions.md`): https://nextjs.org/docs/app/guides/server-actions
- [N-PROXY] Next.js `proxyClientMaxBodySize` (installed `…/proxyClientMaxBodySize.md`): https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize
- [N-SEP] Next.js `serverExternalPackages` (installed `…/serverExternalPackages.md`): https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
- [V-LIM] Vercel Functions limits: https://vercel.com/docs/functions/limitations
- [V-BLOB] Vercel Blob overview: https://vercel.com/docs/vercel-blob
- [V-CU] Vercel Blob client uploads: https://vercel.com/docs/vercel-blob/client-upload
- [V-SIGN] Vercel Blob signed URLs and presigned uploads: https://vercel.com/docs/vercel-blob/vercel-signed-urls
- [V-PRICE] Vercel Blob pricing and limits: https://vercel.com/docs/vercel-blob/usage-and-pricing
- [V-PUB] Vercel Blob public storage: https://vercel.com/docs/vercel-blob/public-storage
- [V-REG] Vercel regions: https://vercel.com/docs/regions
- [V-HOBBY] Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- [V-TOS] Vercel Terms of Service §4 Hobby Plan: https://vercel.com/legal/terms
- [R-REG] Resend regions: https://resend.com/docs/dashboard/domains/regions
- [R-GDPR] Resend GDPR: https://resend.com/security/gdpr
- [R-UNSUB] Resend, add unsubscribe to transactional e-mails: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
- [R-SEND] Resend send-email API: https://resend.com/docs/api-reference/emails/send-email
- [R-PRICE] Resend pricing: https://resend.com/pricing
- [R-QUOTA] Resend account quotas and limits: https://resend.com/docs/knowledge-base/account-quotas-and-limits
- [R-RATE] Resend rate limit: https://resend.com/docs/api-reference/rate-limit
- [R-SENDER] Resend sender addresses: https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend
- [R-DOM] Resend domains: https://resend.com/docs/dashboard/domains/introduction
- [R-CF] Resend DNS records (Cloudflare guide): https://resend.com/docs/knowledge-base/cloudflare
- [RE-HTML] React Email `Html`: https://react.email/docs/components/html
- [RE-HEAD] React Email `Head`: https://react.email/docs/components/head
- [RFC8058] RFC 8058, Signaling One-Click Functionality for List Email Headers: https://www.rfc-editor.org/rfc/rfc8058.html
- [S-INST] sharp installation: https://sharp.pixelplumbing.com/install
- [S-PERF] sharp performance: https://sharp.pixelplumbing.com/performance
- [S-CTOR] sharp constructor (`limitInputPixels`): https://sharp.pixelplumbing.com/api-constructor
- [S-RESIZE] sharp resize (`fastShrinkOnLoad`, `withoutEnlargement`): https://sharp.pixelplumbing.com/api-resize
- [S-UTIL] sharp utilities (`concurrency`, `cache`): https://sharp.pixelplumbing.com/api-utility
- [P-BUILD] pnpm build settings (`allowBuilds`, `strictDepBuilds`): https://pnpm.io/settings/build
