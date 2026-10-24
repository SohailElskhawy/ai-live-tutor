import { expect, test } from '@playwright/test'
import { closeAndParseJson } from '../worker/do/closeAndParseJson'

// The Worker turns streamed model text into whiteboard actions. Gemini doesn't always
// follow the requested format, and a reply that fails to parse draws nothing.
const types = (text: string) => closeAndParseJson(text)?.actions?.map((a: { _type: string }) => a._type) ?? null

test.describe('model reply parsing', () => {
	test('reads the requested {"actions": [...]} format, complete or streaming', () => {
		expect(types('{"actions":[{"_type":"message","text":"hi"}]}')).toEqual(['message'])
		expect(types('{"actions":[{"_type":"create","shape":{"_type":"rect')).toEqual(['create'])
	})

	test('reads replies wrapped in a markdown fence or preceded by text', () => {
		expect(types('```json\n{"actions":[{"_type":"message","text":"hi"}]}\n```')).toEqual(['message'])
		expect(types('Here you go:\n{"actions":[{"_type":"think","text":"x"}]}')).toEqual(['think'])
	})

	test('reads the [ACTION]: notation Gemini copies from chat history', () => {
		expect(
			types('[ACTION]: {"_type":"create","shape":{"_type":"text","text":"sin"}}[ACTION]: {"_type":"message","text":"ok"}')
		).toEqual(['create', 'message'])
		expect(types('[ACTION]: {"_type":"create","shape":{}}\n[ACTION]: {"_type":"pen","points":[{"x":1')).toEqual([
			'create',
			'pen',
		])
	})

	test('waits for more text when nothing parseable has arrived yet', () => {
		expect(types('```js')).toBeNull()
	})
})
