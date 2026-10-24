import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { StudyContext } from './studyStore'

GlobalWorkerOptions.workerSrc = workerUrl

const MAX_PAGES = 80
const MAX_FILE_BYTES = 25 * 1024 * 1024

/**
 * Extract the text from a text-based PDF, entirely in the browser.
 * The file is never uploaded; only the extracted text is sent with study requests.
 */
export async function extractPdfText(file: File): Promise<StudyContext> {
	if (file.size > MAX_FILE_BYTES) {
		throw new Error('That PDF is over 25 MB. Try a smaller file or a single chapter.')
	}

	const data = new Uint8Array(await file.arrayBuffer())
	const loadingTask = getDocument({ data })
	const pdf = await loadingTask.promise.catch((e: { name?: string }) => {
		throw new Error(
			e?.name === 'PasswordException'
				? 'That PDF is password-protected. Remove the password and try again.'
				: 'Couldn’t open that PDF. The file may be damaged; try exporting it again.'
		)
	})
	const pageCount = Math.min(pdf.numPages, MAX_PAGES)

	const pages: string[] = []
	for (let i = 1; i <= pageCount; i++) {
		const page = await pdf.getPage(i)
		const content = await page.getTextContent()
		const text = content.items
			.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
			.join('')
			.replace(/[ \t]+/g, ' ')
			.trim()
		if (text) pages.push(text)
	}
	await loadingTask.destroy()

	const text = pages.join('\n\n')
	if (text.replace(/\s/g, '').length < 50) {
		throw new Error(
			'No readable text found in this PDF. It may be a scanned image; try a text-based PDF instead.'
		)
	}

	return {
		title: file.name.replace(/\.pdf$/i, ''),
		text,
		pageCount: pdf.numPages,
	}
}
