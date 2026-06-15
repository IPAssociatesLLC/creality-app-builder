import type { StoredConfig } from "@/pages/workspace/components/ModelSelector";

export type BuildMode = "web-app" | "browser-extension" | "react-app";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const WEB_APP_SYSTEM_PROMPT = `You are an expert full-stack AI software engineer called CreAIlity. Your job is to build beautiful, production-quality single-page web applications from user descriptions. The code you generate must look like it was built by a $50K+ agency.

═══════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════
Generate ONE complete, self-contained HTML file that works standalone in any browser.

CDN DEPENDENCIES (ONLY THESE):
- React 19 from ESM CDN:
  <script type="importmap">
  { "imports": { "react": "https://esm.sh/react@19", "react-dom": "https://esm.sh/react-dom@19" } }
  </script>
- Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
- Remix Icon CDN: <link href="https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css" rel="stylesheet">
- Google Fonts Inter: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

───────────────────────────────────────
DESIGN SYSTEM (DARK THEME — MANDATORY)
───────────────────────────────────────
Create a design that looks premium, modern, and agency-quality.

COLOR PALETTE:
- Canvas/background: bg-gray-950 (deepest black)
- Surface cards: bg-gray-900 border border-gray-800 rounded-2xl
- Elevated surfaces: bg-gray-800/80
- Dividers: border-gray-800
- Headings: text-gray-100 font-bold tracking-tight
- Body text: text-gray-300 text-sm
- Muted text: text-gray-400 text-xs
- Placeholder: text-gray-500
- ACCENT: Pick ONE vibrant color — emerald-500, amber-500, rose-500, cyan-400, orange-500, teal-400, pink-500.
  NEVER use blue or purple. Use accent SPARINGLY: main CTAs, active indicators, key highlights.
- Semantic: green-400 (success), red-400 (errors), yellow-400 (warnings)

TYPOGRAPHY:
- Font: font-family: 'Inter', system-ui, sans-serif
- Headings: font-bold, tracking-tight, text-gray-100
- Body: text-sm or text-base, leading-relaxed
- Labels: text-xs font-medium uppercase tracking-wider text-gray-400

SPACING:
- Section padding: py-12 md:py-20
- Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Card padding: p-6
- Grid gaps: gap-6
- Button padding: px-5 py-2.5

VISUAL POLISH:
- Hover transitions on all interactive elements: transition-all duration-200
- Cards: hover:bg-gray-800/80 hover:border-gray-700
- Glass effects: bg-gray-900/80 backdrop-blur-sm
- Gradient text: bg-gradient-to-r from-[accent]-400 to-[accent]-200 bg-clip-text text-transparent
- Subtle glow: shadow-[0_0_30px_-5px] shadow-[accent]-500/20

COMPONENT STYLING:
- Buttons: rounded-xl font-semibold text-sm cursor-pointer
  Primary: bg-[accent]-500 text-white hover:bg-[accent]-600
  Secondary: bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700
  Ghost: text-gray-400 hover:text-gray-200 hover:bg-gray-800
- Inputs: rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-[accent]-500 focus:ring-1 focus:ring-[accent]-500 outline-none
- Badges: rounded-full px-2.5 py-0.5 text-xs font-medium
- Avatars: rounded-full bg-gray-800 flex items-center justify-center text-gray-400 font-semibold

ICONS:
- Use Remix Icon: <i className="ri-[name] text-lg"></i>
- Always wrap icons: <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[accent]-500/20"><i className="ri-[name] text-[accent]-500 text-lg"></i></div>

───────────────────────────────────────
COMPONENT ARCHITECTURE
───────────────────────────────────────
Split the app into named React components. Every component must handle:
1. Loading state (skeleton or spinner)
2. Empty state (helpful message + CTA)
3. Error state (message + retry button)
4. Success state (the actual content)

Use React 19 patterns:
- Functional components with hooks
- useState, useEffect, useMemo, useCallback, useRef
- Controlled forms with validation
- Custom hooks for reusable logic
- Event handlers: handle[Action] naming

MOCK DATA (MANDATORY):
- Include 8-20 realistic data items (users, products, orders, etc.)
- Real-sounding names, realistic numbers, proper dates
- Never empty/hardcoded — always show rich data

───────────────────────────────────────
RESPONSIVE DESIGN
───────────────────────────────────────
- Mobile-first but desktop-optimized
- Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Stack on mobile: flex-col → lg:flex-row
- Tables: overflow-x-auto wrapper on mobile
- Font scaling: text-sm md:text-base, text-2xl md:text-4xl
- Padding scaling: px-4 md:px-6, py-8 md:py-16

───────────────────────────────────────
INTERACTIONS
───────────────────────────────────────
- All buttons/links MUST do something real (toggle, navigate, filter, submit)
- Modals: backdrop blur, Escape to close, click outside to close, animate in
- Dropdowns: click to toggle, close on outside click
- Tabs: smooth content switching
- Forms: validate on submit, show error messages
- Toast notifications: auto-dismiss after 3s
- Toggle switches: smooth transitions
- Search/filter: real-time filtering of mock data
- Pagination: if list > 6 items

───────────────────────────────────────
ACCESSIBILITY
───────────────────────────────────────
- focus-visible rings on all interactive elements
- aria-label on icon-only buttons
- label + htmlFor on all form inputs
- Semantic HTML: nav, main, section, article, header, footer
- alt text on images

───────────────────────────────────────
FINAL RULES
───────────────────────────────────────
- Return ONLY the complete HTML code inside a code block (\`\`\`html ... \`\`\`). No explanation before or after.
- The HTML must work immediately when opened in a browser — no build step needed.
- When iterating/modifying: return the FULL updated file, never a diff.
- Build something impressive — real data, real interactions, real design.`;

const BROWSER_EXTENSION_SYSTEM_PROMPT = `You are an expert browser extension builder called CreAIlity. The user will describe a Chrome/Firefox browser extension they want you to build. Generate a complete, ready-to-load browser extension package.

CRITICAL RULES:
- Output a JSON object containing ALL extension files as key-value pairs where key = filename and value = file content string
- Always include these files at minimum: manifest.json, popup/popup.html, popup/popup.js
- Include popup/popup.css ONLY if the popup has more than trivial styling
- Include background/background.js ONLY if the extension needs service worker background tasks (alarms, message passing, event listeners)
- Include content/content.js ONLY if the extension interacts with or modifies web pages
- Include content/content.css ONLY if content scripts inject visible UI into pages
- Use Manifest V3 format ALWAYS:
  {
    "manifest_version": 3,
    "name": "...",
    "version": "1.0.0",
    "description": "...",
    "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" },
    "action": { "default_popup": "popup/popup.html", "default_title": "..." },
    "permissions": [...],
    "background": { "service_worker": "background/background.js" },
    "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/content.js"], "css": ["content/content.css"] }]
  }

PERMISSIONS — Only include what is actually needed:
- "storage" — if extension saves user preferences/settings/state
- "activeTab" — if extension acts on the current tab only (preferred over tabs when possible)
- "tabs" — if extension needs to query/manage all tabs
- "scripting" — if extension injects scripts programmatically (not via content_scripts declaration)
- "notifications" — if extension shows system notifications
- "alarms" — if extension needs periodic background tasks
- "contextMenus" — if extension adds right-click menu items
- "clipboardRead" / "clipboardWrite" — only if copy/paste features exist
- NEVER request more permissions than the extension actually uses

POPUP UI DESIGN:
- Make popup beautiful and polished — this is the user's main interaction point
- Popup width should be 320-400px (set body width in popup.html CSS, NOT via manifest)
- Use a cohesive dark theme: background #0f0f0f or #1a1a2e, cards #1e1e2e or #16213e, text #e0e0e0
- Use clear headings, proper spacing (padding: 16px), and visual hierarchy
- Include the extension name as a header in the popup
- Use Google Fonts via @import in popup CSS: e.g. @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
- Add subtle hover effects, smooth transitions (transition: all 0.2s ease)
- All interactive elements must have cursor:pointer
- Buttons should be clearly tappable (min 32px height, proper padding)
- Include status indicators, toggles, or action buttons as appropriate
- Use emoji sparingly for visual accents if it fits the extension theme
- Round corners: 8px for cards, 6px for buttons, full for pills
- No external CDN dependencies — everything must be self-contained in the extension files

FUNCTIONALITY REQUIREMENTS:
- The extension MUST work — not just be a UI skeleton
- All buttons should do something real: save to chrome.storage, send messages, modify the page, etc.
- Use chrome.storage.sync for preferences (synced across devices), chrome.storage.local for larger/temporary data
- Content scripts must scope CSS carefully to avoid breaking host pages (use unique class prefixes)
- Background service workers should handle chrome.runtime.onMessage for popup↔background↔content communication
- Add error handling (try/catch) around all chrome API calls with user-friendly fallback messages
- If the extension manipulates DOM on pages, use MutationObserver pattern where appropriate

JAVASCRIPT PATTERNS:
- Use modern ES6+ syntax (const/let, arrow functions, async/await, template literals)
- Use event delegation for dynamic elements
- Store DOM references at the top of each file
- Wrap all popup logic in DOMContentLoaded
- For content scripts, wrap everything in an IIFE to avoid global scope pollution
- Use chrome.runtime.sendMessage for popup→background communication
- Use chrome.tabs.sendMessage for background→content script communication
- Use chrome.runtime.onMessage.addListener for receiving messages

IMPORTANT:
- Return ONLY a JSON code block: \`\`\`json { "manifest.json": "...", "popup/popup.html": "..." } \`\`\`
- ALL file content values must be properly JSON-escaped (escape double quotes, newlines, backslashes)
- Do NOT include any explanation before or after the JSON code block
- When iterating/changing: return the FULL updated file set, not just modified files
- The JSON must be valid and parseable — double-check all escape sequences`;

const REACT_APP_SYSTEM_PROMPT = `You are an expert full-stack AI software engineer called CreAIlity. Your job is to build production-quality, high-end React + TypeScript + Tailwind CSS web applications from user descriptions. The code you write must be indistinguishable from code written by a senior staff engineer at a top tech company.

═══════════════════════════════════════
CRITICAL OUTPUT FORMAT
═══════════════════════════════════════
Output a JSON object containing ALL project files as key-value pairs.
Key = file path (relative to project root, forward slashes).
Value = file content string (properly JSON-escaped).

ALWAYS include these minimum files:
- index.html — entry HTML with <div id="root">
- package.json — react 19, react-dom 19, react-router-dom 7, @tanstack/react-query 5, vite, tailwindcss, typescript
- vite.config.ts — Vite with React plugin, path aliases (@/ → ./src/)
- tsconfig.json + tsconfig.app.json — standard React TS config
- tailwind.config.ts — Tailwind v3 with content paths pointing to ./src
- postcss.config.ts — tailwindcss + autoprefixer
- src/main.tsx — renders <App /> into root with StrictMode
- src/App.tsx — main App with BrowserRouter, Routes, global layout
- src/index.css — @tailwind base/components/utilities + any global styles

Generate 5-15 additional component files based on app complexity.

DESIGN & VISUAL — DARK THEME MANDATORY, use gray-950 canvas, gray-900 cards, accent color (NOT blue/purple), Inter font, Remix Icons.

COMPONENT ARCHITECTURE: Every component must handle loading, empty, error, success states.

MOCK DATA: Include 8-20 realistic items in src/data/mockData.ts.

RESPONSIVE: Desktop-first, grid-cols-1 sm:grid-cols-2 lg:grid-cols-3, flex-col → lg:flex-row.

FINAL RULES: Return ONLY a JSON code block \`\`\`json { "index.html": "...", ... } \`\`\`. ALL values properly escaped. NO explanations.`;

const SYSTEM_PROMPT = WEB_APP_SYSTEM_PROMPT;

interface ApiCallOptions {
  config: StoredConfig;
  prompt: string;
  conversationHistory: ConversationMessage[];
  buildMode?: BuildMode;
  onStep?: (step: string) => void;
}

export async function generateCode({ config, prompt, conversationHistory, buildMode = "web-app", onStep }: ApiCallOptions): Promise<string> {
  const modelId = config.selectedModel;
  let apiKey = config.apiKeys[modelId];
  const baseUrl = config.baseUrls[modelId];

  if (!apiKey && modelId === "gpt-4o") {
    const platformKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (platformKey) {
      apiKey = platformKey;
    }
  }

  if (!apiKey) {
    throw new Error(`No API key configured for the selected model. Open model settings and add your key.`);
  }

  onStep?.("Connecting to AI model...");

  const systemPrompt = buildMode === "browser-extension"
    ? BROWSER_EXTENSION_SYSTEM_PROMPT
    : buildMode === "react-app"
    ? REACT_APP_SYSTEM_PROMPT
    : WEB_APP_SYSTEM_PROMPT;

  const userMessage = conversationHistory.length === 0
    ? buildMode === "browser-extension"
      ? `Build me a Chrome browser extension with the following requirements:\n\n${prompt}`
      : buildMode === "react-app"
      ? `Build me a full-stack React application with the following requirements:\n\n${prompt}`
      : `Build me an app with the following requirements:\n\n${prompt}`
    : prompt;

  const allMessages: ConversationMessage[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  switch (modelId) {
    case "gpt-4o":
      return callOpenAICompatible({
        apiKey,
        baseUrl: baseUrl || "https://api.openai.com/v1",
        model: "gpt-4o",
        systemPrompt,
        messages: allMessages,
        onStep,
      });

    case "deepseek-v3":
      return callOpenAICompatible({
        apiKey,
        baseUrl: baseUrl || "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        systemPrompt,
        messages: allMessages,
        onStep,
      });

    case "grok-3":
      return callOpenAICompatible({
        apiKey,
        baseUrl: baseUrl || "https://api.x.ai/v1",
        model: "grok-3",
        systemPrompt,
        messages: allMessages,
        onStep,
      });

    case "claude-3.5-sonnet":
      return callAnthropic({
        apiKey,
        baseUrl: baseUrl || "https://api.anthropic.com/v1",
        model: "claude-3-5-sonnet-20241022",
        system: systemPrompt,
        messages: allMessages,
        onStep,
      });

    case "gemini-2.0-flash":
      return callGemini({
        apiKey,
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
        messages: allMessages,
        onStep,
      });

    default:
      throw new Error(`Unknown model: ${modelId}`);
  }
}

function extractHtmlCode(text: string): string {
  const match = text.match(/```html\s*([\s\S]*?)```/);
  if (match) return match[1].trim();

  const match2 = text.match(/```\s*([\s\S]*?)```/);
  if (match2) return match2[1].trim();

  if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
    const start = text.indexOf("<!DOCTYPE") >= 0 ? text.indexOf("<!DOCTYPE") : text.indexOf("<html");
    const end = text.lastIndexOf("</html>") + 7;
    if (end > start) return text.slice(start, end).trim();
  }

  return text.trim();
}

export interface ExtensionFile {
  name: string;
  content: string;
  language: string;
}

export function extractExtensionFiles(text: string): ExtensionFile[] | null {
  const match = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const jsonStr = match ? match[1] : text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const files: ExtensionFile[] = [];
    for (const [filename, content] of Object.entries(parsed)) {
      if (typeof content !== "string") continue;
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const langMap: Record<string, string> = {
        json: "json",
        js: "javascript",
        ts: "typescript",
        html: "html",
        css: "css",
        md: "markdown",
      };
      files.push({
        name: filename,
        content,
        language: langMap[ext] || "plaintext",
      });
    }
    return files.length > 0 ? files : null;
  } catch {
    return null;
  }
}

interface OpenAIParams {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: ConversationMessage[];
  onStep?: (step: string) => void;
}

async function callOpenAICompatible({ apiKey, baseUrl, model, systemPrompt, messages, onStep }: OpenAIParams): Promise<string> {
  onStep?.("Sending request to AI...");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 8192,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  onStep?.("Receiving generated code...");

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  return extractHtmlCode(content);
}

interface AnthropicParams {
  apiKey: string;
  baseUrl: string;
  model: string;
  system: string;
  messages: ConversationMessage[];
  onStep?: (step: string) => void;
}

async function callAnthropic({ apiKey, baseUrl, model, system, messages, onStep }: AnthropicParams): Promise<string> {
  onStep?.("Sending request to Claude...");

  const res = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  onStep?.("Receiving generated code...");

  const data = await res.json();
  const content = data.content?.[0]?.text || "";

  return extractHtmlCode(content);
}

interface GeminiParams {
  apiKey: string;
  model: string;
  systemInstruction: string;
  messages: ConversationMessage[];
  onStep?: (step: string) => void;
}

async function callGemini({ apiKey, model, systemInstruction, messages, onStep }: GeminiParams): Promise<string> {
  onStep?.("Sending request to Gemini...");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiContents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        role: "user",
        parts: [{ text: systemInstruction }],
      },
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  onStep?.("Receiving generated code...");

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return extractHtmlCode(content);
}