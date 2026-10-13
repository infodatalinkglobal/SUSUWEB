# CLAUDE.md — SusuApp

> Read this file and [`PRD.md`](./PRD.md) before changing code. `PRD.md` is the product source of truth; this file is the implementation guide. If they appear to conflict, follow the MVP scope in the PRD and ask before expanding it.

## Project at a glance

SusuApp is a Ghanaian, mobile-responsive web app for recording traditional Susu savings. It supports **Collector** groups (individual contribution ledgers) and **ROSCA** groups (a shared contribution amount and rotating pot schedule). The app is a ledger and payment interface; it does **not** hold, lend, or guarantee funds.

The intended builder is an intermediate developer using Claude Code. Keep implementation steps clear and practical, and briefly explain non-obvious security, payment, and deployment decisions without overexplaining standard TypeScript.

The MVP is intentionally limited to:

1. Phone OTP sign-up and login for Ghana numbers.
2. Create and list Collector and ROSCA groups.
3. Invite members with WhatsApp `wa.me` links and accept invites after OTP login.
4. Record MoMo references, initiate Paystack payments, and record cash received by an organizer.
5. Show the contribution ledger, ROSCA rotation, and a human-sent WhatsApp reminder flow.

Do not add subscription checkout, automated WhatsApp/SMS reminder delivery, automated cycle advancement, Collector payout/fee automation, analytics, CSV export, or unrelated features unless requested. See the PRD for full acceptance criteria and out-of-scope details.

## Recommended stack

- Next.js 15.5 (App Router), React 18, and TypeScript; use a patched release and Server Components by default.
- PostgreSQL (Neon in hosted environments) and Prisma.
- Phone OTP and SMS provider: Arkesel.
- Encrypted cookie session: iron-session.
- Payment processing: Paystack, GHS only.
- Tailwind CSS and accessible UI components.
- Vercel deployment integration.

Match the versions and conventions already present in `package.json` if it exists. Do not perform broad framework or dependency upgrades as part of an unrelated task. Inspect the repository before assuming a route, component, package, or schema already exists.

## Product decisions that must not drift

- Both models exist: `COLLECTOR` and `ROSCA`.
- MVP frequencies are `WEEKLY` and `MONTHLY` only.
- Ghana phone numbers are normalized and stored as `+233XXXXXXXXX`.
- All money is GHS. Persist money as Prisma `Decimal`, never JavaScript floating-point values.
- MoMo manual payments become `RECORDED`, not `VERIFIED`, until an organizer checks them.
- Paystack is trusted only after a valid webhook; a client redirect is not proof of payment.
- An organizer may record cash they received. Attribute the action to that organizer.
- WhatsApp links open WhatsApp with text prefilled. The organizer/member must choose a recipient and press Send; the app does not send WhatsApp messages or perform a bulk blast.
- OTP SMS is in scope. Reminder/invite SMS is not in scope for MVP.
- Subscription is the intended business model, but paid subscription billing and plan gates are not MVP features.
- Cycle advancement is manual. Monthly periods use calendar months, not a fixed 30-day interval. Use `Africa/Accra` consistently for user-facing schedule calculations.
- The Collector MVP tracks contributions; payout settlement and fee calculation happen outside the app.
- Do not claim that using Paystack alone resolves Ghanaian regulatory requirements. Production money movement requires legal/compliance review.

## Expected project layout

Follow the layout that exists in the repository; this is the target organization, not permission to create unused files:

```text
prisma/schema.prisma
src/
  app/
    page.tsx
    auth/login/page.tsx
    auth/verify/page.tsx
    dashboard/layout.tsx
    dashboard/page.tsx
    dashboard/groups/new/page.tsx
    dashboard/groups/[id]/page.tsx
    dashboard/groups/[id]/invite/page.tsx
    dashboard/groups/[id]/contribute/page.tsx
    join/[id]/page.tsx
    api/auth/send-otp/route.ts
    api/auth/verify-otp/route.ts
    api/auth/logout/route.ts
    api/auth/dev-sign-in/route.ts      # Local preview only; never production auth
    api/groups/route.ts
    api/groups/[id]/route.ts
    api/groups/[id]/cycle/route.ts
    api/groups/[id]/rotation/route.ts
    api/groups/[id]/invite/route.ts
    api/groups/[id]/join/route.ts
    api/groups/[id]/contributions/route.ts
    api/groups/[id]/contributions/missed/route.ts
    api/groups/[id]/remind/route.ts
    api/contributions/[id]/verify/route.ts
    api/contributions/[id]/reject/route.ts
    api/payments/initialize/route.ts
    api/payments/webhook/route.ts
  components/
  lib/
    prisma.ts
    session.ts
    arkesel.ts
    paystack.ts
    whatsapp.ts
    validators.ts
    utils.ts
```

Use the existing alias/configuration (commonly `@/…`) rather than inventing a second import convention.

## Authentication and authorization rules

- Normal authentication is phone OTP only; no email/password/OAuth. An explicitly enabled, development-only preview sign-in may create a temporary demo session without OTP or persistence. It must require both `NODE_ENV=development` and `AUTH_DEMO_MODE=true`, must be hidden in production, and `requireAuth()` must reject demo sessions for all protected API operations.
- Normalize a local Ghana number before validating it. Canonical regex: `/^\+233[0-9]{9}$/`.
- OTP is six numeric digits, expires in five minutes, and allows at most three attempts before a ten-minute lockout. Apply server-side rate limiting to OTP sends too.
- Never return, log, or persist the plaintext OTP. Arkesel is the verifier; store only the state needed for rate limits/attempts if the implementation requires it.
- Store the user ID and normalized phone in an iron-session cookie. Configure a 32-character minimum secret, `httpOnly`, `secure` in production, and an appropriate `sameSite` policy.
- Call `requireAuth()` at the start of every protected route. It should fail closed with a 401 and return a typed session (for example `{ userId, phone }`).
- Authentication is not authorization. For every group-scoped operation, confirm that the caller is a member of that exact group and has the required role. Organizer-only actions include invite, verification/rejection, cash entry, and manual cycle advancement. Cycle advancement must stop at `totalCycles` and must never rewrite earlier contribution history.
- An invite can be accepted only by an authenticated user whose normalized phone matches the invited phone.
- The Paystack webhook is not session-authenticated; validate its signature and event instead.
- Avoid user enumeration in login/OTP responses. Never expose stack traces, provider response secrets, or another member's private phone number to ordinary members.

## Data and Prisma rules

- `prisma/schema.prisma` is the source of truth. Use Prisma Client methods; do not write raw SQL for application work.
- Use a Prisma singleton imported from `@/lib/prisma`.
- Core enums should cover:
  - `GroupType`: `COLLECTOR`, `ROSCA`
  - `Frequency`: `WEEKLY`, `MONTHLY`
  - `MemberRole`: `ORGANIZER`, `MEMBER`
  - `MemberStatus`: `INVITED`, `ACTIVE`, `LEFT`
  - `ContributionStatus`: `PENDING`, `RECORDED`, `VERIFIED`, `MISSED`
  - `PaymentMethod`: `MOMO_MANUAL`, `PAYSTACK`, `CASH`
- Enforce unique `(groupId, userId)` memberships, unique non-null `(groupId, rotationOrder)` values for ROSCA members, and unique `(memberId, cycle)` contributions in the database, not just in UI code. Paystack references must also be unique when present.
- Store monetary values as `Decimal(10,2)` (or a deliberate equivalent). Validate amounts to a minimum of GHS 1.00 and at most two fractional digits. Convert GHS to integer pesewas for Paystack without introducing floating-point rounding errors.
- Use a database transaction for operations that create/update related records together (group plus organizer membership, accepting an invite, and contribution/payment state transitions).
- Preserve financial history. Do not cascade-delete contribution or payment records without an explicit retention decision; prefer restricted/soft deletion where appropriate.
- Serialize Prisma `Decimal` values as strings in API responses. Serialize dates as ISO-8601 strings.
- Never let a repeated request or webhook overwrite a verified contribution with a lower-trust state.

## API implementation conventions

For protected JSON routes, use this order:

1. Authenticate (`requireAuth()`).
2. Parse and validate request input with a Zod schema.
3. Authorize the user's role and resource membership.
4. Perform business logic and Prisma operations (transactional when needed).
5. Return the smallest useful response with the correct HTTP status.

Use `NextRequest` / `NextResponse` and typed route params according to the installed Next.js version. Do not use `any`; use `unknown` and narrow it when dealing with third-party JSON. Error responses always include a safe, human-readable `message` or `error`. Return validation errors as 400, unauthenticated as 401, unauthorized as 403, missing resources as 404, and conflicts such as duplicate contribution as 409.

Validate every input with Zod, including query parameters and webhook/event fields after signature verification. Do not trust a user-supplied `userId`, amount, payment status, role, or group ID without resolving and authorizing it on the server.

## Payment handling

### MoMo manual

- Member submits only their own current-cycle reference; validate alphanumeric, minimum six characters.
- Initial state is `RECORDED` and method is `MOMO_MANUAL`.
- Only an organizer can verify or reject it. A rejection returns it to `PENDING`, stores an audit/review note, and lets the member resubmit; do not invent an unrequested persistent `REJECTED` status.

### Cash

- Only the organizer can record cash actually received for a member in the current cycle.
- Store the expected group contribution amount, `CASH` method, timestamps, and the acting organizer. Do not allow a member to self-verify cash.

### Paystack

- Keep `PAYSTACK_SECRET_KEY` on the server only.
- Initialize through `POST https://api.paystack.co/transaction/initialize` with `Authorization: Bearer <PAYSTACK_SECRET_KEY>`. Initialize for the group's server-stored amount, convert GHS to integer pesewas, use currency `GHS`, and include both `mobile_money` and `card` channels.
- Return only the authorization URL and reference needed by the client. Initialization success is not payment success.
- Associate the transaction to a server-created contribution and opaque metadata/reference; do not trust client-provided amount or contribution status.
- Webhook handler reads the raw body, checks `x-paystack-signature` with HMAC SHA-512 and a constant-time comparison, then validates event, reference, amount, currency, and contribution association.
- Process `charge.success` idempotently. A verified event marks the associated contribution `VERIFIED`, sets method/reference/timestamps, and cannot be replayed to affect another contribution.
- Do not mark a payment verified from the browser return URL, a client callback, or an unverified Paystack API response.
- Never log secret keys or full payment payloads containing unnecessary personal data.

## Arkesel and WhatsApp

- Arkesel API key comes from `ARKESEL_API_KEY`; use the provider helper rather than calling it ad hoc from components/routes.
- Base URL: `https://sms.arkesel.com/api/v2`. OTP send and verify use `POST /otp/send` and `POST /otp/verify`, with the `api-key` header and JSON content type. Send payload uses six numeric digits, five-minute expiry, SMS medium, sender ID `SusuApp`, and the normalized Ghana number. Check the provider's documented success code (`"1100"` per the current integration notes); handle timeout/provider errors without returning credentials or OTP values.
- Arkesel verifies the OTP; never fabricate a successful provider response in production. The application must still enforce its own attempt and send-rate limits.
- WhatsApp links use `https://wa.me/{phoneWithoutPlus}?text={encodedMessage}`. Normalize/validate the phone first and encode all dynamic message text. Use a clear invitation message with the group name and `/join/[groupId]` URL.
- Invite and reminder actions prepare links/text only. Do not use unofficial WhatsApp APIs, browser automation, or language that promises a message was delivered.

## UI and accessibility

- Prefer Server Components and server-side data access for read-only pages. Add `"use client"` only for actual browser interactivity/state.
- Mobile-first at 375 px; use responsive layouts rather than desktop tables that overflow on phones.
- Every form has visible labels, inline validation/errors, a pending/loading state, and a duplicate-submit guard.
- Provide empty states and clear success/failure feedback.
- Status needs text/icon as well as color: `VERIFIED` (green/check), `RECORDED` (amber/hourglass), `MISSED` (red/cross), pending/future (neutral).
- Keep member views read-only except for that member's own actions. Keep organizer controls visually distinct and protect them server-side as well.
- Do not add dark mode or localization frameworks as MVP work unless requested.

## Environment variables

Required server configuration (use `.env.local` locally and never commit real values):

```env
DATABASE_URL="postgresql://..."
ARKESEL_API_KEY="..."
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_PUBLIC_KEY="pk_test_..."
SESSION_SECRET="at-least-32-random-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_DEMO_MODE="false"
NEXT_PUBLIC_AUTH_DEMO_MODE="false"
```

Only enable both demo flags in a local development preview. The server route must also check `NODE_ENV === "development"`; never enable demo sign-in in production. Use Paystack test keys in development. `NEXT_PUBLIC_` values are public; never put a secret under that prefix. Do not create fake success paths when a required production integration is missing. A development-only mock must be explicit, safely gated, and must not be able to verify a real payment.

## Development commands

Use commands supported by the repository's `package.json`; expected commands once the app is scaffolded:

```bash
npm install
npm run dev
npx prisma generate
npx prisma db push       # only against an explicitly configured development database
npx prisma studio
npm run build
npm start
```

Do not run `prisma db push` against an unknown or production database. After schema changes, regenerate Prisma Client and run the relevant tests/build. Do not push directly to a production branch as part of routine implementation; follow the repository's configured branch/deployment workflow.

## Suggested implementation order

1. Inspect existing files and dependencies; scaffold only what is missing.
2. Set up Prisma schema, client singleton, environment example, and foundational layout/styles.
3. Implement phone normalization, Arkesel OTP endpoints, iron-session, and login/verify/logout pages.
4. Implement group creation/listing and authenticated dashboard.
5. Implement invitation creation, WhatsApp links, invite acceptance, and member authorization.
6. Implement contribution ledger, MoMo reference review, organizer cash entry, and secure Paystack initialization/webhook.
7. Implement ROSCA rotation display, Collector contribution totals, and human-sent WhatsApp reminder flow.
8. Complete responsive/accessibility/security pass and test the MVP end-to-end.

Keep each phase focused. Do not scaffold future-only subscription, analytics, exports, or admin features just because they appear in the long-term business model.

## Testing expectations

At minimum, test or manually verify:

- Phone normalization and rejection of non-Ghana numbers.
- OTP success, expiry, three-attempt lockout, resend limits, session persistence, and logout.
- Group creation for both models, invalid GHS amounts, organizer membership, rotation ordering, and authorized manual cycle advancement up to `totalCycles`.
- Duplicate/invalid invites, matching-phone invite acceptance, and authorization boundaries.
- Member cannot submit for another member or a non-current cycle; duplicate contribution is rejected.
- MoMo reference stays `RECORDED` until organizer review; rejection does not erase audit history.
- Organizer-only cash entries.
- Paystack signature failure, wrong amount/currency/reference, repeated webhook, and successful verified webhook using test fixtures/keys.
- Ledger states, future/current cycle distinction, ROSCA recipient, and mobile layout at 375 px.
- Reminder links are prepared correctly and are not represented as already sent.

Do not use real customer numbers, live Paystack keys, or production payment data in tests.
