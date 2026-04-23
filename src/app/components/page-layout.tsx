import { Outlet } from "react-router";
import { SidebarNav, useSidebarWidth } from "./sidebar-nav";
import { QuickSimulator } from "./quick-simulator";
import { LoginPage } from "./login-page";
import { useAuth } from "../lib/auth-context";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { NotificationProvider } from "../lib/notification-context";
import { NotificationEngine } from "./notification-engine";
import { PermissionsProvider } from "../lib/permissions-context";
import { HelpWidget } from "./help-widget";
import { OnboardingProvider } from "../lib/onboarding-context";
import { SetupBanner } from "./setup-banner";
import { OnboardingGuide } from "./onboarding-guide";

export function PageLayout() {
  const { user, loading, signIn, acceptInvite } = useAuth();
  const sidebarWidth = useSidebarWidth();
  const inviteToken = new URLSearchParams(window.location.search).get("invite") || undefined;
  const inviteEmail = new URLSearchParams(window.location.search).get("email") || undefined;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // Auth gate - show login if not authenticated
  if (!user) {
    return (
      <LoginPage
        onSignIn={signIn}
        onAcceptInvite={acceptInvite}
        inviteToken={inviteToken}
        inviteEmail={inviteEmail}
      />
    );
  }

  return (
    <NotificationProvider>
      <PermissionsProvider>
      <OnboardingProvider>
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)" }}>
        <SidebarNav />
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarWidth }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="min-h-screen"
        >
          {/* Setup banner for new users */}
          <SetupBanner />
          {/* Top bar with notification bell */}
          <div
            className="sticky top-0 z-30 flex items-center justify-end px-8 py-3 backdrop-blur-xl"
            style={{
              borderBottom: "1px solid var(--border-extra-subtle)",
            }}
          >
            <NotificationBell />
          </div>
          <div className="p-8 pt-4">
            <Outlet />
          </div>
        </motion.main>
        <QuickSimulator />
        <NotificationEngine />
        <OnboardingGuide />
        <HelpWidget />
      </div>
      </OnboardingProvider>
      </PermissionsProvider>
    </NotificationProvider>
  );
}
