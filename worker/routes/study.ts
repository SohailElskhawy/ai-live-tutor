import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { error, IRequest } from 'itty-router'
import { STUDY_MODEL } from '../../shared/live'
import { FlashcardsSchema, MAX_STUDY_TEXT, QuizSchema, StudyRequest } from '../../shared/study'
import { requireGeminiKey } from '../byok'
import { Environment } from '../environment'

/** Generate an MCQ quiz or a flashcard deck from the student's study material. */
export async function study(request: IRequest, env: Environment) {
	const apiKey = requireGeminiKey(request, env)
	const body = (await request.json()) as Partial<StudyRequest>

	const text = typeof body.text === 'string' ? body.text.slice(0, MAX_STUDY_TEXT) : ''
	if (text.trim().length < 50) {
		return error(400, 'The document has too little text to study from. Try a text-based PDF.')
	}
	const kind = body.kind === 'flashcards' ? 'flashcards' : 'quiz'
	const count = Math.min(Math.max(Math.round(Number(body.count) || 5), 1), 15)
	const title = String(body.title ?? 'Study material').slice(0, 200)

	const model = createGoogleGenerativeAI({ apiKey })(STUDY_MODEL)
	const instructions =
		kind === 'quiz'
			? `Write ${count} multiple-choice questions that test understanding of the material, not trivia. Each has exactly four plausible options and one correct answer. Vary which option is correct.`
			: `Write ${count} flashcards covering the most important terms and ideas. Keep each side short enough to read at a glance.`

	const { object } = await generateObject({
		model,
		schema: kind === 'quiz' ? QuizSchema : FlashcardsSchema,
		system:
			'You are a careful tutor who writes study material strictly from the provided document. Do not invent facts that are not in it.',
		prompt: `${instructions}\n\nDocument title: ${title}\n\nDocument text:\n${text}`,
	})

	return { kind, ...object }
}
