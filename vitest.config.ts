import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Tests for the parts of Expyr that are just logic.
 *
 * Deliberately not a React Native test setup. Rendering a screen in a fake
 * device costs a heavy toolchain and catches the class of bug we have never
 * actually had; every bug that has reached a phone came out of a pure function
 * — a month rolled to the wrong day, a date read as UTC and returned as
 * yesterday, a domain guessed from a title that was not a brand name. Those
 * need no device, so this runs in plain Node and stays fast enough to run on
 * every save.
 *
 * The rule that keeps it that way: anything imported here must not reach for
 * `react-native` or an `expo-*` native module. That is a constraint on where
 * logic lives, and a useful one — it is the same line the repository split in
 * `src/domain` draws.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    /*
     * The suite runs in the timezone the app is for, not the one the developer
     * happens to sit in. Every date bug this codebase has had was a UTC
     * conversion that only misbehaves east of London — running the tests in UTC
     * would have let all of them through.
     */
    env: { TZ: 'Asia/Dubai' },
    // A test that hangs is a broken test, not a slow one.
    testTimeout: 5_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
