import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react'
import { TldrawAgentApp } from '../agent/TldrawAgentApp'
import { BoardBridge, installStudentShapeGuard } from '../tutor/boardBridge'
import { LiveTutor } from '../voice/LiveTutor'

export interface Classroom {
	board: BoardBridge
	tutor: LiveTutor
}

const ClassroomContext = createContext<Classroom | null>(null)

/**
 * Provides the voice tutor and whiteboard bridge once the agent app exists.
 * Always rendered, so the tree around the canvas stays stable while the app loads.
 */
export function ClassroomProvider({ app, children }: { app: TldrawAgentApp | null; children: ReactNode }) {
	const agent = app?.agents.getAgent() ?? null

	const classroom = useMemo<Classroom | null>(() => {
		if (!agent) return null
		const board = new BoardBridge(agent)
		return { board, tutor: new LiveTutor(board) }
	}, [agent])

	useEffect(() => (agent ? installStudentShapeGuard(agent.editor, agent) : undefined), [agent])
	useEffect(() => () => classroom?.tutor.stop(), [classroom])

	return <ClassroomContext.Provider value={classroom}>{children}</ClassroomContext.Provider>
}

export function useClassroom(): Classroom {
	const classroom = useContext(ClassroomContext)
	if (!classroom) throw new Error('useClassroom must be used once the classroom is ready')
	return classroom
}

export function useClassroomReady(): boolean {
	return useContext(ClassroomContext) !== null
}
