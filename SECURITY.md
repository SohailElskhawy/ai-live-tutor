# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through GitHub's [private vulnerability reporting](https://github.com/SohailElskhawy/ai-live-tutor/security/advisories/new). Please include:

- what the issue is and where it is (file, route or feature)
- steps to reproduce, or a proof of concept
- the impact you expect

We aim to acknowledge reports within 3 days and to share a fix or mitigation plan within 14 days. We'll credit you in the advisory unless you'd rather stay anonymous.

## Supported versions

Only the latest commit on `main` and the current deployment receive security fixes.

## How the app handles secrets

Useful context for reviewers:

- **Student API keys (BYOK)** are kept only in the page's memory and are cleared on reload. They are sent to the Worker in the `X-Gemini-Key` header, passed through to Google, and never stored, logged or put into prompts.
- **Voice sessions** use single-use, short-lived Gemini ephemeral tokens minted by the Worker (`worker/routes/liveToken.ts`).
- **Worker errors** are reduced to short public messages (`worker/errors.ts`), so SDK errors (which can contain request bodies) never reach the browser.
- **PDFs** are parsed in the browser. Only the extracted text is sent, when generating quizzes or flashcards.
- **Server-side keys** (`GOOGLE_API_KEY`) are only used when `ALLOW_SERVER_KEY=true`. Keep them in `wrangler secret`, never in the repo.

If you find a way any of these guarantees can be broken, that's exactly what we want to hear about.
