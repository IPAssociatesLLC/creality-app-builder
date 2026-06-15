import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import type { ImportedFile } from "@/utils/projects-store";

interface TopBarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  isBuilding: boolean;
  generatedCode: string | null;
  projectId: string | null;
  customDomain: string;
  onCustomDomainChange: (domain: string) => void;
  importedFiles?: ImportedFile[];
}

type DeployTarget = "vercel" | "netlify";

interface DeployConfig {
  vercelToken: string;
  netlifyToken: string;
}

function loadDeployConfig(): DeployConfig {
  try {
    const raw = localStorage.getItem("creaility_deploy_config");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const platformVercel = import.meta.env.VITE_VERCEL_API_TOKEN || "";
  return { vercelToken: platformVercel, netlifyToken: "" };
}

function saveDeployConfig(cfg: DeployConfig) {
  localStorage.setItem("creaility_deploy_config", JSON.stringify(cfg));
}

interface DeployModalProps {
  code: string;
  projectId: string | null;
  projectName: string;
  customDomain: string;
  onCustomDomainChange: (domain: string) => void;
  onClose: () => void;
  importedFiles?: ImportedFile[];
}

function DeployModal({ code, projectId, projectName, customDomain, onCustomDomainChange, onClose, importedFiles }: DeployModalProps) {
  const [deployConfig, setDeployConfig] = useState<DeployConfig>(loadDeployConfig);
  const [deploying, setDeploying] = useState<DeployTarget | null>(null);
  const [done, setDone] = useState<{ target: DeployTarget; url: string } | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState<DeployTarget | null>(null);
  const [tempKey, setTempKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const platformDomain = "crealityapp.com";
  const subUrl = `${slug}.${platformDomain}`;

  const basePath = __BASE_PATH__.split("/").filter(Boolean).join("/");
  const pathPrefix = basePath ? `/${basePath}` : "";
  const previewUrl = projectId ? `${window.location.origin}${pathPrefix}/preview/${projectId}` : null;

  const handleCopyUrl = (url?: string) => {
    const targetUrl = url || done?.url || previewUrl;
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handleSaveKey = (target: DeployTarget) => {
    if (!tempKey.trim()) return;
    const updated = { ...deployConfig };
    if (target === "vercel") updated.vercelToken = tempKey.trim();
    else updated.netlifyToken = tempKey.trim();
    setDeployConfig(updated);
    saveDeployConfig(updated);
    setKeySaved(true);
    setTimeout(() => { setKeySaved(false); setShowKeyInput(null); }, 1500);
  };

  const handleRemoveKey = (target: DeployTarget) => {
    const updated = { ...deployConfig };
    if (target === "vercel") updated.vercelToken = "";
    else updated.netlifyToken = "";
    setDeployConfig(updated);
    saveDeployConfig(updated);
  };

  const handleDeploy = async (target: DeployTarget) => {
    const token = target === "vercel" ? deployConfig.vercelToken : deployConfig.netlifyToken;
    if (!token) { setShowKeyInput(target); setTempKey(""); return; }
    setDeploying(target);
    setDeployError(null);
    setDone(null);
    try {
      const hasMultiFile = importedFiles && importedFiles.length > 0;
      if (target === "vercel") {
        const url = hasMultiFile ? await deployToVercelMultiFile(token, projectName, importedFiles!) : await deployToVercel(token, projectName, code);
        setDone({ target: "vercel", url });
      } else {
        const url = hasMultiFile ? await deployToNetlifyMultiFile(token, projectName, importedFiles!) : await deployToNetlify(token, projectName, code);
        setDone({ target: "netlify", url });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deploy failed. Check your API key and try again.";
      setDeployError(msg);
    }
    setDeploying(null);
  };

  const handleManualDeploy = (target: DeployTarget) => {
    downloadProjectZip(projectName, importedFiles || [], code, slug);
    if (target === "vercel") window.open("https://vercel.com/new", "_blank", "noopener,noreferrer");
    else window.open("https://app.netlify.com/drop", "_blank", "noopener,noreferrer");
  };

  const handleSaveDomain = () => {
    onCustomDomainChange(slug);
    setDomainSaved(true);
    setTimeout(() => setDomainSaved(false), 2000);
  };

  const hasVercelKey = !!deployConfig.vercelToken;
  const hasNetlifyKey = !!deployConfig.netlifyToken;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-background-100 border border-background-300/60 rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground-900 mb-1">Deploy &amp; share</h3>
            <p className="text-xs text-foreground-500 leading-relaxed">One-click deploy to Vercel or Netlify with your API token, or share a preview link.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer text-foreground-500"><i className="ri-close-line text-sm" /></button>
        </div>

        <div className="mb-5 rounded-xl border border-background-300/60 bg-background-200/30 p-4">
          <p className="text-xs font-semibold text-foreground-500 uppercase tracking-widest mb-2.5">Your App URL</p>
          <div className="flex items-center gap-2 bg-background-100 border border-background-300/60 rounded-xl px-3 py-2.5 mb-2">
            <i className="ri-global-line text-accent-400 text-sm flex-shrink-0" />
            <span className="text-sm text-foreground-800 font-mono font-semibold">{subUrl}</span>
            <button onClick={() => handleCopyUrl(`https://${subUrl}`)} className="flex-shrink-0 cursor-pointer ml-auto">
              <i className={`text-sm transition-colors ${urlCopied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500 hover:text-foreground-700"}`} />
            </button>
          </div>
          <p className="text-[10px] text-foreground-500 leading-relaxed">After deploying to Vercel, your app will be live at <strong className="text-foreground-600">{subUrl}</strong>.</p>
        </div>

        {done && (
          <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
            <div className="flex items-center gap-2 mb-2"><i className="ri-check-double-line text-green-400 text-sm" /><span className="text-xs font-semibold text-green-400">Deployed successfully!</span></div>
            <div className="flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-lg px-3 py-2 mb-2">
              <span className="text-xs text-foreground-500 font-mono truncate flex-1">{done.url}</span>
              <button onClick={() => handleCopyUrl(done.url)} className="flex-shrink-0 cursor-pointer"><i className={`text-xs ${urlCopied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500"}`} /></button>
              <a href={done.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 cursor-pointer"><i className="ri-external-link-line text-foreground-500 hover:text-foreground-700 text-xs" /></a>
            </div>
          </div>
        )}

        {deployError && (
          <div className="mb-5 rounded-xl border border-accent-500/20 bg-accent-500/10 p-3.5">
            <div className="flex items-start gap-2"><i className="ri-error-warning-line text-accent-400 text-xs mt-0.5 flex-shrink-0" /><p className="text-xs text-accent-400 leading-relaxed">{deployError}</p></div>
          </div>
        )}

        {previewUrl && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-foreground-500 uppercase tracking-widest mb-2">Shareable Preview</p>
            <div className="flex items-center gap-2 bg-background-200/40 border border-background-300/60 rounded-xl px-3 py-2.5">
              <i className="ri-external-link-line text-accent-400 text-xs flex-shrink-0" />
              <span className="text-xs text-foreground-700 font-mono flex-1 truncate">{previewUrl}</span>
              <button onClick={() => handleCopyUrl(previewUrl)} className="flex-shrink-0 cursor-pointer"><i className={`text-sm transition-colors ${urlCopied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500 hover:text-foreground-700"}`} /></button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-background-300/50" /><span className="text-[10px] text-foreground-600 uppercase tracking-widest">deploy to</span><div className="flex-1 h-px bg-background-300/50" /></div>

        <div className="flex flex-col gap-2.5">
          <button onClick={() => handleDeploy("vercel")} disabled={!!deploying} className="flex items-center gap-4 bg-background-200/40 border border-background-300/60 rounded-xl px-4 py-3.5 hover:border-foreground-500/60 hover:bg-background-200/60 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-left">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-black border border-background-400/30 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 76 65" fill="white"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" /></svg>
            </div>
            <div className="flex-1"><div className="text-sm font-semibold text-foreground-900">{hasVercelKey ? "Deploy to Vercel" : "Setup Vercel Deploy"}</div><div className="text-xs text-foreground-500 mt-0.5">{hasVercelKey ? `Live at ${subUrl}` : "Add your Vercel token above"}</div></div>
            <div className="w-5 h-5 flex items-center justify-center">{deploying === "vercel" ? <div className="w-4 h-4 border-2 border-foreground-500 border-t-foreground-200 rounded-full animate-spin" /> : done?.target === "vercel" ? <i className="ri-check-line text-green-400 text-sm" /> : <i className="ri-arrow-right-line text-foreground-500 text-sm" />}</div>
          </button>
          <button onClick={() => handleDeploy("netlify")} disabled={!!deploying} className="flex items-center gap-4 bg-background-200/40 border border-background-300/60 rounded-xl px-4 py-3.5 hover:border-foreground-500/60 hover:bg-background-200/60 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-left">
            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#00AD9F] flex-shrink-0"><i className="ri-cloud-line text-white text-lg" /></div>
            <div className="flex-1"><div className="text-sm font-semibold text-foreground-900">{hasNetlifyKey ? "Deploy to Netlify" : "Setup Netlify Deploy"}</div><div className="text-xs text-foreground-500 mt-0.5">{hasNetlifyKey ? "One-click deploy via Netlify API" : "Add your Netlify token above"}</div></div>
            <div className="w-5 h-5 flex items-center justify-center">{deploying === "netlify" ? <div className="w-4 h-4 border-2 border-foreground-500 border-t-foreground-200 rounded-full animate-spin" /> : done?.target === "netlify" ? <i className="ri-check-line text-green-400 text-sm" /> : <i className="ri-arrow-right-line text-foreground-500 text-sm" />}</div>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3"><div className="flex-1 h-px bg-background-300/30" /><span className="text-[10px] text-foreground-600">or</span><div className="flex-1 h-px bg-background-300/30" /></div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => handleManualDeploy("vercel")} className="flex-1 text-xs text-foreground-600 border border-background-300/60 rounded-xl px-3 py-2 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap">Download + Vercel</button>
          <button onClick={() => handleManualDeploy("netlify")} className="flex-1 text-xs text-foreground-600 border border-background-300/60 rounded-xl px-3 py-2 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap">Download + Netlify</button>
        </div>
      </div>
    </div>
  );
}

// ... deploy functions (inline for brevity) ...
async function deployToVercel(token: string, projectName: string, code: string): Promise<string> {
  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const fileBase64 = btoa(unescape(encodeURIComponent(code)));
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: slug, files: [{ file: "index.html", data: fileBase64 }], projectSettings: { framework: null }, target: "production", alias: [`${slug}.crealityapp.com`] }),
  });
  if (!res.ok) { const err = await res.text(); let msg = `Vercel returned ${res.status}`; try { const parsed = JSON.parse(err); msg = parsed.error?.message as string || msg; } catch { /* raw text */ } throw new Error(msg); }
  const data = await res.json();
  if (data.alias && data.alias.length > 0) {
    const ca = data.alias.find((a: string) => a.endsWith(".crealityapp.com"));
    return ca ? `https://${ca}` : `https://${data.alias[0]}`;
  }
  const deployUrl = data.url || `https://${slug}.vercel.app`;
  return deployUrl.startsWith("http") ? deployUrl : `https://${deployUrl}`;
}

async function deployToVercelMultiFile(token: string, projectName: string, files: ImportedFile[]): Promise<string> {
  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const vercelFiles = files.map((f) => { const e = new TextEncoder(); const bytes = e.encode(f.content); let b = ""; for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]); return { file: f.name, data: btoa(b) }; });
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: slug, files: vercelFiles, projectSettings: { framework: "vite" }, target: "production", alias: [`${slug}.crealityapp.com`] }),
  });
  if (!res.ok) { const err = await res.text(); let msg = `Vercel returned ${res.status}`; try { const parsed = JSON.parse(err); msg = parsed.error?.message as string || msg; } catch { /* raw text */ } throw new Error(msg); }
  const data = await res.json();
  if (data.alias && data.alias.length > 0) {
    const ca = data.alias.find((a: string) => a.endsWith(".crealityapp.com"));
    return ca ? `https://${ca}` : `https://${data.alias[0]}`;
  }
  return data.url?.startsWith("http") ? data.url : `https://${data.url || `${slug}.vercel.app`}`;
}

async function deployToNetlify(token: string, projectName: string, code: string): Promise<string> {
  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const siteRes = await fetch("https://api.netlify.com/api/v1/sites", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: `creaility-${slug}-${Date.now().toString(36)}` }) });
  if (!siteRes.ok) { const err = await siteRes.text(); let msg = `Netlify create site failed (${siteRes.status})`; try { const p = JSON.parse(err); msg = p.message || msg; } catch { /* raw text */ } throw new Error(msg); }
  const siteData = await siteRes.json();
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ files: { "/index.html": code }, draft: false }) });
  if (!deployRes.ok) { const err = await deployRes.text(); let msg = `Netlify deploy failed (${deployRes.status})`; try { const p = JSON.parse(err); msg = p.message || msg; } catch { /* raw text */ } throw new Error(msg); }
  const deployData = await deployRes.json();
  return deployData.ssl_url || deployData.url || `https://${siteData.default_domain}`;
}

async function deployToNetlifyMultiFile(token: string, projectName: string, files: ImportedFile[]): Promise<string> {
  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const siteRes = await fetch("https://api.netlify.com/api/v1/sites", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: `creaility-${slug}-${Date.now().toString(36)}` }) });
  if (!siteRes.ok) { const err = await siteRes.text(); const msg = `Netlify create site failed`; try { const p = JSON.parse(err); throw new Error(p.message || msg); } catch (e) { throw e instanceof Error ? e : new Error(msg); } }
  const siteData = await siteRes.json();
  const nf: Record<string, string> = {};
  for (const f of files) nf[`/${f.name}`] = f.content;
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ files: nf, draft: false }) });
  if (!deployRes.ok) { const err = await deployRes.text(); const msg = `Netlify deploy failed`; try { const p = JSON.parse(err); throw new Error(p.message || msg); } catch (e) { throw e instanceof Error ? e : new Error(msg); } }
  const deployData = await deployRes.json();
  return deployData.ssl_url || deployData.url || `https://${siteData.default_domain}`;
}

function downloadProjectZip(projectName: string, files: ImportedFile[], code: string, slug: string): void {
  if (files.length > 0) {
    const indexHtml = files.find((f) => f.name === "index.html" || f.name.endsWith("/index.html"));
    if (indexHtml) {
      const blob = new Blob([`<!-- ${projectName} -->\n`, indexHtml.content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${slug}.html`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([files.map(f => `// ${f.name}\n${f.content}`).join("\n\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${slug}-bundle.txt`; a.click(); URL.revokeObjectURL(url);
    }
  } else {
    const blob = new Blob([code], { type: "text/html" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${slug}.html`; a.click(); URL.revokeObjectURL(url);
  }
}

export default function TopBar({ projectName, onProjectNameChange, isBuilding, generatedCode, projectId, customDomain, onCustomDomainChange, importedFiles }: TopBarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(projectName);
  const [showShare, setShowShare] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const basePath = __BASE_PATH__.split("/").filter(Boolean).join("/");
  const pathPrefix = basePath ? `/${basePath}` : "";
  const previewUrl = projectId ? `${window.location.origin}${pathPrefix}/preview/${projectId}` : null;
  const slug = projectName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const subUrl = `${slug}.crealityapp.com`;

  const handleNameBlur = () => { setEditing(false); if (nameInput.trim()) onProjectNameChange(nameInput.trim()); else setNameInput(projectName); };
  const handleCopy = () => { const url = previewUrl || `${window.location.origin}${pathPrefix}/preview/demo`; navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleLogout = async () => { await signOut(); navigate("/auth", { replace: true }); };

  return (
    <>
      <header className="h-12 flex items-center justify-between px-4 border-b border-background-200 bg-background-50 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center flex-shrink-0 cursor-pointer">
            <img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-7 w-auto object-contain" />
          </a>
          <span className="text-foreground-600 text-sm">/</span>
          {editing ? (
            <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} onBlur={handleNameBlur} onKeyDown={(e) => e.key === "Enter" && handleNameBlur()} className="text-sm font-medium text-foreground-800 bg-background-100 border border-background-300/60 rounded-md px-2 py-0.5 outline-none w-44" />
          ) : (
            <button onClick={() => setEditing(true)} className="text-sm font-medium text-foreground-800 hover:text-foreground-950 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap">{projectName}<i className="ri-pencil-line text-foreground-500 text-xs" /></button>
          )}
          {isBuilding && <div className="flex items-center gap-1.5 text-xs text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-full px-2.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse inline-block" />Building...</div>}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowShare(!showShare)} className="flex items-center gap-1.5 text-sm text-foreground-600 border border-foreground-400/30 rounded-lg px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-share-line text-sm" /><span className="hidden sm:inline">Share</span></button>
            {showShare && (
              <div className="absolute right-0 top-10 bg-background-100 border border-background-300/60 rounded-xl p-4 w-80 z-50">
                <p className="text-xs font-semibold text-foreground-800 mb-3">Share your app</p>
                <div className="mb-3"><p className="text-[10px] text-foreground-500 uppercase tracking-widest mb-1.5">Deploy URL</p>
                  <div className="flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-lg px-3 py-2">
                    <i className="ri-global-line text-accent-400 text-xs flex-shrink-0" /><span className="text-xs text-foreground-500 truncate flex-1 font-mono">{subUrl}</span>
                    <button onClick={() => { navigator.clipboard.writeText(`https://${subUrl}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex-shrink-0 cursor-pointer"><i className={`text-xs ${copied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500"}`} /></button>
                  </div>
                </div>
                <div><p className="text-[10px] text-foreground-500 uppercase tracking-widest mb-1.5">Preview link</p>
                  <div className="flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-lg px-3 py-2">
                    <i className="ri-link text-foreground-500 text-xs flex-shrink-0" /><span className="text-xs text-foreground-500 truncate flex-1 font-mono">{previewUrl ? previewUrl.replace(/^https?:\/\/[^/]+/, "") : "/preview/—"}</span>
                    <button onClick={handleCopy} className="flex-shrink-0 cursor-pointer"><i className={`text-xs ${copied ? "ri-check-line text-green-400" : "ri-clipboard-line text-foreground-500"}`} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => (generatedCode || (importedFiles && importedFiles.length > 0)) ? setShowDeploy(true) : undefined}
            disabled={!generatedCode && (!importedFiles || importedFiles.length === 0)}
            className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${generatedCode || (importedFiles && importedFiles.length > 0) ? "bg-foreground-50 text-background-950 hover:bg-foreground-100" : "bg-background-200/50 text-foreground-600 cursor-not-allowed"}`}
            title={generatedCode || (importedFiles && importedFiles.length > 0) ? "Deploy your app" : "Generate or import an app first"}>
            <i className="ri-rocket-line text-sm" /><span className="hidden sm:inline">Deploy</span>
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
                      <button onClick={() => { setShowUserMenu(false); navigate("/settings"); }} className="w-full flex items-center gap-2 text-xs text-foreground-600 hover:text-foreground-800 hover:bg-background-200/60 rounded-lg px-3 py-2 transition-colors cursor-pointer"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-settings-3-line text-sm" /></div>Settings & API Keys</button>
                      <button onClick={handleLogout} className="w-full flex items-center gap-2 text-xs text-foreground-600 hover:text-accent-500 hover:bg-accent-500/10 rounded-lg px-3 py-2 transition-colors cursor-pointer"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-logout-box-line text-sm" /></div>Sign out</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {showDeploy && (generatedCode || (importedFiles && importedFiles.length > 0)) && (
        <DeployModal code={generatedCode || ""} projectId={projectId} projectName={projectName} customDomain={customDomain} onCustomDomainChange={onCustomDomainChange} onClose={() => setShowDeploy(false)} importedFiles={importedFiles} />
      )}
    </>
  );
}