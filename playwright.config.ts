import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

// Use a system Chromium when available (or PLAYWRIGHT_CHROMIUM_PATH); otherwise
// Playwright's own browser from `npx playwright install chromium`.
const chromiumPath =
	process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)

export default defineConfig({
	testDir: './tests',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:5173',
		viewport: { width: 1440, height: 900 },
		permissions: ['microphone'],
		launchOptions: {
			executablePath: chromiumPath,
			args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
		},
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'npm run dev -- --port 5173 --strictPort',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
})
