import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/auth/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";

// The landing page is the sales page, and most of its visitors never sign
// in. Bundling the dashboard, the request wizard, the projects page and
// Forge into it took the first load from 294kB to 566kB -- a third of a
// megabyte of code for pages a visitor has not asked for. They load when
// somebody actually navigates to one.
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));
const Signup = lazy(() => import("./pages/Signup").then((m) => ({ default: m.Signup })));
const CheckEmail = lazy(() => import("./pages/CheckEmail").then((m) => ({ default: m.CheckEmail })));
const ResetRequest = lazy(() => import("./pages/ResetRequest").then((m) => ({ default: m.ResetRequest })));
const ResetPassword = lazy(() => import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Request = lazy(() => import("./pages/Request").then((m) => ({ default: m.Request })));
const Projects = lazy(() => import("./pages/Projects").then((m) => ({ default: m.Projects })));
const Forge = lazy(() => import("./pages/Forge").then((m) => ({ default: m.Forge })));
const Services = lazy(() => import("./pages/Services").then((m) => ({ default: m.Services })));
const ServiceDetail = lazy(() =>
  import("./pages/ServiceDetail").then((m) => ({ default: m.ServiceDetail })),
);
const Packages = lazy(() => import("./pages/Packages").then((m) => ({ default: m.Packages })));
const Terms = lazy(() => import("./pages/legal/Terms").then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import("./pages/legal/Privacy").then((m) => ({ default: m.Privacy })));

/**
 * Every page a client touches is now a React route.
 *
 * The pre-React pages in public/ owned all of these until now, and the
 * split showed: a visitor got the new landing page and then fell straight
 * back into the old site the moment they clicked Log in. The replaced
 * .html and .js files are deleted in the same change, because a matching
 * file beats the SPA redirect on Netlify -- leaving them would mean the
 * old page still won and none of this would be reachable.
 *
 * Still legacy, still served as files: the content pages (services,
 * how-it-works, packages, terms, privacy, business-pool, ai-trading), the
 * owner-only admin page, and the public project-view link. They work, and
 * each is a self-contained page rather than part of the signed-in flow.
 */
export default function App() {
  return (
    <AuthProvider>
      {/* Blank rather than a spinner: these chunks arrive in well under
          the time it takes a spinner to stop looking like a fault. */}
      <Suspense fallback={<div className="min-h-dvh bg-void" />}>
        <Routes>
          <Route path="/" element={<Landing />} />

          {/* Prices are public. Only ordering needs an account. */}
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/reset" element={<ResetRequest />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Forge answers signed-out visitors too, so it is not protected. */}
          <Route path="/forge" element={<Forge />} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/request"
            element={
              <RequireAuth>
                <Request />
              </RequireAuth>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <Projects />
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
