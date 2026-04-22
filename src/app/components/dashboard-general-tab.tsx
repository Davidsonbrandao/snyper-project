import { useMemo, useRef } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Target, AlertCircle,
  ArrowUpRight, ArrowDownRight, Check, Shield, Crosshair, Rocket,
  Activity, Zap, Clock, ExternalLink, Heart,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { subMonths, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, calculateSmartBreakEven, getPartnerMonthlyCost } from "../lib/finance-data";
import type { DailyEntry } from "../lib/finance-data";
import { useTheme } from "../lib/theme-context";

interface Props {
  dateRange: { start: Date; end: Date };
  period: string;
}

export function DashboardGeneralTab({ dateRange, period }: Props) {
  const { expenses, accounts, entries, goals, variableParams, partners, commissionMembers, marketingActions } = useFinance();
  const navigate = useNavigate();
  const { accent } = useTheme();

  // Stable 'now' reference - only changes once per minute
  const nowRef = useRef(new Date());
  const now = nowRef.current;

  // Filtered entries by period
  const monthEntries = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.date + "T12:00:00");
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [entries, dateRange]);

  // Previous period entries for comparison
  const lastMonthEntries = useMemo(() => {
    const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
    const prevStart = new Date(dateRange.start.getTime() - durationMs);
    const prevEnd = new Date(dateRange.start.getTime() - 1);
    return entries.filter(e => {
      const d = new Date(e.date + "T12:00:00");
      return d >= prevStart && d <= prevEnd;
    });
  }, [entries, dateRange]);

  const stats = useMemo(() => {
    const incomeEntries = monthEntries.filter(e => e.type === "income");
    const totalReceitas = incomeEntries.reduce((s, e) => s + e.amount, 0);
    const totalDespesas = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);

    const totalCMV = incomeEntries.reduce((s, e) => s + (e.directCosts?.reduce((cs, c) => cs + c.amount, 0) || 0), 0);
    const totalImpostos = incomeEntries.reduce((s, e) => s + (e.provisionedTaxes || 0), 0);
    const totalTaxas = incomeEntries.reduce((s, e) => s + (e.provisionedFees || 0), 0);
    const totalComissoes = incomeEntries.reduce((s, e) => s + (e.provisionedCommissions || 0), 0);
    const totalMarketing = incomeEntries.reduce((s, e) => s + (e.provisionedMarketing || 0), 0);

    const lucroBruto = totalReceitas - totalCMV - totalImpostos - totalTaxas;
    const lucroLiquido = lucroBruto - totalComissoes - totalMarketing - totalDespesas;

    const fixedExpensesTotal = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
    const partnerTotal = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
    const varPercent = variableParams.filter(v => v.active && v.unit === "%" && v.type !== "profit_margin" && v.type !== "card_fee").reduce((s, v) => s + v.value, 0);
    const breakEven = calculateSmartBreakEven(fixedExpensesTotal, partnerTotal, varPercent);

    const contasReceber = accounts.filter(a => a.type === "receivable" && a.status !== "paid").reduce((s, a) => s + a.amount, 0);
    const contasPagar = accounts.filter(a => a.type === "payable" && a.status !== "paid").reduce((s, a) => s + a.amount, 0);
    const contasVencidas = accounts.filter(a => a.status === "overdue").reduce((s, a) => s + a.amount, 0);

    // Last month for comparison
    const lastIncome = lastMonthEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const growthPercent = lastIncome > 0 ? ((totalReceitas - lastIncome) / lastIncome) * 100 : 0;

    const margemReal = totalReceitas > 0 ? (lucroLiquido / totalReceitas) * 100 : 0;
    const breakEvenProgress = breakEven.breakEvenRevenue > 0 ? Math.min((totalReceitas / breakEven.breakEvenRevenue) * 100, 100) : 0;

    const totalProvisions = totalImpostos + totalTaxas + totalComissoes + totalMarketing;

    return {
      totalReceitas, totalDespesas, lucroLiquido, lucroBruto,
      breakEven, contasReceber, contasPagar, contasVencidas,
      margemReal, growthPercent, breakEvenProgress,
      totalProvisions, fixedExpensesTotal, partnerTotal,
      qtdVendas: incomeEntries.length,
    };
  }, [monthEntries, lastMonthEntries, expenses, accounts, partners, variableParams]);

  // Health Score (0-100)
  const healthScore = useMemo(() => {
    let score = 50; // base
    if (stats.breakEvenProgress >= 100) score += 20;
    else score += (stats.breakEvenProgress / 100) * 15;
    if (stats.margemReal >= 20) score += 15;
    else if (stats.margemReal >= 10) score += 10;
    else if (stats.margemReal > 0) score += 5;
    if (stats.contasVencidas === 0) score += 10;
    else score -= 5;
    if (stats.growthPercent > 0) score += Math.min(stats.growthPercent / 2, 10);
    if (stats.lucroLiquido > 0) score += 5;
    return Math.min(Math.max(Math.round(score), 0), 100);
  }, [stats]);

  const healthLabel = healthScore >= 80 ? "Excelente" : healthScore >= 60 ? "Saudável" : healthScore >= 40 ? "Atenção" : "Crítico";
  const healthColor = healthScore >= 80 ? "#22c55e" : healthScore >= 60 ? "#3b82f6" : healthScore >= 40 ? "#f59e0b" : "#ef4444";

  // 6 month cashflow mini chart
  const cashFlowData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const mEntries = entries.filter(e => {
        const ed = new Date(e.date + "T12:00:00");
        return ed.getMonth() === m && ed.getFullYear() === y;
      });
      const receitas = mEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const despesas = mEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      data.push({
        id: `${y}-${m}`,
        label: format(d, "MMM/yy", { locale: ptBR }),
        receitas,
        despesas,
        saldo: receitas - despesas,
      });
    }
    return data;
  }, [entries]);

  // Smart alerts
  const alerts = useMemo(() => {
    const list: { id: string; type: "danger" | "warning" | "info"; title: string; desc: string }[] = [];

    if (stats.contasVencidas > 0) {
      list.push({ id: "overdue", type: "danger", title: "Contas Vencidas", desc: `Você tem ${formatCurrency(stats.contasVencidas)} em contas vencidas que precisam de atenção imediata.` });
    }
    if (stats.totalReceitas > 0 && stats.lucroLiquido <= 0) {
      list.push({ id: "no_profit", type: "danger", title: "Operação sem Lucro", desc: `Faturamento de ${formatCurrency(stats.totalReceitas)} mas o resultado líquido está negativo. Revise custos e precificação.` });
    }
    if (stats.margemReal > 0 && stats.margemReal < 15) {
      list.push({ id: "low_margin", type: "warning", title: "Margem Apertada", desc: `Margem liquida de ${stats.margemReal.toFixed(1)}% esta abaixo do saudavel (15%+). Considere ajustar precos ou cortar custos.` });
    }
    if (stats.breakEvenProgress < 80 && now.getDate() > 20) {
      list.push({ id: "be_risk", type: "warning", title: "Risco de Break-even", desc: `Faltam ${(100 - stats.breakEvenProgress).toFixed(0)}% para atingir o ponto de equilíbrio e o mês está acabando.` });
    }
    if (stats.contasPagar > stats.contasReceber * 1.5 && stats.contasPagar > 0) {
      list.push({ id: "cash_risk", type: "warning", title: "Fluxo de Caixa Pressionado", desc: `A pagar (${formatCurrency(stats.contasPagar)}) esta muito acima do a receber (${formatCurrency(stats.contasReceber)}).` });
    }
    if (list.length === 0 && stats.breakEvenProgress >= 100) {
      list.push({ id: "ok", type: "info", title: "Negócio Saudável", desc: "Ponto de equilíbrio atingido, sem alertas críticos. Continue monitorando sua margem e fluxo de caixa." });
    }
    return list;
  }, [stats, now]);

  // Recent entries
  const recentEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [entries]);

  const periodLabel = period === "current_month" ? "no periodo" : period === "all" ? "total" : `nos ultimos ${period === "3m" ? "3 meses" : period === "6m" ? "6 meses" : "12 meses"}`;

  return (
    <div className="space-y-5">
      {/* ROW 1: Health Score + Key KPIs */}
      <div className="grid grid-cols-12 gap-4">
        {/* Health Score - Hero */}
        <div className="col-span-3 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${healthColor}, transparent 70%)` }} />
          <Heart className="w-5 h-5 mb-2" style={{ color: healthColor }} />
          <p className="text-[11px] text-[#8a8a99] uppercase tracking-wider mb-1">Saúde do Negócio</p>
          <p className="text-[48px] text-white" style={{ fontWeight: 700, lineHeight: 1 }}>{healthScore}</p>
          <p className="text-[13px] mt-1" style={{ color: healthColor, fontWeight: 500 }}>{healthLabel}</p>
          <div className="w-full mt-4 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${healthScore}%`, backgroundColor: healthColor }} />
          </div>
        </div>

        {/* 4 KPIs */}
        <div className="col-span-9 grid grid-cols-4 gap-4">
          {/* Faturamento */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#22c55e]/10 flex items-center justify-center">
                <TrendingUp className="w-[18px] h-[18px] text-[#22c55e]" />
              </div>
              {stats.growthPercent !== 0 && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${stats.growthPercent > 0 ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
                  {stats.growthPercent > 0 ? "+" : ""}{stats.growthPercent.toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8a8a99] uppercase tracking-wider">Faturamento</p>
            <p className="text-[22px] text-white mt-0.5" style={{ fontWeight: 600 }}>{formatCurrency(stats.totalReceitas)}</p>
            <p className="text-[11px] text-[#8a8a99] mt-1">{stats.qtdVendas} vendas {periodLabel}</p>
          </div>

          {/* Lucro Líquido */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `rgba(var(--accent-rgb),0.1)` }}>
              <DollarSign className="w-[18px] h-[18px]" style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-[11px] text-[#8a8a99] uppercase tracking-wider">Lucro Líquido</p>
            <p className="text-[22px] mt-0.5" style={{ fontWeight: 600, color: stats.lucroLiquido >= 0 ? "var(--accent)" : "#ef4444" }}>
              {formatCurrency(stats.lucroLiquido)}
            </p>
            <p className="text-[11px] text-[#8a8a99] mt-1">Margem: {stats.margemReal.toFixed(1)}%</p>
          </div>

          {/* Despesas */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-[#ef4444]/10 flex items-center justify-center mb-3">
              <TrendingDown className="w-[18px] h-[18px] text-[#ef4444]" />
            </div>
            <p className="text-[11px] text-[#8a8a99] uppercase tracking-wider">Despesas</p>
            <p className="text-[22px] text-white mt-0.5" style={{ fontWeight: 600 }}>{formatCurrency(stats.totalDespesas)}</p>
            <p className="text-[11px] text-[#8a8a99] mt-1">Fixos: {formatCurrency(stats.fixedExpensesTotal)}/mes</p>
          </div>

          {/* Break-even */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center">
                <Target className="w-[18px] h-[18px] text-[#f59e0b]" />
              </div>
              <span className="text-[11px] text-[#8a8a99]">{stats.breakEvenProgress.toFixed(0)}%</span>
            </div>
            <p className="text-[11px] text-[#8a8a99] uppercase tracking-wider">Ponto de Equilíbrio</p>
            <p className="text-[22px] text-[#f59e0b] mt-0.5" style={{ fontWeight: 600 }}>{formatCurrency(stats.breakEven.breakEvenRevenue)}</p>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-2">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${stats.breakEvenProgress}%`,
                background: stats.breakEvenProgress >= 100 ? `linear-gradient(90deg, #22c55e, ${accent})` : "linear-gradient(90deg, #f59e0b, #ef4444)",
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: Goals Progress + Alerts */}
      <div className="grid grid-cols-12 gap-4">
        {/* Goals */}
        <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Metas do Mes</h3>
              <p className="text-[12px] text-[#8a8a99] mt-0.5">Acompanhe seu progresso em relação às metas P.R.O.</p>
            </div>
            <button onClick={() => navigate("/metas")} className="text-[11px] hover:underline flex items-center gap-1" style={{ color: "var(--accent)" }}>
              Configurar <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {/* Realizado */}
            <div className="rounded-xl p-4 flex flex-col justify-center relative overflow-hidden border" style={{ background: `linear-gradient(135deg, rgba(var(--accent-rgb),0.15) 0%, rgba(var(--accent-rgb),0.04) 100%)`, borderColor: `rgba(var(--accent-rgb),0.2)` }}>
              <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full blur-xl" style={{ backgroundColor: `rgba(var(--accent-rgb),0.2)` }} />
              <Zap className="w-4 h-4 mb-2" style={{ color: "var(--accent)" }} />
              <span className="text-[11px] mb-1" style={{ fontWeight: 500, color: "var(--accent)" }}>Realizado</span>
              <span className="text-[22px] text-white" style={{ fontWeight: 600 }}>{formatCurrency(stats.totalReceitas)}</span>
            </div>
            {/* Pessimista / Realista / Otimista */}
            {[
              { label: "Pessimista", value: goals.pessimistic, color: "#f59e0b", Icon: Shield },
              { label: "Realista", value: goals.realistic, color: "#3b82f6", Icon: Crosshair },
              { label: "Otimista", value: goals.optimistic, color: "#22c55e", Icon: Rocket },
            ].map(meta => {
              const progress = meta.value > 0 ? Math.min((stats.totalReceitas / meta.value) * 100, 100) : 0;
              const diff = meta.value - stats.totalReceitas;
              const reached = stats.totalReceitas >= meta.value;
              return (
                <div key={meta.label} className="bg-[#1c1c21] border border-white/[0.04] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    <span className="text-[12px] text-white" style={{ fontWeight: 500 }}>{meta.label}</span>
                  </div>
                  <span className="text-[11px] text-[#8a8a99] mb-1">Meta: {formatCurrency(meta.value)}</span>
                  <div className="mt-auto">
                    <div className="flex items-end justify-between mb-1">
                      <span className="text-[18px] text-white" style={{ fontWeight: 600 }}>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: meta.color }} />
                    </div>
                    <p className="text-[11px] text-[#8a8a99] mt-1.5">
                      {reached ? <span className="text-[#22c55e] flex items-center gap-1"><Check className="w-3 h-3" /> Atingida!</span> : `Faltam ${formatCurrency(diff)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-[#f59e0b]" />
            <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Alertas Inteligentes</h3>
          </div>
          <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
            {alerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded-xl border ${
                alert.type === "danger" ? "bg-[#ef4444]/8 border-[#ef4444]/15" :
                alert.type === "warning" ? "bg-[#f59e0b]/8 border-[#f59e0b]/15" :
                "bg-[#3b82f6]/8 border-[#3b82f6]/15"
              }`}>
                <h4 className={`text-[12px] mb-0.5 ${
                  alert.type === "danger" ? "text-[#ef4444]" : alert.type === "warning" ? "text-[#f59e0b]" : "text-[#3b82f6]"
                }`} style={{ fontWeight: 500 }}>{alert.title}</h4>
                <p className="text-[11px] text-white/70 leading-relaxed">{alert.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 3: Cashflow Trend + Contas */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cashflow mini chart */}
        <div className="col-span-7 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Tendência de 6 Meses</h3>
              <p className="text-[12px] text-[#8a8a99] mt-0.5">Evolução de receitas e despesas</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} /> Receitas</span>
              <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full bg-[#ef4444]" /> Despesas</span>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="gRecG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accent} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDespG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis key="xaxis" dataKey="label" stroke="#8a8a99" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis key="yaxis" stroke="#8a8a99" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip key="tooltip" contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                <Area key="area-receitas" type="monotone" dataKey="receitas" name="Receitas" stroke={accent} fill="url(#gRecG)" strokeWidth={2} dot={{ fill: accent, strokeWidth: 0, r: 3 }} />
                <Area key="area-despesas" type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fill="url(#gDespG)" strokeWidth={2} dot={{ fill: "#ef4444", strokeWidth: 0, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contas a Receber / Pagar */}
        <div className="col-span-5 grid grid-rows-2 gap-4">
          {/* A Receber */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-[#22c55e]" />
                </div>
                <div>
                  <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>A Receber</h4>
                  <p className="text-[10px] text-[#8a8a99]">{accounts.filter(a => a.type === "receivable" && a.status !== "paid").length} contas pendentes</p>
                </div>
              </div>
              <p className="text-[20px] text-[#22c55e]" style={{ fontWeight: 600 }}>{formatCurrency(stats.contasReceber)}</p>
            </div>
            <div className="space-y-1.5">
              {accounts.filter(a => a.type === "receivable" && a.status !== "paid").slice(0, 2).map(a => (
                <div key={a.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8a8a99] truncate pr-2">{a.client || a.description}</span>
                  <span className="text-white shrink-0">{formatCurrency(a.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* A Pagar */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ef4444]/10 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4 text-[#ef4444]" />
                </div>
                <div>
                  <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>A Pagar</h4>
                  <p className="text-[10px] text-[#8a8a99]">{accounts.filter(a => a.type === "payable" && a.status !== "paid").length} contas pendentes</p>
                </div>
              </div>
              <p className="text-[20px] text-[#ef4444]" style={{ fontWeight: 600 }}>{formatCurrency(stats.contasPagar)}</p>
            </div>
            <div className="space-y-1.5">
              {accounts.filter(a => a.type === "payable" && a.status !== "paid").slice(0, 2).map(a => (
                <div key={a.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8a8a99] truncate pr-2">{a.description}</span>
                  <span className="text-white shrink-0">{formatCurrency(a.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: Recent entries */}
      <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#8a8a99]" />
            <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Ultimos Lancamentos</h3>
          </div>
          <button onClick={() => navigate("/lancamentos")} className="text-[11px] hover:underline flex items-center gap-1" style={{ color: "var(--accent)" }}>
            Ver todos <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {recentEntries.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.04] transition-all">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: entry.type === "income" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                {entry.type === "income" ? <ArrowUpRight className="w-4 h-4 text-[#22c55e]" /> : <ArrowDownRight className="w-4 h-4 text-[#ef4444]" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white truncate">{entry.description}</p>
                <p className="text-[10px] text-[#8a8a99]">{format(parseISO(entry.date), "dd/MM")}</p>
              </div>
              <p className="text-[12px] shrink-0" style={{ fontWeight: 500, color: entry.type === "income" ? "#22c55e" : "#ef4444" }}>
                {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
              </p>
            </div>
          ))}
          {recentEntries.length === 0 && (
            <div className="col-span-5 text-center py-6 text-[#8a8a99] text-[12px]">Nenhum lançamento registrado ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
