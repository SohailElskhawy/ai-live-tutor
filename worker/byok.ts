import { Environment } from './environment'

export const GEMINI_KEY_HEADER = 'X-Gemini-Key'

/**
 * Read the student's Gemini key from the request.
 *
 * The key is passed through to Google and never logged or stored.
 * Falls back to the server key only when ALLOW_SERVER_KEY is explicitly enabled.
 */
export function getGeminiKey(request: Request, env: Environment): string | null {
	const key = request.headers.get(GEMINI_KEY_HEADER)?.trim()
	if (key) return key
	if (env.ALLOW_SERVER_KEY === 'true' && env.GOOGLE_API_KEY) return env.GOOGLE_API_KEY
	return null
}

export class MissingKeyError extends Error {
	status = 401
	constructor() {
		super('Add your Gemini API key to continue.')
	}
}

export function requireGeminiKey(request: Request, env: Environment): string {
	const key = getGeminiKey(request, env)
	if (!key) throw new MissingKeyError()
	return key
}
