export interface Environment {
	AGENT_DURABLE_OBJECT: DurableObjectNamespace
	OPENAI_API_KEY?: string
	ANTHROPIC_API_KEY?: string
	GOOGLE_API_KEY?: string
	/** Set to "true" to let requests without a student key fall back to GOOGLE_API_KEY. Off by default. */
	ALLOW_SERVER_KEY?: string
}
