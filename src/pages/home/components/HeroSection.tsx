import { useState } from "react";
import { useNavigate } from "react-router-dom";

const suggestions = [
  "A SaaS dashboard for tracking user metrics",
  "An e-commerce store for handmade jewelry",
  "A project management tool like Linear",
  "A recipe app with AI meal planning",
  "A booking system for yoga studios",
  "A portfolio site for freelance designers",
];

export default function HeroSection() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [focused, setFocused] = useState(false);

  const handleBuild = () => {
    if (prompt.trim()) navigate("/workspace");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleBuild();
    }
  };

  return (
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(oklch(var(--background-200) / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(var(--background-200) / 0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)",
        }}
      />
      <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: "oklch(var(--accent-500) / 0.08)" }} />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ background: "oklch(var(--secondary-500) / 0.06)" }} />

      <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center text-center">
        <div className="animate-fade-up opacity-0-initial mb-8 inline-flex items-center gap-2 border border-background-300/60 rounded-full px-3.5 py-1.5 bg-background-100/80 backdrop-blur-sm">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-accent-500" />
          </span>
          <span className="text-xs text-foreground-500 font-medium">Now in public beta</span>
          <span className="text-xs text-foreground-700">—</span>
          <span className="text-xs text-foreground-800 font-semibold">Build your first app free</span>
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, oklch(var(--accent-500) / 0.12), transparent 100%)", filter: "blur(48px)", transform: "scale(1.4)" }} />
          <h1 className="animate-fade-up opacity-0-initial animate-delay-100 font-heading text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground-950 leading-none tracking-tight relative">
            Create ANYTHING...<br />
            with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground-950 to-foreground-700">Cre</span>
            <span className="font-serif italic text-accent-500" style={{ fontFamily: "'Playfair Display', 'Georgia', serif", fontSize: "1.05em", letterSpacing: "-0.02em" }}>AI</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground-700 to-foreground-950">lity!</span>
          </h1>
        </div>

        <p className="animate-fade-up opacity-0-initial animate-delay-200 text-base md:text-lg text-foreground-500 max-w-lg mx-auto mb-12 leading-relaxed">
          Describe your app in plain English. CreAIlity builds everything — fully functional, beautifully designed, ready to ship.
        </p>

        <div className={`animate-fade-up opacity-0-initial animate-delay-300 w-full transition-all duration-300 ${focused ? "scale-[1.01]" : ""}`}>
          <div className={`w-full rounded-2xl border transition-all duration-300 bg-background-100 ${focused ? "border-foreground-400/50 ring-1 ring-foreground-400/20" : "border-background-300/60"}`}>
            <div className="flex items-start gap-3 px-5 pt-5 pb-4">
              <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                <i className="ri-sparkling-2-line text-foreground-500 text-sm" />
              </div>
              <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                placeholder="Describe the app you want to build..."
                className="flex-1 resize-none bg-transparent text-sm text-foreground-800 placeholder-foreground-500 outline-none leading-relaxed"
              />
            </div>
            <div className="flex items-center justify-between px-5 pb-4 border-t border-background-200/60 pt-3">
              <div className="flex items-center gap-2">
                {["React", "Supabase", "Tailwind", "TypeScript"].map(tech => (
                  <span key={tech} className="hidden sm:inline-flex items-center gap-1 text-[11px] text-foreground-500 bg-background-200/50 border border-background-300/50 px-2 py-0.5 rounded-full">{tech}</span>
                ))}
              </div>
              <button onClick={handleBuild} disabled={!prompt.trim()}
                className="force-white flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                Build now <i className="ri-send-plane-fill text-xs" style={{ color: '#ffffff' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="animate-fade-up opacity-0-initial animate-delay-400 mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.slice(0, 4).map((s) => (
            <button key={s} onClick={() => setPrompt(s)}
              className="text-xs text-foreground-500 border border-foreground-400/20 rounded-full px-3.5 py-1.5 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap bg-foreground-400/5">
              {s}
            </button>
          ))}
        </div>

        <div className="animate-fade-up opacity-0-initial animate-delay-500 mt-12 flex items-center gap-8 text-xs text-foreground-500">
          <span className="flex items-center gap-1.5"><i className="ri-check-line text-accent-500 text-sm" />No credit card</span>
          <span className="w-px h-3 bg-background-300/50" />
          <span className="flex items-center gap-1.5"><i className="ri-check-line text-accent-500 text-sm" />Ship in minutes</span>
          <span className="w-px h-3 bg-background-300/50" />
          <span className="flex items-center gap-1.5"><i className="ri-check-line text-accent-500 text-sm" />You own the code</span>
        </div>
      </div>
    </section>
  );
}