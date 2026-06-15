import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import WorkspacePage from "../pages/workspace/page";
import PreviewPage from "../pages/preview/page";
import AuthPage from "../pages/auth/page";
import SettingsPage from "../pages/settings/page";
import AdminPage from "../pages/admin/page";
import PricingPage from "../pages/pricing/page";
import FeaturesPage from "../pages/features/page";
import DocsPage from "../pages/docs/page";
import TermsPage from "../pages/terms/page";
import PrivacyPage from "../pages/privacy/page";
import ContactPage from "../pages/contact/page";
import { AuthGuard } from "../components/feature/AuthGuard";

function ProtectedWorkspace() {
  return (
    <AuthGuard>
      <WorkspacePage />
    </AuthGuard>
  );
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/workspace",
    element: <ProtectedWorkspace />,
  },
  {
    path: "/preview/:id",
    element: <PreviewPage />,
  },
  {
    path: "/settings",
    element: <SettingsPage />,
  },
  {
    path: "/admin",
    element: <AdminPage />,
  },
  {
    path: "/pricing",
    element: <PricingPage />,
  },
  {
    path: "/features",
    element: <FeaturesPage />,
  },
  {
    path: "/docs",
    element: <DocsPage />,
  },
  {
    path: "/terms",
    element: <TermsPage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPage />,
  },
  {
    path: "/contact",
    element: <ContactPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;