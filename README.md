# AI Live Tutor

A bring-your-own-key AI study assistant. Talk to a tutor out loud: it explains by voice, draws and edits diagrams on a shared tldraw whiteboard, and builds quizzes and flashcards from your PDFs.

Built on the [tldraw agent starter kit](https://tldraw.dev/starter-kits/agent). The drawing agent, Vite app and Cloudflare Worker are the starter's, extended rather than replaced.

## What it does

- **Live voice tutoring.** Gemini Live API with natural interruptions: start talking over the tutor and it stops immediately.
- **Draws while it explains.** Gemini's tool calls (`draw_on_whiteboard`, `edit_whiteboard`, `look_at_whiteboard`, `stop_drawing`) drive the existing tldraw agent through `agent.interrupt(...)`, so "make that arrow red" edits the diagram already on the board.
- **Student drawings are protected.** Shapes the student draws are tagged, and the agent's delete action refuses to remove them.
- **Study from your PDF.** Text is extracted in the browser with pdf.js. The tutor and the drawing agent both use it as context.
- **MCQ quizzes and flashcards** generated from the PDF with structured output.
- **BYOK.** The student's Gemini key is held only in memory, passed to the Worker in a header, and never stored or logged.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and paste a Gemini API key (free from [Google AI Studio](https://aistudio.google.com/apikey)).

Optional: to let requests without a student key use a server key during local development, create `.dev.vars`:

```
GOOGLE_API_KEY=your_key
ALLOW_SERVER_KEY=true
```

Leave `ALLOW_SERVER_KEY` unset in production unless you mean to pay for every visitor.

## Test

```bash
npm run typecheck
npm run test:e2e
```

The Playwright suite runs the real app and Worker. Gemini is mocked at the network edge (the Live WebSocket, `/stream` and `/study`), so the full definition-of-done flow runs without a key:

- speak → tutor answers → whiteboard draws → student interrupts → tutor edits the same diagram
- PDF upload → MCQ quiz with scoring → flashcards
- key validation, key never in storage, student drawings survive agent deletes
- friendly errors from the real Worker with an invalid key
- no horizontal overflow at 1440, 768 and 375 px

It uses `/usr/bin/chromium` by default; set `PLAYWRIGHT_CHROMIUM_PATH` to use another browser.

## Deploy

```bash
npx wrangler login
npm run deploy
```

## How it fits together

```
Browser                                         Cloudflare Worker
──────────────────────────────────────────      ─────────────────────────────
KeyDialog → keyStore (memory only)
LiveTutor ── POST /live/token ───────────────→  liveToken: mints a 1-use ephemeral token
   │  └─ WebSocket (token) ─→ Gemini Live
   │       mic 16 kHz PCM →   ← 24 kHz audio, transcripts, tool calls
   ▼
BoardBridge ── agent.interrupt() ─→ TldrawAgent ── POST /stream ──→ AgentDurableObject
                                                    (X-Gemini-Key)   → AgentService (per-request key)
StudyPanel ── pdf.js (in browser)
           └─ POST /study (X-Gemini-Key) ──────→  study: generateObject → Quiz | Flashcards
```

| Area | Files |
|---|---|
| BYOK | `client/tutor/keyStore.ts`, `worker/byok.ts`, `worker/errors.ts` |
| Voice | `client/voice/LiveTutor.ts`, `client/voice/audio.ts`, `worker/routes/liveToken.ts`, `shared/live.ts` |
| Agent bridge | `client/tutor/boardBridge.ts`, `worker/prompt/sections/tutor-section.ts`, `client/actions/DeleteActionUtil.ts` |
| Study | `client/study/*`, `client/parts/StudyMaterialPartUtil.ts`, `worker/routes/study.ts`, `shared/study.ts` |
| UI | `client/classroom/*`, `client/App.tsx` |

Models are set in `shared/live.ts` (voice and study) and `shared/models.ts` (drawing agent).

## License

Built on the tldraw SDK. The "Made with tldraw" watermark must stay on the canvas unless you have a [tldraw business license](https://tldraw.dev/pricing).
