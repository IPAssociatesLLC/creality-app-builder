import { useEffect, useRef, useState } from "react";

const stats = [
  { value: "50k+", label: "Apps built", description: "Across all categories and industries" },
  { value: "12s", label: "Average build time", description: "From prompt to working code" },
  { value: "98%", label: "User satisfaction", description: "Based on post-build surveys" },
  { value: "4.9\u2605", label: "App rating", description: "Average across all published apps" },
];

const testimonials = [
  { name: "Sarah Chen", role: "Indie Hacker", quote: "I shipped my first SaaS in a weekend. No co-founder, no dev agency. Just me and CreAIlity. We're doing $3k MRR now." },
  { name: "Marcus T.", role: "Product Manager at Vercel", quote: "CreAIlity cut our internal tool build time from 3 weeks to 3 hours. I wish this existed 5 years ago." },
  { name: "Lena Kovacs", role: "Designer & Founder", quote: "As a designer, I was always blocked by needing a dev. CreAIlity changed everything — I can ship ideas myself now." },
  { name: "James Park", role: "CTO, Startup Founder", quote: "The code quality surprised me. Clean TypeScript, proper component structure, good patterns. It's not toy code." },
];

export default function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 md:py-28 px-4 bg-background-100/50">
      <div className="max-w-6xl mx-auto">
        <div ref={ref} className={`grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-20 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex flex-col gap-1" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="font-heading text-4xl md:text-5xl font-extrabold text-foreground-950">{stat.value}</div>
              <div className="text-sm font-semibold text-foreground-700">{stat.label}</div>
              <div className="text-xs text-foreground-600 leading-relaxed">{stat.description}</div>
            </div>
          ))}
        </div>
        <div className="mb-10">
          <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-3">Loved by builders</p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground-950">What people are saying</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((t, i) => (
            <div key={t.name} className={`rounded-2xl border border-background-300/60 bg-background-100/80 p-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${200 + i * 100}ms` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-background-300/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-foreground-500">{t.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground-800">{t.name}</div>
                  <div className="text-xs text-foreground-500">{t.role}</div>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[1,2,3,4,5].map(s => <i key={s} className="ri-star-fill text-accent-500 text-xs" />)}
                </div>
              </div>
              <p className="text-sm text-foreground-500 leading-relaxed">&quot;{t.quote}&quot;</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}