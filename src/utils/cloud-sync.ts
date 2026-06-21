let cloudUserId: string | null = null;

export function setCloudUser(id: string | null): void {
  cloudUserId = id;
}

export function getCloudUserId(): string | null {
  return cloudUserId;
}

export async function syncProjectsToCloud(userId?: string): Promise<void> {
  // Deprecated: projects are now stored directly in Supabase
}

export async function pullProjectsFromCloud(userId?: string): Promise<void> {
  // Deprecated: projects are now stored directly in Supabase
}

export function scheduleCloudSync(): void {
  // Deprecated: projects are now stored directly in Supabase
}