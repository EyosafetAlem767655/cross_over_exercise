# Debug deliverables

The repository root is the **pristine upstream tree** from
`trilogy-group/ws-eng-event-ticketing-assessment` @ `rwa/feature-development-v1`
(HEAD `2f09265`) — unmodified, so you can see exactly what changes when you apply
the patch.

| File | What it is |
|---|---|
| [`BUG_REPORT.md`](./BUG_REPORT.md) | Full audit. 9 findings, each reproduced against a live server with real console output, ranked by severity, with impact on the two user stories. |
| [`fixes.patch`](./fixes.patch) | Unified diff fixing findings 1, 2, 4, 5, 6 and 8. Additive-only for `transfer.ts`. Does not implement either user story. |
| [`AI_DEBUG_PROMPT.md`](./AI_DEBUG_PROMPT.md) | Two prompts for pointing another AI assistant at this repo — a blind audit, and a shorter pre-implementation review. |

## The headline

`decrementCapacity()` in `backend/src/lib/capacity.ts` wraps the event-level decrement
inside an `if (booking.seatTierId)` guard, while its counterpart `incrementCapacity()`
always increments it. Cancelling a **non-tiered** booking therefore never frees the seat —
and the seeded sold-out event is non-tiered, so Story 2's "automatic promotion on cancel"
can never fire. See Finding 1.

## Applying the patch

```bash
git apply --stat  debug/fixes.patch   # preview
git apply --check debug/fixes.patch   # dry run
git apply         debug/fixes.patch   # apply

cd backend && npx prisma db push && npm run db:seed   # re-seed: seed.ts changed
npx tsc --noEmit                                      # clean
```
