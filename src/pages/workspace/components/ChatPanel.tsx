import { useState, useRef, useEffect, useCallback } from "react";
import { examplePrompts, extensionExamplePrompts } from "@/mocks/workspace";
import { loadConfig, saveConfig, AVAILABLE_MODELS, type StoredConfig } from "./ModelSelector";
import { generateCode, extractExtensionFiles, type ConversationMessage, type BuildMode } from "@/utils/ai-api";

interface ChatPanelProps {
  onBuildStart: () => void;
  onBuildEnd: () => void;
  onGitHubImport: () => void;
  onUpload: () => void;
  onOpenModelSettings: () => void;
  onCodeGenerated: (code: string) => void;
  onExtensionGenerated?: (files: { name: string; content: string; language: string }[]) => void;
  onReactAppGenerated?: (files: { name: string; content: string; language: string }[]) => void;
  conversationHistory: ConversationMessage[];
  onConversationUpdate: (history: ConversationMessage[]) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  status?: "sending" | "building" | "done" | "error";
  actions?: { label: string; icon: string }[];
}

function MessageBubble({ msg, onAction, onRetry }: { msg: ChatMessage; onAction?: (label: string) => void; onRetry?: () => void }) {
  const isUser = msg.role === "user";
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-foreground-950">{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    });
  };
  return <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
    {!isUser && <div className="w-7 h-7 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center mt-0.5 bg-background-200"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="C" className="w-full h-full object-contain p-0.5" /></div>}
    <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "bg-foreground-400/25 text-foreground-800 rounded-br-sm" : msg.status === "error" ? "bg-accent-500/10 border border-accent-500/20 text-foreground-700 rounded-bl-sm" : "bg-background-100 border border-background-300/60 text-foreground-700 rounded-bl-sm"}`}>
        {renderContent(msg.content)}
        {msg.status === "error" && onRetry && <button onClick={onRetry} className="mt-2 flex items-center gap-1.5 text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer"><i className="ri-refresh-line text-xs" />Retry</button>}
      </div>
      {msg.actions && msg.actions.length > 0 && msg.status !== "error" && <div className="flex flex-wrap gap-2">{msg.actions.map((action) => <button key={action.label} onClick={() => onAction?.(action.label)} className="flex items-center gap-1.5 text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className={`${action.icon} text-xs`} /></div>{action.label}</button>)}</div>}
      <span className="text-[10px] text-foreground-500">{msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  </div>;
}

const BUILD_MODES: { id: BuildMode; label: string; icon: string; desc: string }[] = [
  { id: "react-app", label: "React App", icon: "ri-reactjs-line", desc: "Build a full-stack multi-file React + TypeScript app" },
  { id: "web-app", label: "Web Page", icon: "ri-window-line", desc: "Build a single-page web application" },
  { id: "browser-extension", label: "Extension", icon: "ri-puzzle-line", desc: "Build a Chrome/Firefox browser extension" },
];

export default function ChatPanel({ onBuildStart, onBuildEnd, onGitHubImport, onUpload, onOpenModelSettings, onCodeGenerated, onExtensionGenerated, onReactAppGenerated, conversationHistory, onConversationUpdate }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkLabel, setThinkLabel] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<BuildMode>("web-app");
  const [inlineKeyOpen, setInlineKeyOpen] = useState(false);
  const [inlineKeyValue, setInlineKeyValue] = useState("");
  const [inlineModelOpen, setInlineModelOpen] = useState(false);
  const [inlineKeySaved, setInlineKeySaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inlineDropdownRef = useRef<HTMLDivElement>(null);

  const config = loadConfig();
  const activeModelName = config.selectedModel ? config.selectedModel.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "GPT-4o";
  const hasPlatformKey = !!(import.meta.env.VITE_OPENAI_API_KEY && config.selectedModel === "gpt-4o");
  const hasKey = !!config.apiKeys[config.selectedModel] || hasPlatformKey;

  useEffect(() => { if (!hasKey) setInlineKeyOpen(true); }, [hasKey]);
  useEffect(() => { if (!inlineModelOpen) return; const handler = (e: MouseEvent) => { if (inlineDropdownRef.current && !inlineDropdownRef.current.contains(e.target as Node)) setInlineModelOpen(false); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, [inlineModelOpen]);

  const handleInlineSaveKey = () => { if (!inlineKeyValue.trim()) return; const updated: StoredConfig = { ...config, apiKeys: { ...config.apiKeys, [config.selectedModel]: inlineKeyValue.trim() } }; saveConfig(updated); setInlineKeySaved(true); setTimeout(() => { setInlineKeySaved(false); setInlineKeyOpen(false); }, 1500); };
  const handleInlineModelSwitch = (modelId: string) => { const updated: StoredConfig = { ...config, selectedModel: modelId }; saveConfig(updated); setInlineModelOpen(false); setInlineKeyValue(config.apiKeys[modelId] || ""); if (!config.apiKeys[modelId]) setInlineKeyOpen(true); };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const handleModeSwitch = (mode: BuildMode) => { if (mode === buildMode) return; setBuildMode(mode); setMessages([]); onConversationUpdate([]); setLastPrompt(null); };

  const doBuild = useCallback(async (promptText: string) => {
    if (thinking) return;
    setInput(""); setShowSuggestions(false);
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "user", content: promptText, timestamp: new Date(), status: "done" };
    setMessages((prev) => [...prev, userMsg]); setLastPrompt(promptText); setThinking(true); onBuildStart();
    try {
      const rawOutput = await generateCode({ config, prompt: promptText, conversationHistory, buildMode, onStep: (step) => setThinkLabel(step) });
      if (!rawOutput) throw new Error("AI returned empty output.");
      let replyText = "";
      if (buildMode === "browser-extension") {
        const extFiles = extractExtensionFiles(rawOutput);
        if (extFiles && extFiles.length > 0) { onExtensionGenerated?.(extFiles); replyText = `Extension built! Check the preview panel for the files.`; }
        else { onCodeGenerated(rawOutput); replyText = "Extension generated. Check the preview panel."; }
      } else if (buildMode === "react-app") {
        const appFiles = extractExtensionFiles(rawOutput);
        if (appFiles && appFiles.length > 0) { onReactAppGenerated?.(appFiles); replyText = `React app built! Your app is live in the preview.`; }
        else { onCodeGenerated(rawOutput); replyText = "React app generated. Check the preview panel."; }
      } else {
        onCodeGenerated(rawOutput);
        replyText = conversationHistory.length > 0 ? "Updated! Your changes are live in the preview." : "Done! Your app is live in the preview panel.";
      }
      const newHistory: ConversationMessage[] = [...conversationHistory, { role: "user", content: promptText }, { role: "assistant", content: rawOutput }];
      onConversationUpdate(newHistory.length > 20 ? newHistory.slice(newHistory.length - 20) : newHistory);
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}-r`, role: "assistant", content: replyText, timestamp: new Date(), status: "done" }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}-r`, role: "assistant", content: `Build failed: ${errMsg}`, timestamp: new Date(), status: "error" }]);
    }
    setThinking(false); setThinkLabel(""); onBuildEnd();
  }, [thinking, config, conversationHistory, buildMode, onBuildStart, onBuildEnd, onCodeGenerated, onExtensionGenerated, onReactAppGenerated, onConversationUpdate]);

  const handleSend = () => { const text = input.trim(); if (!text || thinking) return; doBuild(text); };
  const handleRetry = () => { if (lastPrompt) { setMessages((prev) => prev.filter((m) => m.status !== "error")); doBuild(lastPrompt); } };
  const handleClearMemory = () => { setMessages([]); onConversationUpdate([]); setLastPrompt(null); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleAction = (label: string) => { if (label === "Import from GitHub") onGitHubImport(); else if (label === "Upload project") onUpload(); };
  const handleSuggestion = (text: string) => { setInput(text); setShowSuggestions(false); inputRef.current?.focus(); };
  const turnCount = Math.floor(conversationHistory.length / 2);
  const currentPrompts = buildMode === "browser-extension" ? extensionExamplePrompts : examplePrompts;
  const placeholderText = buildMode === "browser-extension" ? (turnCount > 0 ? "Describe changes to the extension..." : "Describe the browser extension you want to build...") : buildMode === "react-app" ? (turnCount > 0 ? "Describe changes to your React app..." : "Describe the full-stack React app you want to build...") : (turnCount > 0 ? "Describe what to change or add..." : "Describe the app you want to build...");

  return <div className="flex flex-col h-full bg-background-50 overflow-hidden">
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-background-200">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-5 h-5 flex items-center justify-center"><i className="ri-sparkling-2-line text-accent-500 text-sm" /></div>
        <span className="text-sm font-semibold text-foreground-800">AI Builder</span>
        <button onClick={onOpenModelSettings} className="flex items-center gap-1 text-[10px] text-foreground-600 bg-background-200/50 border border-foreground-400/30 rounded-full px-2 py-0.5 hover:text-foreground-800 hover:border-foreground-500 transition-colors cursor-pointer whitespace-nowrap"><span className={`w-1 h-1 rounded-full inline-block ${hasKey ? "bg-secondary-500" : "bg-foreground-600"}`} />{activeModelName}<i className="ri-arrow-down-s-line text-[10px]" /></button>
        {turnCount > 0 && <div className="flex items-center gap-1 text-[10px] text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 rounded-full px-2 py-0.5"><i className="ri-history-line text-[10px]" /><span>{turnCount} turn{turnCount !== 1 ? "s" : ""}</span></div>}
      </div>
      {turnCount > 0 && <button onClick={handleClearMemory} className="text-xs text-foreground-600 hover:text-foreground-800 px-2 py-1 rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-delete-bin-line text-xs" /></div>Clear</button>}
    </div>

    <div className="flex-shrink-0 flex items-center gap-1 px-3 pt-2.5 pb-0">
      {BUILD_MODES.map((mode) => <button key={mode.id} onClick={() => handleModeSwitch(mode.id)} title={mode.desc} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg border border-b-0 text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${buildMode === mode.id ? "bg-background-100 border-background-300/60 text-foreground-800 shadow-sm" : "bg-transparent border-transparent text-foreground-500 hover:text-foreground-700 hover:bg-background-200/40"}`}><div className="w-3.5 h-3.5 flex items-center justify-center"><i className={`${mode.icon} text-xs`} /></div>{mode.label}{mode.id === "browser-extension" && <span className="text-[9px] bg-primary-500/20 text-primary-700 border border-primary-500/30 rounded-full px-1.5 py-0.5 leading-none">NEW</span>}</button>)}
      <div className="flex-1 border-b border-background-300/60" />
    </div>

    {!hasKey && !hasPlatformKey && <div className="flex-shrink-0 mx-3 mt-2 flex items-center gap-2 bg-accent-500/10 border border-accent-500/20 rounded-xl px-3 py-2.5"><div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-key-2-line text-accent-400 text-xs" /></div><p className="text-xs text-accent-400 flex-1">No API key set for {activeModelName}. Add your key in model settings.</p><button onClick={onOpenModelSettings} className="text-xs font-medium text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap">Add key</button></div>}
    {turnCount > 0 && <div className="flex-shrink-0 mx-3 mt-2 flex items-center gap-2 bg-secondary-500/10 border border-secondary-500/20 rounded-xl px-3 py-2"><i className="ri-refresh-line text-secondary-400 text-xs flex-shrink-0" /><p className="text-xs text-secondary-400">I remember your app — just describe what to change and I&apos;ll update it.</p></div>}

    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
      {messages.length === 0 && !thinking && <div className="flex gap-3"><div className="w-7 h-7 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center mt-0.5 bg-background-200"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="C" className="w-full h-full object-contain p-0.5" /></div><div className="flex flex-col gap-3 max-w-[85%]"><div className="bg-background-100 border border-background-300/60 rounded-2xl rounded-bl-sm px-4 py-3"><p className="text-sm text-foreground-700 leading-relaxed">Describe the app you want to build. I&apos;ll generate the full code — HTML, CSS, JavaScript, everything. You can iterate on it, export it, or deploy it.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => handleAction("Import from GitHub")} className="flex items-center gap-1.5 text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-github-line text-xs" /></div>Import from GitHub</button><button onClick={() => handleAction("Upload project")} className="flex items-center gap-1.5 text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-upload-cloud-line text-xs" /></div>Upload project</button></div></div></div>}
      {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} onAction={handleAction} onRetry={msg.status === "error" ? handleRetry : undefined} />)}
      {thinking && <div className="flex gap-3"><div className="w-7 h-7 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center mt-0.5 bg-background-200"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="C" className="w-full h-full object-contain p-0.5" /></div><div className="bg-background-100 border border-background-300/60 rounded-2xl rounded-bl-sm px-4 py-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse inline-block flex-shrink-0" /><span className="text-xs text-foreground-800">{thinkLabel || "Thinking..."}</span></div></div></div>}
      <div ref={bottomRef} />
    </div>

    {showSuggestions && <div className="flex-shrink-0 px-3 pb-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">{currentPrompts.map((p) => <button key={p} onClick={() => handleSuggestion(p)} className="text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap">{p}</button>)}</div>}

    <div className="flex-shrink-0 px-3 pt-2">
      {!inlineKeyOpen && hasKey && <button onClick={() => setInlineKeyOpen(true)} className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary-500/8 border border-secondary-500/15 hover:border-secondary-500/25 transition-colors cursor-pointer"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-secondary-500 inline-block" /><span className="text-[11px] font-medium text-secondary-400">{AVAILABLE_MODELS.find((m) => m.id === config.selectedModel)?.name || activeModelName}</span><span className="text-[11px] text-secondary-400/70">· Configured</span></div><i className="ri-arrow-down-s-line text-secondary-400 text-xs" /></button>}
      {!inlineKeyOpen && !hasKey && <button onClick={() => setInlineKeyOpen(true)} className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/15 hover:border-red-500/25 transition-colors cursor-pointer"><div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /><span className="text-[11px] font-medium text-red-400">{AVAILABLE_MODELS.find((m) => m.id === config.selectedModel)?.name || activeModelName}</span><span className="text-[11px] text-red-400/70">· No API key</span></div><i className="ri-arrow-down-s-line text-red-400 text-xs" /></button>}
      {inlineKeyOpen && <div className="rounded-xl border border-background-300/60 bg-background-100 p-3">
        <div className="flex items-center justify-between mb-2.5"><span className="text-[11px] font-medium text-foreground-700">API Configuration</span>{hasKey && <button onClick={() => setInlineKeyOpen(false)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-background-200/60 transition-colors cursor-pointer"><i className="ri-close-line text-foreground-500 text-xs" /></button>}</div>
        <div className="relative" ref={inlineDropdownRef}>
          <button onClick={() => setInlineModelOpen(!inlineModelOpen)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-background-200/50 border border-background-300/50 text-xs text-foreground-700 hover:border-foreground-400/40 transition-colors cursor-pointer"><div className="flex items-center gap-2"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-robot-line text-foreground-600 text-xs" /></div><span>{AVAILABLE_MODELS.find((m) => m.id === config.selectedModel)?.name || activeModelName}</span></div><i className={inlineModelOpen ? "ri-arrow-up-s-line text-foreground-500 text-xs" : "ri-arrow-down-s-line text-foreground-500 text-xs"} /></button>
          {inlineModelOpen && <div className="absolute top-full left-0 right-0 mt-1 bg-background-100 border border-background-300/60 rounded-lg overflow-hidden z-40 shadow-sm">{AVAILABLE_MODELS.map((m) => <button key={m.id} onClick={() => handleInlineModelSwitch(m.id)} className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer text-left ${config.selectedModel === m.id ? "bg-background-200/70 text-foreground-900" : "text-foreground-600 hover:bg-background-200/40 hover:text-foreground-800"}`}><span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.apiKeys[m.id] || (m.id === "gpt-4o" && hasPlatformKey) ? "bg-secondary-500" : "bg-foreground-400"}`} /><span className="flex-1">{m.name}</span><span className="text-[10px] text-foreground-500">{m.provider}</span>{config.selectedModel === m.id && <i className="ri-check-line text-foreground-700 text-xs" />}</button>)}</div>}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 flex items-center gap-2 bg-background-200/40 border border-background-300/50 rounded-lg px-3 py-2"><i className="ri-key-2-line text-foreground-500 text-xs flex-shrink-0" /><input type="password" value={inlineKeyValue} onChange={(e) => setInlineKeyValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleInlineSaveKey(); }} placeholder="Paste your API key here" autoFocus className="flex-1 bg-transparent text-xs text-foreground-800 placeholder-foreground-600 outline-none font-mono" /></div>
          <button onClick={handleInlineSaveKey} disabled={!inlineKeyValue.trim()} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${inlineKeySaved ? "bg-secondary-500/15 text-secondary-400 border border-secondary-500/20" : "bg-foreground-900 text-background-50 hover:bg-foreground-800 disabled:opacity-30 disabled:cursor-not-allowed"}`}>{inlineKeySaved ? <><i className="ri-check-line" />Saved</> : "Save key"}</button>
        </div>
        <p className="text-[10px] text-foreground-500 mt-2 leading-relaxed">Keys are stored in your browser only. Never sent to our servers.</p>
      </div>}
    </div>

    <div className="flex-shrink-0 px-3 pb-4 pt-2 border-t border-background-200">
      <div className="rounded-2xl border border-background-300/60 bg-background-100 focus-within:border-foreground-500/50 focus-within:ring-1 focus-within:ring-foreground-400/20 transition-all">
        <textarea ref={inputRef} rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholderText} disabled={thinking} className="w-full resize-none bg-transparent text-sm text-foreground-800 placeholder-foreground-600 outline-none p-3 pb-1 leading-relaxed disabled:opacity-50" />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSuggestions(!showSuggestions)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer" title="Show suggestions"><i className="ri-lightbulb-line text-foreground-500 text-sm" /></button>
            <button onClick={onUpload} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer" title="Attach file"><i className="ri-attachment-2 text-foreground-500 text-sm" /></button>
          </div>
          <button onClick={handleSend} disabled={!input.trim() || thinking} className="w-7 h-7 flex items-center justify-center bg-accent-500/25 rounded-xl hover:bg-accent-500/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><i className="ri-send-plane-fill text-accent-500 text-xs" /></button>
        </div>
      </div>
      <p className="text-[10px] text-foreground-500 text-center mt-2">Press <kbd className="bg-background-200/60 px-1 rounded text-[10px] font-mono">Enter</kbd> to send · <kbd className="bg-background-200/60 px-1 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line</p>
    </div>
  </div>;
}