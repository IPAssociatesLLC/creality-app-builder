import type { ConversationMessage } from "@/utils/ai-api";
import { supabase } from "@/lib/supabase";

export interface ProjectVersion {
  id: string;
  projectId: string;
  code: string;
  label: string;
  timestamp: number;
  prompt: string;
  versionNumber?: number;
}

export interface ImportedFile {
  name: string;
  content: string;
  language: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  generatedCode: string | null;
  conversationHistory: ConversationMessage[];
  customDomain?: string;
  previewSlug?: string;
  versions: ProjectVersion[];
  activeVersionId: string | null;
  importedFiles: ImportedFile[];
}

// ── Supabase-backed project operations (NO localStorage) ──

export async function listProjects(): Promise<Project[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("CreAIlity: failed to list projects", error);
    return [];
  }

  return ((data || []) as Record<string, unknown>[]).map(rowToProject).filter((p): p is Project => p !== null);
}

export async function loadProject(id: string): Promise<Project | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToProject(data as Record<string, unknown>);
}

export async function createProject(name: string): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    generatedCode: null,
    conversationHistory: [],
    previewSlug: id,
    versions: [],
    activeVersionId: null,
    importedFiles: [],
  };

  if (userId) {
    const { error } = await supabase.from("projects").insert({
      id,
      user_id: userId,
      name,
      generated_code: null,
      conversation_history: [],
      imported_files: [],
      preview_slug: id,
      custom_domain: null,
      created_at: now,
      updated_at: now,
    });

    if (error) console.warn("CreAIlity: failed to create project in Supabase", error);
  }

  return project;
}

export async function saveProject(project: Project): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) return;

  const { error } = await supabase.from("projects").upsert({
    id: project.id,
    user_id: userId,
    name: project.name,
    generated_code: project.generatedCode,
    conversation_history: project.conversationHistory || [],
    imported_files: project.importedFiles || [],
    preview_slug: project.previewSlug || project.id,
    custom_domain: project.customDomain || null,
    created_at: new Date(project.createdAt).toISOString(),
    updated_at: new Date(Date.now()).toISOString(),
  }, { onConflict: "id" });

  if (error) console.warn("CreAIlity: failed to save project to Supabase", error);
}

export async function deleteProject(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) return;

  await supabase.from("projects").delete().eq("id", id).eq("user_id", userId);
  await supabase.from("project_versions").delete().eq("project_id", id);
  await supabase.from("sandbox_deployments").delete().eq("project_id", id);
}

// ── Version history (Supabase-backed with sequential numbering) ──

export async function saveVersion(
  projectId: string,
  code: string,
  label: string,
  prompt: string,
): Promise<ProjectVersion> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  let nextNumber = 1;
  if (userId) {
    const { data, error } = await supabase
      .from("project_versions")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0 && data[0].version_number !== null) {
      nextNumber = ((data[0] as Record<string, unknown>).version_number as number) + 1;
    }
  }

  const version: ProjectVersion = {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    code,
    label,
    timestamp: Date.now(),
    prompt,
    versionNumber: nextNumber,
  };

  if (userId) {
    await supabase.from("project_versions").insert({
      id: version.id,
      project_id: projectId,
      user_id: userId,
      code,
      label,
      timestamp: new Date(version.timestamp).toISOString(),
      prompt,
      version_number: nextNumber,
    });
  }

  return version;
}

export async function getVersions(projectId: string): Promise<ProjectVersion[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((v) => ({
    id: v.id as string,
    projectId: v.project_id as string,
    code: v.code as string,
    label: v.label as string,
    timestamp: new Date(v.timestamp as string).getTime(),
    prompt: (v.prompt as string) || "",
    versionNumber: (v.version_number as number) || undefined,
  }));
}

export async function restoreVersion(projectId: string, versionId: string): Promise<Project | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const versions = await getVersions(projectId);
  const version = versions.find((v) => v.id === versionId);
  if (!version) return null;

  if (userId) {
    let updateObj: any = {
      updated_at: new Date().toISOString(),
    };

    try {
      const parsed = JSON.parse(version.code);
      if (Array.isArray(parsed) && parsed.length > 0 && "content" in parsed[0]) {
        updateObj.imported_files = parsed;
        updateObj.generated_code = "";
      } else {
        updateObj.generated_code = version.code;
        updateObj.imported_files = [];
      }
    } catch {
      updateObj.generated_code = version.code;
      updateObj.imported_files = [];
    }

    await supabase.from("projects").update(updateObj).eq("id", projectId).eq("user_id", userId);
  }

  const project = await loadProject(projectId);
  if (project) {
    project.activeVersionId = versionId;
  }
  return project;
}

export async function deleteVersion(projectId: string, versionId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) return;

  await supabase.from("project_versions").delete().eq("id", versionId).eq("user_id", userId);
}

// ── Internal helpers ──

function rowToProject(row: Record<string, unknown>): Project | null {
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id as string,
    name: (row.name as string) || "Untitled",
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
    generatedCode: (row.generated_code as string) || null,
    conversationHistory: (row.conversation_history as ConversationMessage[]) || [],
    previewSlug: (row.preview_slug as string) || (row.id as string),
    customDomain: (row.custom_domain as string) || undefined,
    versions: [],
    activeVersionId: null,
    importedFiles: (row.imported_files as ImportedFile[]) || [],
  };
}

// ── Formatting helpers ──

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatVersionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateVersionLabel(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 40) return cleaned;
  return `${cleaned.slice(0, 37)}...`;
}

// ── Conversation persistence (Supabase-backed, full history) ──

export async function getOrCreateConversation(projectId: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) return existing.id as string;

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        project_id: projectId,
        user_id: user.id,
        title: "New conversation",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("CreAIlity: failed to create conversation", error);
      return null;
    }
    return created.id as string;
  } catch (err) {
    console.warn("CreAIlity: getOrCreateConversation failed", err);
    return null;
  }
}

export async function saveMessage(
  conversationId: string | null,
  role: "user" | "assistant",
  content: string,
  tokensUsed?: number,
): Promise<void> {
  if (!conversationId) return;
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role,
    content,
    tokens_used: tokensUsed ?? null,
  });
  if (error) console.warn("CreAIlity: failed to save message", error);
}

export async function loadConversationMessages(
  conversationId: string | null,
  maxMessages: number = 50,
): Promise<ConversationMessage[]> {
  if (!conversationId) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(maxMessages);

  if (error) {
    console.warn("CreAIlity: failed to load messages", error);
    return [];
  }

  // Reverse to chronological order
  return ((data || []) as { role: string; content: string }[]).reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function getConversationSummary(
  conversationId: string | null,
): Promise<string> {
  if (!conversationId) return "";
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("summary")
      .eq("id", conversationId)
      .maybeSingle();

    if (error || !data) return "";
    return (data as Record<string, unknown>).summary as string || "";
  } catch {
    return "";
  }
}

export async function countConversationMessages(
  conversationId: string | null,
): Promise<number> {
  if (!conversationId) return 0;
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// Build a project context snapshot so the AI always knows the current file state
export function buildProjectContext(files: ImportedFile[], generatedCode?: string | null): string {
  const parts: string[] = [];

  if (generatedCode) {
    parts.push(`[Generated HTML (single-file app)]\nLength: ${generatedCode.length} chars\n\`\`\`html\n${generatedCode}\n\`\`\``);
  }

  if (files && files.length > 0) {
    parts.push(`[Project Files — ${files.length} total]`);
    for (const file of files) {
      parts.push(`\n--- FILE: ${file.name} ---\n\`\`\`${file.language}\n${file.content}\n\`\`\``);
    }
  }

  return parts.join("\n");
}

// ── Plan enforcement ──

export interface UserPlan {
  tier: "free" | "pro" | "byok" | "hosting";
  status: "active" | "trial" | "cancelled" | "expired";
  creditsRemaining: number;
  creditsMonthly: number;
  projectsLimit: number;
}

export async function getUserPlan(): Promise<UserPlan | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("user_plans")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) return defaultFreePlan();

    return {
      tier: data.plan_tier as UserPlan["tier"],
      status: data.status as UserPlan["status"],
      creditsRemaining: data.credits_remaining as number,
      creditsMonthly: data.credits_monthly as number,
      projectsLimit: data.projects_limit as number,
    };
  } catch (err) {
    console.warn("CreAIlity: getUserPlan failed", err);
    return null;
  }
}

// incrementBuildCount has been removed

function defaultFreePlan(): UserPlan {
  return {
    tier: "free",
    status: "active",
    creditsRemaining: 20,
    creditsMonthly: 20,
    projectsLimit: 3,
  };
}

export async function countUserProjects(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Credit & build enforcement ──

export async function checkCanBuild(): Promise<{ allowed: boolean; reason: string }> {
  const plan = await getUserPlan();
  if (!plan) return { allowed: true, reason: "" };

  // Block cancelled/expired plans
  if (plan.status === "cancelled" || plan.status === "expired") {
    return { allowed: false, reason: `Your ${plan.tier} subscription has ${plan.status}. Please renew to continue building.` };
  }

  // BYOK: unlimited, no credit checks
  if (plan.tier === "byok") return { allowed: true, reason: "" };

  // Hosting: no builds allowed
  if (plan.tier === "hosting") return { allowed: false, reason: "Hosting plan does not include AI credits. Upgrade to Pro or BYOK to build apps." };

  // Check credits remaining (applies to Free and Pro)
  if (plan.creditsRemaining <= 0) {
    return { allowed: false, reason: `You're out of credits. Your plan resets monthly with ${plan.creditsMonthly} credits.` };
  }

  return { allowed: true, reason: "" };
}

export async function getModelCreditCost(modelId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", `model_cost_${modelId}`)
      .maybeSingle();
    if (data?.value) return parseInt(data.value as string) || 3;
  } catch { /* fall through */ }

  // Default costs by model
  const defaults: Record<string, number> = {
    "gpt-4o": 3,
    "claude-3.5-sonnet": 5,
    "gemini-2.0-flash": 2,
    "deepseek-v3": 2,
    "grok-3": 4,
  };
  return defaults[modelId] || 3;
}

export async function deductCredits(amount: number): Promise<{ success: boolean; remaining: number }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, remaining: 0 };

    const { data: plan, error } = await supabase
      .from("user_plans")
      .select("credits_remaining")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !plan) return { success: false, remaining: 0 };

    const newRemaining = Math.max(0, (plan.credits_remaining as number || 0) - amount);

    await supabase
      .from("user_plans")
      .update({ credits_remaining: newRemaining, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return { success: true, remaining: newRemaining };
  } catch {
    return { success: false, remaining: 0 };
  }
}

// ── Prompt optimization ──

export async function optimizePrompt(raw: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return raw;

  try {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body: {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a prompt optimizer for an AI app builder. Take the user's vague prompt and turn it into a highly specific, detailed prompt that will produce the best possible web app. Include details about layout, colors, features, interactions, responsiveness, and UI components. Keep it under 300 words. Output ONLY the optimized prompt, no explanations.",
          },
          { role: "user", content: raw },
        ],
      },
    });

    if (error || !data?.choices?.[0]?.message?.content) return raw;
    return data.choices[0].message.content.trim();
  } catch {
    return raw;
  }
}