import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import {
  setCurrentUserId,
  clearCurrentUserId,
} from "@/utils/projects-store";
import {
  setCloudUser,
  pullProjectsFromCloud,
  syncProjectsToCloud,
} from "@/utils/cloud-sync";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state on mount (covers page refresh)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        // User is already logged in — set up sandbox + cloud sync
        initializeUserSandbox(s.user.id);
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        // Auth state changed to logged in — set up sandbox + cloud sync
        initializeUserSandbox(s.user.id);
      } else {
        // User signed out — clear sandbox
        clearCurrentUserId();
        setCloudUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Initialize per-user sandbox: scope localStorage + pull/push cloud data.
   * This runs on both fresh login AND page refresh when already authenticated.
   */
  const initializeUserSandbox = async (userId: string) => {
    setCloudUser(userId);
    setCurrentUserId(userId);

    // Pull cloud projects for cross-device sync
    try {
      await pullProjectsFromCloud(userId);
    } catch (err) {
      console.warn("CreAIlity: cloud pull failed on init", err);
    }

    // Push any local-only projects to cloud (first-time sync)
    try {
      await syncProjectsToCloud(userId);
    } catch (err) {
      console.warn("CreAIlity: cloud push failed on init", err);
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    // Push any unsaved local changes to cloud before signing out
    if (user) {
      try {
        await syncProjectsToCloud(user.id);
      } catch {
        // Best effort
      }
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    clearCurrentUserId();
    setCloudUser(null);
  }, [user]);

  return { user, session, loading, signIn, signUp, signOut };
}