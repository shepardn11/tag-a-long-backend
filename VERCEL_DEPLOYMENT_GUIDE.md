# Vercel Deployment Guide - Tag-A-Long Backend with Stripe

Complete guide to deploying your Tag-A-Long backend with Stripe payments on Vercel.

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ Supabase project created and migrations 01-07 deployed
2. ✅ Stripe account created
3. ✅ Vercel account created
4. ✅ All code committed to Git (GitHub, GitLab, or Bitbucket)

---

## 🚀 Step 1: Install Dependencies

Make sure all packages are installed:

```bash
npm install
```

This installs:
- `stripe` - Stripe payment processing
- `@supabase/supabase-js` - Supabase client
- All other existing dependencies

---

## 🔧 Step 2: Configure Environment Variables in Vercel

### 2.1 Deploy to Vercel First

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect it as a Node.js project
5. Click "Deploy" (it will fail without env vars - that's ok!)

### 2.2 Add Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:

#### Existing Variables (you probably have these)
```
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-this
JWT_EXPIRES_IN=7d
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-west-2
AWS_S3_BUCKET=tagalong-uploads
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-firebase-private-key
FIREBASE_CLIENT_EMAIL=your-firebase-email
CORS_ORIGIN=https://tagalong.app,tagalong://
```

#### NEW Variables for Supabase + Stripe
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
STRIPE_SECRET_KEY=sk_live_xxxxx (or sk_test_xxxxx for testing)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx (we'll get this in Step 3)
APP_URL=tagalong://
```

### 2.3 Where to Find These Values

**SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY:**
1. Go to your Supabase project
2. Click **Settings** (gear icon) → **API**
3. Copy:
   - Project URL → `SUPABASE_URL`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (NOT anon key!)

**STRIPE_SECRET_KEY:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **Developers** → **API Keys**
3. Copy the **Secret key** (starts with `sk_test_` or `sk_live_`)

**STRIPE_WEBHOOK_SECRET:**
- We'll get this in Step 3 after setting up the webhook

**APP_URL:**
- For React Native: `tagalong://`
- For web: `https://yourapp.com/`

### 2.4 Redeploy

After adding env vars:
1. Go to **Deployments** tab
2. Click the "..." menu on the latest deployment
3. Click **Redeploy**

Your backend should now deploy successfully!

---

## 💳 Step 3: Set Up Stripe

### 3.1 Create Premium Product in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **Products** → **Add Product**
3. Fill in:
   - **Name:** Premium Subscription
   - **Description:** Priority placement in activity feeds
   - **Pricing:**
     - Price: **$4.99**
     - Billing period: **Monthly**
     - Recurring
   - **Click "Save product"**

4. **Copy the Price ID:**
   - After saving, you'll see a Price ID like `price_xxxxxxxxxxxxx`
   - Copy this - you'll need it next!

### 3.2 Add Price ID to Supabase

1. Go to your Supabase project
2. Click **SQL Editor** → **New query**
3. Run this SQL (replace with your actual Price ID):

```sql
UPDATE subscription_plans
SET stripe_price_id = 'price_xxxxxxxxxxxxx'  -- Replace with YOUR Price ID
WHERE slug = 'premium';
```

4. Click **Run**
5. Verify it worked:

```sql
SELECT name, slug, stripe_price_id FROM subscription_plans;
```

You should see the Price ID in the premium row.

### 3.3 Set Up Stripe Webhook

This is crucial - it updates your database when payments succeed/fail.

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Fill in:
   - **Endpoint URL:** `https://your-vercel-app.vercel.app/api/webhooks/stripe`
     - Replace `your-vercel-app` with your actual Vercel URL
   - **Description:** Tag-A-Long subscription webhook
   - **Events to send:** Select these 6 events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Click **Add endpoint**

5. **Copy the Signing Secret:**
   - After creating, click on the webhook
   - Click **Reveal** under "Signing secret"
   - Copy the value (starts with `whsec_`)

6. **Add to Vercel:**
   - Go to Vercel → **Settings** → **Environment Variables**
   - Add `STRIPE_WEBHOOK_SECRET` with the value you just copied
   - **Redeploy** your app

---

## 🧪 Step 4: Test the Integration

### 4.1 Test Checkout Flow

Use Stripe's test mode to verify everything works:

1. **Use test API keys:**
   ```
   STRIPE_SECRET_KEY=sk_test_xxxxx
   ```

2. **Test from your React Native app:**
   ```javascript
   // In your app
   const response = await fetch('https://your-app.vercel.app/api/subscription/create-checkout', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${userToken}`,
       'Content-Type': 'application/json'
     }
   });

   const { url } = await response.json();
   // Open url in WebView or browser
   ```

3. **Use Stripe test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

4. **Verify in Supabase:**
   ```sql
   SELECT * FROM user_subscriptions WHERE user_id = 'your-test-user-id';
   ```

   You should see:
   - `status = 'active'`
   - `stripe_subscription_id` populated
   - `plan_id` pointing to premium plan

### 4.2 Test Premium Features

1. **Create a listing as premium user**
2. **Check feed as free user:**
   ```javascript
   const response = await fetch('https://your-app.vercel.app/api/listings/feed');
   const listings = await response.json();

   // Premium listings should appear first
   console.log(listings[0].is_premium_listing); // should be true
   ```

### 4.3 Test Webhook Events

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click on your webhook
3. Click **Send test webhook**
4. Select `customer.subscription.created`
5. Click **Send test webhook**
6. Check the response - should be `200 OK`

---

## 📱 Step 5: Integrate with React Native

### 5.1 Create Checkout Flow

```javascript
// screens/UpgradeScreen.js
import { useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { WebView } from 'react-native-webview';

export default function UpgradeScreen() {
  const [checkoutUrl, setCheckoutUrl] = useState(null);

  const handleUpgrade = async () => {
    try {
      const response = await fetch(`${API_URL}/api/subscription/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      const { url } = await response.json();
      setCheckoutUrl(url); // Open Stripe checkout
    } catch (error) {
      Alert.alert('Error', 'Failed to start checkout');
    }
  };

  const handleWebViewNavigationStateChange = (navState) => {
    // Check if user completed checkout
    if (navState.url.includes('subscription/success')) {
      setCheckoutUrl(null);
      Alert.alert('Success', 'You are now a Premium member!');
      // Refresh user data
    }
  };

  if (checkoutUrl) {
    return (
      <WebView
        source={{ uri: checkoutUrl }}
        onNavigationStateChange={handleWebViewNavigationStateChange}
      />
    );
  }

  return (
    <View>
      <Button title="Upgrade to Premium - $4.99/mo" onPress={handleUpgrade} />
    </View>
  );
}
```

### 5.2 Show Premium Status

```javascript
// hooks/useSubscription.js
import { useState, useEffect } from 'react';

export function useSubscription() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPremium();
  }, []);

  const checkPremium = async () => {
    try {
      const response = await fetch(`${API_URL}/api/subscription/is-premium`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      const { isPremium } = await response.json();
      setIsPremium(isPremium);
    } catch (error) {
      console.error('Failed to check premium status');
    } finally {
      setLoading(false);
    }
  };

  return { isPremium, loading, refresh: checkPremium };
}
```

### 5.3 Display Premium Badge

```javascript
// components/ListingCard.js
function ListingCard({ listing }) {
  return (
    <View style={styles.card}>
      {listing.is_premium_listing && (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>⭐ PREMIUM</Text>
        </View>
      )}
      <Text>{listing.caption}</Text>
      <Text>{listing.time_text}</Text>
    </View>
  );
}
```

### 5.4 Cancel Subscription

```javascript
const handleCancel = async () => {
  Alert.alert(
    'Cancel Premium?',
    'You will lose priority placement at the end of your billing period.',
    [
      { text: 'Keep Premium', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${API_URL}/api/subscription/cancel`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ immediate: false })
          });
          Alert.alert('Cancelled', 'Premium will end at period end');
        }
      }
    ]
  );
};
```

---

## 🔒 Step 6: Go Live with Production Keys

When ready to accept real payments:

### 6.1 Switch to Live Mode in Stripe

1. Toggle to **Live mode** in Stripe Dashboard (top right)
2. Go to **Developers** → **API Keys**
3. Copy the **Live Secret key** (starts with `sk_live_`)

### 6.2 Update Vercel Environment Variables

1. Go to Vercel → **Settings** → **Environment Variables**
2. Update:
   ```
   STRIPE_SECRET_KEY=sk_live_xxxxx (LIVE key)
   ```

3. **Create new webhook for live mode:**
   - In Stripe Dashboard (Live mode) → **Developers** → **Webhooks**
   - Add endpoint with same URL
   - Copy the new signing secret
   - Update in Vercel:
     ```
     STRIPE_WEBHOOK_SECRET=whsec_xxxxx (LIVE webhook secret)
     ```

4. **Redeploy**

### 6.3 Update Stripe Price ID

1. In Stripe Live mode, create the Premium product again (same settings)
2. Copy the LIVE Price ID
3. Update in Supabase:
   ```sql
   UPDATE subscription_plans
   SET stripe_price_id = 'price_xxxxxxxxxxxxx'  -- LIVE Price ID
   WHERE slug = 'premium';
   ```

---

## 🎯 Step 7: Monitor and Maintain

### 7.1 Monitor Payments

**Stripe Dashboard:**
- **Payments** → See all transactions
- **Subscriptions** → See active/cancelled subs
- **Webhooks** → Check for failed webhook deliveries

**Supabase:**
```sql
-- Check active premium users
SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active';

-- Check payment history
SELECT * FROM payment_history ORDER BY created_at DESC LIMIT 10;

-- Check failed payments
SELECT * FROM payment_history WHERE status = 'failed';
```

### 7.2 Handle Failed Payments

When a payment fails:
1. User gets email from Stripe automatically
2. Webhook updates status to `past_due`
3. After retry period, status becomes `cancelled`
4. User downgraded to free plan automatically

### 7.3 Check Webhook Health

In Stripe Dashboard → **Developers** → **Webhooks**:
- Click on your webhook
- Check "Recent deliveries"
- All should be 200 OK
- If you see 400/500 errors, check Vercel logs

---

## 🐛 Troubleshooting

### Issue: "Webhook signature verification failed"

**Solution:**
- Make sure `STRIPE_WEBHOOK_SECRET` in Vercel matches the webhook's signing secret in Stripe
- Redeploy after updating the secret

### Issue: "Premium plan not configured"

**Solution:**
```sql
-- Check if stripe_price_id is set
SELECT * FROM subscription_plans WHERE slug = 'premium';

-- If null, update it
UPDATE subscription_plans
SET stripe_price_id = 'price_xxxxxxxxxxxxx'
WHERE slug = 'premium';
```

### Issue: Checkout redirects to wrong URL

**Solution:**
- Update `APP_URL` in Vercel environment variables
- For React Native: `tagalong://`
- For web: `https://yourapp.com/`

### Issue: User upgraded but still shows as free

**Solution:**
1. Check webhook was received:
   - Stripe Dashboard → Webhooks → Check recent deliveries
2. Check database:
   ```sql
   SELECT * FROM user_subscriptions WHERE user_id = 'xxx';
   ```
3. If not updated, manually trigger webhook test event

### Issue: Can't find auth middleware error

**Solution:**
The subscription routes expect an auth middleware. Check if you have `src/middleware/auth.js` that exports `authenticateUser`. If not, you'll need to create it or adjust the routes to use your existing auth middleware.

---

## 📊 Success Checklist

- [ ] Vercel deployed successfully
- [ ] All environment variables added
- [ ] Stripe product created ($4.99 Premium)
- [ ] Price ID added to Supabase
- [ ] Webhook endpoint created
- [ ] Webhook secret added to Vercel
- [ ] Test checkout works (test mode)
- [ ] Premium user listings appear first
- [ ] Webhook events process correctly
- [ ] React Native integration complete
- [ ] Switched to live keys (when ready)
- [ ] Live webhook created (when ready)

---

## 🎉 You're Done!

Your Tag-A-Long backend now has:
- ✅ Stripe subscription payments
- ✅ Premium priority placement
- ✅ Automatic webhook processing
- ✅ Deployed on Vercel
- ✅ Ready for production

**API Endpoints Available:**
```
POST   /api/subscription/create-checkout  - Start premium checkout
POST   /api/subscription/cancel           - Cancel subscription
GET    /api/subscription/status           - Get plan details
GET    /api/subscription/is-premium       - Check if premium
POST   /api/webhooks/stripe               - Stripe webhook handler
```

---

## 🔗 Helpful Resources

- [Stripe Testing](https://stripe.com/docs/testing) - Test card numbers
- [Stripe Webhooks](https://stripe.com/docs/webhooks) - Webhook documentation
- [Vercel Docs](https://vercel.com/docs) - Deployment guides
- [Supabase Docs](https://supabase.com/docs) - Database guides

---

**Need help?** Check the [STRIPE_IMPLEMENTATION_SUMMARY_V2.md](./supabase/STRIPE_IMPLEMENTATION_SUMMARY_V2.md) for business model details and frontend examples.
