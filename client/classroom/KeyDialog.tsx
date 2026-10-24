import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { keyStore } from '../tutor/keyStore'
import { GraduationCapIcon, KeyIcon, ShieldIcon, XIcon } from './icons'

/**
 * Asks for the student's Gemini API key. The key lives in memory only.
 */
export function KeyDialog({ onClose, canDismiss }: { onClose: () => void; canDismiss: boolean }) {
	const inputId = useId()
	const hintId = useId()
	const errorId = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [value, setValue] = useState('')
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		inputRef.current?.focus()
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && canDismiss) onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [canDismiss, onClose])

	const validate = (key: string) => {
		if (!key.trim()) return 'Paste your Gemini API key to continue.'
		if (key.trim().length < 20) return 'That looks too short for a Gemini API key. Check that you copied all of it.'
		return null
	}

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault()
		const problem = validate(value)
		setError(problem)
		if (problem) {
			inputRef.current?.focus()
			return
		}
		keyStore.set(value)
		setValue('')
		onClose()
	}

	return (
		<div className="cr-overlay" role="presentation">
			<div className="cr-dialog" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`}>
				{canDismiss && (
					<button type="button" className="cr-icon-button cr-dialog-close" onClick={onClose} aria-label="Close">
						<XIcon />
					</button>
				)}
				<div className="cr-dialog-badge">
					<GraduationCapIcon />
				</div>
				<h1 id={`${inputId}-title`} className="cr-dialog-title">
					Welcome to AI Live Tutor
				</h1>
				<p className="cr-dialog-lead">
					Talk through any topic out loud. Your tutor explains, draws on the whiteboard, and quizzes you
					on your own notes.
				</p>

				<form onSubmit={handleSubmit} noValidate>
					<label htmlFor={inputId} className="cr-label">
						Gemini API key
					</label>
					<div className={'cr-input-wrap' + (error ? ' has-error' : '')}>
						<KeyIcon />
						<input
							ref={inputRef}
							id={inputId}
							type="password"
							className="cr-input"
							autoComplete="off"
							spellCheck={false}
							placeholder="AIza…"
							value={value}
							onChange={(e) => {
								setValue(e.target.value)
								if (error) setError(null)
							}}
							onBlur={() => value && setError(validate(value))}
							aria-invalid={!!error}
							aria-describedby={error ? `${errorId} ${hintId}` : hintId}
						/>
					</div>
					{error && (
						<p id={errorId} className="cr-field-error" role="alert">
							{error}
						</p>
					)}
					<p id={hintId} className="cr-hint">
						Get a free key from{' '}
						<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
							Google AI Studio
						</a>
						.
					</p>

					<button type="submit" className="cr-button cr-button-primary cr-button-block">
						Start learning
					</button>
				</form>

				<p className="cr-privacy">
					<ShieldIcon />
					<span>
						Your key stays in this tab's memory and is cleared when you reload. It's only passed through
						our server to Google, never stored or logged.
					</span>
				</p>
			</div>
		</div>
	)
}
