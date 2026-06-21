import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

// ── Types ──
interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalVersions: number;
  totalDeployments: number;
  activeToday: number;
  activeThisWeek: number;
  paidUsers: number;
  freeUsers: number;
  mrrEstimate: number;
  newSignupsToday: number;
  newSignupsWeek: number;
  totalBuilds: number;
}

interface UserRow {
  id: string;
  email: string;
  planTier: string;
  planStatus: string;
  credits: number;
  buildsUsed: number;
  projectCount: number;
  lastActive: string;
  createdAt: string;
}

interface ProjectRow {
  id: string;
  name: string;
  user_id: string;
  updated_at: string;
  has_code: boolean;
  version_count: number;
  has_sandbox: boolean;
  sandbox_url?: string;
}

interface DeploymentRow {
  id: string;
  project_id: string;
  slug: string;
  sandbox_id: string;
  public_url: string;
  file_count: number;
  created_at: string;
  project_name?: string;
}

interface AiModelConfig {
  id: string;
  name: string;
  provider: string;
  credit_cost: number;
  enabled: boolean;
  free_tier: boolean;
  pro_tier: boolean;
  byok_tier: boolean;
}

interface PlanDef {
  tier: string;
  label: string;
  price: number;
  projects_limit: number;
  builds_limit: number;
  credits_monthly: number;
  features: string;
}

type AdminTab = "overview" | "users" | "projects" | "deployments" | "ai-models" | "plans" | "settings";

// ── Constants ──
const DEFAULT_MODELS: AiModelConfig[] = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", credit_cost: 3, enabled: true, free_tier: true, pro_tier: true, byok_tier: true },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", credit_cost: 5, enabled: true, free_tier: false, pro_tier: true, byok_tier: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", credit_cost: 2, enabled: true, free_tier: false, pro_tier: true, byok_tier: true },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "DeepSeek", credit_cost: 2, enabled: true, free_tier: false, pro_tier: true, byok_tier: true },
  { id: "grok-3", name: "Grok 3", provider: "xAI", credit_cost: 4, enabled: true, free_tier: false, pro_tier: true, byok_tier: true },
];

const DEFAULT_PLANS: PlanDef[] = [
  { tier: "free", label: "Free", price: 0, projects_limit: 3, builds_limit: 20, credits_monthly: 20, features: "Basic AI models, Sub-URL hosting, CreAIlity badge" },
  { tier: "pro", label: "Pro", price: 19, projects_limit: 999, builds_limit: 500, credits_monthly: 500, features: "All AI models, Export builds, Custom domains, Own database, Priority support" },
  { tier: "byok", label: "BYOK", price: 29, projects_limit: 999, builds_limit: 9999, credits_monthly: 0, features: "Bring your own OpenRouter key, Unlimited everything, All Pro features" },
  { tier: "hosting", label: "Hosting Only", price: 10, projects_limit: 10, builds_limit: 0, credits_monthly: 0, features: "Host deployed apps, Custom domains, SSL included" },
];

// ── Shared helpers ──
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
        <span className="text-xs text-foreground-500">Loading...</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-background-200/60 border border-background-300/60 mb-4">
        <i className={`${icon} text-foreground-400 text-xl`} />
      </div>
      <p className="text-sm font-semibold text-foreground-700 mb-1.5">{title}</p>
      <p className="text-xs text-foreground-500 max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: "accent" | "secondary" | "primary" | "muted" | "green" | "red" }) {
  const cls = {
    accent: "bg-accent-500/10 text-accent-600 border-accent-500/20",
    secondary: "bg-secondary-500/10 text-secondary-700 border-secondary-500/20",
    primary: "bg-primary-100 text-primary-700 border-primary-200",
    muted: "bg-background-200/70 text-foreground-600 border-background-300/50",
    green: "bg-green-500/10 text-green-600 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
  }[color];
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 border capitalize ${cls}`}>
      {label}
    </span>
  );
}

// ── Overview Tab ──
function OverviewTab({ stats, onTabChange }: { stats: AdminStats; onTabChange: (t: AdminTab) => void }) {
  const [keys, setKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("platform_config").select("key, value").then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
      setKeys(map);
    });
  }, []);

  const cards = [
    { label: "Total Users", value: stats.totalUsers, sub: `${stats.newSignupsToday} today`, icon: "ri-user-line", color: "accent" as const },
    { label: "Paying Users", value: stats.paidUsers, sub: `${stats.freeUsers} free`, icon: "ri-vip-crown-line", color: "secondary" as const },
    { label: "Est. MRR", value: `$${stats.mrrEstimate.toLocaleString()}`, sub: "avg $19/user", icon: "ri-money-dollar-circle-line", color: "primary" as const },
    { label: "Total Projects", value: stats.totalProjects, sub: "all time", icon: "ri-folder-4-line", color: "muted" as const },
    { label: "Total Builds", value: stats.totalBuilds, sub: `${stats.totalVersions} versions`, icon: "ri-code-box-line", color: "muted" as const },
    { label: "Active Today", value: stats.activeToday, sub: `${stats.activeThisWeek} this week`, icon: "ri-pulse-line", color: "green" as const },
    { label: "Deployments", value: stats.totalDeployments, sub: "sandbox apps", icon: "ri-rocket-2-line", color: "accent" as const },
    { label: "New Signups (7d)", value: stats.newSignupsWeek, sub: `${stats.newSignupsToday} today`, icon: "ri-user-add-line", color: "secondary" as const },
  ];

  const colorMap = {
    accent: "bg-accent-100 text-accent-700 border-accent-200",
    secondary: "bg-secondary-100 text-secondary-700 border-secondary-200",
    primary: "bg-primary-100 text-primary-600 border-primary-200",
    muted: "bg-background-200 text-foreground-600 border-background-300",
    green: "bg-green-500/10 text-green-600 border-green-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-background-50 border border-background-200/80 rounded-2xl p-5 hover:border-background-300 transition-colors">
            <div className={`w-9 h-9 flex items-center justify-center rounded-xl border mb-4 ${colorMap[card.color]}`}>
              <i className={`${card.icon} text-sm`} />
            </div>
            <p className="text-lg md:text-2xl font-bold text-foreground-950 mb-0.5 leading-none">{card.value}</p>
            <p className="text-[10px] md:text-xs font-medium text-foreground-700 mb-0.5">{card.label}</p>
            <p className="text-[10px] text-foreground-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue breakdown */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground-900 mb-5 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-bar-chart-2-line text-secondary-600 text-sm" /></div>
            Revenue Breakdown
          </h3>
          <div className="flex flex-col gap-4">
            {DEFAULT_PLANS.filter((p) => p.price > 0).map((plan) => {
              const pct = stats.paidUsers > 0 ? Math.round((1 / DEFAULT_PLANS.filter((p) => p.price > 0).length) * 100) : 0;
              const barColors = { pro: "bg-accent-500", byok: "bg-secondary-500", hosting: "bg-primary-500" } as Record<string, string>;
              return (
                <div key={plan.tier}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-medium text-foreground-700 capitalize">{plan.label} (${plan.price}/mo)</span>
                    <span className="text-xs text-foreground-500">~{Math.floor(stats.paidUsers / 3)} users</span>
                  </div>
                  <div className="h-1.5 bg-background-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColors[plan.tier] || "bg-accent-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 mt-2 border-t border-background-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-foreground-700">Total Est. MRR</span>
              <span className="text-sm font-bold text-secondary-600">${stats.mrrEstimate.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Platform status */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground-900 mb-5 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-shield-check-line text-accent-600 text-sm" /></div>
            Platform Status
          </h3>
          <div className="flex flex-col gap-1">
            {[
              { label: "Supabase Database", ok: true, detail: "Connected" },
              { label: "Auth Service", ok: true, detail: "Running" },
              { label: "Cloudflare Sandbox", ok: !!keys.CLOUDFLARE_KV_NAMESPACE_ID, detail: keys.CLOUDFLARE_KV_NAMESPACE_ID ? "Configured" : "Not configured" },
              { label: "Stripe Payments", ok: !!keys.stripe_publishable_key, detail: keys.stripe_publishable_key ? "Connected" : "Not connected" },
              { label: "Email Service", ok: !!keys.smtp_host, detail: keys.smtp_host ? "Configured" : "Not configured" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-background-200/60 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.ok ? "bg-green-500" : "bg-background-400"}`} />
                  <span className="text-xs text-foreground-700">{s.label}</span>
                </div>
                <span className={`text-[10px] font-medium ${s.ok ? "text-green-600" : "text-foreground-500"}`}>{s.detail}</span>
              </div>
            ))}
          </div>
    </div>

        {/* Quick actions */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-foreground-900 mb-5 flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center"><i className="ri-flashlight-line text-primary-600 text-sm" /></div>
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { tab: "ai-models" as AdminTab, icon: "ri-brain-line", title: "Configure AI Models", desc: "Keys & credit costs", col: "bg-accent-100 border-accent-200 hover:bg-accent-100/80" },
              { tab: "users" as AdminTab, icon: "ri-user-add-line", title: "Add New User", desc: "Create accounts", col: "bg-secondary-100 border-secondary-200 hover:bg-secondary-100/80" },
              { tab: "plans" as AdminTab, icon: "ri-price-tag-3-line", title: "Edit Plans", desc: "Pricing & limits", col: "bg-primary-100 border-primary-200 hover:bg-primary-100/80" },
              { tab: "settings" as AdminTab, icon: "ri-settings-3-line", title: "Platform Settings", desc: "Config & toggles", col: "bg-background-200 border-background-300 hover:bg-background-200/80" },
            ].map((a) => (
              <button key={a.tab} onClick={() => onTabChange(a.tab)} className={`flex flex-col gap-3 text-left p-4 rounded-xl border ${a.col} transition-colors cursor-pointer`}>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-50/80">
                  <i className={`${a.icon} text-foreground-600 text-sm`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground-800 mb-0.5">{a.title}</p>
                  <p className="text-[10px] text-foreground-500">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ──
function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plansConfig, setPlansConfig] = useState<PlanDef[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  useEffect(() => {
    supabase.from("platform_config").select("key, value").eq("key", "plans_config").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlansConfig(parsed);
          }
        } catch (e) {
          console.error("Failed to parse plans_config:", e);
        }
      }
    });
  }, []);
  const [editCredits, setEditCredits] = useState(0);
  const [editPlan, setEditPlan] = useState("free");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: plans } = await supabase.from("user_plans").select("*");
      const { data: projects } = await supabase.from("projects").select("user_id, updated_at, created_at");
      const planMap: Record<string, { tier: string; status: string; credits: number; builds: number; created_at: string; email: string }> = {};
      for (const p of plans || []) {
        planMap[p.user_id] = { tier: p.plan_tier, status: p.status, credits: p.credits_remaining || 0, builds: p.builds_used_this_month || 0, created_at: p.created_at || "", email: p.email || "" };
      }
      const projectMap: Record<string, { count: number; lastActive: string; created_at: string }> = {};
      for (const p of projects || []) {
        if (!projectMap[p.user_id]) projectMap[p.user_id] = { count: 0, lastActive: p.updated_at, created_at: p.created_at || "" };
        projectMap[p.user_id].count++;
        if (p.updated_at > projectMap[p.user_id].lastActive) projectMap[p.user_id].lastActive = p.updated_at;
      }
      // Merge users from plan map (includes users with no projects)
      const allUserIds = new Set([...Object.keys(planMap), ...Object.keys(projectMap)]);
      const rows: UserRow[] = Array.from(allUserIds).map((id) => ({
        id,
        email: planMap[id]?.email || "",
        planTier: planMap[id]?.tier || "free",
        planStatus: planMap[id]?.status || "active",
        credits: planMap[id]?.credits || 0,
        buildsUsed: planMap[id]?.builds || 0,
        projectCount: projectMap[id]?.count || 0,
        lastActive: projectMap[id]?.lastActive || planMap[id]?.created_at || "",
        createdAt: planMap[id]?.created_at || projectMap[id]?.created_at || "",
      }));
      setUsers(rows.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      await supabase.from("user_plans").upsert({
        user_id: editingUser.id, plan_tier: editPlan, credits_remaining: editCredits, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      showMsg("User updated successfully");
      setEditingUser(null);
      loadUsers();
    } catch { showMsg("Failed to update user", "error"); }
  };

  const handleAddUser = async () => {
    if (!addUserEmail || !addUserPassword) return;
    try {
      const { data, error } = await supabase.auth.admin.createUser({ email: addUserEmail, password: addUserPassword, email_confirm: true });
      if (error) { showMsg(`Error: ${error.message}`, "error"); return; }
      if (data?.user) {
        const freePlan = plansConfig.find(p => p.tier === "free") || DEFAULT_PLANS.find(p => p.tier === "free")!;
        await supabase.from("user_plans").insert({
          user_id: data.user.id,
          plan_tier: "free",
          email: addUserEmail,
          credits_remaining: freePlan.credits_monthly,
          credits_monthly: freePlan.credits_monthly,
          builds_used_this_month: 0,
          builds_limit_monthly: freePlan.builds_limit,
          projects_limit: freePlan.projects_limit
        });
        showMsg("User created successfully!");
        setAddUserEmail(""); setAddUserPassword(""); setShowAddUser(false);
        loadUsers();
      }
    } catch (e: unknown) { showMsg(`Error: ${e instanceof Error ? e.message : "Failed"}`, "error"); }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Delete this user and all their data? This cannot be undone.")) return;
    try {
      await supabase.from("project_versions").delete().eq("user_id", userId);
      await supabase.from("sandbox_deployments").delete().eq("user_id", userId);
      await supabase.from("conversations").delete().eq("user_id", userId);
      await supabase.from("projects").delete().eq("user_id", userId);
      await supabase.from("user_plans").delete().eq("user_id", userId);
      showMsg("User deleted");
      loadUsers();
    } catch { showMsg("Failed to delete user", "error"); }
  };

  const filtered = users.filter((u) => {
    const matchesSearch = (u.email || u.id).toLowerCase().includes(search.toLowerCase());
    const matchesPlan = filterPlan === "all" || u.planTier === filterPlan;
    return matchesSearch && matchesPlan;
  });

  if (loading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      {msg && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 ${msg.type === "success" ? "border-green-500/20 bg-green-500/8 text-green-700" : "border-accent-500/20 bg-accent-500/8 text-accent-600"}`}>
          <i className={`text-sm ${msg.type === "success" ? "ri-check-line" : "ri-error-warning-line"}`} />
          <span className="text-xs">{msg.text}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-background-50 border border-background-200/80 rounded-xl px-3 py-2.5 flex-1 max-w-sm">
          <i className="ri-search-line text-foreground-400 text-sm" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email..." className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-400 outline-none" />
        </div>
        <div className="flex items-center gap-1 bg-background-200/50 border border-background-300/50 rounded-xl p-1">
          {["all", "free", "pro", "byok", "hosting"].map((p) => (
            <button key={p} onClick={() => setFilterPlan(p)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer capitalize whitespace-nowrap ${filterPlan === p ? "bg-background-50 text-foreground-900 font-semibold" : "text-foreground-500 hover:text-foreground-800"}`}>
              {p}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddUser(!showAddUser)} className="flex items-center gap-1.5 text-xs font-semibold bg-accent-500 text-background-50 rounded-xl px-4 py-2.5 hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-user-add-line text-sm" />Add User
        </button>
        <span className="text-sm text-foreground-500 ml-auto">{filtered.length} users</span>
      </div>

      {/* Add user form */}
      {showAddUser && (
        <div className="rounded-2xl border border-accent-500/20 bg-accent-500/5 p-5">
          <p className="text-xs font-bold text-foreground-800 mb-3 uppercase tracking-wider">Create New User</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wider">Email</label>
              <input type="email" value={addUserEmail} onChange={(e) => setAddUserEmail(e.target.value)} placeholder="user@email.com" className="bg-background-50 border border-background-200 rounded-xl px-3 py-2.5 text-sm text-foreground-800 placeholder-foreground-400 outline-none focus:border-accent-500/50" />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wider">Password</label>
              <input type="password" value={addUserPassword} onChange={(e) => setAddUserPassword(e.target.value)} placeholder="Min 6 characters" className="bg-background-50 border border-background-200 rounded-xl px-3 py-2.5 text-sm text-foreground-800 placeholder-foreground-400 outline-none focus:border-accent-500/50" />
            </div>
            <button onClick={handleAddUser} className="bg-accent-500 text-background-50 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Create User</button>
            <button onClick={() => setShowAddUser(false)} className="text-sm text-foreground-500 hover:text-foreground-700 px-3 py-2.5 transition-colors cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? <EmptyState icon="ri-group-line" title="No users found" desc="No users match your current filters." /> : (
        <div className="bg-background-50 border border-background-200/80 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-background-100/50 border-b border-background-200">
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">User</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Plan</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Credits</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Projects</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Last Active</th>
                <th className="text-right text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isRecent = user.lastActive && new Date(user.lastActive).getTime() > Date.now() - 86400000;
                return (
                  <tr key={user.id} className="border-b border-background-200/40 hover:bg-background-100/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-accent-600">{(user.email || user.id).charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground-700">{user.email || user.id.slice(0, 18) + "…"}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${isRecent ? "bg-green-500" : "bg-foreground-400"}`} />
                            <span className="text-[10px] text-foreground-500">{isRecent ? "Active today" : "Inactive"}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge label={user.planTier} color={user.planTier === "pro" ? "accent" : user.planTier === "byok" ? "secondary" : user.planTier === "hosting" ? "primary" : "muted"} />
                    </td>
                    <td className="px-5 py-4"><span className="text-sm font-bold text-foreground-900">{user.credits}</span></td>
                    <td className="px-5 py-4"><span className="text-sm font-bold text-foreground-900">{user.projectCount}</span></td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-foreground-600">
                        {user.lastActive ? new Date(user.lastActive).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditingUser(user); setEditCredits(user.credits); setEditPlan(user.planTier); }}
                          className="text-xs px-3 py-1.5 rounded-lg text-foreground-600 hover:text-foreground-900 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap">Edit</button>
                        <button onClick={() => handleDeleteUser(user.id)}
                          className="text-xs px-3 py-1.5 rounded-lg text-foreground-500 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer whitespace-nowrap">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative bg-background-50 rounded-2xl border border-background-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-bold text-foreground-900 mb-1">Edit User</h3>
            <p className="text-[10px] text-foreground-500 font-mono mb-5">{editingUser.email || editingUser.id}</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-foreground-500 uppercase tracking-wider">Plan Tier</label>
                <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2.5 text-sm text-foreground-800 outline-none cursor-pointer">
                  <option value="free">Free</option>
                  <option value="pro">Pro ($19/mo)</option>
                  <option value="byok">BYOK ($29/mo)</option>
                  <option value="hosting">Hosting ($10/mo)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-foreground-500 uppercase tracking-wider">Credits Remaining</label>
                <input type="number" value={editCredits} onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2.5 text-sm text-foreground-800 outline-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setEditingUser(null)} className="text-sm text-foreground-600 hover:text-foreground-800 px-4 py-2 rounded-xl border border-background-200 transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleSaveUser} className="text-sm bg-accent-500 text-background-50 px-5 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap font-semibold">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Projects Tab ──
function ProjectsTab() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: pd, error: pdErr } = await supabase.from("projects").select("id, name, user_id, updated_at, generated_code").order("updated_at", { ascending: false }).limit(200);
        if (pdErr) throw pdErr;
        const { data: versions } = await supabase.from("project_versions").select("project_id");
        const { data: deps } = await supabase.from("sandbox_deployments").select("project_id, public_url");
        const vc: Record<string, number> = {};
        for (const v of versions || []) vc[v.project_id] = (vc[v.project_id] || 0) + 1;
        const depMap: Record<string, string> = {};
        for (const d of deps || []) { if (d.public_url) depMap[d.project_id] = d.public_url; }
        setProjects((pd || []).map((p) => ({
          id: p.id, name: p.name, user_id: p.user_id, updated_at: p.updated_at,
          has_code: !!p.generated_code, version_count: vc[p.id] || 0,
          has_sandbox: !!depMap[p.id], sandbox_url: depMap[p.id] || undefined,
        })));
        setError(null);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); return; }
    try {
      await supabase.from("project_versions").delete().eq("project_id", id);
      await supabase.from("sandbox_deployments").delete().eq("project_id", id);
      await supabase.from("projects").delete().eq("id", id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setMsg("Project deleted"); setTimeout(() => setMsg(null), 2500);
    } catch { setMsg("Failed"); }
    setDeleteConfirm(null);
  };

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search));
  if (loading) return <LoadingState />;
  if (error) return <div className="rounded-2xl border border-accent-500/20 bg-accent-500/8 p-6 text-center"><p className="text-sm text-accent-600">{error}</p></div>;

  return (
    <div className="flex flex-col gap-5">
      {msg && <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 flex items-center gap-2 text-green-700 text-xs"><i className="ri-check-line" />{msg}</div>}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-background-50 border border-background-200/80 rounded-xl px-3 py-2.5 flex-1 max-w-sm">
          <i className="ri-search-line text-foreground-400 text-sm" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-400 outline-none" />
        </div>
        <span className="text-sm text-foreground-500 ml-auto">{filtered.length} projects</span>
      </div>
      {filtered.length === 0 ? <EmptyState icon="ri-folder-line" title="No projects" desc="No projects match your search." /> : (
        <div className="bg-background-50 border border-background-200/80 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-background-100/50 border-b border-background-200">
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Project</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Owner</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Versions</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Status</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Updated</th>
                <th className="text-right text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-background-200/40 hover:bg-background-100/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.has_code ? "bg-secondary-100 border border-secondary-200" : "bg-background-200 border border-background-300"}`}>
                        <i className={`text-xs ${p.has_code ? "ri-code-box-line text-secondary-600" : "ri-file-line text-foreground-500"}`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground-800 truncate max-w-[200px]">{p.name}</p>
                        <p className="text-[10px] text-foreground-400 font-mono">{p.id.slice(0, 20)}…</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className="text-xs text-foreground-500 font-mono">{p.user_id.slice(0, 12)}…</span></td>
                  <td className="px-5 py-4">
                    {p.version_count > 0
                      ? <span className="inline-flex items-center text-xs font-bold text-foreground-800 bg-background-200 rounded-full px-2 py-0.5">{p.version_count}</span>
                      : <span className="text-xs text-foreground-400">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    {p.has_sandbox
                      ? <a href={p.sandbox_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-500/10 text-green-600 border border-green-500/20 rounded-full px-2 py-0.5 cursor-pointer"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />Live</a>
                      : <span className="text-[10px] text-foreground-400 bg-background-200/60 rounded-full px-2 py-0.5">Draft</span>}
                  </td>
                  <td className="px-5 py-4"><span className="text-xs text-foreground-500">{new Date(p.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDelete(p.id)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${deleteConfirm === p.id ? "bg-red-500/15 text-red-500 border border-red-500/30" : "text-foreground-500 hover:text-red-500 hover:bg-red-500/10"}`}>
                      {deleteConfirm === p.id ? "Confirm delete?" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Deployments Tab ──
function DeploymentsTab() {
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: deps } = await supabase.from("sandbox_deployments").select("*").order("created_at", { ascending: false }).limit(100);
      const projectIds = [...new Set((deps || []).map((d) => d.project_id))];
      const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
      const nameMap: Record<string, string> = {};
      for (const p of projects || []) nameMap[p.id] = p.name;
      setDeployments((deps || []).map((d) => ({ id: d.id, project_id: d.project_id, slug: d.slug || "", sandbox_id: d.sandbox_id || "", public_url: d.public_url || "", file_count: d.file_count || 0, created_at: d.created_at, project_name: nameMap[d.project_id] || "Unknown" })));
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); return; }
    await supabase.from("sandbox_deployments").delete().eq("id", id);
    setDeployments((prev) => prev.filter((d) => d.id !== id));
    setMsg("Deployment removed"); setTimeout(() => setMsg(null), 2500);
    setDeleteConfirm(null);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5">
      {msg && <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 flex items-center gap-2 text-green-700 text-xs"><i className="ri-check-line" />{msg}</div>}
      <div className="flex items-center"><span className="text-sm text-foreground-500 ml-auto">{deployments.length} deployments</span></div>
      {deployments.length === 0 ? <EmptyState icon="ri-rocket-line" title="No deployments" desc="No published sandbox deployments yet." /> : (
        <div className="bg-background-50 border border-background-200/80 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-background-100/50 border-b border-background-200">
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Project</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Slug</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Live URL</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Files</th>
                <th className="text-left text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Deployed</th>
                <th className="text-right text-[10px] font-bold text-foreground-500 uppercase tracking-widest px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} className="border-b border-background-200/40 hover:bg-background-100/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-100 border border-accent-200 flex items-center justify-center flex-shrink-0"><i className="ri-rocket-2-line text-accent-600 text-xs" /></div>
                      <div><p className="text-xs font-semibold text-foreground-800 truncate max-w-[160px]">{d.project_name}</p><p className="text-[10px] text-foreground-400 font-mono">{d.project_id.slice(0, 14)}…</p></div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className="text-xs font-mono text-foreground-600">{d.slug}</span></td>
                  <td className="px-5 py-4">{d.public_url ? <a href={d.public_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-500 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-external-link-line text-[10px]" />Open</a> : <span className="text-xs text-foreground-400">—</span>}</td>
                  <td className="px-5 py-4"><span className="text-sm font-bold text-foreground-900">{d.file_count}</span></td>
                  <td className="px-5 py-4"><span className="text-xs text-foreground-500">{new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => handleDelete(d.id)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${deleteConfirm === d.id ? "bg-red-500/15 text-red-500 border border-red-500/30" : "text-foreground-500 hover:text-red-500 hover:bg-red-500/10"}`}>
                      {deleteConfirm === d.id ? "Confirm?" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── AI Models Tab ──
function AiModelsTab() {
  const [models, setModels] = useState<AiModelConfig[]>(DEFAULT_MODELS);
  const [msg, setMsg] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("platform_config").select("key, value").then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
      setKeys(map);
      // Auto-disable models that don't have a platform API key configured
      setModels((prev) => prev.map((m) => {
        const providerKey = `platform_${m.provider.toLowerCase()}_key`;
        return { ...m, enabled: !!map[providerKey] };
      }));
    });
  }, []);

  const handleToggle = (id: string) => {
    setModels((prev) => prev.map((m) => m.id === id ? { ...m, enabled: !m.enabled } : m));
  };

  const handleCreditCost = (id: string, cost: number) => {
    setModels((prev) => prev.map((m) => m.id === id ? { ...m, credit_cost: cost } : m));
  };

  const handleTierAccess = (id: string, tier: "free_tier" | "pro_tier" | "byok_tier") => {
    setModels((prev) => prev.map((m) => m.id === id ? { ...m, [tier]: !m[tier] } : m));
  };

  const handleSaveKey = async (configKey: string, value: string) => {
    if (!value.trim()) return;
    setSavingKey(configKey);
    const { data: existing, error: fetchErr } = await supabase.from("platform_config").select("key").eq("key", configKey).maybeSingle();
    
    let err = fetchErr;
    if (!err) {
      if (existing) { 
        const { error } = await supabase.from("platform_config").update({ value: value.trim() }).eq("key", configKey); 
        err = error;
      } else { 
        const { error } = await supabase.from("platform_config").insert({ key: configKey, value: value.trim() }); 
        err = error;
      }
    }

    if (err) {
      setMsg(`Failed to save: ${err.message}`);
      setTimeout(() => setMsg(null), 4000);
      setSavingKey(null);
      return;
    }

    setKeys(prev => ({ ...prev, [configKey]: value }));
    setMsg(`Key saved for ${configKey}`);
    setTimeout(() => setMsg(null), 2000);
    setSavingKey(null);
  };

  const handleRemoveKey = async (configKey: string) => {
    await supabase.from("platform_config").delete().eq("key", configKey);
    setKeys(prev => { const next = { ...prev }; delete next[configKey]; return next; });
  };

  return (
    <div className="flex flex-col gap-6">
      {msg && <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 flex items-center gap-2 text-green-700 text-xs"><i className="ri-check-line" />{msg}</div>}
      <div>
        <h2 className="text-base font-bold text-foreground-900 mb-1">AI Models</h2>
        <p className="text-sm text-foreground-500">Manage model availability, credit costs, and platform API keys.</p>
      </div>
      <div className="flex flex-col gap-4">
        {models.map((model) => {
          const providerKey = `platform_${model.provider.toLowerCase()}_key`;
          const hasKey = !!keys[providerKey];
          return (
            <div key={model.id} className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-xl border flex-shrink-0 ${model.enabled ? "bg-accent-100 border-accent-200" : "bg-background-200 border-background-300"}`}>
                    <i className={`ri-brain-line text-sm ${model.enabled ? "text-accent-600" : "text-foreground-400"}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground-800">{model.name}</p>
                      <span className="text-[10px] text-foreground-500 bg-background-200 px-1.5 py-0.5 rounded-full">{model.provider}</span>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${model.enabled ? "bg-green-500" : "bg-foreground-400"}`} />
                      <span className={`text-[10px] font-medium ${model.enabled ? "text-green-600" : "text-foreground-500"}`}>{model.enabled ? "Enabled" : "Disabled"}</span>
                    </div>
                    <p className="text-xs text-foreground-500 mt-0.5">{model.id}</p>
                  </div>
                </div>
                <button onClick={() => handleToggle(model.id)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap border font-medium ${model.enabled ? "border-red-400/30 text-red-500 hover:bg-red-500/10" : "border-green-500/30 text-green-600 hover:bg-green-500/10"}`}>
                  {model.enabled ? "Disable" : "Enable"}
                </button>
              </div>

              <div className="flex items-center gap-4 flex-wrap mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-foreground-500 font-medium">Credits per message:</span>
                  <input type="number" value={model.credit_cost} onChange={(e) => handleCreditCost(model.id, parseInt(e.target.value) || 1)} className="w-16 text-center bg-background-200/60 border border-background-300/60 rounded-lg px-2 py-1 text-xs text-foreground-800 outline-none" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-foreground-500 font-medium">Access:</span>
                  {(["free_tier", "pro_tier", "byok_tier"] as const).map((tier) => (
                    <button key={tier} onClick={() => handleTierAccess(model.id, tier)} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors cursor-pointer whitespace-nowrap border ${model[tier] ? "bg-accent-500/10 text-accent-600 border-accent-500/20" : "bg-background-200/60 text-foreground-500 border-background-300/50"}`}>
                      {tier.replace("_tier", "").toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div className="bg-background-100 rounded-xl border border-background-200/60 p-3">
                <div className="flex items-center gap-2">
                  <i className="ri-key-2-line text-foreground-400 text-xs flex-shrink-0" />
                  <input
                    type={showKey[model.id] ? "text" : "password"}
                    value={keys[providerKey] || ""}
                    onChange={(e) => setKeys(prev => ({ ...prev, [providerKey]: e.target.value }))}
                    placeholder={`${model.provider} API key...`}
                    className="flex-1 bg-transparent text-xs text-foreground-800 placeholder-foreground-400 outline-none font-mono"
                  />
                  {hasKey && <button onClick={() => setShowKey(prev => ({ ...prev, [model.id]: !prev[model.id] }))} className="cursor-pointer text-foreground-400 hover:text-foreground-600"><i className={`text-xs ${showKey[model.id] ? "ri-eye-off-line" : "ri-eye-line"}`} /></button>}
                  <button onClick={() => handleSaveKey(providerKey, keys[providerKey] || "")} disabled={savingKey === providerKey} className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-accent-500 text-background-50 hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60">
                    {savingKey === providerKey ? "Saving…" : "Save"}
                  </button>
                  {hasKey && <button onClick={() => handleRemoveKey(providerKey)} className="text-[10px] text-foreground-400 hover:text-red-500 px-2 py-1.5 rounded-lg border border-background-300/50 transition-colors cursor-pointer whitespace-nowrap">Remove</button>}
                </div>
                <p className="text-[9px] text-foreground-400 mt-1.5">{hasKey ? <span className="text-green-600 font-medium">Key configured</span> : "No key set — platform will use default routing"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Plans Tab ──
function PlansTab() {
  const [plans, setPlans] = useState<PlanDef[]>(DEFAULT_PLANS);
  const [editingPlan, setEditingPlan] = useState<PlanDef | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("platform_config").select("key, value").eq("key", "plans_config").maybeSingle().then(({ data }) => {
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlans(parsed);
          }
        } catch (e) {
          console.error("Failed to parse plans_config:", e);
        }
      }
    });
  }, []);

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    const updatedPlans = plans.map((p) => p.tier === editingPlan.tier ? editingPlan : p);
    setPlans(updatedPlans);
    
    // Save to Supabase platform_config
    const { data: existing } = await supabase.from("platform_config").select("key").eq("key", "plans_config").maybeSingle();
    let err = null;
    const value = JSON.stringify(updatedPlans);
    if (existing) {
      const { error } = await supabase.from("platform_config").update({ value }).eq("key", "plans_config");
      err = error;
    } else {
      const { error } = await supabase.from("platform_config").insert({ key: "plans_config", value });
      err = error;
    }
    
    setEditingPlan(null);
    if (err) {
      setMsg(`Error saving plans: ${err.message}`);
    } else {
      setMsg("Plan saved successfully!");
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const planColors: Record<string, string> = {
    free: "bg-background-200/60 border-background-300/60",
    pro: "bg-accent-500/8 border-accent-500/20",
    byok: "bg-secondary-500/8 border-secondary-500/20",
    hosting: "bg-primary-100 border-primary-200",
  };

  return (
    <div className="flex flex-col gap-6">
      {msg && <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 flex items-center gap-2 text-green-700 text-xs"><i className="ri-check-line" />{msg}</div>}
      <div>
        <h2 className="text-base font-bold text-foreground-900 mb-1">Plans & Pricing</h2>
        <p className="text-sm text-foreground-500">Edit plan limits, pricing, and features for each tier.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <div key={plan.tier} className={`rounded-2xl border p-5 ${planColors[plan.tier] || "bg-background-50 border-background-200"}`}>
            <div className="flex items-center justify-between mb-4">
              <Badge label={plan.tier} color={plan.tier === "pro" ? "accent" : plan.tier === "byok" ? "secondary" : plan.tier === "hosting" ? "primary" : "muted"} />
              <span className="text-xl font-black text-foreground-950">{plan.price === 0 ? "Free" : `$${plan.price}`}<span className="text-xs font-normal text-foreground-500">{plan.price > 0 ? "/mo" : ""}</span></span>
            </div>
            <div className="flex flex-col gap-2.5 mb-4">
              <div className="flex justify-between text-xs"><span className="text-foreground-500">Projects</span><span className="font-bold text-foreground-800">{plan.projects_limit >= 999 ? "∞" : plan.projects_limit}</span></div>
              <div className="flex justify-between text-xs"><span className="text-foreground-500">AI Credits/mo</span><span className="font-bold text-foreground-800">{plan.credits_monthly === 0 ? "Own key" : plan.credits_monthly}</span></div>
            </div>
            <p className="text-[10px] text-foreground-500 leading-relaxed mb-4">{plan.features}</p>
            <button onClick={() => setEditingPlan({ ...plan })} className="w-full text-xs font-semibold py-2.5 rounded-xl border border-foreground-400/30 text-foreground-700 hover:border-foreground-500 hover:text-foreground-900 transition-colors cursor-pointer">Edit Plan</button>
          </div>
        ))}
      </div>

      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingPlan(null)} />
          <div className="relative bg-background-50 rounded-2xl border border-background-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-bold text-foreground-900 mb-5 capitalize">Edit {editingPlan.tier} Plan</h3>
            <div className="flex flex-col gap-4">
              {[
                { key: "price", label: "Price ($/mo)", type: "number" },
                { key: "projects_limit", label: "Projects Limit (999 = unlimited)", type: "number" },
                { key: "builds_limit", label: "Credits/Month (9999 = unlimited)", type: "number" },
                { key: "credits_monthly", label: "Credits/Month (0 = own key)", type: "number" },
              ].map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-foreground-500 uppercase tracking-wider">{field.label}</label>
                  <input type={field.type} value={(editingPlan as any)[field.key]} onChange={(e) => setEditingPlan({ ...editingPlan, [field.key]: parseInt(e.target.value) || 0 })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-foreground-500 uppercase tracking-wider">Features (comma separated)</label>
                <input type="text" value={editingPlan.features} onChange={(e) => setEditingPlan({ ...editingPlan, features: e.target.value })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setEditingPlan(null)} className="text-sm text-foreground-600 px-4 py-2 rounded-xl border border-background-200 transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleSavePlan} className="text-sm bg-accent-500 text-background-50 px-5 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer font-semibold">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──
function SettingsTab() {
  const [settings, setSettings] = useState({
    platformName: "CreAIlity",
    maintenanceMode: false,
    signupsEnabled: true,
    defaultModel: "gpt-4o",
    stripePublishableKey: "",
    cloudflareAccountId: "",
    cloudflareApiToken: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("platform_config").select("key, value").then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
      setSettings({
        platformName: map.platform_name || "CreAIlity",
        maintenanceMode: map.maintenance_mode === "true",
        signupsEnabled: map.signups_enabled !== "false",
        defaultModel: map.default_model || "gpt-4o",
        stripePublishableKey: map.stripe_publishable_key || "",
        cloudflareAccountId: map.cloudflare_account_id || "",
        cloudflareApiToken: map.cloudflare_api_token || "",
      });
    });
  }, []);

  const handleSave = async (key: string, value: string) => {
    const { data: existing } = await supabase.from("platform_config").select("key").eq("key", key).maybeSingle();
    if (existing) { await supabase.from("platform_config").update({ value }).eq("key", key); }
    else { await supabase.from("platform_config").insert({ key, value }); }
    setMsg(`Saved!`); setTimeout(() => setMsg(null), 2000);
  };

  const handleToggle = (key: string, current: boolean) => {
    const next = !current;
    setSettings((prev) => ({ ...prev, [key]: next }));
    handleSave(key === "maintenanceMode" ? "maintenance_mode" : "signups_enabled", String(next));
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {msg && <div className="rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3 flex items-center gap-2 text-green-700 text-xs"><i className="ri-check-line" />{msg}</div>}
      <div>
        <h2 className="text-base font-bold text-foreground-900 mb-1">Platform Settings</h2>
        <p className="text-sm text-foreground-500">Global configuration for your CreAIlity platform.</p>
      </div>
      <div className="flex flex-col gap-3">
        {/* Platform Name */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground-800">Platform Name</p>
              <p className="text-xs text-foreground-500 mt-0.5">Displayed in headers and emails</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2 text-sm text-foreground-800 outline-none w-40" />
              <button onClick={() => handleSave("platform_name", settings.platformName)} className="text-xs font-semibold bg-accent-500 text-background-50 px-3 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Save</button>
            </div>
          </div>
        </div>
        {/* Default Model */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground-800">Default AI Model</p>
              <p className="text-xs text-foreground-500 mt-0.5">Model selected for new users</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={settings.defaultModel} onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2 text-sm text-foreground-800 outline-none cursor-pointer">
                {DEFAULT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button onClick={() => handleSave("default_model", settings.defaultModel)} className="text-xs font-semibold bg-accent-500 text-background-50 px-3 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Save</button>
            </div>
          </div>
        </div>
        {/* Maintenance Mode */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground-800">Maintenance Mode</p>
              <p className="text-xs text-foreground-500 mt-0.5">Blocks all non-admin access to the platform</p>
            </div>
            <button onClick={() => handleToggle("maintenanceMode", settings.maintenanceMode)} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${settings.maintenanceMode ? "bg-red-500" : "bg-background-300"}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${settings.maintenanceMode ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>
        {/* Signups */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground-800">New Signups Enabled</p>
              <p className="text-xs text-foreground-500 mt-0.5">Allow new user registrations</p>
            </div>
            <button onClick={() => handleToggle("signupsEnabled", settings.signupsEnabled)} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${settings.signupsEnabled ? "bg-secondary-500" : "bg-background-300"}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${settings.signupsEnabled ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>
        {/* Stripe Settings */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground-800">Stripe Publishable Key</p>
                <p className="text-xs text-foreground-500 mt-0.5">Used on the frontend for Stripe checkout</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={settings.stripePublishableKey} onChange={(e) => setSettings({ ...settings, stripePublishableKey: e.target.value })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2 text-sm text-foreground-800 outline-none w-40 sm:w-60" placeholder="pk_test_..." />
                <button onClick={() => handleSave("stripe_publishable_key", settings.stripePublishableKey)} className="text-xs font-semibold bg-accent-500 text-background-50 px-3 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Save</button>
              </div>
            </div>
            <div className="pt-3 border-t border-background-200">
              <p className="text-xs font-bold text-foreground-800 mb-1">Stripe Webhook URL</p>
              <p className="text-xs text-foreground-500 mb-2">Configure this URL in your Stripe Dashboard to receive subscription webhook events:</p>
              <div className="flex items-center gap-2">
                <input type="text" readOnly value="https://qyyfygcflzyfucypmfeu.supabase.co/functions/v1/stripe-webhook" className="bg-background-100 border border-background-200 rounded-xl px-3 py-2 text-xs text-foreground-600 outline-none w-full cursor-text select-all" />
                <button onClick={() => { navigator.clipboard.writeText("https://qyyfygcflzyfucypmfeu.supabase.co/functions/v1/stripe-webhook"); setMsg("Copied Webhook URL!"); setTimeout(() => setMsg(null), 2000); }} className="text-xs font-semibold bg-background-200 text-foreground-700 px-3 py-2 rounded-xl hover:bg-background-300 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-file-copy-line mr-1" />Copy</button>
              </div>
            </div>
          </div>
        </div>
        {/* Cloudflare Sandbox Settings */}
        <div className="bg-background-50 border border-background-200/80 rounded-2xl p-5">
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-foreground-800 uppercase tracking-wider">Cloudflare Sandbox Settings</h3>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground-800">Cloudflare Account ID</p>
                <p className="text-xs text-foreground-500 mt-0.5">Found in Cloudflare dashboard URL or settings</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={settings.cloudflareAccountId} onChange={(e) => setSettings({ ...settings, cloudflareAccountId: e.target.value })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2 text-sm text-foreground-800 outline-none w-40 sm:w-60" placeholder="e.g. 1a2b3c..." />
                <button onClick={() => handleSave("cloudflare_account_id", settings.cloudflareAccountId)} className="text-xs font-semibold bg-accent-500 text-background-50 px-3 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Save</button>
              </div>
            </div>
            <div className="pt-3 border-t border-background-200 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground-800">Cloudflare API Token</p>
                <p className="text-xs text-foreground-500 mt-0.5">Token with Workers and KV Edit permissions</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="password" value={settings.cloudflareApiToken} onChange={(e) => setSettings({ ...settings, cloudflareApiToken: e.target.value })} className="bg-background-100 border border-background-200 rounded-xl px-3 py-2 text-sm text-foreground-800 outline-none w-40 sm:w-60" placeholder="••••••••••••••••" />
                <button onClick={() => handleSave("cloudflare_api_token", settings.cloudflareApiToken)} className="text-xs font-semibold bg-accent-500 text-background-50 px-3 py-2 rounded-xl hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Save</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function AdminPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };
  const [tab, setTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalProjects: 0, totalVersions: 0, totalDeployments: 0,
    activeToday: 0, activeThisWeek: 0, paidUsers: 0, freeUsers: 0,
    mrrEstimate: 0, newSignupsToday: 0, newSignupsWeek: 0, totalBuilds: 0,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function loadStats() {
      try {
        const [{ count: pc }, { count: vc }, { count: dc }, { data: allProjects }, { data: plans }] = await Promise.all([
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("project_versions").select("id", { count: "exact", head: true }),
          supabase.from("sandbox_deployments").select("id", { count: "exact", head: true }),
          supabase.from("projects").select("user_id, updated_at, created_at"),
          supabase.from("user_plans").select("user_id, plan_tier, created_at"),
        ]);
        const now = Date.now();
        const todayThresh = new Date(now - 86400000).toISOString();
        const weekThresh = new Date(now - 7 * 86400000).toISOString();
        const uniqueUsers = new Set<string>();
        const activeToday = new Set<string>();
        const activeWeek = new Set<string>();
        for (const p of allProjects || []) {
          uniqueUsers.add(p.user_id);
          if (p.updated_at > todayThresh) activeToday.add(p.user_id);
          if (p.updated_at > weekThresh) activeWeek.add(p.user_id);
        }
        for (const p of plans || []) uniqueUsers.add(p.user_id);
        const paidPlans = (plans || []).filter((p) => p.plan_tier !== "free");
        const freePlans = (plans || []).filter((p) => p.plan_tier === "free");
        const newToday = (plans || []).filter((p) => p.created_at > todayThresh).length;
        const newWeek = (plans || []).filter((p) => p.created_at > weekThresh).length;
        const planPrices: Record<string, number> = { pro: 19, byok: 29, hosting: 10 };
        const mrr = paidPlans.reduce((sum, p) => sum + (planPrices[p.plan_tier] || 0), 0);
        setStats({
          totalUsers: uniqueUsers.size,
          totalProjects: pc || 0,
          totalVersions: vc || 0,
          totalDeployments: dc || 0,
          activeToday: activeToday.size,
          activeThisWeek: activeWeek.size,
          paidUsers: paidPlans.length,
          freeUsers: freePlans.length,
          mrrEstimate: mrr,
          newSignupsToday: newToday,
          newSignupsWeek: newWeek,
          totalBuilds: vc || 0,
        });
      } catch { /* silent */ }
    }
    loadStats();
  }, [user]);

  if (loading || !user) return (
    <div className="h-screen bg-background-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
    </div>
  );

  const navItems: { id: AdminTab; label: string; icon: string; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: "ri-dashboard-3-line" },
    { id: "users", label: "Users", icon: "ri-group-line", badge: stats.totalUsers },
    { id: "projects", label: "Projects", icon: "ri-folder-4-line", badge: stats.totalProjects },
    { id: "deployments", label: "Deployments", icon: "ri-rocket-2-line", badge: stats.totalDeployments },
    { id: "ai-models", label: "AI Models", icon: "ri-brain-line" },
    { id: "plans", label: "Plans & Pricing", icon: "ri-price-tag-3-line" },
    { id: "settings", label: "Settings", icon: "ri-settings-3-line" },
  ];

  const tabLabels: Record<AdminTab, string> = {
    overview: "Overview",
    users: "User Management",
    projects: "Projects",
    deployments: "Deployments",
    "ai-models": "AI Models",
    plans: "Plans & Pricing",
    settings: "Settings",
  };

  return (
    <div className="min-h-screen bg-background-100/50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar - absolute overlay on mobile, static on desktop */}
      <aside
        className={`fixed lg:sticky top-0 z-40 w-60 flex-shrink-0 bg-background-50 border-r border-background-200/80 flex flex-col h-screen overflow-y-auto transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-background-200/60">
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
            <img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-7 w-auto object-contain" />
            <div>
              <p className="text-xs font-bold text-foreground-900 leading-none">CreAIlity</p>
              <p className="text-[9px] text-foreground-400 mt-0.5 font-medium uppercase tracking-wider">Admin</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3">
          <p className="text-[9px] font-bold text-foreground-400 uppercase tracking-widest px-3 mb-2">Navigation</p>
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer text-left ${
                  tab === item.id
                    ? "bg-accent-500/10 text-accent-700 font-semibold"
                    : "text-foreground-600 hover:bg-background-200/60 hover:text-foreground-900"
                }`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <i className={`${item.icon} text-sm ${tab === item.id ? "text-accent-600" : ""}`} />
                  </div>
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${tab === item.id ? "bg-accent-500/15 text-accent-700" : "bg-background-300/60 text-foreground-500"}`}>
                    {item.badge > 999 ? "999+" : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-background-200/60">
            <p className="text-[9px] font-bold text-foreground-400 uppercase tracking-widest px-3 mb-2">Links</p>
            <Link to="/workspace" onClick={() => setSidebarOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-foreground-600 hover:bg-background-200/60 hover:text-foreground-900 transition-colors cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className="ri-layout-2-line text-sm" /></div>
              Workspace
            </Link>
            <Link to="/" onClick={() => setSidebarOpen(false)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-foreground-600 hover:bg-background-200/60 hover:text-foreground-900 transition-colors cursor-pointer">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className="ri-home-3-line text-sm" /></div>
              Home
            </Link>
          </div>
        </nav>

        {/* User info at bottom */}
        <div className="p-4 border-t border-background-200/60">
          <div className="flex items-center gap-2.5 px-1 mb-3">
            <div className="w-7 h-7 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent-600">{user.email?.charAt(0).toUpperCase() || "A"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground-800 truncate">{user.email}</p>
              <p className="text-[10px] text-accent-600 font-semibold">Admin</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-foreground-600 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className="ri-logout-box-line text-sm" /></div>
            <span className="whitespace-nowrap">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="bg-background-50 border-b border-background-200/80 px-4 md:px-8 py-3 md:py-4 sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer flex-shrink-0 lg:hidden"
            >
              <i className="ri-menu-line text-foreground-600 text-lg" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-bold text-foreground-950 truncate">{tabLabels[tab]}</h1>
              <p className="text-[10px] md:text-xs text-foreground-500 mt-0.5 hidden sm:block">CreAIlity Platform Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-foreground-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              <span className="hidden sm:inline">System operational</span>
            </div>
            {stats.newSignupsToday > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-accent-500/10 border border-accent-500/20 rounded-full px-3 py-1">
                <i className="ri-user-add-line text-accent-600 text-[10px]" />
                <span className="text-[10px] font-semibold text-accent-600">{stats.newSignupsToday} new today</span>
              </div>
            )}
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {tab === "overview" && <OverviewTab stats={stats} onTabChange={setTab} />}
          {tab === "users" && <UsersTab />}
          {tab === "projects" && <ProjectsTab />}
          {tab === "deployments" && <DeploymentsTab />}
          {tab === "ai-models" && <AiModelsTab />}
          {tab === "plans" && <PlansTab />}
          {tab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}