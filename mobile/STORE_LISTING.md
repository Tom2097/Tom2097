# App Store / Play Store Listing Copy

Ready to paste directly into Play Console and App Store Connect. Grounded in
the same product description used on the website (`root.metadata.*` in
`lib/i18n/translations/en.json`) — not invented separately.

## App name (both stores, max 30 chars)

```
DigiT: AI Business Ops
```

## Google Play

**Short description** (max 80 chars):
```
AI-powered CRM, operations & compliance for growing businesses
```

**Full description** (max 4000 chars):
```
DigiT is an intelligent enterprise operations platform that learns from
your business, automates workflows, and helps you make better decisions —
all from your phone.

WHAT'S INSIDE
• Smart CRM — track leads, accounts, and deals with a pipeline that scores
  and prioritizes itself
• Real-time notifications — stay on top of what needs attention, the
  moment it happens
• One login, every module — CRM, compliance, operations, and AI analytics
  all read from the same data, so nothing gets out of sync between tools

SIMPLE, HONEST PRICING
One plan, unlimited team members: $499/year or $44.49/month, cancel
anytime. No per-seat pricing, no hidden tiers.

Sign in with the same account you use on digit-ai.org.
```

**Category:** Business

**Content rating:** Everyone (no user-generated content visible to other
users beyond the organization's own team; standard business-app rating
questionnaire answers apply)

**Privacy policy URL:** `https://digit-ai.org/privacy`

## Apple App Store

**Subtitle** (max 30 chars):
```
AI Operations, CRM & More
```

**Promotional text** (max 170 chars, optional — can be updated without a new build):
```
Real-time CRM, compliance, and operations data, all in one app. Sign in with the same account you already use on digit-ai.org.
```

**Description** (max 4000 chars): same copy as the Play Store full
description above.

**Keywords** (max 100 chars, comma-separated, no spaces after commas):
```
CRM,AI,operations,compliance,analytics,workflow,automation,enterprise,business,SaaS
```

**Category:** Business

**Privacy policy URL:** `https://digit-ai.org/privacy`

**Support URL:** `https://digit-ai.org/status` (or a dedicated support page if one exists later)

---

## What's still needed before either store submission is actually possible

This copy is ready, but submission itself needs things only you can do:

1. **Apple Developer Program** — $99/year, apple.com/developer. Required before any iOS OAuth client, entitlements, or App Store Connect listing can go live.
2. **Google Play Console account** — $25 one-time, play.google.com/console.
3. **Real device screenshots** — at least one per required size. I can capture real Android screenshots from a connected device (`adb shell screencap`) once you connect your phone; iOS screenshots need an actual Mac + simulator/device, which this environment doesn't have.
4. **Feature graphic** (Play Store, 1024×500 PNG) and any additional marketing graphics — not yet created.
5. **APNs key for Firebase** (iOS push) — Firebase Console → Project Settings → Cloud Messaging → Apple app configuration, uploaded from your Apple Developer account. Without this, iOS push notifications won't deliver even though the Android side already works.
6. The two Google OAuth clients (Android + iOS) from the earlier Google Sign-In setup — still pending your action in Google Cloud Console.
