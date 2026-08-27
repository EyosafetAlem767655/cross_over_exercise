# Event Ticketing Platform — Codebase Audit

Audit of `trilogy-group/ws-eng-event-ticketing-assessment` @ branch `rwa/feature-development-v1`
(HEAD `2f09265`). Every finding below was reproduced against a live server (backend on
`:4000`, seeded SQLite DB) — the console output in each section is real, not illustrative.

**Scope note:** this is an audit of the *pre-existing* code, not an implementation of
Story 1 (Ticket Transfer) or Story 2 (Event Waitlist). Those two stories are still yours
to build. What this document does is map the traps that are planted underneath them, so
you don't build on top of broken foundations.

---

## Summary

| # | Severity | Location | What breaks |
|---|----------|----------|-------------|
| 1 | **Critical** | `backend/src/lib/capacity.ts:10-21` | Cancelling a non-tiered booking never frees the seat. Kills Story 2 / Test 9 outright. |
| 2 | **High** | `backend/src/routes/checkin.ts:70-99` | A waitlisted user can scan in and take a seat for free. |
| 3 | **High** | `backend/src/lib/transfer.ts:24-129` | The "shared transfer utility" is the wrong tool for Story 1 — reusing it fails Test 2 and can oversell the event. |
| 4 | **High** | `backend/prisma/seed.ts` | Hardcoded 2026 calendar dates. As of today, 10 of 11 seeded events are in the past and cannot be booked or cancelled at all. |
| 5 | Medium | `backend/prisma/seed.ts:517-545` | Waitlist rows are issued real, scannable QR ticket credentials. |
| 6 | Medium | `backend/prisma/seed.ts:519-545` | Waitlist rows have no deterministic ordering — "position" is ambiguous. |
| 7 | Medium | `backend/src/routes/bookings.ts:207-361` | Capacity check and increment are not atomic against concurrent buyers. |
| 8 | Low | `frontend/src/types/index.ts:143-155` | `DashboardStats` type is missing `waitlistedCount`, which the API returns. |
| 9 | Low | `backend/src/routes/bookings.ts:17-58` | `GET /api/bookings` returns every status with no filter — cancelled and waitlisted rows render as ticket cards. |

Findings **1, 2, 4, 5, 6, 8** are fixed by `debug/fixes.patch`.
Findings **3, 7, 9** are design decisions that belong to your stories — they are explained
here with a recommendation, and the patch adds the building block for #3 without changing
any existing behavior.

---

## Finding 1 — Cancelling a non-tiered booking never frees the seat

**Severity: Critical. This is the single bug that decides Story 2.**

### The code

`backend/src/lib/capacity.ts`

```ts
export async function decrementCapacity(tx: any, booking: any) {
  if (booking.seatTierId) {                 // <-- the guard wraps BOTH updates
    await tx.event.update({
      where: { id: booking.eventId },
      data: { soldCount: { decrement: 1 } },
    });
    await tx.seatTier.update({
      where: { id: booking.seatTierId },
      data: { soldCount: { decrement: 1 } },
    });
  }
}
```

Now compare its counterpart in the same file:

```ts
export async function incrementCapacity(tx, eventId, seatTierId?) {
  await tx.event.update({ ... increment: 1 });     // <-- ALWAYS runs
  if (seatTierId) {
    await tx.seatTier.update({ ... increment: 1 }); // <-- conditional
  }
}
```

The two functions are asymmetric. `incrementCapacity` bumps `event.soldCount` for
**every** booking. `decrementCapacity` only lowers it for **tiered** bookings. For any
general-admission (non-tiered) event, `event.soldCount` is a one-way ratchet: it goes up
on purchase and never comes back down on cancellation.

The file's own header comment — *"all booking/cancellation flows MUST use these helpers
to keep event and tier counts consistent"* — is what makes this so effective as a trap.
It reads as a vetted, authoritative utility, so the natural move is to call it and move on.

### Reproduction

Seeded event *Exclusive Chef's Table Dinner*: `capacity 2`, no tiers, two confirmed
bookings (Alice + Bob) → sold out. Alice cancels via `DELETE /api/bookings/:id`:

```
EVENT BEFORE: {"cap":2,"sold":2}
--- cancelling alice's ticket for the SOLD-OUT, NON-TIERED event ---
{"success":true,"message":"Booking cancelled successfully",
 "data":{"refundAmount":237.5,"refundPercentage":100,"serviceFee":12.5}}
EVENT AFTER : {"cap":2,"sold":2}     <-- still 2. The seat was never freed.
```

The cancellation succeeded. The refund was calculated and issued. The booking row is now
`CANCELLED`. And `soldCount` is still 2, so the event is permanently sold out with only
one live ticket in existence.

### Blast radius

- **Story 2 / Test 9 (`Automatic Promotion on Cancel`) cannot pass.** Whatever promotion
  logic you write is going to ask "is there a free seat now?" The answer will always be no.
  Worse, the seeded sold-out event — the only one you'd naturally use for this test — is
  non-tiered, so it lands squarely in the broken branch. You will write correct promotion
  code, watch it silently do nothing, and lose an hour debugging your own work.
- **Story 2 / Test 7** is affected too. Once the event's `soldCount` is stuck at capacity,
  it stays "Sold Out" in the UI forever, even after cancellations.
- Independently of the assessment: `GET /api/events/:id` reports wrong remaining capacity,
  the dashboard's `remainingCapacity` (`dashboard.ts:187`) is wrong, and the event detail
  page's *"N tickets remaining"* line (`events/[id]/page.tsx:247`) is wrong.

### Fix

Hoist the event-level decrement out of the guard so the two helpers are mirror images.

```ts
export async function decrementCapacity(tx: any, booking: any) {
  await tx.event.update({
    where: { id: booking.eventId },
    data: { soldCount: { decrement: 1 } },
  });

  if (booking.seatTierId) {
    await tx.seatTier.update({
      where: { id: booking.seatTierId },
      data: { soldCount: { decrement: 1 } },
    });
  }
}
```

Verified after the fix:

```
[capacity] BEFORE cap=2 sold=2
[capacity] cancel HTTP 200 {"refundAmount":237.5,...}
[capacity] AFTER  cap=2 sold=1  -> seat freed: true
```

Two existing callers benefit immediately: `bookings.ts:496` (attendee cancel) and
`events.ts:280` (organizer cancels the whole event). The latter happened to be masked —
it overwrites `soldCount: 0` right afterwards at `events.ts:296` — which is exactly why
nobody noticed the helper was broken.

---

## Finding 2 — A waitlisted user can check in and take a seat

**Severity: High.**

### The code

`backend/src/routes/checkin.ts` validates by denylist:

```ts
if (booking.event.status === "CANCELLED") { ... }   // blocked
if (booking.status === "CANCELLED")       { ... }   // blocked
if (booking.status === "CHECKED_IN")      { ... }   // blocked
// ...then falls straight through to:
await prisma.booking.update({ data: { status: "CHECKED_IN", checkedInAt: new Date() } });
```

`WAITLISTED` is a legitimate value of `Booking.status` (declared in `schema.prisma:100`
and in `validations.ts:60`), and it is not on the denylist. So a waitlist row — which
`seed.ts` gives a real `ticketCode` and a real, parseable `qrCodeData` — sails through
and is marked as a checked-in attendee.

### Reproduction

```
WAITLISTED booking: carol@example.com -> Exclusive Chef's Table Dinner | pricePaid 0
qrCodeData: {"code":"39cf1726effc95208c7624c2ad620f94","ts":1787823027013}
HTTP 200 {"success":true,"message":"Check-in successful",
          "data":{"attendee":{"name":"Carol Thompson"}, "event":{"name":"Exclusive Chef's Table Dinner"}}}
status after scan: CHECKED_IN | checkedInAt: 2026-08-27T09:31:40.640Z
```

Carol paid $0, holds no ticket, is #1 in a queue — and the scanner welcomed her in.

This also silently corrupts the dashboard: `dashboard.ts:40` counts `CHECKED_IN` as an
*active booking*, so Carol now inflates `totalTicketsSold`, `attendanceRate`, and the
category breakdown.

### Fix

Validate by allowlist. Only a `CONFIRMED` booking is a ticket:

```ts
if (booking.status !== "CONFIRMED") {
  return res.status(400).json({
    success: false,
    error: "INVALID_TICKET",
    message: "This booking is not a valid ticket for check-in",
  });
}
```

The patch also stops `seed.ts` handing waitlist rows scannable credentials (Finding 5),
so the two fixes are belt and braces. Verified — both layers hold independently:

```
# with the seed fix (marker payload, unparseable as a ticket)
[checkin] scanning carol@example.com's WAITLISTED row -> HTTP 400 {"error":"INVALID_QR"}

# with a legacy row that still carries valid ticket QR JSON
legacy WAITLISTED row w/ valid QR -> HTTP 400 {"error":"INVALID_TICKET",
  "message":"This booking is not a valid ticket for check-in"}
status after: WAITLISTED
```

---

## Finding 3 — `transferBooking()` is the wrong tool for Story 1

**Severity: High (as a trap). Not a bug in its own flow — a bug if you reuse it.**

This one is deliberately baited. Three separate comments in the codebase point you at it:

- `bookings.ts:9-12` — *"Booking ownership changes: see lib/transfer.ts…"*
- `dashboard.ts:317-319` — *"All booking ownership changes should go through
  transferBooking() for consistency."*
- and `transfer.ts` itself carries a long, confident docstring.

Read past the first paragraph of that docstring and it tells on itself:

> *"NOTE: This cancel+create approach has trade-offs. It generates a new booking ID and
> ticket code, which breaks any external references to the original booking. For flows
> where the recipient simply takes over an existing ticket (no new credentials needed), a
> direct userId update on the booking record would be simpler and preserve booking
> continuity. Evaluate which trade-off fits your use case."*

### What it actually does

`transferBooking()` marks the original booking `CANCELLED` (with `cancelledAt` set),
decrements capacity, re-increments it, and creates a brand-new booking row with fresh
`ticketCode`/`qrCodeData` for the recipient. That is a reasonable design for the
*organizer reassignment* flow it was written for: the audit trail is the point.

It is the wrong design for an attendee transfer.

### Reproduction — what a naive Story 1 built on it looks like

```
BEFORE: booking cmtbbo4bi001okapalt88oidx owner=alice@example.com ticket=7542b390 | event soldCount=1
reassign HTTP 200 -> new booking id: cmtbbq2nm0004t6d5sw4ywcry new ticket: 47b7b4e4
AFTER : event soldCount=1 (net-zero, ok)
Alice's /api/bookings rows for this event: [{"id":"cmtbbo4bi001okapalt88oidx","status":"CANCELLED"}]
GET /api/bookings/cmtbbo4bi001okapalt88oidx as Alice -> HTTP 200
```

Three concrete failures against the acceptance tests:

1. **Test 2 fails.** The requirement is *"ticket no longer in original attendee's
   bookings."* It is still there. `GET /api/bookings` (`bookings.ts:19-47`) applies no
   status filter, so Alice's list still renders a card for the transferred ticket — now
   badged `Cancelled`. It has not left her account, it has just changed color.
2. **Test 6 is fragile.** The recipient gets a *different booking id*, so any previously
   shared or bookmarked `/tickets/<old-id>` URL is dead, and the old QR code — which may
   already be on someone's phone — is now attached to a cancelled row.
3. **Story 2 gets poisoned.** This is the subtle one. Your waitlist auto-promotion will
   almost certainly hook "a booking became CANCELLED → free seat → promote next in line."
   A transfer sets a booking to `CANCELLED` while the seat never actually became free.
   Promotion fires anyway and you oversell the event. The two stories collide precisely
   here, and it only shows up when you test them together.

There is also a fourth, quieter cost: `dashboard.ts:42` counts every `CANCELLED` row as a
refund event, so each transfer inflates `totalRefundCount` with a $0 phantom refund.

### Recommendation

Leave `transferBooking()` alone — it is correct for organizer reassignment, and changing
it would silently alter that flow. Add a second, ownership-preserving function beside it
and use *that* for Story 1. The patch adds it (`transferOwnership()` in
`backend/src/lib/transfer.ts`), fully documented, purely additive:

```ts
export async function transferOwnership(tx, bookingId, recipientId) {
  // ...guards: booking exists, status === CONFIRMED, recipient !== current owner
  return tx.booking.update({
    where: { id: booking.id },
    data: { userId: recipientId },   // same row, same id, same ticketCode, same QR
    include: { event: {...}, seatTier: {...}, user: {...} },
  });
}
```

Same booking id, same ticket code, same QR, status stays `CONFIRMED`, capacity untouched,
and nothing downstream that watches for `CANCELLED` is fooled. Your route still owns
authorization (does the caller own this booking?) and recipient resolution (does that
email exist? is it a different user? do they already hold a ticket for this event?) —
`dashboard.ts:360-384` is a good model for those checks.

Documenting *why* you chose this over the "shared utility" the comments push you toward
is exactly the reasoning the Engineering Judgment criterion is looking for.

---

## Finding 4 — Seed dates are hardcoded and have already expired

**Severity: High (blocks running the app at all).**

`seed.ts` hardcodes calendar dates: `new Date("2026-07-15")`, `new Date("2026-03-20")`,
and so on. Run against today's date, **10 of the 11 seeded events are in the past.**

This is not cosmetic. `refund.ts:85` blocks cancellation of past events outright, and it
is the very first thing I hit trying to reproduce Finding 1:

```
EVENT BEFORE: {"cap":2,"sold":2}
--- cancelling alice's ticket for the SOLD-OUT, NON-TIERED event ---
{"success":false,"error":"PAST_EVENT","message":"This event has already passed. Cancellation is not allowed."}
```

The seeded sold-out event (*Chef's Table Dinner*, `2026-06-05`) is in the past, which
means **Test 9 cannot be demonstrated on seed data at all** — you cannot cancel a booking
for it, so you can never trigger the promotion you are being asked to screenshot. The
event detail page also disables the buy button for past events
(`events/[id]/page.tsx:111-112`), so Test 7 is blocked too.

### Fix

Make dates relative to the run date:

```ts
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}
```

...and use it for all 11 events plus the promo-code validity windows, preserving the
original relative spacing (14 to 180 days out). Verified:

```
[dates] events in the past: 0/11
```

The 14-day-out event keeps the TIERED refund policy's `>= 7 days = 100%` branch
exercisable, and the promo windows stay meaningfully open/closed as before.

> If you'd rather not touch `seed.ts`, the minimum workaround is to bump one future,
> non-tiered, sold-out event by hand before recording Tests 7 and 9. Fixing the seed is
> cleaner and is itself a documentable finding.

---

## Finding 5 — Waitlist rows are issued real ticket credentials

**Severity: Medium.** Feeds Finding 2.

`seed.ts:518-529` creates waitlist rows with `generateTicketCode()` and
`generateQRData()` — the same functions used for real tickets. A person waiting in a
queue is handed a scannable QR code.

The root cause is structural: `schema.prisma:98-99` makes `ticketCode` and `qrCodeData`
non-nullable and `@unique`, so *any* row in `Booking` must carry ticket credentials —
including rows that are not tickets. Modelling the waitlist as a `Booking` status forces
this.

**Fix (in the patch):** store a deliberately non-ticket marker, `WAITLIST:<code>`, which
`parseQRData()` (`qr.ts:27-37`) cannot parse, so a scanner rejects it before any status
check runs.

**Worth considering for Story 2:** a separate `WaitlistEntry` model with `@@unique([eventId, userId])`,
a `position` or `joinedAt`, and no ticket columns is the cleaner data model. It also gives
you a real uniqueness constraint against double-joining, which a status value cannot. The
trade-off is a schema migration and more code. Either choice is defensible — say which you
picked and why in `DECISIONS.md`.

---

## Finding 6 — Waitlist position has no deterministic ordering

**Severity: Medium.**

Tests 7 and 8 require showing the attendee their *position*. There is no `position` column,
so position has to be derived by ordering on `createdAt`. But `seed.ts` writes both
waitlist rows in an unbroken sequence, and SQLite `DateTime` resolution is milliseconds —
two rows written in the same millisecond have no defined order, so "you are #1" and
"you are #2" can swap between page loads.

The seed's own log line asserts an order it does not actually guarantee:

```
Waitlisted: Carol + Mike Johnson on Chef's Table Dinner
```

**Fix (in the patch):** set `createdAt` explicitly on the second row so the seeded queue
is unambiguous. Verified:

```
[waitlist] deterministic order: 1. carol@example.com @2026-08-27T09:34:23.881Z  |  2. organizer2@example.com @2026-08-27T09:34:24.882Z
```

For your own implementation, prefer an explicit monotonic `position` (or a
`joinedAt` you control) over relying on insertion timestamps.

> Also note the seeded queue puts **organizer2 (Mike Johnson)** on the waitlist — an
> organizer account waiting for another organizer's event. Harmless, but if your Story 2
> code assumes waitlist members are attendees, this row will surprise you.

---

## Finding 7 — Purchase is not atomic against concurrent buyers

**Severity: Medium. Not fixed in the patch — see below.**

`bookings.ts:207-263` reads capacity and then writes it:

```ts
if (tier.soldCount >= tier.capacity) throw new Error("SOLD_OUT:...");   // read
// ...
await incrementCapacity(tx, eventId, selectedTierId);                    // write
```

Two concurrent requests for the last seat can both read `soldCount = capacity - 1`, both
pass the check, and both increment — overselling by one. Prisma's interactive transaction
does not serialize these by itself; the check is a plain read, not a conditional write.

This matters more than usual for Story 2: a waitlist is *precisely* a queue of people
racing for the same freed seat, and auto-promotion runs concurrently with ordinary
purchases.

**Why it is not in the patch:** the correct fix is a guarded conditional write — an
`updateMany` with `where: { id, soldCount: { lt: <capacity> } }` that returns `count: 0`
when it loses the race — and column-to-column comparison in Prisma 5 needs field
references (`prisma.seatTier.fields.capacity`), which changes the helpers' signatures and
every call site. That is a real change to shared code and should be your deliberate
decision, not something a patch does behind your back. Flagging it in `DECISIONS.md`
with the reasoning is worth more here than a rushed refactor.

---

## Finding 8 — `DashboardStats` type is missing a returned field

**Severity: Low.** Fixed in the patch.

`dashboard.ts:43,110` computes and returns `waitlistedCount`. The frontend interface
`DashboardStats` (`frontend/src/types/index.ts:143-155`) does not declare it, so the field
is invisible to TypeScript — reading `stats.waitlistedCount` in a Story 2 dashboard widget
is a compile error against a field the API is already sending. One line:

```ts
waitlistedCount: number;
```

Small, but it tells you something: someone started wiring the waitlist through the backend
and stopped. The stub at `routes/waitlist.ts` (mounted at `index.ts:35`, exporting an empty
router with a `// TODO`) is the other half of that.

---

## Finding 9 — `GET /api/bookings` returns every status unfiltered

**Severity: Low. Design decision for your stories — not fixed in the patch.**

`bookings.ts:19-47` has no `status` filter, so the response mixes live tickets, cancelled
rows, and waitlist placeholders. The frontend renders all of them as booking cards
(`bookings/page.tsx:109-160`); `statusBadge()` has no `WAITLISTED` case and falls through
to `default: <Badge>{status}</Badge>`, so a queue entry shows up as a ticket card with a
raw `WAITLISTED` badge and a truncated "ticket" code.

This intersects both stories directly:

- **Story 1 / Test 2** needs the transferred ticket to be *gone* from the sender's list.
  With `transferOwnership()` (Finding 3) it genuinely is, because the row's `userId`
  changes. With `transferBooking()` it is not.
- **Story 2 / Test 8** needs the waitlist position *displayed*. So you do want waitlist
  rows surfaced here — but as a distinct "You're #2 on the waitlist" affordance, not as a
  ticket card. Test 10 then needs it to disappear on leaving.

I have left this alone deliberately: filtering here is a product decision your stories
define, and changing it under you could break the very tests you are about to record.
Decide it explicitly and write it down.

---

## Applying the fixes

The repo in this branch is the **pristine upstream tree**. The fixes live in
`debug/fixes.patch` so you can see exactly what changes before you take it.

```bash
# preview
git apply --stat debug/fixes.patch
git apply --check debug/fixes.patch     # dry run, no changes

# apply
git apply debug/fixes.patch

# re-seed (required — seed.ts changed) and verify
cd backend && npx prisma db push && npm run db:seed
npx tsc --noEmit                        # backend typecheck: clean
```

Files touched: `backend/src/lib/capacity.ts`, `backend/src/routes/checkin.ts`,
`backend/prisma/seed.ts`, `backend/src/lib/transfer.ts` (additive only),
`frontend/src/types/index.ts`. 141 insertions, 21 deletions.

Nothing in the patch implements Story 1 or Story 2, and nothing changes the behavior of
an existing endpoint except to make it correct.

---

## Suggested regression tests

The rubric's top Test Cases band asks for *"regression tests for issues discovered in the
codebase."* These four map one-to-one onto the findings above and are the cheapest way to
claim it:

1. **Non-tiered cancellation frees a seat** — book a non-tiered event to capacity, cancel
   one, assert `event.soldCount` dropped by exactly 1. (Finding 1)
2. **Tiered cancellation stays symmetric** — same for a tiered booking, asserting *both*
   `event.soldCount` and `seatTier.soldCount` dropped by 1. Guards against over-correcting
   the fix in the other direction.
3. **Waitlisted rows cannot check in** — `POST /api/checkin` with a `WAITLISTED` booking's
   `qrCodeData` returns 4xx and the row's status is unchanged. (Finding 2)
4. **Transfer does not free a seat** — transfer a ticket, assert `event.soldCount` is
   unchanged and that no waitlist promotion fired. This is the test that catches the
   Story 1 × Story 2 collision. (Finding 3)
