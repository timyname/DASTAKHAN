# DASTAKHAN implementation status

## Cafe demo and mobile redesign — October 2026

Implemented on top of the existing game source (base commit 2ca82e2):
- Mobile-only game presentation, 440px maximum width, compact HUD, three-column levels, touch-friendly sheets and reduced-motion styles.
- Existing 11x11 engine, eleven food definitions, specials including BESH, campaign, tutorials and local saves retained.
- Restaurant marketing homepage with interactive cost scenario calculator; no invented customer metrics or promises of retention lift.
- Demo restaurant administration, local branding/photo, menu, reward limits and coupon walkthrough.
- Guest cafe entry and game routing; an actual game victory emits a presentation event. This is not a trusted server award.
- Pure reward policy and tests; architecture and pilot plan in CAFE_ROADMAP.md.

Routes: #home (marketing), #demo (restaurant console), #guest (guest), #play (mobile game).
All demo cafe data are browser-local. Coupons have no financial value. No payment, POS integration, real restaurant account authentication or secure production reward issuing is implemented.

Validation: run `npm run typecheck`, `npm test`, and `npm run build` from the repository root. Final results are recorded in the delivery message. Browser screenshots and physical iPhone performance were not verified in this environment. The pre-existing editor/gallery retain their independent entrypoints.

Production prerequisites: authenticated tenant roles, server-issued order sessions, deterministic game replay, transactional reward budget/inventory reservation, atomic redemption, operational audit and restaurant terms. See CAFE_ROADMAP.md for the staged plan.
