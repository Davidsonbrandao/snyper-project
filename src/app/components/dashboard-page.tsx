import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Wallet, Megaphone, ShoppingBag, FolderKanban,
  Maximize2, Minimize2, RotateCcw,
} from "lucide-react";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { DashboardGeneralTab } from "./dashboard-general-tab";
import { DashboardFinancialTab } from "./dashboard-financial-tab";
import { DashboardMarketingTab } from "./dashboard-marketing-tab";
import { DashboardSalesTab } from "./dashboard-sales-tab";
import { DashboardProjectsTab } from "./dashboard-projects-tab";
import { PeriodFilter } from "./ui/period-filter";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage } from "./permission-gate";

type DashboardTab = "geral" | "financeiro" | "marketing" | "vendas" | "projetos";

const tabs: { key: DashboardTab; label: string; icon: any }[] = [
  { key: "geral", label: "Geral", icon: LayoutDashboard },
  { key: "financeiro", label: "Financeiro", icon: Wallet },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "vendas", label: "Vendas", icon: ShoppingBag },
  { key: "projetos", label: "Projetos", icon: FolderKanban },
];

const timePeriodOptions = [
  { key: "current_month", label: "Mês Atual" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
  { key: "all", label: "Tudo" },
];

export function DashboardPage() {
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState<DashboardTab>("geral");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Shared period state for time-based tabs
  const [period, setPeriod] = useState("current_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "custom" && customFrom && customTo) return { start: new Date(customFrom + "T00:00:00"), end: new Date(customTo + "T23:59:59") };
    if (period === "current_month") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === "all") return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) };
    const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
    return { start: subMonths(now, months), end: now };
  }, [period, customFrom, customTo]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      const rfs = el.requestFullscreen || (el as any).webkitRequestFullscreen || (el as any).msRequestFullscreen;
      if (rfs) {
        rfs.call(el).then(() => setIsFullscreen(true)).catch(() => {
          // Fallback: fullscreen not supported (e.g. iframe sandbox)
          setIsFullscreen(prev => !prev);
        });
      } else {
        setIsFullscreen(prev => !prev);
      }
    } else {
      const efs = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen;
      if (efs) {
        efs.call(document).then(() => setIsFullscreen(false)).catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const tabDescriptions: Record<DashboardTab, string> = {
    geral: "Visão rápida da saúde do seu negócio",
    financeiro: "Análise financeira detalhada com DRE, provisões e fluxo de caixa",
    marketing: "Desempenho de campanhas, ROAS, CPA e funil de conversão",
    vendas: "Receitas, comissões, mix de vendas e ranking de equipe",
    projetos: "Acompanhamento de produção, prazos, tarefas e entregas",
  };

  const handleReset = useCallback(() => {
    setActiveTab("geral");
    setPeriod("current_month");
    setCustomFrom("");
    setCustomTo("");
    setResetKey(prev => prev + 1);
  }, []);

  if (!can("dashboard", "view")) return <NoAccessPage />;

  return (
    <div className={`space-y-5 pb-10 ${isFullscreen ? "fixed inset-0 z-50 p-6 overflow-auto" : ""}`} style={isFullscreen ? { backgroundColor: "var(--bg-base)" } : undefined}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div>
          <h1 className="text-[20px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Dashboard</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{tabDescriptions[activeTab]}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[12px] px-3 py-2.5 rounded-xl transition-all"
            style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            title="Resetar filtros e voltar para o mes atual"
          >
            <RotateCcw className="w-4 h-4" />
            Resetar
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 text-[12px] px-3 py-2.5 rounded-xl transition-all"
            style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
            title={isFullscreen ? "Sair do modo tela cheia" : "Modo tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {isFullscreen ? "Sair" : "Tela Cheia"}
          </button>
          <div className="hidden sm:flex items-center gap-2 ml-1">
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Online</span>
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tabs + Period Filter inline */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar">
        {/* Left: Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl shrink-0" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] transition-all"
              style={{
                fontWeight: activeTab === tab.key ? 500 : 400,
                backgroundColor: activeTab === tab.key ? "var(--accent)" : "transparent",
                color: activeTab === tab.key ? "var(--accent-foreground)" : "var(--text-secondary)",
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Period Filter */}
        <PeriodFilter
          options={timePeriodOptions}
          value={period}
          onChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
        />
      </div>

      {/* Tab Content */}
      {activeTab === "geral" && <DashboardGeneralTab key={`geral-${resetKey}`} dateRange={dateRange} period={period} />}
      {activeTab === "financeiro" && <DashboardFinancialTab key={`fin-${resetKey}`} dateRange={dateRange} period={period} />}
      {activeTab === "marketing" && <DashboardMarketingTab key={`mkt-${resetKey}`} dateRange={dateRange} period={period} />}
      {activeTab === "vendas" && <DashboardSalesTab key={`sales-${resetKey}`} dateRange={dateRange} period={period} />}
      {activeTab === "projetos" && <DashboardProjectsTab key={`proj-${resetKey}`} dateRange={dateRange} period={period} />}
    </div>
  );
}