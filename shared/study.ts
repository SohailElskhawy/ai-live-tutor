import { z } from 'zod'

export const QuizSchema = z.object({
	title: z.string().describe('A short title for the quiz'),
	questions: z
		.array(
			z.object({
				question: z.string(),
				options: z.array(z.string()).length(4).describe('Exactly four answer options'),
				answerIndex: z.number().int().min(0).max(3).describe('Index of the correct option'),
				explanation: z.string().describe('One or two sentences on why the answer is correct'),
			})
		)
		.min(1),
})
export type Quiz = z.infer<typeof QuizSchema>

export const FlashcardsSchema = z.object({
	title: z.string().describe('A short title for the deck'),
	cards: z
		.array(
			z.object({
				front: z.string().describe('A term, question or prompt'),
				back: z.string().describe('A concise answer or definition'),
			})
		)
		.min(1),
})
export type Flashcards = z.infer<typeof FlashcardsSchema>

export type StudyKind = 'quiz' | 'flashcards'

/** Request body for POST /study. */
export interface StudyRequest {
	kind: StudyKind
	title: string
	text: string
	count: number
}

/** Longest study text the Worker accepts, in characters. */
export const MAX_STUDY_TEXT = 60_000
