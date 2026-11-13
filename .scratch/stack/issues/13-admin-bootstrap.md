# How is an admin created?

Type: grilling
Status: resolved

## Question

`role` is a product field on the Better Auth `user` table, marked `input: false`. How does the first admin get `role = admin`, and how are later admins added or removed? Options: an `ADMIN_EMAILS` env list applied on sign-in, a one-off script against Neon, or an admin screen. Does the jury (HANDOVER §1: ITStart team + two guests) need a role of its own in M2?

## Answer

Decided with the owner on 2026-11-13:

- **Granting and removing admins: a one-off script.** Run `pnpm --filter @repo/db admin:set <email> admin|member` against the target database's unpooled URL. The person must have signed in once so their `users` row exists. The same command removes an admin.
  - No `ADMIN_EMAILS` env list: it would make two things hold the truth, the env and the column, and leave removal unclear.
- **No admin-management screen**, in M1 or M2. The admin area covers only what HANDOVER lists: challenge create/edit (M1), and recognitions and moderation (M2). Revisit if the team grows past a handful.
- **No jury role.** `role` stays `member | admin`. The jury (ITStart team + two guests) deliberates outside the product, and an admin enters its pick as the jury recognition. The jury composition is admin-editable text on each challenge (HANDOVER §13.6).
- **Removal takes effect on the next request.** Every admin check (the `admin` route group layout and each admin server action) reads `role` from the database on each request, never from Better Auth's cookie cache.
- **Seed:** the design fixtures and seed include one admin user, so `/dev/login-as/<handle>` can open the admin area locally and in previews. Neon preview branches copy production rows, so real admins carry over there too.
