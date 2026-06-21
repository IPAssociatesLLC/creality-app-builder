import { useParams, Link } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import { loadProject, type Project, type ImportedFile } from "@/utils/projects-store";
import { supabase } from "@/lib/supabase";
import { buildSandboxHtml } from "@/utils/sandbox-bundler";

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) { setProject(null); return; }
    loadProject(id).then((local) => {
      if (local) { setProject(local); return; }
      supabase.from("projects").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
        if (error || !data) { setProject(null); return; }
        const p: Project = {
          id: data.id, name: data.name,
          createdAt: new Date(data.created_at).getTime(), updatedAt: new Date(data.updated_at).getTime(),
          generatedCode: data.generated_code, conversationHistory: data.conversation_history || [],
          previewSlug: data.preview_slug || data.id, customDomain: data.custom_domain || undefined,
          versions: [], activeVersionId: null, importedFiles: (data.imported_files as ImportedFile[]) || [],
        };
        setProject(p);
      });
    }).catch(() => {
      setProject(null);
    });
  }, [id]);

  const iframeSrc = useMemo(() => {
    if (project?.importedFiles && project.importedFiles.length > 0 && !project.generatedCode) {
      const sandbox = buildSandboxHtml(project.importedFiles);
      if (sandbox) { const blob = new Blob([sandbox.html], { type: "text/html;charset=utf-8" }); return URL.createObjectURL(blob); }
    }
    if (!project?.generatedCode) return null;
    const blob = new Blob([project.generatedCode], { type: "text/html;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [project?.generatedCode, project?.importedFiles]);

  const handleCopyUrl = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (project === undefined) return <div className="h-screen bg-background-950 flex items-center justify-center"><div className="w-6 h-6 border-2 border-background-600 border-t-foreground-300 rounded-full animate-spin" /></div>;

  if (!project || (!project.generatedCode && (!project.importedFiles || project.importedFiles.length === 0))) return (
    <div className="h-screen bg-background-950 flex flex-col items-center justify-center text-center px-6">
      <img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-10 w-auto object-contain mb-8" />
      <h1 className="text-xl font-semibold text-foreground-200 mb-2">Preview not found</h1>
      <p className="text-sm text-foreground-500 mb-8 max-w-sm leading-relaxed">This project doesn&apos;t exist or hasn&apos;t been built yet.</p>
      <Link to="/workspace" className="inline-flex items-center gap-2 bg-foreground-100 text-background-950 text-sm font-medium px-4 py-2 rounded-lg hover:bg-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
        <i className="ri-arrow-left-line text-sm" />Back to workspace
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background-950 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 h-10 bg-background-900 border-b border-background-800 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/" className="flex items-center cursor-pointer flex-shrink-0">
            <img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-5 sm:h-6 w-auto object-contain" />
          </Link>
          <span className="hidden sm:inline text-foreground-600 text-sm">/</span>
          <span className="hidden sm:inline text-sm text-foreground-300 font-medium truncate max-w-[120px] md:max-w-[200px]">{project.name}</span>
          <span className="text-[10px] bg-green-500/15 text-green-400 border border-green-500/20 rounded-full px-1.5 sm:px-2 py-0.5 whitespace-nowrap">Live</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={handleCopyUrl} className="flex items-center gap-1 text-[11px] sm:text-xs text-foreground-400 border border-background-700 rounded-lg px-2 sm:px-3 py-1 hover:border-background-500 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
            <i className={`text-[10px] sm:text-xs ${copied ? "ri-check-line text-green-400" : "ri-link"}`} />
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy URL"}</span>
          </button>
          <Link to={`/workspace?id=${project.id}`} className="flex items-center gap-1 text-[11px] sm:text-xs bg-foreground-100 text-background-950 font-medium rounded-lg px-2 sm:px-3 py-1 hover:bg-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-pencil-line text-[10px] sm:text-xs" /><span className="hidden sm:inline">Edit</span>
          </Link>
        </div>
      </div>
      {iframeSrc && <iframe src={iframeSrc} className="flex-1 w-full border-0" title={`Preview: ${project.name}`} sandbox="allow-scripts allow-same-origin" />}
    </div>
  );
}