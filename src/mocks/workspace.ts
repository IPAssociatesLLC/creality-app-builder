export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  language?: string;
  active?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  status?: "sending" | "building" | "done" | "error";
  actions?: { label: string; icon: string }[];
}

export const mockFileTree: FileNode[] = [
  {
    id: "src",
    name: "src",
    type: "folder",
    children: [
      {
        id: "components",
        name: "components",
        type: "folder",
        children: [
          { id: "navbar", name: "Navbar.tsx", type: "file", language: "tsx" },
          { id: "sidebar", name: "Sidebar.tsx", type: "file", language: "tsx" },
          { id: "dashboard", name: "Dashboard.tsx", type: "file", language: "tsx", active: true },
          { id: "chart", name: "RevenueChart.tsx", type: "file", language: "tsx" },
          { id: "table", name: "UsersTable.tsx", type: "file", language: "tsx" },
        ],
      },
      {
        id: "pages",
        name: "pages",
        type: "folder",
        children: [
          { id: "home-page", name: "Home.tsx", type: "file", language: "tsx" },
          { id: "settings-page", name: "Settings.tsx", type: "file", language: "tsx" },
        ],
      },
      {
        id: "hooks",
        name: "hooks",
        type: "folder",
        children: [
          { id: "useAuth", name: "useAuth.ts", type: "file", language: "ts" },
          { id: "useData", name: "useData.ts", type: "file", language: "ts" },
        ],
      },
      { id: "app", name: "App.tsx", type: "file", language: "tsx" },
      { id: "main", name: "main.tsx", type: "file", language: "tsx" },
      { id: "index-css", name: "index.css", type: "file", language: "css" },
    ],
  },
  { id: "package-json", name: "package.json", type: "file", language: "json" },
  { id: "tailwind", name: "tailwind.config.ts", type: "file", language: "ts" },
  { id: "tsconfig", name: "tsconfig.json", type: "file", language: "json" },
  { id: "vite", name: "vite.config.ts", type: "file", language: "ts" },
];

export const mockMessages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content: "Hi! I'm your AI builder. Describe what you want to build and I'll generate the full app — components, routing, styles, and logic. You can also import a project from GitHub or upload existing files to continue building on top of them.",
    timestamp: new Date(Date.now() - 1000 * 60 * 3),
    status: "done",
    actions: [
      { label: "Import from GitHub", icon: "ri-github-line" },
      { label: "Upload project", icon: "ri-upload-cloud-line" },
    ],
  },
  {
    id: "msg-2",
    role: "user",
    content: "Build me a SaaS analytics dashboard with a revenue chart, user stats, and a recent activity feed",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    status: "done",
  },
  {
    id: "msg-3",
    role: "assistant",
    content: "Built your SaaS analytics dashboard. Here's what I generated:\n\n• **Dashboard.tsx** — Main layout with sidebar nav and stats grid\n• **RevenueChart.tsx** — Interactive revenue line chart with monthly breakdown\n• **UsersTable.tsx** — Paginated user table with search and status filters\n• **Navbar.tsx** — Top bar with notifications and user avatar\n\nAll components use TypeScript with proper types. The preview is live on the right.",
    timestamp: new Date(Date.now() - 1000 * 60 * 1),
    status: "done",
  },
];

export const examplePrompts = [
  "Add a dark mode toggle to the navbar",
  "Create an onboarding wizard with 3 steps",
  "Add a pricing page with monthly/annual toggle",
  "Make the sidebar collapsible on mobile",
  "Add a CSV export button to the users table",
  "Create a settings page with profile and billing tabs",
  "Add real-time notifications with a dropdown",
  "Build a Kanban board for task management",
];

export const extensionExamplePrompts = [
  "Build a productivity timer that counts down and shows a notification",
  "Create a tab manager that groups open tabs by domain",
  "Build a price tracker that highlights discounts on shopping sites",
  "Make a reading mode that strips ads and cleans page layout",
  "Create a password strength checker that runs on login forms",
  "Build a dark mode injector for any website",
  "Make a custom new tab page with quick links and a clock",
  "Create a highlight and notes tool for saving page text",
  "Build a cookie consent auto-dismiss extension",
  "Make a word count tracker for text inputs on any page",
];