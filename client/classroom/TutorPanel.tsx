import { FormEvent, useEffect, useRef, useState } from 'react'
import { useValue } from 'tldraw'
import { $studyContext } from '../study/studyStore'
import { useClassroom } from './ClassroomContext'
import { MicIcon, MicOffIcon, PencilIcon, PhoneOffIcon, SendIcon, SparklesIcon } from './icons'

const SUGGESTIONS = [
	'Explain how photosynthesis works, with a diagram',
	'Draw the water cycle and walk me through it',
	'Show me how to solve 2x + 3 = 11 step by step',
]

const STATUS_LABEL = {
	idle: 'Ready when you are',
	connecting: 'Connecting…',
	listening: 'Listening',
	speaking: 'Tutor is speaking',
	error: 'Voice session stopped',
} as const

export function TutorPanel({ onOpenStudy }: { onOpenStudy: () => void }) {
	const { tutor, board } = useClassroom()
	const status = useValue('status', () => tutor.$status.get(), [tutor])
	const error = useValue('error', () => tutor.$error.get(), [tutor])
	const muted = useValue('muted', () => tutor.$muted.get(), [tutor])
	const allowInterruptions = useValue('allowInterruptions', () => tutor.$allowInterruptions.get(), [tutor])
	const transcript = useValue('transcript', () => tutor.$transcript.get(), [tutor])
	const isDrawing = useValue('isDrawing', () => board.isBusy(), [board])
	const study = useValue('study', () => $studyContext.get(), [])
	const [draft, setDraft] = useState('')

	const live = status === 'listening' || status === 'speaking'
	const orbRef = useAudioLevel(live)
	const logRef = useRef<HTMLOListElement>(null)

	useEffect(() => {
		const log = logRef.current
		if (log) log.scrollTop = log.scrollHeight
	}, [transcript])

	const ask = (text: string) => {
		const message = text.trim()
		if (!message) return
		if (live) tutor.sendText(message)
		// Without a voice session, typed requests go straight to the whiteboard
		else void tutor.runBoardTask('draw', message)
	}

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		ask(draft)
		setDraft('')
	}

	return (
		<section className="cr-tutor" aria-label="Voice tutor">
			<div className={`cr-voice cr-voice-${status}`}>
				<div className="cr-orb-wrap">
					<button
						ref={orbRef}
						type="button"
						className="cr-orb"
						onClick={() => (live ? tutor.setMuted(!muted) : status !== 'connecting' && void tutor.start())}
						disabled={status === 'connecting'}
						aria-pressed={live ? !muted : undefined}
						aria-label={
							live ? (muted ? 'Unmute microphone' : 'Mute microphone') : 'Start a voice session'
						}
					>
						{status === 'connecting' ? (
							<span className="cr-spinner" aria-hidden="true" />
						) : live && muted ? (
							<MicOffIcon width={32} height={32} />
						) : (
							<MicIcon width={32} height={32} />
						)}
					</button>
				</div>

				<p className="cr-voice-status" role="status" aria-atomic="true">
					<span className="cr-status-dot" aria-hidden="true" />
					{live && muted ? 'Microphone muted' : STATUS_LABEL[status]}
				</p>
				<p className="cr-voice-hint">
					{!live
						? 'Start a session and ask anything out loud. Your tutor will draw as it explains.'
						: allowInterruptions
							? 'Just talk. Speak up to interrupt, e.g. “make that arrow red”.'
							: 'Just talk. The tutor finishes each answer before listening.'}
				</p>

				{live ? (
					<div className="cr-voice-actions">
						<button type="button" className="cr-button cr-button-secondary" onClick={() => tutor.setMuted(!muted)}>
							{muted ? <MicIcon /> : <MicOffIcon />}
							{muted ? 'Unmute' : 'Mute'}
						</button>
						<button type="button" className="cr-button cr-button-danger" onClick={() => tutor.stop()}>
							<PhoneOffIcon />
							End session
						</button>
					</div>
				) : (
					<button
						type="button"
						className="cr-button cr-button-primary"
						onClick={() => void tutor.start()}
						disabled={status === 'connecting'}
					>
						<MicIcon />
						{status === 'connecting' ? 'Connecting…' : status === 'error' ? 'Reconnect' : 'Start talking'}
					</button>
				)}

				<label className="cr-switch">
					<input
						type="checkbox"
						role="switch"
						checked={allowInterruptions}
						onChange={(e) => tutor.setAllowInterruptions(e.target.checked)}
					/>
					<span className="cr-switch-track" aria-hidden="true" />
					<span className="cr-switch-label">
						Let me interrupt
						<span className="cr-switch-hint">
							{allowInterruptions ? 'Speak up to cut in. Echo and noise are ignored.' : 'Tutor always finishes speaking.'}
						</span>
					</span>
				</label>

				{error && (
					<p className="cr-alert" role="alert">
						{error}
					</p>
				)}
			</div>

			{isDrawing && (
				<div className="cr-drawing-bar" role="status">
					<PencilIcon />
					<span>Drawing on the whiteboard…</span>
					<button type="button" className="cr-link-button" onClick={() => board.cancel()}>
						Stop
					</button>
				</div>
			)}

			{!study && (
				<button type="button" className="cr-callout" onClick={onOpenStudy}>
					<SparklesIcon />
					<span>
						<strong>Studying from notes?</strong> Upload a PDF so the tutor teaches from it and can quiz you.
					</span>
				</button>
			)}

			<div className="cr-transcript">
				<div className="cr-section-head">
					<h2 className="cr-section-title">Conversation</h2>
					{transcript.length > 0 && (
						<button type="button" className="cr-link-button" onClick={() => tutor.clearTranscript()}>
							Clear
						</button>
					)}
				</div>

				{transcript.length === 0 ? (
					<div className="cr-empty">
						<p>Try asking:</p>
						<ul className="cr-suggestions">
							{SUGGESTIONS.map((s) => (
								<li key={s}>
									<button type="button" className="cr-chip" onClick={() => ask(s)}>
										{s}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<ol className="cr-log" ref={logRef} role="log" aria-label="Conversation transcript">
						{transcript.map((entry) => (
							<li key={entry.id} className={`cr-msg cr-msg-${entry.role}${entry.final ? '' : ' is-pending'}`}>
								{entry.role === 'board' ? (
									<>
										<PencilIcon width={16} height={16} />
										<span>{entry.text}</span>
									</>
								) : (
									<>
										<span className="cr-msg-role">{entry.role === 'student' ? 'You' : 'Tutor'}</span>
										<span className="cr-msg-text">{entry.text}</span>
									</>
								)}
							</li>
						))}
					</ol>
				)}
			</div>

			<form className="cr-composer" onSubmit={handleSubmit}>
				<label htmlFor="cr-composer-input" className="cr-visually-hidden">
					{live ? 'Type a message to your tutor' : 'Ask the whiteboard to draw something'}
				</label>
				<input
					id="cr-composer-input"
					className="cr-input"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder={live ? 'Or type to your tutor…' : 'Ask the whiteboard to draw…'}
					autoComplete="off"
				/>
				<button
					type="submit"
					className="cr-icon-button cr-icon-button-primary"
					aria-label="Send"
					title="Send"
					disabled={!draft.trim()}
				>
					<SendIcon />
				</button>
			</form>
		</section>
	)
}

/** Drives the orb's glow from mic and speaker levels, without re-rendering React. */
function useAudioLevel(active: boolean) {
	const { tutor } = useClassroom()
	const ref = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!active) {
			ref.current?.style.setProperty('--level', '0')
			return
		}
		let frame = 0
		let smoothed = 0
		const tick = () => {
			const level = Math.max(tutor.$micLevel.get() * 4, tutor.getOutputLevel() * 5)
			smoothed = smoothed * 0.8 + Math.min(level, 1) * 0.2
			ref.current?.style.setProperty('--level', smoothed.toFixed(3))
			frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [active, tutor])

	return ref
}
