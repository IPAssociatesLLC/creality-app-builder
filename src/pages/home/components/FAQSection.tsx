import { useState } from "react";

const faqs = [
  { q: "What kind of apps can CreAIlity build?", a: "CreAIlity can build a wide range of web applications: SaaS dashboards, e-commerce stores, portfolio sites, admin panels, booking systems, landing pages, internal tools, social platforms, and much more. If you can describe it in plain English, CreAIlity can build it." },
  { q: "What tech stack does CreAIlity generate?", a: "CreAIlity generates React + TypeScript applications styled with TailwindCSS. The code follows modern best practices: functional components, custom hooks, clean separation of concerns, and proper TypeScript typing throughout." },
  { q: "Can I edit the code after it's generated?", a: "Absolutely. You own 100% of the code. Download it, open it in VS Code, deploy it anywhere — it's just a standard React project with no vendor lock-in." },
  { q: "How is CreAIlity different from other AI coding tools?", a: "Most AI tools generate code snippets or answer questions. CreAIlity generates entire, working applications from a single prompt — with routing, state management, responsive design, and polished UI all included." },
  { q: "Is the generated code really production-ready?", a: "Yes. CreAIlity focuses on code quality, not just code quantity. You get TypeScript types, component splitting, semantic HTML, accessibility considerations, and responsive layouts." },
  { q: "What about connecting to a backend or database?", a: "CreAIlity can scaffold integrations with Supabase for authentication and database, Stripe for payments, and REST or GraphQL APIs." },
  { q: "How much does CreAIlity cost?", a: "CreAIlity offers a free tier that lets you build and preview apps. Paid plans unlock unlimited builds, custom domains, and team collaboration features." },
  { q: "Can multiple people work on the same project?", a: "Yes! Team plans allow multiple collaborators on a project. Each team member can prompt changes, and all edits are versioned." },
];

function FAQItem({ item, isOpen, onToggle }: { item: (typeof faqs)[0]; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-background-200/60 last:border-0">
      <button className="w-full flex items-center justify-between gap-4 py-5 text-left cursor-pointer hover:text-foreground-700 transition-colors group" onClick={onToggle} aria-expanded={isOpen}>
        <span className="text-sm md:text-base font-medium text-foreground-800 group-hover:text-foreground-950 leading-snug">{item.q}</span>
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0"><i className={`text-foreground-500 text-base transition-transform duration-300 ${isOpen ? "ri-subtract-line" : "ri-add-line"}`} /></div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96 pb-5" : "max-h-0"}`}>
        <p className="text-sm text-foreground-500 leading-relaxed">{item.a}</p>
      </div>
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (i: number) => { setOpenIndex(openIndex === i ? null : i); };
  const half = Math.ceil(faqs.length / 2);
  const leftFaqs = faqs.slice(0, half);
  const rightFaqs = faqs.slice(half);

  return (
    <section id="faq" className="py-24 md:py-32 px-4 bg-background-100/50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 mb-14">
          <div className="md:w-72 flex-shrink-0">
            <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-4">FAQ</p>
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground-950 leading-tight mb-4">Got questions?</h2>
            <p className="text-sm text-foreground-500 leading-relaxed">Everything you need to know about building with CreAIlity. Can&apos;t find the answer? Chat with our team.</p>
            <div className="flex gap-3 mt-6 flex-wrap">
              <a href="#" className="inline-flex items-center gap-2 text-sm font-medium text-foreground-800 border border-foreground-600/50 rounded-full px-4 py-2 hover:border-foreground-400 hover:bg-foreground-400/10 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-customer-service-line text-sm" />Talk to us</a>
              <a href="#" className="inline-flex items-center gap-2 text-sm text-foreground-500 border border-background-300/60 rounded-full px-4 py-2 hover:border-foreground-600 hover:text-foreground-700 transition-colors cursor-pointer whitespace-nowrap">See all docs <i className="ri-external-link-line text-xs" /></a>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12">
            <div className="border-t border-background-200/60">
              {leftFaqs.map((item, i) => <FAQItem key={i} item={item} isOpen={openIndex === i} onToggle={() => toggle(i)} />)}
            </div>
            <div className="border-t border-background-200/60">
              {rightFaqs.map((item, i) => <FAQItem key={i + half} item={item} isOpen={openIndex === i + half} onToggle={() => toggle(i + half)} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}