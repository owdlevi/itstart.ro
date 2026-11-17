import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each test builds its own PGlite database and applies every migration
    // (createTestDb), which can take most of vitest's default 5 s on CI's
    // runner; a test with two databases went over it.
    testTimeout: 20_000,
  },
});
