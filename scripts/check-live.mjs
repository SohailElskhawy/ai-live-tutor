// Checks the real Gemini Live flow end to end, without a browser:
// Worker token route → Live connect → spoken reply → whiteboard tool call.
//
// Usage: GEMINI_API_KEY=... node scripts/check-live.mjs   (dev server must be running)
// or put GOOGLE_API_KEY=... in .dev.vars.
import { GoogleGenAI, Modality, Type } from '@google/genai'
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

function readKey() {
	if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
	try {
		const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
		return vars.match(/^GOOGLE_API_KEY=(.+)$/m)?.[1]?.trim()
	} catch {
		return undefined
	}
}

const key = readKey()
if (!key) {
	console.error('No key: set GEMINI_API_KEY or GOOGLE_API_KEY in .dev.vars')
	process.exit(1)
}

const step = (msg) => console.log(`• ${msg}`)

const res = await fetch(`${BASE}/live/token`, { method: 'POST', headers: { 'X-Gemini-Key': key } })
const body = await res.json()
if (!res.ok) {
	console.error(`✗ token route failed (${res.status}): ${body.error}`)
	process.exit(1)
}
step(`token ok, model = ${body.model}`)

const ai = new GoogleGenAI({ apiKey: body.token, httpOptions: { apiVersion: 'v1alpha' } })
let audioBytes = 0
let transcript = ''
let toolCall = null
let closed = null

const session = await Promise.race([
	ai.live.connect({
		model: body.model,
		config: {
			responseModalities: [Modality.AUDIO],
			outputAudioTranscription: {},
			systemInstruction: 'You are a tutor with a whiteboard. Use draw_on_whiteboard for anything visual.',
			tools: [
				{
					functionDeclarations: [
						{
							name: 'draw_on_whiteboard',
							description: 'Draw a diagram on the whiteboard.',
							parameters: {
								type: Type.OBJECT,
								properties: { instruction: { type: Type.STRING } },
								required: ['instruction'],
							},
						},
					],
				},
			],
		},
		callbacks: {
			onmessage: (m) => {
				for (const p of m.serverContent?.modelTurn?.parts ?? []) {
					if (p.inlineData?.data) audioBytes += Buffer.from(p.inlineData.data, 'base64').length
				}
				if (m.serverContent?.outputTranscription?.text) transcript += m.serverContent.outputTranscription.text
				if (m.toolCall) toolCall = m.toolCall
			},
			onerror: (e) => console.error('✗ socket error', e.message),
			onclose: (e) => (closed = `${e.code} ${e.reason}`),
		},
	}),
	new Promise((_, reject) => setTimeout(() => reject(new Error('setup timed out')), 20000)),
]).catch((e) => {
	console.error(`✗ connect failed: ${e.message}${closed ? ` (closed: ${closed})` : ''}`)
	process.exit(1)
})
step('connected (setupComplete)')

const waitFor = async (check, ms) => {
	const end = Date.now() + ms
	while (Date.now() < end && !check() && !closed) await new Promise((r) => setTimeout(r, 200))
	return check()
}

session.sendRealtimeInput({ text: 'Say hello in one short sentence.' })
if (await waitFor(() => audioBytes > 0 && transcript.length > 0, 20000)) {
	await waitFor(() => false, 1500)
	step(`spoken reply: ${(audioBytes / 48000).toFixed(1)}s of audio, "${transcript.trim()}"`)
} else {
	console.error(`✗ no audio reply${closed ? ` (closed: ${closed})` : ''}`)
	process.exit(1)
}

session.sendRealtimeInput({ text: 'Please draw a sine wave on the whiteboard.' })
if (await waitFor(() => toolCall, 20000)) {
	const call = toolCall.functionCalls[0]
	step(`tool call: ${call.name}(${JSON.stringify(call.args)})`)
	session.sendToolResponse({ functionResponses: [{ id: call.id, name: call.name, response: { status: 'started' } }] })
} else {
	console.error(`✗ no tool call${closed ? ` (closed: ${closed})` : ''}`)
	process.exit(1)
}

session.close()
console.log('✓ Gemini Live works end to end')
process.exit(0)
