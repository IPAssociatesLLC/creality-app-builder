import { Link } from "react-router-dom";
import SubPageNavbar from "@/components/feature/SubPageNavbar";
import Footer from "@/components/feature/Footer";

const featuresList = [
  { icon: "ri-magic-line", title: "Natural Language to App", description: "Describe what you want to build in plain English. No coding knowledge, no technical jargon. CreAIlity builds it — fully functional, beautifully designed.", highlight: "Zero code required" },
  { icon: "ri-code-s-slash-line", title: "Live Code Generation", description: "Watch your app materialize in real time as CreAIlity writes clean, professional React + TypeScript + TailwindCSS code.", highlight: "Production-grade output" },
  { icon: "ri-refresh-line", title: "Instant Iteration", description: "Ask for changes naturally. CreAIlity applies edits in seconds — no digging through code, no manual refactoring.", highlight: "Edits in seconds" },
  { icon: "ri-database-2-line", title: "Full-Stack Capabilities", description: "Build apps with authentication, databases, file storage, and APIs. Integrate with Supabase, Stripe, and any REST API.", highlight: "Backend included" },
  { icon: "ri-smartphone-line", title: "Responsive by Default", description: "Every app is mobile-responsive from the start. Looks great on phones, tablets, and desktops.", highlight: "All devices covered" },
  { icon: "ri-download-2-line", title: "You Own the Code", description: "Download your entire project as a standard React application. Deploy anywhere. Zero vendor lock-in.", highlight: "100% yours" },
  { icon: "ri-git-branch-line", title: "Version History", description: "Every build is versioned automatically. Roll back to any previous state, compare versions, experiment fearlessly.", highlight: "Never lose work" },
  { icon: "ri-rocket-2-line", title: "One-Click Deploy", description: "Push your app live with a single click. Get a shareable URL instantly. Connect a custom domain when ready.", highlight: "Ship instantly" },
  { icon: "ri-team-line", title: "Team Collaboration", description: "Invite team members to work on projects together. Build in real time with shared workspaces.", highlight: "Build together" },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <SubPageNavbar currentPage="features" />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-4">Features</p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-foreground-950 leading-tight mb-5">
            Everything you need to build incredible apps.
          </h1>
          <p className="text-base text-foreground-500 max-w-xl mx-auto leading-relaxed">
            CreAIlity is the most complete AI app builder. From idea to deployed product — all through natural conversation.
          </p>
        </div>
      </section>
      <section className="py-12 md:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuresList.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-background-300/60 bg-background-100 p-6 hover:border-background-400/60 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent-500/10 border border-accent-500/20 mb-4">
                  <i className={`${feature.icon} text-accent-400 text-lg`} />
                </div>
                <h3 className="text-sm font-semibold text-foreground-900 mb-2">{feature.title}</h3>
                <p className="text-xs text-foreground-500 leading-relaxed mb-4">{feature.description}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-full px-2.5 py-1">
                  <i className="ri-sparkling-line text-[10px]" />{feature.highlight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 px-4 bg-background-100/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground-950 mb-4">Ready to build something amazing?</h2>
          <p className="text-sm text-foreground-500 mb-8 leading-relaxed">Join thousands of builders shipping apps with CreAIlity. Start for free.</p>
          <Link to="/workspace" className="inline-flex items-center gap-2 bg-accent-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap">
            Start building free <i className="ri-arrow-right-line text-xs" />
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}