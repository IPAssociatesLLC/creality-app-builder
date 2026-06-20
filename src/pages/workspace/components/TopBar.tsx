import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { ImportedFile, UserPlan } from "@/utils/projects-store";
import { supabase } from "@/lib/supabase";
import { buildSandboxHtml } from "@/utils/sandbox-bundler";


interface TopBarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  isBuilding: boolean;
  generatedCode: string | null;
  projectId: string | null;
  customDomain: string;
  onCustomDomainChange: (domain: string) => void;
  importedFiles?: ImportedFile[];
  userPlan?: UserPlan | null;
}

function DeployModal({ code, projectId, projectName, customDomain, onCustomDomainChange, onClose, importedFiles, userPlan }: {
  code: string;
  projectId: string | null;
  projectName: string;
  customDomain: string;
  onCustomDomainChange: (domain: string) => void;
  onClose: () => void;
  importedFiles?: ImportedFile[];
  userPlan?: UserPlan | null;
}) {
  const [deploying, setDeploying] = useState(false);
  const [done, setDone] = useState<{ url: string } | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [slugInput, setSlugInput] = useState(customDomain || projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, ""));
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const platformDomain = "crealityapp.com";
  const fullUrl = `https://${slugInput}.${platformDomain}`;

  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) { setSlugAvailable(null); return; }
    setCheckingSlug(true);
    let query = supabase
      .from("sandbox_deployments")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);

    if (projectId) {
      query = query.neq("project_id", projectId);
    }

    const { count, error } = await query;
    if (error) { setSlugAvailable(null); setCheckingSlug(false); return; }
    setSlugAvailable(count === 0);
    setCheckingSlug(false);
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (slugInput && slugInput !== (customDomain || projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, ""))) {
        checkSlugAvailability(slugInput);
      } else {
        setSlugAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [slugInput, checkSlugAvailability, customDomain, projectName]);

  const handleCopyUrl = (url?: string) => {
    const targetUrl = url || done?.url || fullUrl;
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handlePublish = async () => {
    setDeploying(true);
    setDeployError(null);
    setDone(null);

    const finalSlug = slugInput.trim() || projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
    onCustomDomainChange(finalSlug);

    try {
      try {
        await supabase.functions.invoke('deploy-worker', { body: { action: "setup" } });
      } catch (err) {
        console.warn("CreAIlity: deploy-worker setup skipped or failed. Proceeding to publish directly.", err);
      }

      let files = importedFiles && importedFiles.length > 0
        ? importedFiles
        : [{ name: "index.html", content: code, language: "html" }];

      // If project has React/TypeScript files, compile using in-browser builder
      const hasReactOrTs = files.some(f => f.name.endsWith(".tsx") || f.name.endsWith(".ts"));
      if (hasReactOrTs) {
        const bundle = buildSandboxHtml(files);
        if (bundle?.html) {
          files = [
            ...files.filter(f => f.name !== "index.html" && f.name !== "/index.html"),
            { name: "index.html", content: bundle.html, language: "html" }
          ];
        }
      }

      const { data: deployData, error: deployErr } = await supabase.functions.invoke('publish-sandbox', {
        body: {
          projectId,
          files: files.map(f => ({ name: f.name, content: f.content })),
          slug: finalSlug,
          projectName,
        },
      });
      if (deployErr) throw deployErr;
      setDone({ url: deployData.directUrl || deployData.url || fullUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Publish failed — please try again";
      setDeployError(msg);
    }
    setDeploying(false);
  };

  const handleDownload = () => {
    if (importedFiles && importedFiles.length > 0) {
      const indexHtml = importedFiles.find((f) => f.name === "index.html" || f.name.endsWith("/index.html"));
      if (indexHtml) {
        const blob = new Blob([`<!-- ${projectName} -->\n`, indexHtml.content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${slugInput}.html`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const allContent = importedFiles.map(f => `// ${f.name}\n${f.content}`).join("\n\n");
        const blob = new Blob([allContent], { type: "application/zip" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${slugInput}-bundle.zip`; a.click(); URL.revokeObjectURL(url);
      }
    } else {
      const blob = new Blob([code], { type: "text/html" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${slugInput}.html`; a.click(); URL.revokeObjectURL(url);
    }
  };

  const canDownload = userPlan?.tier === "pro" || userPlan?.tier === "byok";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-background-100 border border-background-300/60 rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground-900 mb-1">Publish your app</h3>
            <p className="text-xs text-foreground-500 leading-relaxed">Choose your sub-URL and publish to make your app live.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer text-foreground-500"><i className="ri-close-line text-sm" /></button>
        </div>

        {/* Editable sub-URL */}
        <div className="mb-5 rounded-xl border border-background-300/60 bg-background-200/30 p-4">
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-widest mb-2.5">Your App URL</p>
          <div className="flex items-center gap-1.5 bg-background-50 border border-background-300/60 rounded-xl px-3 py-2.5 mb-2 overflow-hidden">
            <i className="ri-global-line text-foreground-500 text-sm flex-shrink-0" />
            <div className="flex-1 flex items-center min-w-0">
              <span className="text-sm text-foreground-400 flex-shrink-0">https://</span>
              <input
                type="text"
                value={slugInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
                  setSlugInput(v);
                }}
                placeholder="my-app"
                className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-400 outline-none font-mono min-w-0 px-0.5"
              />
              <span className="text-sm text-foreground-400 flex-shrink-0 whitespace-nowrap">.{platformDomain}</span>
            </div>
            <button onClick={() => {
              const input = prompt("Edit your sub-URL:", slugInput);
              if (input !== null) {
                const v = input.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
                setSlugInput(v);
              }
            }} className="flex-shrink-0 cursor-pointer text-foreground-500 hover:text-foreground-700 ml-0.5" title="Edit URL">
              <i className="ri-pencil-line text-sm" />
            </button>
            <button onClick={() => handleCopyUrl(fullUrl)} className="flex-shrink-0 cursor-pointer ml-0.5">
              <i className={`text-sm transition-colors ${urlCopied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500 hover:text-foreground-700"}`} />
            </button>
          </div>
          {checkingSlug && <p className="text-[10px] text-foreground-500">Checking availability...</p>}
          {!checkingSlug && slugAvailable === true && <p className="text-[10px] text-green-500 font-medium flex items-center gap-1"><i className="ri-check-line text-[10px]" />Available</p>}
          {!checkingSlug && slugAvailable === false && <p className="text-[10px] text-amber-500 font-medium flex items-center gap-1"><i className="ri-close-line text-[10px]" />Already taken — try another</p>}
          {!checkingSlug && slugAvailable === null && slugInput.length >= 3 && slugInput !== (customDomain || projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "")) && (
            <p className="text-[10px] text-foreground-400">Type to check availability</p>
          )}
        </div>

        {/* Success state with share */}
        {done && (
          <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
            <div className="flex items-center gap-2 mb-3"><i className="ri-check-double-line text-green-400 text-sm" /><span className="text-xs font-semibold text-green-400">Published successfully!</span></div>
            <div className="flex items-center gap-2 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2 mb-3">
              <span className="text-xs text-foreground-500 font-mono truncate flex-1">{done.url}</span>
              <button onClick={() => handleCopyUrl(done.url)} className="flex-shrink-0 cursor-pointer"><i className={`text-xs ${urlCopied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500"}`} /></button>
              <a href={done.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 cursor-pointer"><i className="ri-external-link-line text-foreground-500 hover:text-foreground-700 text-xs" /></a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-foreground-500 uppercase tracking-widest">Share:</span>
              <button onClick={() => handleCopyUrl(done.url)} className="flex items-center gap-1 text-[10px] text-foreground-600 bg-background-50 border border-background-300/60 rounded-lg px-2.5 py-1 hover:text-foreground-800 hover:border-foreground-500 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-clipboard-line text-[10px]" />Copy link
              </button>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(done.url)}&text=${encodeURIComponent('Check out my app built with CreAIlity!')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-foreground-600 bg-background-50 border border-background-300/60 rounded-lg px-2.5 py-1 hover:text-foreground-800 hover:border-foreground-500 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-twitter-x-line text-[10px]" />Share
              </a>
              <a href={done.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-foreground-600 bg-background-50 border border-background-300/60 rounded-lg px-2.5 py-1 hover:text-foreground-800 hover:border-foreground-500 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-external-link-line text-[10px]" />Open
              </a>
            </div>
          </div>
        )}

        {deployError && (
          <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5">
            <div className="flex items-start gap-2"><i className="ri-error-warning-line text-amber-500 text-xs mt-0.5 flex-shrink-0" /><p className="text-xs text-amber-600 leading-relaxed">{deployError}</p></div>
          </div>
        )}

        {/* Publish button */}
        <button
          onClick={handlePublish}
          disabled={!!deploying}
          className="w-full flex items-center justify-center gap-3 bg-orange-500 text-white border border-orange-500 rounded-xl px-4 py-3.5 hover:bg-orange-600 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed font-semibold shadow-sm"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {deploying ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : done ? (
              <i className="ri-check-line text-white text-sm" />
            ) : (
              <i className="ri-rocket-2-line text-white text-sm" />
            )}
          </div>
          <span className="text-sm">{deploying ? "Publishing..." : done ? "Published" : "Publish"}</span>
        </button>

        {/* Download — permission gated */}
        <div className="mt-4 flex items-center gap-3"><div className="flex-1 h-px bg-background-300/30" /><span className="text-[10px] text-foreground-600">or</span><div className="flex-1 h-px bg-background-300/30" /></div>
        <div className="mt-3">
          {canDownload ? (
            <button onClick={handleDownload} className="w-full text-xs text-foreground-600 border border-background-300/60 rounded-xl px-3 py-2.5 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2">
              <i className="ri-download-2-line text-xs" />Download files
            </button>
          ) : (
            <div className="text-center">
              <span className="text-xs text-foreground-400 flex items-center justify-center gap-1.5">
                <i className="ri-lock-line text-[10px]" />Download files — <a href="/pricing" className="text-orange-500 hover:text-orange-400 underline cursor-pointer">Pro plan</a>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TopBar({ projectName, onProjectNameChange, isBuilding, generatedCode, projectId, customDomain, onCustomDomainChange, importedFiles, userPlan }: TopBarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);
  const [showShare, setShowShare] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const subUrl = `${slug}.crealityapp.com`;
  const previewUrl = `https://${subUrl}`;

  const handleNameBlur = () => { setEditing(false); if (nameInput.trim()) onProjectNameChange(nameInput.trim()); else setNameInput(projectName); };
  const handleCopy = () => { navigator.clipboard.writeText(previewUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleLogout = async () => { await signOut(); navigate("/auth", { replace: true }); };

  useEffect(() => {
    if (!user) return;
    supabase.from("user_plans").select("is_admin").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.is_admin) setIsAdmin(true);
    }).catch(() => {});
  }, [user]);

  return (
    <>
      <header className="h-12 flex items-center justify-between px-2 md:px-4 border-b border-background-200 bg-background-50 flex-shrink-0 z-30 gap-1">
        <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1">
          <a href="/" className="flex items-center flex-shrink-0 cursor-pointer">
            <img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-6 md:h-7 w-auto object-contain" />
          </a>
          <span className="text-foreground-600 text-sm hidden md:inline">/</span>
          {editing ? (
            <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} onBlur={handleNameBlur} onKeyDown={(e) => e.key === "Enter" && handleNameBlur()} className="text-xs md:text-sm font-medium text-foreground-800 bg-background-100 border border-background-300/60 rounded-md px-2 py-0.5 outline-none w-28 md:w-44" />
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs md:text-sm font-medium text-foreground-800 hover:text-foreground-950 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap truncate max-w-[100px] md:max-w-none">{projectName}<i className="ri-pencil-line text-foreground-500 text-[10px] md:text-xs flex-shrink-0" /></button>
          )}
          {isBuilding && <div className="flex items-center gap-1 text-[10px] md:text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 md:px-2.5 py-0.5 flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" /><span className="hidden md:inline">Building...</span></div>}
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <div className="relative">
            <button onClick={() => setShowShare(!showShare)} className="flex items-center gap-1 text-xs md:text-sm text-foreground-600 border border-foreground-400/30 rounded-lg px-2 md:px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-share-line text-xs md:text-sm" /><span className="hidden sm:inline">Share</span></button>
            {showShare && (
              <div className="absolute right-0 top-10 bg-background-100 border border-background-300/60 rounded-xl p-4 w-80 z-50">
                <p className="text-xs font-semibold text-foreground-800 mb-3">Share your app</p>
                <div><p className="text-[10px] text-foreground-500 uppercase tracking-widest mb-1.5">Live URL</p>
                  <div className="flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-lg px-3 py-2">
                    <i className="ri-global-line text-foreground-500 text-xs flex-shrink-0" /><span className="text-xs text-foreground-500 truncate flex-1 font-mono">{subUrl}</span>
                    <button onClick={handleCopy} className="flex-shrink-0 cursor-pointer"><i className={`text-xs ${copied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500"}`} /></button>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 cursor-pointer"><i className="ri-external-link-line text-foreground-500 hover:text-foreground-700 text-xs" /></a>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => (generatedCode || (importedFiles && importedFiles.length > 0)) ? setShowDeploy(true) : undefined}
            disabled={!generatedCode && (!importedFiles || importedFiles.length === 0)}
            className={`flex items-center gap-1 md:gap-1.5 text-xs md:text-sm font-medium rounded-lg px-2 md:px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${generatedCode || (importedFiles && importedFiles.length > 0) ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-background-200/50 text-foreground-600 cursor-not-allowed"}`}
            title={generatedCode || (importedFiles && importedFiles.length > 0) ? "Publish your app" : "Generate or import an app first"}>
            <i className="ri-rocket-line text-xs md:text-sm" /><span className="hidden sm:inline">Publish</span>
          </button>

          {user && (
            <div className="relative ml-1">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-7 h-7 flex items-center justify-center rounded-full bg-background-200/60 hover:bg-background-300/60 transition-colors cursor-pointer" title={user.email}>
                <span className="text-xs font-semibold text-foreground-700">{user.email?.charAt(0).toUpperCase() || "U"}</span>
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-9 z-50 w-56 bg-background-100 border border-background-300/60 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-background-200/60"><p className="text-xs font-medium text-foreground-800 truncate">{user.email}</p><p className="text-[10px] text-foreground-500 mt-0.5">Signed in</p></div>
                    <div className="p-1.5">
                      {isAdmin && (
                        <button onClick={() => { setShowUserMenu(false); navigate("/admin"); }} className="w-full flex items-center gap-2 text-xs text-foreground-600 hover:text-foreground-800 hover:bg-background-200/60 rounded-lg px-3 py-2 transition-colors cursor-pointer"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-shield-keyhole-line text-sm" /></div>Admin Panel</button>
                      )}
                      <button onClick={() => { setShowUserMenu(false); navigate("/settings"); }} className="w-full flex items-center gap-2 text-xs text-foreground-600 hover:text-foreground-800 hover:bg-background-200/60 rounded-lg px-3 py-2 transition-colors cursor-pointer"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-settings-3-line text-sm" /></div>Settings & API Keys</button>
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 text-xs text-foreground-600 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg px-3 py-2 transition-colors cursor-pointer"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-line text-sm" /></div>Sign out</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {showDeploy && (generatedCode || (importedFiles && importedFiles.length > 0)) && (
        <DeployModal code={generatedCode || ""} projectId={projectId} projectName={projectName} customDomain={customDomain} onCustomDomainChange={onCustomDomainChange} onClose={() => setShowDeploy(false)} importedFiles={importedFiles} userPlan={userPlan} />
      )}
    </>
  );
}