import { defineConfig } from '@playwright/test'

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
			executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium',
			args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
		},
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'npm run dev -- --port 5173 --strictPort',
		url: 'http://localhost:5173',
		reuseExistingServer: true,
		timeout: 120_000,
	},
})
