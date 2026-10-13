# SusuApp 🇬🇭

SusuApp is a mobile-responsive Ghanaian Susu savings ledger for Collector and ROSCA groups. It supports group invitations, contribution tracking through MoMo references, Paystack, and organizer-recorded cash without holding user funds.

## Product documents

- [Product Requirements Document](./PRD.md) — MVP scope, user stories, acceptance criteria, data requirements, and launch considerations.
- [Claude Code instructions](./CLAUDE.md) — project context, implementation rules, security requirements, and development workflow.

## MVP implementation

The MVP follows the implementation order in `CLAUDE.md`:

1. Project foundation, Prisma/PostgreSQL data model, responsive layout, and environment example.
2. Ghana phone OTP through Arkesel, encrypted iron-session, rate limits, login/verification/logout, and a development-only preview sign-in.
3. Create/list Collector and ROSCA groups, organizer membership, GHS amounts, weekly/monthly schedules, and manual cycle advancement.
4. Organizer invitations, human-sent prefilled WhatsApp links, OTP phone matching, and invite acceptance.
5. Member MoMo-reference submissions and organizer review, organizer-recorded cash, Paystack initialization, and signed/idempotent Paystack webhook verification.
6. Current/recent contribution ledger, Collector verified-versus-review totals, ROSCA rotation and pot estimate, and individual WhatsApp reminder links.
7. Mobile-responsive forms and status treatments, server-side authorization, and accessibility/security checks.

The app is a ledger, not a wallet. Collector settlement and ROSCA payouts happen outside SusuApp. WhatsApp messages are never sent automatically. Subscription billing, plan gates, analytics, exports, automatic reminders, and automatic cycle advancement are out of MVP.

## Run locally

1. Use Node.js 20 or newer. Copy `.env.example` to `.env.local` and set a **development** PostgreSQL `DATABASE_URL`, an Arkesel API key, a random `SESSION_SECRET` of at least 32 characters, and Paystack test keys when testing payments.
2. Install dependencies and generate the Prisma client:

   ```bash
   npm install
   npx prisma generate
   ```

3. Only after confirming the database is a development database you control, apply the schema and start Next.js:

   ```bash
   npx prisma db push
   npm run dev
   ```

Normal OTP login requires PostgreSQL and Arkesel credentials. Paystack initialization requires a test or production secret key; webhook verification is authoritative and a browser return never marks a contribution paid.

For a UI preview without DB or SMS credentials, set both `AUTH_DEMO_MODE=true` and `NEXT_PUBLIC_AUTH_DEMO_MODE=true` while running `npm run dev`. The temporary preview is explicitly development-only, creates no persisted account or contribution data, and cannot call protected APIs. Keep both flags `false` in production. The preview dashboard can render without cookies in a restricted embedded browser, but group operations still require an authenticated account and working database.

Never run `prisma db push` against an unknown or production database. Do not commit `.env.local`, real provider keys, OTPs, or customer data. Review Ghanaian legal/compliance requirements and finalize the draft Terms/Privacy documents before a real-money launch.
