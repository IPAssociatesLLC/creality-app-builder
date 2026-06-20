import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import PreviewPanel from "./components/PreviewPanel";
import GitHubModal from "./components/GitHubModal";
import UploadModal from "./components/UploadModal";
import ModelSelector from "./components/ModelSelector";
import {
  createProject,
  loadProject,
  listProjects,
  saveProject,
  saveVersion,
  restoreVersion,
  getOrCreateConversation,
  countUserProjects,
  getUserPlan,
  buildProjectContext,
  type Project,
  type ImportedFile,
  type UserPlan,
} from "@/utils/projects-store";
import type { ConversationMessage, BuildMode } from "@/utils/ai-api";
import { buildSandboxHtml } from "@/utils/sandbox-bundler";

type ActivePanel = "chat" | "preview" | "both";

export default function WorkspacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("both");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>("");
  const [viewingVersionCode, setViewingVersionCode] = useState<string | null>(null);
  const [activeViewingFile, setActiveViewingFile] = useState<string | null>(null);
  const [chatPanelWidth, setChatPanelWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobilePreviewActive, setMobilePreviewActive] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [projectLimitModal, setProjectLimitModal] = useState(false);
  const mainAreaRef = useRef<HTMLDivElement>(null);

  const sandboxHtml = useMemo(() => {
    if (!project?.importedFiles || project.importedFiles.length === 0) return null;
    const result = buildSandboxHtml(project.importedFiles);
    return result?.html ?? null;
  }, [project?.importedFiles]);

  const projectContext = useMemo(() => {
    if (!project) return "";
    return buildProjectContext(project.importedFiles || [], project.generatedCode);
  }, [project?.importedFiles, project?.generatedCode]);

  const hasSandbox = sandboxHtml !== null;


  const idFromUrl = searchParams.get("id");

  // Guard against duplicate project creation on re-render after navigate
  const initStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // If we already have the matching project loaded in state, skip re-init
      if (idFromUrl && project && project.id === idFromUrl && !loadingProject) {
        setLoadingProject(false);
        return;
      }

      setLoadingProject(true);

      try {
        // Load user plan (never throws)
        const plan = await getUserPlan().catch(() => null);
        if (!cancelled) setUserPlan(plan);

        if (idFromUrl) {
          // Load specific project by ID
          const existing = await loadProject(idFromUrl).catch(() => null);
          if (!cancelled && existing) {
            setProject(existing);
            setViewingVersionCode(null);
            setLastUserPrompt("");
            if (existing.generatedCode) {
              setActiveViewingFile("generated");
            } else if (existing.importedFiles && existing.importedFiles.length > 0) {
              setActiveViewingFile(existing.importedFiles[0].name);
            } else {
              setActiveViewingFile(null);
            }
            // Wire up conversation persistence — never block on this
            getOrCreateConversation(existing.id).then((cid) => {
              if (!cancelled) setConversationId(cid);
            }).catch(() => {});
            setLoadingProject(false);
            return;
          }
          // ID in URL but project not found in Supabase
          if (project && project.id === idFromUrl) {
            setLoadingProject(false);
            return;
          }
          // Project not found — clear URL and show empty state
          setProject(null);
          navigate("/workspace", { replace: true });
          setLoadingProject(false);
          return;
        }

        // No ID in URL: load the user's most recent project
        const recentProjects = await listProjects().catch(() => []);
        if (!cancelled && recentProjects.length > 0) {
          const most = recentProjects[0];
          // Redirect to the most recent project
          navigate(`/workspace?id=${most.id}`, { replace: true });
          // The URL change will re-trigger this effect
          setLoadingProject(false);
          return;
        }

        // User has zero projects — show empty state, DO NOT auto-create
        if (!cancelled) {
          setProject(null);
          setLoadingProject(false);
        }
      } catch (err) {
        console.error("Workspace init error:", err);
        if (!cancelled) setLoadingProject(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [idFromUrl]);

  const persistProject = useCallback(
    (updates: Partial<Project>) => {
      setProject((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...updates };
        // Fire and forget save to Supabase to prevent blocking UI
        saveProject(updated).catch(console.error);
        return updated;
      });
    },
    []
  );

  const handleProjectNameChange = (name: string) => {
    persistProject({ name });
  };

  const handleCustomDomainChange = (domain: string) => {
    persistProject({ customDomain: domain });
  };

  const handleCodeGenerated = async (code: string) => {
    if (!project) return;
    const label = lastUserPrompt
      ? lastUserPrompt.slice(0, 60)
      : "Initial build";
    if (project.generatedCode !== code) {
      await saveVersion(project.id, code, label, lastUserPrompt || "Build");
    }
    const cached = await loadProject(project.id);
    if (cached) {
      cached.generatedCode = code;
      await saveProject(cached);
      setProject({ ...cached });
      setViewingVersionCode(null);
      setActiveViewingFile("generated");
    }
  };

  const handleConversationUpdate = (history: ConversationMessage[]) => {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (lastUser) {
      setLastUserPrompt(lastUser.content);
    }
    persistProject({ conversationHistory: history });
  };

  const handleNewProject = async () => {
    // Check project limits
    if (userPlan && userPlan.tier === "free") {
      const projectCount = await countUserProjects();
      if (projectCount >= userPlan.projectsLimit) {
        setProjectLimitModal(true);
        return;
      }
    }
    const fresh = await createProject("New Project");
    setProject(fresh);
    setViewingVersionCode(null);
    setLastUserPrompt("");
    setActiveViewingFile(null);
    navigate(`/workspace?id=${fresh.id}`, { replace: true });
    getOrCreateConversation(fresh.id).then(setConversationId).catch(() => {});
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!project) return;
    const restored = await restoreVersion(project.id, versionId);
    if (restored) {
      setProject(restored);
      setViewingVersionCode(null);
    }
  };

  const handlePreviewVersion = (versionId: string) => {
    if (!project) return;
    const version = project.versions.find((v) => v.id === versionId);
    if (version) {
      setViewingVersionCode(version.code);
    }
  };

  const handleClearVersionPreview = () => {
    setViewingVersionCode(null);
  };

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!mainAreaRef.current) return;
      const containerRect = mainAreaRef.current.getBoundingClientRect();
      const sidebarWidth = sidebarOpen ? 208 : 0;
      const newWidth = e.clientX - containerRect.left - sidebarWidth;
      setChatPanelWidth(Math.max(260, Math.min(700, newWidth)));
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, sidebarOpen]);

  const handleSharePreview = useCallback(() => {
    if (!project) return;
    const url = `${window.location.origin}/preview/${project.id}`;
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [project]);

  const handleFileSelect = (file: ImportedFile) => {
    setActiveViewingFile(file.name);
    setViewingVersionCode(null);
  };

  const handleShowGenerated = () => {
    setActiveViewingFile("generated");
    setViewingVersionCode(null);
  };

  const handleImportFromGitHub = async (
    repo: string,
    files?: { name: string; content: string; language: string }[]
  ) => {
    if (!project || !files || files.length === 0) return;
    const label = `Import from GitHub: ${repo}`;
    await saveVersion(project.id, JSON.stringify(files), label, `GitHub import: ${repo}`);

    const freshProject = await loadProject(project.id);
    if (!freshProject) return;

    freshProject.importedFiles = files;
    freshProject.name = repo.split("/").pop() || "Imported Project";
    await saveProject(freshProject);
    setProject({ ...freshProject });
    setActiveViewingFile(files[0].name);
    setShowGitHub(false);
  };

  const handleExtensionGenerated = async (
    files: { name: string; content: string; language: string }[]
  ) => {
    if (!project || files.length === 0) return;
    const label = lastUserPrompt
      ? lastUserPrompt.slice(0, 60)
      : "Extension build";
    await saveVersion(project.id, JSON.stringify(files), label, lastUserPrompt || "Extension generated");

    const freshProject = await loadProject(project.id);
    if (!freshProject) return;

    freshProject.importedFiles = files;
    await saveProject(freshProject);
    setProject({ ...freshProject });
    setActiveViewingFile(files[0].name);
    setViewingVersionCode(null);
  };

  const handleReactAppGenerated = async (
    files: { name: string; content: string; language: string }[],
    mode?: BuildMode
  ) => {
    if (!project || files.length === 0) return;
    const isReact = mode === "react-app";
    const label = lastUserPrompt
      ? lastUserPrompt.slice(0, 60)
      : isReact ? "React app build" : "Website build";
    await saveVersion(project.id, JSON.stringify(files), label, lastUserPrompt || (isReact ? "React app generated" : "Website generated"));

    const freshProject = await loadProject(project.id);
    if (!freshProject) return;

    freshProject.importedFiles = files;
    freshProject.name = files.length > 0 ? (isReact ? "React App" : "Website") : freshProject.name;
    await saveProject(freshProject);
    setProject({ ...freshProject });
    setActiveViewingFile(files[0].name);
    setViewingVersionCode(null);
  };

  const handleUploadedFiles = async (
    name: string,
    files?: { name: string; content: string; language: string }[]
  ) => {
    if (!project || !files || files.length === 0) return;
    const label = `Upload: ${name}`;
    await saveVersion(project.id, JSON.stringify(files), label, `ZIP Upload: ${name}`);

    const freshProject = await loadProject(project.id);
    if (!freshProject) return;

    freshProject.importedFiles = files;
    freshProject.name = name.replace(/\.(zip|tar\.gz)$/, "");
    await saveProject(freshProject);
    setProject({ ...freshProject });
    setActiveViewingFile(files[0].name);
    setShowUpload(false);
  };

  const previewCode = useMemo(() => {
    if (viewingVersionCode) return viewingVersionCode;
    if (activeViewingFile === "generated" && project?.generatedCode) return project.generatedCode;
    if (activeViewingFile && activeViewingFile !== "generated" && project?.importedFiles) {
      const file = project.importedFiles.find((f) => f.name === activeViewingFile);
      if (file) return file.content;
    }
    return project?.generatedCode ?? null;
  }, [viewingVersionCode, activeViewingFile, project?.generatedCode, project?.importedFiles]);

  const isExtensionFile = useMemo(() => {
    if (activeViewingFile === "generated" || viewingVersionCode) return false;
    if (!activeViewingFile) return false;
    const ext = activeViewingFile.split(".").pop()?.toLowerCase();
    return ext !== "html" && ext !== "htm";
  }, [activeViewingFile, viewingVersionCode]);

  if (loadingProject) {
    return (
      <div className="h-screen bg-background-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen bg-background-50 flex flex-col overflow-hidden">
        <TopBar
          projectName="New Project"
          onProjectNameChange={() => {}}
          isBuilding={false}
          generatedCode={null}
          projectId={null}
          customDomain=""
          onCustomDomainChange={() => {}}
          userPlan={userPlan}
        />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-background-200/60 border border-background-300/60 mx-auto mb-5">
              <i className="ri-rocket-2-line text-foreground-400 text-2xl" />
            </div>
            <h2 className="text-lg font-bold text-foreground-900 mb-2">Welcome to CreAIlity</h2>
            <p className="text-sm text-foreground-500 mb-6 leading-relaxed">
              You don&apos;t have any projects yet. Create your first project and start building with AI — describe any app, website, or browser extension.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleNewProject}
                className="inline-flex items-center gap-2 bg-accent-500 text-background-50 font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-add-line text-sm" />
                Create your first project
              </button>
              <button
                onClick={() => setShowGitHub(true)}
                className="inline-flex items-center gap-2 border border-background-300/60 text-foreground-700 font-medium px-5 py-2.5 rounded-xl hover:border-foreground-500 hover:text-foreground-900 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-github-line text-sm" />
                Import from GitHub
              </button>
            </div>
          </div>
        </div>
        {showGitHub && <GitHubModal onClose={() => setShowGitHub(false)} onImport={handleImportFromGitHub} />}
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploadedFiles} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background-50 overflow-hidden">
      <TopBar
        projectName={project.name}
        onProjectNameChange={handleProjectNameChange}
        isBuilding={isBuilding}
        generatedCode={project.generatedCode}
        projectId={project.id}
        customDomain={project.customDomain || ""}
        onCustomDomainChange={handleCustomDomainChange}
        importedFiles={project.importedFiles}
        userPlan={userPlan}
      />

      <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-background-200 bg-background-100">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); setMobileSidebarOpen(!mobileSidebarOpen); }}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              sidebarOpen
                ? "bg-background-200 text-foreground-700"
                : "text-foreground-500 hover:bg-background-200"
            }`}
            title="Toggle sidebar"
          >
            <i className="ri-layout-left-line text-sm" />
          </button>
          {viewingVersionCode && (
            <div className="flex items-center gap-1.5 ml-2 bg-accent-500/10 border border-accent-500/20 rounded-full px-2.5 py-0.5">
              <i className="ri-history-line text-accent-400 text-xs" />
              <span className="text-xs text-accent-400">Viewing older version</span>
              <button onClick={handleClearVersionPreview} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent-500/20 transition-colors cursor-pointer ml-0.5">
                <i className="ri-close-line text-accent-400 text-[10px]" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 bg-background-200/50 border border-background-300/50 rounded-lg p-0.5">
          {(["chat", "both", "preview"] as ActivePanel[]).map((key) => (
            <button
              key={key}
              onClick={() => setActivePanel(key)}
              className={`flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs transition-colors cursor-pointer ${
                activePanel === key
                  ? "bg-foreground-400/15 text-foreground-800"
                  : "text-foreground-600 hover:text-foreground-800"
              }`}
            >
              <i className={`${key === "chat" ? "ri-chat-3-line" : key === "both" ? "ri-layout-column-line" : "ri-eye-line"} text-xs`} />
              <span className="hidden sm:inline">{key === "chat" ? "Chat" : key === "both" ? "Split" : "Preview"}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={mainAreaRef} className={`flex flex-1 overflow-hidden min-h-0 ${activePanel === "both" ? "pb-14 md:pb-0" : ""}`}>
        <div className={`w-52 flex-shrink-0 hidden md:flex flex-col h-full overflow-hidden border-r border-background-200 ${sidebarOpen ? '' : 'md:hidden'}`}>
          <Sidebar
            onGitHubImport={() => setShowGitHub(true)}
            onUpload={() => setShowUpload(true)}
            currentProjectId={project.id}
            onNewProject={handleNewProject}
            projectVersions={project.versions}
            activeVersionId={project.activeVersionId}
            onRestoreVersion={handleRestoreVersion}
            onPreviewVersion={handlePreviewVersion}
            generatedCode={project.generatedCode}
            importedFiles={project.importedFiles || []}
            onFileSelect={handleFileSelect}
            onShowGenerated={handleShowGenerated}
            activeViewingFile={activeViewingFile}
          />
        </div>

        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-background-50 border-r border-background-200 shadow-2xl z-50 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-background-200 flex-shrink-0">
                <span className="text-sm font-semibold text-foreground-800">Project</span>
                <button onClick={() => setMobileSidebarOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 cursor-pointer">
                  <i className="ri-close-line text-foreground-600 text-sm" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Sidebar
                  onGitHubImport={() => { setMobileSidebarOpen(false); setShowGitHub(true); }}
                  onUpload={() => { setMobileSidebarOpen(false); setShowUpload(true); }}
                  currentProjectId={project.id}
                  onNewProject={() => { setMobileSidebarOpen(false); handleNewProject(); }}
                  projectVersions={project.versions}
                  activeVersionId={project.activeVersionId}
                  onRestoreVersion={(vid) => { setMobileSidebarOpen(false); handleRestoreVersion(vid); }}
                  onPreviewVersion={handlePreviewVersion}
                  generatedCode={project.generatedCode}
                  importedFiles={project.importedFiles || []}
                  onFileSelect={(f) => { setMobileSidebarOpen(false); handleFileSelect(f); }}
                  onShowGenerated={() => { setMobileSidebarOpen(false); handleShowGenerated(); }}
                  activeViewingFile={activeViewingFile}
                />
              </div>
            </div>
          </div>
        )}

        {(activePanel === "chat" || activePanel === "both") && (
          <div className={`flex flex-col overflow-hidden border-r border-background-200 flex-shrink-0 ${
            activePanel === "chat"
              ? "flex-1"
              : activePanel === "both" && mobilePreviewActive
                ? "hidden md:flex"
                : "flex md:flex"
          }`}
            style={{ width: activePanel === "both" && !mobilePreviewActive ? `${chatPanelWidth}px` : undefined }}>
            <ChatPanel
              key={project.id}
              onBuildStart={() => setIsBuilding(true)}
              onBuildEnd={() => setIsBuilding(false)}
              onGitHubImport={() => setShowGitHub(true)}
              onUpload={() => setShowUpload(true)}
              onOpenModelSettings={() => setShowModelSettings(true)}
              onCodeGenerated={handleCodeGenerated}
              onExtensionGenerated={handleExtensionGenerated}
              onReactAppGenerated={handleReactAppGenerated}
              conversationHistory={project.conversationHistory}
              onConversationUpdate={handleConversationUpdate}
              conversationId={conversationId}
              userPlan={userPlan}
              projectContext={projectContext}
            />
          </div>
        )}

        {activePanel === "both" && (
          <div onMouseDown={handleDividerMouseDown}
            className={`hidden md:flex flex-shrink-0 w-1.5 items-center justify-center cursor-col-resize group relative z-10 transition-colors ${
              isDragging ? "bg-accent-500/50" : "bg-transparent hover:bg-accent-500/20"
            }`}
            title="Drag to resize panels">
            <div className={`w-0.5 h-8 rounded-full transition-all ${isDragging ? "bg-accent-500 h-12" : "bg-foreground-400/30 group-hover:bg-accent-500/60 group-hover:h-10"}`} />
          </div>
        )}

        {(activePanel === "preview" || activePanel === "both") && (
          <div className={`flex flex-col overflow-hidden ${
            activePanel === "preview"
              ? "flex-1"
              : activePanel === "both" && !mobilePreviewActive
                ? "hidden md:flex flex-1"
                : "flex md:flex flex-1"
          }`}>
            {(project.generatedCode || (project.importedFiles && project.importedFiles.length > 0)) && (
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-background-100 border-b border-background-200">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-eye-line text-foreground-500 text-xs" />
                  </div>
                  <span className="text-[11px] text-foreground-600 font-medium truncate">Preview</span>
                </div>
                <button onClick={handleSharePreview}
                  className="flex items-center gap-1 text-[11px] text-foreground-600 hover:text-foreground-800 bg-background-200/40 border border-background-300/50 rounded-lg px-2 py-1 hover:bg-background-200/70 transition-colors cursor-pointer whitespace-nowrap">
                  {shareCopied ? (
                    <><i className="ri-check-line text-green-500 text-[10px]" /><span className="text-green-500">Copied!</span></>
                  ) : (
                    <><i className="ri-share-forward-line text-[10px]" /><span>Share preview</span></>
                  )}
                </button>
              </div>
            )}
            <PreviewPanel
              isBuilding={isBuilding}
              generatedCode={previewCode}
              isViewingVersion={!!viewingVersionCode}
              onCodeUpdate={async (code) => {
                if (!project) return;
                if (activeViewingFile && activeViewingFile !== "generated" && project.importedFiles) {
                  const updatedFiles = project.importedFiles.map((f) =>
                    f.name === activeViewingFile ? { ...f, content: code } : f
                  );
                  await saveVersion(project.id, JSON.stringify(updatedFiles), `Edit ${activeViewingFile}`, "code editor");
                  await saveProject({ ...project, importedFiles: updatedFiles });
                  setProject((prev) => prev ? { ...prev, importedFiles: updatedFiles } : prev);
                } else {
                  await saveVersion(project.id, code, "Manual edit", "code editor");
                  const updated = await loadProject(project.id);
                  if (updated) setProject({ ...updated, generatedCode: code });
                }
              }}
              isExtensionFile={isExtensionFile}
              fileName={activeViewingFile && activeViewingFile !== "generated" ? activeViewingFile : undefined}
              sandboxHtml={sandboxHtml}
            />
          </div>
        )}

        {activePanel === "both" && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background-50 border-t border-background-200 px-3 py-2 flex items-center gap-2">
            <button onClick={() => setMobilePreviewActive(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                !mobilePreviewActive ? "bg-foreground-200/30 text-foreground-900" : "text-foreground-500 hover:text-foreground-700"
              }`}>
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-chat-3-line text-sm" /></div>
              Chat
            </button>
            <button onClick={() => setMobilePreviewActive(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                mobilePreviewActive ? "bg-foreground-200/30 text-foreground-900" : "text-foreground-500 hover:text-foreground-700"
              }`}>
              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-eye-line text-sm" /></div>
              Preview
            </button>
          </div>
        )}
      </div>

      {showGitHub && <GitHubModal onClose={() => setShowGitHub(false)} onImport={handleImportFromGitHub} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={handleUploadedFiles} />}
      {showModelSettings && <ModelSelector onClose={() => setShowModelSettings(false)} />}

      {/* Project Limit Modal */}
      {projectLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setProjectLimitModal(false); navigate("/pricing"); }} />
          <div className="relative bg-background-50 rounded-2xl border border-background-300/60 p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary-500/10 mb-4 mx-auto">
              <i className="ri-folder-line text-primary-500 text-lg" />
            </div>
            <h3 className="text-base font-bold text-foreground-900 text-center mb-1">Project limit reached</h3>
            <p className="text-xs text-foreground-600 text-center mb-4">Free plan includes {userPlan?.projectsLimit || 3} projects. Upgrade to Pro for unlimited projects, all AI models, custom domains, and more.</p>
            <div className="flex flex-col gap-2">
              <a href="/pricing" className="w-full text-center bg-accent-500 text-background-50 rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">Upgrade to Pro — $19/mo</a>
              <button onClick={() => { setProjectLimitModal(false); navigate("/pricing"); }} className="w-full text-center text-foreground-600 hover:text-foreground-800 text-xs py-1.5 transition-colors cursor-pointer">View plans</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}