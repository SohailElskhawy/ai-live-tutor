/**
 * Gemini Live models in order of preference. The Worker picks the first one the
 * student's key can actually use (see worker/models.ts).
 */
export const LIVE_MODEL_PREFERENCES = [
	'gemini-3.8-live',
	'gemini-3.1-flash-live-preview',
	'gemini-2.5-flash-native-audio-preview-12-2025',
	'gemini-live-2.5-flash-preview',
]

/** Text models for drawing and study tools, in fallback order. */
export const TEXT_MODEL_PREFERENCES = [
	'gemini-3.8-flash',
	'gemini-3.6-flash',
	'gemini-3.5-flash',
	'gemini-3.5-flash-lite',
	'gemini-3.1-flash-lite',
]

/** The text model used first for quizzes and flashcards. */
export const STUDY_MODEL = TEXT_MODEL_PREFERENCES[0]

/** Ephemeral Live tokens only work with this API version. */
export const LIVE_API_VERSION = 'v1alpha'

/** Response from POST /live/token. */
export interface LiveTokenResponse {
	token: string
	model: string
	expiresAt: string
}
