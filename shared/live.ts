/** The Gemini Live model used for real-time voice. */
export const LIVE_MODEL = 'gemini-3.8-live'

/** The text model used for quizzes and flashcards. */
export const STUDY_MODEL = 'gemini-3.8-flash'

/** Response from POST /live/token. */
export interface LiveTokenResponse {
	token: string
	model: string
	expiresAt: string
}
