/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** tldraw SDK license key, required in production. See README → Environment variables. */
	readonly VITE_TLDRAW_LICENSE_KEY?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
