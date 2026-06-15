import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import SubPageNavbar from "@/components/feature/SubPageNavbar";
import Footer from "@/components/feature/Footer";

const plans = [
  {
    id: "free", name: "Free", price: { monthly: 0, annual: 0 },
    description: "Get started building apps with AI. No credit card needed.",
    features: ["3 projects", "50 AI builds per month", "1 AI model (GPT-4o)", "Version history (5 snapshots)", "Live preview", "HTML export"],
    cta: "Get started free", highlight: false,
  },
  {
    id: "pro", name: "Pro", price: { monthly: 29, annual: 19 },
    description: "Unlimited building power for serious makers and indie developers.",
    features: ["Unlimited projects", "Unlimited AI builds", "All 5 AI models", "Unlimited version history", "Custom domain previews", "HTML + ZIP export", "Priority support", "Cloud sync across devices"],
    cta: "Start Pro", highlight: true, badge: "Most popular",
  },
  {
    id: "team", name: "Team", price: { monthly: 79, annual: 59 },
    description: "Everything your team needs to ship AI-powered products together.",
    features: ["Everything in Pro", "Up to 10 seats", "Shared project workspace", "Admin dashboard", "Priority AI build queue", "Dedicated support", "SSO (coming soon)", "Custom integrations"],
    cta: "Start Team", highlight: false,
  },
];

const faqs = [
  { q: "Do I need to bring my own API keys?", a: "Yes — CreAIlity uses your own API keys from OpenAI, Anthropic, Google, DeepSeek, or xAI. Your keys are stored only in your browser, never on our servers." },
  { q: "Can I switch plans anytime?", a: "Absolutely. You can upgrade, downgrade, or cancel at any time. Upgrades take effect immediately." },
  { q: "What happens to my projects if I downgrade?", a: "Your projects stay safe. If you exceed the Free plan limits, you won't lose existing projects." },
  { q: "Is there a free trial for Pro?", a: "Yes — start with the Free plan and upgrade anytime. No credit card required upfront." },
  { q: "What's the difference between monthly and annual billing?", a: "Annual billing saves you about 35% vs monthly. You're billed once per year." },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-50">
      <SubPageNavbar currentPage="pricing" />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground-950 tracking-tight mb-4">Simple, honest pricing</h1>
          <p className="text-lg text-foreground-500 max-w-lg mx-auto">Start free. Scale when you&apos;re ready. No hidden fees, no lock-in.</p>
          <div className="inline-flex items-center gap-1 mt-8 bg-background-200/50 border border-background-300/60 rounded-2xl p-1">
            <button onClick={() => setBilling("monthly")} className={`text-sm font-medium px-5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${billing === "monthly" ? "bg-background-50 text-foreground-900 border border-background-300/60" : "text-foreground-500 hover:text-foreground-700"}`}>Monthly</button>
            <button onClick={() => setBilling("annual")} className={`flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${billing === "annual" ? "bg-background-50 text-foreground-900 border border-background-300/60" : "text-foreground-500 hover:text-foreground-700"}`}>Annual <span className="text-[10px] font-bold bg-secondary-500/15 text-secondary-600 border border-secondary-500/20 rounded-full px-1.5 py-0.5">Save 35%</span></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
          {plans.map((plan) => (
            <div key={plan.id} className={`relative rounded-2xl border p-7 flex flex-col ${plan.highlight ? "border-foreground-800 bg-foreground-950 text-background-50" : "border-background-300/60 bg-background-100"}`}>
              {plan.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="text-xs font-bold bg-accent-500 text-background-50 rounded-full px-3 py-1 whitespace-nowrap">{plan.badge}</span></div>}
              <div className="mb-5">
                <p className={`text-sm font-semibold mb-1 ${plan.highlight ? "text-background-200" : "text-foreground-600"}`}>{plan.name}</p>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-background-50" : "text-foreground-950"}`}>${billing === "monthly" ? plan.price.monthly : plan.price.annual}</span>
                  {plan.price.monthly > 0 && <span className={`text-sm mb-1 ${plan.highlight ? "text-background-400" : "text-foreground-500"}`}>/ mo</span>}
                </div>
                <p className={`text-sm leading-relaxed ${plan.highlight ? "text-background-300" : "text-foreground-500"}`}>{plan.description}</p>
              </div>
              <button onClick={() => navigate("/workspace")} className={`w-full text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer mb-6 whitespace-nowrap ${plan.highlight ? "bg-background-50 text-foreground-950 hover:bg-background-200" : plan.id === "free" ? "border border-background-300/60 text-foreground-700 hover:border-foreground-500 hover:text-foreground-900" : "bg-foreground-900 text-background-50 hover:bg-foreground-800"}`}>{plan.cta}</button>
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className={`ri-check-line text-xs ${plan.highlight ? "text-background-200" : "text-foreground-600"}`} /></div>
                    <span className={`text-sm ${plan.highlight ? "text-background-200" : "text-foreground-600"}`}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground-950 text-center mb-8">Frequently asked questions</h2>
          <div className="flex flex-col gap-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl border border-background-300/60 bg-background-100 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer">
                  <span className="text-sm font-semibold text-foreground-800 pr-4">{faq.q}</span>
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className={`ri-arrow-down-s-line text-foreground-500 text-base transition-transform ${openFaq === i ? "rotate-180" : ""}`} /></div>
                </button>
                {openFaq === i && <div className="px-5 pb-4"><p className="text-sm text-foreground-500 leading-relaxed">{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-20">
          <div className="inline-block rounded-2xl border border-background-300/60 bg-background-100 px-10 py-10">
            <h3 className="text-xl font-bold text-foreground-950 mb-2">Ready to build?</h3>
            <p className="text-sm text-foreground-500 mb-6">Start free, no credit card required.</p>
            <Link to="/workspace" className="inline-flex items-center gap-2 bg-foreground-900 text-background-50 font-semibold px-6 py-3 rounded-xl hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap">
              Start building for free <i className="ri-arrow-right-line text-sm" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}