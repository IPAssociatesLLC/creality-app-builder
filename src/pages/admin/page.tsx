import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

interface AdminStats { totalUsers: number; totalProjects: number; totalVersions: number; activeToday: number; }
interface UserRow { id: string; email: string; created_at: string; projectCount: number; lastActive: string; }
interface ProjectRow { id: string; name: string; user_email: string; updated_at: string; has_code: boolean; version_count: number; }

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return <div className="rounded-2xl border border-background-300/60 bg-background-100 p-5">
    <div className="flex items-start justify-between mb-3"><div className="w-9 h-9 flex items-center justify-center rounded-xl bg-background-200/60"><i className={`${icon} text-foreground-600 text-base`} /></div></div>
    <p className="text-2xl font-bold text-foreground-950 mb-0.5">{value}</p><p className="text-xs font-medium text-foreground-600">{label}</p>
  </div>;
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    async function load() {
      try {
        const { data: projects } = await supabase.from("projects").select("user_id, updated_at");
        const countMap: Record<string, number> = {}; const lastMap: Record<string, string> = {};
        for (const p of projects || []) { countMap[p.user_id] = (countMap[p.user_id] || 0) + 1; if (!lastMap[p.user_id] || p.updated_at > lastMap[p.user_id]) lastMap[p.user_id] = p.updated_at; }
        const rows: UserRow[] = Object.keys(countMap).map((id) => ({ id, email: `user-${id.slice(0, 8)}@...`, created_at: lastMap[id] || new Date().toISOString(), projectCount: countMap[id] || 0, lastActive: lastMap[id] || new Date().toISOString() }));
        setUsers(rows);
      } catch { setUsers([]); } finally { setLoading(false); }
    }
    load();
  }, []);
  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search));
  return <div className="flex flex-col gap-5">
    <div className="flex items-center gap-3"><div className="flex-1 flex items-center gap-2 bg-background-100 border border-background-300/60 rounded-xl px-3 py-2.5 max-w-sm"><i className="ri-search-line text-foreground-500 text-sm" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-500 outline-none" /></div><span className="text-sm text-foreground-500">{users.length} users</span></div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 overflow-hidden overflow-x-auto">
      <table className="w-full"><thead><tr className="border-b border-background-200/60"><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">User</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Projects</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Last Active</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Status</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={4} className="text-center py-12"><div className="w-5 h-5 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin mx-auto" /></td></tr> : filtered.length === 0 ? <tr><td colSpan={4} className="text-center py-12 text-sm text-foreground-500">No users</td></tr> : filtered.map((user) => <tr key={user.id} className="border-b border-background-200/40 hover:bg-background-200/20 transition-colors"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full bg-background-200/60 flex items-center justify-center"><span className="text-xs font-semibold text-foreground-600">{user.id.charAt(0).toUpperCase()}</span></div><div><p className="text-xs font-medium text-foreground-800">{user.email}</p><p className="text-[10px] text-foreground-500 font-mono">{user.id.slice(0, 16)}…</p></div></div></td><td className="px-5 py-3.5"><span className="text-sm font-semibold text-foreground-800">{user.projectCount}</span></td><td className="px-5 py-3.5"><span className="text-xs text-foreground-600">{new Date(user.lastActive).toLocaleDateString()}</span></td><td className="px-5 py-3.5"><span className="inline-flex items-center gap-1.5 text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 rounded-full px-2 py-0.5"><span className="w-1 h-1 rounded-full bg-green-500 inline-block" />Active</span></td></tr>)}</tbody></table>
    </div>
  </div>;
}

function ProjectsTab() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    async function load() {
      try {
        const { data: pd } = await supabase.from("projects").select("id, name, user_id, updated_at, generated_code").order("updated_at", { ascending: false }).limit(200);
        const { data: versions } = await supabase.from("project_versions").select("project_id");
        const vc: Record<string, number> = {};
        for (const v of versions || []) vc[v.project_id] = (vc[v.project_id] || 0) + 1;
        const rows: ProjectRow[] = (pd || []).map((p) => ({ id: p.id, name: p.name, user_email: `${p.user_id.slice(0, 8)}…`, updated_at: p.updated_at, has_code: !!p.generated_code, version_count: vc[p.id] || 0 }));
        setProjects(rows);
      } catch { setProjects([]); } finally { setLoading(false); }
    }
    load();
  }, []);
  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search));
  return <div className="flex flex-col gap-5">
    <div className="flex items-center gap-3"><div className="flex-1 flex items-center gap-2 bg-background-100 border border-background-300/60 rounded-xl px-3 py-2.5 max-w-sm"><i className="ri-search-line text-foreground-500 text-sm" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-500 outline-none" /></div><span className="text-sm text-foreground-500">{projects.length} projects</span></div>
    <div className="rounded-2xl border border-background-300/60 bg-background-100 overflow-hidden overflow-x-auto">
      <table className="w-full"><thead><tr className="border-b border-background-200/60"><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Project</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Owner</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Versions</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Updated</th><th className="text-left text-xs font-semibold text-foreground-500 uppercase tracking-widest px-5 py-3">Status</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} className="text-center py-12"><div className="w-5 h-5 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin mx-auto" /></td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-sm text-foreground-500">No projects</td></tr> : filtered.map((p) => <tr key={p.id} className="border-b border-background-200/40 hover:bg-background-200/20 transition-colors"><td className="px-5 py-3.5"><div><p className="text-xs font-medium text-foreground-800 truncate max-w-[200px]">{p.name}</p><p className="text-[10px] text-foreground-500 font-mono">{p.id.slice(0, 20)}…</p></div></td><td className="px-5 py-3.5"><span className="text-xs text-foreground-600 font-mono">{p.user_email}</span></td><td className="px-5 py-3.5"><span className="text-sm font-semibold text-foreground-800">{p.version_count}</span></td><td className="px-5 py-3.5"><span className="text-xs text-foreground-600">{new Date(p.updated_at).toLocaleDateString()}</span></td><td className="px-5 py-3.5">{p.has_code ? <span className="inline-flex items-center gap-1.5 text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 rounded-full px-2 py-0.5"><span className="w-1 h-1 rounded-full bg-green-500 inline-block" />Built</span> : <span className="inline-flex items-center gap-1.5 text-[10px] bg-background-300/40 text-foreground-500 border border-background-300/50 rounded-full px-2 py-0.5">Empty</span>}</td></tr>)}</tbody></table>
    </div>
  </div>;
}

type AdminTab = "overview" | "users" | "projects";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalProjects: 0, totalVersions: 0, activeToday: 0 });

  useEffect(() => { if (!loading && !user) navigate("/auth", { replace: true }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function loadStats() {
      try {
        const [{ count: pc }, { count: vc }, { data: rp }] = await Promise.all([
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("project_versions").select("id", { count: "exact", head: true }),
          supabase.from("projects").select("user_id, updated_at").gte("updated_at", new Date(Date.now() - 86400000).toISOString()),
        ]);
        const activeIds = new Set((rp || []).map((p) => p.user_id));
        const allIds = new Set<string>(); const { data: ap } = await supabase.from("projects").select("user_id");
        for (const p of ap || []) allIds.add(p.user_id);
        setStats({ totalUsers: allIds.size, totalProjects: pc || 0, totalVersions: vc || 0, activeToday: activeIds.size });
      } catch {
        // silently fail
      }
    }
    loadStats();
  }, [user]);

  if (loading || !user) return <div className="h-screen bg-background-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-background-400 border-t-foreground-300 rounded-full animate-spin" /></div>;

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "ri-dashboard-line" },
    { id: "users", label: "Users", icon: "ri-group-line" },
    { id: "projects", label: "Projects", icon: "ri-folder-line" },
  ];

  return <div className="min-h-screen bg-background-50">
    <header className="h-12 flex items-center justify-between px-6 border-b border-background-200 bg-background-50 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center flex-shrink-0 cursor-pointer"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-8 w-auto object-contain" /></Link>
        <span className="text-foreground-400 text-sm">/</span><span className="text-sm font-medium text-foreground-700">Admin</span>
      </div>
      <Link to="/workspace" className="flex items-center gap-1.5 text-xs text-foreground-600 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-arrow-left-line text-xs" />Workspace</Link>
    </header>
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6"><h1 className="text-xl font-bold text-foreground-950">Admin Dashboard</h1><p className="text-sm text-foreground-500 mt-0.5">Manage your CreAIlity platform</p></div>
      <div className="flex gap-0.5 mb-7 border-b border-background-200 overflow-x-auto">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 text-sm px-4 py-2.5 transition-colors cursor-pointer whitespace-nowrap ${tab === t.id ? "text-foreground-900 font-semibold border-b-2 border-foreground-800 -mb-px" : "text-foreground-500 hover:text-foreground-800"}`}><div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className={`${t.icon} text-sm`} /></div>{t.label}</button>)}
      </div>
      {tab === "overview" && <div className="flex flex-col gap-6"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><StatCard label="Total Users" value={stats.totalUsers} icon="ri-user-line" /><StatCard label="Total Projects" value={stats.totalProjects} icon="ri-folder-line" /><StatCard label="Total Versions" value={stats.totalVersions} icon="ri-git-branch-line" /><StatCard label="Active Today" value={stats.activeToday} icon="ri-pulse-line" /></div></div>}
      {tab === "users" && <UsersTab />}
      {tab === "projects" && <ProjectsTab />}
    </div>
  </div>;
}