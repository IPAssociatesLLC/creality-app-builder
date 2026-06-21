import { supabase } from "@/lib/supabase";
import { loadUserSettings, saveUserSetting } from "@/utils/user-settings-store";
import {
  WEB_APP_SYSTEM_PROMPT,
  BROWSER_EXTENSION_SYSTEM_PROMPT,
  REACT_APP_SYSTEM_PROMPT,
  IMPORT_EDIT_SYSTEM_PROMPT
} from "@/utils/prompts";

export type BuildMode = "web-app" | "browser-extension" | "react-app" | "import-edit";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}



export interface SelectedModel {
  modelId: string;
}

export interface StoredConfig {
  selectedModel: string;
}

export async function loadConfig(): Promise<StoredConfig> {
  try {
    const settings = await loadUserSettings();
    if (settings.selected_model && typeof settings.selected_model === "object") {
      const sm = settings.selected_model as Record<string, unknown>;
      if (typeof sm.selectedModel === "string") {
        return { selectedModel: sm.selectedModel };
      }
    }
  } catch { /* fall through to default */ }
  return { selectedModel: "gpt-4o" };
}

export async function saveConfig(config: StoredConfig): Promise<void> {
  try {
    await saveUserSetting("selected_model", config);
  } catch (err) {
    console.warn("CreAIlity: failed to save model config", err);
  }
}

interface ApiCallOptions {
  config: StoredConfig;
  prompt: string;
  conversationHistory: ConversationMessage[];
  buildMode?: BuildMode;
  onStep?: (step: string) => void;
  projectContext?: string;
  conversationSummary?: string;
  conversationId?: string;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export async function generateCode({ config, prompt, conversationHistory, buildMode = "web-app", onStep, projectContext, conversationSummary, conversationId, stream, onToken }: ApiCallOptions): Promise<string> {
  const modelId = config.selectedModel;

  onStep?.("Connecting to AI model via secure proxy...");

  const systemPrompt = buildMode === "browser-extension"
    ? BROWSER_EXTENSION_SYSTEM_PROMPT
    : buildMode === "react-app"
    ? REACT_APP_SYSTEM_PROMPT
    : buildMode === "import-edit"
    ? IMPORT_EDIT_SYSTEM_PROMPT
    : WEB_APP_SYSTEM_PROMPT;

  const userMessage = conversationHistory.length === 0
    ? buildMode === "browser-extension"
      ? `Build me a Chrome browser extension with the following requirements:\n\n${prompt}`
      : buildMode === "react-app"
      ? `Build me a full-stack React application with the following requirements:\n\n${prompt}`
      : buildMode === "import-edit"
      ? `I have an existing project. Here are my requirements for changes:\n\n${prompt}`
      : `Build me an app with the following requirements:\n\n${prompt}`
    : prompt;

  onStep?.("Sending request to AI...");

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token || "";

  const supabaseUrl = "https://qyyfygcflzyfucypmfeu.supabase.co";
  if (!supabaseUrl) throw new Error("Missing Supabase URL");

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      modelId,
      prompt: userMessage,
      messages: conversationHistory,
      buildMode,
      systemPrompt,
      projectContext: projectContext || "",
      summary: conversationSummary || "",
      conversationId: conversationId || "",
      stream: stream || !!onToken,
    })
  });

  if (!res.ok) {
    let errMsg = "AI proxy request failed";
    try {
      const errBody = await res.json();
      errMsg = errBody.error || errBody.message || `Status: ${res.status}`;
    } catch {
      errMsg = `Status: ${res.status} - ` + await res.text();
    }
    throw new Error(errMsg);
  }

  onStep?.("Receiving generated code...");

  if (stream || !!onToken) {
    if (!res.body) throw new Error("No response body for streaming");
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (let line of lines) {
        line = line.trim();
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;
        
        try {
          const data = JSON.parse(dataStr);
          let textChunk = "";
          
          if (data.choices?.[0]?.delta?.content) {
            textChunk = data.choices[0].delta.content; // OpenAI
          } else if (data.type === "content_block_delta" && data.delta?.text) {
            textChunk = data.delta.text; // Anthropic
          } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            textChunk = data.candidates[0].content.parts[0].text; // Gemini
          }
          
          if (textChunk) {
            fullText += textChunk;
            onToken?.(textChunk);
          }
        } catch (e) {
          // Ignore JSON parse errors for incomplete chunks
        }
      }
    }
    
    return buildMode === "web-app" ? extractHtmlCode(fullText) : fullText;
  } else {
    const data = await res.json();
    const content = data?.content || "";
    if (data?.contextPruned) {
      console.log(`CreAIlity: Context pruned — kept ${data.messagesKept}/${data.messagesTotal} messages`);
    }
    return buildMode === "web-app" ? extractHtmlCode(content) : content;
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
  // Strategy 1: explicit ```json block
  let match = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  
  // Strategy 2: json inside generic code block
  if (!match) match = text.match(/```\s*(\{[\s\S]*?\})\s*```/);
  
  // Strategy 3: raw JSON object at start of text
  // Strategy 4: per-file code blocks (e.g. ```tsx:src/App.tsx ... ```)
  if (!match) {
    const fileBlockRegex = /```(?:(\w+)(?::([^\n]+))?)?\\s*\n([\s\S]*?)```/g;
    const files: ExtensionFile[] = [];
    let fbMatch: RegExpExecArray | null;
    while ((fbMatch = fileBlockRegex.exec(text)) !== null) {
      const lang = fbMatch[1] || "";
      const filename = fbMatch[2] || "";
      const content = fbMatch[3] || "";
      // Skip JSON blocks (handled above) and shell/output blocks
      if (lang === "json" || lang === "sh" || lang === "bash" || lang === "shell" || lang === "plaintext") continue;
      // Determine file extension from language
      if (!filename) {
        const langExt: Record<string, string> = {
          tsx: ".tsx", ts: ".ts", jsx: ".tsx", js: ".ts",
          html: ".html", css: ".css", scss: ".css",
        };
        const ext = langExt[lang] || "";
        if (!ext) continue;
        files.push({ name: `file${files.length}${ext}`, content: content.trim(), language: lang === "css" || lang === "scss" ? "css" : lang === "html" ? "html" : lang === "tsx" || lang === "ts" ? "typescript" : "javascript" });
      } else {
        const ext = filename.split('.').pop()?.toLowerCase() || "";
        const langMap: Record<string, string> = {
          json: "json", js: "javascript", jsx: "javascript",
          ts: "typescript", tsx: "typescript",
          html: "html", css: "css", md: "markdown",
        };
        files.push({ name: filename, content: content.trim(), language: langMap[ext] || "plaintext" });
      }
    }
    if (files.length > 1) return files;
    // Only use this strategy if we found at least 2 files (prevents false positives)
  }
  
  if (!match) {
    const startIdx = text.indexOf("{");
    const endIdx = text.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        const parsed = JSON.parse(text.slice(startIdx, endIdx + 1));
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          const files: ExtensionFile[] = [];
          for (const [filename, content] of Object.entries(parsed)) {
            if (typeof content !== "string") continue;
            const ext = filename.split(".").pop()?.toLowerCase() || "";
            const langMap: Record<string, string> = {
              json: "json", js: "javascript", jsx: "javascript",
              ts: "typescript", tsx: "typescript",
              html: "html", css: "css", md: "markdown",
            };
            files.push({ name: filename, content, language: langMap[ext] || "plaintext" });
          }
          return files.length > 0 ? files : null;
        }
      } catch {
        // fall through to null
      }
    }
  }

  const jsonStr = match ? match[1] : null;
  if (!jsonStr) return null;

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
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
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
    console.warn("CreAIlity: Failed to parse AI response as multi-file JSON. Response starts with:", text.slice(0, 200));
    return null;
  }
}

// ─── User API Key Management (Server-Side via Supabase) ────────

export interface UserApiKey {
  id: string;
  model_id: string;
  api_key: string;
  base_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserApiKeys(): Promise<UserApiKey[]> {
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("id, model_id, api_key, base_url, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as UserApiKey[];
}

export async function saveUserApiKey(modelId: string, apiKey: string, baseUrl?: string): Promise<void> {
  const existing = await supabase
    .from("user_api_keys")
    .select("id")
    .eq("model_id", modelId)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from("user_api_keys")
      .update({ api_key: apiKey, base_url: baseUrl || null, updated_at: new Date().toISOString() })
      .eq("id", existing.data.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_api_keys")
      .insert({ model_id: modelId, api_key: apiKey, base_url: baseUrl || null });
    if (error) throw error;
  }
}

export async function deleteUserApiKey(modelId: string): Promise<void> {
  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("model_id", modelId);
  if (error) throw error;
}