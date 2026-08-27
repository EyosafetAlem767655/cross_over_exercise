# Prompt for another AI to audit this repo

Paste the block below into a fresh AI coding assistant session (Cline, Cursor, Claude
Code, etc.) with this repository open. It is written to make the assistant *find* the
problems on its own rather than be told what they are — so you can use it as an
independent check on the findings in `BUG_REPORT.md`, or on a different branch / a
future revision of this assessment where the planted bugs may differ.

Two variants are included:

- **Variant A — Blind audit.** Give this to an assistant that has not seen the bug report.
  Use it to independently confirm (or challenge) the findings.
- **Variant B — Pre-implementation review.** Shorter and more targeted at the two user
  stories. Use this one if you just want the traps flagged before you start building.

---

## Variant A — Blind audit

```text
You are auditing an Express + TypeScript + Prisma (SQLite) + Next.js event ticketing
codebase before two new features are built on top of it: (1) attendee-to-attendee ticket
transfer, and (2) an event waitlist with automatic promotion when a seat frees up.

This codebase contains deliberately planted defects in its SHARED code — helper
utilities, seed data, and route handlers that the new features will call into. Several
are disguised: they sit behind confident-sounding doc comments, "centralized" helper
names, and comments elsewhere in the codebase instructing you to reuse them. Treat every
comment as a claim to be verified against the code, never as evidence.

Your job is to find those defects. Do NOT implement the two features.

METHOD — follow this order, do not skip ahead:

1. Read these files in full before forming any hypothesis:
   backend/prisma/schema.prisma
   backend/prisma/seed.ts
   backend/src/lib/capacity.ts
   backend/src/lib/transfer.ts
   backend/src/lib/refund.ts
   backend/src/lib/qr.ts
   backend/src/routes/bookings.ts
   backend/src/routes/events.ts
   backend/src/routes/checkin.ts
   backend/src/routes/dashboard.ts
   backend/src/routes/waitlist.ts
   frontend/src/lib/api.ts
   frontend/src/types/index.ts
   frontend/src/app/bookings/page.tsx
   frontend/src/app/events/[id]/page.tsx

2. For every pair of functions that are supposed to be inverses of each other
   (increment/decrement, create/cancel, add/remove), write the two bodies side by side
   and check they are exact mirrors. Asymmetry between a pair is the highest-yield
   defect class in this codebase. Pay specific attention to whether a conditional guard
   wraps more statements in one function than in its counterpart.

3. Enumerate every value that Booking.status can hold. For each route that branches on
   status, list which values it handles and which it does not. Flag any handler that
   validates by denylist (blocking known-bad values) rather than allowlist (permitting
   only known-good ones) — then name the specific status that slips through and what a
   user could do with it.

4. Check every hardcoded date literal in the seed file against today's actual date. If
   seeded records are in the past, determine which API operations that blocks, and
   whether any acceptance scenario becomes impossible to demonstrate as a result.

5. For any shared utility whose doc comment recommends it for general reuse, read the
   ENTIRE comment including any trailing note, then trace what the function actually
   writes to the database. Ask specifically: does it leave rows behind, mutate ids, or
   set a status that other code elsewhere in the repo reacts to? Grep for other readers
   of that status before answering.

6. Identify read-then-write sequences on capacity counters that are not atomic against
   concurrent requests, and say concretely what two simultaneous users would produce.

7. Cross-check the frontend TypeScript interfaces against what the backend handlers
   actually return. Report any field the API sends that the type does not declare, or
   vice versa.

VERIFICATION — a finding is not a finding until you have run it:

Set the project up and reproduce each defect against a live server. Do not report
anything you have only reasoned about.

  cd backend && cp .env.example .env && npm install
  npx prisma db push && npm run db:seed
  npm run dev          # serves on :4000

Seeded logins: alice@example.com / bob@example.com / carol@example.com (password
"attendee123"); organizer1@example.com / organizer2@example.com (password
"organizer123"). Authenticate via POST /api/auth/login and use the returned JWT as
`Authorization: Bearer <token>`. You can inspect and manipulate the database directly
with a short tsx script importing PrismaClient from @prisma/client — useful for setting
up preconditions the API refuses to create.

For each defect, capture: the state before, the exact request you sent, the response,
and the state after. Paste real console output.

If a precondition blocks you from reproducing something (for example, an operation is
refused for a reason unrelated to the bug you are chasing), that blocker is itself a
finding — record it, then work around it and continue.

OUTPUT — a markdown report containing:

  - A severity-ranked summary table: file:line, one-line description, what breaks.
  - For each finding: the offending code quoted, why it is wrong (compare against the
    code's own stated contract where one exists), real reproduction output, the concrete
    downstream impact on the two planned features, and a minimal fix as a diff.
  - A separate section for issues you judge to be DESIGN DECISIONS rather than outright
    bugs. For those, do not patch: give a recommendation with its trade-off, and state
    what you would need to know to decide.
  - A list of regression tests that would have caught each defect.

CONSTRAINTS:

  - Report only defects you reproduced. If you suspect something but could not trigger
    it, put it in a clearly separated "unverified suspicions" section.
  - Prefer the smallest fix that restores the code's own stated contract. Do not
    refactor beyond the defect.
  - Never change the behavior of an existing endpoint as a side effect of a fix. If a
    correct fix for the new features would alter an existing flow, add a new function
    beside the old one and explain why, rather than mutating shared code in place.
  - After any change, `cd backend && npx tsc --noEmit` must pass.
  - Do not implement the transfer or waitlist features.
```

---

## Variant B — Pre-implementation review

```text
I am about to implement two user stories in this Express/Prisma/Next.js ticketing
codebase and I want the ground checked first. Do not write either feature.

Story 1 — Ticket transfer: an attendee transfers a confirmed ticket to another
registered user by email. Immediate, no approval. The sender must lose the ticket; the
recipient must see it in their bookings with a working QR code for check-in.

Story 2 — Event waitlist: when an event is sold out an attendee can join a waitlist, see
their position, and leave voluntarily. When someone cancels, the next person on the
waitlist automatically receives a confirmed ticket.

Trace both stories end to end through the EXISTING code and tell me every place where the
current implementation will fight me. Specifically:

1. Follow a cancellation from DELETE /api/bookings/:id all the way to the database. Prove
   to me — by running it, not by reading it — that a cancelled seat actually becomes
   available again. Test a non-tiered event and a tiered event separately; do not assume
   they take the same path.

2. Find any existing utility that looks like it already does ticket transfer. Read its
   full doc comment including anything after the first paragraph, then trace exactly what
   rows it writes. Tell me whether reusing it satisfies "the sender must lose the
   ticket", and whether it interacts badly with Story 2's auto-promotion. Grep the
   codebase for everything that reacts to a booking becoming CANCELLED before you answer.

3. Check whether the seed data can actually support demonstrating all of this today.
   Compare every seeded date against the current date, and confirm the seeded sold-out
   event can still be booked and cancelled. If it cannot, say what is blocked.

4. List every Booking.status value and check how the check-in endpoint handles each one.
   Tell me whether a person on the waitlist can get past a scanner.

5. Show me where waitlist ordering would come from and whether it is deterministic.

6. Point out any place two simultaneous users could both claim the last seat.

For every problem: quote the code, show real reproduction output from a running server,
explain the impact on my two stories, and give me the smallest fix as a diff. Where the
right answer is a design decision rather than a fix, say so and give me the trade-off
instead of a patch. Verify `cd backend && npx tsc --noEmit` passes after any change.
```

---

## Notes on using these prompts

- **Run the audit before writing any feature code.** Every one of the findings in
  `BUG_REPORT.md` costs far more to discover halfway through an implementation than up
  front.
- **The "reproduce it or don't report it" constraint is the important part.** Without it,
  assistants reliably produce plausible-sounding findings that turn out to be wrong, and
  equally reliably miss the asymmetry bug in `capacity.ts` because the code *reads* fine.
- **Step 2 of Variant A (compare inverse function pairs side by side) is what catches the
  critical bug.** If you shorten these prompts, keep that step.
- **Watch for the assistant "fixing" `transferBooking()` in place.** That silently changes
  the organizer reassignment flow. The correct move is a new function beside it — which is
  why both prompts carry an explicit constraint against mutating shared behavior.
- If the assistant reports nothing, it almost certainly did not set the project up and
  run it. Ask for the console output.
