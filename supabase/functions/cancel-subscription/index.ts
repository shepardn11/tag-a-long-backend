// Supabase Edge Function: cancel-subscription
// Allows users to cancel their premium subscription

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('stripe_subscription_id, status, plan_id')
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // Check if already cancelled or on free plan
    if (subscription.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Subscription already cancelled' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get plan details to check if premium
    const { data: plan } = await supabaseClient
      .from('subscription_plans')
      .select('slug')
      .eq('id', subscription.plan_id)
      .single()

    if (plan?.slug === 'free') {
      return new Response(
        JSON.stringify({ error: 'You are on the free plan' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!subscription.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'No Stripe subscription found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Parse request body for immediate cancellation option
    const { immediate = false } = await req.json().catch(() => ({ immediate: false }))

    if (immediate) {
      // Cancel immediately
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } else {
      // Cancel at period end (default)
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
    }

    // Update database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseAdmin
      .from('user_subscriptions')
      .update({
        cancel_at_period_end: !immediate,
        ...(immediate && { status: 'cancelled', cancelled_at: new Date().toISOString() }),
      })
      .eq('user_id', user.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: immediate
          ? 'Subscription cancelled immediately'
          : 'Subscription will cancel at the end of the billing period',
        cancelled_immediately: immediate,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
