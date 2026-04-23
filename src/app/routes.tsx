import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import { useAuth } from "./lib/auth-context";

function RouteLoader() {
  return (
    <div
      className="min-h-[40vh] flex items-center justify-center text-[13px]"
      style={{ color: "var(--text-secondary)" }}
    >
      Carregando modulo...
    </div>
  );
}

function createLazyRoute(
  loader: () => Promise<{ default: React.ComponentType<any> }>,
) {
  const LazyComponent = React.lazy(loader);

  return function LazyRoute(props: any) {
    return (
      <React.Suspense fallback={<RouteLoader />}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}

const PageLayoutRoute = createLazyRoute(() =>
  import("./components/page-layout").then((module) => ({
    default: module.PageLayout,
  })),
);
const DashboardRoute = createLazyRoute(() =>
  import("./components/dashboard-page").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ExpensesRoute = createLazyRoute(() =>
  import("./components/expenses-page").then((module) => ({
    default: module.ExpensesPage,
  })),
);
const AccountsRoute = createLazyRoute(() =>
  import("./components/accounts-page").then((module) => ({
    default: module.AccountsPage,
  })),
);
const EntriesRoute = createLazyRoute(() =>
  import("./components/entries-page").then((module) => ({
    default: module.EntriesPage,
  })),
);
const ServicesRoute = createLazyRoute(() =>
  import("./components/services-page").then((module) => ({
    default: module.ServicesPage,
  })),
);
const MarketingRoute = createLazyRoute(() =>
  import("./components/marketing-page").then((module) => ({
    default: module.MarketingPage,
  })),
);
const GoalsRoute = createLazyRoute(() =>
  import("./components/goals-page").then((module) => ({
    default: module.GoalsPage,
  })),
);
const TeamRoute = createLazyRoute(() =>
  import("./components/team-page").then((module) => ({
    default: module.TeamPage,
  })),
);
const ProfileRoute = createLazyRoute(() =>
  import("./components/profile-page").then((module) => ({
    default: module.ProfilePage,
  })),
);
const ClientsRoute = createLazyRoute(() =>
  import("./components/clients-page").then((module) => ({
    default: module.ClientsPage,
  })),
);
const PipelineRoute = createLazyRoute(() =>
  import("./components/pipeline-page").then((module) => ({
    default: module.PipelinePage,
  })),
);
const ProjectsRoute = createLazyRoute(() =>
  import("./components/projects-page").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const ReportsRoute = createLazyRoute(() =>
  import("./components/reports-page").then((module) => ({
    default: module.ReportsPage,
  })),
);
const AdminRoute = createLazyRoute(() =>
  import("./components/admin-panel").then((module) => ({
    default: module.AdminPanel,
  })),
);
const InvoicesRoute = createLazyRoute(() =>
  import("./components/invoices-page").then((module) => ({
    default: module.InvoicesPage,
  })),
);
const AuthConfirmRoute = createLazyRoute(() =>
  import("./AuthConfirm").then((module) => ({
    default: module.default,
  })),
);
const LoginPageRoute = createLazyRoute(() =>
  import("./components/login-page").then((module) => ({
    default: module.LoginPage,
  })),
);

function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return React.createElement("div", null, "Carregando...");
  }

  if (!user) {
    return React.createElement(Navigate, { to: "/login", replace: true });
  }

  return React.createElement(Outlet);
}

function PublicOnly() {
  const { user, loading } = useAuth();

  if (loading) {
    return React.createElement("div", null, "Carregando...");
  }

  if (user) {
    return React.createElement(Navigate, { to: "/", replace: true });
  }

  return React.createElement(Outlet);
}

function LoginRoute() {
  const { signIn, acceptInvite } = useAuth();
  const search = new URLSearchParams(window.location.search);
  return React.createElement(LoginPageRoute, {
    onSignIn: signIn,
    onAcceptInvite: acceptInvite,
    inviteToken: search.get("invite") || undefined,
    inviteEmail: search.get("email") || undefined,
  });
}

export const router = createBrowserRouter([
  {
    element: React.createElement(PublicOnly),
    children: [
      {
        path: "/login",
        Component: LoginRoute,
      },
    ],
  },
  {
    path: "/auth/confirm",
    Component: AuthConfirmRoute,
  },
  {
    element: React.createElement(RequireAuth),
    children: [
      {
        path: "/",
        Component: PageLayoutRoute,
        children: [
          {
            index: true,
            element: React.createElement(Navigate, {
              to: "/despesas",
              replace: true,
            }),
          },
          { path: "dashboard", Component: DashboardRoute },
          { path: "despesas", Component: ExpensesRoute },
          { path: "contas", Component: AccountsRoute },
          { path: "lancamentos", Component: EntriesRoute },
          { path: "servicos", Component: ServicesRoute },
          { path: "marketing", Component: MarketingRoute },
          { path: "metas", Component: GoalsRoute },
          { path: "equipe", Component: TeamRoute },
          { path: "notas-fiscais", Component: InvoicesRoute },
          { path: "perfil", Component: ProfileRoute },
          { path: "clientes", Component: ClientsRoute },
          { path: "pipeline", Component: PipelineRoute },
          { path: "projetos", Component: ProjectsRoute },
          { path: "relatorios", Component: ReportsRoute },
          { path: "admin", Component: AdminRoute },
        ],
      },
    ],
  },
  {
    path: "*",
    element: React.createElement(Navigate, { to: "/", replace: true }),
  },
]);
