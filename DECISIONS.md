# Engineering Decisions

## Problem Understanding

Two stories: attendee-to-attendee ticket transfer, and a waitlist with automatic promotion
when a seat frees up. Both are small on the surface. Both sit on top of shared code that
does not currently behave the way its comments claim, so I audited that code before
planning either one. Full write-up in `debug/BUG_REPORT.md`; the three findings that shape
this plan:

1. **`decrementCapacity()` is asymmetric with `incrementCapacity()`.** The event-level
   decrement sits inside `if (booking.seatTierId)`, so cancelling a *non-tiered* booking
   never frees the seat. Verified: cancelling on the seeded sold-out event returns a
   successful refund while `soldCount` stays at `2/2`. The seeded sold-out event is
   non-tiered, so Story 2's promotion can never fire until this is fixed.
2. **`transferBooking()` cancels and recreates.** Its own docstring flags the trade-off in
   a trailing note. It leaves a `CANCELLED` row in the sender's list and mints a new
   booking id.
3. **Seed dates are hardcoded 2026 literals**, now mostly past. `refund.ts` blocks
   cancelling a past event, so Tests 7 and 9 are undemonstrable on seed data as shipped.

The important thing is that (1) and (2) *interact*. Promotion will naturally hook "a
booking became CANCELLED → a seat freed." A transfer sets `CANCELLED` without freeing a
seat. Wire them naively and every transfer promotes someone, overselling the event.

## Approach

**Fix the foundation first.** Hoist the event decrement out of the guard so the two
capacity helpers are exact inverses, and make seed dates relative to run time. Neither is
in scope, but Story 2 is untestable without both.

**Story 1 — ownership update, not cancel+create.** I'm adding `transferOwnership()` beside
`transferBooking()` rather than reusing or modifying the latter. `transferBooking()` is
correct for organizer *reassignment*, where a fresh audit trail is the point; changing it
in place would silently alter that flow. Transfer is different: the same seat changes
hands. Updating `booking.userId` keeps the id, ticket code and QR valid, genuinely removes
the ticket from the sender's list (Test 2), touches no counters, and — critically — emits
no `CANCELLED` event for Story 2 to misread. Route owns authorization and recipient checks.

**Story 2 — separate `WaitlistEntry` model.** The existing `WAITLISTED` booking-status
pattern forces every queue member to carry a unique `ticketCode`/`qrCodeData`, because
`Booking` requires them. That is how a waitlisted user currently passes check-in. A
dedicated model with `@@unique([eventId, userId])` and an explicit `position` gives real
double-join protection and deterministic ordering, which timestamps on `Booking` do not.
Cost is a schema change plus a seed update — cheap here (SQLite, `db push`). Promotion runs
inside the cancellation transaction so the freed seat and the new ticket commit together.

## Risks & Assumptions

- **Assumed:** transfers are free and non-refundable; a recipient already holding a ticket
  for that event is rejected (mirrors `dashboard.ts`); promotion issues a ticket at the
  original price without payment.
- **Ask the PM:** should promotion be automatic-and-instant, or an offer with a claim
  window? Instant assignment charges nobody and can hand tickets to people who've moved on.
- **Risk:** purchase reads capacity then writes it non-atomically, so concurrent buyers can
  oversell. A waitlist is exactly a race for one seat. Flagging rather than fixing — the
  correct fix changes shared helper signatures and belongs in its own change.

## Implementation Sequence

1. Capacity fix + seed dates — everything downstream is untestable otherwise.
2. Check-in allowlist (`status !== "CONFIRMED"` rejected).
3. Story 1 end to end; verify the sender's list is genuinely empty.
4. Story 2 schema, endpoints, promotion-on-cancel.
5. Regression test proving a transfer does **not** trigger promotion.
6. Frontend, then screenshots.
