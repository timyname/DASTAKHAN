# DASTAKHAN Cafe — product and implementation roadmap

## Product decision and assumptions

Offer a branded, mobile match-3 experience while an existing cafe guest waits for an order. The restaurant controls eligible dishes, availability, promotion rules and its spending cap. The first deliverable is an interactive sales demonstration: landing page, restaurant dashboard and guest journey. Demo rewards, orders and analytics are fictional and must be labelled. The existing 11×11 game and its tested bonus rules remain authoritative.

Interpret the owner's proposed choice as **50% off one selected dish on the current order, OR that dish free on a later visit**. It does not mean a 50% discount on the entire bill. This assumption needs confirmation before a paid pilot; change the economics and labels together if the intent differs. The choice is exclusive and immutable after confirmation. Show eligibility, expiration, remaining stock and any required qualifying purchase before the guest plays. Do not add hidden minimum spends.

Start with a transparent skill goal and a guaranteed disclosed reward when that goal is achieved, subject to stock reserved before play. No paid chances, cash prizes or purchasable attempts. A menu discount earned in a promotional game is not automatically legally approved: local promotion terms, privacy, fiscal treatment and any chance-based changes require a separate jurisdiction-specific review before launch. This document makes no compliance claim.

## Guest flow

1. Scan table/receipt QR; view restaurant identity, menu and reward terms.
2. Staff-issued code binds one eligible game session to an actual open order. A public QR alone is only navigation, not proof of purchase.
3. Play a short cafe challenge using the existing game engine. Campaign duration and goal are measured in tests; do not promise completion in a fixed time without evidence.
4. After a verified goal, choose half-price now or free on a future visit. Show the dish, final price, expiry and restrictions explicitly.
5. Display a redeemable voucher. Staff confirms it; a screen animation or customer screenshot cannot redeem a voucher.
6. A future-visit voucher is retrieved through a consented contact channel or durable guest account. Local storage alone is only suitable for this demonstration.

If stock disappears after reservation, use the published cancellation/substitution policy with explicit guest consent; do not silently replace a prize. Current-order rewards expire when the qualifying order closes or at the campaign limit, whichever comes first. Future rewards have a clearly displayed date. The pure helper checks timestamps and order identity; checking order status remains a server responsibility.

## Restaurant console

- Profile: name, restaurant photo, logo, address and brand colors.
- Menu: photo, price, availability and which dishes participate.
- Campaign: goal, permitted attempt count, eligible order conditions, expiry, per-day reward cap, cost ceiling and launch/pause control.
- Rewards: issued, pending, redeemed, expired and cancelled, with staff confirmation and audit log.
- Performance: eligible orders, starts, completions, reward choices, redemptions, repeat visits and actual reward cost. Demo charts must say “demo data”.
- Roles: owner controls billing/configuration and staff access; manager manages campaigns/menu; cashier validates and redeems; analyst reads aggregate reporting. All roles are tenant-scoped.

## Hypothetical economics — not a forecast

Example dish: retail price 1,200 KZT, variable food cost 350 KZT. At 50% off, guest pays 600 KZT: dish contribution is 250 KZT before labor, rent, tax and other costs. The retail discount is 600 KZT, which is not the same as cash food cost. A free dish costs 350 KZT in food but forgoes 1,200 KZT of retail revenue if it replaces a purchase. Do not count every return visit as incremental revenue.

Example allocation: 100 verified wins, 40 choose half-price now, 60 choose free next visit, and 30 of the latter are redeemed. Half-price dishes collect 24,000 KZT with 14,000 KZT food cost. Free redemptions incur 10,500 KZT food cost. Total promotion dish contribution is -500 KZT before overhead, compared with no promotion dishes; the true business result depends on displaced purchases and incremental basket contribution. Unredeemed vouchers are still outstanding commitments until expiry.

Use a control group or alternating comparable service periods to assess repeat rate and contribution. Track net incremental contribution, not just game starts or face value of rewards. No unsupported conversion uplift percentages belong on the landing page.

## Production architecture

Use the current frontend and shared deterministic game engine; introduce one backend with PostgreSQL and object storage when moving from demo to pilot. Core tables: tenants, memberships, venues, menu_items, campaigns, orders, game_sessions, session_moves, rewards, redemptions, budget_reservations and audit_events.

- Every business row is tenant-scoped. Derive tenant membership from authenticated server context; never trust a client-supplied tenantId. Enforce isolation in application queries and database policies, and test cross-tenant access.
- Restaurant/admin authentication, session expiry and server-side role authorization are mandatory. Guest identity can be pseudonymous; avoid collecting phone numbers without an actual retrieval need and clear consent.
- Server creates the session, engine/rules version, seed, campaign snapshot, expiry and order binding. Client submits ordered moves; replay them on the server and verify goals, legal moves, attempt limits and completion once. Client score or “won” state is never authoritative.
- Reservation, issuance, budget and stock updates require transactions. Reserve the maximum possible commitment before offering a session; release unused reservations under a defined expiry policy.
- Reward choice uses an idempotency key and conditional update from unchosen to chosen. Bind issued vouchers to tenant, guest and source order. Store a hashed high-entropy opaque redeem token; never use predictable demo codes in production.
- Redemption transaction checks tenant, staff role, guest/order applicability, order status, expiry and availability; atomically marks one available reward redeemed and records the redemption. Use a unique reward redemption constraint. Repeated requests with the same idempotency key return the original result; a different request cannot redeem again.
- A future visit needs a different order opened after issuance. Define anti-abuse rules for splitting an order into two; a client timestamp is not evidence of a return visit.
- Use server timestamps and venue timezone for daily caps. Signed public QR URLs must not contain personal data. Rate-limit code claims and voucher lookups. Redact customer data from analytics and logs.
- POS integration is optional for pilot: staff may enter/confirm order references. Real automatic discounts require a POS adapter and settlement reconciliation, not a simulated browser deduction.

`packages/rewards/src/index.ts` supplies dependency-free quote and redemption-policy helpers, with integer minor-unit amounts. It provides **no** authentication, concurrency safety, budget ledger or server verification. Never present local-storage vouchers as production-secure.

## Delivery sequence and acceptance gates

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| Interactive demo | Landing, branded cafe console, menu editing, reward journey, polished mobile game | Working navigation, explicit demo labelling, no real payments or fabricated customers; verified build and key browser scenarios |
| Pilot backend | Auth, tenant isolation, order codes, replay verification, transactional issue/redeem, audit | Cross-tenant, repeat-submit, budget exhaustion, expired voucher and stock-race tests pass |
| One-cafe pilot | Staff onboarding, agreed dishes/terms, support workflow | Cashier can validate a voucher, reconcile discounts and recover from network failures |
| Evaluation | Compare contribution and return visits with control period | Evidence supports continuation; owner approves economics and terms |
| Multi-cafe | Onboarding, permissions, storage quotas, billing and POS adapters | Isolation/load/security review and documented operations |

Parallel work can be split across landing design, restaurant demo, mobile gameplay polish, and reward architecture/testing. Keep common brand tokens, route conventions and restaurant/reward data contracts shared. Integrate and test the guest journey end to end before publication. Physical iPhone performance and real restaurant operations remain separate validation tasks.
