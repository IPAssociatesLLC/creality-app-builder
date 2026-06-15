import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { loadConfig, saveConfig, type StoredConfig, AVAILABLE_MODELS } from "@/pages/workspace/components/ModelSelector";
import { getAllProjects } from "@/utils/projects-store";

type SettingsTab = "api-keys" | "account" | "appearance";

function ApiKeysTab() {
  const [config, setConfig] = useState<StoredConfig>(loadConfig());
  const [saved, setSaved] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const handleSaveKey = (modelId: string, key: string) => { const updated = { ...config, apiKeys: { ...config.apiKeys, [modelId]: key } }; setConfig(updated); saveConfig(updated); setSaved(modelId); setTimeout(() => setSaved(null), 2000); };
  const handleSelectModel = (modelId: string) => { const updated = { ...config, selectedModel: modelId }; setConfig(updated); saveConfig(updated); };

  return <div className="flex flex-col gap-8">
    <div><h2 className="text-base font-semibold text-foreground-900 mb-1">AI Model API Keys</h2><p className="text-sm text-foreground-500">Your API keys are stored locally in your browser and never sent to our servers.</p></div>
    <div className="flex flex-col gap-4">
      {AVAILABLE_MODELS.map((model) => {
        const key = config.apiKeys[model.id] || "";
        const isActive = config.selectedModel === model.id;
        return <div key={model.id} className={`rounded-2xl border p-5 transition-all ${isActive ? "border-foreground-400/50 bg-background-100" : "border-background-300/60 bg-background-100"}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-background-200/60 flex-shrink-0"><i className="ri-robot-line text-foreground-600 text-base" /></div>
              <div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-foreground-800">{model.name}</p>{isActive && <span className="text-[10px] bg-accent-500/15 text-accent-500 border border-accent-500/20 rounded-full px-2 py-0.5">Active</span>}</div><p className="text-xs text-foreground-500 mt-0.5">{model.provider}</p></div>
            </div>
            <button onClick={() => handleSelectModel(model.id)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${isActive ? "bg-foreground-900 text-background-50 border-foreground-900" : "border-background-300/60 text-foreground-600 hover:border-foreground-500 hover:text-foreground-800"}`}>{isActive ? "Selected" : "Set as default"}</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 transition-colors">
              <i className="ri-key-2-line text-foreground-500 text-xs flex-shrink-0" />
              <input type={showKey[model.id] ? "text" : "password"} value={key} onChange={(e) => setConfig((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, [model.id]: e.target.value } }))} placeholder={`${model.provider} API key`} className="flex-1 bg-transparent text-xs text-foreground-800 placeholder-foreground-500 outline-none font-mono" />
              <button onClick={() => setShowKey((prev) => ({ ...prev, [model.id]: !prev[model.id] }))} className="flex-shrink-0 cursor-pointer text-foreground-500 hover:text-foreground-700 transition-colors"><i className={`text-xs ${showKey[model.id] ? "ri-eye-off-line" : "ri-eye-line"}`} /></button>
            </div>
            <button onClick={() => handleSaveKey(model.id, config.apiKeys[model.id] || "")} className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap border border-background-300/60 hover:border-foreground-500 text-foreground-700 hover:text-foreground-900">{saved === model.id ? <><i className="ri-check-line text-accent-500" />Saved</> : "Save"}</button>
          </div>
          <p className="text-[10px] text-foreground-500 mt-2 px-1">Get your key at <a href={model.docsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline cursor-pointer">{model.docsUrl}</a></p>
        </div>;
      })}
    </div>
  </div>;
}

function AccountTab({ userEmail }: { userEmail: string }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("creailty_display_name") || "");
  const [nameSaved, setNameSaved] = useState(false);
  const allProjects = getAllProjects();
  const projectCount = Object.keys(allProjects).length;
  const buildCount = Object.values(allProjects).reduce((sum, p) => sum + (p.versions?.length || 0), 0);
  const config = loadConfig();
  const activeModel = AVAILABLE_MODELS.find((m) => m.id === config.selectedModel);
  const displayLabel = displayName || userEmail?.split("@")[0] || "User";

  const handleSignOut = async () => { await signOut(); navigate("/auth", { replace: true }); };
  const handleSaveName = () => { localStorage.setItem("creailty_display_name", displayName.trim()); setNameSaved(true); setTimeout(() => setNameSaved(false), 2000); };
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeleting(true);
    try {
      localStorage.removeItem("creailty_model_config"); localStorage.removeItem("creailty_projects_v1"); localStorage.removeItem("creailty_display_name"); localStorage.removeItem("creailty_font_scale"); localStorage.removeItem("creaility_deploy_config");
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && key.startsWith("creailty_projects_v2_")) keysToRemove.push(key); }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      await signOut();
    } catch { setIsDeleting(false); }
  };

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
      <div className="grid grid-cols-4 gap-4 text-center">
        {[{ label: "Projects", value: String(projectCount) }, { label: "Builds", value: String(buildCount) }, { label: "Model", value: activeModel?.name || "None" }, { label: "Plan", value: "Free" }].map((stat) => <div key={stat.label}><p className="text-base font-bold text-foreground-900">{stat.value}</p><p className="text-xs text-foreground-500 mt-0.5">{stat.label}</p></div>)}
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

type FontScale = "small" | "medium" | "large";

function AppearanceTab() {
  const [fontScale, setFontScale] = useState<FontScale>(() => (localStorage.getItem("creailty_font_scale") as FontScale) || "medium");
  const applyFontScale = useCallback((scale: FontScale) => { setFontScale(scale); localStorage.setItem("creailty_font_scale", scale); const root = document.documentElement; root.classList.remove("font-scale-small", "font-scale-medium", "font-scale-large"); root.classList.add(`font-scale-${scale}`); }, []);
  useEffect(() => { const saved = (localStorage.getItem("creailty_font_scale") as FontScale) || "medium"; applyFontScale(saved); }, [applyFontScale]);
  const config = loadConfig();
  const keyCount = Object.values(config.apiKeys).filter((k) => k && k.trim().length > 0).length;

  return <div className="flex flex-col gap-8">
    <div><h2 className="text-base font-semibold text-foreground-900 mb-1">Appearance</h2><p className="text-sm text-foreground-500">Customize how CreAIlity looks and feels.</p></div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5">
      <p className="text-sm font-semibold text-foreground-800 mb-1">Font size</p><p className="text-xs text-foreground-500 mb-4">Adjust the base font size across the entire app.</p>
      <div className="flex items-center gap-2">
        {([{ id: "small" as FontScale, label: "Small", desc: "Compact" }, { id: "medium" as FontScale, label: "Medium", desc: "Default" }, { id: "large" as FontScale, label: "Large", desc: "Spacious" }]).map((opt) => <button key={opt.id} onClick={() => applyFontScale(opt.id)} className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all cursor-pointer ${fontScale === opt.id ? "border-foreground-400/50 bg-background-200/70 text-foreground-900" : "border-background-300/60 text-foreground-600 hover:border-foreground-500 hover:text-foreground-800"}`}><span className={`font-semibold ${opt.id === "small" ? "text-xs" : opt.id === "medium" ? "text-sm" : "text-base"}`}>{opt.label}</span><span className="text-[10px] text-foreground-500">{opt.desc}</span></button>)}
      </div>
    </div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5"><p className="text-sm font-semibold text-foreground-800 mb-4">Local storage</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3"><div className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-500/10 flex-shrink-0"><i className="ri-key-2-line text-accent-400 text-sm" /></div><div><p className="text-sm font-semibold text-foreground-800">{keyCount} / {AVAILABLE_MODELS.length}</p><p className="text-xs text-foreground-500">API keys stored</p></div></div>
        <div className="flex items-center gap-3"><div className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary-500/10 flex-shrink-0"><i className="ri-folder-line text-secondary-400 text-sm" /></div><div><p className="text-sm font-semibold text-foreground-800">{Object.keys(getAllProjects()).length}</p><p className="text-xs text-foreground-500">Saved projects</p></div></div>
      </div>
    </div>
  </div>;
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SettingsTab>("api-keys");
  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);
  if (loading || !user) return <div className="h-screen bg-background-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin" /></div>;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
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
      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <aside className="w-full md:w-48 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-20">
            {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2.5 text-sm px-3 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${tab === t.id ? "bg-background-200/70 text-foreground-900 font-medium" : "text-foreground-500 hover:text-foreground-800 hover:bg-background-200/40"}`}><div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className={`${t.icon} text-sm`} /></div>{t.label}</button>)}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {tab === "api-keys" && <ApiKeysTab />}
          {tab === "account" && <AccountTab userEmail={user.email || ""} />}
          {tab === "appearance" && <AppearanceTab />}
        </main>
      </div>
    </div>
  </div>;
}