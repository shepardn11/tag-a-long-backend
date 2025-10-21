## Stripe Subscription Setup Guide for Tag-A-Long

Complete guide to implementing Stripe subscriptions in your Tag-A-Long app.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stripe Account Setup](#stripe-account-setup)
3. [Configure Products & Prices](#configure-products--prices)
4. [Deploy Database Migration](#deploy-database-migration)
5. [Deploy Edge Functions](#deploy-edge-functions)
6. [Configure Webhooks](#configure-webhooks)
7. [Frontend Integration](#frontend-integration)
8. [Testing](#testing)
9. [Go Live](#go-live)

---

## Prerequisites

✅ Supabase project created and configured
✅ Migrations 01-06 deployed successfully
✅ Storage buckets created
✅ Supabase CLI installed

---

## 1. Stripe Account Setup

### Step 1.1: Create Stripe Account

1. Go to https://stripe.com
2. Click **"Start now"** or **"Sign up"**
3. Complete account registration
4. Verify your email

### Step 1.2: Get API Keys

1. In Stripe Dashboard → **Developers** → **API keys**
2. Copy your **Test mode** keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

⚠️ **IMPORTANT:** Keep the Secret key confidential!

---

## 2. Configure Products & Prices

### Step 2.1: Create Product

1. In Stripe Dashboard → **Products** → **Add product**
2. Configure:
   ```
   Name: Tag-A-Long Premium
   Description: Unlimited listings, unlimited requests, and premium features
   ```
3. Click **Save product**

### Step 2.2: Create Price

1. Under your new product, click **Add price**
2. Configure:
   ```
   Price: $9.99 USD
   Billing period: Monthly
   ```
3. Click **Add price**
4. **Copy the Price ID** (starts with `price_`)

### Step 2.3: Update Database

Run this SQL in Supabase SQL Editor:

```sql
UPDATE subscription_plans
SET
  stripe_price_id = 'price_XXXXXXXXXXXXX', -- Your actual Price ID
  stripe_product_id = 'prod_XXXXXXXXXXXXX' -- Your actual Product ID
WHERE slug = 'premium';
```

---

## 3. Deploy Database Migration

### Run Migration 07

1. In Supabase Dashboard → **SQL Editor**
2. Copy entire contents of `migrations/07_subscriptions.sql`
3. Paste and click **Run**
4. Verify success ✅

This creates:
- `subscription_plans` table
- `user_subscriptions` table
- `usage_tracking` table
- `payment_history` table
- Helper functions for limits & premium checks

---

## 4. Deploy Edge Functions

### Install Supabase CLI (if not installed)

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
scoop install supabase
```

### Step 4.1: Link Your Project

```bash
cd tag-a-long-backend/supabase
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in Supabase Dashboard → Settings → General

### Step 4.2: Set Secrets

```bash
# Set Stripe Secret Key
supabase secrets set STRIPE_SECRET_KEY=sk_test_XXXXXXXXXX

# Set Stripe Webhook Secret (get this after Step 6)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXX

# Set App URL (for redirect after payment)
supabase secrets set APP_URL=myapp://

# You already have these from Supabase setup
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

### Step 4.3: Deploy Functions

```bash
# Deploy all functions
supabase functions deploy create-subscription
supabase functions deploy cancel-subscription
supabase functions deploy stripe-webhook
```

You should see:
```
✓ Deployed Function create-subscription
✓ Deployed Function cancel-subscription
✓ Deployed Function stripe-webhook
```

---

## 5. Configure Webhooks

### Step 5.1: Get Webhook URL

Your webhook URL is:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

### Step 5.2: Add Webhook in Stripe

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL (from above)
4. Click **Select events** and choose:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**

### Step 5.3: Get Webhook Secret

1. Click on your newly created webhook
2. Click **Reveal** next to **Signing secret**
3. Copy the secret (starts with `whsec_`)
4. Run:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXX
   ```

---

## 6. Frontend Integration

### Step 6.1: Install Dependencies

```bash
# In your React Native project
npm install @stripe/stripe-react-native
```

### Step 6.2: Initialize Stripe

```typescript
// App.tsx or index.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = 'pk_test_XXXXXXXXXX';

export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      {/* Your app */}
    </StripeProvider>
  );
}
```

### Step 6.3: Implement Subscription Flow

```typescript
// SubscriptionScreen.tsx
import { supabase } from './lib/supabase';
import { useStripe } from '@stripe/stripe-react-native';
import { Linking } from 'react-native';

export function SubscriptionScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const subscribeToPremium = async () => {
    try {
      // 1. Create checkout session
      const { data, error } = await supabase.functions.invoke(
        'create-subscription',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) throw error;

      // 2. Open Stripe checkout in browser
      await Linking.openURL(data.url);

      // User completes payment, returns to app via deep link
      // Webhook handles database updates automatically
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Error', 'Failed to start subscription');
    }
  };

  return (
    <Button title="Upgrade to Premium" onPress={subscribeToPremium} />
  );
}
```

### Step 6.4: Check Usage Limits

```typescript
// Before creating listing
const { data: limitCheck } = await supabase.rpc('can_create_listing');

if (!limitCheck.allowed) {
  Alert.alert(
    'Limit Reached',
    limitCheck.message,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Upgrade', onPress: () => navigate('Subscription') },
    ]
  );
  return;
}

// Proceed with creating listing
// Usage is auto-incremented via database trigger
```

### Step 6.5: Display Premium Status

```typescript
// ProfileScreen.tsx
const { data: userPlan } = await supabase.rpc('get_user_plan');

const { data: usageStats } = await supabase.rpc('get_usage_stats');

return (
  <View>
    <Text>Plan: {userPlan.plan_name}</Text>
    {userPlan.is_premium && <Badge>✓ Premium</Badge>}

    {!userPlan.is_premium && (
      <>
        <Text>Listings: {usageStats.listings.used} / {usageStats.listings.limit}</Text>
        <Text>Requests: {usageStats.requests.used} / {usageStats.requests.limit}</Text>
      </>
    )}
  </View>
);
```

### Step 6.6: Cancel Subscription

```typescript
const cancelSubscription = async () => {
  const { data, error } = await supabase.functions.invoke(
    'cancel-subscription',
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        immediate: false, // Cancel at period end (default)
        // or immediate: true to cancel now
      },
    }
  );

  if (error) throw error;

  Alert.alert('Success', data.message);
};
```

---

## 7. Testing

### Test with Stripe Test Mode

Use these test card numbers:

**Successful Payment:**
```
Card: 4242 4242 4242 4242
Exp: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Payment Declined:**
```
Card: 4000 0000 0000 0002
```

### Test Flow:

1. **Sign up as new user** → Automatically on Free plan
2. **Create 5 listings** → Should work
3. **Try 6th listing** → Should be blocked
4. **Click "Upgrade to Premium"**
5. **Complete Stripe checkout** (use test card)
6. **Return to app** → Premium badge appears
7. **Create unlimited listings** → No limits
8. **Cancel subscription** → Downgrade at period end

### Verify in Database:

```sql
-- Check user subscription
SELECT * FROM user_subscriptions WHERE user_id = 'YOUR_USER_ID';

-- Check usage
SELECT * FROM usage_tracking WHERE user_id = 'YOUR_USER_ID';

-- Check payments
SELECT * FROM payment_history WHERE user_id = 'YOUR_USER_ID';
```

---

## 8. Go Live

### Checklist Before Production:

- [ ] Switch to Stripe **Live mode**
- [ ] Update `STRIPE_SECRET_KEY` with live key (`sk_live_`)
- [ ] Update frontend with live publishable key (`pk_live_`)
- [ ] Update webhook URL to use live mode
- [ ] Test with real card (small amount)
- [ ] Set up Stripe payout method
- [ ] Configure email receipts in Stripe
- [ ] Update price if needed ($9.99 → final price)
- [ ] Enable Apple Pay / Google Pay (optional)
- [ ] Add privacy policy & terms of service links

---

## 9. Monitoring & Maintenance

### Stripe Dashboard

Monitor in real-time:
- Active subscriptions
- Failed payments
- Churn rate
- Revenue

### Database Queries

```sql
-- Count premium users
SELECT COUNT(*) FROM user_subscriptions
WHERE status = 'active'
AND plan_id = (SELECT id FROM subscription_plans WHERE slug = 'premium');

-- Monthly recurring revenue (MRR)
SELECT COUNT(*) * 9.99 AS mrr
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active' AND sp.slug = 'premium';

-- Users hitting limits
SELECT u.user_id, u.listings_created, u.requests_sent
FROM usage_tracking u
JOIN user_subscriptions s ON u.user_id = s.user_id
JOIN subscription_plans p ON s.plan_id = p.id
WHERE p.slug = 'free'
AND (u.listings_created >= 5 OR u.requests_sent >= 10);
```

---

## Troubleshooting

### "No Stripe Price ID" Error
→ Make sure you updated the `subscription_plans` table with your Stripe Price ID (Step 2.3)

### Webhook Not Working
→ Check webhook secret is correct: `supabase secrets list`
→ Check webhook events are selected in Stripe Dashboard
→ Check Edge Function logs: `supabase functions logs stripe-webhook`

### User Upgraded But Still Shows Free
→ Check `user_subscriptions` table
→ Check webhook received event (Stripe Dashboard → Webhooks → Logs)
→ Check Edge Function logs for errors

### Payment Succeeded But User Not Upgraded
→ Webhook probably failed
→ Check webhook logs in Stripe Dashboard
→ Manually fix: Update `user_subscriptions` table with premium plan_id

---

## 🎉 You're Done!

Your Tag-A-Long app now has:
✅ Freemium subscription model
✅ Usage limits (5 listings, 10 requests/month)
✅ Premium tier ($9.99/month)
✅ Stripe payment processing
✅ Automatic webhook handling
✅ Cancel anytime functionality

**Questions?** Check Stripe docs or Supabase docs for more details.
