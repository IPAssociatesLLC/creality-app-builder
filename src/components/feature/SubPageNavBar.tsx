import { Link } from "react-router-dom";

interface SubPageNavbarProps {
  currentPage?: "features" | "pricing" | "docs" | "terms" | "privacy" | "contact";
}

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

export default function SubPageNavbar({ currentPage }: SubPageNavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background-50/90 backdrop-blur-xl border-b border-background-200">
      <div className="flex items-center justify-between h-14 px-6">
        <Link to="/" className="flex items-center flex-shrink-0 cursor-pointer">
          <img
            src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png"
            alt="CreAIlity"
            className="h-8 w-auto object-contain"
          />
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                currentPage && link.label.toLowerCase() === currentPage
                  ? "text-foreground-900 font-medium bg-background-200/60"
                  : "text-foreground-600 hover:text-foreground-800 hover:bg-background-200/30"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/contact"
            className="hidden sm:inline text-sm text-foreground-600 hover:text-foreground-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Contact
          </Link>
          <Link
            to="/workspace"
            className="flex items-center gap-1.5 bg-accent-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            Start building
            <i className="ri-arrow-right-line text-xs" />
          </Link>
        </div>
      </div>
    </nav>
  );
}