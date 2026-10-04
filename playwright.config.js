import { defineConfig, devices } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { baseURL: 'http://127.0.0.1:5173/mes-comptes/', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: process.env.OFFLINE_E2E ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173 --strictPort' : 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173/mes-comptes/', reuseExistingServer: false },
})
