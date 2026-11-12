import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { WhatsAppButton } from "./WhatsAppButton";
import { EmailVerificationBanner } from "./EmailVerificationBanner";
import { ErrorBoundary } from "./ErrorBoundary";
import { PageLoader } from "./ui/PageLoader";

export function PublicLayout() {
  const { pathname } = useLocation();

  // A client-side route change should land at the top of the new page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <EmailVerificationBanner />
      <main className="flex-1">
        {/* A crashing page keeps the navbar usable; navigating clears the error. */}
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
