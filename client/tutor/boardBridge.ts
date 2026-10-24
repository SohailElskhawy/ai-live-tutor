import type { Editor, TLShape } from 'tldraw'
import type { TldrawAgent } from '../agent/TldrawAgent'

export const STUDENT_AUTHOR = 'student'

export type BoardTask = 'draw' | 'edit'

export interface BoardResult {
	status: 'done' | 'cancelled' | 'error'
	/** What the drawing agent said it did, for the voice tutor to mention. */
	summary: string
}

/**
 * Connects the voice tutor to the existing tldraw agent.
 *
 * Voice tool calls become `agent.interrupt(...)` calls, which start a new agent
 * loop or redirect the current one. That is what lets a student cut in with
 * "make it bigger" while a diagram is still being drawn.
 */
export class BoardBridge {
	private runId = 0

	constructor(private agent: TldrawAgent) {}

	get editor(): Editor {
		return this.agent.editor
	}

	isBusy() {
		return this.agent.requests.isGenerating()
	}

	/** Start drawing or editing. Resolves when the agent goes idle. */
	run(task: BoardTask, instruction: string): Promise<BoardResult> {
		const runId = ++this.runId
		const historyStart = this.agent.chat.getHistory().length
		const agentMessage =
			task === 'edit'
				? `The student asked to change what is already on the whiteboard: "${instruction}". Modify the existing shapes in place (update, move, label, recolor, or add to them). Do not redraw the diagram from scratch and do not delete the student's own drawings.`
				: `You are the drawing hand of a live voice tutor. Draw a clear, labeled teaching diagram on the whiteboard for: "${instruction}". Leave space around the student's own drawings and keep labels short.`

		this.agent.interrupt({
			input: {
				agentMessages: [agentMessage],
				userMessages: [`🎙 ${instruction}`],
				bounds: this.editor.getViewportPageBounds(),
				source: 'user',
			},
		})

		return this.waitUntilIdle(runId).then((status) => {
			if (status === 'error') return { status, summary: 'Drawing timed out.' }
			if (status === 'done' && this.countBoardActionsSince(historyStart) === 0) {
				const said = this.getAgentMessagesSince(historyStart)
				return { status: 'error' as const, summary: said || 'Nothing was drawn. Try asking again.' }
			}
			return { status, summary: this.getAgentMessagesSince(historyStart) || 'Updated the whiteboard.' }
		})
	}

	cancel() {
		this.runId++
		this.agent.cancel()
	}

	/** A short text description of what is on the board, for the voice model. */
	describe(): string {
		const shapes = this.editor.getCurrentPageShapes()
		if (shapes.length === 0) return 'The whiteboard is empty.'
		const lines = shapes.slice(0, 60).map((shape) => {
			const text = this.editor.getShapeUtil(shape).getText(shape)?.trim()
			const author = isStudentShape(shape) ? 'student' : 'tutor'
			const kind = shape.type === 'geo' ? (shape.props as { geo: string }).geo : shape.type
			return `- ${kind}${text ? ` "${text.slice(0, 80)}"` : ''} (drawn by ${author})`
		})
		const more = shapes.length > 60 ? `\n…and ${shapes.length - 60} more shapes.` : ''
		return `The whiteboard has ${shapes.length} shapes:\n${lines.join('\n')}${more}`
	}

	private waitUntilIdle(runId: number): Promise<BoardResult['status']> {
		return new Promise((resolve) => {
			const startedAt = Date.now()
			const check = () => {
				if (runId !== this.runId) return resolve('cancelled')
				// Give the agent a moment to pick up the request before checking
				if (Date.now() - startedAt > 400 && !this.isBusy()) return resolve('done')
				if (Date.now() - startedAt > 120_000) return resolve('error')
				setTimeout(check, 250)
			}
			check()
		})
	}

	/** Actions that changed the canvas (anything other than talking or planning). */
	private countBoardActionsSince(index: number): number {
		const nonDrawing = new Set(['message', 'think', 'review', 'add-detail', 'update-todo-list', 'unknown', 'count', 'setMyView'])
		return this.agent.chat
			.getHistory()
			.slice(index)
			.filter((item) => item.type === 'action' && item.action.complete && !nonDrawing.has(item.action._type))
			.length
	}

	private getAgentMessagesSince(index: number): string {
		return this.agent.chat
			.getHistory()
			.slice(index)
			.flatMap((item) =>
				item.type === 'action' && item.action._type === 'message' && item.action.complete
					? [item.action.text]
					: []
			)
			.join(' ')
			.slice(0, 600)
	}
}

export function isStudentShape(shape: TLShape) {
	return shape.meta?.author === STUDENT_AUTHOR
}

/**
 * Tag every shape the student creates, so the agent can tell them apart and
 * never deletes them. Shapes created while the agent is acting stay untagged.
 */
export function installStudentShapeGuard(editor: Editor, agent: TldrawAgent) {
	return editor.sideEffects.registerBeforeCreateHandler('shape', (shape) => {
		if (agent.getIsActingOnEditor() || shape.meta?.author) return shape
		return {
			...shape,
			meta: {
				...shape.meta,
				author: STUDENT_AUTHOR,
				note: (shape.meta?.note as string) || "Drawn by the student. Keep it; don't delete it.",
			},
		}
	})
}
