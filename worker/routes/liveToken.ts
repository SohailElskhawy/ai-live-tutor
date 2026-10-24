import { GoogleGenAI } from '@google/genai'
import { IRequest } from 'itty-router'
import { LIVE_MODEL, LiveTokenResponse } from '../../shared/live'
import { requireGeminiKey } from '../byok'
import { Environment } from '../environment'

/**
 * Exchange the student's Gemini key for a short-lived, single-use Live API token.
 *
 * The browser opens the Live WebSocket with this token, so the raw key never
 * appears in a WebSocket URL and a leaked token expires within minutes.
 */
export async function liveToken(request: IRequest, env: Environment): Promise<LiveTokenResponse> {
	const apiKey = requireGeminiKey(request, env)
	const ai = new GoogleGenAI({ apiKey })

	const now = Date.now()
	const expiresAt = new Date(now + 30 * 60_000).toISOString()
	const token = await ai.authTokens.create({
		config: {
			uses: 1,
			expireTime: expiresAt,
			newSessionExpireTime: new Date(now + 60_000).toISOString(),
		},
	})

	if (!token.name) throw new Error('Gemini did not return a session token.')
	return { token: token.name, model: LIVE_MODEL, expiresAt }
}
