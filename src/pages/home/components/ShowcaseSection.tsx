import { useEffect, useRef, useState } from "react";

const apps = [
  { title: "SaaS Dashboard", desc: "Analytics & metrics overview", time: "47s", icon: "ri-dashboard-line" },
  { title: "E-commerce Store", desc: "Product listings & cart", time: "63s", icon: "ri-store-line" },
  { title: "Task Manager", desc: "Kanban boards & sprints", time: "52s", icon: "ri-kanban-view" },
  { title: "Booking App", desc: "Calendar & appointments", time: "41s", icon: "ri-calendar-check-line" },
  { title: "Portfolio Site", desc: "Work showcase & contact", time: "38s", icon: "ri-user-star-line" },
  { title: "Recipe App", desc: "Meal plans & ingredients", time: "55s", icon: "ri-restaurant-line" },
];

function AppCard({ app, delay }: { app: (typeof apps)[0]; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`group rounded-2xl border border-background-300/60 bg-background-100/50 overflow-hidden hover:border-background-400/60 transition-all duration-500 cursor-pointer ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="relative w-full h-48 overflow-hidden bg-background-200/40 flex items-center justify-center">
        <i className={`${app.icon} text-6xl text-foreground-600/20 group-hover:scale-110 transition-transform duration-500`} />
        <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-medium bg-background-950/80 backdrop-blur-sm border border-background-400/60 rounded-full px-2.5 py-1 text-foreground-700">
          <i className="ri-flashlight-line text-accent-500 text-[10px]" />Built in {app.time}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground-800">{app.title}</h4>
            <p className="text-xs text-foreground-600 mt-0.5">{app.desc}</p>
          </div>
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <i className="ri-external-link-line text-foreground-600 text-sm group-hover:text-foreground-700 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShowcaseSection() {
  return (
    <section id="showcase" className="py-24 md:py-28 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-3">Built with CreAIlity</p>
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground-950 leading-tight">Real apps,<br /><span className="text-foreground-700">built in seconds.</span></h2>
          </div>
          <p className="text-sm text-foreground-600 max-w-xs md:text-right leading-relaxed">Every app below was generated from a single prompt — no code written by hand.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((app, i) => <AppCard key={app.title} app={app} delay={i * 60} />)}
        </div>
      </div>
    </section>
  );
}