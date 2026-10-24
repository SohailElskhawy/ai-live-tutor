import type { Editor, TLShape } from 'tldraw'
import type { TldrawAgent } from '../agent/TldrawAgent'

export const STUDENT_AUTHOR = 'student'

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
