# Research 02: Does Better Auth cover ITStart's sign-in rules?

**Verdict: fits with workarounds.** Better Auth 1.7.22 (current `latest` on npm, published 2026-11-12) covers magic link, Google, GitHub, account linking, Next.js 16 proxy and server actions, Drizzle on Postgres, server-side session minting and agent users. Nothing on the list forces a different library.
Seven things need configuration or app code, not forks: (1) `expiresIn: 900`; (2) the 30 s resend rule and per-address throttling are ours to build, because the built-in limiter keys on IP + path only and skips `auth.api` calls; (3) e-mail link scanners can burn the single-use link, so the e-mail should point at our own confirm page; (4) first sign-in, join-on-sign-in and return-to-page go through one app-owned "continue" route; (5) our `users` table needs the auth columns, and every extra NOT NULL column needs a default; (6) agents get `.invalid` placeholder e-mails; (7) `/dev/login-as` uses the `testUtils` plugin, or the same two internal calls it makes.

Versions checked: `better-auth@1.7.22`, `@better-auth/core@1.7.22`, `@better-auth/drizzle-adapter@1.7.22`. The repo's `next@16.3.8`, `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11` and `pg@8.23.1` all fall inside its peer ranges (`next ^14 || ^15 || ^16`, `drizzle-orm ^0.45.2`, `drizzle-kit >=0.31.4`, `pg ^8`) [npm-ba, npm-da]. A `1.8.0-beta.9` also exists. Everything below is pinned to 1.7.x; source links point at tag `v1.7.22`.

---

## 1. Magic link: 15 min, single use, resend after 30 s, our Resend template

| Requirement | Status | Evidence |
|---|---|---|
| Valid 15 minutes | **Config.** The default is 300 s; set `magicLink({ expiresIn: 900 })`. | Docs: "`expiresIn` … default value is `300` seconds" [doc-ml]. Source: `expiresAt: new Date(Date.now() + (opts.expiresIn \|\| 300) * 1e3)`, with expiry checked again at consume time (`consumed.expiresAt < new Date()` → null) [src-ml, src-ia]. |
| Single use | **Built in, not configurable.** | Docs: "Each verification call now consumes the token atomically on the first attempt … `allowedAttempts` … ignored" [doc-ml]. Source: `consumeVerificationValue` runs inside a transaction plus a lock [src-ml, src-ia]. |
| Sent through our own Resend template | **Built in.** | `sendMagicLink({ email, url, token, metadata }, ctx)` is our callback; Better Auth sends nothing itself [doc-ml]. `metadata` from the sign-in call is passed through to it, for example the challenge name for the e-mail eyebrow [doc-ml, src-ml]. |
| Resend enabled after 30 s | **Ours.** No such option exists. | The plugin has only `expiresIn`, `disableSignUp`, `rateLimit`, `generateToken`, `storeToken`, `sendMagicLink` [doc-ml]. The "Trimite din nou" timer is UI. Server-side enforcement is covered in §8. |

Points that matter for the build:

- **Resending does not revoke the earlier link.** Each request writes a new verification row keyed by its own token (`magic-link:<token>`), so every link sent stays valid until it expires or is used [src-ml]. The handover only says "single use", so this meets it. If we want "only the newest link works", we have to add that ourselves. Docs are silent on this.
- **E-mail link scanners (risk).** Verification is a `GET /magic-link/verify` that consumes the token on the first hit [src-ml]. A corporate scanner that pre-fetches URLs (for example Outlook Safe Links) would burn the link before the person clicks. Upstream tracks this as an open issue, and a `confirmationUrl` PR is still open, not released [gh-9690, gh-9697]. Workaround using documented API: in `sendMagicLink`, ignore `url` and send `https://itstart.ro/intra/confirma?token=…`. That page shows one "Intră în ITStart" button, which calls `auth.api.magicLinkVerify` / `authClient.magicLink.verify` with the token. Docs: "If you want to handle the verification manually (e.g, if you send the user a different URL), you can use the `verify` function" [doc-ml]. This also suits the "one action per e-mail" rule in §11.
- **Sign-up is automatic** unless `disableSignUp: true`. The new user is created with `emailVerified: true`, `name: name || ""` and **no `account` row** [doc-ml, src-ml]. Because the name is empty, screen 07 must ask for it, which it already does.
- **Errors** redirect to `errorCallbackURL` (or `callbackURL`) with `?error=INVALID_TOKEN` for expired or used tokens [doc-ml, src-ml]. `/intra` should show an "expired link" state for that code. The copy is not in the handover.
- **Storage:** tokens go in the `verification` table by default. Set `storeToken: "hashed"` so a database leak does not expose live links [doc-ml].

## 2. Google + GitHub OAuth, and linking with magic-link accounts

- **Providers:** both are first-party (`socialProviders.google`, `socialProviders.github`). Redirect URI `…/api/auth/callback/<provider>` [doc-google, doc-github]. GitHub asks for `read:user user:email` by default and reads `/user/emails` to find the verified address [src-gh, doc-oauth]. If we register a **GitHub App** rather than an OAuth App, it needs "Email addresses: Read-only", or sign-in fails with `email_not_found` [doc-github].
- **Linking is on by default.** "Account linking is enabled by default … if the provider confirms the user's email as verified" [doc-ua].
  - *Magic link first, then Google or GitHub with the same e-mail:* links implicitly. The provider must say the e-mail is verified (Google `email_verified`; GitHub's `verified` flag from `/user/emails`) [src-gh]. The local user must also have `emailVerified = true` (`requireLocalEmailVerified`, default `true`). Magic-link users always do [src-link, src-ml]. `requireLocalEmailVerified` appears in source only; the options reference does not document it [doc-options].
  - *Provider first, then a magic link to the same address:* the magic link finds the user by e-mail and signs them in [src-ml]. **Caveat:** if that user's `emailVerified` is `false` (a provider that reported the address unverified), `revokeUnprovenAccountAccess` deletes **all their `account` rows and sessions** before signing them in [src-revoke, doc-ml]. With Google and GitHub this only happens when the provider itself flagged the e-mail unverified. That is intended security behaviour, but expect it.
  - Optional: `trustedProviders: ["google","github"]` links even without the provider's verified flag. The docs warn this raises account-takeover risk [doc-ua]. **Recommendation:** leave it unset.
  - E-mail matching is case-insensitive: e-mails are lower-cased on create and on lookup [src-ia].
- **Prefilling the name** (screen 07): OAuth fills `user.name` from the provider profile [doc-oauth]. Use `mapProfileToUser` for extra fields. Fields marked `input: false` are ignored there [doc-oauth, doc-db].

## 3. Next.js 16 App Router

- **Route handler:** `app/api/auth/[...all]/route.ts` → `export const { GET, POST } = toNextJsHandler(auth)` [doc-next].
- **Server components:** `await auth.api.getSession({ headers: await headers() })`. RSCs cannot set cookies, so a cookie-cache refresh waits for the next action or route call [doc-next]. The `nextCookies` plugin detects RSC requests and skips the session refresh there [src-next].
- **Server actions:** add `nextCookies()` as the **last** plugin, so `auth.api.*` calls that set cookies (sign-out, verify) write them through `next/headers` [doc-next, src-next].
- **Proxy (Next 16):** documented. `proxy.ts` can call `auth.api.getSession` on the Node runtime, or do an optimistic `getSessionCookie(request)` check. The docs call the cookie-only check "NOT SECURE" and recommend checking per page [doc-next]. "Better Auth is fully compatible with Next.js 16" [doc-next].
- **Peer range** includes `next ^16.0.0` [npm-ba].
- **Not verified here:** previews on `*.vercel.app` need the host in `trustedOrigins`, and OAuth on previews needs either per-preview redirect URIs or the `oauth-proxy` plugin. Out of scope; flag for the environments ticket.

## 4. Drizzle adapter: required tables, and whether `user` can hold our fields

**Required tables** [doc-db, src-tables]:

| Table | Columns Better Auth writes |
|---|---|
| `user` | id, name, email (unique), emailVerified, image?, createdAt, updatedAt |
| `session` | id, expiresAt, token (unique), createdAt, updatedAt, ipAddress?, userAgent?, userId → user |
| `account` | id, accountId, providerId, userId → user, accessToken?, refreshToken?, idToken?, accessTokenExpiresAt?, refreshTokenExpiresAt?, scope?, password?, createdAt, updatedAt |
| `verification` | id, identifier, value, expiresAt, createdAt, updatedAt (holds the magic-link tokens) |
| `rateLimit` | key (unique), count, lastRequest. Only with `rateLimit.storage: "database"` (see §8) [doc-rl, src-tables] |

**Mapping onto our schema:**

- The adapter addresses each table **by its export key** and each column **by its Drizzle property name** [doc-drizzle, src-da-check]. Our `export const users` therefore needs `usePlural: true` (applies to every table: `users`, `sessions`, `accounts`, `verifications`, `rateLimits`), or `user: { modelName: "users" }` [doc-drizzle].
- Property names are what Better Auth sees, so our camelCase properties with `casing: "snake_case"` on the Drizzle client should be transparent. This is inferred from the property-name addressing; no Better Auth doc covers Drizzle `casing`. **Unconfirmed until a smoke test.**
- `image` can be renamed to our `avatarUrl` with `user.fields.image = "avatarUrl"` [doc-db].
- IDs: our `uuid().defaultRandom()` works. Set `advanced.database.generateId: "uuid"`; "adapters that use PostgreSQL … allow the database to generate the UUID" [doc-db].
- `email` is **required and unique** on every user [src-tables, doc-oauth]. That matters for agents (§7).

**Our fields can live on `users`; no separate profile table is needed.** There are two ways, and the second is the one that matters:

1. Declare them in `user.additionalFields`. Supported types: `"string" | "number" | "boolean" | "date" | "json" | "string[]" | "number[]"` or a literal-string array (enum). Options include `required` (**default `true`**), `input`, `returned`, `defaultValue` (a value **or a function**), `unique` and `index` [src-type, doc-db]. Suggested mapping:
   - `handle`: string, unique, `input:false`, `defaultValue: () => provisionalHandle()`
   - `avatarFill`: enum
   - `isAgent`: boolean, default false, `input:false`
   - `agentModel`: string?
   - `role`: `["member","admin"]`, default `member`, `input:false`
   - `remindersOptIn`: boolean, default false
   - `city`, `bio`: string?
   - `links`, `toolsInterest`: `string[]`
2. Columns we leave undeclared are allowed, but each **must be nullable or have a DB default**. The adapter's startup schema check flags any NOT NULL column that Better Auth never writes and throws `SchemaMismatchError`, "so every insert into `users` fails" [src-diff].

**Rules that follow:**

- Mark every product field `input: false` and write it with our own Drizzle code in the `/bun-venit` server action. Any field with `input: true` can be set by the client through Better Auth's `update-user` endpoint and by provider profile mapping [doc-db, doc-oauth]. That matters most for `role` and `isAgent`; the docs say so explicitly for roles.
- `handle` is "from the name", but magic-link users arrive with `name: ""` [src-ml]. Give `handle` a provisional default (function `defaultValue`, or a `databaseHooks.user.create.before` hook [doc-db]) and fix it on `/bun-venit`. Alternatively make it nullable until onboarding.
- Add an app-owned `onboardedAt timestamptz NULL`. §5 explains why.
- Better Auth's `admin` plugin would add its own `role` and ban columns. Its `create-admin` CLI creates a **password** user [doc-cli], which we do not use. **Recommendation:** skip the plugin and bootstrap the first admin by setting `role = 'admin'` in SQL or a seed (feeds the open "admin bootstrap" item in the map).

## 5. Hooks: first sign-in → `/bun-venit`, sign in from a challenge → also join, return to the same page (rule 12)

What Better Auth gives us:

- `callbackURL`, `newUserCallbackURL` and `errorCallbackURL` exist on **both** `signIn.magicLink` and `signIn.social` [doc-ml, src-signin]. The magic link sends a new user to `newUserCallbackURL`, everyone else to `callbackURL` [src-ml]. Callback URLs go through Better Auth's origin check, so relative paths on our own origin are fine [src-ml].
- `hooks.after` with `ctx.context.newSession`, and `databaseHooks.user.create.after`, are available for side effects [doc-hooks, doc-db].

**Recommendation: do not put product logic in auth hooks.** Point every sign-in at one app route, and pass the same value as both `callbackURL` and `newUserCallbackURL`:

```
/intra/continua?next=<same-page path>&provocare=<slug, only when started from a challenge>
```

That route handler:

1. Reads the session.
2. If `users.onboardedAt IS NULL`, redirects to `/bun-venit?next=…&provocare=…`.
3. Otherwise, if `provocare` is set, joins that challenge.
4. Redirects to `next`.

`/bun-venit` saves the profile, sets `onboardedAt`, does the join, and goes to screen 08.

- Base "first sign-in" on `onboardedAt`, not on Better Auth's `isNewUser`. Someone who closes the tab on step 2 must land on `/bun-venit` again next time, and `newUserCallbackURL` only fires on the request that creates the user [src-ml].
- Validate `next` as a same-origin relative path in our route. Tampering with `provocare` is harmless, because the user could join that challenge anyway.
- The `/intra` entry from the header button simply leaves `provocare` out.

## 6. Dev-only `GET /dev/login-as/<handle>` (design-fixtures mode)

**Yes, a session can be minted server-side.** Two options:

- **Documented:** the `testUtils()` plugin. `(await auth.$context).test.login({ userId })` returns `{ session, user, headers, cookies, token }`, and `getCookies({ userId, domain })` returns browser-ready cookies [doc-test]. It "does not register HTTP routes" but exposes privileged helpers. The docs recommend a separate test-only auth instance [doc-test].
  The route `app/dev/login-as/[handle]/route.ts`:
  1. Returns `404` unless `DESIGN_FIXTURES=1` and `NODE_ENV !== "production"`.
  2. Looks up the user by handle.
  3. Calls `test.login`.
  4. Copies the cookies onto a `NextResponse.redirect(next)`.
  5. For `anonymous`, calls `auth.api.signOut` (or deletes the cookie).
- **Under the hood** (source): `test.login` calls `ctx.internalAdapter.createSession(userId, …)` and signs the token as `value.signature` with the auth secret [src-test]. The magic-link verify does the same two steps (`createSession`, then `setSessionCookie`) [src-ml]. A tiny dev-only plugin endpoint could do the same thing if we would rather not ship `testUtils` code.
- Keep the route out of the production build: an env check plus a `notFound()` guard.
- **Unconfirmed:** how the frozen fixtures clock interacts with session `expiresAt`. Better Auth uses `Date.now()`/`new Date()` [src-ia]. If fixtures mode freezes the global `Date`, sessions get timestamps relative to 2026-11-11 and still work. Not tested.

## 7. Agents: users that never sign in

**No problem found.** Better Auth does not require `account` or `session` rows. Every magic-link user already exists without an `account` row (`createUser` with no account) [src-ml, src-ia]. What we need for agents:

- **E-mail is mandatory and unique** [src-tables, doc-oauth]. Give agents a placeholder such as `<handle>@agents.itstart.invalid`. The docs recommend a "domain you control or the reserved `.invalid` domain so no real inbox is ever addressed" [doc-oauth].
- **Keep `emailVerified = false` for agents.** OAuth implicit linking requires the local user to be verified (`requireLocalEmailVerified`, source only) [src-link]. No provider will vouch for an `.invalid` address either.
- **Refuse `.invalid` addresses in `sendMagicLink`** (throw). Otherwise a magic-link request for an agent's placeholder address would create a verification row and attempt a send. Nobody can receive it, but it is cleaner to refuse.
- Create agents with our own Drizzle insert (seed or admin), not through Better Auth endpoints. `isAgent` stays `input: false`.

## 8. Rate limiting of magic-link sends

**Built in, but too coarse for our rule:**

- **Default rule.** The magic-link plugin registers `{ window: 60, max: 5 }` for both `/sign-in/magic-link` and `/magic-link/verify`, configurable with `magicLink({ rateLimit })` [doc-ml, src-ml]. Plugin rules override the global sign-in rule of 3 per 10 s [src-rl].
- **Keyed by client IP + path, not by e-mail.** Key = `${ip}|${path}` [src-ip, src-rl]. "Better Auth counts requests per client IP address" [doc-rl]. Nothing stops one IP from hitting many different addresses (5/min), and nothing stops several IPs from hitting one address.
- **`auth.api` calls are not limited.** "Server-side requests made using `auth.api` aren't affected by rate limiting" [doc-rl]. In source the limiter runs only in the HTTP router's `onRequest` [src-api]. If `/intra` calls `auth.api.signInMagicLink` from a server action, the built-in limiter does nothing.
- **Off in development by default.** `enabled: options.rateLimit?.enabled ?? isProduction` [doc-rl, src-ctx].
- **Default storage is in-memory**, which "may not be suitable … particularly in serverless environments" [doc-rl]. On Vercel, set `rateLimit.storage: "database"`, which adds the `rateLimit` table and uses atomic increments [doc-rl, src-rl].
- **Client IP.** The default header is `x-forwarded-for`, and the IP is accepted only when the header holds exactly one address (or `trustedProxies` is set). Otherwise every client shares one bucket, and Better Auth logs a warning [src-ip, doc-rl]. Which header Vercel guarantees (`x-forwarded-for` vs `x-real-ip`/`x-vercel-forwarded-for`) was **not verified here**. Check it against Vercel's docs and set `advanced.ipAddress.ipAddressHeaders` to match.

**Recommendation:**

- Call sign-in through the HTTP endpoint (`authClient.signIn.magicLink` from the `/intra` form) so the IP limit applies, with database storage.
- Add a **per-address** limit inside `sendMagicLink`: one send per 30 s per address, mirroring the UI timer, plus an hourly cap. Throw an `APIError` before calling Resend. That limiter is ours (a Postgres table or the shared limiter the map lists as open). The `customRules` function hook cannot change the key, which is always IP + path [src-rl].

---

## Sources

- [npm-ba] npm registry, `better-auth` (dist-tags, `1.7.22` time, peerDependencies): https://registry.npmjs.org/better-auth
- [npm-da] npm registry, `@better-auth/drizzle-adapter@1.7.22` peerDependencies: https://registry.npmjs.org/@better-auth/drizzle-adapter
- [doc-ml] Magic link plugin: https://better-auth.com/docs/plugins/magic-link
- [doc-rl] Rate limit: https://better-auth.com/docs/concepts/rate-limit
- [doc-db] Database (core schema, additionalFields, ID generation, database hooks): https://better-auth.com/docs/concepts/database
- [doc-hooks] Hooks: https://better-auth.com/docs/concepts/hooks
- [doc-oauth] OAuth (sign-in, providers without e-mail, `mapProfileToUser`, server-owned fields): https://better-auth.com/docs/concepts/oauth
- [doc-ua] Users & accounts (account linking): https://better-auth.com/docs/concepts/users-accounts#account-linking
- [doc-options] Options reference (`accountLinking`): https://better-auth.com/docs/reference/options
- [doc-next] Next.js integration (RSC, server actions, `nextCookies`, Next 16 proxy): https://better-auth.com/docs/integrations/next
- [doc-drizzle] Drizzle adapter: https://better-auth.com/docs/adapters/drizzle
- [doc-test] Test Utils plugin: https://better-auth.com/docs/plugins/test-utils
- [doc-cli] CLI (`create-admin`): https://better-auth.com/docs/concepts/cli#create-admin
- [doc-google] Google provider: https://better-auth.com/docs/authentication/google
- [doc-github] GitHub provider: https://better-auth.com/docs/authentication/github
- [src-ml] Magic-link plugin source: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/plugins/magic-link/index.ts
- [src-ia] Internal adapter (`createUser`, `createSession`, `consumeVerificationValue`, e-mail lower-casing): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/db/internal-adapter.ts
- [src-revoke] `revokeUnprovenAccountAccess`: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/db/revoke-unproven-account-access.ts
- [src-link] OAuth linking (`handleOAuthUserInfo`, `requireLocalEmailVerified`): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/oauth2/link-account.ts
- [src-signin] `signIn.social` body (`callbackURL`, `newUserCallbackURL`, `errorCallbackURL`): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/api/routes/sign-in.ts
- [src-gh] GitHub provider (scopes, `emailVerified` from `/user/emails`): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/core/src/social-providers/github.ts
- [src-next] `nextCookies` / `toNextJsHandler`: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/integrations/next-js.ts
- [src-rl] Rate limiter: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/api/rate-limiter/index.ts
- [src-api] Router `onRequest` (where the limiter runs): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/api/index.ts
- [src-ctx] Rate-limit defaults (`enabled ?? isProduction`, storage): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/context/create-context.ts
- [src-ip] IP resolution and rate-limit key: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/core/src/utils/ip.ts
- [src-tables] Core tables: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/core/src/db/get-tables.ts
- [src-type] Field attribute types (`defaultValue` function, `unique`, `required` default true): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/core/src/db/type.ts
- [src-diff] Schema check (`unexpected-required-column`, `SchemaMismatchError`): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/core/src/db/schema-diff.ts
- [src-da-check] Drizzle adapter schema introspection (export key, property names): https://github.com/better-auth/better-auth/blob/v1.7.22/packages/drizzle-adapter/src/schema-check.ts
- [src-test] testUtils `login` → `createSession` + signed cookie: https://github.com/better-auth/better-auth/blob/v1.7.22/packages/better-auth/src/plugins/test-utils/auth-helpers.ts
- [gh-9690] Issue, magic-link consent page against URL scanners (open): https://github.com/better-auth/better-auth/issues/9690
- [gh-9697] PR, `confirmationUrl` option (open, unreleased): https://github.com/better-auth/better-auth/pull/9697

### Unconfirmed

- Drizzle `casing: "snake_case"` with the Better Auth adapter. Inferred to work from property-name addressing; needs a smoke test.
- Which client-IP header Vercel guarantees, for `ipAddressHeaders`.
- How a frozen global clock in fixtures mode interacts with session expiry.
- Whether the Drizzle adapter works against `@electric-sql/pglite` in `@repo/db/testing`. Not checked.
