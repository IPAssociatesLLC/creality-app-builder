import { useEffect, useRef, useState } from "react";

const steps = [
  { number: "01", title: "Describe", description: "Type your app idea in plain English. Add context about users, design, and features.", icon: "ri-chat-3-line", accentBorder: "border-accent-500/25", accentBg: "bg-accent-500/10", accentText: "text-accent-400" },
  { number: "02", title: "Build", description: "CreAIlity generates your entire app live — React, TypeScript, Tailwind, routing, all of it.", icon: "ri-code-s-slash-line", accentBorder: "border-secondary-500/25", accentBg: "bg-secondary-500/10", accentText: "text-secondary-400" },
  { number: "03", title: "Refine", description: "Request changes naturally. Add pages, swap colors, connect APIs — no code needed.", icon: "ri-refresh-line", accentBorder: "border-accent-500/25", accentBg: "bg-accent-500/10", accentText: "text-accent-400" },
  { number: "04", title: "Ship", description: "One-click deploy. Get a live URL instantly, download your code, connect a domain.", icon: "ri-rocket-line", accentBorder: "border-secondary-500/25", accentBg: "bg-secondary-500/10", accentText: "text-secondary-400" },
];

function StepCard({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`flex flex-col gap-4 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${index * 100}ms` }}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl border ${step.accentBorder} ${step.accentBg}`}>
          <i className={`${step.icon} ${step.accentText} text-lg`} />
        </div>
        <span className="text-xs font-semibold text-foreground-500 tracking-wider uppercase">Step {step.number}</span>
      </div>
      <h3 className="font-heading text-xl md:text-2xl font-bold text-foreground-800 leading-snug">{step.title}</h3>
      <p className="text-sm text-foreground-500 leading-relaxed">{step.description}</p>
    </div>
  );
}

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 px-4 bg-background-100/50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-4">The process</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground-950 leading-tight">Four steps from idea<br /><span className="text-foreground-700">to shipped product.</span></h2>
            <p className="text-sm text-foreground-600 max-w-xs md:text-right leading-relaxed">No design tools. No dev environment. No infrastructure. Just describe and ship.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {steps.map((step, i) => <StepCard key={step.number} step={step} index={i} />)}
        </div>
      </div>
    </section>
  );
}