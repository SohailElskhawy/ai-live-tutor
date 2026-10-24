import { createContext } from 'react'
import type { BoardBridge } from '../tutor/boardBridge'
import type { LiveTutor } from '../voice/LiveTutor'

export interface Classroom {
	board: BoardBridge
	tutor: LiveTutor
}

// Kept in its own module so hot reloads of the provider and hooks don't create a
// second context object (which left components reading an empty context).
export const ClassroomContext = createContext<Classroom | null>(null)
