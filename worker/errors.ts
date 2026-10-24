/**
 * Turn any thrown error into a short, safe message for the browser.
 *
 * SDK errors can carry the request body (including the student's document),
 * so we never serialize the error object itself.
 */
export function toPublicError(e: unknown): { status: number; message: string } {
	const err = e as { status?: number; statusCode?: number; message?: string } | null
	const status = err?.status ?? err?.statusCode ?? 500
	const raw = extractGoogleMessage(err?.message ?? '')

	if (/api key not valid|API_KEY_INVALID|permission denied|unauthenticated/i.test(raw)) {
		return { status: 401, message: "That Gemini API key isn't valid. Check it and enter it again." }
	}
	if (status === 429 || /quota|rate limit|resource.?exhausted/i.test(raw)) {
		return {
			status: 429,
			message: "Your Gemini key has hit its rate limit or quota. Wait a minute and try again.",
		}
	}
	if (status >= 400 && status < 500 && raw) return { status, message: raw.slice(0, 300) }
	return { status: 502, message: 'The AI service had a problem. Try again in a moment.' }
}

function extractGoogleMessage(message: string): string {
	// Google SDK errors wrap a JSON body in the message: {"error":{"message":"..."}}
	const start = message.indexOf('{')
	if (start === -1) return message
	try {
		const parsed = JSON.parse(message.slice(start)) as { error?: { message?: string } }
		return parsed.error?.message ?? message
	} catch {
		return message
	}
}
