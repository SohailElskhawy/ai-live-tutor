import { Flashcards, Quiz, StudyKind, StudyRequest } from '../../shared/study'
import { getKeyHeaders } from '../tutor/keyStore'

export type StudyResult = ({ kind: 'quiz' } & Quiz) | ({ kind: 'flashcards' } & Flashcards)

export async function generateStudySet(
	kind: StudyKind,
	context: { title: string; text: string },
	count: number
): Promise<StudyResult> {
	const body: StudyRequest = { kind, title: context.title, text: context.text, count }
	const res = await fetch('/study', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...getKeyHeaders() },
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		const err = (await res.json().catch(() => null)) as { error?: string } | null
		throw new Error(err?.error ?? `Couldn't generate the ${kind} (${res.status}). Try again.`)
	}
	return (await res.json()) as StudyResult
}
