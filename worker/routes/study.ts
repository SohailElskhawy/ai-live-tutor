import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { error, IRequest } from 'itty-router'
import { STUDY_MODEL } from '../../shared/live'
import { FlashcardsSchema, MAX_STUDY_TEXT, QuizSchema, StudyRequest } from '../../shared/study'
import { requireGeminiKey } from '../byok'
import { Environment } from '../environment'
import { getTextModelChain, isModelFallbackError } from '../models'

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

	const instructions =
		kind === 'quiz'
			? `Write ${count} multiple-choice questions that test understanding of the material, not trivia. Each has exactly four plausible options and one correct answer. Vary which option is correct.`
			: `Write ${count} flashcards covering the most important terms and ideas. Keep each side short enough to read at a glance.`

	const google = createGoogleGenerativeAI({ apiKey })
	const chain = await getTextModelChain(apiKey, STUDY_MODEL)
	let object: Record<string, unknown> | null = null
	for (let i = 0; i < chain.length && !object; i++) {
		try {
			const result = await generateObject({
				model: google(chain[i]),
				schema: kind === 'quiz' ? QuizSchema : FlashcardsSchema,
				maxRetries: 1,
				system:
					'You are a careful tutor who writes study material strictly from the provided document. Do not invent facts that are not in it.',
				prompt: `${instructions}\n\nDocument title: ${title}\n\nDocument text:\n${text}`,
			})
			object = result.object
		} catch (e) {
			if (i === chain.length - 1 || !isModelFallbackError(e)) throw e
			console.warn(`${chain[i]} unavailable for study; trying ${chain[i + 1]}`)
		}
	}

	return { kind, ...object }
}
