import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secrets from environment (set by user in Supabase dashboard)
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "";
const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") || "";

// KV namespace ID — fetched dynamically from platform_config on first deploy
// (set automatically by deploy-worker during setup, no manual env var needed)
let cachedKVNamespaceId: string | null = null;
async function getKVNamespaceId(supabaseAdmin: SupabaseClient): Promise<string> {
  if (cachedKVNamespaceId !== null) return cachedKVNamespaceId;

  // Try env var first (allows manual override)
  const envId = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") || "";
  if (envId) {
    cachedKVNamespaceId = envId;
    return envId;
  }

  // Fall back to platform_config (auto-set by deploy-worker)
  try {
    const { data, error } = await supabaseAdmin
      .from("platform_config")
      .select("value")
      .eq("key", "CLOUDFLARE_KV_NAMESPACE_ID")
      .maybeSingle();

    if (!error && data?.value) {
      cachedKVNamespaceId = data.value;
      return data.value;
    }
  } catch {
    // Platform config might not exist yet — deploy-worker hasn't run
  }

  return "";
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
    const { projectId, files, slug: customSlug, projectName } = body;

    if (!projectId || !files || !Array.isArray(files)) {
      return new Response(JSON.stringify({ error: "Missing projectId or files" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectErr } = await supabaseAdmin
      .from("projects")
      .select("id, user_id, name")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseSlug = (customSlug || projectName || project.name || "app")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);

    const { data: slugConflict } = await supabaseAdmin
      .from("sandbox_deployments")
      .select("id")
      .eq("slug", baseSlug)
      .neq("project_id", projectId)
      .maybeSingle();

    const finalSlug = slugConflict
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug;

    // Dynamically fetch KV namespace ID (from platform_config set by deploy-worker)
    const kvNamespaceId = await getKVNamespaceId(supabaseAdmin);

    let deployUrl = `https://${finalSlug}.crealityapp.com`;

    if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN && kvNamespaceId) {
      // ── Direct KV write via Cloudflare API ──
      const maxTotalSize = 25 * 1024 * 1024; // 25MB

      for (const file of files) {
        const path = file.name.startsWith("/") ? file.name : `/${file.name}`;
        const key = `app:${finalSlug}:${path}`;
        const content = typeof file.content === "string" ? file.content : JSON.stringify(file.content);

        if (content.length > maxTotalSize) {
          return new Response(JSON.stringify({ error: "Total file size exceeds 25MB" }), {
            status: 413,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await putKV(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, kvNamespaceId, key, content);
      }

      // Ensure index.html exists
      const hasIndex = files.some((f) => f.name === "index.html" || f.name === "/index.html");
      if (!hasIndex && files.length === 1) {
        const f = files[0];
        const content = typeof f.content === "string" ? f.content : JSON.stringify(f.content);
        await putKV(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, kvNamespaceId, `app:${finalSlug}:/index.html`, content);
      }
    } else {
      // ── Fallback: deploy via the Cloudflare Worker API ──
      const workerUrl = Deno.env.get("CLOUDFLARE_WORKER_URL") || "";
      const workerSecret = Deno.env.get("CLOUDFLARE_WORKER_SECRET") || "";

      if (workerUrl && workerSecret) {
        const deployRes = await fetch(`${workerUrl}/api/deploy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${workerSecret}`,
          },
          body: JSON.stringify({
            userId: user.id,
            projectId,
            slug: finalSlug,
            files,
          }),
        });

        if (!deployRes.ok) {
          const errText = await deployRes.text();
          return new Response(JSON.stringify({ error: `Sandbox deploy failed: ${errText}` }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const deployData = await deployRes.json();
        deployUrl = deployData.url || deployUrl;
      } else {
        // Neither KV nor Worker URL is configured — deploy-worker setup hasn't run yet
        return new Response(JSON.stringify({
          error: "Cloudflare publishing not yet configured",
          action: "Run the deploy-worker setup first to create KV namespace and deploy the edge worker",
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Update Supabase records ──
    const { data: existing } = await supabaseAdmin
      .from("sandbox_deployments")
      .select("id, slug")
      .eq("project_id", projectId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("sandbox_deployments")
        .update({
          slug: finalSlug,
          public_url: deployUrl,
          file_count: files.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("sandbox_deployments")
        .insert({
          project_id: projectId,
          user_id: user.id,
          slug: finalSlug,
          public_url: deployUrl,
          bundled_html: "",
          file_count: files.length,
        });
    }

    await supabaseAdmin
      .from("projects")
      .update({ preview_slug: finalSlug, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    return new Response(JSON.stringify({
      success: true,
      slug: finalSlug,
      url: deployUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function putKV(accountId: string, apiToken: string, namespaceId: string, key: string, value: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "text/plain",
    },
    body: value,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV put failed: ${res.status} ${text}`);
  }
}