import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { pullProjectsFromCloud } from "@/utils/projects-store";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) { navigate("/workspace", { replace: true }); return null; }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    if (tab === "signup" && password !== confirmPassword) { setError("Passwords don&apos;t match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSubmitting(true);
    try {
      if (tab === "login") {
        const { error: signInError } = await signIn(email, password);
        if (signInError) { setError(signInError.message); setSubmitting(false); return; }
      } else {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) { setError(signUpError.message); setSubmitting(false); return; }
      }
      const { data: { session } } = await (await import("@/lib/supabase")).supabase.auth.getSession();
      if (session?.user) { try { await pullProjectsFromCloud(session.user.id); } catch { /* best effort */ } }
      navigate("/workspace", { replace: true });
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Something went wrong. Try again."); }
    setSubmitting(false);
  };

  const switchTab = (newTab: "login" | "signup") => { setTab(newTab); setError(null); };

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent-500/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary-500/5 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8"><a href="/" className="cursor-pointer"><img src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png" alt="CreAIlity" className="h-10 w-auto object-contain" /></a></div>
        <div className="bg-background-100 border border-background-300/60 rounded-2xl p-6">
          <div className="flex bg-background-200/50 border border-background-300/50 rounded-full p-1 mb-6">
            <button onClick={() => switchTab("login")} className={`flex-1 text-sm font-medium py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${tab === "login" ? "bg-foreground-400/15 text-foreground-950" : "text-foreground-500 hover:text-foreground-700"}`}>Sign in</button>
            <button onClick={() => switchTab("signup")} className={`flex-1 text-sm font-medium py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${tab === "signup" ? "bg-foreground-400/15 text-foreground-950" : "text-foreground-500 hover:text-foreground-700"}`}>Create account</button>
          </div>
          <div className="text-center mb-5"><h1 className="text-lg font-semibold text-foreground-950 mb-1">{tab === "login" ? "Welcome back" : "Join CreAIlity"}</h1><p className="text-xs text-foreground-500">{tab === "login" ? "Sign in to access your projects across devices." : "Create an account to sync your projects to the cloud."}</p></div>
          {error && <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 mb-4"><div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-error-warning-line text-red-400 text-xs" /></div><p className="text-xs text-red-400 leading-relaxed">{error}</p></div>}
          {tab === "signup" && !error && submitting && <div className="flex items-start gap-2 bg-secondary-500/10 border border-secondary-500/20 rounded-xl px-3 py-2.5 mb-4"><div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"><i className="ri-mail-send-line text-secondary-400 text-xs" /></div><p className="text-xs text-secondary-400 leading-relaxed">Check your email for a confirmation link.</p></div>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div><label className="block text-xs font-medium text-foreground-500 mb-1.5">Email</label><div className="flex items-center gap-2 bg-background-200/40 border border-background-300/60 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 transition-colors"><div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-mail-line text-foreground-500 text-sm" /></div><input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-600 outline-none" autoComplete="email" /></div></div>
            <div><label className="block text-xs font-medium text-foreground-500 mb-1.5">Password</label><div className="flex items-center gap-2 bg-background-200/40 border border-background-300/60 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 transition-colors"><div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-lock-line text-foreground-500 text-sm" /></div><input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-600 outline-none" autoComplete={tab === "login" ? "current-password" : "new-password"} /></div></div>
            {tab === "signup" && <div><label className="block text-xs font-medium text-foreground-500 mb-1.5">Confirm password</label><div className="flex items-center gap-2 bg-background-200/40 border border-background-300/60 rounded-xl px-3 py-2.5 focus-within:border-foreground-500/50 transition-colors"><div className="w-4 h-4 flex items-center justify-center flex-shrink-0"><i className="ri-lock-line text-foreground-500 text-sm" /></div><input type="password" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="flex-1 bg-transparent text-sm text-foreground-800 placeholder-foreground-600 outline-none" autoComplete="new-password" /></div></div>}
            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-foreground-50 text-background-950 rounded-xl py-2.5 text-sm font-semibold hover:bg-foreground-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap mt-1">
              {submitting ? <><div className="w-4 h-4 border-2 border-background-950/30 border-t-background-950 rounded-full animate-spin" />{tab === "login" ? "Signing in..." : "Creating account..."}</> : tab === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          <div className="text-center mt-5"><a href="/" className="text-xs text-foreground-500 hover:text-foreground-700 transition-colors cursor-pointer inline-flex items-center gap-1"><div className="w-3.5 h-3.5 flex items-center justify-center"><i className="ri-arrow-left-line text-xs" /></div>Back to home</a></div>
        </div>
        <p className="text-center text-[10px] text-foreground-600 mt-6">Your projects sync securely across all your devices.</p>
      </div>
    </div>
  );
} 