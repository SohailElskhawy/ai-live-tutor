# Contributing to AI Live Tutor

Thanks for helping! This guide gets you from clone to merged PR.

## Local setup

Requirements: Node.js 22.12+ (or 20.19+), npm, a Chromium-based browser, and a free [Gemini API key](https://aistudio.google.com/apikey) for manual testing.

```bash
git clone https://github.com/<your-username>/ai-live-tutor.git
cd ai-live-tutor
npm install
npm run dev            # http://localhost:5173
```

Paste your Gemini key in the app. Optional local config lives in `.env` and `.dev.vars`; see `.env.example`, `.dev.vars.example` and the README. **Never commit real keys.**

## Before you open a PR

```bash
npm run typecheck
npm run build
npx playwright install chromium   # first time only, unless you have /usr/bin/chromium
npm run test:e2e
```

CI runs the same checks on every PR.

## Branch workflow

1. Fork the repo and create a branch from `main`, for example `feat/whiteboard-snapshots` or `fix/pdf-scanned-error`.
2. Make focused commits with clear messages in the imperative mood ("Add OCR for scanned PDFs").
3. Push and open a PR against `main`, and fill in the template.
4. A maintainer reviews it. Please respond to feedback with new commits rather than force-pushing over review history.

## Coding conventions

- **Match the surrounding code:** TypeScript, tabs, single quotes, no semicolons, and comments only where they explain *why*.
- **Extend the tldraw starter instead of rewriting it.** New agent capabilities are `AgentActionUtil`s and `PromptPartUtil`s registered in `client/modes/AgentModeDefinitions.ts`. See the [starter docs](https://tldraw.dev/starter-kits/agent).
- **The UI uses plain CSS** with the tokens in `client/classroom/classroom.css`. Keep it accessible: labelled controls, visible focus, keyboard support and `prefers-reduced-motion`.
- **Security:**
  - The student's Gemini key must never be logged, persisted or put into prompts. It only travels in the `X-Gemini-Key` header.
  - Worker errors go through `worker/errors.ts`, so SDK internals are never sent to the browser.
- **Tests:** add or update a Playwright test in `tests/` for any change in behavior. Mock Gemini at the network edge, as the existing tests do.
- **No new dependencies** unless they're clearly needed; explain why in the PR.

## Good first contributions

Check issues labelled `good first issue` and `help wanted`, or pick an item from the README roadmap. Open an issue first for larger changes so we can agree on the approach.

## Reporting bugs and requesting features

Use the issue templates. For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Code of Conduct

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
