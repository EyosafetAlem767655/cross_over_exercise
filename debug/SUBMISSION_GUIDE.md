# What you do in VS Code

Everything up to the screenshots is done and verified. Three things need a human: applying
the patch in your Codespace, capturing the 10 screenshots, and running the interactive
submit command.

---

## Step 1 — Apply the patch

In your **Codespace** (not a copy of the repo — see the warning at the bottom), on branch
`rwa/feature-development-v1`:

```bash
# put debug/implementation.patch somewhere in the repo, then:
git apply --check debug/implementation.patch    # dry run, changes nothing
git apply debug/implementation.patch
```

Then rebuild the database — the schema gained a table and the seed changed:

```bash
cd backend
npx prisma db push        # creates WaitlistEntry, regenerates the Prisma client
npm run db:seed
cd ..
```

Verify before going further:

```bash
cd backend  && npx tsc --noEmit    # expect: no output
cd ../frontend && npx tsc --noEmit # expect: no output
```

**Delete the `debug/` folder before you submit.** The submitter excludes `*.patch` but not
`.md`, so `BUG_REPORT.md` and the prompt files would otherwise be bundled into your graded
submission.

---

## Step 2 — Run the tests (this is a screenshot too)

Two terminals:

```bash
# Terminal 1
npm run dev

# Terminal 2
cd backend && npm test
```

Expect `25 passed, 0 failed`. Screenshot that terminal output as
`test0-automated-suite.png` — it is direct evidence for the Test Cases criterion, and it
costs you nothing.

---

## Step 3 — Capture the 10 screenshots

Reset first so the data is in a known state: `npm run db:reset`, then `npm run dev`.

Seed facts you need:
- **Exclusive Chef's Table Dinner** — capacity 2, sold out (Alice + Bob), Carol is **#1** on
  the waitlist and Mike Johnson is #2.
- **JavaScript Mastery Workshop** — Alice has a ticket, Bob does **not**. This is the one to
  transfer; most other events are held by both.

Passwords: attendees `attendee123`, organizers `organizer123`.

### Story 1 — Transfer (do these in order, one login as Alice)

| # | File | Steps |
|---|------|-------|
| 1 | `test1-transfer-form.png` | Log in as `alice@example.com` → **My Bookings** → *JavaScript Mastery Workshop* → **View Ticket** → **Transfer Ticket**. Capture the modal showing the email input. |
| 4 | `test4-invalid-recipient.png` | In that same modal, enter `nobody@example.com` → **Confirm Transfer**. Capture the error: *"No registered user found with that email address."* |
| 2 | `test2-transfer-success.png` | Clear the field, enter `bob@example.com` → **Confirm Transfer**. Capture the success message. Then go to **My Bookings** and capture that the JS Workshop card is **gone** — not greyed out, gone. Two shots are fine (`test2-transfer-success.png`, `test2-sender-bookings.png`). |
| 3 | `test3-recipient-bookings.png` | Log out, log in as `bob@example.com` → **My Bookings**. Capture the JS Workshop ticket now in his list. |
| 6 | `test6-transferred-ticket-qr.png` | Still as Bob → **View Ticket** on that booking. Capture the ticket page with the QR code rendered. |

**Test 5 needs one bit of setup**, because a cancelled booking has no "View Ticket" button:

| # | File | Steps |
|---|------|-------|
| 5 | `test5-cancelled-transfer.png` | As Alice → **My Bookings** → *Jazz Night Under the Stars* → **View Ticket** → **copy the URL** from the address bar. Go back, **Cancel** that booking, then paste the URL. Capture the page: the *"no longer valid"* banner plus the disabled transfer panel reading *"This booking has been cancelled and can no longer be transferred."* |

### Story 2 — Waitlist

Carol is seeded at **#1**, and Test 9 requires her to stay there. So use a **new account**
for the join/leave shots rather than Carol.

| # | File | Steps |
|---|------|-------|
| 7 | `test7-join-waitlist.png` | **Register** a new account (e.g. `dave@example.com`). Go to *Exclusive Chef's Table Dinner*. The buy button is replaced by **Join Waitlist** — click it. Capture the confirmation with the position number. |
| 8 | `test8-waitlist-position.png` | Still as Dave → **My Bookings**. Capture the *On the Waitlist* card showing *"You are #N of M on the waitlist."* (The event page also shows the position box — either is valid evidence.) |
| 10 | `test10-leave-waitlist.png` | As Dave → **Leave Waitlist** (from either page). Capture the confirmation and that the position is no longer shown. |
| 9 | `test9-auto-promotion.png` | Log in as `alice@example.com` → **My Bookings** → *Exclusive Chef's Table Dinner* → **Cancel**. The success message names Carol as promoted — capture it. Then log in as `carol@example.com` → **My Bookings** and capture her new **Confirmed** ticket for Chef's Table. Two shots (`test9-cancel-promotion.png`, `test9-carol-ticket.png`). |

Save every file **directly in `submission/`** — no subfolders. PNG or JPG.

---

## Step 4 — Submit

From the project root, in the VS Code integrated terminal (not through Cline — it prompts
interactively and an agent's terminal will hang):

```bash
npm run submit <YOUR_ASR_ID>
```

It asks for your name, your email, then prints a summary and a warnings block. **Read the
warnings before answering the confirm.** Abort with `n` if you see any of:

- `Code: submission/submission.patch (size = 0)` or a very small size — the diff came out
  empty. Fix that before submitting (see below).
- *No screenshots found in submission/ folder* — 0 stars on completeness.
- *No Cline chat history found* — 0 stars. Never clear your Cline history.
- *DECISIONS.md is very small* — it should be the ~580-word version.

On success:

```
Submission successful, ID: <submission-id>
```

Paste that ID into the Crossover assessment page. You can resubmit freely; only the ID
recorded there is graded.

---

## The one thing that will silently ruin this

`submit.ts` builds your patch with:

```
git diff origin/rwa/feature-development-v1...HEAD
```

Three dots means **merge base**. If you run the submitter from anywhere that is not a real
clone of `trilogy-group/ws-eng-event-ticketing-assessment`, there is no merge base and the
patch comes out empty — you submit screenshots attached to no code. The script also
silently rewrites your `origin` remote to the upstream URL if it doesn't match, which is
why the README says not to fork.

So: **do all of this in the Codespace**, not in the `cross_over_exercise` repo. If the diff
does come out empty, run `git fetch origin rwa/feature-development-v1` and try again.

You do not need to commit first — the script runs `git add --all` and commits for you — but
committing beforehand is safer and makes the diff easier to inspect.
