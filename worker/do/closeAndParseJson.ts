/**
 * JSON helper. Given a potentially incomplete JSON string, return the parsed object.
 * The string might be missing closing braces, brackets, or other characters like quotation marks.
 * @param string - The string to parse.
 * @returns The parsed object.
 */
export function closeAndParseJson(string: string) {
	string = stripNonJsonWrapper(string)
	const stackOfOpenings = []

	// Track openings and closings
	let i = 0
	while (i < string.length) {
		const char = string[i]
		const lastOpening = stackOfOpenings.at(-1)

		if (char === '"') {
			// Check if this quote is escaped
			if (i > 0 && string[i - 1] === '\\') {
				// This is an escaped quote, skip it
				i++
				continue
			}

			if (lastOpening === '"') {
				stackOfOpenings.pop()
			} else {
				stackOfOpenings.push('"')
			}
		}

		if (lastOpening === '"') {
			i++
			continue
		}

		if (char === '{' || char === '[') {
			stackOfOpenings.push(char)
		}

		if (char === '}' && lastOpening === '{') {
			stackOfOpenings.pop()
		}

		if (char === ']' && lastOpening === '[') {
			stackOfOpenings.pop()
		}

		i++
	}

	// Now close all unclosed openings
	for (let i = stackOfOpenings.length - 1; i >= 0; i--) {
		const opening = stackOfOpenings[i]
		if (opening === '{') {
			string += '}'
		}

		if (opening === '[') {
			string += ']'
		}

		if (opening === '"') {
			string += '"'
		}
	}

	try {
		return JSON.parse(string)
	} catch (_e) {
		return null
	}
}

/**
 * Models sometimes wrap their JSON in a markdown fence or add a sentence before it,
 * even when told not to. Keep only the JSON so it can still be parsed.
 *
 * Gemini also sometimes copies the chat history's `[ACTION]: {...}` notation instead of
 * returning `{"actions": [...]}`. Convert that into the expected shape.
 */
function stripNonJsonWrapper(string: string) {
	const start = string.indexOf('{')
	if (start === -1) return string

	if (string.slice(0, start).includes('[ACTION]')) {
		const actions = string
			.split(/\[ACTION\]:?/)
			.map((piece) => stripFence(piece.trim()))
			.filter((piece) => piece.startsWith('{'))
		// Left unclosed on purpose: the caller closes any open brackets
		return `{"actions":[${actions.join(',')}`
	}

	return stripFence(string.slice(start))
}

function stripFence(json: string) {
	const fence = json.indexOf('```')
	return (fence === -1 ? json : json.slice(0, fence)).trimEnd()
}
