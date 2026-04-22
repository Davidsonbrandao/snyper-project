import { formatCurrency, calculateSmartBreakEven, getPartnerMonthlyCost, type Partner } from "../lib/finance-data";
import { useTheme } from "../lib/theme-context";
import { useMemo } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Wallet, PiggyBank, Receipt, FileText, AlertCircle, Check, BarChart3,
  Layers, CreditCard, Scale, Users, Briefcase, Package, CalendarClock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { subMonths, startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFinance } from "../lib/finance-context";

interface Props {
  dateRange: { start: Date; end: Date };
  period: string;
}

export function DashboardFinancialTab({ dateRange, period }: Props) {
  const { expenses, accounts, entries, variableParams, partners } = useFinance();
  const { accent } = useTheme();

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.date + "T12:00:00");
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [entries, dateRange]);

  const stats = useMemo(() => {
    const incomes = filtered.filter(e => e.type === "income");
    const expenseEntries = filtered.filter(e => e.type === "expense");

    const receitaBruta = incomes.reduce((s, e) => s + e.amount, 0);
    const despesasLancadas = expenseEntries.reduce((s, e) => s + e.amount, 0);

    const cmv = incomes.reduce((s, e) => s + (e.directCosts?.reduce((cs, c) => cs + c.amount, 0) || 0), 0);
    const impostos = incomes.reduce((s, e) => s + (e.provisionedTaxes || 0), 0);
    const taxas = incomes.reduce((s, e) => s + (e.provisionedFees || 0), 0);
    const comissoes = incomes.reduce((s, e) => s + (e.provisionedCommissions || 0), 0);
    const marketing = incomes.reduce((s, e) => s + (e.provisionedMarketing || 0), 0);

    const totalProvisions = impostos + taxas + comissoes + marketing;
    const receitaLiquida = receitaBruta - impostos - taxas;
    const lucroBruto = receitaLiquida - cmv;
    const lucroOperacional = lucroBruto - despesasLancadas - comissoes - marketing;

    const fixedTotal = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
    const partnerTotal = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
    const varPercent = variableParams.filter(v => v.active && v.unit === "%" && v.type !== "profit_margin" && v.type !== "card_fee").reduce((s, v) => s + v.value, 0);
    const breakEven = calculateSmartBreakEven(fixedTotal, partnerTotal, varPercent);

    const contasReceberPending = accounts.filter(a => a.type === "receivable" && a.status !== "paid");
    const contasPagarPending = accounts.filter(a => a.type === "payable" && a.status !== "paid");
    const contasVencidas = accounts.filter(a => a.status === "overdue");
    const totalPagoPeriodo = accounts.filter(a => a.status === "paid").reduce((s, a) => s + a.amount, 0);

    return {
      receitaBruta, despesasLancadas, cmv, impostos, taxas, comissoes, marketing,
      totalProvisions, receitaLiquida, lucroBruto, lucroOperacional,
      fixedTotal, partnerTotal, breakEven,
      contasReceber: contasReceberPending.reduce((s, a) => s + a.amount, 0),
      contasPagar: contasPagarPending.reduce((s, a) => s + a.amount, 0),
      contasVencidas: contasVencidas.reduce((s, a) => s + a.amount, 0),
      qtdVencidas: contasVencidas.length,
      totalPagoPeriodo,
      margemBruta: receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0,
      margemOperacional: receitaBruta > 0 ? (lucroOperacional / receitaBruta) * 100 : 0,
    };
  }, [filtered, expenses, accounts, partners, variableParams]);

  // Waterfall data (DRE simplificado)
  const waterfallData = useMemo(() => [
    { name: "Receita Bruta", value: stats.receitaBruta, color: "#22c55e" },
    { name: "Impostos", value: -stats.impostos, color: "#ef4444" },
    { name: "Taxas", value: -stats.taxas, color: "#f59e0b" },
    { name: "CMV", value: -stats.cmv, color: "#ef4444" },
    { name: "Comissões", value: -stats.comissoes, color: "#a855f7" },
    { name: "Marketing", value: -stats.marketing, color: "#3b82f6" },
    { name: "Despesas Op.", value: -stats.despesasLancadas, color: "#ef4444" },
    { name: "Resultado", value: stats.lucroOperacional, color: stats.lucroOperacional >= 0 ? accent : "#ef4444" },
  ], [stats, accent]);

  // Expense breakdown pie
  const expenseBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + (e.unit === "R$" ? e.amount : 0); });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Monthly cashflow
  const monthlyData = useMemo(() => {
    const months = period === "current_month" ? 1 : period === "3m" ? 3 : period === "6m" ? 6 : 12;
    const data = [];
    for (let i = Math.min(months, 12) - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const me = entries.filter(e => {
        const ed = new Date(e.date + "T12:00:00");
        return ed.getMonth() === m && ed.getFullYear() === y;
      });
      const r = me.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const dp = me.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      data.push({ id: `${y}-${m}`, label: format(d, "MMM/yy", { locale: ptBR }), receitas: r, despesas: dp, saldo: r - dp });
    }
    return data;
  }, [entries, period]);

  // Weekly cashflow for current month
  const weeklyData = useMemo(() => {
    const now = new Date();
    const mk = format(now, "yyyy-MM");
    const me = entries.filter(e => e.date.startsWith(mk));
    const weeks = [
      { name: "Sem 1", receitas: 0, despesas: 0 },
      { name: "Sem 2", receitas: 0, despesas: 0 },
      { name: "Sem 3", receitas: 0, despesas: 0 },
      { name: "Sem 4", receitas: 0, despesas: 0 },
    ];
    me.forEach(e => {
      const day = parseInt(e.date.split("-")[2]);
      const wi = Math.min(Math.floor((day - 1) / 7), 3);
      if (e.type === "income") weeks[wi].receitas += e.amount;
      else weeks[wi].despesas += e.amount;
    });
    return weeks;
  }, [entries]);

  // Payroll data
  const payrollData = useMemo(() => {
    const TYPE_LABELS: Record<string, string> = { socio: "Socio", clt: "CLT", pj: "PJ / MEI", freelancer: "Freelancer" };
    const TYPE_COLORS: Record<string, string> = { socio: "#8b5cf6", clt: "#3b82f6", pj: "#f59e0b", freelancer: "#22c55e" };

    const activePartners = partners.filter(p => p.status !== "inactive");
    const totalFolha = activePartners.reduce((s, p) => s + getPartnerMonthlyCost(p), 0);
    const productionPartners = activePartners.filter(p => p.payPerProduction);

    // Pagamentos do periodo (entries com productionPayment ou supplier = partner.name)
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");
    const paidThisMonth = entries.filter(e =>
      e.type === "expense" && e.date.startsWith(currentMonth) && e.status !== "pending" &&
      (e.productionPayment || activePartners.some(p => p.name === e.supplier))
    );
    const totalPaidThisMonth = paidThisMonth.reduce((s, e) => s + e.amount, 0);

    // Breakdown por tipo
    const byType = activePartners.reduce((acc, p) => {
      const t = p.type || "socio";
      if (!acc[t]) acc[t] = { count: 0, cost: 0 };
      acc[t].count++;
      acc[t].cost += getPartnerMonthlyCost(p);
      return acc;
    }, {} as Record<string, { count: number; cost: number }>);

    // Proximos pagamentos (hoje ate 7 dias)
    const today = now.getDate();
    const upcomingPayments = activePartners
      .filter(p => {
        const pd = p.paymentDay || 0;
        if (pd === 0) return false;
        const daysUntil = pd >= today ? pd - today : (30 - today) + pd;
        return daysUntil <= 7 && daysUntil >= 0;
      })
      .sort((a, b) => (a.paymentDay || 0) - (b.paymentDay || 0));

    return { activePartners, totalFolha, productionPartners, totalPaidThisMonth, byType, upcomingPayments, TYPE_LABELS, TYPE_COLORS };
  }, [partners, entries]);

  const COLORS = [accent, "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#ef4444"];

  const saldoCaixa = stats.contasReceber - stats.contasPagar;

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Receita Bruta", value: stats.receitaBruta, color: "#22c55e", icon: TrendingUp },
          { label: "Receita Liquida", value: stats.receitaLiquida, color: "#3b82f6", icon: DollarSign },
          { label: "Lucro Bruto", value: stats.lucroBruto, color: accent, icon: Wallet, sub: `Margem: ${stats.margemBruta.toFixed(1)}%` },
          { label: "Resultado Oper.", value: stats.lucroOperacional, color: stats.lucroOperacional >= 0 ? accent : "#ef4444", icon: BarChart3, sub: `Margem: ${stats.margemOperacional.toFixed(1)}%` },
          { label: "Provisões Retidas", value: stats.totalProvisions, color: "#a855f7", icon: PiggyBank },
          { label: "Saldo Caixa Proj.", value: saldoCaixa, color: saldoCaixa >= 0 ? "#22c55e" : "#ef4444", icon: Scale },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#131316] rounded-2xl p-4 border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${kpi.color}15` }}>
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
            </div>
            <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">{kpi.label}</p>
            <p className="text-[18px] text-white mt-0.5" style={{ fontWeight: 600, color: kpi.value < 0 ? "#ef4444" : undefined }}>{formatCurrency(kpi.value)}</p>
            {kpi.sub && <p className="text-[10px] text-[#8a8a99] mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* DRE Simplificado + Provisões */}
      <div className="grid grid-cols-12 gap-4">
        {/* DRE */}
        <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <h3 className="text-white text-[15px] mb-1" style={{ fontWeight: 500 }}>DRE Simplificado</h3>
          <p className="text-[12px] text-[#8a8a99] mb-5">De receita bruta ao resultado operacional</p>
          <div className="space-y-2">
            {waterfallData.map((item, i) => {
              const maxVal = Math.max(...waterfallData.map(w => Math.abs(w.value)));
              const barWidth = maxVal > 0 ? (Math.abs(item.value) / maxVal) * 100 : 0;
              const isLast = i === waterfallData.length - 1;
              return (
                <div key={item.name} className={`flex items-center gap-3 py-2 ${isLast ? "border-t border-white/[0.06] pt-3 mt-1" : ""}`}>
                  <span className="text-[12px] text-[#8a8a99] w-[120px] shrink-0">{item.name}</span>
                  <div className="flex-1 h-6 bg-white/[0.02] rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: item.color, opacity: 0.7 }}
                    />
                  </div>
                  <span className={`text-[13px] w-[110px] text-right shrink-0 ${isLast ? "" : ""}`} style={{ fontWeight: isLast ? 600 : 400, color: item.color }}>
                    {item.value >= 0 ? "" : "-"}{formatCurrency(Math.abs(item.value))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provisões */}
        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <PiggyBank className="w-4 h-4 text-[#a855f7]" />
            <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Provisões (Reservas)</h3>
          </div>
          <div className="space-y-3 flex-1">
            {[
              { label: "Impostos", value: stats.impostos, color: "#ef4444" },
              { label: "Taxas Gateway", value: stats.taxas, color: "#f59e0b" },
              { label: "Comissões", value: stats.comissoes, color: "#a855f7" },
              { label: "Marketing", value: stats.marketing, color: "#3b82f6" },
            ].map(p => (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#8a8a99]">{p.label}</span>
                  <span className="text-[12px] text-white">{formatCurrency(p.value)}</span>
                </div>
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${stats.totalProvisions > 0 ? (p.value / stats.totalProvisions) * 100 : 0}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-white/[0.06] flex justify-between items-center mt-auto">
              <span className="text-[12px] text-white" style={{ fontWeight: 500 }}>Total Retido</span>
              <span className="text-[16px] text-white" style={{ fontWeight: 600 }}>{formatCurrency(stats.totalProvisions)}</span>
            </div>
          </div>

          {/* Break-even */}
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-[#8a8a99]">Ponto de Equilíbrio</span>
              <span className="text-[13px] text-[#f59e0b]" style={{ fontWeight: 500 }}>{formatCurrency(stats.breakEven.breakEvenRevenue)}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#8a8a99]">Custos Fixos</span>
              <span className="text-[12px] text-white">{formatCurrency(stats.fixedTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#8a8a99]">Equipe (Folha)</span>
              <span className="text-[12px] text-white">{formatCurrency(stats.partnerTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fluxo de Caixa + Despesas por Categoria */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <h3 className="text-white text-[15px] mb-1" style={{ fontWeight: 500 }}>Fluxo de Caixa Mensal</h3>
          <p className="text-[12px] text-[#8a8a99] mb-5">Receitas vs Despesas por mes</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" stroke="#8a8a99" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8a8a99" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                <Bar dataKey="receitas" fill={accent} radius={[6, 6, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} opacity={0.6} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
          <h3 className="text-white text-[14px] mb-1" style={{ fontWeight: 500 }}>Despesas por Categoria</h3>
          <p className="text-[12px] text-[#8a8a99] mb-3">Custos fixos cadastrados</p>
          {expenseBreakdown.length > 0 ? (
            <>
              <div style={{ height: 140 }} className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                      {expenseBreakdown.map((entry, i) => <Cell key={`exp-${entry.name}-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-auto">
                {expenseBreakdown.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-[#8a8a99] truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {item.name}
                    </span>
                    <span className="text-white shrink-0 ml-1">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-[#8a8a99]">Sem despesas cadastradas</div>
          )}
        </div>
      </div>

      {/* Contas detalhadas */}
      <div className="grid grid-cols-12 gap-4">
        {/* Contas a Receber */}
        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight className="w-4 h-4 text-[#22c55e]" />
            <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Contas a Receber</h3>
          </div>
          <p className="text-[24px] text-[#22c55e] mb-4" style={{ fontWeight: 600 }}>{formatCurrency(stats.contasReceber)}</p>
          <div className="space-y-2">
            {accounts.filter(a => a.type === "receivable" && a.status !== "paid").slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <div className="min-w-0">
                  <p className="text-[12px] text-white truncate">{a.client || a.description}</p>
                  <p className="text-[10px] text-[#8a8a99]">Venc: {a.dueDate ? format(parseISO(a.dueDate), "dd/MM") : "---"}</p>
                </div>
                <span className="text-[12px] text-[#22c55e] shrink-0 ml-2">{formatCurrency(a.amount)}</span>
              </div>
            ))}
            {accounts.filter(a => a.type === "receivable" && a.status !== "paid").length === 0 && (
              <p className="text-[11px] text-[#8a8a99]">Nenhuma conta a receber</p>
            )}
          </div>
        </div>

        {/* Contas a Pagar */}
        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownRight className="w-4 h-4 text-[#ef4444]" />
            <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Contas a Pagar</h3>
          </div>
          <p className="text-[24px] text-[#ef4444] mb-4" style={{ fontWeight: 600 }}>{formatCurrency(stats.contasPagar)}</p>
          <div className="space-y-2">
            {accounts.filter(a => a.type === "payable" && a.status !== "paid").slice(0, 5).map(a => (
              <div key={a.id} className={`flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0 ${a.status === "overdue" ? "bg-[#ef4444]/5 -mx-2 px-2 rounded" : ""}`}>
                <div className="min-w-0">
                  <p className="text-[12px] text-white truncate">{a.description}</p>
                  <p className={`text-[10px] ${a.status === "overdue" ? "text-[#ef4444]" : "text-[#8a8a99]"}`}>
                    {a.status === "overdue" ? "VENCIDA" : "Venc:"} {a.dueDate ? format(parseISO(a.dueDate), "dd/MM") : "---"}
                  </p>
                </div>
                <span className="text-[12px] text-[#ef4444] shrink-0 ml-2">{formatCurrency(a.amount)}</span>
              </div>
            ))}
            {accounts.filter(a => a.type === "payable" && a.status !== "paid").length === 0 && (
              <p className="text-[11px] text-[#8a8a99]">Nenhuma conta a pagar</p>
            )}
          </div>
        </div>

        {/* Semanal + Vencidas */}
        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
          {stats.qtdVencidas > 0 && (
            <div className="p-3 bg-[#ef4444]/8 border border-[#ef4444]/15 rounded-xl mb-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-[#ef4444]" />
                <span className="text-[12px] text-[#ef4444]" style={{ fontWeight: 500 }}>{stats.qtdVencidas} contas vencidas</span>
              </div>
              <p className="text-[11px] text-white/70">Total: {formatCurrency(stats.contasVencidas)}</p>
            </div>
          )}
          <h4 className="text-white text-[13px] mb-3" style={{ fontWeight: 500 }}>Semanal (Mes Atual)</h4>
          <div style={{ height: 160 }} className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barGap={2}>
                <XAxis dataKey="name" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "11px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                <Bar dataKey="receitas" fill="#22c55e" radius={[4, 4, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.6} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Folha de Pagamento */}
      {payrollData.activePartners.length > 0 && (
        <div className="grid grid-cols-12 gap-4">
          {/* Resumo da Equipe */}
          <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#3b82f6]" />
                <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Folha de Pagamento</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">{payrollData.activePartners.length} pessoas</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">Custo Fixo Mensal</p>
                  <p className="text-[16px] text-white" style={{ fontWeight: 600 }}>{formatCurrency(payrollData.totalFolha)}</p>
                </div>
                {payrollData.totalPaidThisMonth > 0 && (
                  <div className="text-right pl-4 border-l border-white/[0.06]">
                    <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">Pago este Mes</p>
                    <p className="text-[16px] text-[#22c55e]" style={{ fontWeight: 600 }}>{formatCurrency(payrollData.totalPaidThisMonth)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Breakdown por tipo */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {(["socio", "clt", "pj", "freelancer"] as const).map(t => {
                const d = payrollData.byType[t];
                if (!d) return (
                  <div key={t} className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.03]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payrollData.TYPE_COLORS[t] }} />
                      <span className="text-[10px] text-[#8a8a99] uppercase">{payrollData.TYPE_LABELS[t]}</span>
                    </div>
                    <p className="text-[14px] text-[#8a8a99]">-</p>
                  </div>
                );
                return (
                  <div key={t} className="rounded-xl p-3" style={{ backgroundColor: payrollData.TYPE_COLORS[t] + "08", border: `1px solid ${payrollData.TYPE_COLORS[t]}15` }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payrollData.TYPE_COLORS[t] }} />
                      <span className="text-[10px] uppercase" style={{ color: payrollData.TYPE_COLORS[t] }}>{payrollData.TYPE_LABELS[t]}</span>
                    </div>
                    <p className="text-[16px] text-white" style={{ fontWeight: 600 }}>{d.count} <span className="text-[11px] font-normal text-[#8a8a99]">pessoa{d.count !== 1 ? "s" : ""}</span></p>
                    <p className="text-[11px] text-[#8a8a99] mt-0.5">{formatCurrency(d.cost)} / mes</p>
                  </div>
                );
              })}
            </div>

            {/* Tabela resumo */}
            <div className="rounded-xl overflow-hidden border border-white/[0.04]">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-[#8a8a99]">Pessoa</th>
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-[#8a8a99]">Vinculo</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-[#8a8a99]">Fixo</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-[#8a8a99]">Producao</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-[#8a8a99]">Custo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.activePartners.slice(0, 8).map(p => {
                    const pType = p.type || "socio";
                    const mc = getPartnerMonthlyCost(p);
                    return (
                      <tr key={p.id} className="border-t border-white/[0.03]">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px]" style={{ backgroundColor: payrollData.TYPE_COLORS[pType] + "1a", color: payrollData.TYPE_COLORS[pType], fontWeight: 600 }}>
                              {p.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-[12px] text-white block">{p.name}</span>
                              <span className="text-[10px] text-[#8a8a99]">{p.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: payrollData.TYPE_COLORS[pType] + "1a", color: payrollData.TYPE_COLORS[pType], fontWeight: 500 }}>
                            {payrollData.TYPE_LABELS[pType]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[12px] text-white">
                          {mc > 0 ? formatCurrency(mc) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {p.payPerProduction ? (
                            <span className="text-[11px] text-[#f59e0b]">{formatCurrency(p.productionRate || 0)}/{p.productionLabel || "un."}</span>
                          ) : (
                            <span className="text-[11px] text-[#8a8a99]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[12px] text-white" style={{ fontWeight: 500 }}>{formatCurrency(mc)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {payrollData.activePartners.length > 8 && (
                <div className="px-4 py-2 text-center border-t border-white/[0.03]">
                  <span className="text-[10px] text-[#8a8a99]">+{payrollData.activePartners.length - 8} pessoas</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: Proximos Pagamentos + Producao */}
          <div className="col-span-4 space-y-4">
            {/* Proximos pagamentos */}
            <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="w-4 h-4 text-[#f59e0b]" />
                <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Proximos Pagamentos</h3>
              </div>
              {payrollData.upcomingPayments.length > 0 ? (
                <div className="space-y-2.5">
                  {payrollData.upcomingPayments.map(p => {
                    const pType = p.type || "socio";
                    const mc = getPartnerMonthlyCost(p);
                    const today = new Date().getDate();
                    const pd = p.paymentDay || 0;
                    const daysUntil = pd >= today ? pd - today : (30 - today) + pd;
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px]" style={{ backgroundColor: payrollData.TYPE_COLORS[pType] + "1a", color: payrollData.TYPE_COLORS[pType], fontWeight: 600 }}>
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[12px] text-white">{p.name}</p>
                            <p className="text-[10px] text-[#8a8a99]">Dia {p.paymentDay} {daysUntil === 0 ? "(hoje)" : daysUntil === 1 ? "(amanha)" : `(${daysUntil}d)`}</p>
                          </div>
                        </div>
                        <span className="text-[12px] text-white" style={{ fontWeight: 500 }}>{formatCurrency(mc)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-[#8a8a99] text-center py-4">Nenhum pagamento nos proximos 7 dias</p>
              )}
            </div>

            {/* Prestadores por producao */}
            {payrollData.productionPartners.length > 0 && (
              <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-[#f59e0b]" />
                  <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Sob Demanda</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b]">{payrollData.productionPartners.length}</span>
                </div>
                <div className="space-y-2">
                  {payrollData.productionPartners.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                      <div>
                        <p className="text-[12px] text-white">{p.name}</p>
                        <p className="text-[10px] text-[#8a8a99]">{p.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-[#f59e0b]" style={{ fontWeight: 500 }}>{formatCurrency(p.productionRate || 0)}</p>
                        <p className="text-[9px] text-[#8a8a99]">por {p.productionLabel || "unidade"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
