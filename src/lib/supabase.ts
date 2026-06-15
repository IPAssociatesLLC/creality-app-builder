import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qyyfygcflzyfucypmfeu.supabase.co";
const supabaseAnonKey = "sb_publishable_wfxKd2WA0L1IGe4ptfxe8Q_Cg3TgX_m";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});