// ==============================================================================
// CreAIlity Cloudflare Worker ℒ KV Storage Edition (2026)
// ==============================================================================
// Serves static files from Cloudflare KV storage per subdomain
// Deploy: Via API from Supabase Edge Function
// Routes: *.crealityapp.com/*
// Security: Requires DEPLOY_SECRET env variable
// ===============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Deploy-Secret",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    // Subdomain routing: my-app.crealityapp.com
    if (
      hostname.endsWith(".crealityapp.com") &&
      hostname !== "crealityapp.com" &&
      hostname !== "www.crealityapp.com"
    ) {
      const slug = hostname.split(".")[0];
      return serveApp(slug, env, url.pathname);
    }

    // Root domain
    if (hostname === "crealityapp.com" || hostname === "www.crealityapp.com") {
      return Response.redirect("https://crealityapp.com", 301);
    }

    // API Routes
    if (url.pathname === "/api/deploy" && request.method === "POST") {
      return handleDeploy(request, env);
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({ status: "ok", worker: "kv", timestamp: Date.now() }, 200);
    }

    return notFoundPage();
  },
};

// Serve files from KV storage
async function serveApp(slug, env, path) {
  const filePath = path === "/" ? "/index.html" : path;
  const key = `app:${slug}:${filePath}`;

  try {
    const value = await env.KV.get(key, "arrayBuffer");
    if (value) {
      const contentType = getContentType(filePath);
      return new Response(value, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "max-age=3600",
          "X-Served-By": "creality-kv",
        },
      });
    }
  } catch (e) {
    // Fall through to 404
  }

  // Try index.html for directory paths
  if (path === "/" || !path.includes(".")) {
    const indexKey = `app:${slug}:/index.html`;
    const indexValue = await env.KV.get(indexKey, "arrayBuffer");
    if (indexValue) {
      return new Response(indexValue, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "max-age=3600",
          "X-Served-By": "creality-kv",
        },
      });
    }
  }

  return notFoundPage();
}

function getContentType(path) {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".woff2")) return "font/woff2";
  if (path.endsWith(".woff")) return "font/woff";
  return "text/plain";
}

// Deploy files to KV - SECURED
  try {
    const body = await request.json();
    const { slug, files, secret } = body;

    if (!slug || !files || !Array.isArray(files)) {
      return jsonResponse({ error: "Missing slug or files" }, 400);
    }

    // Authcheck: requires either Authorization header or X-Deploy-Secret header
    const deploySecret = env.DEPLOY_SECRET;
    if (deploySecret) {
      const authHeader = request.headers.get("Authorization") || "";
      const xSecret = request.headers.get("X-Deploy-Secret") || "";
      const isAuthorized = 
        authHeader.includes(deploySecret) ||
        xSecret === deploySecret ||
        secret === deploySecret;

      if (!isAuthorized) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    } else {
      return jsonResponse({ error: "Server not configured for deployments" }, 503);
    }

    const maxFileSize = 25 * 1024 * 1024; // 25MB
    let totalSize = 0;

    for (const file of files) {
      const path = file.name.startsWith("/") ? file.name : `/${file.name}`;
      const key = `app:${slug}:${path}`;
      const content =
        typeof file.content === "string"
          ? file.content
          : JSON.stringify(file.content);

      totalSize += content.length;
      if (totalSize > maxFileSize) {
        return jsonResponse({ error: "Total file size exceeds 25MB" }, 413);
      }

      if (content.length > maxFileSize) {
        return jsonResponse({ error: `File ${file.name} exceeds 25MB` }, 413);
      }

      await env.KV.put(key, content);
    }

    return jsonResponse(
      {
        success: true,
        slug,
        url: `https://${slug}.crealityapp.com`,
      },
      200
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Deploy failed";
    return jsonResponse({ error: msg }, 500);
  }
}

// Helpers
function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORSM, "Content-Type": "application/json" },
  });
}

function notFoundPage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Not Found — CreAIlity</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0a0a0b;
      color: #e4e4e7;
    }
    .card {
      text-align: center;
      max-width: 420px;
      padding: 2rem;
    }
    .card h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #e4e4e7;
    }
    .card p {
      font-size: 0.9rem;
      color: #888;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .card a {
      display: inline-block;
      padding: 0.65rem 1.5rem;
      background: #e4e4e7;
      color: #0a0a0b;
      text-decoration: none;
      border-radius: 0.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background 0.2s;
    }
    .card a:hover {
      background: #fff;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>App Not Found</h1>
    <p>This sandbox app doesn't exist or has been removed. The creator may have unpublished it or changed its URL.</p>
    <a href="https://crealityapp.com">Build your own at CreAIlity</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}