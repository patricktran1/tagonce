# Contributing to TagOnce

TagOnce favors small, reviewable changes that preserve the distinction between native platform mentions, plain text, missing mappings, and unsupported behavior.

## Local setup

Requires Node.js 22 or later.

```bash
npm install
npm run validate
npm run test:coverage
```

## Contribution expectations

- Add or update tests for every behavior change.
- Keep platform-specific logic behind explicit adapter boundaries.
- Do not represent mock publishing as a live platform integration.
- Never commit OAuth tokens, API keys, private analytics, or user content.
- Preserve deterministic fallback behavior when AI generation is unavailable.
- Explain any new storage, authentication, queueing, or credential boundary in the pull request.

## Pull request checklist

- [ ] The change is focused and documented.
- [ ] `npm run validate` passes.
- [ ] Coverage includes important success and failure paths.
- [ ] No secrets or personal data are included.
- [ ] Mock and production behavior remain clearly labeled.
