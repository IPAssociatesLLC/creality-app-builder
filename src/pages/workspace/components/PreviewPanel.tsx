import { useState, useRef, useEffect, useMemo, useCallback } from "react";

interface PreviewPanelProps {
  isBuilding: boolean;
  generatedCode: string | null;
  isViewingVersion?: boolean;
  isExtensionFile?: boolean;
  fileName?: string;
  onCodeUpdate?: (code: string) => void;
  sandboxHtml?: string | null;
  projectSlug?: string;
}

type DeviceMode = "desktop" | "tablet" | "mobile";
type ViewMode = "preview" | "code";
const deviceSizes: Record<DeviceMode, { w: string; label: string; icon: string }> = {
  desktop: { w: "100%", label: "Desktop", icon: "ri-computer-line" },
  tablet: { w: "768px", label: "Tablet", icon: "ri-tablet-line" },
  mobile: { w: "390px", label: "Mobile", icon: "ri-smartphone-line" },
};

const defaultPreviewHtml = `<!DOCTYPE html>\n<html lang="en" class="dark">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <script src="https://cdn.tailwindcss.com"></script>\n  <link href="https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css" rel="stylesheet">\n  <script>tailwind.config={darkMode:'class'}</script>\n  <style>body{font-family:Inter,system-ui,sans-serif;margin:0;background:#0a0a0b;color:#e4e4e7;}</style>\n</head>\n<body>\n  <div class="min-h-screen bg-gray-950 flex items-center justify-center">\n    <div class="text-center px-6">\n      <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center"><i class="ri-sparkling-2-line text-3xl text-gray-300"></i></div>\n      <h1 class="text-2xl font-semibold text-gray-200 mb-2">Ready to build</h1>\n      <p class="text-gray-500 max-w-md leading-relaxed">Describe the app you want in the chat panel and your AI builder will generate it here in real time.</p>\n    </div>\n  </div>\n</body>\n</html>`;

function useBlobUrl(html: string | null): string {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const source = html || defaultPreviewHtml;
    const blob = new Blob([source], { type: "text/html;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [html]);

  return url || "about:blank";
}

function CodeEditor({ code, onSave, fileName }: { code: string; onSave: (updated: string) => void; fileName?: string }) {
  const [value, setValue] = useState(code);
  const [saved, setSaved] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setValue(code); }, [code]);
  useEffect(() => { setLineCount(value.split("\n").length); }, [value]);
  const handleScroll = () => { if (textareaRef.current && lineNumbersRef.current) lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop; };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    if (e.key === "Tab") { e.preventDefault(); const ta = textareaRef.current; if (!ta) return; const start = ta.selectionStart, end = ta.selectionEnd; setValue(value.substring(0, start) + "  " + value.substring(end)); requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; }); }
  };
  const handleSave = useCallback(() => { onSave(value); setSaved(true); setTimeout(() => setSaved(false), 2000); }, [value, onSave]);

  return <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/50 font-mono uppercase tracking-widest">{fileName ? fileName.split(".").pop()?.toUpperCase() || "FILE" : "HTML"}</span>
        {fileName && <span className="text-[10px] text-white/60 truncate max-w-[200px]" title={fileName}>{fileName}</span>}
        <span className="text-[10px] text-white/40">{lineCount} lines</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => navigator.clipboard.writeText(value)} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-clipboard-line text-xs" />Copy</button>
        <button onClick={handleSave} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${saved ? "bg-green-500/10 text-green-400" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>{saved ? <><i className="ri-check-line text-xs" />Applied</> : <><i className="ri-save-line text-xs" />Apply changes</>}</button>
      </div>
    </div>
    <div className="flex flex-1 overflow-hidden font-mono text-xs">
      <div ref={lineNumbersRef} className="flex-shrink-0 overflow-hidden select-none bg-[#0d1117] border-r border-white/10 text-right" style={{ width: "48px", paddingTop: "12px", paddingBottom: "12px" }}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="text-white/30 leading-5 px-3" style={{ fontSize: "12px" }}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        spellCheck={false}
        className="flex-1 bg-[#0d1117] text-[#e6edf3] resize-none outline-none leading-5 p-3 overflow-auto selection:bg-[#264f78]"
        style={{ fontSize: "12px", tabSize: 2 }}
      />
    </div>
    <div className="flex-shrink-0 px-4 py-1.5 bg-[#161b22] border-t border-white/10">
      <p className="text-[10px] text-white/40">
        <kbd className="bg-white/10 border border-white/15 rounded px-1 font-mono text-white/60">⌘S</kbd> to apply · <kbd className="bg-white/10 border border-white/15 rounded px-1 font-mono text-white/60">Tab</kbd> to indent
      </p>
    </div>
  </div>;
}

function isValidHtmlPreview(code: string | null): boolean {
  if (!code || code.length < 30) return false;
  const hasDoctype = /<!DOCTYPE\s+html/i.test(code);
  const hasHtmlTag = /<html[\s>]/i.test(code);
  const hasScriptOrStyle = /<script[\s>]|<\/script>|<style[\s>]|<\/style>|<link\s/i.test(code);
  const hasDiv = /<div[\s>]/i.test(code);
  const isAdviceText = /troubleshoot|check.*error|ensure.*correct|verify.*setup|inspect.*console|npm run|terminal|build error|Let.s ensure|Double.check|should consider/i.test(code);
  if (isAdviceText && !hasDoctype && !hasHtmlTag) return false;
  return hasDoctype || hasHtmlTag || (hasScriptOrStyle && hasDiv);
}

export default function PreviewPanel({ isBuilding, generatedCode, isViewingVersion, isExtensionFile, fileName, onCodeUpdate, sandboxHtml, projectSlug }: PreviewPanelProps) {
  const isExt = isExtensionFile ?? (generatedCode !== null && !generatedCode.trimStart().startsWith("<!") && !generatedCode.trimStart().startsWith("<html"));
  const isNonHtmlCode = generatedCode !== null && !isExt && !isValidHtmlPreview(generatedCode);
  const hasAnyCode = !!generatedCode || !!sandboxHtml;
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [viewMode, setViewMode] = useState<ViewMode>(hasAnyCode ? "preview" : "code");
  const [refreshKey, setRefreshKey] = useState(0);
  const [useLiveUrl, setUseLiveUrl] = useState(false);
  const blobUrl = useBlobUrl(viewMode === "preview" && sandboxHtml ? sandboxHtml : (!isExt && !isNonHtmlCode ? generatedCode : null));
  const liveUrl = (projectSlug && !isViewingVersion) ? `https://${projectSlug}.crealityapp.com` : "";
  const iframeUrl = useLiveUrl ? liveUrl : blobUrl;

  useEffect(() => {
    if (hasAnyCode && !isExt && !isNonHtmlCode) {
      setViewMode("preview");
    } else if (hasAnyCode && (isExt || isNonHtmlCode) && !sandboxHtml) {
      setViewMode("code");
    }
  }, [isExt, isNonHtmlCode, hasAnyCode, sandboxHtml]);

  const handleExport = () => { if (!generatedCode) return; const blob = new Blob([generatedCode], { type: "text/html" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "app.html"; a.click(); URL.revokeObjectURL(url); };

  const canPreview = hasAnyCode;

  return <div className="flex flex-col h-full bg-background-200 overflow-hidden">
    <div className="flex-shrink-0 flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-background-100 border-b border-background-200 flex-wrap">
      <div className="flex items-center gap-0.5 bg-background-200/40 border border-background-300/60 rounded-lg p-0.5 flex-shrink-0">
        <button onClick={() => setViewMode("preview")} className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 h-6 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap ${viewMode === "preview" ? "bg-foreground-400/15 text-foreground-800" : "text-foreground-600 hover:text-foreground-800"}`}><i className="ri-eye-line text-[10px] md:text-xs" />Preview{sandboxHtml && <span className="ml-1 opacity-70 hidden sm:inline">(App)</span>}</button>
        <button onClick={() => setViewMode("code")} className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 h-6 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap ${viewMode === "code" ? "bg-foreground-400/15 text-foreground-800" : "text-foreground-600 hover:text-foreground-800"}`}><i className="ri-code-line text-[10px] md:text-xs" />Code</button>
      </div>
      {isExt && generatedCode && !sandboxHtml && <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-foreground-600 bg-primary-500/10 border border-primary-500/20 rounded-lg px-2 md:px-2.5 py-1 flex-shrink-0"><i className="ri-puzzle-line text-primary-600 text-[10px] md:text-xs" /><span className="text-primary-700 font-medium whitespace-nowrap hidden sm:inline">Code view</span></div>}
      {isViewingVersion && <div className="flex items-center gap-1 md:gap-1.5 bg-accent-500/10 border border-accent-500/20 rounded-lg px-2 md:px-2.5 py-1 md:py-1.5 flex-shrink-0"><i className="ri-history-line text-accent-400 text-[10px]" /><span className="text-[10px] text-accent-400 whitespace-nowrap hidden sm:inline">Version preview</span></div>}
      <div className="flex-1" />
      {viewMode === "preview" && canPreview && liveUrl && (
        <div className="flex items-center gap-0.5 bg-background-200/40 border border-background-300/60 rounded-lg p-0.5 flex-shrink-0 mr-1">
          <button onClick={() => setUseLiveUrl(false)} className={`px-2 h-6 rounded-md text-[10px] md:text-xs transition-colors cursor-pointer whitespace-nowrap ${!useLiveUrl ? "bg-foreground-400/15 text-foreground-800 font-semibold" : "text-foreground-600 hover:text-foreground-800"}`} title="Instant local preview">Local</button>
          <button onClick={() => setUseLiveUrl(true)} className={`px-2 h-6 rounded-md text-[10px] md:text-xs transition-colors cursor-pointer whitespace-nowrap ${useLiveUrl ? "bg-foreground-400/15 text-foreground-800 font-semibold" : "text-foreground-600 hover:text-foreground-800"}`} title="Live Cloudflare preview">Live</button>
        </div>
      )}
      {viewMode === "preview" && canPreview && liveUrl && (
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="w-6 md:w-7 h-6 md:h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer text-foreground-500 hover:text-foreground-700 flex-shrink-0 mr-1" title="Open live site in new tab">
          <i className="ri-external-link-line text-xs md:text-sm" />
        </a>
      )}
      {viewMode === "preview" && <div className="flex items-center gap-0.5 bg-background-200/40 border border-background-300/60 rounded-lg p-0.5 flex-shrink-0">{(Object.entries(deviceSizes) as [DeviceMode, typeof deviceSizes[DeviceMode]][]).map(([mode, cfg]) => <button key={mode} onClick={() => setDevice(mode)} title={cfg.label} className={`w-6 md:w-7 h-6 md:h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer ${device === mode ? "bg-foreground-400/15 text-foreground-800" : "text-foreground-600 hover:text-foreground-800"}`}><i className={`${cfg.icon} text-[10px] md:text-xs`} /></button>)}</div>}
      <button onClick={handleExport} disabled={!generatedCode} title="Download HTML" className="w-6 md:w-7 h-6 md:h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer text-foreground-500 hover:text-foreground-700 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ml-1"><i className="ri-download-line text-xs md:text-sm" /></button>
      <button onClick={() => setRefreshKey(k => k + 1)} className="w-6 md:w-7 h-6 md:h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer text-foreground-500 hover:text-foreground-700 flex-shrink-0 ml-1" title="Refresh preview"><i className="ri-refresh-line text-xs md:text-sm" /></button></div>

    {viewMode === "preview" && canPreview ? (
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 min-h-0">
        <div className="h-full rounded-xl overflow-hidden border border-background-300/60 relative transition-all duration-300 bg-background-950" style={{ width: deviceSizes[device].w, minHeight: "500px" }}>
          {isBuilding && <div className="absolute inset-0 z-10 bg-background-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3"><div className="w-8 h-8 border-2 border-background-400/60 border-t-foreground-300 rounded-full animate-spin" /><p className="text-xs text-foreground-400 font-medium">Building your app...</p></div>}
          <iframe key={refreshKey} src={iframeUrl} className="w-full h-full border-0" title="App Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
        </div>
      </div>
    ) : (
      <div className="flex-1 min-h-0 overflow-hidden">
        {generatedCode ? <CodeEditor code={generatedCode} onSave={(updated) => onCodeUpdate?.(updated)} fileName={fileName} /> : <div className="flex flex-col items-center justify-center h-full text-center px-6"><div className="w-10 h-10 flex items-center justify-center rounded-xl bg-background-200/60 mb-3"><i className="ri-code-line text-foreground-500 text-lg" /></div><p className="text-sm text-foreground-600">{fileName ? `Viewing ${fileName}` : "No code generated yet"}</p><p className="text-xs text-foreground-500 mt-1">{fileName ? "Edit the code and click Apply to save changes." : "Build an app first to view and edit its code here."}</p></div>}
      </div>
    )}
  </div>;
}