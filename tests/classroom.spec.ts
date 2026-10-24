import { expect, Page, test, WebSocketRoute } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * End-to-end tests for AI Live Tutor.
 *
 * Gemini is mocked at the network edge (Live WebSocket, /stream, /study) so the
 * full app, Worker routing and tldraw agent run for real without a paid key.
 * One test talks to the real Worker with an invalid key to check error handling.
 */

const TEST_KEY = 'AIzaTestKeyForEndToEnd00001234'
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

// Fail any test that throws an uncaught error in the page
test.beforeEach(async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (e) => errors.push(e.message))
	;(page as any).__errors = errors
})

test.afterEach(async ({ page }) => {
	expect((page as any).__errors as string[]).toEqual([])
})

async function enterKey(page: Page) {
	await page.goto('/')
	await page.evaluate(() => localStorage.clear())
	await page.reload()
	await page.getByLabel('Gemini API key').fill(TEST_KEY)
	await page.getByRole('button', { name: 'Start learning' }).click()
	await expect(page.getByRole('dialog')).toBeHidden()
}

function sse(actions: object[]) {
	return actions.map((a) => `data: ${JSON.stringify({ ...a, complete: true, time: 0 })}\n\n`).join('')
}

/** Answer each /stream request with the next scripted list of agent actions. */
async function mockAgent(page: Page, script: object[][]) {
	const requests: { headers: Record<string, string>; body: string }[] = []
	await page.route('**/stream', async (route) => {
		const req = route.request()
		requests.push({ headers: req.headers(), body: req.postData() ?? '' })
		const actions = script.shift() ?? [{ _type: 'message', text: 'Done.' }]
		await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body: sse(actions) })
	})
	return requests
}

function getShapes(page: Page) {
	return page.evaluate(() => {
		const editor = (window as any).editor
		return editor.getCurrentPageShapes().map((s: any) => ({
			id: s.id as string,
			type: s.type as string,
			color: s.props.color as string,
			author: s.meta?.author as string | undefined,
			text: editor.getShapeUtil(s).getText(s) as string | undefined,
		}))
	})
}

const createCell = {
	_type: 'create',
	intent: 'Draw the cell',
	shape: { _type: 'rectangle', shapeId: 'cell', x: 100, y: 100, w: 240, h: 160, color: 'blue', fill: 'none', note: 'cell', text: 'Plant cell' },
}

test.describe('key handling', () => {
	test('asks for a key, validates it, and keeps it out of storage', async ({ page }) => {
		await page.goto('/')
		await page.evaluate(() => localStorage.clear())
		await page.reload()

		const dialog = page.getByRole('dialog')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByRole('heading', { name: 'Welcome to AI Live Tutor' })).toBeVisible()

		await page.getByRole('button', { name: 'Start learning' }).click()
		await expect(page.getByText('Paste your Gemini API key to continue.')).toBeVisible()

		await page.getByLabel('Gemini API key').fill('short')
		await page.getByRole('button', { name: 'Start learning' }).click()
		await expect(page.getByText(/looks too short/)).toBeVisible()

		await page.getByLabel('Gemini API key').fill(TEST_KEY)
		await page.getByRole('button', { name: 'Start learning' }).click()
		await expect(dialog).toBeHidden()
		await expect(page.getByRole('button', { name: 'Key ••••1234' })).toBeVisible()

		// Let autosave run, then make sure the key never reached browser storage
		await page.waitForTimeout(1500)
		const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
		expect(stored).not.toContain(TEST_KEY)

		// Reload clears the in-memory key
		await page.reload()
		await expect(page.getByRole('dialog')).toBeVisible()
	})
})

test.describe('whiteboard agent', () => {
	test('draws, then edits the same diagram, and never deletes student drawings', async ({ page }) => {
		const requests = await mockAgent(page, [
			[createCell, { _type: 'message', text: 'I drew a plant cell.' }],
			[
				{
					_type: 'update',
					intent: 'Make the cell green',
					update: { ...createCell.shape, color: 'green' },
				},
				// A misbehaving model tries to delete the student's drawing
				{ _type: 'delete', intent: 'Clean up', shapeId: 'studentnote' },
			],
		])
		await enterKey(page)

		// A student drawing that must survive
		await page.evaluate(() => {
			const editor = (window as any).editor
			editor.createShape({ id: 'shape:studentnote', type: 'geo', x: 600, y: 100, props: { w: 100, h: 80 } })
		})

		await page.getByLabel('Ask the whiteboard to draw something').fill('Draw a plant cell')
		await page.getByRole('button', { name: 'Send' }).click()

		await expect.poll(async () => (await getShapes(page)).find((s) => s.text === 'Plant cell')?.color).toBe('blue')
		await expect(page.getByText(/Done — I drew a plant cell/)).toBeVisible()

		// The student's key travels in a header, never in the prompt body
		expect(requests[0].headers['x-gemini-key']).toBe(TEST_KEY)
		expect(requests[0].body).not.toContain(TEST_KEY)

		await page.getByLabel('Ask the whiteboard to draw something').fill('Make it green')
		await page.getByRole('button', { name: 'Send' }).click()

		await expect.poll(async () => (await getShapes(page)).find((s) => s.text === 'Plant cell')?.color).toBe('green')
		const shapes = await getShapes(page)
		expect(shapes.filter((s) => s.text === 'Plant cell')).toHaveLength(1) // edited, not redrawn
		const student = shapes.find((s) => s.id === 'shape:studentnote')
		expect(student?.author).toBe('student')
	})

	test('shows a friendly error when the key is rejected', async ({ page }) => {
		// Real Worker, real Google call, fake key
		await enterKey(page)
		await page.getByLabel('Ask the whiteboard to draw something').fill('Draw a triangle')
		await page.getByRole('button', { name: 'Send' }).click()
		await expect(page.getByText("That Gemini API key isn't valid. Check it and enter it again.").first()).toBeVisible({
			timeout: 30_000,
		})
	})
})

test.describe('voice tutor', () => {
	test('talks, draws through a tool call, handles interruption, then edits on request', async ({ page }) => {
		await mockAgent(page, [
			[createCell, { _type: 'message', text: 'Drew the cell.' }],
			[{ _type: 'update', intent: 'Label', update: { ...createCell.shape, text: 'Plant cell (labeled)' } }],
		])
		await page.route('**/live/token', (route) =>
			route.fulfill({ json: { token: 'auth_tokens/test-token', model: 'gemini-3.8-live', expiresAt: new Date().toISOString() } })
		)

		let live: WebSocketRoute | null = null
		let setup: any = null
		const toolResponses: any[] = []
		let audioChunks = 0
		let lastAudio: { data: string; mimeType: string } | null = null
		await page.routeWebSocket(/BidiGenerateContent/, (ws) => {
			live = ws
			ws.onMessage((raw) => {
				const msg = JSON.parse(String(raw))
				if (msg.setup) {
					setup = msg.setup
					ws.send(JSON.stringify({ setupComplete: {} }))
				}
				if (msg.toolResponse) toolResponses.push(...msg.toolResponse.functionResponses)
				if (msg.realtimeInput?.audio) {
					audioChunks++
					lastAudio = msg.realtimeInput.audio
				}
			})
		})

		await enterKey(page)

		// Upload study material first so it reaches the voice tutor's instructions
		await page.getByRole('tab', { name: 'Study' }).click()
		await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'photosynthesis.pdf'))
		await expect(page.locator('.cr-doc-title')).toHaveText('photosynthesis')
		await page.getByRole('tab', { name: 'Tutor' }).click()

		await page.getByRole('button', { name: 'Start talking' }).click()
		await expect(page.getByRole('status').filter({ hasText: 'Listening' })).toBeVisible()
		await expect(page.locator('.cr-live-pill')).toBeVisible()

		// The session is set up with audio, our tools, and the PDF content
		expect(setup.model).toContain('gemini-3.8-live')
		const tools = setup.tools[0].functionDeclarations.map((f: any) => f.name)
		expect(tools).toEqual(['draw_on_whiteboard', 'edit_whiteboard', 'look_at_whiteboard', 'stop_drawing'])
		expect(JSON.stringify(setup.systemInstruction)).toContain('Calvin cycle')

		// Microphone audio is streaming to Gemini
		await expect.poll(() => audioChunks).toBeGreaterThan(3)
		// 100ms chunks of 16 kHz, 16-bit mono PCM
		expect(lastAudio!.mimeType).toBe('audio/pcm;rate=16000')
		expect(Buffer.from(lastAudio!.data, 'base64').length).toBe(3200)

		// Student speaks, tutor answers and calls the drawing tool
		live!.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Can you show me a plant cell?' } } }))
		live!.send(JSON.stringify({ serverContent: { outputTranscription: { text: 'Sure, let me draw one.' } } }))
		live!.send(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: silentPcm(0.5) } }] } } }))
		live!.send(
			JSON.stringify({
				toolCall: { functionCalls: [{ id: 'call-1', name: 'draw_on_whiteboard', args: { instruction: 'a labeled plant cell' } }] },
			})
		)

		await expect(page.getByText('Can you show me a plant cell?')).toBeVisible()
		await expect(page.getByText('Sure, let me draw one.')).toBeVisible()
		await expect.poll(() => toolResponses.find((r) => r.id === 'call-1')?.response?.status).toBe('started')
		await expect.poll(async () => (await getShapes(page)).some((s) => s.text === 'Plant cell')).toBe(true)
		await page.screenshot({ path: 'test-results/voice-live.png' })

		// Student interrupts: queued tutor audio must stop at once
		live!.send(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: silentPcm(5) } }] } } }))
		await expect(page.getByRole('status').filter({ hasText: 'Tutor is speaking' })).toBeVisible()
		live!.send(JSON.stringify({ serverContent: { interrupted: true } }))
		await expect(page.getByRole('status').filter({ hasText: 'Listening' })).toBeVisible()

		// ...and asks for a change, which edits the existing diagram
		live!.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Wait, add a label to it' } } }))
		live!.send(
			JSON.stringify({
				toolCall: { functionCalls: [{ id: 'call-2', name: 'edit_whiteboard', args: { instruction: 'add a label' } }] },
			})
		)
		await expect.poll(async () => (await getShapes(page)).map((s) => s.text)).toContain('Plant cell (labeled)')
		expect((await getShapes(page)).filter((s) => s.text?.startsWith('Plant cell'))).toHaveLength(1)

		// The tutor can look at the board
		live!.send(JSON.stringify({ toolCall: { functionCalls: [{ id: 'call-3', name: 'look_at_whiteboard', args: {} }] } }))
		await expect
			.poll(() => toolResponses.find((r) => r.id === 'call-3')?.response?.description ?? '')
			.toContain('Plant cell (labeled)')

		await page.getByRole('button', { name: 'End session' }).click()
		await expect(page.getByRole('button', { name: 'Start talking' })).toBeVisible()
	})

	test('explains a failed token request', async ({ page }) => {
		await enterKey(page) // real Worker, fake key
		await page.getByRole('button', { name: 'Start talking' }).click()
		await expect(page.getByRole('alert').filter({ hasText: "That Gemini API key isn't valid" })).toBeVisible({ timeout: 30_000 })
		await expect(page.getByRole('button', { name: 'Reconnect' })).toBeVisible()
	})
})

test.describe('study tools', () => {
	test('reads a PDF and builds an MCQ quiz and flashcards from it', async ({ page }) => {
		const studyBodies: any[] = []
		await page.route('**/study', async (route) => {
			const body = JSON.parse(route.request().postData() ?? '{}')
			studyBodies.push({ body, key: route.request().headers()['x-gemini-key'] })
			if (body.kind === 'quiz') {
				await route.fulfill({
					json: {
						kind: 'quiz',
						title: 'Photosynthesis check',
						questions: [
							{ question: 'Where does the Calvin cycle happen?', options: ['Stroma', 'Thylakoid', 'Nucleus', 'Cell wall'], answerIndex: 0, explanation: 'The Calvin cycle runs in the stroma.' },
							{ question: 'What gas is released?', options: ['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Hydrogen'], answerIndex: 1, explanation: 'Splitting water releases oxygen.' },
						],
					},
				})
			} else {
				await route.fulfill({
					json: {
						kind: 'flashcards',
						title: 'Photosynthesis terms',
						cards: [
							{ front: 'Chlorophyll', back: 'Green pigment that absorbs light' },
							{ front: 'Stroma', back: 'Where the Calvin cycle happens' },
						],
					},
				})
			}
		})

		await enterKey(page)
		await page.getByRole('button', { name: /Upload a PDF so the tutor teaches from it/ }).click()
		await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'photosynthesis.pdf'))
		await expect(page.locator('.cr-doc-title')).toHaveText('photosynthesis')
		await expect(page.getByText(/1 page/)).toBeVisible()

		await page.getByRole('button', { name: 'Generate quiz' }).click()
		await expect(page.getByRole('heading', { name: 'Photosynthesis check' })).toBeVisible()
		expect(studyBodies[0].body.text).toContain('Calvin cycle happens in the stroma')
		expect(studyBodies[0].key).toBe(TEST_KEY)

		const q1 = page.getByRole('group', { name: /Calvin cycle/ })
		await q1.getByRole('button', { name: /Stroma/ }).click()
		await expect(q1.getByText('Correct.')).toBeVisible()
		const q2 = page.getByRole('group', { name: /What gas/ })
		await q2.getByRole('button', { name: /Nitrogen/ }).click()
		await expect(q2.getByText('Not quite.')).toBeVisible()
		await expect(page.getByText('Score: 1 / 2')).toBeVisible()
		await page.screenshot({ path: 'test-results/study-quiz.png' })

		await page.getByRole('button', { name: 'Make flashcards' }).click()
		await expect(page.getByRole('heading', { name: 'Photosynthesis terms' })).toBeVisible()
		const card = page.getByRole('button', { name: /Question: Chlorophyll/ })
		await card.click()
		await expect(page.getByRole('button', { name: /Answer: Green pigment/ })).toBeVisible()
		await page.waitForTimeout(500)
		await page.screenshot({ path: 'test-results/study-flashcards.png' })
		await page.getByRole('button', { name: 'Next card' }).click()
		await expect(page.getByText('Card 2 of 2')).toBeVisible()
		await expect(page.getByRole('button', { name: /Question: Stroma/ })).toBeVisible()
	})

	test('rejects PDFs without readable text', async ({ page }) => {
		await enterKey(page)
		await page.getByRole('tab', { name: 'Study' }).click()
		await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'no-text.pdf'))
		await expect(page.getByRole('alert')).toContainText('No readable text found')
		await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'empty.pdf'))
		await expect(page.getByRole('alert')).toContainText('Couldn’t open that PDF')
	})

	test('real Worker turns a bad key into a clear study error', async ({ page }) => {
		await enterKey(page)
		await page.getByRole('tab', { name: 'Study' }).click()
		await page.locator('input[type=file]').setInputFiles(path.join(FIXTURES, 'photosynthesis.pdf'))
		await page.getByRole('button', { name: 'Generate quiz' }).click()
		await expect(page.getByRole('alert')).toContainText("That Gemini API key isn't valid", { timeout: 30_000 })
	})
})

test.describe('layout', () => {
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 768, height: 1024 },
		{ width: 375, height: 812 },
	]) {
		test(`has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
			await page.setViewportSize(viewport)
			await enterKey(page)
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
			expect(overflow).toBeLessThanOrEqual(0)
			await expect(page.getByRole('button', { name: 'Start talking' })).toBeInViewport()
			await page.screenshot({ path: `test-results/layout-${viewport.width}.png` })
		})
	}
})

/** Base64 of `seconds` of silent 24 kHz 16-bit PCM. */
function silentPcm(seconds: number) {
	return Buffer.alloc(Math.round(24000 * seconds) * 2).toString('base64')
}
