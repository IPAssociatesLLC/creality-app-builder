import { Link } from "react-router-dom";
import SubPageNavbar from "@/components/feature/SubPageNavbar";
import Footer from "@/components/feature/Footer";

const docSections = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "ri-rocket-line",
    content: `CreAIlity lets you build fully functional web applications just by describing what you want in plain English. No coding experience required.

To get started, head to the workspace and type a description of the app you want to build. Be as specific as possible — mention features, pages, design preferences, and any integrations you need.

Example: "Build me a project management dashboard with a kanban board, task assignments, a calendar view, and user authentication. Use a clean modern design with a sidebar navigation."`,
  },
  {
    id: "prompting",
    title: "Writing Good Prompts",
    icon: "ri-chat-3-line",
    content: `The quality of your prompt directly impacts the quality of your app. Here are some tips:

1. Be specific about features — list pages, components, and functionality
2. Mention your tech preferences — authentication method, database needs, API integrations
3. Describe the design style — color scheme, layout preferences, inspiration references
4. Include user flows — how should people navigate and interact with the app?
5. Specify data needs — what kind of data will the app handle?`,
  },
  {
    id: "iterating",
    title: "Iterating on Your App",
    icon: "ri-refresh-line",
    content: `After CreAIlity generates your app, you can refine it endlessly through the chat interface. Just describe what you want changed:

• "Make the navigation sticky and add a dark mode toggle"
• "Add a loading skeleton to the dashboard"
• "Change the color scheme to a dark theme"
• "Add pagination to the products page"
• "Create a settings page with profile editing"

Each change is tracked in the version history, so you can compare different iterations or roll back to any previous state.`,
  },
  {
    id: "code-quality",
    title: "Code Quality & Export",
    icon: "ri-code-s-slash-line",
    content: `CreAIlity generates production-grade React + TypeScript code with TailwindCSS styling. The output follows modern best practices:

• Functional components with proper TypeScript types
• Clean component separation and reusability
• React Router for navigation
• Responsive design throughout
• Semantic HTML and accessibility considerations

You can view and edit the code directly in the built-in editor, or download the entire project as a standard React application.`,
  },
  {
    id: "integrations",
    title: "Integrations & Backend",
    icon: "ri-plug-line",
    content: `CreAIlity supports several backend and third-party integrations:

Supabase — Authentication, PostgreSQL database, file storage, real-time subscriptions, and edge functions. Perfect for full-stack apps.

Stripe — Accept payments with checkout sessions, subscription billing, and payment processing.

REST APIs — Connect to any REST API by describing the endpoints and data structure.

Shopify — Pull products from your Shopify store to build custom storefronts.`,
  },
  {
    id: "deployment",
    title: "Deployment & Sharing",
    icon: "ri-global-line",
    content: `Getting your app live is straightforward:

1. One-click deploy — push your app live instantly with a shareable URL
2. Share preview — generate a preview link to show others before final deployment
3. Custom domains — connect your own domain when you're ready to launch
4. Export & self-host — download the full project and deploy anywhere`,
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <SubPageNavbar currentPage="docs" />
      <section className="pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-4">Documentation</p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-foreground-950 leading-tight mb-5">
            Learn how to build with CreAIlity.
          </h1>
          <p className="text-base text-foreground-500 max-w-xl mx-auto leading-relaxed">
            Everything you need to know about building, iterating, and deploying apps.
          </p>
        </div>
      </section>
      <section className="py-8 md:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col gap-10">
            {docSections.map((section) => (
              <div key={section.id} id={section.id} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-500/10 border border-accent-500/20 flex-shrink-0">
                    <i className={`${section.icon} text-accent-400 text-sm`} />
                  </div>
                  <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground-950">{section.title}</h2>
                </div>
                <div className="rounded-2xl border border-background-300/60 bg-background-100 p-6">
                  {section.content.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="text-sm text-foreground-500 leading-relaxed mb-4 last:mb-0 whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 px-4 bg-background-100/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground-950 mb-4">Still have questions?</h2>
          <p className="text-sm text-foreground-500 mb-8 leading-relaxed">Can&apos;t find what you&apos;re looking for? Reach out and we&apos;ll help you out.</p>
          <Link to="/contact" className="inline-flex items-center gap-2 bg-accent-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap">
            Contact us <i className="ri-arrow-right-line text-xs" />
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}