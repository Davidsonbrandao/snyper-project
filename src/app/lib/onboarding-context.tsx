import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useFinance } from "./finance-context";
import { useAuth } from "./auth-context";

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  route: string;
  completed: boolean;
  priority: number; // lower = more important
  category: "essencial" | "recomendado" | "opcional";
}

interface OnboardingContextType {
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isNewUser: boolean;
  isFullySetup: boolean;
  bannerDismissed: boolean;
  guideDismissedSteps: string[];
  dismissBanner: () => void;
  dismissGuideStep: (id: string) => void;
  resetDismissals: () => void;
  nextPendingStep: SetupStep | null;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const BANNER_DISMISS_KEY = "@pilar:onboard_banner_dismissed";
const GUIDE_DISMISS_KEY = "@pilar:onboard_guide_dismissed";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const {
    services, expenses, variableParams, accounts, clients,
    pipelineDeals, projects, goals, entries, commissionMembers,
    marketingActions, partners, isLoading,
  } = useFinance();

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return localStorage.getItem(BANNER_DISMISS_KEY) === "true"; } catch { return false; }
  });
  const [guideDismissedSteps, setGuideDismissedSteps] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem(GUIDE_DISMISS_KEY);
      return v ? JSON.parse(v) : [];
    } catch { return []; }
  });

  // Don't show onboarding for super admin
  const isSuperAdmin = user?.email?.toLowerCase() === "admin@snyper.com.br";

  const steps: SetupStep[] = useMemo(() => {
    if (isLoading || isSuperAdmin) return [];
    return [
      {
        id: "services",
        title: "Cadastrar Servicos",
        description: "Adicione os servicos que voce oferece para calcular precos e margens automaticamente.",
        route: "/servicos",
        completed: services.length > 0,
        priority: 1,
        category: "essencial",
      },
      {
        id: "expenses",
        title: "Configurar Custos Fixos",
        description: "Cadastre seus custos fixos mensais (aluguel, salarios, software, etc.) para o calculo correto do ponto de equilibrio.",
        route: "/despesas",
        completed: expenses.length > 0,
        priority: 2,
        category: "essencial",
      },
      {
        id: "variable_params",
        title: "Definir Parametros Variaveis",
        description: "Configure impostos, taxas de cartao, comissoes e margens de lucro na pagina de Despesas > Parametros Variaveis.",
        route: "/despesas",
        completed: variableParams.some(p => p.value > 0),
        priority: 3,
        category: "essencial",
      },
      {
        id: "accounts",
        title: "Cadastrar Contas Bancarias",
        description: "Adicione suas contas bancarias para controle de contas a pagar e receber.",
        route: "/contas",
        completed: accounts.length > 0,
        priority: 4,
        category: "essencial",
      },
      {
        id: "goals",
        title: "Definir Metas de Faturamento",
        description: "Estabeleca suas metas pessimista, realista, otimista e agressiva para acompanhar seu desempenho.",
        route: "/metas",
        completed: goals.realistic > 0,
        priority: 5,
        category: "essencial",
      },
      {
        id: "clients",
        title: "Cadastrar Primeiro Cliente",
        description: "Adicione seus clientes para vincula-los a deals no Pipeline e projetos.",
        route: "/clientes",
        completed: clients.length > 0,
        priority: 6,
        category: "recomendado",
      },
      {
        id: "pipeline",
        title: "Criar Primeiro Deal no Pipeline",
        description: "Crie um deal no Pipeline para acompanhar suas oportunidades de venda.",
        route: "/pipeline",
        completed: pipelineDeals.length > 0,
        priority: 7,
        category: "recomendado",
      },
      {
        id: "entries",
        title: "Registrar Primeiro Lancamento",
        description: "Registre receitas e despesas diarias para acompanhar seu fluxo de caixa.",
        route: "/lancamentos",
        completed: entries.length > 0,
        priority: 8,
        category: "recomendado",
      },
      {
        id: "marketing",
        title: "Configurar Acoes de Marketing",
        description: "Cadastre suas campanhas e acoes de marketing para acompanhar o ROI.",
        route: "/marketing",
        completed: marketingActions.length > 0,
        priority: 9,
        category: "opcional",
      },
      {
        id: "team",
        title: "Adicionar Pessoas da Equipe",
        description: "Cadastre socios, funcionarios CLT, prestadores PJ ou freelancers em Despesas > Salarios & Retiradas.",
        route: "/despesas",
        completed: partners.length > 0,
        priority: 10,
        category: "opcional",
      },
    ];
  }, [services, expenses, variableParams, accounts, clients, pipelineDeals, projects, goals, entries, commissionMembers, marketingActions, partners, isLoading, isSuperAdmin]);

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
  const isNewUser = completedCount < 3 && !isLoading && !isSuperAdmin;
  const isFullySetup = completedCount === totalCount;

  const nextPendingStep = useMemo(() => {
    return steps
      .filter(s => !s.completed && !guideDismissedSteps.includes(s.id))
      .sort((a, b) => a.priority - b.priority)[0] || null;
  }, [steps, guideDismissedSteps]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try { localStorage.setItem(BANNER_DISMISS_KEY, "true"); } catch {}
  }, []);

  const dismissGuideStep = useCallback((id: string) => {
    setGuideDismissedSteps(prev => {
      const next = [...prev, id];
      try { localStorage.setItem(GUIDE_DISMISS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetDismissals = useCallback(() => {
    setBannerDismissed(false);
    setGuideDismissedSteps([]);
    try {
      localStorage.removeItem(BANNER_DISMISS_KEY);
      localStorage.removeItem(GUIDE_DISMISS_KEY);
    } catch {}
  }, []);

  return (
    <OnboardingContext.Provider value={{
      steps, completedCount, totalCount, progressPercent,
      isNewUser, isFullySetup, bannerDismissed, guideDismissedSteps,
      dismissBanner, dismissGuideStep, resetDismissals, nextPendingStep,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    return {
      steps: [], completedCount: 0, totalCount: 0, progressPercent: 100,
      isNewUser: false, isFullySetup: true, bannerDismissed: true,
      guideDismissedSteps: [], dismissBanner: () => {}, dismissGuideStep: () => {},
      resetDismissals: () => {}, nextPendingStep: null,
    } as OnboardingContextType;
  }
  return ctx;
}