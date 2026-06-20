import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

const MODEL_LIMITS: Record<string, { total: number; safeInput: number }> = {
  "gpt-4o": { total: 128000, safeInput: 100000 },
  "claude-3.5-sonnet": { total: 200000, safeInput: 160000 },
  "gemini-2.0-flash": { total: 1000000, safeInput: 500000 },
  "deepseek-v3": { total: 128000, safeInput: 100000 },
  "grok-3": { total: 128000, safeInput: 100000 },
};

// â”€â”€â”€ MESSAGE IMPORTANCE SCORING â”€â”€â”€
// Scores messages so important older ones survive pruning
const IMPORTANCE_MARKERS = [
  { pattern: /architecture|structure|component tree|routing|data flow|tech stack/i, weight: 5 },
  { pattern: /design system|color palette|typography|spacing|layout|dark theme/i, weight: 4 },
  { pattern: /database|schema|table|column|RLS|supabase\.from/i, weight: 5 },
  { pattern: /auth|login|signup|authentication|session|token/i, weight: 5 },
  { pattern: /payment|stripe|checkout|subscription|pricing/i, weight: 5 },
  { pattern: /bug|error|fix|break|doesn't work|not working|issue/i, weight: 6 },
  { pattern: /deploy|publish|hosting|domain|cloudflare/i, weight: 4 },
  { pattern: /decision|change|update|modify|add|remove|delete|create/i, weight: 3 },
  { pattern: /user preference|i want|i need|must have|important|critical|mandatory/i, weight: 6 },
  { pattern: /file|component|page|route|import|export/i, weight: 2 },
  { pattern: /seo|meta|schema|structured data|alt text/i, weight: 3 },
  { pattern: /ai chat|chat agent|chatbot|lead capture|conversation/i, weight: 4 },
  { pattern: /extension|chrome|firefox|browser extension|manifest/i, weight: 5 },
];

function scoreMessageImportance(content: string): number {
  let score = 1; // base score
  const lower = content.toLowerCase();
  for (const marker of IMPORTANCE_MARKERS) {
    if (marker.pattern.test(lower)) score += marker.weight;
  }
  // Longer substantive messages get a small bonus
  if (content.length > 200) score += 1;
  if (content.length > 500) score += 2;
  if (content.length > 1000) score += 3;
  return score;
}

// â”€â”€â”€ SMART DECISION LOG EXTRACTION â”€â”€â”€
function extractDecisions(messages: { role: string; content: string }[]): string {
  const decisions: string[] = [];
  
  for (const msg of messages) {
    const text = msg.content;
    const lower = text.toLowerCase();
    
    // Architecture decisions
    if (/(?:architecture|tech stack|framework) (?:decision|choice|pick|using|is)/i.test(text)) {
      const snippet = text.slice(0, 200).replace(/\n/g, " ");
      decisions.push(`ARCH: ${snippet}...`);
    }
    
    // File structure changes
    if (/(?:create|add|remove|delete|rename) (?:file|component|page|route)/i.test(text)) {
      const snippet = text.slice(0, 200).replace(/\n/g, " ");
      decisions.push(`FILE: ${snippet}...`);
    }
    
    // Design choices
    if (/(?:design|style|color|font|layout|theme) (?:decision|choice|picked|using|changed)/i.test(text)) {
      const snippet = text.slice(0, 200).replace(/\n/g, " ");
      decisions.push(`DESIGN: ${snippet}...`);
    }
    
    // Bug fixes
    if (/(?:fix|fixed|bug|issue|error) (?:was|in|with|the)/i.test(text) && msg.role === "assistant") {
      const snippet = text.slice(0, 200).replace(/\n/g, " ");
      decisions.push(`FIX: ${snippet}...`);
    }
  }
  
  if (decisions.length === 0) return "";
  return decisions.slice(-15).join("\n"); // Keep last 15 decisions
}

// â”€â”€â”€ SMART CONTEXT LAYERING (THE REAL UPGRADE) â”€â”€â”€
function buildSmartContext(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  projectContext: string,
  summary: string,
  decisionLog: string,
  modelId: string,
  userPrompt: string,
): { role: string; content: string }[] {
  const limit = MODEL_LIMITS[modelId] || MODEL_LIMITS["gpt-4o"];
  const maxInputTokens = limit.safeInput;

  // â”€â”€ LAYER 1: Decision Log (highest priority, always injected) â”€â”€
  const freshDecisions = extractDecisions(messages);
  const combinedDecisions = [decisionLog, freshDecisions].filter(Boolean).join("\n");
  
  // â”€â”€ LAYER 2: Project Blueprint (always injected) â”€â”€
  
  // â”€â”€ LAYER 3: Scoring & Smart Selection â”€â”€
  const scoredMessages = messages.map((m, idx) => ({
    ...m,
    score: scoreMessageImportance(m.content),
    index: idx,
  }));

  // Sort by importance (highest first) for high-priority messages
  const highPriority = scoredMessages
    .filter((m) => m.score >= 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .sort((a, b) => a.index - b.index); // restore chronological order

  const mediumPriority = scoredMessages
    .filter((m) => m.score >= 4 && m.score < 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .sort((a, b) => a.index - b.index);

  // Recent messages (last 30, regardless of score)
  const recentMessages = messages.slice(-30);

  // Merge: deduplicate while preserving order
  const seen = new Set<number>();
  const smartMessages: { role: string; content: string }[] = [];
  
  for (const m of highPriority) { seen.add(m.index); smartMessages.push({ role: m.role, content: m.content }); }
  for (const m of mediumPriority) { if (!seen.has(m.index)) { seen.add(m.index); smartMessages.push({ role: m.role, content: m.content }); } }
  for (const m of recentMessages.slice(-30)) { 
    const idx = messages.indexOf(m);
    if (idx >= 0 && !seen.has(idx)) { seen.add(idx); smartMessages.push({ role: m.role, content: m.content }); }
  }

  // â”€â”€ LAYER 4: Build Augmented System Prompt â”€â”€
  let augmentedSystem = systemPrompt;
  
  if (combinedDecisions) {
    augmentedSystem = `[CRITICAL â€” DECISION LOG]\nThe following key decisions were made during this project. NEVER contradict these unless the user explicitly asks:\n${combinedDecisions}\n\n---\n\n${augmentedSystem}`;
  }
  
  if (summary) {
    augmentedSystem = `[CONVERSATION SUMMARY]\n${summary}\n\n---\n\n${augmentedSystem}`;
  }
  
  if (projectContext) {
    augmentedSystem = `${augmentedSystem}\n\n[PROJECT BLUEPRINT â€” Current file structure & architecture]\n${projectContext}\n\nWhen modifying or creating files, reference these EXACT paths. Never create files that already exist unless asked to replace them.`;
  }
  
  augmentedSystem = `${augmentedSystem}\n\n[CONTEXT NOTE]\nYou are receiving: (1) all key decisions ever made, (2) the current project blueprint, (3) the most important messages from the full conversation history, and (4) all recent messages. You have MORE context than any other AI builder. USE IT.`;

  // â”€â”€ LAYER 5: Final Token Budget â”€â”€
  const systemTokens = estimateTokens(augmentedSystem);
  const promptTokens = estimateTokens(userPrompt);
  const reservedForResponse = 8192;
  let availableForMessages = maxInputTokens - systemTokens - promptTokens - reservedForResponse;
  if (availableForMessages < 4000) availableForMessages = 4000;

  // Trim smartMessages to fit budget
  let totalMsgTokens = 0;
  const finalMessages: { role: string; content: string }[] = [];
  const smartLen = smartMessages.length;
  
  // Take from end first (most recent + highest priority are near the end due to merging)
  for (let i = smartLen - 1; i >= 0; i--) {
    const tokens = estimateTokens(smartMessages[i].content);
    if (totalMsgTokens + tokens > availableForMessages) break;
    totalMsgTokens += tokens;
    finalMessages.unshift(smartMessages[i]);
  }

  console.log(`SmartContext: system=${systemTokens} prompt=${promptTokens} msgs=${totalMsgTokens}/${availableForMessages} final=${finalMessages.length}/${messages.length} highP=${highPriority.length} midP=${mediumPriority.length}`);

  return { augmentedSystem, finalMessages };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { modelId, prompt, messages, buildMode, systemPrompt, projectContext, summary, conversationId, stream } = body;

    if (!modelId || !prompt) {
      return new Response(JSON.stringify({ error: "Missing modelId or prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msgArray: { role: string; content: string }[] = Array.isArray(messages) ? messages : [];

    // â”€â”€â”€ LOAD DECISION LOG FROM DB â”€â”€â”€
    let decisionLog = "";
    if (conversationId) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select("decision_log")
        .eq("id", conversationId)
        .maybeSingle();
      decisionLog = conv?.decision_log || "";
    }

    // â”€â”€â”€ BUILD SMART CONTEXT (5-layer system) â”€â”€â”€
    const { augmentedSystem, finalMessages } = buildSmartContext(
      msgArray,
      systemPrompt || "",
      projectContext || "",
      summary || "",
      decisionLog,
      modelId,
      prompt,
    );

    // â”€â”€â”€ AUTO-DECISION LOG UPDATE â”€â”€â”€
    let newDecisionLog = decisionLog;
    if (conversationId && msgArray.length > 10) {
      const freshDecisions = extractDecisions(msgArray);
      if (freshDecisions && freshDecisions !== decisionLog) {
        newDecisionLog = freshDecisions;
        // Fire-and-forget update
        EdgeRuntime.waitUntil(
          supabaseAdmin
            .from("conversations")
            .update({ decision_log: newDecisionLog, updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("user_id", user.id)
            .then(() => console.log(`Decision log updated: ${newDecisionLog.length} chars`))
            .catch((e: Error) => console.warn("Decision log update failed:", e))
        );
      }
    }

    // â”€â”€â”€ AUTO-SUMMARIZATION â”€â”€â”€
    if (conversationId && msgArray.length > 50) {
      EdgeRuntime.waitUntil(
        autoSummarize(supabaseAdmin, conversationId, user.id, msgArray, modelId).catch((e: Error) =>
          console.warn("Auto-summarize failed:", e)
        )
      );
    }

    // â”€â”€â”€ API KEY RESOLUTION â”€â”€â”€
    let apiKey = "";
    let baseUrl = "";

    const { data: userKey } = await supabaseAdmin
      .from("user_api_keys")
      .select("api_key, base_url")
      .eq("user_id", user.id)
      .eq("model_id", modelId)
      .maybeSingle();

    if (userKey?.api_key) {
      apiKey = userKey.api_key;
      baseUrl = userKey.base_url || "";
    }

    if (!apiKey) {
      const platformKeyMap: Record<string, string> = {
        "gpt-4o": "platform_openai_key",
        "claude-3.5-sonnet": "platform_anthropic_key",
        "gemini-2.0-flash": "platform_gemini_key",
        "deepseek-v3": "platform_deepseek_key",
        "grok-3": "platform_xai_key",
      };

      const configKey = platformKeyMap[modelId];
      if (configKey) {
        const { data: platformConfig } = await supabaseAdmin
          .from("platform_config")
          .select("value")
          .eq("key", configKey)
          .maybeSingle();
        if (platformConfig?.value) apiKey = platformConfig.value;
      }

      if (!apiKey) {
        const envKeyMap: Record<string, string> = {
          "gpt-4o": Deno.env.get("PLATFORM_OPENAI_KEY") || "",
          "claude-3.5-sonnet": Deno.env.get("PLATFORM_ANTHROPIC_KEY") || "",
          "gemini-2.0-flash": Deno.env.get("PLATFORM_GEMINI_KEY") || "",
          "deepseek-v3": Deno.env.get("PLATFORM_DEEPSEEK_KEY") || "",
          "grok-3": Deno.env.get("PLATFORM_XAI_KEY") || "",
        };
        apiKey = envKeyMap[modelId] || "";
      }

      const baseUrlMap: Record<string, string> = {
        "gpt-4o": "https://api.openai.com/v1",
        "claude-3.5-sonnet": "https://api.anthropic.com/v1",
        "deepseek-v3": "https://api.deepseek.com/v1",
        "grok-3": "https://api.x.ai/v1",
      };
      baseUrl = baseUrlMap[modelId] || "";
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: `No API key available for ${modelId}. Add your key in Settings or contact the platform admin.`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: string;

    switch (modelId) {
      case "gpt-4o":
      case "deepseek-v3":
      case "grok-3":
        result = await callOpenAICompatible(apiKey, baseUrl, modelId, augmentedSystem, finalMessages, prompt, stream);
        break;
      case "claude-3.5-sonnet":
        result = await callAnthropic(apiKey, baseUrl, augmentedSystem, finalMessages, prompt, stream);
        break;
      case "gemini-2.0-flash":
        result = await callGemini(apiKey, augmentedSystem, finalMessages, prompt, stream);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown model: ${modelId}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (stream && result instanceof Response) {
      return new Response(result.body, {
        headers: { ...corsHeaders, "Content-Type": result.headers.get("Content-Type") || "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({
      content: result,
      contextPruned: finalMessages.length < msgArray.length,
      messagesKept: finalMessages.length,
      messagesTotal: msgArray.length,
      smartContext: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// â”€â”€â”€ API CALL FUNCTIONS â”€â”€â”€

async function callOpenAICompatible(
  apiKey: string, baseUrl: string, modelId: string,
  systemPrompt: string, messages: { role: string; content: string }[], userPrompt: string,
  stream?: boolean
): Promise<string | Response> {
  const modelMap: Record<string, string> = {
    "gpt-4o": "gpt-4o",
    "deepseek-v3": "deepseek-chat",
    "grok-3": "grok-3",
  };
  const model = modelMap[modelId] || modelId;

  const allMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userPrompt },
  ];

  const totalChars = allMessages.reduce((sum, m) => sum + m.content.length, 0);
  console.log(`OpenAI: ${allMessages.length} msgs, ~${Math.ceil(totalChars / 3.5)} est tokens`);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      max_tokens: 8192,
      temperature: 0.7,
      stream: !!stream,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  if (stream) return res;

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(
  apiKey: string, baseUrl: string, system: string,
  messages: { role: string; content: string }[], userPrompt: string,
  stream?: boolean
): Promise<string | Response> {
  const allMessages = [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userPrompt },
  ];

  const res = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      system,
      messages: allMessages,
      max_tokens: 8192,
      stream: !!stream,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  if (stream) return res;

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function callGemini(
  apiKey: string, systemInstruction: string,
  messages: { role: string; content: string }[], userPrompt: string,
  stream?: boolean
): Promise<string | Response> {
  const geminiContents = [
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  const endpoint = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:${endpoint}key=${apiKey}`,
    {
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
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 300)}`);
  }

  if (stream) return res;

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// â”€â”€â”€ AUTO-SUMMARIZATION â”€â”€â”€
async function autoSummarize(
  supabaseAdmin: any,
  conversationId: string,
  userId: string,
  messages: { role: string; content: string }[],
  modelId: string,
): Promise<void> {
  if (messages.length < 20) return;

  const splitPoint = Math.floor(messages.length * 0.6);
  const toSummarize = messages.slice(0, splitPoint);

  const summaryPrompt = `Summarize this conversation between a user and an AI app builder. Focus on: what was built, key design decisions, features implemented, user preferences, architecture choices, bugs encountered and fixed, and any ongoing issues. Be comprehensive but concise.

${toSummarize.map((m) => `${m.role === "user" ? "USER" : "AI"}: ${m.content.slice(0, 500)}`).join("\n\n")}

CONVERSATION SUMMARY:`;

  try {
    const apiKey = Deno.env.get("PLATFORM_OPENAI_KEY") || "";
    if (!apiKey) return;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You summarize AI builder conversations. Focus on decisions, architecture, features built, bugs fixed, and user preferences. Be concise." },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const summaryText = data.choices?.[0]?.message?.content || "";

    if (summaryText && summaryText.length > 20) {
      await supabaseAdmin
        .from("conversations")
        .update({ summary: summaryText, updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", userId);
      console.log(`Summarized conversation: ${summaryText.length} chars`);
    }
  } catch (err) {
    console.warn("Summarization failed:", err);
  }
}
