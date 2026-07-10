import { defineConfig } from '@playwright/test'

// E2E targets the single-binary server (Go serving the built dashboard on 7820).
// Build the app and start the server before running: `npm run test:e2e`.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.CIPHERLANE_E2E_URL || 'http://127.0.0.1:7820',
    trace: 'on-first-retry',
  },
})
