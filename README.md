# Event Ticketing Platform - AI Augmented Design and Implementation

## Overview

You will extend a full-stack event ticketing platform with new features using an AI coding assistant. The platform already has event management, seat tiering, promo codes, and ticket purchase functionality built in. You will add new user stories on top of this existing codebase — extending the data model, adding API endpoints, and updating the frontend.

Your implementation time will be tracked once the user story requirements are revealed. Before revealing them, please go through the content below.

## Tech Stack

- **Backend:** Express.js, TypeScript, Prisma ORM, SQLite
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Auth:** JWT tokens with bcryptjs password hashing
- **QR Codes:** qrcode library for ticket generation

## Preparation Steps

Before starting the assessment, you should:

### 1. Set Up GitHub Codespaces

1. Create a free GitHub account at [GitHub](https://github.com/signup) (if you don't have one).
2. Open the Codespace using [this link](https://github.com/codespaces/new?repo=1162377539&ref=rwa/feature-development-v1&machine=standardLinux32gb).
3. Your environment will automatically install all dependencies, set up the database, and start both the backend and frontend servers.
4. Wait for the setup to complete (watch the terminal for "Ready!" message).
5. Open the application:
   - **Frontend:** [http://localhost:3000](http://localhost:3000)
   - **Backend API:** [http://localhost:4000](http://localhost:4000)

   > **Note:** In Codespaces, the URL will differ as it [automatically forwards ports](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

6. Log in with test credentials:

   | Role | Email | Password |
   |------|-------|----------|
   | Organizer | organizer1@example.com | organizer123 |
   | Organizer | organizer2@example.com | organizer123 |
   | Attendee | alice@example.com | attendee123 |
   | Attendee | bob@example.com | attendee123 |
   | Attendee | carol@example.com | attendee123 |

   > **Troubleshooting:** If Codespaces returns 502 Bad Gateway errors although the servers are running, go to the Ports view, right-click on the port(s), and toggle the visibility between "Public" and "Private".

### 2. Understand the Technologies

- Review the project's technologies (Express.js, Next.js, TypeScript, Prisma, SQLite).
- Understand the architecture from the project structure below.
- Familiarize yourself with the existing API patterns.

### 3. Review the Codebase

Familiarize yourself with the existing codebase before starting. You are responsible for understanding the code you build on top of — including shared utilities, helper functions, and seed data.

**Backend:** Located in the `backend` folder.
```
backend/
├── src/
│   ├── index.ts           # Express app setup
│   ├── routes/
│   │   ├── auth.ts        # Authentication endpoints
│   │   ├── events.ts      # Event management
│   │   ├── bookings.ts    # Booking/ticket purchase
│   │   ├── checkin.ts     # Check-in validation
│   │   ├── dashboard.ts   # Analytics & stats
│   │   ├── tiers.ts       # Seat tier management
│   │   ├── promoCodes.ts  # Promo code management
│   │   └── waitlist.ts    # Waitlist management (stub)
│   ├── middleware/
│   │   └── auth.ts        # JWT & API key authentication
│   └── lib/
│       ├── jwt.ts         # Token generation/verification
│       ├── qr.ts          # QR code generation
│       ├── capacity.ts    # Centralized capacity management
│       ├── transfer.ts    # Booking transfer utility
│       ├── validations.ts # Zod schemas
│       └── prisma.ts      # Prisma client
└── prisma/
    ├── schema.prisma      # Database schema
    └── seed.ts            # Test data seeding
```

**Frontend:** Located in the `frontend` folder.
```
frontend/
└── src/
    ├── app/               # Next.js App Router pages
    │   ├── page.tsx       # Homepage (event listing)
    │   ├── events/[id]/   # Event detail & purchase
    │   ├── bookings/      # User's bookings list
    │   ├── tickets/[id]/  # Ticket display with QR
    │   ├── login/         # Login page
    │   ├── register/      # Register page
    │   └── dashboard/     # Organizer dashboard
    ├── components/
    │   ├── ui/            # Reusable UI components
    │   └── layout/        # Header, Footer
    ├── contexts/
    │   └── AuthContext.tsx # Auth state management
    ├── lib/
    │   ├── api.ts         # API client functions
    │   └── utils.ts       # Formatting utilities
    └── types/
        └── index.ts       # TypeScript interfaces
```

**Key Files to Understand:**
- Database Schema: `backend/prisma/schema.prisma`
- Booking Logic: `backend/src/routes/bookings.ts`
- Capacity Management: `backend/src/lib/capacity.ts`
- Transfer Utility: `backend/src/lib/transfer.ts`
- Event Management: `backend/src/routes/events.ts`
- Waitlist Stub: `backend/src/routes/waitlist.ts`
- Seed Data: `backend/prisma/seed.ts`
- API Client: `frontend/src/lib/api.ts`
- Event Detail Page: `frontend/src/app/events/[id]/page.tsx`

Spend time exploring the code to understand:
- How the existing booking flow works end-to-end
- What shared utilities exist and how they work (read the implementations, not just the function signatures)
- What data already exists in the seed file and whether it's consistent with your planned changes
- How capacity tracking works across bookings and cancellations

### 4. Use Cline

- You must use the pre-installed **Cline** VSCode extension for AI assistance.
- You can check out the [Cline documentation](https://docs.cline.bot/) to learn how to use it.
- Configure the assessment-specific API key (provided on the Crossover page) in Cline's settings.

### 5. Document Your Decisions

- Before writing code, fill in [DECISIONS.md](./DECISIONS.md) with your approach.
- This is a planning artifact — explain what you're building, how, and why.
- Include any questions or assumptions about the requirements.
- Keep it concise (~500 words). Reasoning matters more than length.

### 6. Review Evaluation Criteria

- Check the criteria below to know how your work will be graded.

## Mandatory Rules

- **Do Not Fork:** Work on the provided repository. The submission script will malfunction if you fork the repository and push to it.
- **Use the Correct Branch:** Ensure you are on the correct assessment branch.
- **Single AI Tool:** Use Cline exclusively for AI interactions.
- **Include Screenshots:** Include screenshots of the acceptance tests passing. If you submit without screenshots, you'll get 0 stars on completeness.
- **Start with Decisions:** Fill in `DECISIONS.md` before coding. Document your approach, reasoning, and any questions about the requirements. **An empty or template-only DECISIONS.md will cap your grade regardless of code quality.**
- **Preserve Cline History:** Do not clear your Cline chat history. If you submit without Cline history, you'll get 0 stars.
- **Code Must Compile:** Ensure your backend compiles without errors. Code that fails to compile will be penalized regardless of other scores.

## Running the Application

### First Time Setup

```bash
# 1. Install all dependencies (root, backend, frontend)
npm run install:all

# 2. Set up database and seed with sample data
npm run db:setup

# 3. Start both servers (runs concurrently)
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:backend` | Start only the backend server (port 4000) |
| `npm run dev:frontend` | Start only the frontend server (port 3000) |
| `npm run install:all` | Install dependencies for root, backend, and frontend |
| `npm run db:setup` | Initialize database and seed with sample data |
| `npm run db:reset` | Reset database and re-seed (use after schema changes) |
| `npm run build` | Build both projects for production |

### After Making Database Schema Changes

When you modify `backend/prisma/schema.prisma`, run:

```bash
# Navigate to backend folder
cd backend

# Generate Prisma client and push schema to database
npx prisma db push

# Re-seed the database (optional, if you need fresh test data)
npx prisma db seed
```

Or from the project root:

```bash
npm run db:reset
```

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user (public)
- `POST /api/auth/login` - Login and get JWT token (public)
- `GET /api/auth/me` - Get current user (requires auth)

### Events
- `GET /api/events` - List published events (public)
- `GET /api/events/:id` - Get event details (public)
- `POST /api/events` - Create event (organizer only)
- `PUT /api/events/:id` - Update event (organizer only)
- `DELETE /api/events/:id` - Cancel event (organizer only)
- `GET /api/events/:id/attendees` - List attendees (organizer only)

### Bookings
- `GET /api/bookings` - List user's bookings (requires auth)
- `GET /api/bookings/:id` - Get booking details (requires auth)
- `POST /api/bookings` - Create booking (requires auth)
- `DELETE /api/bookings/:id` - Cancel booking (requires auth)
- `GET /api/bookings/:id/qr` - Get QR code (requires auth)

### Check-in (for scanner apps)
- `POST /api/checkin` - Validate and check-in ticket (requires API key)

### Seat Tiers
- `GET /api/events/:eventId/tiers` - List tiers for an event (public)
- `POST /api/events/:eventId/tiers` - Create tier (organizer only)
- `PUT /api/events/:eventId/tiers/:tierId` - Update tier (organizer only)
- `DELETE /api/events/:eventId/tiers/:tierId` - Delete tier (organizer only)

### Promo Codes
- `GET /api/events/:eventId/promo-codes` - List promo codes (organizer only)
- `POST /api/events/:eventId/promo-codes` - Create promo code (organizer only)
- `POST /api/events/:eventId/promo-codes/validate` - Validate promo code (requires auth)
- `DELETE /api/events/:eventId/promo-codes/:codeId` - Deactivate promo code (organizer only)

### Dashboard
- `GET /api/dashboard/stats` - Get overall statistics (organizer only)
- `GET /api/dashboard/events/:id/stats` - Get event statistics (organizer only)
- `GET /api/dashboard/velocity` - Get sales velocity (organizer only)

## Notes

- **Testing:** The project does not include an automated test suite. You are expected to demonstrate your work with tests.
- **Cline:** Think of Cline as a junior developer with good general knowledge but little context about the project. Provide clear instructions and reference specific files (using @mentions) when asking for changes.
- **Database:** SQLite database file is at `backend/prisma/dev.db`. You can use any SQLite viewer to inspect the data.
- **Codespaces:**
  - **Inactivity:** Your codespace will stop after 30 minutes of inactivity. You can restart it from [GitHub Codespaces](https://github.com/codespaces) (your changes will be saved). It will be automatically deleted after 30 days of being stopped.
  - **Forwarding:** Any "localhost" URLs will be forwarded automatically by Codespaces to a [URL accessible from the internet](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).
  - **Costs:** GitHub Codespaces is free for the first 120 CPU hours per month.
- **Environment:** If you cannot use Codespaces, you can set up a local development environment. Ensure you have Node.js 18+ installed.

## Evaluation Criteria

| **Criteria** | **Weight** | **0 Stars** | **1 Star** | **2 Stars** | **3 Stars** |
|---|---|---|---|---|---|
| **Engineering Judgment** | 40% | Used existing code without reading or evaluating it. No reasoning in DECISIONS.md. | Read existing code but followed default patterns without questioning them. Some reasoning documented. | Evaluated existing code before building on it. Made deliberate architectural choices with documented reasoning. Identified issues in the codebase. | Thorough audit of shared utilities and data. Sound architectural decisions with clear trade-off reasoning in DECISIONS.md. Addressed inconsistencies found in the codebase. |
| **Completeness** | 25% | Most features broken or missing screenshot evidence. | One story partially working. Some screenshots present. | Core features of both stories working. Most acceptance tests passing with screenshots. | All 10 acceptance tests passing with clear screenshot evidence. Both stories fully functional. |
| **Test Cases** | 20% | No tests written. | A few happy-path tests for one story. | Tests for both stories, or thorough coverage of one story including edge cases. | Both stories tested with edge cases and regression tests for issues discovered in the codebase. |
| **Velocity** | 15% | Not completed or took significantly longer than expected. | Completed partially within the time window. | Completed in 3-8 hours. | Completed in 3 hours or less. |

## Next Steps

Once you are ready, reveal the user story requirements from `USER_REQUIREMENTS.md`. Document your decisions in `DECISIONS.md`, then implement the stories. Work carefully within the architecture and ensure your changes integrate smoothly with the existing project.

**Recommended Time Budget:**
- **0:30** - Create your implementation plan
- **2:00** - Implement the user stories
- **0:30** - Run acceptance tests and capture screenshots

## Submitting Your Work

1. Place your screenshots in the `submission/` folder.
2. Do not create subfolders — all files directly in `submission/`.
3. Name screenshots descriptively: `test1-transfer-form.png`, `test2-transfer-success.png`, etc.
4. Run the submission command from the project root:
   ```bash
   npm run submit <your-asr-id>
   ```
   The ASR ID is provided on the Crossover assessment page.
5. The script will bundle your code changes, screenshots, DECISIONS.md, and Cline history into a submission.
6. Copy the submission ID returned and paste it into the Crossover assessment page.

You may resubmit as many times as needed. Only the submission ID recorded on the Crossover page will be graded.

User story requirements are in `USER_REQUIREMENTS.md`.
