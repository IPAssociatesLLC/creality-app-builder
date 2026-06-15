import { supabase } from "@/lib/supabase";
import type { Project, ProjectVersion, ImportedFile } from "@/utils/projects-store";
import {
  getAllProjects,
  persistAllProjects,
} from "@/utils/projects-store";

// ── Cloud user tracking ──

let cloudUserId: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function setCloudUser(id: string | null): void {
  cloudUserId = id;
}

export function getCloudUserId(): string | null {
  return cloudUserId;
}

// ── Cloud sync ──

export async function syncProjectsToCloud(userId?: string): Promise<void> {
  const uid = userId || cloudUserId;
  if (!uid) return;

  const projects = getAllProjects();

  for (const project of Object.values(projects)) {
    const { error: projectError } = await supabase.from("projects").upsert(
      {
        id: project.id,
        user_id: uid,
        name: project.name,
        generated_code: project.generatedCode,
        conversation_history: project.conversationHistory,
        imported_files: project.importedFiles || [],
        created_at: new Date(project.createdAt).toISOString(),
        updated_at: new Date(project.updatedAt).toISOString(),
        preview_slug: project.previewSlug || project.id,
        custom_domain: project.customDomain || null,
      },
      { onConflict: "id" },
    );

    if (projectError) {
      console.warn("CreAIlity: failed to sync project", project.id, projectError);
      continue;
    }

    // Sync versions
    if (project.versions.length > 0) {
      const versionRows = project.versions.map((v) => ({
        id: v.id,
        project_id: v.projectId,
        user_id: uid,
        code: v.code,
        label: v.label,
        timestamp: new Date(v.timestamp).toISOString(),
        prompt: v.prompt,
      }));

      const { error: versionError } = await supabase
        .from("project_versions")
        .upsert(versionRows, { onConflict: "id" });

      if (versionError) {
        console.warn(
          "CreAIlity: failed to sync versions for project",
          project.id,
          versionError,
        );
      }
    }
  }
}

export async function pullProjectsFromCloud(userId?: string): Promise<void> {
  const uid = userId || cloudUserId;
  if (!uid) return;

  const { data: cloudProjects, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", uid);

  if (fetchError) {
    console.warn("CreAIlity: failed to pull projects", fetchError);
    return;
  }

  if (!cloudProjects || cloudProjects.length === 0) {
    // No cloud projects — push local ones up instead
    await syncProjectsToCloud(uid);
    return;
  }

  const local = getAllProjects();

  for (const p of cloudProjects) {
    // Only pull if cloud version is newer or doesn't exist locally
    const localProject = local[p.id];
    const cloudUpdatedAt = new Date(p.updated_at).getTime();

    if (!localProject || cloudUpdatedAt > localProject.updatedAt) {
      // Pull versions
      const { data: versions } = await supabase
        .from("project_versions")
        .select("*")
        .eq("project_id", p.id)
        .order("timestamp", { ascending: false });

      local[p.id] = {
        id: p.id,
        name: p.name,
        createdAt: new Date(p.created_at).getTime(),
        updatedAt: cloudUpdatedAt,
        generatedCode: p.generated_code,
        conversationHistory: p.conversation_history || [],
        previewSlug: p.preview_slug || p.id,
        customDomain: p.custom_domain || undefined,
        versions: (versions || []).map((v: Record<string, unknown>) => ({
          id: v.id as string,
          projectId: v.project_id as string,
          code: v.code as string,
          label: v.label as string,
          timestamp: new Date(v.timestamp as string).getTime(),
          prompt: v.prompt as string,
        })),
        activeVersionId: null,
        importedFiles: (p.imported_files as ImportedFile[]) || [],
      };
    }
  }

  persistAllProjects(local);
}

// ── Debounced sync trigger (called from projects-store after every persist) ──

export function scheduleCloudSync(): void {
  if (!cloudUserId) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncProjectsToCloud().catch((err) =>
      console.warn("CreAIlity: background sync failed", err),
    );
  }, 2000);
}