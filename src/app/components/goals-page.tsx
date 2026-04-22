import { useState, useMemo, useEffect } from "react";
import { Target, TrendingUp, Calendar, Users, Zap, ArrowRight, Lightbulb, Check, Shield, Crosshair, Rocket, Flame, Megaphone, MousePointerClick, DollarSign } from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, calculateSmartBreakEven, suggestSmartGoals, getPartnerMonthlyCost } from "../lib/finance-data";
import { CurrencyInput } from "./ui/currency-input";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage } from "./permission-gate";
import { toast } from "sonner";

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const is: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

export function GoalsPage() {
  const { goals, updateGoals, expenses, entries, services, variableParams, partners, marketingActions } = useFinance();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goals);

  // Funnel config - persist from goals
  const [funnelRates, setFunnelRates] = useState({
    leadToConversation: (goals as any).funnelLeadToConversation || 50,
    conversationToSchedule: (goals as any).funnelConversationToSchedule || 50,
    scheduleToConsultation: (goals as any).funnelScheduleToConsultation || 80,
    consultationToSale: (goals as any).funnelConsultationToSale || 50,
  });

  // Sync form when goals change externally
  useEffect(() => { setForm(goals); }, [goals]);

  const baseCalculations = useMemo(() => {
    const fixedExpensesTotal = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
    const partnerWithdrawalsTotal = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
    const variablePercentTotal = variableParams.filter(v => v.active && v.unit === "%" && v.type !== "profit_margin" && v.type !== "card_fee").reduce((s, v) => s + v.value, 0);
    return { fixedExpensesTotal, partnerWithdrawalsTotal, variablePercentTotal };
  }, [expenses, partners, variableParams]);

  const breakEvenResult = useMemo(() => {
    return calculateSmartBreakEven(
      baseCalculations.fixedExpensesTotal,
      baseCalculations.partnerWithdrawalsTotal,
      baseCalculations.variablePercentTotal
    );
  }, [baseCalculations]);

  const suggestions = useMemo(() => {
    return suggestSmartGoals(breakEvenResult);
  }, [breakEvenResult]);

  const stats = useMemo(() => {
    const totalReceitas = entries.filter((e) => e.type === "income" && e.status === "paid").reduce((s, e) => s + e.amount, 0);
    const ticketMedio = services.length > 0 ? services.map(svc => svc.priceDisplay).reduce((s, n) => s + n, 0) / services.length : 5000;
    const metaDiaria = goals.realistic / goals.workDaysPerMonth;
    const metaSemanal = goals.realistic / 4;
    const vendasDia = Math.ceil(metaDiaria / ticketMedio);
    const vendasValidadas = vendasDia || 1;
    const consultasRealizadas = Math.ceil(vendasValidadas / (funnelRates.consultationToSale / 100));
    const agendamentos = Math.ceil(consultasRealizadas / (funnelRates.scheduleToConsultation / 100));
    const conversas = Math.ceil(agendamentos / (funnelRates.conversationToSchedule / 100));
    const leads = Math.ceil(conversas / (funnelRates.leadToConversation / 100));
    return { totalReceitas, breakEven: breakEvenResult.breakEvenRevenue, ticketMedio, metaDiaria, metaSemanal, vendasDia, vendasValidadas, consultasRealizadas, agendamentos, conversas, leads };
  }, [goals, entries, services, funnelRates, breakEvenResult]);

  const marketingStats = useMemo(() => {
    const totalInvestment = marketingActions.filter(a => a.status !== "cancelled").map(a => a.investment).reduce((s, n) => s + n, 0);
    const totalRevenue = marketingActions.map(a => a.revenue || 0).reduce((s, n) => s + n, 0);
    const totalLeads = marketingActions.map(a => a.leadsGenerated || 0).reduce((s, n) => s + n, 0);
    const totalConversions = marketingActions.map(a => a.conversions || 0).reduce((s, n) => s + n, 0);
    const roas = totalInvestment > 0 ? totalRevenue / totalInvestment : 0;
    const cpa = totalConversions > 0 ? totalInvestment / totalConversions : 0;
    const cpl = totalLeads > 0 ? totalInvestment / totalLeads : 0;
    return { totalInvestment, totalRevenue, totalLeads, totalConversions, roas, cpa, cpl };
  }, [marketingActions]);

  const handleSave = () => {
    // Persist funnel rates with goals
    const goalsWithFunnel = {
      ...form,
      funnelLeadToConversation: funnelRates.leadToConversation,
      funnelConversationToSchedule: funnelRates.conversationToSchedule,
      funnelScheduleToConsultation: funnelRates.scheduleToConsultation,
      funnelConsultationToSale: funnelRates.consultationToSale,
    };
    updateGoals(goalsWithFunnel);
    setEditing(false);
    toast.success("Metas salvas com sucesso");
  };

  const applySuggestions = () => {
    setForm({
      ...form,
      pessimistic: suggestions.pessimistic,
      realistic: suggestions.realistic,
      optimistic: suggestions.optimistic,
      aggressive: suggestions.aggressive,
    });
    toast.success("Sugestoes aplicadas! Clique em Salvar para confirmar.");
  };

  if (!can("metas", "view")) return <NoAccessPage />;

  const canEdit = can("metas", "edit");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Metas P.R.O.</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Defina e acompanhe suas metas de faturamento</p>
        </div>
        {canEdit && (
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition-colors text-[13px]"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
          >
            {editing ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
            {editing ? "Salvar Metas" : "Editar Metas"}
          </button>
        )}
      </div>

      {/* Break-even Reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.05), transparent)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Ponto de Equilibrio (Minimo Mensal)</p>
              <p className="text-[20px] text-[#f59e0b]" style={{ fontWeight: 600 }}>{formatCurrency(stats.breakEven)}</p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Suas metas devem estar acima deste valor para gerar lucro real</p>
            </div>
          </div>
        </div>

        {editing && (
          <div className="rounded-2xl p-5 flex items-center justify-between" style={{ backgroundColor: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-5 h-5 text-[#3b82f6]" />
              </div>
              <div>
                <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Sugestao Inteligente</p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Metas baseadas na sua margem e custos</p>
              </div>
            </div>
            <button
              onClick={applySuggestions}
              className="px-4 py-2 bg-[#3b82f6] text-white text-[12px] rounded-lg hover:bg-[#3b82f6]/90 transition-colors flex items-center gap-2"
              style={{ fontWeight: 500 }}
            >
              <Check className="w-3.5 h-3.5" />
              Aplicar Sugestoes
            </button>
          </div>
        )}
      </div>

      {/* P.R.O. Goals */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { key: "pessimistic" as const, label: "Pessimista", subtitle: "Meta sobrevivencia", color: "#f59e0b", Icon: Shield },
          { key: "realistic" as const, label: "Realista", subtitle: "Meta principal", color: "var(--accent)", Icon: Crosshair },
          { key: "optimistic" as const, label: "Otimista", subtitle: "Margem ideal + 10%", color: "#22c55e", Icon: Rocket },
          { key: "aggressive" as const, label: "Agressiva", subtitle: "Cenario de escala", color: "#a855f7", Icon: Flame },
        ]).map((meta) => {
          const goalValue = form[meta.key] || 0;
          const progress = goalValue > 0 ? Math.min((stats.totalReceitas / goalValue) * 100, 100) : 0;
          const isAccent = meta.key === "realistic";

          return (
            <div key={meta.key} className="rounded-2xl p-5" style={cs}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: isAccent ? "rgba(var(--accent-rgb),0.1)" : `${meta.color}1a` }}>
                    <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                  <h3 className="text-[14px] mt-1" style={{ color: "var(--text-primary)" }}>{meta.label}</h3>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{meta.subtitle}</p>
                </div>
              </div>

              {editing ? (
                <div className="mb-4">
                  <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Valor mensal (R$)</label>
                  <CurrencyInput
                    value={String(goalValue)}
                    onChange={(val) => setForm({ ...form, [meta.key]: parseFloat(val) || 0 })}
                  />
                  <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                    <Lightbulb className="w-3 h-3 text-[#3b82f6]" />
                    Sugestao: {formatCurrency(suggestions[meta.key])}
                  </p>
                </div>
              ) : (
                <p className="text-[24px] mb-4" style={{ fontWeight: 600, color: meta.color }}>
                  {formatCurrency(goalValue)}
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "var(--text-secondary)" }}>Progresso</span>
                  <span style={{ fontWeight: 500, color: meta.color }}>{progress.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: isAccent ? "var(--accent)" : meta.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Work Days Config */}
      {editing && (
        <div className="rounded-2xl p-5" style={cs}>
          <h3 className="text-[14px] mb-3" style={{ color: "var(--text-primary)", fontWeight: 500 }}>Configuracao</h3>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Dias uteis / mes</label>
              <input
                type="number"
                value={form.workDaysPerMonth}
                onChange={(e) => setForm({ ...form, workDaysPerMonth: parseInt(e.target.value) || 22 })}
                className="w-24 rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                style={is}
              />
            </div>
          </div>
        </div>
      )}

      {/* Goal Breakdown */}
      <div className="rounded-2xl p-6" style={cs}>
        <h3 className="text-[15px] mb-1" style={{ color: "var(--text-primary)", fontWeight: 500 }}>Desdobramento da Meta Realista</h3>
        <p className="text-[12px] mb-6" style={{ color: "var(--text-secondary)" }}>Como atingir {formatCurrency(goals.realistic)} / mes</p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Meta Mensal", value: formatCurrency(goals.realistic), accent: true },
            { label: "Meta Semanal", value: formatCurrency(stats.metaSemanal) },
            { label: "Meta Diaria", value: formatCurrency(stats.metaDiaria) },
            { label: "Vendas / Dia", value: String(stats.vendasDia), accent: true, sub: `Ticket: ${formatCurrency(stats.ticketMedio)}` },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-input)" }}>
              <p className="text-[11px] mb-1" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
              <p className="text-[18px]" style={{ fontWeight: 600, color: item.accent ? "var(--accent)" : "var(--text-primary)" }}>{item.value}</p>
              {item.sub && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.sub}</p>}
            </div>
          ))}
        </div>

        {/* Funnel Reverse Engineering */}
        <h4 className="text-[14px] mb-4" style={{ color: "var(--text-primary)", fontWeight: 500 }}>Engenharia Reversa do Funil</h4>
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {([
            { label: "Lead > Conversa", key: "leadToConversation" as const },
            { label: "Conversa > Agendamento", key: "conversationToSchedule" as const },
            { label: "Agendamento > Consulta", key: "scheduleToConsultation" as const },
            { label: "Consulta > Venda", key: "consultationToSale" as const },
          ]).map((rate) => (
            <div key={rate.key} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{rate.label}</span>
              <input
                type="number"
                min="1"
                max="100"
                value={funnelRates[rate.key]}
                onChange={(e) => setFunnelRates({ ...funnelRates, [rate.key]: parseInt(e.target.value) || 1 })}
                className="w-14 rounded-lg px-2 py-1 text-[12px] text-center focus:outline-none"
                style={is}
              />
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>%</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          {([
            { label: "Leads/dia", value: stats.leads, color: "#3b82f6" },
            { label: "Conversas", value: stats.conversas, color: "#a855f7" },
            { label: "Agendamentos", value: stats.agendamentos, color: "#f59e0b" },
            { label: "Consultas", value: stats.consultasRealizadas, color: "#22c55e" },
            { label: "Vendas", value: stats.vendasValidadas, color: "var(--accent)" },
          ]).map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1 rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-input)" }}>
                <p className="text-[10px] mb-1" style={{ color: "var(--text-secondary)" }}>{step.label}</p>
                <p className="text-[24px]" style={{ fontWeight: 600, color: step.color }}>{step.value}</p>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Marketing Goals */}
      <div className="rounded-2xl p-6" style={cs}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Metas de Marketing</h3>
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Defina metas de ROAS, CPA e CPL para suas campanhas</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* ROAS */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#22c55e]" />
              <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Meta de ROAS</span>
            </div>
            {editing ? (
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={form.targetROAS || ""}
                    onChange={e => setForm({ ...form, targetROAS: parseFloat(e.target.value) || undefined })}
                    className="w-24 rounded-xl px-3 py-2.5 text-[15px] focus:outline-none"
                    style={{ ...is, fontWeight: 600 }}
                    placeholder="5.0"
                  />
                  <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>x</span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>Return on Ad Spend desejado</p>
              </div>
            ) : (
              <p className="text-[24px] text-[#22c55e]" style={{ fontWeight: 600 }}>{form.targetROAS ? `${form.targetROAS}x` : "---"}</p>
            )}
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Atual: <span style={{ fontWeight: 500, color: marketingStats.roas >= (form.targetROAS || 0) ? "#22c55e" : marketingStats.roas > 0 ? "#ef4444" : "var(--text-muted)" }}>{marketingStats.roas > 0 ? `${marketingStats.roas.toFixed(1)}x` : "---"}</span></p>
            </div>
          </div>

          {/* CPA */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="flex items-center gap-2 mb-3">
              <MousePointerClick className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Meta de CPA</span>
            </div>
            {editing ? (
              <div>
                <CurrencyInput value={String(form.targetCPA || "")} onChange={v => setForm({ ...form, targetCPA: parseFloat(v) || undefined })} placeholder="150,00" />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>Custo por Aquisicao maximo</p>
              </div>
            ) : (
              <p className="text-[24px] text-[#f59e0b]" style={{ fontWeight: 600 }}>{form.targetCPA ? formatCurrency(form.targetCPA) : "---"}</p>
            )}
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Atual: <span style={{ fontWeight: 500, color: form.targetCPA && marketingStats.cpa > 0 && marketingStats.cpa <= form.targetCPA ? "#22c55e" : marketingStats.cpa > 0 ? "#ef4444" : "var(--text-muted)" }}>{marketingStats.cpa > 0 ? formatCurrency(marketingStats.cpa) : "---"}</span></p>
            </div>
          </div>

          {/* CPL */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Meta de CPL</span>
            </div>
            {editing ? (
              <div>
                <CurrencyInput value={String(form.targetCPL || "")} onChange={v => setForm({ ...form, targetCPL: parseFloat(v) || undefined })} placeholder="25,00" />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>Custo por Lead maximo</p>
              </div>
            ) : (
              <p className="text-[24px] text-[#3b82f6]" style={{ fontWeight: 600 }}>{form.targetCPL ? formatCurrency(form.targetCPL) : "---"}</p>
            )}
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Atual: <span style={{ fontWeight: 500, color: form.targetCPL && marketingStats.cpl > 0 && marketingStats.cpl <= form.targetCPL ? "#22c55e" : marketingStats.cpl > 0 ? "#ef4444" : "var(--text-muted)" }}>{marketingStats.cpl > 0 ? formatCurrency(marketingStats.cpl) : "---"}</span></p>
            </div>
          </div>
        </div>

        {/* Marketing summary */}
        <div className="flex items-center gap-6 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <span>Investido: <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(marketingStats.totalInvestment)}</span></span>
          <span>Receita atribuida: <span className="text-[#22c55e]" style={{ fontWeight: 500 }}>{formatCurrency(marketingStats.totalRevenue)}</span></span>
          <span>Leads: <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{marketingStats.totalLeads}</span></span>
          <span>Conversoes: <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{marketingStats.totalConversions}</span></span>
        </div>
      </div>

      {/* Insight */}
      <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.05), transparent)", border: "1px solid rgba(var(--accent-rgb),0.15)" }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
            <Target className="w-5 h-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h3 className="text-[14px] mb-1" style={{ fontWeight: 500, color: "var(--accent)" }}>Insight de Metas</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Para atingir sua Meta Realista de <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(goals.realistic)}</span>,
              voce precisa fechar em media <span style={{ fontWeight: 500, color: "var(--accent)" }}>{stats.vendasDia} {stats.vendasDia === 1 ? "venda" : "vendas"}/dia</span> com
              ticket medio de <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(stats.ticketMedio)}</span>.
              Isso exige gerar <span className="text-[#3b82f6]" style={{ fontWeight: 500 }}>{stats.leads} leads/dia</span>.
              {marketingStats.totalInvestment > 0 && (
                <> Seu ROAS atual e de <span style={{ fontWeight: 500, color: marketingStats.roas >= (goals as any).targetROAS ? "#22c55e" : "#f59e0b" }}>{marketingStats.roas.toFixed(1)}x</span>.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
