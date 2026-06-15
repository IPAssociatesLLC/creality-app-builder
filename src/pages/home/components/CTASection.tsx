import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CTASection() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const handleBuild = () => { if (prompt.trim()) navigate("/workspace"); };

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "oklch(var(--background-100))" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none" style={{ background: "oklch(var(--accent-500) / 0.06)" }} />
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-6">Ready to build?</p>
        <h2 className="font-heading text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground-950 leading-none mb-6">Have an app idea?<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground-50 via-accent-400 to-foreground-50">Build it now.</span></h2>
        <p className="text-base md:text-lg text-foreground-500 max-w-md mx-auto mb-12 leading-relaxed">No waitlist. No credit card. Just describe your idea and ship something real today.</p>
        <div className="w-full max-w-2xl mx-auto">
          <div className="rounded-2xl border border-background-300/60 bg-background-200/30 overflow-hidden">
            <div className="flex items-start gap-3 px-5 pt-5 pb-4">
              <div className="w-5 h-5 flex items-center justify-center mt-0.5"><i className="ri-sparkling-2-line text-foreground-600 text-sm" /></div>
              <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the app you want to build..." className="flex-1 resize-none bg-transparent text-sm text-foreground-800 placeholder-foreground-600 outline-none leading-relaxed" />
            </div>
            <div className="flex items-center justify-between px-5 pb-4 border-t border-background-300/40 pt-3">
              <span className="text-xs text-foreground-500">Free to start · No card needed</span>
              <button onClick={handleBuild} disabled={!prompt.trim()} className="flex items-center gap-2 bg-foreground-50 text-background-950 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-foreground-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">Build now <i className="ri-send-plane-fill text-xs" /></button>
            </div>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-center gap-8 flex-wrap">
          {[{ icon: "ri-shield-check-line", label: "SOC 2 compliant" }, { icon: "ri-code-s-slash-line", label: "You own the code" }, { icon: "ri-global-line", label: "Deploy anywhere" }].map(({ icon, label }) => (
            <span key={label} className="flex items-center gap-2 text-sm text-foreground-500">
              <div className="w-5 h-5 flex items-center justify-center"><i className={`${icon} text-foreground-600`} /></div>{label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}