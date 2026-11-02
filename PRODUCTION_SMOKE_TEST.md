# DigiT AI — Production Smoke Test

This document provides step-by-step instructions to verify that the complete signup → payment → dashboard flow works on the live production site.

## Test Environment
- **URL:** https://digit-ai.org/
- **Payment Method:** Stripe test card (no real charges)
- **Estimated Duration:** 5-10 minutes

---

## Test Case 1: Signup and Account Creation

### Steps:
1. Open https://digit-ai.org/
2. Click **"Get Started"** or navigate to `/auth/signup`
3. Fill in the form:
   - **Email:** `test-user-$(date +%s)@example.com` (use a unique timestamp)
   - **Password:** Any strong password (12+ chars, mix of upper/lower/number/symbol)
   - **Full Name:** "Test User"
4. Click **"Sign Up"**
5. Verify you are redirected to the **onboarding page** (not an error)

### Expected Outcome:
- ✅ Account created successfully
- ✅ Onboarded to industry selection or dashboard
- ❌ If you see an error or are stuck on the signup page, note the exact error message

---

## Test Case 2: Navbar Auth State (Bug Fix #1 Verification)

### Steps:
1. From the dashboard or any authenticated page, observe the **top-right navbar**
2. Look for your user avatar / profile menu
3. **Important:** Refresh the page (`Cmd+R` / `Ctrl+R`) and watch carefully for 1-2 seconds

### Expected Outcome:
- ✅ Your user avatar is visible immediately (no flash of "Sign In" buttons)
- ✅ You can click the avatar and see a dropdown menu with "Sign Out"
- ❌ **If you see "Sign In" buttons briefly flash**, that's the navbar flash bug (not fixed)

---

## Test Case 3: Pricing and Checkout Entry

There is a single plan: **DigiT -- $499/year or $44.49/month**, with a **1-month free trial**. There is no `/pricing` page; pricing is the `#pricing` section of the homepage.

### Steps:
1. On the homepage click **"Pricing"** in the nav (or **"View pricing"**) -- the page scrolls to the pricing section
2. Verify it shows one plan at **$499/year or $44.49/month** and "1-month free trial"
3. Click **"Start free trial"** on the pricing card
4. Signed out: you land on `/auth/login?redirect=/checkout`. Signed in: you land on `/checkout`

### Expected Outcome:
- ✅ Pricing shows the single DigiT plan and a 1-month trial (no Free/Pro/Enterprise tiers, no "7-day" wording)
- ✅ "Start free trial" reaches checkout (directly or via login)
- ❌ If any page still mentions Starter/Professional/Enterprise tiers or a 7-day trial, note where

---

## Test Case 4: Checkout and Payment (Bug Fix #2 & #3 Verification)

### Steps:
1. On the Checkout page, verify the **payment amount** is shown correctly
2. Scroll down to the **Stripe payment form**
3. Enter **Stripe test card details:**
   - Card Number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/30`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)
4. Click **"Complete Payment"** or **"Subscribe"**
5. Wait for the page to process (should take 2-5 seconds)

### Expected Outcome:
- ✅ Payment form submits without errors
- ✅ You see a **success page** or are redirected to `/checkout/success`
- ✅ A confirmation message like "Subscription activated" appears
- ❌ **If you see:** `"An error occurred in the Server Components render..."` — that's the payment crash bug (not fixed)
- ❌ **If checkout page is blank or unresponsive** — server action failed

---

## Test Case 5: Post-Payment Dashboard Access

### Steps:
1. From the success page, click **"Go to Dashboard"** or navigate to `/` while logged in
2. Verify the **main dashboard** loads with real data:
   - Subscription card shows your active plan
   - "Enterprise AI Modules" says you have access to **6 of 6** modules (none locked)
   - Settings shows "**DigiT Plan**" (not "{trialing} Plan") and "1-month free trial"
   - Revenue/activity charts are visible
   - No errors in the browser console
3. Navigate to **CRM** (`/crm`) — should show "No contacts yet" (honest empty state, not fake data)
4. Navigate to **Analytics** (`/analytics`) — should show real event data or empty state
5. Try the **back button** — should work correctly

### Expected Outcome:
- ✅ Dashboard loads cleanly with your subscription active
- ✅ All pages (CRM, Analytics, workspaces) respond correctly
- ✅ Back button works as expected
- ❌ If back button redirects to homepage instead of the previous page, that's the back button bug (not fixed)

---

## Test Case 6: Email Verification

### Steps:
1. Check the inbox for the test email you used in Step 1
2. Look for an **email from DigiT** with:
   - Order confirmation or subscription activation notice
   - Invoice details (date, amount, plan name)
   - Customer portal link

### Expected Outcome:
- ✅ Confirmation email arrives within 1-2 minutes
- ✅ Email contains correct subscription details
- ❌ No email or email with wrong information suggests webhook failure

---

## Troubleshooting

### If Test Case 4 (Payment) Fails:

**Error: "Server Components" error or blank page**
- This is the payment crash bug (not fixed)
- Action: Stop testing, report to developer with screenshot

**Error: Back button goes to homepage instead of pricing**
- This is the back button bug (not fixed)
- Action: Stop testing, report to developer

**Error: Payment succeeds but dashboard shows old plan**
- Billing data not syncing
- Action: Hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`), wait 5 seconds, check again

### If Test Case 1 (Signup) Fails:

**Error: Form won't submit or email validation fails**
- Auth system issue
- Action: Report the exact error message

**Error: "Organization could not be created"**
- Database or tenant context issue
- Action: Report and provide email used

---

## Final Verdict

### ✅ PRODUCTION READY if:
- All 6 test cases pass without errors
- Navbar doesn't flash on refresh
- Payment completes and subscription activates
- Dashboard loads with real data
- Back button works correctly
- Confirmation email arrives

### ❌ NOT READY if:
- Any error appears in Test Case 4 (Payment)
- Navbar flashes "Sign In" buttons
- Dashboard shows 500 errors or blank pages
- Email doesn't arrive within 2 minutes

---

## Report Template

When reporting results, provide:

```
Test Date: [date]
Browser: [Chrome/Safari/Firefox + version]
Account Email: [test email used]
Billing Interval: [Annual / Monthly]

Test Case Results:
1. Signup: ✅ / ❌ [notes]
2. Navbar Auth: ✅ / ❌ [notes]
3. Pricing & Checkout Entry: ✅ / ❌ [notes]
4. Checkout Payment: ✅ / ❌ [notes]
5. Dashboard: ✅ / ❌ [notes]
6. Email: ✅ / ❌ [notes]

Overall: [PRODUCTION READY / NEEDS FIXES]

Errors Encountered: [paste exact error messages]
```
