# React Native Integration Examples for Tag-A-Long

Complete code examples for integrating your Supabase backend with React Native.

---

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Authentication](#authentication)
3. [Subscription Management](#subscription-management)
4. [Usage Limit Enforcement](#usage-limit-enforcement)
5. [Profile & Premium Badge](#profile--premium-badge)
6. [Complete Component Examples](#complete-component-examples)

---

## Setup & Configuration

### Install Dependencies

```bash
npm install @supabase/supabase-js
npm install @stripe/stripe-react-native
npm install @react-navigation/native @react-navigation/stack
```

### Initialize Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = 'https://your-project.supabase.co'
const supabaseAnonKey = 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### App Root Setup

```typescript
// App.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = 'pk_test_XXXXXXXXXX';

export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <NavigationContainer>
        {/* Your navigation */}
      </NavigationContainer>
    </StripeProvider>
  );
}
```

---

## Authentication

### Sign Up

```typescript
// screens/SignUpScreen.tsx
import { supabase } from '../lib/supabase'

const signUp = async (email: string, password: string, userData: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: userData.username,
        display_name: userData.displayName,
        city: userData.city,
        date_of_birth: userData.dateOfBirth,
        bio: userData.bio,
      }
    }
  })

  if (error) {
    Alert.alert('Error', error.message)
    return
  }

  // Profile & free subscription auto-created by triggers!
  Alert.alert('Success', 'Account created! Please verify your email.')
}
```

### Sign In

```typescript
// screens/SignInScreen.tsx
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    Alert.alert('Error', error.message)
    return
  }

  navigation.navigate('Home')
}
```

### Auth State Listener

```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, user: session?.user }
}
```

---

## Subscription Management

### Check Premium Status

```typescript
// hooks/useSubscription.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSubscription() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlan()
  }, [])

  const fetchPlan = async () => {
    const { data, error } = await supabase.rpc('get_user_plan')

    if (!error && data) {
      setPlan(data)
    }

    setLoading(false)
  }

  return {
    plan,
    loading,
    isPremium: plan?.is_premium || false,
    refresh: fetchPlan,
  }
}
```

### Upgrade to Premium

```typescript
// screens/SubscriptionScreen.tsx
import { Linking } from 'react-native'
import { supabase } from '../lib/supabase'

export function SubscriptionScreen() {
  const [loading, setLoading] = useState(false)

  const upgradeToPremium = async () => {
    try {
      setLoading(true)

      // Call Edge Function to create checkout session
      const { data, error } = await supabase.functions.invoke(
        'create-subscription'
      )

      if (error) throw error

      // Open Stripe checkout URL
      await Linking.openURL(data.url)

      // After payment, webhook updates database automatically
      // When user returns to app, refresh subscription status

    } catch (error) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upgrade to Premium</Text>

      <View style={styles.features}>
        <FeatureItem icon="✓" text="Unlimited listings" />
        <FeatureItem icon="✓" text="Unlimited tag-along requests" />
        <FeatureItem icon="✓" text="Verification badge" />
        <FeatureItem icon="✓" text="Priority in search" />
        <FeatureItem icon="✓" text="See who viewed your profile" />
      </View>

      <Text style={styles.price}>$9.99/month</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={upgradeToPremium}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Loading...' : 'Subscribe Now'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function FeatureItem({ icon, text }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}
```

### Cancel Subscription

```typescript
// components/CancelSubscriptionButton.tsx
const cancelSubscription = async (immediate = false) => {
  Alert.alert(
    'Cancel Subscription',
    immediate
      ? 'Cancel immediately? You\'ll lose premium access right away.'
      : 'Cancel at end of billing period? You\'ll keep premium until then.',
    [
      { text: 'Keep Subscription', style: 'cancel' },
      {
        text: immediate ? 'Cancel Now' : 'Cancel Later',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data, error } = await supabase.functions.invoke(
              'cancel-subscription',
              {
                body: { immediate },
              }
            )

            if (error) throw error

            Alert.alert('Success', data.message)

            // Refresh subscription status
            navigation.goBack()
          } catch (error) {
            Alert.alert('Error', error.message)
          }
        },
      },
    ]
  )
}
```

---

## Usage Limit Enforcement

### Check Before Creating Listing

```typescript
// screens/CreateListingScreen.tsx
import { supabase } from '../lib/supabase'

const createListing = async (listingData) => {
  try {
    // 1. Check if user can create listing
    const { data: limitCheck } = await supabase.rpc('can_create_listing')

    if (!limitCheck.allowed) {
      // Show upgrade prompt
      Alert.alert(
        'Limit Reached',
        limitCheck.message,
        [
          { text: 'Maybe Later', style: 'cancel' },
          {
            text: 'Upgrade to Premium',
            onPress: () => navigation.navigate('Subscription'),
          },
        ]
      )
      return
    }

    // 2. Create listing
    const { data, error } = await supabase
      .from('listings')
      .insert({
        photo_url: listingData.photoUrl,
        caption: listingData.caption,
        city: listingData.city,
        time_text: listingData.timeText,
      })
      .select()
      .single()

    if (error) throw error

    // 3. Increment usage counter
    await supabase.rpc('increment_usage', { action_type: 'listing' })

    Alert.alert('Success', 'Listing created!')
    navigation.goBack()

  } catch (error) {
    Alert.alert('Error', error.message)
  }
}
```

### Check Before Sending Request

```typescript
// components/TagAlongButton.tsx
const sendTagAlongRequest = async (listingId) => {
  try {
    // 1. Check if user can send request
    const { data: limitCheck } = await supabase.rpc('can_send_request')

    if (!limitCheck.allowed) {
      Alert.alert(
        'Limit Reached',
        limitCheck.message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: () => navigation.navigate('Subscription'),
          },
        ]
      )
      return
    }

    // 2. Send request
    const { error } = await supabase
      .from('tag_along_requests')
      .insert({
        listing_id: listingId,
        requester_id: user.id,
      })

    if (error) throw error

    // 3. Increment usage counter
    await supabase.rpc('increment_usage', { action_type: 'request' })

    Alert.alert('Success', 'Request sent!')

  } catch (error) {
    Alert.alert('Error', error.message)
  }
}
```

### Display Usage Stats

```typescript
// components/UsageStatsCard.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function UsageStatsCard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { data } = await supabase.rpc('get_usage_stats')
    setStats(data)
  }

  if (!stats || stats.is_premium) {
    return null // Hide for premium users
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your Monthly Usage</Text>

      <View style={styles.stat}>
        <Text>Listings: {stats.listings.used} / {stats.listings.limit}</Text>
        <Progress
          value={stats.listings.used}
          max={stats.listings.limit}
        />
      </View>

      <View style={styles.stat}>
        <Text>Requests: {stats.requests.used} / {stats.requests.limit}</Text>
        <Progress
          value={stats.requests.used}
          max={stats.requests.limit}
        />
      </View>

      <TouchableOpacity
        style={styles.upgradeButton}
        onPress={() => navigation.navigate('Subscription')}
      >
        <Text>Upgrade for Unlimited</Text>
      </TouchableOpacity>
    </View>
  )
}
```

---

## Profile & Premium Badge

### Display Premium Badge

```typescript
// screens/ProfileScreen.tsx
import { useSubscription } from '../hooks/useSubscription'

export function ProfileScreen({ route }) {
  const { userId } = route.params
  const [profile, setProfile] = useState(null)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [userId])

  const fetchProfile = async () => {
    // Get profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    setProfile(profileData)

    // Check if premium
    const { data: premium } = await supabase.rpc('is_premium_user', {
      user_uuid: userId
    })

    setIsPremium(premium)
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: profile.profile_photo_url }} style={styles.avatar} />

      <View style={styles.nameRow}>
        <Text style={styles.name}>{profile.display_name}</Text>
        {isPremium && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ PREMIUM</Text>
          </View>
        )}
      </View>

      <Text style={styles.username}>@{profile.username}</Text>
      <Text style={styles.bio}>{profile.bio}</Text>
    </View>
  )
}
```

---

## Complete Component Examples

### Subscription Settings Screen

```typescript
// screens/SubscriptionSettingsScreen.tsx
import { useSubscription } from '../hooks/useSubscription'

export function SubscriptionSettingsScreen() {
  const { plan, isPremium, refresh } = useSubscription()
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure? You\'ll keep premium access until the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true)

              const { data, error } = await supabase.functions.invoke(
                'cancel-subscription',
                { body: { immediate: false } }
              )

              if (error) throw error

              Alert.alert('Success', data.message)
              refresh()
            } catch (error) {
              Alert.alert('Error', error.message)
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>You're on the Free Plan</Text>
        <Button
          title="Upgrade to Premium"
          onPress={() => navigation.navigate('Subscription')}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Premium Subscription</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{plan.status}</Text>
      </View>

      {plan.current_period_end && (
        <View style={styles.section}>
          <Text style={styles.label}>Renews On</Text>
          <Text style={styles.value}>
            {new Date(plan.current_period_end).toLocaleDateString()}
          </Text>
        </View>
      )}

      {plan.cancel_at_period_end && (
        <View style={styles.alert}>
          <Text>⚠️ Subscription will cancel on {new Date(plan.current_period_end).toLocaleDateString()}</Text>
        </View>
      )}

      <Button
        title="Cancel Subscription"
        onPress={handleCancel}
        disabled={loading || plan.cancel_at_period_end}
        color="red"
      />
    </View>
  )
}
```

### Paywall Modal

```typescript
// components/PaywallModal.tsx
export function PaywallModal({ visible, onClose, reason }) {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text>✕</Text>
        </TouchableOpacity>

        <Text style={styles.emoji}>🚀</Text>
        <Text style={styles.title}>Upgrade to Premium</Text>

        {reason === 'listing_limit' && (
          <Text style={styles.message}>
            You've reached your 5 listings limit this month.
            Upgrade for unlimited listings!
          </Text>
        )}

        {reason === 'request_limit' && (
          <Text style={styles.message}>
            You've reached your 10 requests limit this month.
            Upgrade for unlimited connections!
          </Text>
        )}

        <View style={styles.features}>
          <FeatureItem icon="∞" text="Unlimited listings" />
          <FeatureItem icon="∞" text="Unlimited requests" />
          <FeatureItem icon="✓" text="Verification badge" />
          <FeatureItem icon="⭐" text="Priority placement" />
        </View>

        <Text style={styles.price}>Just $9.99/month</Text>

        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => {
            onClose()
            navigation.navigate('Subscription')
          }}
        >
          <Text style={styles.upgradeText}>Upgrade Now</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.later}>Maybe Later</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  )
}
```

---

## Deep Linking (Return from Stripe)

### Configure Deep Links

```typescript
// app.json or Info.plist
{
  "expo": {
    "scheme": "tagalong",
    "ios": {
      "bundleIdentifier": "com.yourcompany.tagalong"
    },
    "android": {
      "package": "com.yourcompany.tagalong"
    }
  }
}
```

### Handle Deep Link

```typescript
// App.tsx
import { Linking } from 'react-native'

useEffect(() => {
  // Handle deep link when app opens
  Linking.getInitialURL().then(handleDeepLink)

  // Handle deep link when app is already open
  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url)
  })

  return () => subscription.remove()
}, [])

const handleDeepLink = (url: string | null) => {
  if (!url) return

  // Parse URL: tagalong://subscription/success?session_id=xxx
  if (url.includes('subscription/success')) {
    // Subscription successful!
    Alert.alert('Welcome to Premium!', 'Your subscription is now active.')

    // Refresh user data
    navigation.navigate('Profile')
  }
}
```

---

## Testing Checklist

- [ ] Sign up creates free subscription automatically
- [ ] Usage limits enforced (5 listings, 10 requests)
- [ ] Upgrade flow opens Stripe checkout
- [ ] Payment success updates database via webhook
- [ ] Premium badge shows on profile
- [ ] Unlimited listings/requests work
- [ ] Cancel subscription works
- [ ] Usage resets monthly

---

## Production Checklist

- [ ] Switch to Stripe live keys
- [ ] Test with real card (small amount)
- [ ] Configure app deep linking (iOS/Android)
- [ ] Add privacy policy link
- [ ] Add terms of service link
- [ ] Test app store approval (in-app purchase disclosure)
- [ ] Set up error tracking (Sentry)
- [ ] Monitor Stripe dashboard for issues

---

🎉 **You're ready to build your mobile app!**
