import { Link } from "react-router-dom";
import SubPageNavbar from "@/components/feature/SubPageNavbar";
import Footer from "@/components/feature/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <SubPageNavbar currentPage="terms" />
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-medium text-foreground-600 uppercase tracking-widest mb-4">Legal</p>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground-950 leading-tight mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-foreground-500 mb-12">Last updated: June 2026</p>
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">1. Acceptance of Terms</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                By accessing or using CreAIlity (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to update these terms at any time, and continued use of the Service constitutes acceptance of any changes.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">2. Description of Service</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                CreAIlity is an AI-powered application builder that generates web applications based on natural language descriptions. The Service generates React + TypeScript + TailwindCSS code, provides a workspace for iteration, and offers deployment capabilities.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">3. User Accounts</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">4. Code Ownership</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                You retain full ownership of all code generated through the Service. CreAIlity does not claim any ownership over the applications, code, or content you create using our platform. You are free to use, modify, distribute, and deploy the generated code as you see fit.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">5. Acceptable Use</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                You agree not to use the Service to create applications that: (a) violate any applicable laws or regulations; (b) infringe upon the intellectual property rights of others; (c) distribute malware or harmful code; (d) engage in harassment or hate speech.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">6. Limitation of Liability</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                The Service is provided &quot;as is&quot; without warranties of any kind. CreAIlity shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground-900 mb-3">7. Contact</h2>
              <p className="text-sm text-foreground-500 leading-relaxed">
                If you have any questions about these Terms, please contact us through our contact page.
              </p>
              <Link to="/contact" className="inline-flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-600 transition-colors cursor-pointer mt-2 whitespace-nowrap">
                Contact us <i className="ri-arrow-right-line text-xs" />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}