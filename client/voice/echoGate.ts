/**
 * Decides which microphone chunks reach Gemini while the tutor is talking.
 *
 * Speakers leak the tutor's own voice (and room noise) into the mic. Gemini hears
 * that as the student starting to speak and cuts the tutor off. While the tutor is
 * talking we send silence instead, unless the student is clearly speaking over it:
 * louder than echo, for at least two chunks (~200ms) in a row.
 */

const CHUNK_SAMPLES = 1600
const SILENCE = btoa(String.fromCharCode(...new Uint8Array(CHUNK_SAMPLES * 2)))

/** Chunks needed above the threshold before the student counts as interrupting. */
const BARGE_IN_CHUNKS = 2
/** Recent chunks replayed when an interruption opens the gate, so the first words aren't lost. */
const PREFIX_CHUNKS = 3

export interface EchoGateOptions {
	/** Whether the student may talk over the tutor at all. */
	allowInterruptions: () => boolean
	/** Whether the tutor's audio may currently be reaching the mic. */
	tutorSpeaking: () => boolean
	/** RMS loudness (0–1) the student must exceed to interrupt. */
	threshold?: number
}

export class EchoGate {
	private loudStreak = 0
	private open = false
	private recent: string[] = []

	constructor(private options: EchoGateOptions) {}

	/** Returns the chunks to send for this mic chunk (possibly silence, possibly a replayed prefix). */
	process(chunk: string, level: number): string[] {
		if (!this.options.tutorSpeaking()) {
			this.reset()
			return [chunk]
		}

		if (!this.options.allowInterruptions()) {
			this.reset()
			return [SILENCE]
		}

		if (this.open) return [chunk]

		const threshold = this.options.threshold ?? 0.06
		this.recent = [...this.recent, chunk].slice(-PREFIX_CHUNKS)
		this.loudStreak = level > threshold ? this.loudStreak + 1 : 0

		if (this.loudStreak >= BARGE_IN_CHUNKS) {
			// The student is really talking: let it through, starting with what we held back
			this.open = true
			const prefix = this.recent
			this.recent = []
			return prefix
		}
		return [SILENCE]
	}

	private reset() {
		this.loudStreak = 0
		this.open = false
		this.recent = []
	}
}
