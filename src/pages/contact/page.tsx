import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import SubPageNavbar from "@/components/feature/SubPageNavbar";
import Footer from "@/components/feature/Footer";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = new URLSearchParams();
    formData.forEach((value, key) => {
      body.append(key, value as string);
    });

    try {
      const res = await fetch("https://readdy.ai/api/form/d8llhu6e3ril29sjplmg", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (res.ok) {
        setSubmitted(true);
        form.reset();
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <SubPageNavbar currentPage="contact" />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-4">Contact</p>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground-950 leading-tight mb-4">Get in touch</h1>
            <p className="text-sm text-foreground-500 leading-relaxed max-w-md mx-auto">Have questions, feedback, or need help? We&apos;d love to hear from you.</p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-accent-500/20 bg-accent-500/5 p-8 text-center">
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-accent-500/10 border border-accent-500/20 mx-auto mb-4">
                <i className="ri-check-line text-accent-400 text-2xl" />
              </div>
              <h2 className="text-lg font-semibold text-foreground-900 mb-2">Message sent!</h2>
              <p className="text-sm text-foreground-500 leading-relaxed mb-6">Thanks for reaching out. We typically respond within 24 hours.</p>
              <button onClick={() => setSubmitted(false)} className="text-sm text-foreground-600 border border-background-300/60 rounded-xl px-5 py-2 hover:border-foreground-500 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap">Send another message</button>
            </div>
          ) : (
            <form data-readdy-form id="contact-form" onSubmit={handleSubmit} className="rounded-2xl border border-background-300/60 bg-background-100 p-6 md:p-8">
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-xs font-medium text-foreground-700">Name</label>
                    <input type="text" id="name" name="name" required placeholder="Your name" className="bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 text-sm text-foreground-800 placeholder-foreground-500 outline-none focus:border-foreground-500/50 transition-colors" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-xs font-medium text-foreground-700">Email</label>
                    <input type="email" id="email" name="email" required placeholder="you@example.com" className="bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 text-sm text-foreground-800 placeholder-foreground-500 outline-none focus:border-foreground-500/50 transition-colors" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="subject" className="text-xs font-medium text-foreground-700">Subject</label>
                  <input type="text" id="subject" name="subject" required placeholder="What's this about?" className="bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 text-sm text-foreground-800 placeholder-foreground-500 outline-none focus:border-foreground-500/50 transition-colors" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="message" className="text-xs font-medium text-foreground-700">Message</label>
                  <textarea id="message" name="message" required maxLength={500} rows={5} placeholder="Tell us what's on your mind..." className="bg-background-200/40 border border-background-300/50 rounded-xl px-3 py-2.5 text-sm text-foreground-800 placeholder-foreground-500 outline-none focus:border-foreground-500/50 transition-colors resize-none" />
                  <span className="text-[10px] text-foreground-500 text-right">Maximum 500 characters</span>
                </div>
                {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3"><p className="text-xs text-red-400">{error}</p></div>}
                <button type="submit" disabled={submitting} className="flex items-center justify-center gap-2 bg-accent-500 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</> : <>Send message <i className="ri-send-plane-fill text-xs" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}