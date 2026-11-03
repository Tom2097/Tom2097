# DigiT Growth Plan

_Written 2026-11-02, after a full click-through test of https://digit-ai.org (public site and signed-in app)._

## What we observed

- Homepage is thin: ~350 words, three sections, no product screenshots, demo video, FAQ, or customer proof.
- Sign-up page says "no credit card required", but checkout authorizes a card ("Your card is authorized now but not charged").
- Visitor tracking already existed (`/platform/admin/visitors`); it lacked traffic sources and a funnel.
- Sitemap has 10 URLs; the blog has 3 posts.
- Pricing is shown only in USD ($499/year or $44.49/month). The INR price in `lib/products.ts` (`ANNUAL_PRICE_INR_PAISE`) is marked as an unconfirmed placeholder.
- New accounts land on an empty dashboard (all zeros, "No contacts yet"), and a card is required before the trial starts.
- Strong but under-marketed India edge: Hindi + Punjabi UI, DPDP compliance, GST/MCA verification, Razorpay, a geo-aware pricing component.

## Quick wins (days)

1. **Fix the card contradiction.** Make the sign-up copy match checkout, or offer a no-card trial (see 7).
2. **Add analytics + funnel events.** Vercel Analytics or PostHog; track sign-up, trial started, first contact added.
3. **Upgrade the homepage.** 3–4 real screenshots or a 60-second video; FAQ section (with FAQ structured data); "Book a demo" next to "Start free trial"; customer logos/quotes once design partners agree to be named.

## Medium term (weeks)

4. **Pick a clear audience.** e.g. "The all-in-one operating system for Indian mid-size businesses" instead of generic "AI-powered enterprise operations".
5. **Show INR pricing to Indian visitors.** Confirm the real INR price first, then turn on the geo-aware pricing component; mention GST invoices and Razorpay/UPI.
6. **Industry and use-case landing pages.** One per existing setup wizard: healthcare, manufacturing, legal, retail, banking, education (e.g. "DigiT for clinics"). Add them to the sitemap.
7. **Instant try.** A demo workspace with sample data, and/or a no-card trial, so new users see the AI features in their first minute. Add an onboarding checklist and CSV/Gmail import to fill the empty dashboard.

## Ongoing

8. **Content people search for.** Comparison pages ("DigiT vs Zoho One", "HubSpot alternatives for Indian SMBs"), a DPDP compliance checklist, how-to guides per module. Aim for a steady weekly cadence.
9. **Distribution.**
   - Product Hunt launch.
   - G2 and Capterra listings.
   - Google Workspace and Slack marketplace listings (integrations already exist).
   - Founder content on LinkedIn.
   - Partnerships with CA firms and consultants who advise the target businesses.
10. **Trust pages.** About/team page; company address and contact details. Keep every claim matching the Security page (no certifications that aren't held).

## Status (2026-11-03)

Done in code: card wording (1), funnel + traffic sources on the visitors page (2), homepage FAQ with FAQ structured data, "Book a demo" (email), India section (3, 4 partly), six industry pages in the sitemap (6), "Getting started" checklist on the dashboard (7 partly), DPDP checklist blog post (8 partly).

Also done: CSV contact import (7), toast and industry page translations, SSO/SAML and data residency removed from the plan's feature list because neither is built, Predictive Modeling tab hidden until real model training exists (code kept in components/digit/predictive-modeling.tsx), homepage headline aimed at growing businesses in India (4), hero panel labelled as sample data, DigiT vs Zoho One post (8).

Still open: real screenshots/video and customer proof (3); INR price (5, needs the real price); demo workspace or no-card trial (7, business decision); more comparison pages (8); distribution (9); About page and company address (10, needs real details).

## Open items needing the owner (not code)

- Delete the four "TEST QA … delete me" records left in production by QA testing: a CRM contact, a CRM task, a feedback item, and a Performance objective (each has Delete in its "…" menu).
- Add `http://localhost` and `http://localhost:3100` as Authorized JavaScript origins on the Google OAuth client (ID starts `484920…`) so Google sign-in works locally.
- Review legal wording: Terms and Refund policy now say the trial is 1 month (matches `STANDARD_TRIAL_DAYS = 30`). The Refund policy still says yearly plans are non-refundable with a 3-month minimum commitment — confirm that is current policy.
