import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { loadConfig, saveConfig } from "@/utils/ai-api";
import { getUserApiKeys, saveUserApiKey, deleteUserApiKey } from "@/utils/ai-api";
import { AVAILABLE_MODELS } from "@/pages/workspace/components/ModelSelector";
import { loadUserSettings, saveUserSetting } from "@/utils/user-settings-store";
import { supabase } from "@/lib/supabase";
import type { UserPlan } from "@/utils/projects-store";
import { countUserProjects } from "@/utils/projects-store";

type SettingsTab = "api-keys" | "account" | "plan-billing" | "appearance";

function ApiKeysTab() {
  const [config, setConfig] = useState<{ selectedModel: string }>({ selectedModel: "gpt-4o" });
  const [saved, setSaved] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [userKeys, setUserKeys] = useState<Record<string, string>>({});
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig().then((cfg) => setConfig(cfg));
    getUserApiKeys().then((keys) => {
      const map: Record<string, string> = {};
      keys.forEach((k) => { map[k.model_id] = k.api_key; });
      setUserKeys(map);
      setLocalValues(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaveKey = async (modelId: string) => {
    const key = localValues[modelId] || "";
    if (!key.trim()) return;
    try {
      await saveUserApiKey(modelId, key.trim());
      setUserKeys(prev => ({ ...prev, [modelId]: key }));
      setSaved(modelId);
      setTimeout(() => setSaved(null), 2000);
    } catch { /* silently fail */ }
  };

  const handleRemoveKey = async (modelId: string) => {
    try {
      await deleteUserApiKey(modelId);
      setUserKeys(prev => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      setLocalValues(prev => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
    } catch { /* silently fail */ }
  };

  const handleSelectModel = async (modelId: string) => {
    const updated = { selectedModel: modelId };
    setConfig(updated);
    await saveConfig(updated);
  };

  return <div className="flex flex-col gap-8">
    <div>
      <h2 className="text-base font-semibold text-foreground-900 mb-1">AI Model API Keys</h2>
      <p className="text-sm text-foreground-500">Your API keys are encrypted and stored securely in your account. Never exposed to your browser.</p>
      {loading && <p className="text-xs text-foreground-500 mt-2">Loading your keys...</p>}
    </div>
    <div className="flex flex-col gap-4">
      {AVAILABLE_MODELS.map((model) => {
        const key = localValues[model.id] || "";
        const hasKey = !!userKeys[model.id];
        const isActive = config.selectedModel === model.id;
        return <div key={model.id} className={`rounded-2xl border p-5 transition-all ${isActive ? "border-foreground-400/50 bg-background-100" : "border-background-300/60 bg-background-100"}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-background-200/60 flex-shrink-0"><i className="ri-robot-line text-foreground-600 text-base" /></div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground-800">{model.name}</p>
                  {isActive && <span className="text-[10px] bg-accent-500/15 text-accent-500 border border-accent-500/20 rounded-full px-2 py-0.5">Active</span>}
                  {hasKey && <span className="text-[10px] bg-accent-500/15 text-accent-500 border border-accent-500/20 rounded-full px-2 py-0.5">Your key</span>}
                </div>
                <p className="text-xs text-foreground-500 mt-0.5">{model.provider} {hasKey ? "— using your personal API key" : "— using platform key"}</p>
              </div>
            </div>
            <button onClick={() => handleSelectModel(model.id)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${isActive ? "bg-foreground-900 text-background-50 border-foreground-900" : "border-background-300/60 text-foreground-600 hover:border-foreground-500 hover:text-foreground-800"}`}>{isActive ? "Selected" : "Set as default"}</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 transition-colors">
              <i className="ri-key-2-line text-foreground-500 text-xs flex-shrink-0" />
              <input type={showKey[model.id] ? "text" : "password"} value={key} onChange={(e) => setLocalValues((prev) => ({ ...prev, [model.id]: e.target.value }))} placeholder={hasKey ? "•••••••• (hidden for security)" : `${model.provider} API key`} className="flex-1 bg-transparent text-xs text-foreground-800 placeholder-foreground-500 outline-none font-mono" />
              {key && <button onClick={() => setShowKey((prev) => ({ ...prev, [model.id]: !prev[model.id] }))} className="flex-shrink-0 cursor-pointer text-foreground-500 hover:text-foreground-700 transition-colors"><i className={`text-xs ${showKey[model.id] ? "ri-eye-off-line" : "ri-eye-line"}`} /></button>}
            </div>
            <button onClick={() => handleSaveKey(model.id)} disabled={!key.trim()} className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap border border-background-300/60 hover:border-foreground-500 text-foreground-700 hover:text-foreground-900 disabled:opacity-30 disabled:cursor-not-allowed">{saved === model.id ? <><i className="ri-check-line text-accent-500" />Saved</> : "Save"}</button>
            {hasKey && <button onClick={() => handleRemoveKey(model.id)} className="text-xs text-foreground-600 hover:text-accent-500 px-3 py-2.5 rounded-xl border border-background-300/60 hover:border-accent-500/30 transition-colors cursor-pointer whitespace-nowrap">Remove</button>}
          </div>
          <p className="text-[10px] text-foreground-500 mt-2 px-1">Get your key at <a href={model.docsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline cursor-pointer">{model.docsUrl}</a></p>
        </div>;
      })}
    </div>
    <div className="rounded-2xl border border-secondary-500/15 bg-secondary-500/5 p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary-500/10 flex-shrink-0"><i className="ri-information-line text-secondary-400 text-sm" /></div>
        <div>
          <p className="text-sm font-semibold text-secondary-400 mb-1">How keys work</p>
          <p className="text-xs text-foreground-500 leading-relaxed">By default, CreAIlity uses platform-provided API keys to power your AI builds. If you&apos;re on a Bring Your Own Key plan, you can override with your personal API keys — they&apos;re encrypted and stored securely in your account. Your keys are only used when you trigger a build.</p>
        </div>
      </div>
    </div>
  </div>;
}

function AccountTab({ userEmail }: { userEmail: string }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [activeModelName, setActiveModelName] = useState("None");

  useEffect(() => {
    loadUserSettings().then((settings) => {
      setDisplayName(settings.display_name || "");
    });
    loadConfig().then((cfg) => {
      const model = AVAILABLE_MODELS.find((m) => m.id === cfg.selectedModel);
      setActiveModelName(model?.name || "None");
    }).finally(() => setConfigLoaded(true));
  }, []);

  const handleSignOut = async () => { await signOut(); navigate("/auth", { replace: true }); };
  const handleSaveName = async () => {
    await saveUserSetting("display_name", displayName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      await signOut();
    } catch { setIsDeleting(false); }
  };

  const displayLabel = displayName || userEmail?.split("@")[0] || "User";

  return <div className="flex flex-col gap-8">
    <div><h2 className="text-base font-semibold text-foreground-900 mb-1">Account</h2><p className="text-sm text-foreground-500">Manage your CreAIlity account.</p></div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5">
      <p className="text-sm font-semibold text-foreground-800 mb-3">Display name</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 transition-colors"><i className="ri-user-line text-foreground-500 text-xs flex-shrink-0" /><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" className="flex-1 bg-transparent text-xs text-foreground-800 placeholder-foreground-500 outline-none" /></div>
        <button onClick={handleSaveName} className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl border border-background-300/60 hover:border-foreground-500 text-foreground-700 hover:text-foreground-900 transition-colors cursor-pointer whitespace-nowrap">{nameSaved ? <><i className="ri-check-line text-accent-500" />Saved</> : "Save"}</button>
      </div>
    </div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-full bg-foreground-200/20 flex items-center justify-center flex-shrink-0"><span className="text-lg font-bold text-foreground-700">{displayLabel.charAt(0).toUpperCase()}</span></div>
        <div><p className="text-sm font-semibold text-foreground-900">{displayLabel}</p><p className="text-xs text-foreground-500 mt-0.5">{userEmail}</p></div>
      </div>
      <div className="h-px bg-background-300/50 mb-5" />
      <div className="grid grid-cols-3 gap-4 text-center">
        {[{ label: "Model", value: activeModelName }, { label: "Auth", value: "Supabase" }, { label: "Plan", value: "Free" }].map((stat) => <div key={stat.label}><p className="text-base font-bold text-foreground-900">{stat.value}</p><p className="text-xs text-foreground-500 mt-0.5">{stat.label}</p></div>)}
      </div>
    </div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5"><p className="text-sm font-semibold text-foreground-800 mb-4">Session</p><button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-foreground-600 hover:text-accent-500 hover:bg-accent-500/10 border border-background-300/60 hover:border-accent-500/30 rounded-xl px-4 py-2.5 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-logout-box-line text-sm" />Sign out</button></div>
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
      <p className="text-sm font-semibold text-red-400 mb-1">Danger zone</p>
      <p className="text-xs text-foreground-500 mb-4 leading-relaxed">Deleting your account is permanent and cannot be undone.</p>
      {!deleting ? <button onClick={() => setDeleting(true)} className="text-sm text-red-400 border border-red-500/30 rounded-xl px-4 py-2 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap">Delete account</button> : <div className="flex flex-col gap-3"><p className="text-xs text-red-400">Type <strong>DELETE</strong> to confirm.</p><div className="flex items-center gap-3"><input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" className="flex-1 bg-background-200/40 border border-background-300/60 rounded-lg px-3 py-1.5 text-xs text-foreground-800 placeholder-foreground-600 outline-none focus:border-red-500/50 font-mono" /><button onClick={() => { setDeleting(false); setDeleteConfirmText(""); }} className="text-xs text-foreground-500 border border-background-300/60 rounded-lg px-3 py-1.5 hover:border-foreground-500 transition-colors cursor-pointer whitespace-nowrap">Cancel</button><button onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || isDeleting} className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">{isDeleting ? "Deleting..." : "Yes, delete"}</button></div></div>}
    </div>
  </div>;
}

function PlanBillingTab() {
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [projectCount, setProjectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [hasStripeSub, setHasStripeSub] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);

  const planLabels: Record<string, string> = { free: "Free", pro: "Pro", byok: "BYOK", hosting: "Hosting Only" };
  const planColors: Record<string, string> = {
    free: "bg-background-200/60 border-background-300/60 text-foreground-600",
    pro: "bg-accent-500/10 border-accent-500/20 text-accent-600",
    byok: "bg-secondary-500/10 border-secondary-500/20 text-secondary-600",
    hosting: "bg-primary-100 border-primary-200 text-primary-600",
  };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: planData }, projectCountResult] = await Promise.all([
        supabase.from("user_plans").select("*").eq("user_id", user.id).maybeSingle(),
        countUserProjects(),
      ]);

      if (planData) {
        setPlan({
          tier: planData.plan_tier as UserPlan["tier"],
          status: planData.status as UserPlan["status"],
          creditsRemaining: planData.credits_remaining as number,
          creditsMonthly: planData.credits_monthly as number,
          buildsUsedThisMonth: planData.builds_used_this_month as number,
          buildsLimitMonthly: planData.builds_limit_monthly as number,
          projectsLimit: planData.projects_limit as number,
        });
        setHasStripeSub(!!planData.stripe_subscription_id);
      } else {
        setPlan({
          tier: "free", status: "active", creditsRemaining: 20, creditsMonthly: 20,
          buildsUsedThisMonth: 0, buildsLimitMonthly: 20, projectsLimit: 3,
        });
      }
      setProjectCount(projectCountResult);
      setLoading(false);
    }
    load();
  }, []);

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          planId,
          billingPeriod,
          successUrl: `${window.location.origin}/settings?checkout=success`,
          cancelUrl: `${window.location.origin}/settings?checkout=cancelled`,
        },
      });
      if (error) throw new Error(error.message || "Checkout failed");
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL");
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setManageLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          planId: "manage",
          billingPeriod: "monthly",
          successUrl: `${window.location.origin}/settings`,
          cancelUrl: `${window.location.origin}/settings`,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to load billing portal");
    } finally {
      setManageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin" />
      </div>
    );
  }

  const tier = plan?.tier || "free";
  const usagePercent = plan ? Math.round((plan.buildsUsedThisMonth / Math.max(plan.buildsLimitMonthly, 1)) * 100) : 0;
  const creditPercent = plan ? Math.round(((plan.creditsMonthly - plan.creditsRemaining) / Math.max(plan.creditsMonthly, 1)) * 100) : 0;

  const upgradePlans = [
    { id: "byok", name: "BYOK", price: "$20/mo", desc: "Bring your own API keys. Unlimited everything.", badge: "Best value", color: "bg-secondary-500/10 border-secondary-500/20" },
    { id: "pro", name: "Pro", price: "$29/mo", desc: "Platform AI keys included. All 5 models.", badge: "Most popular", color: "bg-accent-500/10 border-accent-500/20" },
    { id: "team", name: "Team", price: "$79/mo", desc: "Up to 10 seats. Shared workspace.", color: "bg-primary-100 border-primary-200" },
    { id: "hosting", name: "Hosting Only", price: "$10/mo", desc: "Deploy and host apps. No AI builds.", color: "bg-background-200/60 border-background-300/60" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold text-foreground-900 mb-1">Plan & Billing</h2>
        <p className="text-sm text-foreground-500">Manage your subscription, view usage, and upgrade your plan.</p>
      </div>

      {checkoutError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 flex items-center gap-2 text-red-600 text-xs">
          <i className="ri-error-warning-line text-sm" />
          {checkoutError}
        </div>
      )}

      {/* Current Plan Card */}
      <div className="rounded-2xl border border-background-300/60 bg-background-100 p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center text-[10px] font-bold rounded-full px-2.5 py-0.5 border ${planColors[tier]}`}>
                {planLabels[tier]}
              </span>
              {plan?.status === "active" && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>}
              {plan?.status === "cancelled" && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Cancelled</span>}
            </div>
            <p className="text-xs text-foreground-500 leading-relaxed max-w-md">
              {tier === "free" && "Free plan with basic AI model and limited credits. Upgrade anytime for more power."}
              {tier === "pro" && "Full platform access with all AI models included. Build without limits."}
              {tier === "byok" && "Unlimited everything with your own API keys. Full control over AI costs."}
              {tier === "hosting" && "Host your deployed apps with custom domains. No AI builds included."}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-foreground-950">{tier === "free" ? "$0" : tier === "pro" ? "$29" : tier === "byok" ? "$20" : "$10"}<span className="text-xs font-normal text-foreground-500">{tier !== "free" ? "/mo" : ""}</span></p>
          </div>
        </div>

        {/* Usage meters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wider">AI Credits</span>
              <span className="text-xs font-bold text-foreground-800">{plan?.creditsRemaining || 0} / {plan?.creditsMonthly || 0}</span>
            </div>
            <div className="h-1.5 bg-background-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${creditPercent > 90 ? "bg-red-500" : creditPercent > 70 ? "bg-amber-500" : "bg-secondary-500"}`} style={{ width: `${Math.min(creditPercent, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wider">Projects</span>
              <span className="text-xs font-bold text-foreground-800">{projectCount} / {plan?.projectsLimit || 3}</span>
            </div>
            <div className="h-1.5 bg-background-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${Math.min((projectCount / Math.max(plan?.projectsLimit || 3, 1)) * 100, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Billing actions */}
        <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-background-200/60">
          {hasStripeSub && (
            <button onClick={handleManageBilling} disabled={manageLoading} className="flex items-center gap-1.5 text-xs font-medium text-foreground-700 border border-background-300/60 rounded-xl px-4 py-2 hover:border-foreground-500 hover:text-foreground-900 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50">
              {manageLoading ? <div className="w-3.5 h-3.5 border-2 border-foreground-400 border-t-transparent rounded-full animate-spin" /> : <div className="w-4 h-4 flex items-center justify-center"><i className="ri-bank-card-line text-sm" /></div>}
              Manage billing
            </button>
          )}
          {tier !== "free" && !hasStripeSub && (
            <p className="text-[10px] text-foreground-400 flex items-center gap-1"><i className="ri-information-line text-xs" />Billing managed outside Stripe</p>
          )}
          <a href="/pricing" className="flex items-center gap-1.5 text-xs font-medium text-accent-500 hover:text-accent-400 transition-colors cursor-pointer whitespace-nowrap ml-auto">
            View all plans <i className="ri-arrow-right-line text-[10px]" />
          </a>
        </div>
      </div>

      {/* Upgrade options for free users */}
      {tier === "free" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground-800">Upgrade your plan</h3>
            <div className="flex items-center gap-1 bg-background-200/50 border border-background-300/60 rounded-xl p-1">
              <button onClick={() => setBillingPeriod("monthly")} className={`text-[10px] font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${billingPeriod === "monthly" ? "bg-background-50 text-foreground-900" : "text-foreground-500 hover:text-foreground-700"}`}>Monthly</button>
              <button onClick={() => setBillingPeriod("annual")} className={`text-[10px] font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${billingPeriod === "annual" ? "bg-background-50 text-foreground-900" : "text-foreground-500 hover:text-foreground-700"}`}>Annual</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {upgradePlans.map((p) => (
              <div key={p.id} className={`rounded-xl border p-5 ${p.color}`}>
                {p.badge && <span className="inline-block text-[9px] font-bold bg-secondary-500 text-background-50 rounded-full px-2 py-0.5 mb-2">{p.badge}</span>}
                <p className="text-sm font-bold text-foreground-800 mb-0.5">{p.name}</p>
                <p className="text-lg font-extrabold text-foreground-950 mb-1">{p.price}</p>
                <p className="text-xs text-foreground-500 mb-3 leading-relaxed">{p.desc}</p>
                <button onClick={() => handleCheckout(p.id)} disabled={checkoutLoading === p.id} className="w-full text-xs font-semibold bg-foreground-900 text-background-50 rounded-xl py-2.5 hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60">
                  {checkoutLoading === p.id ? "Redirecting..." : "Upgrade"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type FontScale = "small" | "medium" | "large";

function AppearanceTab() {
  const [fontScale, setFontScale] = useState<FontScale>("medium");
  const [loading, setLoading] = useState(true);

  const applyFontScale = useCallback(async (scale: FontScale) => {
    setFontScale(scale);
    await saveUserSetting("font_scale", scale);
    const root = document.documentElement;
    root.classList.remove("font-scale-small", "font-scale-medium", "font-scale-large");
    root.classList.add(`font-scale-${scale}`);
  }, []);

  useEffect(() => {
    loadUserSettings().then((settings) => {
      const saved = (settings.font_scale as FontScale) || "medium";
      setFontScale(saved);
      const root = document.documentElement;
      root.classList.remove("font-scale-small", "font-scale-medium", "font-scale-large");
      root.classList.add(`font-scale-${saved}`);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin" /></div>;

  return <div className="flex flex-col gap-8">
    <div><h2 className="text-base font-semibold text-foreground-900 mb-1">Appearance</h2><p className="text-sm text-foreground-500">Customize how CreAIlity looks and feels.</p></div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5">
      <p className="text-sm font-semibold text-foreground-800 mb-1">Font size</p><p className="text-xs text-foreground-500 mb-4">Adjust the base font size across the entire app.</p>
      <div className="flex items-center gap-2">
        {([{ id: "small" as FontScale, label: "Small", desc: "Compact" }, { id: "medium" as FontScale, label: "Medium", desc: "Default" }, { id: "large" as FontScale, label: "Large", desc: "Spacious" }]).map((opt) => <button key={opt.id} onClick={() => applyFontScale(opt.id)} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all cursor-pointer ${fontScale === opt.id ? "border-foreground-400/50 bg-background-200/70 text-foreground-900" : "border-background-300/60 text-foreground-600 hover:border-foreground-500 hover:text-foreground-800"}`}><span className={`font-semibold ${opt.id === "small" ? "text-xs" : opt.id === "medium" ? "text-sm" : "text-base"}`}>{opt.label}</span><span className="text-[10px] text-foreground-500">{opt.desc}</span></button>)}
      </div>
    </div>
  </div>;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>("plan-billing");
  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);
  if (loading || !user) return <div className="h-screen bg-background-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin" /></div>;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: "plan-billing", label: "Plan & Billing", icon: "ri-bank-card-line" },
    { id: "api-keys", label: "API Keys", icon: "ri-key-2-line" },
    { id: "account", label: "Account", icon: "ri-user-line" },
    { id: "appearance", label: "Appearance", icon: "ri-palette-line" },
  ];

  return <div className="min-h-screen bg-background-50">
    <header className="h-12 flex items-center justify-between px-6 border-b border-background-200 bg-background-50 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center flex-shrink-0 cursor-pointer"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-8 w-auto object-contain" /></Link>
        <span className="text-foreground-400 text-sm">/</span><span className="text-sm font-medium text-foreground-700">Settings</span>
      </div>
      <Link to="/workspace" className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-arrow-left-line text-sm" />Back to workspace</Link>
    </header>
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        <aside className="w-full md:w-48 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-20">
            {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 text-xs md:text-sm px-2.5 md:px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${tab === t.id ? "bg-background-200/70 text-foreground-900 font-medium" : "text-foreground-500 hover:text-foreground-800 hover:bg-background-200/40"}`}><div className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center flex-shrink-0"><i className={`${t.icon} text-xs md:text-sm`} /></div>{t.label}</button>)}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {tab === "plan-billing" && <PlanBillingTab />}
          {tab === "api-keys" && <ApiKeysTab />}
          {tab === "account" && <AccountTab userEmail={user.email || ""} />}
          {tab === "appearance" && <AppearanceTab />}
        </main>
      </div>
    </div>
  </div>;
}