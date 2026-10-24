import { useCallback, useMemo, useState } from 'react'
import {
	DefaultSizeStyle,
	ErrorBoundary,
	TLComponents,
	Tldraw,
	TldrawUiToastsProvider,
	TLUiOverrides,
} from 'tldraw'
import { TldrawAgentApp } from './agent/TldrawAgentApp'
import {
	TldrawAgentAppContextProvider,
	TldrawAgentAppProvider,
} from './agent/TldrawAgentAppProvider'
import { ClassroomProvider } from './classroom/ClassroomContext'
import { ClassroomPanel, ClassroomTab } from './classroom/ClassroomPanel'
import { KeyDialog } from './classroom/KeyDialog'
import { TopBar } from './classroom/TopBar'
import { ChatPanelFallback } from './components/ChatPanelFallback'
import { CustomHelperButtons } from './components/CustomHelperButtons'
import { AgentHighlightOverlayUtil } from './overlays/AgentHighlightOverlayUtil'
import { TargetAreaTool } from './tools/TargetAreaTool'
import { TargetShapeTool } from './tools/TargetShapeTool'
import { keyStore } from './tutor/keyStore'

// Customize tldraw's styles to play to the agent's strengths
DefaultSizeStyle.setDefaultValue('s')

// Custom tools for picking context items
const tools = [TargetShapeTool, TargetAreaTool]
const overlayUtils = [AgentHighlightOverlayUtil]
const overrides: TLUiOverrides = {
	tools: (editor, tools) => {
		return {
			...tools,
			'target-area': {
				id: 'target-area',
				label: 'Pick Area',
				kbd: 'c',
				icon: 'tool-frame',
				onSelect() {
					editor.setCurrentTool('target-area')
				},
			},
			'target-shape': {
				id: 'target-shape',
				label: 'Pick Shape',
				kbd: 's',
				icon: 'tool-frame',
				onSelect() {
					editor.setCurrentTool('target-shape')
				},
			},
		}
	},
}

function App() {
	const [app, setApp] = useState<TldrawAgentApp | null>(null)
	const [tab, setTab] = useState<ClassroomTab>('tutor')
	const [keyDialogOpen, setKeyDialogOpen] = useState(() => !keyStore.get())

	const handleUnmount = useCallback(() => {
		setApp(null)
	}, [])

	// Custom components that need the agent app's React context
	const components: TLComponents = useMemo(() => {
		return {
			HelperButtons: () =>
				app && (
					<TldrawAgentAppContextProvider app={app}>
						<CustomHelperButtons />
					</TldrawAgentAppContextProvider>
				),
		}
	}, [app])

	return (
		<TldrawUiToastsProvider>
			<ClassroomProvider app={app}>
				<div className="cr-app">
					{app ? (
						<TopBar onEditKey={() => setKeyDialogOpen(true)} onOpenStudy={() => setTab('study')} />
					) : (
						<header className="cr-topbar" aria-hidden="true" />
					)}
					<div className="cr-body">
						<main className="cr-canvas" aria-label="Whiteboard">
							<Tldraw
								persistenceKey="ai-live-tutor-board"
								tools={tools}
								overlayUtils={overlayUtils}
								overrides={overrides}
								components={components}
							>
								<TldrawAgentAppProvider onMount={setApp} onUnmount={handleUnmount} />
							</Tldraw>
						</main>
						<ErrorBoundary fallback={ChatPanelFallback}>
							{app ? (
								<TldrawAgentAppContextProvider app={app}>
									<ClassroomPanel tab={tab} onTabChange={setTab} />
								</TldrawAgentAppContextProvider>
							) : (
								<aside className="cr-panel" aria-busy="true" />
							)}
						</ErrorBoundary>
					</div>
					{keyDialogOpen && (
						<KeyDialog canDismiss={!!keyStore.get()} onClose={() => setKeyDialogOpen(false)} />
					)}
				</div>
			</ClassroomProvider>
		</TldrawUiToastsProvider>
	)
}

export default App
