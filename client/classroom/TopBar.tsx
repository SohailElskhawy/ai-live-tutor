import { useValue } from 'tldraw'
import { $studyContext } from '../study/studyStore'
import { keyStore } from '../tutor/keyStore'
import { useClassroom } from './ClassroomContext'
import { FileTextIcon, GraduationCapIcon, KeyIcon } from './icons'

export function TopBar({ onEditKey, onOpenStudy }: { onEditKey: () => void; onOpenStudy: () => void }) {
	const key = useValue('key', () => keyStore.get(), [])
	const study = useValue('study', () => $studyContext.get(), [])
	const { tutor } = useClassroom()
	const status = useValue('status', () => tutor.$status.get(), [tutor])
	const live = status === 'listening' || status === 'speaking'

	return (
		<header className="cr-topbar">
			<div className="cr-brand">
				<span className="cr-brand-mark" aria-hidden="true">
					<GraduationCapIcon width={18} height={18} />
				</span>
				<span className="cr-brand-name">AI Live Tutor</span>
				{live && (
					<span className="cr-live-pill">
						<span className="cr-live-dot" aria-hidden="true" />
						Live
					</span>
				)}
			</div>

			<div className="cr-topbar-actions">
				<button type="button" className="cr-pill-button" onClick={onOpenStudy} title={study?.title}>
					<FileTextIcon width={16} height={16} />
					<span className="cr-pill-text">{study ? study.title : 'No PDF'}</span>
				</button>
				<button type="button" className="cr-pill-button" onClick={onEditKey}>
					<KeyIcon width={16} height={16} />
					<span className="cr-pill-text">{key ? `Key ••••${key.slice(-4)}` : 'Add key'}</span>
				</button>
			</div>
		</header>
	)
}
