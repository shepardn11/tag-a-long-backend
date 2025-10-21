// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events for subscription updates

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase (with service role for admin access)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify webhook signature
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log('Webhook event:', event.type)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id

        if (!userId || !session.customer || !session.subscription) {
          console.error('Missing required data in checkout session')
          break
        }

        // Get premium plan ID
        const { data: premiumPlan } = await supabaseAdmin
          .from('subscription_plans')
          .select('id')
          .eq('slug', 'premium')
          .single()

        // Update or create subscription
        await supabaseAdmin
          .from('user_subscriptions')
          .upsert({
            user_id: userId,
            plan_id: premiumPlan.id,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            status: 'active',
          })

        console.log('Subscription activated for user:', userId)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.error('No user ID in subscription metadata')
          break
        }

        // Update subscription status and period
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            status: subscription.status === 'active' ? 'active' : subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log('Subscription updated:', subscription.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.error('No user ID in subscription metadata')
          break
        }

        // Get free plan ID
        const { data: freePlan } = await supabaseAdmin
          .from('subscription_plans')
          .select('id')
          .eq('slug', 'free')
          .single()

        // Downgrade to free plan
        await supabaseAdmin
          .from('user_subscriptions')
          .update({
            plan_id: freePlan.id,
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log('Subscription cancelled, downgraded to free:', userId)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice

        if (!invoice.customer_email || !invoice.subscription) {
          break
        }

        // Get user ID from subscription
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          break
        }

        // Record payment
        await supabaseAdmin
          .from('payment_history')
          .insert({
            user_id: userId,
            amount_cents: invoice.amount_paid,
            currency: invoice.currency,
            status: 'succeeded',
            stripe_payment_intent_id: invoice.payment_intent as string,
            stripe_invoice_id: invoice.id,
            description: 'Premium subscription payment',
          })

        console.log('Payment recorded:', invoice.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        if (!invoice.subscription) {
          break
        }

        // Get user ID from subscription
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          break
        }

        // Update subscription status to past_due
        await supabaseAdmin
          .from('user_subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscription.id)

        // Record failed payment
        await supabaseAdmin
          .from('payment_history')
          .insert({
            user_id: userId,
            amount_cents: invoice.amount_due,
            currency: invoice.currency,
            status: 'failed',
            stripe_invoice_id: invoice.id,
            description: 'Premium subscription payment failed',
          })

        console.log('Payment failed:', invoice.id)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
