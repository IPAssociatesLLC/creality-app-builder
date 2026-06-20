import type { ImportedFile } from "@/utils/projects-store";

interface BundledResult {
  html: string;
  hasReact: boolean;
  sourceFileCount: number;
}

/**
 * Build a composite HTML file that can run a multi-file React project in an iframe.
 * Handles: React components, JSX/TSX, CSS files, and inter-file imports.
 * Uses React 18 UMD + Babel standalone for in-browser JSX transformation.
 */
export function buildSandboxHtml(files: ImportedFile[]): BundledResult | null {
  if (!files || files.length === 0) return null;

  // Find entry HTML — prefer root index.html, then any index.html
  const htmlFiles = files.filter((f) => f.name.endsWith(".html"));
  const htmlFile =
    files.find((f) => f.name === "index.html") ||
    files.find((f) => f.name.endsWith("/index.html")) ||
    (htmlFiles.length > 0 ? htmlFiles[0] : null);

  if (!htmlFile) return null;

  // Let's bundle other HTML pages
  const otherPages: Record<string, string> = {};

  // Collect source files
  const sourceFiles = files.filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    return ["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext);
  });

  // Collect CSS files for injection
  const cssFiles = files.filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    return ext === "css";
  });

  if (sourceFiles.length === 0 && cssFiles.length === 0) {
    // No source files — just return the HTML as-is
    return { html: htmlFile.content, hasReact: false, sourceFileCount: 0 };
  }

  // Check if this is a React project
  const hasReact =
    sourceFiles.some(
      (f) =>
        f.content.includes("from 'react'") ||
        f.content.includes('from "react"') ||
        f.content.includes("from 'react-dom") ||
        f.content.includes('from "react-dom') ||
        f.content.includes("ReactDOM") ||
        f.content.includes("createRoot") ||
        f.content.includes("React."),
    ) ||
    htmlFile.content.includes("react") ||
    htmlFile.content.includes("root");

  // Check if project uses Tailwind CSS
  const hasTailwind =
    files.some((f) => f.name.includes("tailwind.config")) ||
    cssFiles.some((f) => f.content.includes("@tailwind")) ||
    sourceFiles.some((f) => f.content.includes("tailwindcss"));

  // Check if any source files use TypeScript
  const hasTypeScript = sourceFiles.some(
    (f) => f.name.endsWith(".ts") || f.name.endsWith(".tsx"),
  );

  const hasRouter = sourceFiles.some((f) => f.content.includes("react-router-dom"));
  const hasSupabase = sourceFiles.some((f) => f.content.includes("@supabase/supabase-js") || f.content.includes("supabase.co"));
  const hasLucide = sourceFiles.some((f) => f.content.includes("lucide-react"));

  // Sort files: entry file last (so dependencies are defined first)
  const entryPatterns = ["main.", "index.", "app.", "App."];
  const sortedSourceFiles = [...sourceFiles].sort((a, b) => {
    const aIsEntry = entryPatterns.some((p) => a.name.toLowerCase().includes(p.toLowerCase()));
    const bIsEntry = entryPatterns.some((p) => b.name.toLowerCase().includes(p.toLowerCase()));
    if (aIsEntry && !bIsEntry) return 1;
    if (!aIsEntry && bIsEntry) return -1;
    return 0;
  });

  // Transform source files into bundle-ready code
  const transformedBlocks = sortedSourceFiles.map((f) => transformSourceFile(f.content, f.name));
  const bundledJs = transformedBlocks.join("\n\n");

  // Bundle CSS — strip @tailwind directives (CDN handles them)
  const bundledCss = cssFiles
    .map((f) => {
      let css = f.content;
      if (hasTailwind) {
        css = css.replace(/@tailwind\s+[^;]+;\s*/g, "");
      }
      return `/* ${f.name} */\n${css}`;
    })
    .join("\n\n");

  // Helper to compile a single HTML file content with scripts and CSS injected
  const compilePage = (htmlContent: string) => {
    return buildCompositeHtml(
      htmlContent,
      bundledJs,
      bundledCss,
      hasReact,
      hasTailwind,
      hasTypeScript,
      hasRouter,
      hasSupabase,
      hasLucide,
    );
  };

  // Compile other HTML pages first
  for (const file of htmlFiles) {
    if (file.name !== htmlFile.name) {
      let name = file.name;
      if (name.startsWith("./")) name = name.slice(2);
      otherPages[name] = compilePage(file.content);
    }
  }

  // Compile the entry HTML file
  let mainHtml = compilePage(htmlFile.content);

  // Inject otherPages map and router script into all pages so they can navigate
  const pagesMapStr = JSON.stringify(otherPages);
  const routerScript = `
<script>
(function() {
  window.__SANDBOX_PAGES__ = ${pagesMapStr};
  
  function interceptLinks() {
    document.addEventListener("click", function(e) {
      const link = e.target.closest("a");
      if (link) {
        let href = link.getAttribute("href");
        if (href) {
          if (href.startsWith("./")) href = href.slice(2);
          if (window.__SANDBOX_PAGES__[href]) {
            e.preventDefault();
            const newHtml = window.__SANDBOX_PAGES__[href];
            document.open();
            document.write(newHtml);
            document.close();
          }
        }
      }
    });
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", interceptLinks);
  } else {
    interceptLinks();
  }
})();
</script>
`;

  const injectRouter = (htmlText: string) => {
    if (htmlText.includes("</head>")) {
      return htmlText.replace("</head>", `  ${routerScript}\n</head>`);
    }
    return routerScript + htmlText;
  };

  mainHtml = injectRouter(mainHtml);
  for (const name of Object.keys(otherPages)) {
    otherPages[name] = injectRouter(otherPages[name]);
  }

  return { html: mainHtml, hasReact, sourceFileCount: sourceFiles.length };
}

/**
 * Transform a single source file: strip module imports/exports,
 * resolve React named imports to use global React, keep code otherwise intact.
 */
function transformSourceFile(content: string, fileName: string): string {
  let result = content;

  // ── Handle React Router DOM UMD imports ──
  result = result.replace(
    /import\s+([^'"]+)\s+from\s*['"]react-router-dom['"];?/g,
    (_match, importsClause: string) => {
      const namedImports = importsClause.match(/\{([^}]+)\}/);
      if (namedImports) {
        const cleaned = namedImports[1].split(",").map(s => s.trim()).filter(Boolean);
        return `const { ${cleaned.join(", ")} } = ReactRouterDOM;`;
      }
      return `const ReactRouterDOMGlobal = ReactRouterDOM;`;
    }
  );

  // ── Handle Supabase UMD imports ──
  result = result.replace(
    /import\s+([^'"]+)\s+from\s*['"]@supabase\/supabase-js['"];?/g,
    (_match, importsClause: string) => {
      const namedImports = importsClause.match(/\{([^}]+)\}/);
      if (namedImports) {
        const cleaned = namedImports[1].split(",").map(s => s.trim()).filter(Boolean);
        return `const { ${cleaned.join(", ")} } = supabase;`;
      }
      return "";
    }
  );

  // ── Handle Lucide React UMD imports ──
  result = result.replace(
    /import\s+([^'"]+)\s+from\s*['"]lucide-react['"];?/g,
    (_match, importsClause: string) => {
      const namedImports = importsClause.match(/\{([^}]+)\}/);
      if (namedImports) {
        const cleaned = namedImports[1].split(",").map(s => s.trim()).filter(Boolean);
        return `const { ${cleaned.join(", ")} } = LucideReact;`;
      }
      return `const LucideReactGlobal = LucideReact;`;
    }
  );

  // ── Handle React namespace import ──
  // import React from 'react' → React is global via UMD
  result = result.replace(
    /import\s+React\s*(?:,\s*\{([^}]*)\})?\s*from\s*['"]react['"];?/g,
    (_match, namedImports: string | undefined) => {
      if (namedImports) {
        const cleaned = namedImports
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (cleaned.length > 0) {
          return `const { ${cleaned.join(", ")} } = React;`;
        }
      }
      return "// React is global (UMD)";
    },
  );

  // ── Handle named-only React imports ──
  result = result.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]react['"];?/g,
    (_match, namedImports: string) => {
      const cleaned = namedImports
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (cleaned.length > 0) {
        return `const { ${cleaned.join(", ")} } = React;`;
      }
      return "";
    },
  );

  // ── Handle react-dom imports ──
  result = result.replace(
    /import\s+(?:\{\s*([^}]*)\s*\}|(\w+))\s*from\s*['"]react-dom(?:\/client)?['"];?/g,
    (_match, namedImports: string | undefined, defaultImport: string | undefined) => {
      const parts: string[] = [];
      if (defaultImport && defaultImport !== "ReactDOM") {
        parts.push(`const ${defaultImport} = ReactDOM;`);
      }
      if (namedImports) {
        const cleaned = namedImports
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (cleaned.length > 0) {
          parts.push(`const { ${cleaned.join(", ")} } = ReactDOM;`);
        }
      }
      return parts.join("\n") || "// ReactDOM is global (UMD)";
    },
  );

  // ── Remove local and aliased file imports (dependencies are concatenated) ──
  result = result.replace(
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\w+|\*\s+as\s+\w+)?\s*(?:,\s*(?:\{[^}]*\}|\w+))?\s*from\s*['"](?:\.\.?\/|@\/)[^'"]+['"];?\s*/g,
    "",
  );

  // ── Remove side-effect imports ──
  result = result.replace(/import\s+['"][^'"]+['"];?\s*/g, "");

  // ── Strip export keywords ──
  result = result.replace(/export\s+default\s+(function|class|async\s+function)\s+/g, "$1 ");
  result = result.replace(
    /export\s+default\s+(\w+);?/g,
    "// export default $1\n",
  );

  // export const Foo = → const Foo =
  result = result.replace(
    /export\s+(const|let|var|function|class|async\s+function|type|interface|enum)\s+/g,
    "$1 ",
  );

  // Clean up any leftover "export { ... }" statements
  result = result.replace(/export\s*\{[^}]*\};?\s*/g, "");

  return `// ── ${fileName} ──\n${result}`;
}

/**
 * Build the final composite HTML with injected CDN scripts, CSS, and bundled JS.
 */
function buildCompositeHtml(
  htmlContent: string,
  bundledJs: string,
  bundledCss: string,
  hasReact: boolean,
  hasTailwind: boolean,
  hasTypeScript: boolean,
  hasRouter: boolean,
  hasSupabase: boolean,
  hasLucide: boolean,
): string {
  let result = htmlContent;

  // Inject CDN scripts into <head>
  const headScripts: string[] = [];

  // Tailwind CDN must come first so styles are available immediately
  if (hasTailwind) {
    headScripts.push('<script src="https://cdn.tailwindcss.com"></script>');
    headScripts.push('<script>tailwind.config={darkMode:"class"}</script>');
  }

  if (bundledCss) {
    headScripts.push(`<style>\n/* Bundled project CSS */\n${bundledCss}\n</style>`);
  }

  if (hasReact) {
    headScripts.push(
      '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>',
      '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>',
      '<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>',
    );
    if (hasRouter) {
      headScripts.push(
        '<script crossorigin src="https://unpkg.com/react-router-dom@6.22.3/dist/umd/react-router-dom.production.min.js"></script>'
      );
    }
    if (hasLucide) {
      headScripts.push(
        '<script src="https://unpkg.com/lucide@latest"></script>',
        '<script src="https://unpkg.com/lucide-react@latest"></script>'
      );
    }
  }

  if (hasSupabase) {
    headScripts.push(
      '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
  }

  if (headScripts.length > 0) {
    const injected = headScripts.join("\n  ");
    if (result.includes("</head>")) {
      result = result.replace("</head>", `  ${injected}\n</head>`);
    } else if (result.includes("<body")) {
      result = result.replace("<body", `${injected}\n<body`);
    } else {
      result = `${injected}\n${result}`;
    }
  }

  // Remove original module script tags that reference source files
  result = result.replace(
    /<script[^>]*type=["']module["'][^>]*src=["'][^"']*["'][^>]*>\s*<\/script>/g,
    "",
  );
  result = result.replace(
    /<script[^>]*src=["'][^"']*\.[tj]sx?["'][^>]*>\s*<\/script>/g,
    "",
  );

  // Also remove Vite-specific dev client scripts
  result = result.replace(
    /<script[^>]*src=["'][^"']*@vite[^"']*["'][^>]*>\s*<\/script>/g,
    "",
  );

  // Build Babel presets based on what the project uses
  const babelPresets: string[] = [];
  if (hasReact) babelPresets.push("react");
  if (hasTypeScript) babelPresets.push("typescript");
  const presetsAttr = babelPresets.length > 0 ? ` data-presets="${babelPresets.join(",")}"` : "";

  // Inject bundled JS before </body>
  const jsBlock = hasReact || hasTypeScript
    ? `<script type="text/babel"${presetsAttr}>\n// ── Bundled project code ──\n(function() {\n"use strict";\n${bundledJs}\n})();\n</script>`
    : `<script>\n// ── Bundled project code ──\n(function() {\n"use strict";\n${bundledJs}\n})();\n</script>`;

  if (result.includes("</body>")) {
    result = result.replace("</body>", `  ${jsBlock}\n</body>`);
  } else {
    result += `\n${jsBlock}`;
  }

  return result;
}