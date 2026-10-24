import { expect, test } from '@playwright/test'
import { EchoGate } from '../client/voice/echoGate'

// btoa exists in Node 16+, which the gate uses to build its silence chunk
const QUIET = 0.01
const LOUD = 0.2

function makeGate(state: { speaking: boolean; allow: boolean }) {
	return new EchoGate({ tutorSpeaking: () => state.speaking, allowInterruptions: () => state.allow })
}
const isSilence = (chunk: string) => Buffer.from(chunk, 'base64').every((b) => b === 0)

test.describe('echo gate', () => {
	test('passes the mic through while the tutor is silent', () => {
		const gate = makeGate({ speaking: false, allow: true })
		expect(gate.process('mic-1', QUIET)).toEqual(['mic-1'])
	})

	test('replaces echo and background noise with silence while the tutor speaks', () => {
		const gate = makeGate({ speaking: true, allow: true })
		for (let i = 0; i < 10; i++) {
			const out = gate.process(`echo-${i}`, QUIET)
			expect(out).toHaveLength(1)
			expect(isSilence(out[0])).toBe(true)
		}
		// A single loud blip (a cough, a door) is not an interruption
		expect(isSilence(gate.process('blip', LOUD)[0])).toBe(true)
		expect(isSilence(gate.process('quiet', QUIET)[0])).toBe(true)
	})

	test('lets a real interruption through, including its first words', () => {
		const gate = makeGate({ speaking: true, allow: true })
		gate.process('echo', QUIET)
		expect(isSilence(gate.process('wait-1', LOUD)[0])).toBe(true)
		// Second loud chunk in a row: the student is talking, replay what was held back
		expect(gate.process('wait-2', LOUD)).toEqual(['echo', 'wait-1', 'wait-2'])
		expect(gate.process('wait-3', QUIET)).toEqual(['wait-3'])
	})

	test('never interrupts when interruptions are turned off', () => {
		const state = { speaking: true, allow: false }
		const gate = makeGate(state)
		for (let i = 0; i < 5; i++) expect(isSilence(gate.process(`loud-${i}`, LOUD)[0])).toBe(true)
		state.speaking = false
		expect(gate.process('after', LOUD)).toEqual(['after'])
	})
})
