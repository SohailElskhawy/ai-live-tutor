import { ChangeEvent, DragEvent, useCallback, useEffect, useId, useState } from 'react'
import { useValue } from 'tldraw'
import { Flashcards, Quiz, StudyKind } from '../../shared/study'
import { generateStudySet } from '../study/studyApi'
import { $studyContext } from '../study/studyStore'
import { useClassroom } from './ClassroomContext'
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FileTextIcon,
	RotateIcon,
	SparklesIcon,
	UploadIcon,
	XIcon,
} from './icons'

type Generated = { kind: 'quiz'; data: Quiz } | { kind: 'flashcards'; data: Flashcards }

export function StudyPanel() {
	const study = useValue('study', () => $studyContext.get(), [])
	const { tutor } = useClassroom()
	const [loadingPdf, setLoadingPdf] = useState(false)
	const [pdfError, setPdfError] = useState<string | null>(null)
	const [generating, setGenerating] = useState<StudyKind | null>(null)
	const [genError, setGenError] = useState<string | null>(null)
	const [count, setCount] = useState(5)
	const [generated, setGenerated] = useState<Generated | null>(null)
	const [dragging, setDragging] = useState(false)
	const inputId = useId()
	const countId = useId()

	const loadFile = useCallback(async (file: File | undefined) => {
		if (!file) return
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			setPdfError('That file isn’t a PDF. Choose a .pdf file.')
			return
		}
		setPdfError(null)
		setLoadingPdf(true)
		try {
			// pdf.js is large, so load it only when a student actually uploads a file
			const { extractPdfText } = await import('../study/pdf')
			$studyContext.set(await extractPdfText(file))
			setGenerated(null)
		} catch (e) {
			setPdfError(e instanceof Error ? e.message : 'Couldn’t read that PDF. Try another file.')
		} finally {
			setLoadingPdf(false)
		}
	}, [])

	const handleGenerate = async (kind: StudyKind) => {
		if (!study) return
		setGenError(null)
		setGenerating(kind)
		try {
			const result = await generateStudySet(kind, study, count)
			setGenerated(
				result.kind === 'quiz' ? { kind: 'quiz', data: result } : { kind: 'flashcards', data: result }
			)
		} catch (e) {
			setGenError(e instanceof Error ? e.message : 'Generation failed. Try again.')
		} finally {
			setGenerating(null)
		}
	}

	const onDrop = (e: DragEvent) => {
		e.preventDefault()
		setDragging(false)
		void loadFile(e.dataTransfer.files[0])
	}

	return (
		<section className="cr-study" aria-label="Study tools">
			{!study ? (
				<label
					htmlFor={inputId}
					className={'cr-dropzone' + (dragging ? ' is-dragging' : '')}
					onDragOver={(e) => {
						e.preventDefault()
						setDragging(true)
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={onDrop}
				>
					{loadingPdf ? <span className="cr-spinner cr-spinner-dark" aria-hidden="true" /> : <UploadIcon width={28} height={28} />}
					<span className="cr-dropzone-title">{loadingPdf ? 'Reading your PDF…' : 'Upload a PDF'}</span>
					<span className="cr-dropzone-hint">
						Drop a text-based PDF here, or click to browse. It’s read in your browser and never stored.
					</span>
					<input
						id={inputId}
						type="file"
						accept="application/pdf,.pdf"
						className="cr-visually-hidden"
						disabled={loadingPdf}
						onChange={(e: ChangeEvent<HTMLInputElement>) => {
							void loadFile(e.target.files?.[0])
							e.target.value = ''
						}}
					/>
				</label>
			) : (
				<div className="cr-doc">
					<FileTextIcon />
					<div className="cr-doc-meta">
						<p className="cr-doc-title" title={study.title}>
							{study.title}
						</p>
						<p className="cr-doc-sub">
							{study.pageCount} {study.pageCount === 1 ? 'page' : 'pages'} ·{' '}
							{Math.round(study.text.length / 1000)}k characters
							{tutor.isActive() ? ' · restart voice to use it' : ' · tutor will use it'}
						</p>
					</div>
					<button
						type="button"
						className="cr-icon-button"
						onClick={() => {
							$studyContext.set(null)
							setGenerated(null)
						}}
						aria-label="Remove PDF"
						title="Remove PDF"
					>
						<XIcon />
					</button>
				</div>
			)}

			{pdfError && (
				<p className="cr-alert" role="alert">
					{pdfError}
				</p>
			)}

			{study && (
				<div className="cr-generate">
					<div className="cr-generate-row">
						<label htmlFor={countId} className="cr-label cr-label-inline">
							Items
						</label>
						<select
							id={countId}
							className="cr-select"
							value={count}
							onChange={(e) => setCount(Number(e.target.value))}
						>
							{[3, 5, 8, 10].map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</div>
					<div className="cr-generate-actions">
						<button
							type="button"
							className="cr-button cr-button-primary"
							onClick={() => void handleGenerate('quiz')}
							disabled={!!generating}
						>
							{generating === 'quiz' ? <span className="cr-spinner" aria-hidden="true" /> : <SparklesIcon />}
							{generating === 'quiz' ? 'Writing quiz…' : 'Generate quiz'}
						</button>
						<button
							type="button"
							className="cr-button cr-button-secondary"
							onClick={() => void handleGenerate('flashcards')}
							disabled={!!generating}
						>
							{generating === 'flashcards' ? (
								<span className="cr-spinner cr-spinner-dark" aria-hidden="true" />
							) : (
								<RotateIcon />
							)}
							{generating === 'flashcards' ? 'Making cards…' : 'Make flashcards'}
						</button>
					</div>
					{genError && (
						<p className="cr-alert" role="alert">
							{genError}
						</p>
					)}
				</div>
			)}

			{generating && !generated && <StudySkeleton />}
			{generated?.kind === 'quiz' && <QuizView key={generated.data.title + generated.data.questions.length} quiz={generated.data} />}
			{generated?.kind === 'flashcards' && <FlashcardView key={generated.data.title + generated.data.cards.length} deck={generated.data} />}
		</section>
	)
}

function StudySkeleton() {
	return (
		<div className="cr-skeleton" aria-hidden="true">
			<div className="cr-skeleton-line w-60" />
			<div className="cr-skeleton-block" />
			<div className="cr-skeleton-line" />
			<div className="cr-skeleton-line" />
			<div className="cr-skeleton-line w-80" />
		</div>
	)
}

function QuizView({ quiz }: { quiz: Quiz }) {
	const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null))
	const answered = answers.filter((a) => a !== null).length
	const correct = answers.filter((a, i) => a === quiz.questions[i].answerIndex).length
	const done = answered === quiz.questions.length

	return (
		<div className="cr-quiz">
			<div className="cr-section-head">
				<h2 className="cr-section-title">{quiz.title}</h2>
				<span className="cr-score" role="status" aria-atomic="true">
					{done ? `Score: ${correct} / ${quiz.questions.length}` : `${answered} of ${quiz.questions.length} answered`}
				</span>
			</div>

			<ol className="cr-questions">
				{quiz.questions.map((q, qi) => {
					const picked = answers[qi]
					const isAnswered = picked !== null
					return (
						<li key={qi} className="cr-question">
							<fieldset>
								<legend className="cr-question-text">
									<span className="cr-question-num">{qi + 1}.</span> {q.question}
								</legend>
								<div className="cr-options">
									{q.options.map((option, oi) => {
										const isCorrect = oi === q.answerIndex
										const state = !isAnswered
											? ''
											: isCorrect
												? ' is-correct'
												: oi === picked
													? ' is-wrong'
													: ' is-dim'
										return (
											<button
												key={oi}
												type="button"
												className={'cr-option' + state}
												disabled={isAnswered}
												aria-pressed={picked === oi}
												onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
											>
												<span className="cr-option-letter" aria-hidden="true">
													{String.fromCharCode(65 + oi)}
												</span>
												<span className="cr-option-text">{option}</span>
												{isAnswered && isCorrect && <CheckIcon className="cr-option-mark" />}
												{isAnswered && !isCorrect && oi === picked && <XIcon className="cr-option-mark" />}
											</button>
										)
									})}
								</div>
								{isAnswered && (
									<p className={'cr-explanation' + (picked === q.answerIndex ? ' is-correct' : ' is-wrong')}>
										<strong>{picked === q.answerIndex ? 'Correct.' : 'Not quite.'}</strong> {q.explanation}
									</p>
								)}
							</fieldset>
						</li>
					)
				})}
			</ol>

			{done && (
				<button
					type="button"
					className="cr-button cr-button-secondary cr-button-block"
					onClick={() => setAnswers(quiz.questions.map(() => null))}
				>
					<RotateIcon />
					Retake quiz
				</button>
			)}
		</div>
	)
}

function FlashcardView({ deck }: { deck: Flashcards }) {
	const [index, setIndex] = useState(0)
	const [flipped, setFlipped] = useState(false)
	const card = deck.cards[index]
	const total = deck.cards.length

	const go = useCallback(
		(delta: number) => {
			setFlipped(false)
			setIndex((i) => (i + delta + total) % total)
		},
		[total]
	)

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement
			if (target.closest('input, textarea, select, .tl-container')) return
			if (e.key === 'ArrowRight') go(1)
			if (e.key === 'ArrowLeft') go(-1)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [go])

	return (
		<div className="cr-deck">
			<div className="cr-section-head">
				<h2 className="cr-section-title">{deck.title}</h2>
				<span className="cr-score" role="status" aria-atomic="true">
					Card {index + 1} of {total}
				</span>
			</div>

			<button
				type="button"
				className={'cr-card' + (flipped ? ' is-flipped' : '')}
				onClick={() => setFlipped((f) => !f)}
				aria-label={flipped ? `Answer: ${card.back}. Click to show the question.` : `Question: ${card.front}. Click to reveal the answer.`}
			>
				<span className="cr-card-inner">
					<span className="cr-card-face cr-card-front">
						<span className="cr-card-tag">Question</span>
						<span className="cr-card-text">{card.front}</span>
						<span className="cr-card-hint">Click to flip</span>
					</span>
					<span className="cr-card-face cr-card-back">
						<span className="cr-card-tag">Answer</span>
						<span className="cr-card-text">{card.back}</span>
					</span>
				</span>
			</button>

			<div className="cr-deck-nav">
				<button type="button" className="cr-icon-button" onClick={() => go(-1)} aria-label="Previous card" title="Previous (←)">
					<ChevronLeftIcon />
				</button>
				<div className="cr-progress" aria-hidden="true">
					<div className="cr-progress-bar" style={{ width: `${((index + 1) / total) * 100}%` }} />
				</div>
				<button type="button" className="cr-icon-button" onClick={() => go(1)} aria-label="Next card" title="Next (→)">
					<ChevronRightIcon />
				</button>
			</div>
		</div>
	)
}
