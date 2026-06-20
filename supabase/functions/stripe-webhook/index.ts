import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getPlanLimits(supabaseAdmin: any, planId: string) {
  // Fallback defaults
  const defaults: Record<string, { credits: number, builds: number, projects: number }> = {
    free: { credits: 20, builds: 20, projects: 3 },
    pro: { credits: 500, builds: 500, projects: 999 },
    byok: { credits: 0, builds: 9999, projects: 999 },
    hosting: { credits: 0, builds: 0, projects: 10 },
  };

  try {
    const { data } = await supabaseAdmin
      .from("platform_config")
      .select("value")
      .eq("key", "plans_config")
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        const found = parsed.find((p: any) => p.tier === planId);
        if (found) {
          return {
            credits: found.credits_monthly,
            builds: found.builds_limit,
            projects: found.projects_limit,
          };
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch plans_config inside webhook:", e);
  }

  return defaults[planId] || defaults.free;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

    if (!stripeSecretKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get("stripe-signature") || "";
    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const billingPeriod = session.metadata?.billing_period;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && planId) {
          const limits = await getPlanLimits(supabaseAdmin, planId);

          await supabaseAdmin
            .from("user_plans")
            .upsert({
              user_id: userId,
              plan_tier: planId,
              status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              billing_period: billingPeriod,
              credits_remaining: limits.credits,
              credits_monthly: limits.credits,
              builds_used_this_month: 0,
              builds_limit_monthly: limits.builds,
              projects_limit: limits.projects,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          console.log(`User ${userId} subscribed to ${planId} (${billingPeriod})`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        const { data: userPlan } = await supabaseAdmin
          .from("user_plans")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (userPlan) {
          const newStatus = status === "active" ? "active" : status === "past_due" ? "past_due" : "inactive";
          await supabaseAdmin
            .from("user_plans")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("user_id", userPlan.user_id);

          console.log(`Subscription updated for user ${userPlan.user_id}: ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const { data: userPlan } = await supabaseAdmin
          .from("user_plans")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (userPlan) {
          const limits = await getPlanLimits(supabaseAdmin, "free");
          await supabaseAdmin
            .from("user_plans")
            .update({
              plan_tier: "free",
              status: "active",
              credits_remaining: limits.credits,
              credits_monthly: limits.credits,
              builds_used_this_month: 0,
              builds_limit_monthly: limits.builds,
              projects_limit: limits.projects,
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userPlan.user_id);

          console.log(`Subscription deleted for user ${userPlan.user_id}, reverted to free`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        const { data: userPlan } = await supabaseAdmin
          .from("user_plans")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (userPlan) {
          await supabaseAdmin
            .from("user_plans")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userPlan.user_id);

          console.log(`Payment failed for user ${userPlan.user_id}`);
        }
        break;
      }

      // Events we don't need to process but must acknowledge
      case "product.created":
      case "product.updated":
      case "product.deleted":
      case "price.created":
      case "price.updated":
      case "price.deleted":
      case "plan.created":
      case "plan.updated":
      case "plan.deleted":
      case "customer.created":
      case "customer.updated":
        // These are Stripe configuration events — acknowledge but don't process
        console.log(`Acknowledged: ${event.type}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Stripe webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});