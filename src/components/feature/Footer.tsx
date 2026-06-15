const footerLinks = {
  Product: ["Features", "How it works", "Pricing"],
  Resources: ["Documentation", "Examples", "Blog"],
  Company: ["About", "Privacy", "Terms", "Contact"],
  Connect: ["Twitter / X", "GitHub", "Discord", "LinkedIn", "YouTube"],
};

export default function Footer() {
  return (
    <footer className="bg-foreground-950 border-t border-foreground-900 px-4 pt-16 pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <img
                src="https://storage.readdy-site.link/project_files/c6e462cf-b14b-45cb-80da-88f2eb6a9c28/fbdcb9b1-2ade-459a-af68-f0b38e142f9e_CreAIlity-app-logo.png"
                alt="CreAIlity"
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-xs text-foreground-500 leading-relaxed">
              Build beautiful, production-ready apps from a single prompt with CreAIlity. No code required.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {["ri-twitter-x-line", "ri-github-line", "ri-discord-line"].map((icon) => (
                <a key={icon} href="#"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-foreground-900 border border-foreground-800 hover:bg-foreground-800 transition-colors cursor-pointer">
                  <i className={`${icon} text-foreground-400 text-sm`} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-foreground-500 uppercase tracking-widest mb-4">{category}</p>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href={link === "Features" ? "/features" : link === "How it works" ? "/#how-it-works" : link === "Pricing" ? "/pricing" : link === "Documentation" ? "/docs" : link === "Privacy" ? "/privacy" : link === "Terms" ? "/terms" : link === "Contact" ? "/contact" : "#"}
                      className="text-sm text-foreground-400 hover:text-background-50 transition-colors cursor-pointer whitespace-nowrap">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-foreground-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-foreground-600 text-center sm:text-left">© 2026 CreAIlity, Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-xs text-foreground-600 hover:text-foreground-400 transition-colors cursor-pointer whitespace-nowrap">Privacy Policy</a>
            <a href="/terms" className="text-xs text-foreground-600 hover:text-foreground-400 transition-colors cursor-pointer whitespace-nowrap">Terms of Service</a>
            <a href="#" className="text-xs text-foreground-600 hover:text-foreground-400 transition-colors cursor-pointer whitespace-nowrap">Cookie Settings</a>
          </div>
        </div>
      </div>
    </footer>
  );
}