import {
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { createAuth } from "@/server/auth";

// Sign-in goes through Better Auth's HTTP endpoints from the browser, so its
// per-IP rate limit applies. magicLinkClient is ready for when magic link is
// turned back on (DECISIONS, "Email and password for now").
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<ReturnType<typeof createAuth>>(),
    magicLinkClient(),
  ],
});
