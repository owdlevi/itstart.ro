# How do env vars and secrets flow?

Type: grilling
Status: resolved

## Question

How do env vars and secrets flow across Vercel, Neon branches and the local `.env.local` files? Where does each value live, and what gets committed?

## Answer

Decided with the owner on 2026-11-13:

- **Local:** each workspace that needs env vars has a gitignored `.env.local` (`apps/web`, `packages/db`, as in `docs/ARCHITECTURE.md`). A committed `.env.example` next to each lists every key, with no values. Never commit `.env*` files except the examples.
- **Deployed:** Vercel's project env holds the Production and Preview values (Resend key, Blob token, Better Auth secret, OAuth client IDs and secrets).
- **Database URLs:** Neon's Vercel integration injects the pooled `DATABASE_URL` and the unpooled URL for each preview branch (see "How do Neon, Drizzle and Vercel fit together?").
- **GitHub:** holds no app secrets. GitHub Actions gets only what CI itself needs (see "How do CI and deploys run?").
