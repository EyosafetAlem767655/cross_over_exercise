# Debug deliverables

The repository root is the **pristine upstream tree** from
`trilogy-group/ws-eng-event-ticketing-assessment` @ `rwa/feature-development-v1`
(HEAD `2f09265`) — unmodified, so you can see exactly what changes when you apply
the patch.

| File | What it is |
|---|---|
| [`BUG_REPORT.md`](./BUG_REPORT.md) | Full audit. 9 findings, each reproduced against a live server with real console output, ranked by severity, with impact on the two user stories. |
| [`fixes.patch`](./fixes.patch) | Unified diff fixing findings 1, 2, 4, 5, 6 and 8. Additive-only for `transfer.ts`. Does not implement either user story. |
| [`AI_DEBUG_PROMPT.md`](./AI_DEBUG_PROMPT.md) | Two generic prompts for pointing any AI assistant at this repo — a blind audit, and a shorter pre-implementation review. |
| [`CLINE_PROMPT.md`](./CLINE_PROMPT.md) | Cline-specific prompt: Plan mode, 110K context budget, audit → fix → implement → tests → submission. Includes the submission-script gotchas. |

## The headline

`decrementCapacity()` in `backend/src/lib/capacity.ts` wraps the event-level decrement
inside an `if (booking.seatTierId)` guard, while its counterpart `incrementCapacity()`
always increments it. Cancelling a **non-tiered** booking therefore never frees the seat —
and the seeded sold-out event is non-tiered, so Story 2's "automatic promotion on cancel"
can never fire. See Finding 1.

## Applying the patch

```bash
git apply --stat  debug/implementation.patch   # preview
git apply --check debug/implementation.patch   # dry run
git apply         debug/implementation.patch   # apply

cd backend && npx prisma db push && npm run db:seed   # schema + seed changed
npx tsc --noEmit && cd ../frontend && npx tsc --noEmit
```

Then follow [`SUBMISSION_GUIDE.md`](./SUBMISSION_GUIDE.md). **Delete this `debug/` folder
before submitting** — the submitter excludes `*.patch` but not `.md`.

> `implementation.patch` is force-added to this repo: the root `.gitignore` carries a
> `*.patch` rule, so a plain `git add` silently skips it.
