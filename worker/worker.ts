import { ExecutionContext } from '@cloudflare/workers-types'
import { WorkerEntrypoint } from 'cloudflare:workers'
import { AutoRouter, cors, error, IRequest } from 'itty-router'
import { Environment } from './environment'
import { toPublicError } from './errors'
import { liveToken } from './routes/liveToken'
import { stream } from './routes/stream'
import { study } from './routes/study'

const { preflight, corsify } = cors({ origin: '*' })

const router = AutoRouter<IRequest, [env: Environment, ctx: ExecutionContext]>({
	before: [preflight],
	finally: [corsify],
	catch: (e) => {
		const { status, message } = toPublicError(e)
		console.error(`Request failed (${status}): ${message}`)
		return error(status, message)
	},
})
	.post('/stream', stream)
	.post('/live/token', liveToken)
	.post('/study', study)

export default class extends WorkerEntrypoint<Environment> {
	override fetch(request: Request): Promise<Response> {
		return router.fetch(request, this.env, this.ctx)
	}
}

// Make the durable object available to the cloudflare worker
export { AgentDurableObject } from './do/AgentDurableObject'
