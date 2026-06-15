import { useState, useRef } from "react";
import JSZip from "jszip";

interface UploadModalProps {
  onClose: () => void;
  onUploaded: (name: string, files?: { name: string; content: string; language: string }[]) => void;
}

const supportedPlatforms = [
  { name: "Bolt.new", icon: "ri-flashlight-line" },
  { name: "v0 by Vercel", icon: "ri-triangle-line" },
  { name: "Lovable", icon: "ri-heart-line" },
  { name: "Replit", icon: "ri-code-box-line" },
  { name: "StackBlitz", icon: "ri-stack-line" },
  { name: "CodeSandbox", icon: "ri-code-s-slash-line" },
];

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    tsx: "tsx", ts: "ts", jsx: "tsx", js: "ts",
    css: "css", scss: "css", less: "css",
    html: "html", htm: "html",
    json: "json", md: "md",
    svg: "svg", png: "img", jpg: "img", jpeg: "img", gif: "img",
  };
  return map[ext] || "text";
}

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<{ name: string; content: string; language: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setUploading(true);
    setUploadedName(file.name);
    setError(null);
    setExtractedFiles([]);

    try {
      if (!file.name.endsWith(".zip")) {
        const text = await file.text();
        const files = [{ name: file.name, content: text, language: getLanguage(file.name) }];
        setExtractedFiles(files);
      } else {
        const zip = await JSZip.loadAsync(file);
        const files: { name: string; content: string; language: string }[] = [];
        const entries = Object.entries(zip.files);
        for (const [path, zipEntry] of entries) {
          if (zipEntry.dir) continue;
          const baseName = path.split("/").pop() || path;
          if (baseName.startsWith(".") || baseName.startsWith("__MACOSX")) continue;
          const lang = getLanguage(baseName);
          if (lang === "img" || lang === "svg") continue;
          try {
            const content = await zipEntry.async("text");
            if (content.length < 500000) {
              files.push({ name: path, content, language: lang });
            }
          } catch { /* skip */ }
        }
        if (files.length === 0) {
          setError("No readable source files found in this ZIP.");
          setUploading(false);
          return;
        }
        files.sort((a, b) => {
          const depthA = a.name.split("/").length;
          const depthB = b.name.split("/").length;
          if (depthA !== depthB) return depthA - depthB;
          return a.name.localeCompare(b.name);
        });
        setExtractedFiles(files);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read file.";
      setError(msg);
    }
    setUploading(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleContinue = () => {
    if (uploadedName) {
      onUploaded(uploadedName, extractedFiles);
      onClose();
    }
  };

  const ready = uploadedName && !uploading && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background-100 rounded-2xl border border-background-300/60 w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-background-200/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-foreground-400/15 rounded-lg">
              <i className="ri-upload-cloud-line text-foreground-700 text-base" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground-800">Upload Project</h3>
              <p className="text-xs text-foreground-500">Import from other platforms or upload a ZIP</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer">
            <i className="ri-close-line text-foreground-500 text-base" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground-500">Supported platforms</p>
            <div className="grid grid-cols-3 gap-2">
              {supportedPlatforms.map(p => (
                <div key={p.name} className="flex items-center gap-2 border border-background-300/60 rounded-xl px-3 py-2 bg-background-200/30">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <i className={`${p.icon} text-foreground-500 text-xs`} />
                  </div>
                  <span className="text-xs text-foreground-500 truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-foreground-500 mb-2">Upload your project</p>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center py-8 px-4 text-center ${
                dragOver ? "border-foreground-400/50 bg-background-200/40" : "border-background-300/60 hover:border-foreground-600 hover:bg-background-200/20"
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-background-400/60 border-t-foreground-300 rounded-full animate-spin" />
                  <p className="text-sm text-foreground-400">Processing <strong className="text-foreground-800">{uploadedName}</strong>...</p>
                </div>
              ) : ready ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-accent-500/10 border border-accent-500/20 rounded-xl">
                    <i className="ri-check-line text-accent-400 text-xl" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground-800">{uploadedName}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{extractedFiles.length} file{extractedFiles.length !== 1 ? "s" : ""} extracted</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 flex items-center justify-center bg-background-200/40 rounded-xl mb-3">
                    <i className="ri-upload-cloud-2-line text-foreground-500 text-xl" />
                  </div>
                  <p className="text-sm font-medium text-foreground-700 mb-1">Drop your project ZIP here</p>
                  <p className="text-xs text-foreground-500">or click to browse files</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".zip,.html,.htm,.tsx,.jsx,.ts,.js,.css,.json" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex-1 text-sm text-foreground-500 border border-background-300/60 rounded-xl py-2.5 hover:bg-background-200/40 transition-colors cursor-pointer whitespace-nowrap">Cancel</button>
            <button onClick={handleContinue} disabled={!ready} className="flex-1 flex items-center justify-center gap-2 bg-foreground-400/15 text-foreground-800 text-sm font-medium py-2.5 rounded-xl hover:bg-foreground-400/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              Continue building <i className="ri-arrow-right-line text-xs" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}