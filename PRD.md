# SusuApp — Product Requirements Document

- **Version:** 1.0
- **Date:** October 2026
- **Status:** MVP requirements
- **Platform:** Mobile-responsive web application
- **Market:** Ghana 🇬🇭
- **Currency:** Ghana cedi (GHS)

---

## 1. Product summary

SusuApp is a digital ledger for Ghanaian Susu savings. It helps organizers and members record contributions, understand who has paid, and follow the agreed savings schedule. It supports both:

1. **Collector Susu:** A collector tracks each client's periodic savings. The collector and client settle the accumulated savings outside the app.
2. **Rotating savings (ROSCA):** Members contribute a fixed amount each period and receive the group pot in a published rotation order.

SusuApp records and presents activity; it is **not a wallet** and does not hold or lend user funds. Paystack may process a member-initiated payment. Cash and external Mobile Money (MoMo) payments are recorded in the ledger.

### 1.1 Founder decisions reflected in this PRD

- Support both Collector and ROSCA models.
- Serve collectors, group organizers, members, market women, and other community savers.
- Support MoMo references, Paystack in-app payments, and cash tracking.
- Subscription is the intended business model.
- Build a responsive web app, not a native mobile app.
- Use the recommended stack in Section 3; no separate stack preference was specified.
- Keep implementation guidance suitable for an intermediate developer using Claude Code.
- Treat this as a startup product and plan for Ghanaian regulatory and privacy obligations.
- Keep the MVP to the features in Section 5. Do not build adjacent features without approval.

## 2. Problem, goals, and non-goals

### 2.1 Problem

Traditional Susu groups often rely on paper notebooks, memory, and WhatsApp messages. This makes it hard to prove contributions, follow up on missed payments, keep a fair rotation order, and manage groups as they grow.

### 2.2 Product goals

- Give organizers a reliable, searchable record of groups, members, and contributions.
- Let a member record an external MoMo payment or pay through Paystack.
- Make contribution status and the ROSCA rotation easy to understand on a phone.
- Make inviting members and sending reminders convenient through WhatsApp links.
- Keep clear records without taking custody of savings.

### 2.3 Non-goals for this MVP

- Holding, pooling, lending, or automatically disbursing funds.
- Calculating or paying collector fees, interest, or loans.
- Automatically advancing cycles or declaring a payment missed on a schedule.
- Automated WhatsApp or SMS reminder delivery. WhatsApp links are prepared for a person to send; Arkesel SMS is used for OTP only in the MVP.
- Native iOS/Android applications, in-app chat, push notifications, dispute resolution, or a super-admin console.
- Subscription checkout, recurring subscription billing, analytics, and CSV export. Subscription is the business model, but billing and these paid features are not part of the MVP feature list.
- Daily or biweekly schedules. MVP frequencies are weekly and monthly; additional frequencies can be considered later.

## 3. Recommended technical stack

| Layer | Choice | Notes |
|---|---|---|
| Web framework | Next.js 15.5 (App Router), React 18, TypeScript | Patched App Router release; Server Components by default; mobile-responsive web only |
| Database | PostgreSQL, hosted on Neon | Keep secrets in environment variables |
| ORM | Prisma | Prisma schema is the data-model source of truth |
| Authentication | Ghana phone OTP via Arkesel; encrypted session cookie via iron-session | No email, password, or OAuth sign-in |
| Payments | Paystack | GHS only; MoMo and card channels; webhook is authoritative |
| SMS | Arkesel | OTP delivery for MVP; no reminder SMS blast in MVP |
| WhatsApp | `wa.me` deep links | No WhatsApp Business API; a person must send the prepared message |
| Styling | Tailwind CSS and accessible UI components | Mobile-first, keyboard-accessible forms and controls |
| Deployment | Vercel | Use the repository's configured deployment workflow |

## 4. Users, roles, and permissions

### 4.1 Target users

The product serves professional Susu collectors, self-organizing groups of friends/family/colleagues, group members, and market women or other informal traders who save regularly. These personas use the two application roles below: organizer/collector or member.

### 4.2 Roles and permissions

| Role | Description | MVP permissions |
|---|---|---|
| Organizer / Collector | Creates and manages a group | Create groups, invite members, view the full group ledger, verify MoMo references, record cash received, and prepare reminders |
| Member | Participates in a group | Accept an invite, view group schedule and permitted ledger information, record their own MoMo payment, and pay via Paystack |

A group creator is automatically added to the group as an active organizer. Every protected API action must verify both authentication and the caller's membership/role in the requested group. Members must never act on another member's behalf.

## 5. MVP scope and acceptance criteria

### 5.1 Phone OTP authentication — P0

**Flow:** Enter Ghana phone number → request OTP → enter six-digit code → verify with Arkesel → create/find the user → establish session → open dashboard.

**Requirements:**

- Accept Ghana numbers only and store them in E.164 form: `+233XXXXXXXXX`.
- Normalize common local input (for example, `0244123456` to `+233244123456`) before validating. Do not silently accept a non-Ghanaian number.
- OTP is six numeric digits and expires after five minutes.
- Allow no more than three verification attempts for a challenge; lock the phone/challenge for ten minutes after the limit. Apply reasonable send-rate limiting as well.
- Never return or log an OTP. Do not store the plaintext code in the application database.
- On success, upsert the user by normalized phone and set an encrypted, HTTP-only session cookie. A returning session remains valid according to the configured session expiry.
- Logout destroys the session and returns the user to the login page.
- Present Terms and Privacy Policy links and record the applicable consent/version at registration before real-money launch.

**Acceptance criteria:**

- Invalid/non-Ghanaian phone input receives a useful inline error.
- Invalid, expired, or locked-out OTP attempts do not create a session.
- Successful verification creates a user only when one does not already exist.
- Successful login navigates to `/dashboard`; logout clears the session.

### 5.2 Create and list Susu groups — P0

**Group fields:** name, model (`COLLECTOR` or `ROSCA`), contribution amount, frequency (`WEEKLY` or `MONTHLY`), start date, total cycles, active state, and the organizer's membership. Contribution amounts are GHS and must be at least GHS 1.00 with no more than two decimal places.

**Requirements:**

- An organizer can create and list their groups.
- The creator is added as the first active member with the `ORGANIZER` role.
- For ROSCA groups, the creator starts at rotation order 1. Later invitees receive sequential order numbers; the organizer can review the order before the group begins. Each rotation order is unique within the group; the planned ROSCA cycle count represents one turn per intended recipient.
- `currentCycle` starts at 1. An organizer can manually advance to the next cycle from the group view, up to `totalCycles`; no cron job or automatic advancement is included. Earlier cycle records remain visible and are not rewritten.
- Weekly periods advance by seven calendar days. Monthly periods advance by calendar month (not a fixed 30-day approximation), using the agreed start date and timezone `Africa/Accra`.
- A ROSCA pot estimate is the contribution amount multiplied by the number of active, eligible members. Display the estimate as an estimate; the app does not hold or guarantee the pot.
- The ledger for a Collector group tracks each member's periodic contributions. Collector/member payout, fee calculation, and settlement remain offline in the MVP.

**Acceptance criteria:**

- Invalid amounts, dates, model, frequency, or cycle counts are rejected with field-level messages.
- A created group is active and is visible only to its authorized participants.
- A failed creation does not leave a partially created group or organizer membership.

### 5.3 Invite and join members — P0

**Requirements:**

- Organizers can paste multiple phone numbers separated by commas or new lines.
- Normalize and validate every number before creating invitations; report invalid and duplicate entries clearly.
- Create an invited membership idempotently. Existing users are not duplicated; an existing group member is not invited twice.
- A ROSCA invite is assigned the next available rotation order. The organizer can review/edit the sequence before the first cycle begins; once the rotation has started, changing it must not silently rewrite completed history.
- Generate a personalized `wa.me` URL with an encoded invitation message and a join URL. Suggested copy: `🤝 You've been invited to join "{groupName}" on SusuApp! Tap to join: {inviteUrl} Save together, grow together 🇬🇭`. Do not claim that the app sent a WhatsApp message: the organizer must open WhatsApp and press Send.
- The invitee signs in with OTP and can accept the invitation only when their authenticated phone matches the invited phone.
- Once accepted, membership changes from `INVITED` to `ACTIVE`.
- Do not send invite SMS in the MVP.

**Acceptance criteria:**

- Each valid invite returns the normalized phone, invite status, and WhatsApp link.
- A non-organizer cannot invite members.
- An unrelated authenticated user cannot accept an invitation addressed to another phone.

### 5.4 Contribution recording and payment — P0

**Supported methods:**

1. **MoMo manual:** Member pays externally, then submits the transaction reference. The contribution becomes `RECORDED` until an organizer checks it.
2. **Paystack:** Member starts a GHS payment. Only a valid Paystack webhook can mark it `VERIFIED`.
3. **Cash:** Organizer records cash actually received. Cash entries are attributable to the organizer and are marked `VERIFIED` at entry; members cannot self-record or self-verify cash.

**Requirements:**

- A member can submit a contribution only for themselves, only while an active member, and only for the current cycle.
- MoMo references are alphanumeric and at least six characters. A manual reference submission creates/updates the current-cycle record to `RECORDED`; it never verifies itself.
- A member can initialize Paystack for the group's exact contribution amount. Currency is always `GHS`; amount is converted to integer pesewas; channels are `mobile_money` and `card`. Present Ghana MoMo options available to the merchant account (for example, MTN MoMo, Vodafone Cash, and AirtelTigo where enabled by Paystack) alongside card.
- The server creates the Paystack transaction and returns its authorization URL/reference. The browser redirect or callback is not proof of payment.
- The webhook validates `x-paystack-signature` using HMAC-SHA-512 and the raw request body. Verify event type, reference, amount, currency, and associated contribution before applying the event. Handle retries idempotently.
- An organizer can verify a `RECORDED` MoMo payment or reject it. Since MVP statuses do not include `REJECTED`, a rejection returns the record to `PENDING`, records the review note/audit details, and allows the member to resubmit.
- An organizer can mark a current-cycle contribution as `MISSED` manually. No automated missed-payment job is included.
- Do not allow duplicate contributions for a member/cycle. Never overwrite a verified payment with a new payment attempt.

**Statuses:**

| Status | Meaning |
|---|---|
| `PENDING` | No confirmed or awaiting-review payment for this member and cycle |
| `RECORDED` | A member submitted an external MoMo reference; organizer review is due |
| `VERIFIED` | Payment was confirmed by the organizer, cash was received and entered by the organizer, or Paystack webhook confirmed it |
| `MISSED` | Organizer manually recorded that the cycle's payment was missed |

The ledger may display `FUTURE` as a presentation state for cycles that have not started; `FUTURE` is not a persisted contribution status.

### 5.5 Live contribution ledger and reminders — P0

**Requirements:**

- Show members against cycles with name and contribution status. Organizers can see phone numbers and the full group ledger. Member views are read-only except for their own contribution actions; avoid exposing member phone numbers to other members unnecessarily.
- Highlight the current cycle and clearly distinguish verified, awaiting review, missed, pending, and future states using both text/icons and color.
- For ROSCA groups, show each cycle's recipient from the rotation order and the estimated pot. Actual payout transfer and payout-paid status are outside the MVP; do not imply that a scheduled recipient has received funds.
- For Collector groups, show each member's contribution history and accumulated recorded/verified savings; label clearly whether totals include unverified entries.
- Provide a WhatsApp reminder action for unpaid/unrecorded members in the current cycle. Suggested copy: `⚠️ Hi {name}, your {amountFormatted} Susu contribution for {groupName} is due. Pay now: {groupUrl} — SusuApp 🇬🇭` (format the amount as `GHS 0.00`). It prepares a message/link for the organizer; WhatsApp requires a human to choose the recipient/group and press Send. The MVP does not send bulk WhatsApp messages or SMS automatically.
- An organizer can manually advance the group to the next cycle from the ledger, up to `totalCycles`; past cycles cannot be edited by advancing. The action is authorized and confirmed to prevent accidental advancement.
- Revalidate or refresh the server-rendered ledger after contribution, verification, invitation, or cycle actions.

**Acceptance criteria:**

- Each member/cycle cell reflects the authoritative contribution record or its derived pending/future state.
- The current cycle and ROSCA rotation recipient are unambiguous on mobile.
- Reminder action targets only members needing action for the current cycle and never implies delivery before the organizer sends the message.

## 6. Subscription and business model

The selected model is organizer-paid SaaS subscription. These are intended packages, not an MVP billing commitment:

| Plan | Intended price | Groups | Members per group | Intended features |
|---|---:|---:|---:|---|
| Free | GHS 0/month | 1 | 10 | Basic ledger |
| Basic | GHS 15/month | 5 | 30 | SMS reminders, CSV export |
| Premium | GHS 35/month | Unlimited | Unlimited | Analytics, priority support |

Member limits include the organizer because the organizer is a group member. Paid checkout, recurring billing, upgrades, plan enforcement, SMS reminders, CSV export, and analytics are outside the MVP. Do not represent these as available until implemented and approved.

## 7. Data model and integrity

Prisma is the schema source of truth. Core entities:

- **User:** unique normalized phone, optional display name, timestamps, session/account metadata.
- **SusuGroup:** name, model, GHS contribution amount as `Decimal(10,2)`, weekly/monthly frequency, start date, current cycle, total cycles, active state.
- **GroupMember:** group/user join, organizer/member role, invited/active/left status, optional ROSCA rotation order. Unique `(groupId, userId)` and unique non-null `(groupId, rotationOrder)`.
- **Contribution:** group, group member, user, cycle, decimal amount, status, method, MoMo/Paystack reference, paid/verified timestamps, review/audit metadata. Unique `(memberId, cycle)`; Paystack reference must be unique when present.
- **Payout (future extension):** may represent a ROSCA payout record, unique `(groupId, cycle)`. A payout table and payout-paid workflow are not required for the MVP; settlement remains outside the app.

Use database transactions for multi-record operations such as group creation and invitation acceptance. Apply cascade deletion only where it cannot erase financial/audit records contrary to retention requirements; soft deletion or restricted deletion may be safer for groups with payment history. Never use floating-point arithmetic for persisted money.

## 8. API surface (planned)

All application inputs use Zod validation. Protected routes call `requireAuth()` before business logic and then authorize against group membership/role.

| Method and route | Purpose |
|---|---|
| `POST /api/auth/send-otp` | Validate phone and request OTP through Arkesel |
| `POST /api/auth/verify-otp` | Validate OTP, upsert user, create session |
| `POST /api/auth/logout` | Destroy session |
| `GET /api/groups` | List groups visible to the authenticated user |
| `POST /api/groups` | Create group and organizer membership |
| `GET /api/groups/[id]` | Return authorized group and ledger data |
| `PATCH /api/groups/[id]/cycle` | Organizer manually advances one cycle, never beyond `totalCycles` |
| `PATCH /api/groups/[id]/rotation` | Organizer reorders ROSCA members before the first contribution/cycle advancement |
| `POST /api/groups/[id]/invite` | Create invitations and return `wa.me` links |
| `POST /api/groups/[id]/join` | Accept an invite matching the authenticated phone |
| `GET /api/groups/[id]/contributions` | Return authorized contribution/ledger data |
| `POST /api/groups/[id]/contributions` | Record the member's MoMo reference or an organizer's cash receipt, with server-side role and amount checks |
| `POST /api/groups/[id]/contributions/missed` | Organizer manually marks one current-cycle pending contribution missed |
| `PATCH /api/contributions/[id]/verify` | Organizer verifies a recorded contribution |
| `PATCH /api/contributions/[id]/reject` | Organizer rejects a reference and returns it to pending with an audit note |
| `POST /api/payments/initialize` | Initialize a Paystack payment for an authorized member/contribution |
| `POST /api/payments/webhook` | Verify Paystack signature and process payment event; signature-authenticated, not session-authenticated |
| `POST /api/groups/[id]/remind` | Prepare reminder data/link for the organizer; no background broadcast |

API responses use ISO-8601 date strings and decimal amounts serialized as strings. Error responses include a clear message; validation errors return an appropriate 4xx status. Never leak stack traces or provider secrets.

## 9. Non-functional requirements

### Performance

- Target first usable view in under three seconds on a typical 3G mobile connection.
- Target a ledger render under one second for groups up to 50 members and a practical MVP cycle count.
- Target sub-500 ms server-side CRUD work excluding third-party network latency.
- Paginate or constrain large histories rather than loading unbounded records.

### Security and privacy

- HTTPS in production; encrypted, HTTP-only, secure, same-site session cookie.
- Session secret must be at least 32 characters and supplied through environment configuration.
- Validate authorization on every protected API route and every group-scoped database query.
- Verify Paystack webhooks on every request using the raw body and constant-time signature comparison.
- Rate-limit OTP sends/verifications and avoid user-enumeration messages.
- Store normalized E.164 phone numbers; limit phone visibility to users who need it.
- No secrets, OTPs, payment credentials, or unnecessary personal data in logs or source control.
- Use Terms of Service, Privacy Policy, consent records, and a documented process for account/data requests before production launch.

### Accessibility and usability

- Design for a 375 px viewport first and scale to desktop.
- Every form has a visible label, keyboard support, and inline error text.
- Status is not conveyed by color alone.
- Use clear English labels and familiar Ghanaian terms (GHS, MoMo, Susu); Twi localization is not in MVP.
- Async actions show a loading state and prevent duplicate submissions; lists include useful empty states.

## 10. Third-party services and configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `ARKESEL_API_KEY` | Arkesel OTP/SMS API authentication |
| `PAYSTACK_SECRET_KEY` | Server-side transaction initialization and webhook verification |
| `PAYSTACK_PUBLIC_KEY` | Optional client-side Paystack use; never sufficient to confirm a payment |
| `SESSION_SECRET` | iron-session encryption key, 32+ characters |
| `NEXT_PUBLIC_APP_URL` | Canonical origin used for invite and callback URLs |

Use test credentials in development. Never commit `.env.local` or real keys. Handle unavailable providers gracefully and do not claim a payment/OTP succeeded when a provider call failed.

## 11. Regulatory and launch requirements

- SusuApp must not describe itself as holding or safeguarding funds. Payment initiation and settlement must use a properly configured Paystack merchant arrangement.
- Before real-money launch, obtain Ghana-qualified legal/compliance advice on the product's role, the Payment Systems and Services Act, Bank of Ghana requirements, consumer disclosures, data protection, and any applicable registration or licensing obligations. Using a licensed payment processor does not by itself prove that every SusuApp activity is exempt from regulation.
- Display fees, payment status meaning, settlement responsibility, and the fact that MoMo references require organizer review.
- Provide clear terms, privacy disclosures, support contact, and a way to report incorrect ledger entries.

## 12. Success measures

| Metric | First 30 days | First 90 days |
|---|---:|---:|
| Registered users | 200 | 1,000 |
| Active groups | 30 | 150 |
| Paid subscriptions | 10 | 60 |
| Contributions recorded | 500 | 5,000 |
| Monthly recurring revenue | GHS 150 | GHS 900 |

These are post-launch targets, not guarantees.

## 13. Decisions to confirm before enabling live payments

1. Which Paystack merchant/account receives settlement for in-app payments, and how that differs between organizer and group member flows.
2. Whether a member can edit a submitted MoMo reference or must submit a replacement after organizer rejection.
3. Whether Collector payout records and fee calculations should be added after the MVP.
4. How plan billing, cancellation, grace periods, and plan limits will work when subscription checkout is introduced.
5. Final Terms, Privacy Policy, retention rules, and Ghanaian legal/compliance review.
