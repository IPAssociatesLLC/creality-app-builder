import type { ConversationMessage } from "@/utils/ai-api";
import { scheduleCloudSync } from "@/utils/cloud-sync";

export interface ProjectVersion {
  id: string;
  projectId: string;
  code: string;
  label: string;
  timestamp: number;
  prompt: string;
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

// ── Per-user sandboxing ──
// Each user's projects are stored under a user-scoped localStorage key.
// This prevents data leakage between different users on the same device.

const LEGACY_KEY = "creailty_projects_v1";
const KEY_PREFIX = "creailty_projects_v2";

let currentUserId: string | null = null;

function getStorageKey(): string {
  // If no user ID yet, use a temporary guest namespace
  const uid = currentUserId || "guest";
  return `${KEY_PREFIX}_${uid}`;
}

/**
 * Set the active user for localStorage sandboxing.
 * Migrates data from the old shared key on first run.
 */
export function setCurrentUserId(userId: string): void {
  if (currentUserId === userId) return;

  // Before switching users, persist current data
  if (currentUserId) {
    // No need to explicitly save - data was already saved during normal operations
  }

  currentUserId = userId;

  // Migration: if new user-scoped key is empty but legacy key has data, migrate it
  const newKey = getStorageKey();
  const legacyRaw = localStorage.getItem(LEGACY_KEY);

  if (legacyRaw && !localStorage.getItem(newKey)) {
    try {
      const legacy = JSON.parse(legacyRaw) as Record<string, Project>;
      // Only migrate if there's actual data
      const entries = Object.values(legacy);
      if (entries.length > 0) {
        localStorage.setItem(newKey, legacyRaw);
        // Keep legacy key as backup, don't delete it
      }
    } catch {
      // Corrupt legacy data, ignore
    }
  }
}

/**
 * Clear the active user. Call on logout to ensure clean state.
 */
export function clearCurrentUserId(): void {
  currentUserId = null;
}

export { setCloudUser, pullProjectsFromCloud } from "@/utils/cloud-sync";

export function getAllProjects(): Record<string, Project> {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Project>;
      // Migrate old projects without versions or importedFiles fields
      for (const id in parsed) {
        if (!Array.isArray(parsed[id].versions)) {
          parsed[id].versions = [];
        }
        if (parsed[id].activeVersionId === undefined) {
          parsed[id].activeVersionId = null;
        }
        if (!Array.isArray(parsed[id].importedFiles)) {
          parsed[id].importedFiles = [];
        }
      }
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function persistAllProjects(projects: Record<string, Project>): void {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(projects));
    // Trigger debounced cloud sync
    scheduleCloudSync();
  } catch (err) {
    console.warn("CreAIlity: failed to persist projects", err);
  }
}

export function createProject(name: string): Project {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  const all = getAllProjects();
  all[id] = project;
  persistAllProjects(all);
  return project;
}

export function saveProject(project: Project): void {
  const all = getAllProjects();
  all[project.id] = { ...project, updatedAt: Date.now() };
  persistAllProjects(all);
}

export function loadProject(id: string): Project | null {
  const all = getAllProjects();
  return all[id] ?? null;
}

export function listProjects(): Project[] {
  const all = getAllProjects();

  // Clean up ghost "New Project" entries that have no content
  let cleaned = false;
  for (const id in all) {
    const p = all[id];
    if (
      p.name === "New Project" &&
      !p.generatedCode &&
      p.conversationHistory.length === 0 &&
      p.versions.length === 0 &&
      (!p.importedFiles || p.importedFiles.length === 0)
    ) {
      delete all[id];
      cleaned = true;
    }
  }

  if (cleaned) {
    persistAllProjects(all);
  }

  return Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteProject(id: string): void {
  const all = getAllProjects();
  delete all[id];
  persistAllProjects(all);
}

// ── Version history ──

export function saveVersion(
  projectId: string,
  code: string,
  label: string,
  prompt: string,
): ProjectVersion {
  const all = getAllProjects();
  const project = all[projectId];
  if (!project) throw new Error("Project not found");

  const version: ProjectVersion = {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    projectId,
    code,
    label,
    timestamp: Date.now(),
    prompt,
  };

  project.versions = [version, ...project.versions].slice(0, 50); // Keep last 50
  project.updatedAt = Date.now();
  persistAllProjects(all);

  return version;
}

export function getVersions(projectId: string): ProjectVersion[] {
  const all = getAllProjects();
  return all[projectId]?.versions ?? [];
}

export function restoreVersion(projectId: string, versionId: string): Project | null {
  const all = getAllProjects();
  const project = all[projectId];
  if (!project) return null;

  const version = project.versions.find((v) => v.id === versionId);
  if (!version) return null;

  project.generatedCode = version.code;
  project.activeVersionId = versionId;
  project.updatedAt = Date.now();
  persistAllProjects(all);

  return { ...project };
}

export function deleteVersion(projectId: string, versionId: string): void {
  const all = getAllProjects();
  const project = all[projectId];
  if (!project) return;

  project.versions = project.versions.filter((v) => v.id !== versionId);
  if (project.activeVersionId === versionId) {
    project.activeVersionId = null;
  }
  project.updatedAt = Date.now();
  persistAllProjects(all);
}

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

/**
 * Generate a short label for a version based on the user prompt
 */
export function generateVersionLabel(prompt: string): string {
  // Clean up and truncate
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 40) return cleaned;
  return `${cleaned.slice(0, 37)}...`;
}