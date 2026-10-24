/**
 * Audio helpers for the Gemini Live API.
 *
 * Live expects 16 kHz, 16-bit little-endian mono PCM in and sends 24 kHz PCM out.
 */

const INPUT_SAMPLE_RATE = 16000
const OUTPUT_SAMPLE_RATE = 24000

// Runs on the audio thread: downsamples to 16 kHz, converts Float32 to Int16 and posts ~100ms chunks.
// Resampling here (instead of a 16 kHz AudioContext) works in every browser, including Firefox.
const CAPTURE_WORKLET = `
const TARGET_RATE = ${INPUT_SAMPLE_RATE}
class PcmCapture extends AudioWorkletProcessor {
	constructor() {
		super()
		this.ratio = sampleRate / TARGET_RATE
		this.buffer = new Int16Array(1600)
		this.offset = 0
		this.acc = 0
		this.sum = 0
		this.count = 0
	}
	process(inputs) {
		const channel = inputs[0] && inputs[0][0]
		if (!channel) return true
		let energy = 0
		for (let i = 0; i < channel.length; i++) {
			const x = channel[i]
			energy += x * x
			this.sum += x
			this.count++
			this.acc += 1
			if (this.acc < this.ratio) continue
			this.acc -= this.ratio
			const s = Math.max(-1, Math.min(1, this.sum / this.count))
			this.sum = 0
			this.count = 0
			this.buffer[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
			if (this.offset === this.buffer.length) {
				this.port.postMessage({ pcm: this.buffer.buffer, level: Math.sqrt(energy / (i + 1)) }, [this.buffer.buffer])
				this.buffer = new Int16Array(1600)
				this.offset = 0
			}
		}
		return true
	}
}
registerProcessor('pcm-capture', PcmCapture)
`

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	const chunk = 0x8000
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
	}
	return btoa(binary)
}

function base64ToInt16(base64: string): Int16Array {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2))
}

/** Captures the microphone as 16 kHz PCM chunks. */
export class MicCapture {
	private context: AudioContext | null = null
	private stream: MediaStream | null = null
	private node: AudioWorkletNode | null = null
	muted = false

	constructor(
		private onChunk: (base64Pcm: string) => void,
		private onLevel: (level: number) => void = () => {}
	) {}

	/**
	 * Create the audio context. Call this synchronously inside the click handler:
	 * browsers keep contexts created later (after awaits) suspended, which silently
	 * stops the microphone from sending audio.
	 */
	prepare() {
		// Use the device's native rate; the worklet downsamples to 16 kHz
		this.context ??= new AudioContext()
		void this.context.resume()
	}

	async start() {
		this.prepare()
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
		})
		if (!this.context) throw new Error('Microphone was stopped.')
		await this.context.resume()
		const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'application/javascript' }))
		try {
			await this.context.audioWorklet.addModule(url)
		} finally {
			URL.revokeObjectURL(url)
		}
		if (!this.context) throw new Error('Microphone was stopped.')
		const source = this.context.createMediaStreamSource(this.stream)
		this.node = new AudioWorkletNode(this.context, 'pcm-capture')
		this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
			if (this.muted) {
				this.onLevel(0)
				return
			}
			this.onLevel(e.data.level)
			this.onChunk(arrayBufferToBase64(e.data.pcm))
		}
		source.connect(this.node)
	}

	stop() {
		this.node?.port.close()
		this.node?.disconnect()
		this.stream?.getTracks().forEach((t) => t.stop())
		void this.context?.close()
		this.node = null
		this.stream = null
		this.context = null
	}
}

/** Plays 24 kHz PCM chunks back to back, and can stop instantly on interruption. */
export class PcmPlayer {
	private context: AudioContext | null = null
	private analyser: AnalyserNode | null = null
	private nextStartTime = 0
	private sources = new Set<AudioBufferSourceNode>()

	private ensureContext() {
		if (!this.context) {
			this.context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
			this.analyser = this.context.createAnalyser()
			this.analyser.fftSize = 256
			this.analyser.connect(this.context.destination)
		}
		return this.context
	}

	/** Must be called from a user gesture so the browser allows playback. */
	resume() {
		return this.ensureContext().resume()
	}

	enqueue(base64Pcm: string) {
		const context = this.ensureContext()
		const pcm = base64ToInt16(base64Pcm)
		if (pcm.length === 0) return
		const buffer = context.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE)
		const channel = buffer.getChannelData(0)
		for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000

		const source = context.createBufferSource()
		source.buffer = buffer
		source.connect(this.analyser!)
		const startAt = Math.max(context.currentTime + 0.02, this.nextStartTime)
		source.start(startAt)
		this.nextStartTime = startAt + buffer.duration
		this.sources.add(source)
		source.onended = () => this.sources.delete(source)
	}

	/** Stop everything that is playing or queued. Used when the student interrupts. */
	flush() {
		for (const source of this.sources) {
			try {
				source.stop()
			} catch {
				// already stopped
			}
		}
		this.sources.clear()
		this.nextStartTime = 0
	}

	isPlaying() {
		return this.sources.size > 0
	}

	/** Current output loudness from 0 to 1, for the speaking indicator. */
	getLevel(): number {
		if (!this.analyser || this.sources.size === 0) return 0
		const data = new Uint8Array(this.analyser.fftSize)
		this.analyser.getByteTimeDomainData(data)
		let sum = 0
		for (const v of data) {
			const s = (v - 128) / 128
			sum += s * s
		}
		return Math.sqrt(sum / data.length)
	}

	close() {
		this.flush()
		void this.context?.close()
		this.context = null
		this.analyser = null
	}
}
