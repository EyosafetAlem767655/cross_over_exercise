# Event Ticketing Platform - User Story Requirements

## Assessment Overview

Read the user story requirements below carefully. Use AI to:
1. Document your approach, reasoning, and questions in `DECISIONS.md`.
2. Make code changes to implement the requirements.
3. Run the acceptance tests manually and capture screenshots as evidence.
4. Submit your work by following the instructions in README.md.

**Target Time:** ~3 hours for both stories

---

## Existing Features

The platform already includes:
- **Seat Tier System** — Events can have multiple seat tiers (e.g., Standing, Gold, VIP) with independent pricing and capacity tracking. Organizers manage tiers from the dashboard.
- **Promo Code System** — Organizers can create percentage or fixed-amount discount codes per event with validity windows and usage limits. Attendees apply codes at checkout.
- **Cancellation & Refund System** — Attendees can cancel bookings with time-based refund policies (full refund, tiered, or no-refund). The platform calculates refunds with a service fee.
- **Event Categories** — Events are categorized (Music, Sports, Conference, etc.) with filtering on the home page.
- **Organizer Dashboard** — Revenue analytics, category breakdown, and ticket management including a reassignment feature for organizers.

You do **not** need to implement these — they are already built and working. Your task is to implement the two stories below, which should integrate with the existing codebase.

---

# Story 1: Ticket Transfer

## Summary

As an **attendee**, I want to transfer my ticket to another registered user so that someone else can attend if I can't make it.

## Requirements

- Attendees can transfer a confirmed ticket to another user by entering the recipient's email address
- The recipient must have a registered account on the platform
- The transfer is immediate — no approval workflow needed
- The original attendee loses access to the ticket after transfer
- The recipient can view the transferred ticket in their bookings

## Acceptance Tests

### Test 1: Transfer Form
**Given:** Logged in as Attendee with a confirmed booking
**When:** Navigate to ticket detail page and initiate transfer
**Then:** [SCREENSHOT] Transfer form visible with email input field

### Test 2: Successful Transfer
**Given:** Logged in as Attendee (e.g., alice@example.com)
**When:** Enter valid recipient email (e.g., bob@example.com) and confirm transfer
**Then:** [SCREENSHOT] Success message; ticket no longer in original attendee's bookings

### Test 3: Recipient Receives Ticket
**Given:** Logged in as Recipient (e.g., bob@example.com)
**When:** View bookings page
**Then:** [SCREENSHOT] Transferred ticket visible in recipient's booking list

### Test 4: Invalid Recipient
**Given:** On transfer form
**When:** Enter email of non-existent user
**Then:** [SCREENSHOT] Appropriate error message displayed

### Test 5: Already Cancelled Booking
**Given:** Booking status is CANCELLED
**When:** Attempt to transfer
**Then:** [SCREENSHOT] Appropriate error message

### Test 6: Transferred Ticket Details
**Given:** Logged in as Recipient after receiving transfer
**When:** View ticket detail page with QR code
**Then:** [SCREENSHOT] Ticket detail page with valid QR code for check-in

---

# Story 2: Event Waitlist

## Summary

As an **attendee**, I want to join a waitlist for a sold-out event so that I can automatically get a ticket if someone cancels.

## Requirements

- When an event is sold out, attendees can join a waitlist
- When a ticket becomes available (e.g., someone cancels), the next person on the waitlist should automatically receive a ticket
- Attendees can view their waitlist position
- Attendees can leave the waitlist voluntarily
- The event detail page should show a "Join Waitlist" button when the event is sold out (instead of the buy button)

## Acceptance Tests

### Test 7: Join Waitlist on Sold-Out Event
**Given:** Logged in as Attendee; viewing a sold-out event
**When:** Click "Join Waitlist"
**Then:** [SCREENSHOT] Confirmation that you've been added to the waitlist with your position

### Test 8: View Waitlist Position
**Given:** Logged in as Attendee who is on the waitlist
**When:** View bookings or event page
**Then:** [SCREENSHOT] Current waitlist position is displayed

### Test 9: Automatic Promotion on Cancel
**Given:** Event is sold out; carol@example.com is on the waitlist
**When:** Another attendee cancels their booking for that event
**Then:** [SCREENSHOT] Carol automatically receives a confirmed ticket (visible in her bookings)

### Test 10: Leave Waitlist
**Given:** Logged in as Attendee who is on the waitlist
**When:** Choose to leave the waitlist
**Then:** [SCREENSHOT] Removed from waitlist; position no longer shown

---

# Submitting Your Work

1. Place screenshots in the `submission` folder
2. Name them descriptively: `test1-transfer-form.png`, `test7-join-waitlist.png`, `test9-auto-promotion.png`, etc.
3. Document your reasoning and any questions in `DECISIONS.md`
4. Follow submission instructions in README.md
