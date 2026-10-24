import { IRequest } from 'itty-router'
import { GEMINI_KEY_HEADER, requireGeminiKey } from '../byok'
import { Environment } from '../environment'

export async function stream(request: IRequest, env: Environment) {
	const apiKey = requireGeminiKey(request, env)

	// eventually... use some kind of per-user id, so that each user has their own worker
	const id = env.AGENT_DURABLE_OBJECT.idFromName('anonymous')
	const DO = env.AGENT_DURABLE_OBJECT.get(id)
	const response = await DO.fetch(request.url, {
		method: 'POST',
		body: request.body as any,
		// Forward the student's key to the Durable Object for this request only
		headers: { [GEMINI_KEY_HEADER]: apiKey },
	})

	return new Response(response.body as BodyInit, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
			'Transfer-Encoding': 'chunked',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	})
}
