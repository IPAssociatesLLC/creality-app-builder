import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
  { label: "Pricing", href: "#pricing" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
    setMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background-50/95 backdrop-blur-md border-b border-background-200"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center cursor-pointer">
          <img
            src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png"
            alt="CreAIlity"
            className="h-9 w-auto object-contain"
          />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              className={`text-sm transition-colors duration-200 cursor-pointer whitespace-nowrap ${scrolled ? "text-foreground-600 hover:text-foreground-950" : "text-white/75 hover:text-white"}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="#" className={`text-sm transition-colors cursor-pointer whitespace-nowrap ${scrolled ? "text-foreground-600 hover:text-foreground-950" : "text-white/75 hover:text-white"}`}>Sign in</a>
          <a href="#hero" onClick={(e) => handleAnchorClick(e, "#hero")}
            className="inline-flex items-center gap-2 bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap">
            Start building <i className="ri-arrow-right-line text-xs" />
          </a>
        </div>

        <button className="md:hidden w-8 h-8 flex items-center justify-center cursor-pointer" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <i className={`text-lg transition-colors ${scrolled ? "text-foreground-950" : "text-white"} ${menuOpen ? "ri-close-line" : "ri-menu-line"}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-background-50 border-t border-background-200 px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} onClick={(e) => handleAnchorClick(e, link.href)}
              className="text-sm text-foreground-700 hover:text-foreground-950 transition-colors cursor-pointer">
              {link.label}
            </a>
          ))}
          <a href="#hero" onClick={(e) => handleAnchorClick(e, "#hero")}
            className="inline-flex items-center justify-center gap-2 bg-accent-500 text-white text-sm font-medium px-4 py-2.5 rounded-full hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap">
            Start building <i className="ri-arrow-right-line text-xs" />
          </a>
        </div>
      )}
    </nav>
  );
}