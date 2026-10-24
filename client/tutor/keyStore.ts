import { atom } from 'tldraw'

/**
 * The student's Gemini API key.
 *
 * Held only in memory: never written to localStorage, chat history or prompt parts.
 * A page reload clears it. It is sent to our Worker in the `X-Gemini-Key` header.
 */
const $geminiKey = atom<string | null>('geminiKey', null)

export const GEMINI_KEY_HEADER = 'X-Gemini-Key'

export const keyStore = {
	get: () => $geminiKey.get(),
	set: (key: string) => $geminiKey.set(key.trim() || null),
	clear: () => $geminiKey.set(null),
}

/** Headers to attach to every request to the Worker. */
export function getKeyHeaders(): Record<string, string> {
	const key = keyStore.get()
	return key ? { [GEMINI_KEY_HEADER]: key } : {}
}
