import { LIVE_MODEL_PREFERENCES, TEXT_MODEL_PREFERENCES } from '../shared/live'

interface GeminiModel {
	id: string
	methods: string[]
}

const CACHE_TTL_MS = 10 * 60_000
// Keyed by a hash of the API key, never the key itself
const modelCache = new Map<string, { at: number; models: GeminiModel[] }>()

async function hashKey(apiKey: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey))
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * List the models this key can use. Model names change often, so we ask Google
 * instead of hard-coding them. Returns null if the list can't be fetched.
 */
export async function getAvailableModels(apiKey: string): Promise<GeminiModel[] | null> {
	const cacheKey = await hashKey(apiKey)
	const cached = modelCache.get(cacheKey)
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.models

	try {
		const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
			headers: { 'x-goog-api-key': apiKey },
		})
		if (!res.ok) return null
		const body = (await res.json()) as {
			models?: { name: string; supportedGenerationMethods?: string[] }[]
		}
		const models = (body.models ?? []).map((m) => ({
			id: m.name.replace(/^models\//, ''),
			methods: m.supportedGenerationMethods ?? [],
		}))
		modelCache.set(cacheKey, { at: Date.now(), models })
		return models
	} catch {
		return null
	}
}

/** The best Live (real-time voice) model this key can use. */
export async function pickLiveModel(apiKey: string): Promise<string> {
	const models = await getAvailableModels(apiKey)
	if (!models) return LIVE_MODEL_PREFERENCES[0]

	const live = models.filter((m) => m.methods.includes('bidiGenerateContent'))
	for (const preferred of LIVE_MODEL_PREFERENCES) {
		if (live.some((m) => m.id === preferred)) return preferred
	}
	// Otherwise take the newest-looking audio-capable Live model
	const audio = live
		.map((m) => m.id)
		.filter((id) => /live|native-audio/.test(id))
		.sort()
		.reverse()
	return audio[0] ?? LIVE_MODEL_PREFERENCES[0]
}

/**
 * Text models to try in order, starting with the preferred one.
 * Used to fall back when a model is overloaded or unavailable for this key.
 */
export async function getTextModelChain(apiKey: string, preferred: string): Promise<string[]> {
	const chain = [preferred, ...TEXT_MODEL_PREFERENCES.filter((m) => m !== preferred)]
	const models = await getAvailableModels(apiKey)
	if (!models) return chain
	const available = new Set(models.filter((m) => m.methods.includes('generateContent')).map((m) => m.id))
	const filtered = chain.filter((id) => available.has(id))
	return filtered.length > 0 ? filtered : chain
}

/** Errors where another model might succeed: overload, per-model quota, or missing model. */
export function isModelFallbackError(e: unknown): boolean {
	const err = e as { statusCode?: number; status?: number; message?: string; lastError?: unknown } | null
	if (!err) return false
	if (err.lastError) return isModelFallbackError(err.lastError)
	const status = err.statusCode ?? err.status
	if (status === 404 || status === 429 || status === 500 || status === 503) return true
	return /high demand|overloaded|unavailable|not found|resource.?exhausted/i.test(err.message ?? '')
}
