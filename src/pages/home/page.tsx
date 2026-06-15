import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import HeroSection from "./components/HeroSection";
import FeaturesSection from "./components/FeaturesSection";
import HowItWorksSection from "./components/HowItWorksSection";
import ShowcaseSection from "./components/ShowcaseSection";
import StatsSection from "./components/StatsSection";
import CTASection from "./components/CTASection";
import FAQSection from "./components/FAQSection";
import Footer from "@/components/feature/Footer";
import GitHubModal from "@/pages/workspace/components/GitHubModal";
import UploadModal from "@/pages/workspace/components/UploadModal";

export default function Home() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background-50">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background-50/90 backdrop-blur-xl border-b border-background-200"
            : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between h-14 px-6">
          <a href="/" className="flex items-center flex-shrink-0 cursor-pointer">
            <img
              src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png"
              alt="CreAIlity"
              className="h-12 w-auto object-contain"
            />
          </a>

          <div className="hidden md:flex items-center gap-1">
            {["Features", "Showcase", "FAQ"].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={(e) => handleAnchorClick(e, `#${item.toLowerCase()}`)}
                className="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-foreground-600 hover:text-foreground-800"
              >
                {item}
              </a>
            ))}
            <Link
              to="/pricing"
              className="text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-foreground-600 hover:text-foreground-800"
            >
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGitHub(true)}
              className="hidden sm:flex items-center gap-1.5 text-sm transition-colors cursor-pointer whitespace-nowrap text-foreground-600 hover:text-foreground-800"
            >
              <i className="ri-github-line" />
              Import
            </button>
            <button
              onClick={() => navigate("/workspace")}
              className="hidden sm:flex items-center gap-1.5 bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              Start building
              <i className="ri-arrow-right-line text-xs" />
            </button>
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <i className={`text-lg text-foreground-800 ${mobileMenuOpen ? "ri-close-line" : "ri-menu-line"}`} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-background-50 border-t border-background-200 px-5 py-4 flex flex-col gap-3">
            <a href="#features" onClick={(e) => { handleAnchorClick(e, "#features"); setMobileMenuOpen(false); }} className="text-sm text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer py-1">Features</a>
            <a href="#showcase" onClick={(e) => { handleAnchorClick(e, "#showcase"); setMobileMenuOpen(false); }} className="text-sm text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer py-1">Showcase</a>
            <a href="#faq" onClick={(e) => { handleAnchorClick(e, "#faq"); setMobileMenuOpen(false); }} className="text-sm text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer py-1">FAQ</a>
            <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer py-1">Pricing</Link>
            <button onClick={() => { setMobileMenuOpen(false); navigate("/workspace"); }} className="flex items-center justify-center gap-1.5 bg-accent-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap mt-1">
              Start building <i className="ri-arrow-right-line text-xs" />
            </button>
          </div>
        )}
      </nav>

      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ShowcaseSection />
      <StatsSection />
      <CTASection />
      <FAQSection />
      <Footer />

      {showGitHub && <GitHubModal onClose={() => setShowGitHub(false)} onImport={() => { setShowGitHub(false); navigate("/workspace"); }} />}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); navigate("/workspace"); }} />}
    </div>
  );
}