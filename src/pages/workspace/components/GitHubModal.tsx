import { useState } from "react";

interface GitHubModalProps {
  onClose: () => void;
  onImport: (repo: string, files?: { name: string; content: string; language: string }[]) => void;
}

interface GitHubFile {
  name: string;
  content: string;
  language: string;
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    tsx: "tsx", ts: "ts", jsx: "tsx", js: "ts",
    css: "css", scss: "css", less: "css",
    html: "html", htm: "html",
    json: "json", md: "md",
  };
  return map[ext] || "text";
}

function parseRepoUrl(url: string): { owner: string; repo: string; branch: string } | null {
  let clean = url.trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  const parts = clean.split("/");
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];
  const branch = parts[2] || "main";

  if (parts[2] === "tree" && parts[3]) {
    return { owner, repo, branch: parts[3] };
  }

  return { owner, repo, branch: "main" };
}

async function fetchRepoContents(owner: string, repo: string, branch: string): Promise<GitHubFile[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  const res = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const tree = data.tree || [];

  const sourceFiles = tree.filter(
    (item: { type: string; path: string; size?: number }) =>
      item.type === "blob" &&
      !item.path.startsWith(".") &&
      !item.path.includes("node_modules/") &&
      !item.path.includes(".git/") &&
      (item.size === undefined || item.size < 500000)
  );

  if (sourceFiles.length === 0) {
    throw new Error("No source files found in this repository.");
  }

  const files: GitHubFile[] = [];
  const batchSize = 10;

  for (let i = 0; i < sourceFiles.length; i += batchSize) {
    const batch = sourceFiles.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (item: { path: string }) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;
        try {
          const contentRes = await fetch(rawUrl);
          if (!contentRes.ok) return null;
          const content = await contentRes.text();
          return {
            name: item.path,
            content,
            language: getLanguage(item.path),
          };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) files.push(r);
    }
  }

  return files;
}

export default function GitHubModal({ onClose, onImport }: GitHubModalProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedFiles, setFetchedFiles] = useState<GitHubFile[]>([]);
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string; branch: string } | null>(null);
  const [importDone, setImportDone] = useState(false);

  const handleImport = async () => {
    const url = repoUrl.trim();
    if (!url) return;

    setImporting(true);
    setError(null);
    setFetchedFiles([]);
    setRepoInfo(null);

    try {
      const parsed = parseRepoUrl(url);
      if (!parsed) {
        throw new Error("Invalid GitHub URL. Use format: github.com/username/repo");
      }

      setRepoInfo(parsed);
      const files = await fetchRepoContents(parsed.owner, parsed.repo, parsed.branch);
      setFetchedFiles(files);
      setImportDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch repository.";
      setError(msg);
    }

    setImporting(false);
  };

  const handleContinue = () => {
    if (repoInfo && fetchedFiles.length > 0) {
      onImport(`${repoInfo.owner}/${repoInfo.repo}`, fetchedFiles);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background-100 rounded-2xl border border-background-300/60 w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-background-200/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-foreground-400/15 rounded-lg">
              <i className="ri-github-line text-foreground-700 text-base" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground-800">Import from GitHub</h3>
              <p className="text-xs text-foreground-500">Import code from any public repository</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer">
            <i className="ri-close-line text-foreground-500 text-base" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-foreground-500">Repository URL</label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 border border-background-300/60 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 focus-within:ring-1 focus-within:ring-foreground-400/20 transition-all bg-background-200/30">
                <i className="ri-github-line text-foreground-500 text-sm flex-shrink-0" />
                <input
                  type="text"
                  value={repoUrl}
                  onChange={e => { setRepoUrl(e.target.value); setImportDone(false); setError(null); }}
                  placeholder="https://github.com/username/repo"
                  className="flex-1 text-sm bg-transparent outline-none text-foreground-800 placeholder-foreground-600 font-mono"
                  onKeyDown={e => e.key === "Enter" && handleImport()}
                />
              </div>
              <button
                onClick={handleImport}
                disabled={!repoUrl.trim() || importing}
                className="flex items-center gap-1.5 bg-foreground-400/15 text-foreground-800 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-foreground-400/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {importing ? (
                  <span className="w-4 h-4 border-2 border-foreground-400/30 border-t-foreground-300 rounded-full animate-spin inline-block" />
                ) : (
                  <>Fetch <i className="ri-arrow-right-line text-xs" /></>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-400 text-xs" />
              </div>
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          {importDone && fetchedFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground-500">
                  {repoInfo?.owner}/{repoInfo?.repo}
                </p>
                <span className="text-[10px] text-foreground-500">{fetchedFiles.length} files</span>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-background-300/60 bg-background-200/30 p-2">
                {fetchedFiles.slice(0, 25).map((f) => (
                  <div key={f.name} className="flex items-center gap-2 py-0.5 px-1 text-xs text-foreground-600">
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <i className="ri-file-code-line text-foreground-500 text-[10px]" />
                    </div>
                    <span className="font-mono truncate">{f.name}</span>
                  </div>
                ))}
                {fetchedFiles.length > 25 && (
                  <p className="text-[10px] text-foreground-500 text-center py-1">
                    ...and {fetchedFiles.length - 25} more files
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="flex-1 text-sm text-foreground-500 border border-background-300/60 rounded-xl py-2.5 hover:bg-background-200/40 transition-colors cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button onClick={handleContinue} disabled={!importDone || fetchedFiles.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-foreground-400/15 text-foreground-800 text-sm font-medium py-2.5 rounded-xl hover:bg-foreground-400/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
              Continue building <i className="ri-arrow-right-line text-xs" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}