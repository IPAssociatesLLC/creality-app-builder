import { useState, useRef, useEffect, useCallback } from "react";
import { examplePrompts, extensionExamplePrompts } from "@/mocks/workspace";
import { loadConfig } from "@/utils/ai-api";
import { AVAILABLE_MODELS, type StoredConfig } from "./ModelSelector";
import { generateCode, extractExtensionFiles, getUserApiKeys, type ConversationMessage, type BuildMode } from "@/utils/ai-api";
import { loadConversationMessages, saveMessage, optimizePrompt, getUserPlan, getConversationSummary, checkCanBuild, getModelCreditCost, deductCredits, type UserPlan } from "@/utils/projects-store";
import { supabase } from "@/lib/supabase";

interface ChatPanelProps {
  onBuildStart: () => void;
  onBuildEnd: () => void;
  onGitHubImport: () => void;
  onUpload: () => void;
  onOpenModelSettings: () => void;
  onCodeGenerated: (code: string) => void;
  onExtensionGenerated?: (files: { name: string; content: string; language: string }[]) => void;
  onReactAppGenerated?: (files: { name: string; content: string; language: string }[], mode?: BuildMode) => void;
  conversationHistory: ConversationMessage[];
  onConversationUpdate: (history: ConversationMessage[]) => void;
  conversationId?: string | null;
  userPlan?: UserPlan | null;
  projectContext?: string;
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
  { id: "web-app", label: "Website", icon: "ri-window-line", desc: "Build a multi-page website or web application" },
  { id: "browser-extension", label: "Extension", icon: "ri-puzzle-line", desc: "Build a Chrome/Firefox browser extension" },
  { id: "import-edit", label: "Import & Edit", icon: "ri-git-branch-line", desc: "Import an existing project from GitHub, ZIP, or paste code and make edits" },
];

export default function ChatPanel({ onBuildStart, onBuildEnd, onGitHubImport, onUpload, onOpenModelSettings, onCodeGenerated, onExtensionGenerated, onReactAppGenerated, conversationHistory, onConversationUpdate, conversationId, userPlan, projectContext }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkLabel, setThinkLabel] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<BuildMode>("web-app");
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const [inlineModelOpen, setInlineModelOpen] = useState(false);
  const [userHasKeys, setUserHasKeys] = useState(false);
  const [config, setConfig] = useState<StoredConfig>({ selectedModel: "gpt-4o" });
  const [configReady, setConfigReady] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [conversationSummary, setConversationSummary] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inlineDropdownRef = useRef<HTMLDivElement>(null);
  const lastLoadedIdRef = useRef<string | null>(null);

  // Auto-resize textarea as content grows
  const autoResizeTextarea = useCallback(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const newHeight = Math.min(ta.scrollHeight, 240);
    ta.style.height = `${Math.max(newHeight, 56)}px`;
  }, []);

  const activeModelName = config.selectedModel ? config.selectedModel.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "GPT-4o";

  const FREE_MODEL_IDS = ["gpt-4o"];
  const isModelLocked = userPlan?.tier === "free" && !FREE_MODEL_IDS.includes(config.selectedModel);

  useEffect(() => {
    getUserApiKeys().then((keys) => {
      setUserHasKeys(keys.length > 0);
    }).catch(() => {
      setUserHasKeys(false);
    });
  }, []);

  useEffect(() => { if (!inlineModelOpen) return; const handler = (e: MouseEvent) => { if (inlineDropdownRef.current && !inlineDropdownRef.current.contains(e.target as Node)) setInlineModelOpen(false); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, [inlineModelOpen]);

  useEffect(() => { if (!modeDropdownOpen) return; const handler = (e: MouseEvent) => { if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) setModeDropdownOpen(false); }; document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }, [modeDropdownOpen]);

  // Load conversation history from Supabase on mount/switch
  useEffect(() => {
    if (!conversationId) return;

    // Reset chat history when conversation ID changes to prevent old history carry-over
    if (lastLoadedIdRef.current !== conversationId) {
      setMessages([]);
      setHistoryLoaded(false);
      setConversationSummary("");
      lastLoadedIdRef.current = conversationId;
      return;
    }

    if (historyLoaded) return;

    let cancelled = false;
    Promise.all([
      loadConversationMessages(conversationId),
      getConversationSummary(conversationId),
    ]).then(([msgs, summary]) => {
      if (cancelled) return;
      if (msgs.length > 0) {
        // Detect if the last assistant message is troubleshooting text (not code)
        // If so, skip loading to give the AI a fresh start
        const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
        const isStuckTroubleshooting = lastAssistant && (
          /troubleshoot|check.*error|ensure.*correct|verify.*setup|inspect.*console|npm run|terminal|build error|should consider|Let.s ensure/i.test(lastAssistant.content)
        ) && !/```html|```json|```tsx|<!DOCTYPE|<html[\s>]|\{[\s]*"/.test(lastAssistant.content);

        if (isStuckTroubleshooting && msgs.length < 6) {
          console.log("CreAIlity: Detected stuck troubleshooting conversation, starting fresh");
          setHistoryLoaded(true);
          return;
        }

        const chatMsgs: ChatMessage[] = msgs.map((m) => ({
          id: `hist-${Math.random().toString(36).slice(2, 8)}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(),
          status: "done" as const,
        }));
        setMessages(chatMsgs);
        onConversationUpdate(msgs);
      } else {
        setMessages([]);
      }
      if (summary) setConversationSummary(summary);
      setHistoryLoaded(true);
    }).catch(() => {
      if (!cancelled) setHistoryLoaded(true);
    });

    return () => { cancelled = true; };
  }, [conversationId, historyLoaded]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  useEffect(() => {
    loadConfig().then((cfg) => {
      // Enforce free plan model restriction
      if (userPlan?.tier === "free" && !FREE_MODEL_IDS.includes(cfg.selectedModel)) {
        cfg.selectedModel = "gpt-4o";
      }
      setConfig(cfg);
      setConfigReady(true);
    });
  }, [userPlan?.tier]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input, autoResizeTextarea]);

  const handleModeSwitch = (mode: BuildMode) => { if (mode === buildMode) return; setBuildMode(mode); };

  const isValidHtmlCode = (code: string): boolean => {
    if (!code || code.length < 30) return false;
    // Must contain actual HTML structure — DOCTYPE, html tag, or at minimum angle brackets with tags
    const hasDoctype = /<!DOCTYPE\s+html/i.test(code);
    const hasHtmlTag = /<html[\s>]/i.test(code);
    const hasTagStructure = /<[a-zA-Z][a-zA-Z0-9]*[\s>]/.test(code);
    const hasClosingTag = /<\/[a-zA-Z][a-zA-Z0-9]*>/.test(code);
    const hasBodyTag = /<body[\s>]/i.test(code) || /<\/body>/i.test(code);
    const hasStyleContent = /<style[\s>]|<\/style>|<link\s/i.test(code);
    
    // Only reject if it has VERY strong indicators of being a troubleshooting response WITH NO tags
    const isAdviceText = /troubleshoot|check.*error|verify.*setup|inspect.*console|npm run|build error/i.test(code);
    
    if (isAdviceText && !hasDoctype && !hasHtmlTag && !hasTagStructure) return false;
    
    return hasDoctype || hasHtmlTag || (hasTagStructure && hasClosingTag && (hasBodyTag || hasStyleContent || code.length > 200));
  };

  const doBuild = useCallback(async (promptText: string) => {
    if (thinking) return;

    // ── Plan enforcement ──
    const canBuildCheck = await checkCanBuild();
    if (!canBuildCheck.allowed) {
      // Show specific block message
      const blockMsg: ChatMessage = {
        id: `msg-${Date.now()}-block`,
        role: "assistant",
        content: canBuildCheck.reason,
        timestamp: new Date(),
        status: "error",
      };
      setMessages((prev) => [...prev, blockMsg]);
      if (canBuildCheck.reason.includes("Upgrade") || canBuildCheck.reason.includes("renew")) {
        setUpgradeModalOpen(true);
      }
      return;
    }

    // Credits are handled via checkCanBuild and deductCredits.

    // Calculate credit cost: 3x for new builds (first message, no history), 1x for iterations
    const isNewBuild = conversationHistory.length === 0;
    const baseCost = await getModelCreditCost(config.selectedModel);
    const multiplier = isNewBuild ? 3 : 1;
    const totalCreditCost = baseCost * multiplier;

    // Check if user has enough credits (skip for BYOK)
    if (userPlan && userPlan.tier !== "byok" && userPlan.creditsRemaining < totalCreditCost) {
      const blockMsg: ChatMessage = {
        id: `msg-${Date.now()}-credit`,
        role: "assistant",
        content: `Not enough credits. This message costs ${totalCreditCost} credits but you only have ${userPlan.creditsRemaining} remaining. Upgrade to Pro for more credits or switch to BYOK for unlimited credits with your own keys.`,
        timestamp: new Date(),
        status: "error",
      };
      setMessages((prev) => [...prev, blockMsg]);
      setUpgradeModalOpen(true);
      return;
    }

    setInput(""); setShowSuggestions(false);
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "user", content: promptText, timestamp: new Date(), status: "done" };
    const asstMsgId = `msg-${Date.now()}-asst`;
    const initialAsstMsg: ChatMessage = { id: asstMsgId, role: "assistant", content: "", timestamp: new Date(), status: "done" };
    
    setMessages((prev) => [...prev, userMsg, initialAsstMsg]); 
    setLastPrompt(promptText); 
    setThinking(true); 
    onBuildStart();

    // Save user message to Supabase
    if (conversationId) {
      saveMessage(conversationId, "user", promptText).catch(() => {});
    }

    try {
      const rawOutput = await generateCode({
        config,
        prompt: promptText,
        conversationHistory,
        buildMode,
        onStep: (step) => setThinkLabel(step),
        projectContext: projectContext || "",
        conversationSummary,
        conversationId: conversationId || undefined,
        stream: true,
        onToken: (token) => {
          setMessages((prev) => 
            prev.map(m => {
              if (m.id === asstMsgId) {
                let currentRaw = (m as any)._raw || "";
                currentRaw += token;
                
                // If it's a multi-file JSON codeblock or HTML codeblock, hide it
                let display = currentRaw;
                if (display.includes("```")) {
                  const parts = display.split("```");
                  display = parts[0] + "\n\n*(Building app code...)*";
                } else if (display.startsWith("{") || display.startsWith("<!DOCTYPE") || display.startsWith("<html")) {
                  display = "*(Building app code...)*";
                }

                return { ...m, content: display, _raw: currentRaw };
              }
              return m;
            })
          );
        }
      });
      if (!rawOutput) throw new Error("AI returned empty output.");

      // Save assistant message to Supabase
      if (conversationId) {
        saveMessage(conversationId, "assistant", rawOutput).catch(() => {});
      }

      // Deduct credits (skip for BYOK - they use their own keys)
      if (userPlan && userPlan.tier !== "byok") {
        deductCredits(totalCreditCost).then((result) => {
          // Refresh user plan after deduction
          getUserPlan().then((updated) => {
            if (updated) {
              // Trigger state update via the userPlan prop (handled by parent)
            }
          }).catch(() => {});
        }).catch(() => {});
      }

      // Validate the output is actual code before treating it as generated code
      const codeIsValid = isValidHtmlCode(rawOutput);

      let replyText = "";
      const extractedFiles = extractExtensionFiles(rawOutput);
      const isMultiFile = extractedFiles && extractedFiles.length > 0;

      if (isMultiFile) {
        if (buildMode === "browser-extension") {
          await onExtensionGenerated?.(extractedFiles);
          replyText = `Extension built! Check the preview panel for the files.`;
        } else {
          // Even if buildMode is 'web-app', if AI returned JSON, handle it gracefully as a React app / Website
          await onReactAppGenerated?.(extractedFiles, buildMode);
          replyText = buildMode === "web-app"
            ? `Website built! Your site is live in the preview.`
            : `React app built! Your app is live in the preview.`;
        }
      } else if (codeIsValid) {
        await onCodeGenerated(rawOutput);
        replyText = conversationHistory.length > 0 ? "Updated! Your changes are live in the preview." : "Done! Your app is live in the preview panel.";
      } else {
        if (buildMode === "import-edit") {
          throw new Error(`AI returned an unexpected response format (${rawOutput.length} chars). The model may have struggled with the multi-file project structure. Try simplifying your request or breaking it into smaller changes.`);
        } else {
          replyText = rawOutput;
        }
      }
      
      const newHistory: ConversationMessage[] = [...conversationHistory, { role: "user", content: promptText }, { role: "assistant", content: rawOutput }];
      onConversationUpdate(newHistory);
      
      // FIX: Ensure the chat UI displays the clean replyText instead of the raw code
      setMessages((prev) => 
        prev.map(m => m.id === asstMsgId ? { ...m, content: replyText } : m)
      );

      if (!codeIsValid && buildMode !== "browser-extension" && buildMode !== "react-app" && buildMode !== "import-edit") {
        // If it's a web-app and no code was detected, append a warning to the streamed message
        setMessages((prev) => 
          prev.map(m => m.id === asstMsgId ? { ...m, content: m.content + `\n\n**Note:** I couldn't detect valid HTML code in this response. Try being more specific.` } : m)
        );
      }
    } catch (err: unknown) {
      let errMsg = err instanceof Error ? err.message : "Something went wrong.";
      // Add context for common build failures
      if (errMsg.includes("API key") || errMsg.includes("No API key")) {
        errMsg = `${errMsg} Add your API key in Settings or contact the admin to configure platform keys.`;
      } else if (errMsg.includes("429") || errMsg.includes("rate")) {
        errMsg = "AI model rate limit reached. Wait a moment and try again, or switch to a different model in settings.";
      } else if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
        errMsg = "Authentication failed. Try signing out and back in.";
      } else if (buildMode === "import-edit" && errMsg.includes("unexpected response")) {
        // Already includes guidance — keep as is
      }
      setMessages((prev) => [...prev, { id: `msg-${Date.now()}-r`, role: "assistant", content: `Build failed: ${errMsg}`, timestamp: new Date(), status: "error" }]);
    }
    setThinking(false); setThinkLabel(""); onBuildEnd();
  }, [thinking, config, conversationHistory, buildMode, onBuildStart, onBuildEnd, onCodeGenerated, onExtensionGenerated, onReactAppGenerated, onConversationUpdate, conversationId, userPlan, projectContext, conversationSummary]);

  const handleSend = () => { const text = input.trim(); if (!text || thinking) return; doBuild(text); };
  const handleRetry = () => { if (lastPrompt) { setMessages((prev) => prev.filter((m) => m.status !== "error")); doBuild(lastPrompt); } };
  const handleClearMemory = async () => {
    setMessages([]);
    onConversationUpdate([]);
    setLastPrompt(null);
    // Also clear messages from Supabase
    if (conversationId) {
      try {
        const { error } = await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", conversationId);
        if (!error) {
          // Also reset conversation summary and decision log
          await supabase
            .from("conversations")
            .update({ summary: "", decision_log: "", updated_at: new Date().toISOString() })
            .eq("id", conversationId);
        }
      } catch { /* silent */ }
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleAction = (label: string) => { if (label === "Import from GitHub") onGitHubImport(); else if (label === "Upload project") onUpload(); };
  const handleSuggestion = (text: string) => { setInput(text); setShowSuggestions(false); inputRef.current?.focus(); };

  const handleOptimizePrompt = async () => {
    const text = input.trim();
    if (!text || optimizing) return;
    setOptimizing(true);
    const optimized = await optimizePrompt(text);
    setInput(optimized);
    setOptimizing(false);
    inputRef.current?.focus();
  };

  const turnCount = Math.floor(conversationHistory.length / 2);
  const currentPrompts = buildMode === "browser-extension" ? extensionExamplePrompts : examplePrompts;
  const placeholderText = buildMode === "browser-extension" ? (turnCount > 0 ? "Describe changes to the extension..." : "Describe the browser extension you want to build...") : buildMode === "react-app" ? (turnCount > 0 ? "Describe changes to your React app..." : "Describe the full-stack React app you want to build...") : buildMode === "import-edit" ? "Paste your code, give a GitHub URL, or upload a project — then describe what to change..." : (turnCount > 0 ? "Describe what to change or add..." : "Describe the app you want to build...");

  return <div className="flex flex-col h-full bg-background-50 overflow-hidden">
    <div className="flex-shrink-0 flex items-center justify-between px-2 md:px-4 py-2 md:py-3 border-b border-background-200 flex-wrap gap-1">
      <div className="flex items-center gap-1 md:gap-2 flex-wrap">
        <div className="w-5 h-5 flex items-center justify-center"><i className="ri-sparkling-2-line text-accent-500 text-sm" /></div>
        <span className="text-xs md:text-sm font-semibold text-foreground-800">AI Builder</span>
        <button onClick={onOpenModelSettings} className="flex items-center gap-1 text-[10px] text-foreground-600 bg-background-200/50 border border-foreground-400/30 rounded-full px-1.5 md:px-2 py-0.5 hover:text-foreground-800 hover:border-foreground-500 transition-colors cursor-pointer whitespace-nowrap"><span className={`w-1 h-1 rounded-full inline-block ${userHasKeys ? "bg-accent-500" : "bg-secondary-500"}`} />{activeModelName}<i className="ri-arrow-down-s-line text-[10px]" /></button>
        {isModelLocked && <span className="inline-flex items-center gap-1 text-[9px] bg-amber-400/10 text-amber-500 border border-amber-400/20 rounded-full px-1.5 md:px-2 py-0.5"><i className="ri-lock-line text-[9px]" />Pro</span>}
        {turnCount > 0 && <div className="flex items-center gap-1 text-[10px] text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 rounded-full px-1.5 md:px-2 py-0.5"><i className="ri-history-line text-[10px]" /><span className="hidden md:inline">{turnCount} turn{turnCount !== 1 ? "s" : ""}</span><span className="md:hidden">{turnCount}</span></div>}
        {userPlan && (
          <div className="flex items-center gap-1 text-[10px] bg-background-200/60 border border-background-300/40 rounded-full px-1.5 md:px-2 py-0.5">
            <span className={`w-1 h-1 rounded-full inline-block ${userPlan.tier === "free" ? "bg-foreground-500" : userPlan.tier === "pro" ? "bg-accent-500" : "bg-primary-500"}`} />
            <span className="text-foreground-600 capitalize hidden md:inline">{userPlan.tier}</span>
            {userPlan.tier === "free" && <span className="text-foreground-500">· {userPlan.creditsRemaining} credits</span>}
          </div>
        )}
      </div>
      {turnCount > 0 && <button onClick={handleClearMemory} className="text-[10px] md:text-xs text-foreground-600 hover:text-foreground-800 px-1.5 md:px-2 py-1 rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"><div className="w-3 h-3 md:w-3.5 md:h-3.5 flex items-center justify-center"><i className="ri-delete-bin-line text-[10px] md:text-xs" /></div><span className="hidden md:inline">Clear</span></button>}
    </div>

    <div className="flex-shrink-0 px-2 md:px-3 pt-2 md:pt-2.5 pb-0">
      <div className="relative" ref={modeDropdownRef}>
        <button
          onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 border border-background-300/60 rounded-lg text-xs font-medium bg-background-100 text-foreground-800 hover:border-foreground-500/60 transition-colors cursor-pointer whitespace-nowrap"
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center">
            <i className={`${BUILD_MODES.find(m => m.id === buildMode)?.icon || "ri-window-line"} text-xs`} />
          </div>
          <span>{BUILD_MODES.find(m => m.id === buildMode)?.label || "Website"}</span>
          {buildMode === "browser-extension" && <span className="text-[9px] bg-primary-500/20 text-primary-700 border border-primary-500/30 rounded-full px-1.5 py-0.5 leading-none">NEW</span>}
          <i className={`ri-arrow-down-s-line text-foreground-500 text-xs transition-transform ${modeDropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {modeDropdownOpen && (
          <div className="absolute left-0 top-full mt-1 w-52 bg-background-50 border border-background-300/60 rounded-xl shadow-2xl py-1 z-50">
            <div className="px-3 py-1.5 border-b border-background-200">
              <span className="text-[10px] text-foreground-500 uppercase tracking-wider font-medium">Build Mode</span>
            </div>
            {BUILD_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => { handleModeSwitch(mode.id); setModeDropdownOpen(false); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer text-left ${buildMode === mode.id ? "bg-secondary-500/10 text-foreground-900" : "text-foreground-700 hover:bg-background-100"}`}
              >
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`${mode.icon} text-sm ${buildMode === mode.id ? "text-accent-500" : "text-foreground-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{mode.label}</span>
                    {mode.id === "browser-extension" && <span className="text-[9px] bg-primary-500/20 text-primary-700 border border-primary-500/30 rounded-full px-1.5 py-0.5 leading-none">NEW</span>}
                  </div>
                  <p className="text-[10px] text-foreground-500 mt-0.5 leading-relaxed">{mode.desc}</p>
                </div>
                {buildMode === mode.id && <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-check-line text-accent-500 text-sm" /></div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>



    <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4 flex flex-col gap-4 md:gap-5">
      {messages.length === 0 && !thinking && <div className="flex gap-3"><div className="w-7 h-7 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center mt-0.5 bg-background-200"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="C" className="w-full h-full object-contain p-0.5" /></div><div className="flex flex-col gap-3 max-w-[85%]"><div className="bg-background-100 border border-background-300/60 rounded-2xl rounded-bl-sm px-4 py-3"><p className="text-sm text-foreground-700 leading-relaxed">Describe the app you want to build. I&apos;ll generate the full code — HTML, CSS, JavaScript, everything. You can iterate on it, export it, or deploy it.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => handleAction("Import from GitHub")} className="flex items-center gap-1.5 text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-github-line text-xs" /></div>Import from GitHub</button><button onClick={() => handleAction("Upload project")} className="flex items-center gap-1.5 text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-upload-cloud-line text-xs" /></div>Upload project</button></div></div></div>}
      {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} onAction={handleAction} onRetry={msg.status === "error" ? handleRetry : undefined} />)}
      {thinking && <div className="flex gap-3"><div className="w-7 h-7 flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center mt-0.5 bg-background-200"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="C" className="w-full h-full object-contain p-0.5" /></div><div className="bg-background-100 border border-background-300/60 rounded-2xl rounded-bl-sm px-4 py-3"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse inline-block flex-shrink-0" /><span className="text-xs text-foreground-800">{thinkLabel || "Thinking..."}</span></div></div></div>}
      <div ref={bottomRef} />
    </div>

    {showSuggestions && <div className="flex-shrink-0 px-3 pb-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">{currentPrompts.map((p) => <button key={p} onClick={() => handleSuggestion(p)} className="text-xs text-foreground-700 bg-background-100 border border-foreground-400/40 rounded-full px-3 py-1.5 hover:border-foreground-500 hover:text-foreground-950 hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap">{p}</button>)}</div>}

    <div className="flex-shrink-0 px-2 md:px-3 pb-3 md:pb-4 pt-1.5 md:pt-2">
      <div className="rounded-2xl border border-background-300/60 bg-background-100 focus-within:border-foreground-500/50 focus-within:ring-1 focus-within:ring-foreground-400/20 transition-all">
        <textarea ref={inputRef} rows={1} value={input} onChange={(e) => { setInput(e.target.value); }} onKeyDown={handleKeyDown} placeholder={placeholderText} disabled={thinking} className="w-full resize-none bg-transparent text-sm text-foreground-800 placeholder-foreground-600 outline-none px-2.5 md:px-3 pt-2.5 md:pt-3 pb-1 leading-relaxed disabled:opacity-50 overflow-y-auto" style={{ minHeight: "56px", maxHeight: "240px" }} />
        <div className="flex items-center justify-between px-2.5 md:px-3 pb-2 md:pb-2.5 pt-1">
          <div className="flex items-center gap-2">
            <div className="relative" ref={inlineDropdownRef}>
              <button onClick={() => setInlineModelOpen(!inlineModelOpen)} className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${inlineModelOpen ? "bg-background-200 text-foreground-800" : "hover:bg-background-200/60 text-foreground-500"}`} title="Change AI model">
                <i className="ri-settings-3-line text-sm" />
              </button>
              {inlineModelOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-56 bg-background-50 border border-background-300/60 rounded-xl shadow-2xl py-1 z-50">
                  <div className="px-3 py-2 border-b border-background-200">
                    <span className="text-[10px] text-foreground-500 uppercase tracking-wider font-medium">AI Model</span>
                  </div>
                  {AVAILABLE_MODELS.map((m) => {
                    const isLocked = userPlan?.tier === "free" && !FREE_MODEL_IDS.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (isLocked) return;
                          setConfig((prev) => ({ ...prev, selectedModel: m.id }));
                          setInlineModelOpen(false);
                        }}
                        disabled={isLocked}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer whitespace-nowrap ${config.selectedModel === m.id ? "bg-secondary-500/10 text-foreground-900" : "text-foreground-700 hover:bg-background-100"} ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.selectedModel === m.id ? "bg-accent-500" : "bg-foreground-400/30"}`} />
                        <span className="flex-1 text-left">{m.name}</span>
                        {isLocked && <i className="ri-lock-line text-[10px] text-foreground-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={() => setShowSuggestions(!showSuggestions)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer" title="Show suggestions"><i className="ri-lightbulb-line text-foreground-500 text-sm" /></button>
            <button onClick={handleOptimizePrompt} disabled={!input.trim() || optimizing} className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${optimizing ? "bg-accent-500/10" : "hover:bg-background-200/60"}`} title="Optimize prompt"><i className={`ri-magic-line text-sm ${optimizing ? "text-accent-500 animate-spin" : "text-foreground-500"}`} /></button>
            <button onClick={onUpload} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer" title="Attach file"><i className="ri-attachment-2 text-foreground-500 text-sm" /></button>
          </div>
          <button onClick={handleSend} disabled={!input.trim() || thinking} className="w-7 h-7 flex items-center justify-center bg-accent-500/25 rounded-xl hover:bg-accent-500/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><i className="ri-send-plane-fill text-accent-500 text-xs" /></button>
        </div>
      </div>
      <p className="text-[10px] text-foreground-500 text-center mt-2">Press <kbd className="bg-background-200/60 px-1 rounded text-[10px] font-mono">Enter</kbd> to send · <kbd className="bg-background-200/60 px-1 rounded text-[10px] font-mono">Shift+Enter</kbd> for new line</p>
    </div>

    {/* Upgrade/Block Modal */}
    {upgradeModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setUpgradeModalOpen(false)} />
        <div className="relative bg-background-50 rounded-2xl border border-background-300/60 p-6 max-w-sm w-full mx-4 shadow-2xl">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-500/10 mb-4 mx-auto">
            <i className="ri-lock-line text-accent-500 text-lg" />
          </div>
          <h3 className="text-base font-bold text-foreground-900 text-center mb-1">Upgrade required</h3>
          <p className="text-xs text-foreground-600 text-center mb-4">
            {userPlan?.status === "cancelled" || userPlan?.status === "expired"
                ? `Your ${userPlan?.tier} subscription has ${userPlan?.status}. Renew to continue.`
                : userPlan?.tier === "hosting"
                  ? "Hosting plan doesn't include AI credits."
                  : userPlan?.creditsRemaining !== undefined && userPlan.creditsRemaining <= 0
                    ? "You're out of credits for this month."
                    : "Upgrade to unlock more credits and all AI models."}
          </p>
          <div className="flex flex-col gap-2">
            <a href="/pricing" className="w-full text-center bg-accent-500 text-background-50 rounded-xl py-2.5 text-sm font-semibold hover:bg-accent-500/90 transition-colors cursor-pointer whitespace-nowrap">View plans</a>
            <button onClick={() => setUpgradeModalOpen(false)} className="w-full text-center text-foreground-600 hover:text-foreground-800 text-xs py-1.5 transition-colors cursor-pointer">Maybe later</button>
          </div>
        </div>
      </div>
    )}
  </div>;
}