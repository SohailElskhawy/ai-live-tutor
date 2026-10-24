import { KeyboardEvent, useId, useRef } from 'react'
import { useValue } from 'tldraw'
import { ChatPanel } from '../components/ChatPanel'
import { useClassroom } from './ClassroomContext'
import { StudyPanel } from './StudyPanel'
import { TutorPanel } from './TutorPanel'

export type ClassroomTab = 'tutor' | 'study' | 'agent'

const TABS: { id: ClassroomTab; label: string }[] = [
	{ id: 'tutor', label: 'Tutor' },
	{ id: 'study', label: 'Study' },
	{ id: 'agent', label: 'Board log' },
]

export function ClassroomPanel({ tab, onTabChange }: { tab: ClassroomTab; onTabChange: (tab: ClassroomTab) => void }) {
	const baseId = useId()
	const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
	const { tutor } = useClassroom()
	const status = useValue('status', () => tutor.$status.get(), [tutor])
	const live = status === 'listening' || status === 'speaking'

	// Arrow keys move between tabs (WAI-ARIA tabs pattern)
	const onKeyDown = (e: KeyboardEvent, index: number) => {
		const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
		if (!delta) return
		e.preventDefault()
		const next = (index + delta + TABS.length) % TABS.length
		onTabChange(TABS[next].id)
		tabRefs.current[next]?.focus()
	}

	return (
		<aside className="cr-panel" aria-label="Classroom">
			<div className="cr-tabs" role="tablist" aria-label="Classroom sections">
				{TABS.map((t, i) => (
					<button
						key={t.id}
						ref={(el) => {
							tabRefs.current[i] = el
						}}
						id={`${baseId}-tab-${t.id}`}
						type="button"
						role="tab"
						className="cr-tab"
						aria-selected={tab === t.id}
						aria-controls={`${baseId}-panel-${t.id}`}
						tabIndex={tab === t.id ? 0 : -1}
						onClick={() => onTabChange(t.id)}
						onKeyDown={(e) => onKeyDown(e, i)}
					>
						{t.label}
						{t.id === 'tutor' && live && (
							<>
								<span className="cr-tab-live" aria-hidden="true" />
								<span className="cr-visually-hidden">(live)</span>
							</>
						)}
					</button>
				))}
			</div>

			{TABS.map((t) => (
				<div
					key={t.id}
					id={`${baseId}-panel-${t.id}`}
					role="tabpanel"
					aria-labelledby={`${baseId}-tab-${t.id}`}
					className="cr-tabpanel"
					hidden={tab !== t.id}
				>
					{t.id === 'tutor' && <TutorPanel onOpenStudy={() => onTabChange('study')} />}
					{t.id === 'study' && <StudyPanel />}
					{t.id === 'agent' && <ChatPanel />}
				</div>
			))}
		</aside>
	)
}
