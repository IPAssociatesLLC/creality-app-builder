import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import SubPageNavbar from "@/components/feature/SubPageNavbar";
import Footer from "@/components/feature/Footer";
import { supabase } from "@/lib/supabase";

const plans = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, annual: 0 },
    description: "For getting started",
    credits: "20 credits / month",
    projects: "3 projects",
    cta: "Get started for free",
    highlight: false,
    features: [
      "GPT-4o via platform key",
      "Version history (5 snapshots)",
      "Live preview",
      "HTML export",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: 19, annual: 14 },
    description: "For active development",
    credits: "500 credits / month",
    projects: "Unlimited projects",
    cta: "Get started",
    highlight: true,
    badge: "Most popular",
    stripePlanId: "pro",
    features: [
      "Everything in Free",
      "All 5 AI models (platform)",
      "No daily credit limit",
      "Custom domain previews",
      "Priority support",
      "Cloud sync across devices",
    ],
  },
  {
    id: "byok",
    name: "BYOK",
    price: { monthly: 29, annual: 22 },
    description: "Bring your own keys",
    credits: "Unlimited credits (your keys)",
    projects: "Unlimited projects",
    cta: "Get started",
    highlight: false,
    badge: "Best value",
    stripePlanId: "byok",
    features: [
      "Everything in Pro",
      "All 5 AI models (your keys)",
      "Unlimited version history",
      "Live preview & export",
      "Secure server-side key storage",
      "Priority support",
    ],
  },
  {
    id: "hosting",
    name: "Hosting Only",
    price: { monthly: 10, annual: 8 },
    description: "Deploy & host apps",
    credits: "0 credits (hosting only)",
    projects: "10 projects",
    cta: "Get started",
    highlight: false,
    stripePlanId: "hosting",
    features: [
      "Custom domain hosting",
      "SSL certificates included",
      "Unlimited bandwidth",
      "99.9% uptime SLA",
      "Analytics dashboard",
      "24/7 monitoring",
    ],
  },
];

const faqs = [
  {
    q: "What are AI credits?",
    a: "AI credits are the currency used to send messages to AI models in CreAIlity. Different models cost different amounts of credits per message. GPT-4o costs 3 credits, Claude 3.5 Sonnet costs 5 credits, Gemini 2.0 Flash costs 2 credits, and so on. Free users get 20 credits per month. Pro users get 500 credits per month. BYOK users bring their own API keys and get unlimited credits.",
  },
  {
    q: "How do credits work?",
    a: "Each message you send to an AI model costs a certain number of credits based on the model you choose. New project builds cost 3x the base rate because they require more context and file generation. Iterations on existing projects cost the standard rate. Credits reset monthly on your billing cycle.",
  },
  {
    q: "What's the difference between BYOK and Pro?",
    a: "BYOK ($29/mo) lets you use your own API keys from OpenAI, Anthropic, Google, DeepSeek, or xAI — you pay AI providers directly for usage, so you get unlimited credits. Pro ($19/mo) includes platform-provided AI keys — we handle the AI costs and give you 500 credits per month. BYOK is great if you already have API keys or want to control your AI spend directly.",
  },
  {
    q: "Can I switch plans anytime?",
    a: "Absolutely. You can upgrade, downgrade, or cancel at any time. Upgrades take effect immediately.",
  },
  {
    q: "What happens to my projects if I downgrade?",
    a: "Your projects stay safe. If you exceed the Free plan limits, you won't lose existing projects — you just can't create new ones until you upgrade.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "Start with the Free plan to try the builder with 20 credits. Upgrade to BYOK or Pro anytime when you need more AI power.",
  },
  {
    q: "How do I add my own API keys?",
    a: "BYOK plan users can add their own API keys in Settings > API Keys. Your keys are encrypted and stored securely on our servers. Free and Pro users use platform-provided keys — no setup needed.",
  },
  {
    q: "What's the difference between monthly and annual billing?",
    a: "Annual billing saves you about 25-35% vs monthly. You're billed once per year.",
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activePlans, setActivePlans] = useState(plans);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("platform_config").select("key, value").eq("key", "plans_config").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActivePlans((prev) => prev.map((plan) => {
              const config = parsed.find((p: any) => p.tier === plan.id);
              if (config) {
                return {
                  ...plan,
                  price: {
                    monthly: config.price,
                    annual: Math.round(config.price * 0.75),
                  },
                  credits: config.tier === "byok" ? "Unlimited credits (your keys)" : config.credits_monthly === 0 ? "0 credits (hosting only)" : `${config.credits_monthly} credits / month`,
                  projects: config.projects_limit >= 999 ? "Unlimited projects" : `${config.projects_limit} projects`,
                  features: config.features ? config.features.split(",").map((f: string) => f.trim()) : plan.features,
                };
              }
              return plan;
            }));
          }
        } catch (e) {
          console.error("Error loading plans config:", e);
        }
      }
    });
  }, []);

  const handleCheckout = async (planId: string) => {
    if (planId === "free") {
      navigate("/workspace");
      return;
    }
    setCheckoutLoading(planId);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          planId,
          billingPeriod: billing,
          successUrl: `${window.location.origin}/workspace?checkout=success`,
          cancelUrl: `${window.location.origin}/pricing?checkout=cancelled`,
        },
      });
      if (error) throw new Error(error.message || "Checkout request failed");
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      setCheckoutError(message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <SubPageNavbar currentPage="pricing" />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground-950 leading-tight mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-base text-foreground-500 max-w-lg mx-auto">
            Start free. Upgrade as you grow.
          </p>

          {/* Billing toggle */}
          <div className="flex flex-col items-center gap-3 mt-8">
            <div className="inline-flex items-center p-1 bg-background-100 border border-background-200 rounded-xl">
              <button
                onClick={() => setBilling("monthly")}
                className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${billing === "monthly" ? "bg-background-50 text-foreground-900 border border-background-200/60" : "text-foreground-500 hover:text-foreground-700"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${billing === "annual" ? "bg-background-50 text-foreground-900 border border-background-200/60" : "text-foreground-500 hover:text-foreground-700"}`}
              >
                Annual
              </button>
            </div>
            <p className="text-sm font-medium text-foreground-700">
              <b>Save up to 35%</b> with yearly billing
            </p>
          </div>

          {checkoutError && (
            <div className="mt-4 inline-block bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2">
              {checkoutError}
            </div>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-16">
          {activePlans.map((plan) => {
            const isHighlight = plan.highlight;
            const isFree = plan.price.monthly === 0;
            const price = isFree ? 0 : billing === "monthly" ? plan.price.monthly : plan.price.annual;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col gap-5 border rounded-2xl p-5 md:p-6 ${
                  isHighlight
                    ? "border-foreground-800 bg-foreground-950 text-background-50"
                    : "border-background-200/80 bg-background-50"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-bold bg-accent-500 text-background-50 rounded-full px-3 py-1 whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="flex flex-col gap-2">
                  <span className={`text-sm font-semibold ${isHighlight ? "text-background-200" : "text-foreground-600"}`}>
                    {plan.name}
                  </span>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl md:text-4xl font-bold ${isHighlight ? "text-background-50" : "text-foreground-950"}`}>
                      ${price}
                    </span>
                    {!isFree && (
                      <span className={`text-xs mb-1 ${isHighlight ? "text-background-400" : "text-foreground-500"}`}>
                        / month
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${isHighlight ? "text-background-300" : "text-foreground-500"}`}>
                    {plan.description}
                  </p>
                </div>

                {/* Credits & Projects */}
                <div className={`flex flex-col gap-2 rounded-xl border p-3 ${isHighlight ? "border-background-700/50 bg-background-900/50" : "border-background-200/60 bg-background-100"}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className={`ri-coins-line text-xs ${isHighlight ? "text-background-300" : "text-foreground-500"}`} />
                    </div>
                    <span className={`text-xs font-medium ${isHighlight ? "text-background-200" : "text-foreground-700"}`}>
                      {plan.credits}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i className={`ri-folder-4-line text-xs ${isHighlight ? "text-background-300" : "text-foreground-500"}`} />
                    </div>
                    <span className={`text-xs font-medium ${isHighlight ? "text-background-200" : "text-foreground-700"}`}>
                      {plan.projects}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleCheckout(plan.stripePlanId || plan.id)}
                  disabled={checkoutLoading === plan.stripePlanId}
                  className={`w-full text-center text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                    checkoutLoading === plan.stripePlanId
                      ? "opacity-70 cursor-wait"
                      : ""
                  } ${
                    isHighlight
                      ? "bg-background-50 text-foreground-950 hover:bg-background-200"
                      : isFree
                        ? "bg-foreground-900 text-background-50 hover:bg-foreground-800"
                        : "bg-accent-500 text-background-50 hover:bg-accent-600"
                  }`}
                >
                  {checkoutLoading === plan.stripePlanId ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Redirecting...
                    </span>
                  ) : (
                    plan.cta
                  )}
                </button>

                {/* Features */}
                <div className="flex flex-col gap-2">
                  <b className={`text-xs font-semibold ${isHighlight ? "text-background-200" : "text-foreground-700"}`}>
                    {isFree ? "Get started with:" : "Everything you get:"}
                  </b>
                  <ul className="flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <i className={`ri-check-line text-xs ${isHighlight ? "text-background-300" : "text-foreground-500"}`} />
                        </div>
                        <span className={`text-xs ${isHighlight ? "text-background-300" : "text-foreground-600"}`}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Team plan */}
        <div className="rounded-2xl border border-background-200/80 bg-background-50 p-5 md:p-6 mb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground-800">Team</span>
                <span className="inline-flex items-center px-2 h-5 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold uppercase">
                  Popular
                </span>
              </div>
              <p className="text-xs text-foreground-500">
                Scale your team's productivity with shared credits and collaboration.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground-950">
                ${billing === "monthly" ? 79 : 59}
                <span className="text-xs font-normal text-foreground-500">/mo</span>
              </span>
              <button
                onClick={() => handleCheckout("team")}
                disabled={checkoutLoading === "team"}
                className="text-sm font-semibold bg-foreground-900 text-background-50 rounded-xl px-5 py-2.5 hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {checkoutLoading === "team" ? "Redirecting..." : "Get Team"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-background-200/60">
            {[
              "Up to 10 seats",
              "Shared credit pool",
              "Roles & permissions",
              "Admin dashboard",
              "Priority AI queue",
              "Dedicated support",
            ].map((f) => (
              <span key={f} className="inline-flex items-center gap-1 text-[10px] text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-3 py-1">
                <i className="ri-check-line text-foreground-400 text-[10px]" />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground-950 text-center mb-8">
            Pricing questions
          </h2>
          <div className="flex flex-col gap-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-background-200/80 bg-background-50 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                >
                  <span className="text-sm font-semibold text-foreground-800 pr-4">
                    {faq.q}
                  </span>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i
                      className={`ri-arrow-down-s-line text-foreground-500 text-base transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-foreground-500 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <div className="inline-block rounded-2xl border border-background-200/80 bg-background-50 px-8 md:px-10 py-8 md:py-10">
            <h3 className="text-xl font-bold text-foreground-950 mb-2">
              Ready to build?
            </h3>
            <p className="text-sm text-foreground-500 mb-6">
              Start free, no credit card required.
            </p>
            <Link
              to="/workspace"
              className="inline-flex items-center gap-2 bg-foreground-900 text-background-50 font-semibold px-6 py-3 rounded-xl hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Start building for free
              <i className="ri-arrow-right-line text-sm" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}