import { atom } from 'tldraw'

/** Text extracted from the student's uploaded PDF. Kept in memory only. */
export interface StudyContext {
	title: string
	text: string
	pageCount: number
}

export const $studyContext = atom<StudyContext | null>('studyContext', null)

/** Trim study text to a size that fits comfortably in a prompt. */
export function getStudyExcerpt(maxChars: number): string | null {
	const context = $studyContext.get()
	if (!context) return null
	const text = context.text
	return text.length > maxChars ? text.slice(0, maxChars) + '\n…[truncated]' : text
}
