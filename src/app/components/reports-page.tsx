import { useState, useMemo, useCallback } from "react";
import {
  FileBarChart2, Download, TrendingUp, TrendingDown, DollarSign,
  BarChart3, Target, Scale, Receipt,
  ArrowUpRight, ArrowDownRight,
  Table2, Activity, Wallet, AlertCircle,
  Check, Percent,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFinance } from "../lib/finance-context";
import {
  formatCurrency, calculateSmartBreakEven, getPartnerMonthlyCost,
  suggestSmartGoals,
} from "../lib/finance-data";
import { PeriodFilter } from "./ui/period-filter";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage } from "./permission-gate";
import { toast } from "sonner";
import { useTheme } from "../lib/theme-context";

type ReportTab = "dre" | "fluxo" | "breakeven" | "exportar";

const COLORS = ["#00FA64", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

const timePeriodOptions = [
  { key: "current_month", label: "Mês Atual" },
  { key: "3m", label: "3 Meses" },
  { key: "6m", label: "6 Meses" },
  { key: "12m", label: "12 Meses" },
  { key: "all", label: "Tudo" },
];

// ========== Custom Tooltip ==========
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 shadow-xl border text-[12px]" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}>
      <p className="mb-2" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            {typeof p.value === "number" ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ========== DRE Row ==========
function DreRow({
  label, value, indent = 0, bold = false, positive = null, sub = false,
  borderTop = false, accent = false,
}: {
  label: string; value: number; indent?: number; bold?: boolean;
  positive?: boolean | null; sub?: boolean; borderTop?: boolean; accent?: boolean;
}) {
  const isPos = positive === null ? value >= 0 : positive;
  const color = accent ? "var(--accent)" : isPos ? "#22c55e" : "#ef4444";
  return (
    <div
      className={`flex items-center justify-between py-2.5 px-4 ${borderTop ? "mt-1" : ""}`}
      style={{
        borderTop: borderTop ? "1px solid var(--border-subtle)" : undefined,
        paddingLeft: `${16 + indent * 20}px`,
      }}
    >
      <span
        className="text-[13px]"
        style={{
          color: bold ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: bold ? 600 : 400,
          fontSize: sub ? "12px" : "13px",
        }}
      >
        {label}
      </span>
      <span
        className="text-[13px] tabular-nums"
        style={{
          color: bold || accent ? color : value < 0 ? "#ef4444" : "var(--text-primary)",
          fontWeight: bold ? 600 : 400,
        }}
      >
        {value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
      </span>
    </div>
  );
}

// ========== Stat Card ==========
function StatCard({ icon: Icon, label, value, sub, color = "#FF0074", trend }: {
  icon: any; label: string; value: string; sub?: string; color?: string; trend?: number;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ${trend >= 0 ? "text-[#22c55e] bg-[#22c55e]/10" : "text-[#ef4444] bg-[#ef4444]/10"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-[12px] mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-[22px]" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

// ========== MAIN ==========
export function ReportsPage() {
  const { can } = usePermissions();
  const { accent } = useTheme();
  const { expenses, entries, accounts, variableParams, partners, goals, services, clients, marketingActions } = useFinance();

  const [activeTab, setActiveTab] = useState<ReportTab>("dre");
  const [period, setPeriod] = useState("current_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "custom" && customFrom && customTo)
      return { start: new Date(customFrom + "T00:00:00"), end: new Date(customTo + "T23:59:59") };
    if (period === "current_month")
      return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === "all")
      return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) };
    const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
    return { start: subMonths(now, months), end: now };
  }, [period, customFrom, customTo]);

  const filtered = useMemo(() =>
    entries.filter(e => {
      const d = new Date(e.date + "T12:00:00");
      return d >= dateRange.start && d <= dateRange.end;
    }), [entries, dateRange]);

  // ===== DRE Calcs =====
  const dre = useMemo(() => {
    const incomes = filtered.filter(e => e.type === "income");
    const expenseEntries = filtered.filter(e => e.type === "expense");

    const receitaBruta = incomes.reduce((s, e) => s + e.amount, 0);
    const cmv = incomes.reduce((s, e) => s + (e.directCosts?.reduce((cs, c) => cs + c.amount, 0) || 0), 0);
    const impostos = incomes.reduce((s, e) => s + (e.provisionedTaxes || 0), 0);
    const taxas = incomes.reduce((s, e) => s + (e.provisionedFees || 0), 0);
    const comissoes = incomes.reduce((s, e) => s + (e.provisionedCommissions || 0), 0);
    const marketingProv = incomes.reduce((s, e) => s + (e.provisionedMarketing || 0), 0);
    const despesasOp = expenseEntries.reduce((s, e) => s + e.amount, 0);

    const receitaLiquida = receitaBruta - impostos - taxas;
    const lucroBruto = receitaLiquida - cmv;
    const lucroOperacional = lucroBruto - despesasOp - comissoes - marketingProv;

    const fixedTotal = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
    const partnerTotal = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);

    // Breakdown by category (expenses)
    const expByCat: Record<string, number> = {};
    expenseEntries.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount; });

    const margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
    const margemLiquida = receitaBruta > 0 ? (lucroOperacional / receitaBruta) * 100 : 0;
    const margemContrib = receitaBruta > 0 ? ((receitaBruta - cmv - impostos - taxas) / receitaBruta) * 100 : 0;

    return {
      receitaBruta, cmv, impostos, taxas, comissoes, marketingProv,
      receitaLiquida, lucroBruto, despesasOp, lucroOperacional,
      fixedTotal, partnerTotal,
      margemBruta, margemLiquida, margemContrib,
      expByCat,
    };
  }, [filtered, expenses, partners]);

  // ===== Cash Flow Monthly =====
  const cashFlowData = useMemo(() => {
    const now = new Date();
    const months = period === "3m" ? 3 : period === "6m" ? 6 : period === "12m" ? 12 : 6;
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const monthEntries = entries.filter(e => {
        const ed = new Date(e.date + "T12:00:00");
        return ed.getMonth() === m && ed.getFullYear() === y;
      });
      const receitas = monthEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const despesas = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      result.push({
        mes: format(d, "MMM/yy", { locale: ptBR }),
        receitas,
        despesas,
        saldo: receitas - despesas,
      });
    }
    return result;
  }, [entries, period]);

  // Accumulated cash flow
  const cashFlowAccum = useMemo(() => {
    let acc = 0;
    return cashFlowData.map(m => {
      acc += m.saldo;
      return { ...m, acumulado: acc };
    });
  }, [cashFlowData]);

  // ===== Break-even =====
  const breakEven = useMemo(() => {
    const fixedExpensesTotal = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
    const partnerTotal = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
    const varPercent = variableParams.filter(v => v.active && v.unit === "%" && v.type !== "profit_margin" && v.type !== "card_fee").reduce((s, v) => s + v.value, 0);
    const be = calculateSmartBreakEven(fixedExpensesTotal, partnerTotal, varPercent);
    const suggested = suggestSmartGoals(be);
    return { ...be, suggested, varPercent, partnerTotal, fixedExpensesTotal };
  }, [expenses, partners, variableParams]);

  // Revenue to plot break-even chart
  const breakEvenChart = useMemo(() => {
    const max = Math.max(breakEven.breakEvenRevenue * 2, 1);
    const step = max / 10;
    return Array.from({ length: 11 }, (_, i) => {
      const rev = i * step;
      const varCosts = rev * (breakEven.varPercent / 100);
      const totalCosts = breakEven.fixedCostsTotal + varCosts;
      return {
        receita: rev,
        custos: totalCosts,
        receitas: rev,
        resultado: rev - totalCosts,
      };
    });
  }, [breakEven]);

  // ===== Export CSV =====
  const handleExportDRE = useCallback(() => {
    const rows = [
      ["DRE Gerencial", ""],
      ["Período", `${format(dateRange.start, "dd/MM/yyyy")} - ${format(dateRange.end, "dd/MM/yyyy")}`],
      ["", ""],
      ["Receita Bruta", dre.receitaBruta.toFixed(2)],
      ["(-) Impostos", (-dre.impostos).toFixed(2)],
      ["(-) Taxas", (-dre.taxas).toFixed(2)],
      ["= Receita Líquida", dre.receitaLiquida.toFixed(2)],
      ["(-) CMV / Custos Diretos", (-dre.cmv).toFixed(2)],
      ["= Lucro Bruto", dre.lucroBruto.toFixed(2)],
      ["Margem Bruta (%)", dre.margemBruta.toFixed(1) + "%"],
      ["(-) Despesas Operacionais", (-dre.despesasOp).toFixed(2)],
      ["(-) Comissões Provisionadas", (-dre.comissoes).toFixed(2)],
      ["(-) Marketing Provisionado", (-dre.marketingProv).toFixed(2)],
      ["= Lucro Operacional", dre.lucroOperacional.toFixed(2)],
      ["Margem Líquida (%)", dre.margemLiquida.toFixed(1) + "%"],
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("DRE exportado com sucesso");
  }, [dre, dateRange]);

  const handleExportEntries = useCallback(() => {
    const header = ["Data", "Tipo", "Descricao", "Categoria", "Cliente", "Valor Bruto", "CMV", "Impostos", "Taxas", "Comissoes", "Valor Liquido", "Forma de Pagamento", "Status"];
    const rows = filtered.map(e => [
      e.date,
      e.type === "income" ? "Receita" : "Despesa",
      e.description,
      e.category,
      e.client || "",
      e.amount.toFixed(2),
      (e.directCosts?.reduce((s, c) => s + c.amount, 0) || 0).toFixed(2),
      (e.provisionedTaxes || 0).toFixed(2),
      (e.provisionedFees || 0).toFixed(2),
      (e.provisionedCommissions || 0).toFixed(2),
      (e.netAmount || e.amount).toFixed(2),
      e.paymentMethod || "",
      e.status === "paid" ? "Pago" : "Pendente",
    ]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Lancamentos_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lançamentos exportados com sucesso");
  }, [filtered]);

  const handleExportFluxo = useCallback(() => {
    const header = ["Mes", "Receitas", "Despesas", "Saldo Mensal", "Saldo Acumulado"];
    const rows = cashFlowAccum.map(m => [
      m.mes,
      m.receitas.toFixed(2),
      m.despesas.toFixed(2),
      m.saldo.toFixed(2),
      m.acumulado.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FluxoCaixa_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fluxo de Caixa exportado com sucesso");
  }, [cashFlowAccum]);

  if (!can("dashboard", "view")) return <NoAccessPage />;

  const tabs: { key: ReportTab; label: string; icon: any }[] = [
    { key: "dre", label: "DRE Gerencial", icon: Scale },
    { key: "fluxo", label: "Fluxo de Caixa", icon: Activity },
    { key: "breakeven", label: "Break-even", icon: Target },
    { key: "exportar", label: "Exportar Dados", icon: Download },
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
            <FileBarChart2 className="w-5 h-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-[20px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Relatórios</h1>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>DRE, Fluxo de Caixa, Break-even e exportação de dados</p>
          </div>
        </div>
        <PeriodFilter
          options={timePeriodOptions}
          value={period}
          onChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto custom-scrollbar" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] transition-all whitespace-nowrap"
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

      {/* === DRE TAB === */}
      {activeTab === "dre" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Receita Bruta"
              value={formatCurrency(dre.receitaBruta)}
              color="var(--accent)"
            />
            <StatCard
              icon={TrendingUp}
              label="Lucro Bruto"
              value={formatCurrency(dre.lucroBruto)}
              sub={`Margem: ${dre.margemBruta.toFixed(1)}%`}
              color={dre.lucroBruto >= 0 ? "#22c55e" : "#ef4444"}
            />
            <StatCard
              icon={Wallet}
              label="Lucro Operacional"
              value={formatCurrency(dre.lucroOperacional)}
              sub={`Margem: ${dre.margemLiquida.toFixed(1)}%`}
              color={dre.lucroOperacional >= 0 ? "#22c55e" : "#ef4444"}
            />
            <StatCard
              icon={BarChart3}
              label="Margem de Contribuição"
              value={`${dre.margemContrib.toFixed(1)}%`}
              sub="Sobre receita bruta"
              color="#3b82f6"
            />
          </div>

          {/* DRE Table */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>DRE — Demonstração do Resultado do Exercício</h2>
              </div>
              <button
                onClick={handleExportDRE}
                className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg transition-all"
                style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </div>

            <div className="divide-y" style={{ borderColor: "var(--border-extra-subtle)" }}>
              {/* Receita Bruta */}
              <div className="px-4 py-2" style={{ backgroundColor: "rgba(var(--accent-rgb),0.03)" }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)", fontWeight: 600 }}>Receitas</p>
              </div>
              <DreRow label="(+) Receita Bruta de Vendas/Serviços" value={dre.receitaBruta} bold />
              <DreRow label="(-) Impostos sobre Receita" value={-dre.impostos} indent={1} sub />
              <DreRow label="(-) Taxas de Gateway / Cartão" value={-dre.taxas} indent={1} sub />
              <DreRow label="= Receita Líquida" value={dre.receitaLiquida} bold borderTop />

              {/* Custos */}
              <div className="px-4 py-2" style={{ backgroundColor: "rgba(var(--accent-rgb),0.03)" }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)", fontWeight: 600 }}>Custos</p>
              </div>
              <DreRow label="(-) CMV / Custos Diretos de Serviço" value={-dre.cmv} indent={1} sub />
              <DreRow label="= Lucro Bruto" value={dre.lucroBruto} bold borderTop />
              <DreRow
                label={`Margem Bruta: ${dre.margemBruta.toFixed(1)}%`}
                value={dre.lucroBruto}
                indent={1} sub
                positive={dre.margemBruta >= 0}
              />

              {/* Despesas Operacionais */}
              <div className="px-4 py-2" style={{ backgroundColor: "rgba(var(--accent-rgb),0.03)" }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)", fontWeight: 600 }}>Despesas Operacionais</p>
              </div>
              {Object.entries(dre.expByCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                <DreRow key={cat} label={`(-) ${cat}`} value={-val} indent={1} sub />
              ))}
              {dre.comissoes > 0 && <DreRow label="(-) Comissões de Venda" value={-dre.comissoes} indent={1} sub />}
              {dre.marketingProv > 0 && <DreRow label="(-) Marketing Provisionado" value={-dre.marketingProv} indent={1} sub />}
              {dre.despesasOp === 0 && dre.comissoes === 0 && dre.marketingProv === 0 && (
                <div className="flex items-center gap-2 px-6 py-3">
                  <AlertCircle className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Nenhuma despesa lançada no período</span>
                </div>
              )}

              {/* Resultado */}
              <DreRow
                label="= Lucro / Prejuízo Operacional"
                value={dre.lucroOperacional}
                bold borderTop accent
                positive={dre.lucroOperacional >= 0}
              />
              <DreRow
                label={`Margem Líquida: ${dre.margemLiquida.toFixed(1)}%`}
                value={dre.lucroOperacional}
                indent={1} sub positive={dre.margemLiquida >= 0}
              />
            </div>
          </div>

          {/* Waterfall-style chart */}
          {dre.receitaBruta > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[14px] mb-4" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Composição do Resultado</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={[
                    { name: "Receita Bruta", value: dre.receitaBruta, fill: "#22c55e" },
                    { name: "Impostos/Taxas", value: -(dre.impostos + dre.taxas), fill: "#ef4444" },
                    { name: "CMV", value: -dre.cmv, fill: "#f59e0b" },
                    { name: "Lucro Bruto", value: dre.lucroBruto, fill: "#3b82f6" },
                    { name: "Desp. Op.", value: -(dre.despesasOp + dre.comissoes + dre.marketingProv), fill: "#ef4444" },
                    { name: "Lucro Op.", value: dre.lucroOperacional, fill: dre.lucroOperacional >= 0 ? "#FF0074" : "#ef4444" },
                  ]}
                  margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                  <Bar dataKey="value" name="Valor" radius={[6, 6, 0, 0]}>
                    {[
                      { fill: "#22c55e" }, { fill: "#ef4444" }, { fill: "#f59e0b" },
                      { fill: "#3b82f6" }, { fill: "#ef4444" },
                      { fill: dre.lucroOperacional >= 0 ? accent : "#ef4444" },
                    ].map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* === FLUXO DE CAIXA TAB === */}
      {activeTab === "fluxo" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const totalRec = cashFlowData.reduce((s, m) => s + m.receitas, 0);
              const totalDesp = cashFlowData.reduce((s, m) => s + m.despesas, 0);
              const saldoFinal = cashFlowAccum[cashFlowAccum.length - 1]?.acumulado || 0;
              const melhorMes = cashFlowData.reduce((best, m) => m.saldo > best.saldo ? m : best, cashFlowData[0] || { saldo: 0, mes: "-" });
              return (
                <>
                  <StatCard icon={TrendingUp} label="Total Receitas" value={formatCurrency(totalRec)} color="#22c55e" />
                  <StatCard icon={TrendingDown} label="Total Despesas" value={formatCurrency(totalDesp)} color="#ef4444" />
                  <StatCard icon={Wallet} label="Saldo Acumulado" value={formatCurrency(saldoFinal)} color={saldoFinal >= 0 ? "#3b82f6" : "#ef4444"} />
                  <StatCard icon={Activity} label="Melhor Mês" value={melhorMes.mes} sub={formatCurrency(melhorMes.saldo)} color="#f59e0b" />
                </>
              );
            })()}
          </div>

          {/* Bars + line */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Receitas vs Despesas por Período</h3>
              <button
                onClick={handleExportFluxo}
                className="flex items-center gap-1.5 text-[12px] px-3 py-2 rounded-lg transition-all"
                style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar key="bar-receitas" dataKey="receitas" name="Receitas" fill="#22c55e" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                <Bar key="bar-despesas" dataKey="despesas" name="Despesas" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Saldo acumulado */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <h3 className="text-[14px] mb-4" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Saldo Acumulado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cashFlowAccum} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                <Area key="area-acc" type="monotone" dataKey="acumulado" name="Saldo Acumulado" stroke="#3b82f6" strokeWidth={2} fill="url(#gradAcc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Detalhamento Mensal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-hover)" }}>
                    {["Mês", "Receitas", "Despesas", "Saldo Mensal", "Saldo Acumulado"].map(h => (
                      <th key={h} className="px-4 py-3 text-left" style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashFlowAccum.map((m, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{m.mes}</td>
                      <td className="px-4 py-3 text-[#22c55e]">{formatCurrency(m.receitas)}</td>
                      <td className="px-4 py-3 text-[#ef4444]">{formatCurrency(m.despesas)}</td>
                      <td className={`px-4 py-3 ${m.saldo >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{formatCurrency(m.saldo)}</td>
                      <td className={`px-4 py-3 ${m.acumulado >= 0 ? "text-[#3b82f6]" : "text-[#ef4444]"}`} style={{ fontWeight: 500 }}>{formatCurrency(m.acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === BREAK-EVEN TAB === */}
      {activeTab === "breakeven" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Target}
              label="Ponto de Equilíbrio"
              value={formatCurrency(breakEven.breakEvenRevenue)}
              sub={`${formatCurrency(breakEven.breakEvenDaily)}/dia (22 dias úteis)`}
              color="var(--accent)"
            />
            <StatCard
              icon={Receipt}
              label="Custos Fixos Totais"
              value={formatCurrency(breakEven.fixedCostsTotal)}
              sub={`Despesas: ${formatCurrency(breakEven.fixedExpensesTotal)} + Equipe: ${formatCurrency(breakEven.partnerTotal)}`}
              color="#f59e0b"
            />
            <StatCard
              icon={Percent}
              label="Margem de Contribuição"
              value={`${breakEven.contributionMargin.toFixed(1)}%`}
              sub="Do faturamento bruto"
              color="#22c55e"
            />
            <StatCard
              icon={BarChart3}
              label="Var. Percentual Total"
              value={`${breakEven.varPercent.toFixed(1)}%`}
              sub="Impostos + taxas + outros"
              color="#3b82f6"
            />
          </div>

          {/* Break-even chart */}
          <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <h3 className="text-[14px] mb-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Gráfico do Ponto de Equilíbrio</h3>
            <p className="text-[12px] mb-4" style={{ color: "var(--text-secondary)" }}>Onde a linha de receitas cruza com os custos totais = ponto de equilíbrio</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={breakEvenChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="receita" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={breakEven.breakEvenRevenue} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: "Break-even", fill: "var(--accent)", fontSize: 11 }} />
                <Line key="line-receitas" type="monotone" dataKey="receitas" name="Receitas" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                <Line key="line-custos" type="monotone" dataKey="custos" name="Custos Totais" stroke="#ef4444" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Fixed costs detail */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[14px] mb-4" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Composição dos Custos Fixos</h3>
              {breakEven.fixedCostsTotal > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Despesas Fixas", value: breakEven.fixedExpensesTotal },
                        { name: "Equipe / Sócios", value: breakEven.partnerTotal },
                      ]}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                      dataKey="value"
                    >
                      <Cell key="cell-0" fill="#3b82f6" />
                      <Cell key="cell-1" fill={accent} />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                  <AlertCircle className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                  <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Nenhum custo fixo cadastrado</p>
                </div>
              )}
              <div className="space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Despesas Fixas</span>
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(breakEven.fixedExpensesTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#FF0074]" />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Equipe / Sócios</span>
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(breakEven.partnerTotal)}</span>
                </div>
              </div>
            </div>

            {/* Smart Goals suggestion */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[14px] mb-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Metas Sugeridas pelo Break-even</h3>
              <p className="text-[12px] mb-4" style={{ color: "var(--text-secondary)" }}>Baseadas no seu ponto de equilíbrio atual</p>
              <div className="space-y-3">
                {[
                  { label: "Pessimista", value: breakEven.suggested.pessimistic, mult: "1,1x", color: "#f59e0b" },
                  { label: "Realista", value: breakEven.suggested.realistic, mult: "1,3x", color: "#3b82f6" },
                  { label: "Otimista", value: breakEven.suggested.optimistic, mult: "1,6x", color: "#22c55e" },
                  { label: "Agressivo", value: breakEven.suggested.aggressive, mult: "2,0x", color: accent },
                ].map(g => (
                  <div key={g.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-hover)" }}>
                    <div className="w-2 h-full min-h-[28px] rounded-full" style={{ backgroundColor: g.color, width: "4px" }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{g.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${g.color}20`, color: g.color }}>{g.mult} break-even</span>
                      </div>
                      <p className="text-[15px] mt-0.5" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatCurrency(g.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expenses by category */}
          {expenses.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[14px] mb-4" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Despesas Fixas por Categoria</h3>
              <div className="space-y-2">
                {(() => {
                  const expenseTotals: Record<string, number> = {};
                  expenses.forEach((e) => {
                    if (e.unit === "R$") {
                      expenseTotals[e.category] = (expenseTotals[e.category] || 0) + e.amount;
                    }
                  });

                  return Object.entries(expenseTotals)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([cat, rawVal], i) => {
                      const val = Number(rawVal) || 0;
                      const pct = breakEven.fixedExpensesTotal > 0 ? (val / breakEven.fixedExpensesTotal) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{cat}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{pct.toFixed(1)}%</span>
                              <span className="text-[12px]" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{formatCurrency(val)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === EXPORTAR TAB === */}
      {activeTab === "exportar" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DRE export card */}
            {[
              {
                icon: Scale,
                title: "DRE Gerencial",
                desc: "Demonstração do Resultado do Exercício completa com receitas, custos e margens.",
                action: handleExportDRE,
                label: "Exportar DRE (CSV)",
                color: "var(--accent)",
                rows: "Resumo financeiro",
              },
              {
                icon: Activity,
                title: "Fluxo de Caixa Mensal",
                desc: "Histórico de receitas, despesas e saldo acumulado mês a mês.",
                action: handleExportFluxo,
                label: "Exportar Fluxo de Caixa (CSV)",
                color: "#3b82f6",
                rows: `${cashFlowData.length} meses`,
              },
              {
                icon: Table2,
                title: "Lançamentos do Período",
                desc: "Todos os lançamentos financeiros com detalhamento de CMV, impostos e comissões.",
                action: handleExportEntries,
                label: "Exportar Lançamentos (CSV)",
                color: "#22c55e",
                rows: `${filtered.length} registros`,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}15` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-[14px]" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{item.title}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                    <p className="text-[11px] mt-1.5 px-2 py-0.5 rounded-lg inline-block" style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" }}>{item.rows}</p>
                  </div>
                </div>
                <button
                  onClick={item.action}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] transition-all hover:opacity-90"
                  style={{ backgroundColor: item.color, color: item.color === "var(--accent)" ? "var(--accent-foreground)" : "#ffffff", fontWeight: 500 }}
                >
                  <Download className="w-4 h-4" />
                  {item.label}
                </button>
              </div>
            ))}

            {/* Info card */}
            <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <p className="text-[13px]" style={{ color: "var(--text-primary)", fontWeight: 600 }}>Sobre a Exportação</p>
              </div>
              <div className="space-y-2.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {[
                  "Os arquivos CSV são compatíveis com Excel, Google Sheets e LibreOffice.",
                  "Todos os valores monetários usam ponto como separador decimal.",
                  "O período selecionado no filtro acima é aplicado a todos os relatórios.",
                  "Para melhor visualização no Excel, abra como 'Dados Externos' com ponto-e-vírgula como delimitador.",
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#22c55e]" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(var(--accent-rgb),0.05)", border: "1px solid rgba(var(--accent-rgb),0.1)" }}>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Período atual: <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {format(dateRange.start, "dd/MM/yyyy")} – {format(dateRange.end, "dd/MM/yyyy")}
                  </span>
                </p>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
                  Lançamentos no período: <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{filtered.length}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-[24px]" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{expenses.length}</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>Despesas Cadastradas</p>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-[24px]" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{services.length}</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>Serviços</p>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-[24px]" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{clients.length}</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>Clientes</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
