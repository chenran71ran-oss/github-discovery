# GitHub Discovery

## Architecture

Fork baseline and licenses: UPSTREAM.md.
Astro SSR + same-origin API in src/; scheduled collector in worker/. Shared Zod contracts in shared/. Both bind the same D1 database.

## Requirements

- Keep complete original daily, weekly and monthly membership/ranking. Deduplicate enrichment only.
- Publish snapshots in a D1 transaction; keep the previous complete snapshot after failures.
- Do not block browsing on GitHub or AI requests. Chinese summaries are filled separately.
- Rising uses independent counter observations, with the actual sample interval visible.
- Never commit credentials or author-specific deployment bindings.
- Keep source records, licenses and Git history.

## Validation

- npm run check
- npm test
- npm run build
- npx wrangler deploy --config worker/wrangler.jsonc --dry-run

See README.zh-CN.md for local setup and deployment. No graphify metadata exists in this fork.
