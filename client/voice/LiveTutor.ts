import {
	ActivityHandling,
	EndSensitivity,
	FunctionCall,
	FunctionResponse,
	GoogleGenAI,
	LiveServerMessage,
	Modality,
	Session,
	StartSensitivity,
	Type,
} from '@google/genai'
import { atom } from 'tldraw'
import { LIVE_API_VERSION, LiveTokenResponse } from '../../shared/live'
import { $studyContext, getStudyExcerpt } from '../study/studyStore'
import { BoardBridge, BoardTask } from '../tutor/boardBridge'
import { getKeyHeaders } from '../tutor/keyStore'
import { MicCapture, PcmPlayer } from './audio'
import { EchoGate } from './echoGate'

const INTERRUPTIONS_PREF = 'ai-live-tutor:allow-interruptions'

function loadInterruptionsPref(): boolean {
	try {
		return localStorage.getItem(INTERRUPTIONS_PREF) !== 'false'
	} catch {
		return true
	}
}

/** Voice lifecycle logs. Shown in development so connection problems are easy to trace. */
function voiceLog(...args: unknown[]) {
	if (import.meta.env.DEV) console.warn('[voice]', ...args)
}

export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

export interface TranscriptEntry {
	id: number
	role: 'student' | 'tutor' | 'board'
	text: string
	final: boolean
}

const TOOLS = [
	{
		functionDeclarations: [
			{
				name: 'draw_on_whiteboard',
				description:
					'Draw a new diagram, chart, timeline, process or worked example on the shared whiteboard. Use this whenever a visual would help. Drawing takes several seconds and happens in the background, so keep talking while it draws.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						instruction: {
							type: Type.STRING,
							description:
								'Exactly what to draw, with the labels to use, e.g. "a labeled diagram of a plant cell with nucleus, mitochondria, chloroplast and cell wall".',
						},
					},
					required: ['instruction'],
				},
			},
			{
				name: 'edit_whiteboard',
				description:
					'Change what is already on the whiteboard: add labels, recolor, move, resize, extend or correct existing shapes. Use this when the student asks to modify the current diagram instead of drawing a new one.',
				parameters: {
					type: Type.OBJECT,
					properties: {
						instruction: {
							type: Type.STRING,
							description: 'The change to make, e.g. "make the mitochondria red and add an arrow to the nucleus".',
						},
					},
					required: ['instruction'],
				},
			},
			{
				name: 'look_at_whiteboard',
				description:
					'Get a description of every shape currently on the whiteboard, including what the student drew. Use it before talking about or editing the board.',
			},
			{
				name: 'stop_drawing',
				description: 'Stop the whiteboard drawing that is in progress.',
			},
		],
	},
]

function buildSystemInstruction() {
	const context = $studyContext.get()
	const material = getStudyExcerpt(20000)
	return `You are a warm, patient live tutor talking with a student by voice. You share an infinite whiteboard with them.

How to teach:
- Speak in short, natural sentences. Explain one idea at a time, then check understanding with a quick question.
- Use the whiteboard often: call draw_on_whiteboard for anything visual (diagrams, processes, graphs, worked steps).
- When the student asks to change the drawing ("make it bigger", "add the labels", "color that red"), call edit_whiteboard. Do not redraw from scratch.
- Call look_at_whiteboard before commenting on what is on the board or on the student's own drawing.
- Drawing runs in the background. After calling a whiteboard tool, keep explaining out loud; don't wait in silence.
- If the student interrupts, stop and respond to what they just said.
- Never delete or dismiss the student's own drawings.
${
	material
		? `\nThe student uploaded study material titled "${context?.title}". Ground your explanations, examples and diagram labels in it, and say so when something isn't covered by it.\n\n--- STUDY MATERIAL ---\n${material}\n--- END STUDY MATERIAL ---`
		: ''
}`
}

/**
 * A real-time voice session with Gemini Live, wired to the whiteboard agent.
 */
export class LiveTutor {
	readonly $status = atom<LiveStatus>('liveStatus', 'idle')
	readonly $transcript = atom<TranscriptEntry[]>('liveTranscript', [])
	readonly $micLevel = atom('micLevel', 0)
	readonly $error = atom<string | null>('liveError', null)
	readonly $muted = atom('liveMuted', false)
	/** Whether the student can talk over the tutor. Off = the tutor always finishes its sentence. */
	readonly $allowInterruptions = atom('allowInterruptions', loadInterruptionsPref())

	private session: Session | null = null
	private mic: MicCapture | null = null
	private player = new PcmPlayer()
	private nextEntryId = 1
	private statusTimer: ReturnType<typeof setInterval> | null = null
	private closedByUser = false

	private echoGate = new EchoGate({
		allowInterruptions: () => this.$allowInterruptions.get(),
		tutorSpeaking: () => this.player.isEchoLikely(),
	})

	constructor(private board: BoardBridge) {}

	setAllowInterruptions(allow: boolean) {
		this.$allowInterruptions.set(allow)
		try {
			localStorage.setItem(INTERRUPTIONS_PREF, String(allow))
		} catch {
			// preference just won't persist
		}
	}

	isActive() {
		const status = this.$status.get()
		return status !== 'idle' && status !== 'error'
	}

	async start() {
		voiceLog('start clicked, status =', this.$status.get())
		// A start that's stuck connecting can be retried; an active session can't be doubled
		if (this.$status.get() === 'listening' || this.$status.get() === 'speaking') return
		if (this.$status.get() === 'connecting') this.teardown()
		this.closedByUser = false
		this.loggedFirstAudio = false
		this.$error.set(null)
		this.$status.set('connecting')

		try {
			// Create both audio contexts now, while we're still inside the click.
			// Contexts created after the awaits below would start suspended.
			const playerReady = this.player.resume()
			this.mic = new MicCapture(
				(data, level) => {
					// Hold back echo of the tutor's own voice so it doesn't interrupt itself
					for (const chunk of this.echoGate.process(data, level)) {
						this.session?.sendRealtimeInput({ audio: { data: chunk, mimeType: 'audio/pcm;rate=16000' } })
					}
				},
				(level) => this.$micLevel.set(level)
			)
			this.mic.prepare()

			// Don't let a slow or missing audio device block the session from starting
			const audioState = await Promise.race([
				playerReady.then(() => 'running'),
				new Promise<string>((resolve) => setTimeout(() => resolve('still waiting'), 1500)),
			]).catch((e) => `error: ${e instanceof Error ? e.message : e}`)
			voiceLog('speaker audio', audioState, '; requesting session token')

			const res = await fetch('/live/token', { method: 'POST', headers: getKeyHeaders() })
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null
				throw new Error(body?.error ?? `Couldn't start a voice session (${res.status}).`)
			}
			const { token, model } = (await res.json()) as LiveTokenResponse
			voiceLog('token ok, connecting to', model)

			const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: LIVE_API_VERSION } })
			// connect() waits for Gemini's setupComplete. If setup is rejected the socket
			// just closes, so race it against the close/error callbacks and a timeout.
			let rejectSetup: (reason: Error) => void = () => {}
			const setupFailed = new Promise<never>((_, reject) => {
				rejectSetup = reject
			})
			const timeout = setTimeout(
				() => rejectSetup(new Error('Gemini Live did not respond. Check your connection and try again.')),
				20_000
			)
			const connecting = ai.live.connect({
				model,
				config: {
					responseModalities: [Modality.AUDIO],
					systemInstruction: buildSystemInstruction(),
					tools: TOOLS,
					inputAudioTranscription: {},
					outputAudioTranscription: {},
					speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
					realtimeInputConfig: {
						// Less eager voice detection: background noise shouldn't count as the student
						// talking, and short pauses while thinking shouldn't end their turn.
						automaticActivityDetection: {
							startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
							endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
							prefixPaddingMs: 200,
							silenceDurationMs: 800,
						},
						activityHandling: this.$allowInterruptions.get()
							? ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
							: ActivityHandling.NO_INTERRUPTION,
					},
				},
				callbacks: {
					onmessage: (message) => this.handleMessage(message),
					onerror: (e) => {
						const message = e.message || 'The voice connection failed.'
						rejectSetup(new Error(message))
						this.fail(message)
					},
					onclose: (e) => {
						voiceLog('socket closed', e.code, e.reason)
						if (this.closedByUser) return
						const message = e.reason ? `Voice session ended: ${e.reason}` : 'Voice session ended.'
						rejectSetup(new Error(message))
						this.fail(message)
					},
				},
			})
			try {
				this.session = await Promise.race([connecting, setupFailed])
			} finally {
				clearTimeout(timeout)
			}
			if (this.closedByUser) {
				this.session.close()
				return
			}

			if (!this.mic) return
			this.mic.muted = this.$muted.get()
			voiceLog('connected; starting microphone')
			await this.mic.start()
			voiceLog('microphone streaming')

			// Have the tutor speak first, so the student hears right away that voice works
			this.session.sendRealtimeInput({
				text: 'The student just joined. Greet them warmly in one short sentence and ask what they want to learn today.',
			})

			this.$status.set('listening')
			this.statusTimer = setInterval(() => {
				if (!this.isActive() || this.$status.get() === 'connecting') return
				this.$status.set(this.player.isPlaying() ? 'speaking' : 'listening')
			}, 150)
		} catch (e) {
			const message =
				e instanceof DOMException && e.name === 'NotAllowedError'
					? 'Microphone access was blocked. Allow the microphone in your browser and try again.'
					: e instanceof Error
						? e.message
						: 'Couldn’t start the voice session.'
			this.fail(message)
		}
	}

	stop() {
		this.closedByUser = true
		this.teardown()
		this.$status.set('idle')
	}

	setMuted(muted: boolean) {
		this.$muted.set(muted)
		if (this.mic) this.mic.muted = muted
		if (muted) this.session?.sendRealtimeInput({ audioStreamEnd: true })
	}

	/** Send a typed message into the live conversation. */
	sendText(text: string) {
		if (!this.session) return
		this.pushEntry('student', text, true)
		this.session.sendRealtimeInput({ text })
	}

	getOutputLevel() {
		return this.player.getLevel()
	}

	private fail(message: string) {
		voiceLog('failed:', message)
		this.teardown()
		this.$error.set(message)
		this.$status.set('error')
	}

	private teardown() {
		if (this.statusTimer) clearInterval(this.statusTimer)
		this.statusTimer = null
		this.mic?.stop()
		this.mic = null
		this.player.flush()
		const session = this.session
		this.session = null
		try {
			session?.close()
		} catch {
			// already closed
		}
		this.$micLevel.set(0)
		this.finalizeEntries()
	}

	private loggedFirstAudio = false

	private handleMessage(message: LiveServerMessage) {
		const content = message.serverContent
		if (!this.loggedFirstAudio && content?.modelTurn?.parts?.some((p) => p.inlineData?.data)) {
			this.loggedFirstAudio = true
			voiceLog('receiving tutor audio')
		}
		if (message.toolCall) voiceLog('tool call', message.toolCall.functionCalls?.map((c) => c.name))
		if (content) {
			// The student started talking over the tutor: drop queued audio immediately
			if (content.interrupted) {
				this.player.flush()
				this.finalizeEntries('tutor')
			}

			for (const part of content.modelTurn?.parts ?? []) {
				if (part.inlineData?.data) this.player.enqueue(part.inlineData.data)
			}

			if (content.inputTranscription?.text) {
				this.appendToEntry('student', content.inputTranscription.text)
			}
			if (content.outputTranscription?.text) {
				this.finalizeEntries('student')
				this.appendToEntry('tutor', content.outputTranscription.text)
			}
			if (content.turnComplete) this.finalizeEntries()
		}

		if (message.toolCall?.functionCalls?.length) {
			this.handleToolCalls(message.toolCall.functionCalls)
		}

		if (message.goAway) {
			this.pushEntry('board', 'The voice session is about to time out. Start a new one to keep going.', true)
		}
	}

	/** Run a whiteboard task and show its progress in the conversation. */
	async runBoardTask(task: BoardTask, instruction: string) {
		this.finalizeEntries()
		const entryId = this.pushEntry('board', `${task === 'edit' ? 'Editing' : 'Drawing'}: ${instruction}`, false)
		const outcome = await this.board.run(task, instruction)
		const text =
			outcome.status === 'done'
				? `Done — ${outcome.summary}`
				: outcome.status === 'cancelled'
					? `Stopped: ${instruction}`
					: outcome.summary
		this.updateEntry(entryId, text)
	}

	private handleToolCalls(calls: FunctionCall[]) {
		const responses: FunctionResponse[] = calls.map((call) => {
			const instruction = String((call.args as { instruction?: unknown })?.instruction ?? '').trim()
			let result: Record<string, unknown>

			switch (call.name) {
				case 'draw_on_whiteboard':
				case 'edit_whiteboard': {
					// The tutor can call look_at_whiteboard to see the result. We don't push a
					// message into the session when drawing ends: client content can pause the live turn.
					void this.runBoardTask(call.name === 'edit_whiteboard' ? 'edit' : 'draw', instruction)
					result = {
						status: 'started',
						note: 'The whiteboard is drawing this now in the background. Keep explaining while it draws.',
					}
					break
				}
				case 'look_at_whiteboard':
					result = {
						description: this.board.describe(),
						isDrawing: this.board.isBusy(),
					}
					break
				case 'stop_drawing':
					this.board.cancel()
					result = { status: 'stopped' }
					break
				default:
					result = { error: `Unknown tool ${call.name}` }
			}

			return { id: call.id, name: call.name, response: result }
		})

		this.session?.sendToolResponse({ functionResponses: responses })
	}

	// --- transcript helpers ---

	private appendToEntry(role: TranscriptEntry['role'], text: string) {
		const entries = this.$transcript.get()
		const last = entries[entries.length - 1]
		if (last && last.role === role && !last.final) {
			this.$transcript.set([...entries.slice(0, -1), { ...last, text: last.text + text }])
		} else {
			this.pushEntry(role, text.trimStart(), false)
		}
	}

	private pushEntry(role: TranscriptEntry['role'], text: string, final: boolean): number {
		const id = this.nextEntryId++
		this.$transcript.set([...this.$transcript.get(), { id, role, text, final }].slice(-200))
		return id
	}

	private updateEntry(id: number, text: string) {
		this.$transcript.set(this.$transcript.get().map((e) => (e.id === id ? { ...e, text, final: true } : e)))
	}

	private finalizeEntries(role?: TranscriptEntry['role']) {
		const entries = this.$transcript.get()
		if (!entries.some((e) => !e.final && e.role !== 'board' && (!role || e.role === role))) return
		this.$transcript.set(
			entries.map((e) => (!e.final && e.role !== 'board' && (!role || e.role === role) ? { ...e, final: true } : e))
		)
	}

	clearTranscript() {
		this.$transcript.set([])
	}
}
