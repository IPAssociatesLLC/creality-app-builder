import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// CreAIlity Cloudflare Worker Deployer
// =============================================================================
// Deploys the worker + KV namespace + route to Cloudflare via API
// Auto-stores KV_NAMESPACE_ID in Supabase platform_config so publish-sandbox
// can pick it up without any extra manual secret configuration.
// =============================================================================

interface DeployRequest {
  accountId?: string;
  apiToken?: string;
  action?: "setup" | "deploy" | "verify";
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCRIPT_NAME = "creality-kv-worker";
const KV_NAMESPACE_TITLE = "creality-apps";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: DeployRequest = await req.json();
    const { accountId: bodyAccountId, apiToken: bodyToken, action = "setup" } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    let accountId = bodyAccountId || Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "";
    let apiToken = bodyToken || Deno.env.get("CLOUDFLARE_API_TOKEN") || "";

    if (!accountId) {
      const { data } = await sb.from("platform_config").select("value").eq("key", "cloudflare_account_id").maybeSingle();
      if (data?.value) accountId = data.value;
    }
    if (!apiToken) {
      const { data } = await sb.from("platform_config").select("value").eq("key", "cloudflare_api_token").maybeSingle();
      if (data?.value) apiToken = data.value;
    }

    if (!accountId || !apiToken) {
      return new Response(
        JSON.stringify({
          error: "Missing Cloudflare credentials",
          needed: {
            accountId: "From dashboard URL or Account Settings",
            apiToken: "Create at Profile > API Tokens > Custom Token",
            tokenPermissions: [
              "Account: Account Settings: Read",
              "Account: Workers Scripts: Edit",
              "Zone: Zone: Read (for custom domain)",
              "Zone: Zone Settings: Read (for custom domain)",
            ],
          },
        }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const cf = new CloudflareAPI(accountId, apiToken);

    const verifyResult = await cf.verifyToken();
    if (!verifyResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid API token", details: verifyResult.errors }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      return new Response(
        JSON.stringify({ success: true, message: "Token valid", account: verifyResult.result }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── KV Namespace: find or create ──
    let kvNamespaceId = "";
    const existingNamespaces = await cf.listKVNamespaces();
    const existing = existingNamespaces.find((n) => n.title === KV_NAMESPACE_TITLE);

    if (existing) {
      kvNamespaceId = existing.id;
    } else {
      const created = await cf.createKVNamespace(KV_NAMESPACE_TITLE);
      kvNamespaceId = created.id;
    }

    // ── Store KV namespace ID in Supabase platform_config ──
    await storeKVNamespaceId(kvNamespaceId);

    // ── Deploy worker script ──
    const workerCode = await getWorkerCode();
    
    // Check if worker secret is already in platform_config first to reuse it
    let workerSecret = Deno.env.get("CLOUDFLARE_WORKER_SECRET") || "";
    if (!workerSecret) {
      const { data: dbSecret } = await sb.from("platform_config").select("value").eq("key", "cloudflare_worker_secret").maybeSingle();
      if (dbSecret?.value) {
        workerSecret = dbSecret.value;
      } else {
        workerSecret = crypto.randomUUID();
        // Save to platform_config
        await sb.from("platform_config").upsert({
          key: "cloudflare_worker_secret",
          value: workerSecret,
          description: "Auto-generated Cloudflare deploy worker secret",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
      }
    }

    const deployResult = await cf.deployWorkerScript(SCRIPT_NAME, workerCode, {
      main_module: "index.js",
      bindings: [
        {
          name: "KV",
          type: "kv_namespace",
          namespace_id: kvNamespaceId,
        },
        {
          name: "DEPLOY_SECRET",
          type: "secret_text",
          text: workerSecret,
        },
      ],
      compatibility_date: "2026-06-16",
      compatibility_flags: ["nodejs_compat"],
    });

    // ── Route: *.crealityapp.com/* ──
    const routePattern = "*.crealityapp.com/*";
    const routes = await cf.listRoutes();
    const existingRoute = routes.find((r) => r.pattern === routePattern);

    if (!existingRoute) {
      await cf.createRoute(routePattern, SCRIPT_NAME);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Worker deployed successfully",
        kvNamespaceId,
        scriptName: SCRIPT_NAME,
        deployResult,
        nextStep: "KV namespace ID stored in platform_config. publish-sandbox is ready.",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

// ── Store KV namespace ID so publish-sandbox can read it ──
async function storeKVNamespaceId(kvNamespaceId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — KV namespace ID not persisted");
    return;
  }

  try {
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    await sb.from("platform_config").upsert(
      {
        key: "CLOUDFLARE_KV_NAMESPACE_ID",
        value: kvNamespaceId,
        description: "Auto-generated by deploy-worker setup",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    console.log(`KV namespace ID ${kvNamespaceId} stored in platform_config`);
  } catch (err) {
    console.error("Failed to store KV namespace ID:", err);
  }
}

// ── Cloudflare API helper ──
class CloudflareAPI {
  constructor(private accountId: string, private apiToken: string) {}

  private async fetch(path: string, options: RequestInit = {}) {
    const url = `https://api.cloudflare.com/client/v4${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });
    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return data;
  }

  async verifyToken() {
    return this.fetch("/user/tokens/verify", { method: "GET" });
  }

  async listKVNamespaces() {
    const data = await this.fetch(`/accounts/${this.accountId}/storage/kv/namespaces`);
    return (data.result || []) as Array<{ id: string; title: string }>;
  }

  async createKVNamespace(title: string) {
    const data = await this.fetch(`/accounts/${this.accountId}/storage/kv/namespaces`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return data.result as { id: string; title: string };
  }

  async deployWorkerScript(name: string, script: string, metadata: Record<string, unknown>) {
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("script", new Blob([script], { type: "application/javascript+module" }), "index.js");

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${name}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: form,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = { success: res.ok, status: res.status };
    }
    return data;
  }

  async listRoutes() {
    const data = await this.fetch(`/accounts/${this.accountId}/workers/routes`);
    return (data.result || []) as Array<{ id: string; pattern: string; script: string }>;
  }

  async createRoute(pattern: string, scriptName: string) {
    const data = await this.fetch(`/accounts/${this.accountId}/workers/routes`, {
      method: "POST",
      body: JSON.stringify({
        pattern,
        script: scriptName,
      }),
    });
    return data.result;
  }
}

// ── Worker code — inline fallback if cloudflare-worker.js isn't available ──
async function getWorkerCode(): Promise<string> {
  try {
    const code = await Deno.readTextFile("./cloudflare-worker.js");
    return code;
  } catch {
    return `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }
    if (hostname.endsWith(".crealityapp.com") && hostname !== "crealityapp.com") {
      const slug = hostname.split(".")[0];
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const key = \`app:\${slug}:\${path}\`;
      const value = await env.KV.get(key, "arrayBuffer");
      if (value) {
        const ct = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : "application/javascript";
        return new Response(value, { headers: { "Content-Type": ct, "Cache-Control": "max-age=3600" } });
      }
      const idx = \`app:\${slug}:/index.html\`;
      const iv = await env.KV.get(idx, "arrayBuffer");
      if (iv) return new Response(iv, { headers: { "Content-Type": "text/html", "Cache-Control": "max-age=3600" } });
    }
    if (hostname === "crealityapp.com" || hostname === "www.crealityapp.com") {
      return Response.redirect("https://crealityapp.com", 301);
    }
    const auth = request.headers.get("Authorization") || "";
    if (env.DEPLOY_SECRET && !auth.includes(env.DEPLOY_SECRET)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/api/deploy" && request.method === "POST") {
      const body = await request.json();
      for (const f of body.files || []) {
        const p = f.name.startsWith("/") ? f.name : `/\${f.name}`;
        const val = typeof f.content === "string" ? f.content : JSON.stringify(f.content);
        await env.KV.put(`app:\${body.slug}:\${p}`, val);
      }
      return new Response(JSON.stringify({ success: true, url: \`https://\${body.slug}.crealityapp.com\` }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }
    return new Response("<!DOCTYPE html><html><body style=background:#0a0a0b;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;margin:0><h1>App Not Found</h1></body></html>", { status: 404, headers: { "Content-Type": "text/html" } });
  }
};`;
  }
}