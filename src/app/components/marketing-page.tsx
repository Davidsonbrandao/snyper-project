import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Megaphone, DollarSign, Target, TrendingUp, Users, ArrowUpRight, Clock, Check, ExternalLink, Link2, Eye, MousePointerClick, ShoppingCart, Zap } from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, MARKETING_CHANNELS, SERVICE_CATEGORIES, type MarketingAction, type MarketingChannelType } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput } from "./ui/currency-input";
import { DatePickerInput } from "./ui/date-picker-input";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const channelOptions = Object.entries(MARKETING_CHANNELS).map(([value, label]) => ({ value, label }));

const statusOptions = [
  { value: "planned", label: "Planejada" },
  { value: "active", label: "Em andamento" },
  { value: "completed", label: "Concluida" },
  { value: "cancelled", label: "Cancelada" },
];

const paymentStatusOptions = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "partial", label: "Parcial" },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  planned: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
  active: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
  completed: { bg: "rgba(138,138,153,0.12)", text: "#8a8a99" },
  cancelled: { bg: "rgba(239,68,68,0.12)", text: "#ef4444" },
};

const statusLabels: Record<string, string> = {
  planned: "Planejada",
  active: "Em andamento",
  completed: "Concluida",
  cancelled: "Cancelada",
};

const channelIcons: Record<string, string> = {
  meta_ads: "#3b82f6",
  google_ads: "#22c55e",
  outdoor: "#f59e0b",
  influencer: "#a855f7",
  flyers: "#ef4444",
  event: "#ec4899",
  email: "#3b82f6",
  seo: "#22c55e",
  other: "#8a8a99",
};

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const is: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

export function MarketingPage() {
  const {
    marketingActions, addMarketingAction, updateMarketingAction, removeMarketingAction,
    paymentMethods, addPaymentMethod,
    addEntry, addAccount,
    entries,
  } = useFinance();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<"actions" | "integrations">("actions");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyForm = {
    name: "",
    channel: "meta_ads" as MarketingChannelType,
    investment: "",
    expectedReturn: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    status: "planned" as MarketingAction["status"],
    paymentStatus: "pending" as MarketingAction["paymentStatus"],
    paymentMethod: paymentMethods[0] || "PIX",
    installments: "1",
    focalServices: [] as string[],
    notes: "",
    leadsGenerated: "",
    conversions: "",
    revenue: "",
    clicks: "",
    impressions: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [autoCreateEntry, setAutoCreateEntry] = useState(true);

  const paymentMethodOpts = paymentMethods.map(p => ({ value: p, label: p }));

  // Stats
  const stats = useMemo(() => {
    const active = marketingActions.filter(a => a.status === "active" || a.status === "planned");
    const totalInvestment = marketingActions.filter(a => a.status !== "cancelled").map(a => a.investment).reduce((s, n) => s + n, 0);
    const totalRevenue = marketingActions.map(a => a.revenue || 0).reduce((s, n) => s + n, 0);
    const totalLeads = marketingActions.map(a => a.leadsGenerated || 0).reduce((s, n) => s + n, 0);
    const totalConversions = marketingActions.map(a => a.conversions || 0).reduce((s, n) => s + n, 0);
    const roas = totalInvestment > 0 ? totalRevenue / totalInvestment : 0;
    const cpa = totalConversions > 0 ? totalInvestment / totalConversions : 0;
    const cpl = totalLeads > 0 ? totalInvestment / totalLeads : 0;
    const pendingPayment = marketingActions.filter(a => a.paymentStatus === "pending").map(a => a.investment).reduce((s, n) => s + n, 0);
    return { active: active.length, totalInvestment, totalRevenue, totalLeads, totalConversions, roas, cpa, cpl, pendingPayment };
  }, [marketingActions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.investment) {
      toast.error("Preencha o nome e o investimento");
      return;
    }

    const data: Omit<MarketingAction, "id"> = {
      name: form.name,
      channel: form.channel,
      investment: parseFloat(form.investment) || 0,
      expectedReturn: form.expectedReturn ? parseFloat(form.expectedReturn) : undefined,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      status: form.status,
      paymentStatus: form.paymentStatus,
      paymentMethod: form.paymentMethod,
      installments: parseInt(form.installments) || 1,
      focalServices: form.focalServices.length > 0 ? form.focalServices : undefined,
      notes: form.notes || undefined,
      leadsGenerated: form.leadsGenerated ? parseInt(form.leadsGenerated) : undefined,
      conversions: form.conversions ? parseInt(form.conversions) : undefined,
      revenue: form.revenue ? parseFloat(form.revenue) : undefined,
      clicks: form.clicks ? parseInt(form.clicks) : undefined,
      impressions: form.impressions ? parseInt(form.impressions) : undefined,
    };

    if (editingId) {
      updateMarketingAction(editingId, data);
      toast.success("Acao atualizada com sucesso");
    } else {
      addMarketingAction(data);

      if (autoCreateEntry && data.investment > 0) {
        if (data.paymentStatus === "paid") {
          addEntry({
            date: data.startDate,
            type: "expense",
            description: `Marketing: ${data.name}`,
            amount: data.investment,
            category: "Marketing",
            paymentMethod: data.paymentMethod,
            status: "paid",
          });
        } else {
          addAccount({
            type: "payable",
            description: `Marketing: ${data.name}`,
            amount: data.investment,
            dueDate: data.startDate,
            status: "pending",
            category: "Marketing",
          });
        }
      }
      toast.success("Acao criada com sucesso");
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setAutoCreateEntry(true);
  };

  const openEdit = (action: MarketingAction) => {
    setForm({
      name: action.name,
      channel: action.channel,
      investment: String(action.investment),
      expectedReturn: action.expectedReturn ? String(action.expectedReturn) : "",
      startDate: action.startDate,
      endDate: action.endDate || "",
      status: action.status,
      paymentStatus: action.paymentStatus,
      paymentMethod: action.paymentMethod || paymentMethods[0] || "PIX",
      installments: action.installments ? String(action.installments) : "1",
      focalServices: action.focalServices || [],
      notes: action.notes || "",
      leadsGenerated: action.leadsGenerated ? String(action.leadsGenerated) : "",
      conversions: action.conversions ? String(action.conversions) : "",
      revenue: action.revenue ? String(action.revenue) : "",
      clicks: action.clicks ? String(action.clicks) : "",
      impressions: action.impressions ? String(action.impressions) : "",
    });
    setEditingId(action.id);
    setAutoCreateEntry(false);
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setAutoCreateEntry(true);
  };

  const handleDelete = (id: string) => {
    removeMarketingAction(id);
    setDeleteConfirm(null);
    toast.success("Acao excluida");
  };

  const toggleFocalService = (svc: string) => {
    setForm(prev => ({
      ...prev,
      focalServices: prev.focalServices.includes(svc)
        ? prev.focalServices.filter(s => s !== svc)
        : [...prev.focalServices, svc],
    }));
  };

  if (!can("marketing", "view")) return <NoAccessPage />;

  const canEdit = can("marketing", "edit");
  const canAdd = can("marketing", "add");
  const canDelete = can("marketing", "delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Marketing</h1>
            {!canAdd && !canEdit && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie acoes de marketing, investimentos e acompanhe metricas de performance</p>
        </div>
        {activeTab === "actions" && canAdd && (
          <button
            onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition-colors text-[13px]"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Nova Acao
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={cs}>
        {([
          { key: "actions" as const, label: "Acoes de Marketing", icon: Megaphone },
          { key: "integrations" as const, label: "Integracoes", icon: Link2 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all"
            style={{
              fontWeight: activeTab === t.key ? 500 : 400,
              backgroundColor: activeTab === t.key ? "var(--accent)" : "transparent",
              color: activeTab === t.key ? "var(--accent-foreground)" : "var(--text-secondary)",
            }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "actions" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {([
              { label: "Investimento Total", value: formatCurrency(stats.totalInvestment), sub: stats.pendingPayment > 0 ? `${formatCurrency(stats.pendingPayment)} pendente` : undefined, subColor: "#f59e0b", icon: DollarSign, iconColor: "var(--accent)" },
              { label: "ROAS", value: `${stats.roas.toFixed(1)}x`, sub: `Retorno: ${formatCurrency(stats.totalRevenue)}`, icon: TrendingUp, iconColor: "#22c55e" },
              { label: "CPL (Custo por Lead)", value: stats.cpl > 0 ? formatCurrency(stats.cpl) : "---", sub: `${stats.totalLeads} leads gerados`, icon: Users, iconColor: "#3b82f6" },
              { label: "CPA (Custo por Aquisicao)", value: stats.cpa > 0 ? formatCurrency(stats.cpa) : "---", sub: `${stats.totalConversions} conversoes`, icon: Target, iconColor: "#f59e0b" },
            ]).map(card => (
              <div key={card.label} className="rounded-2xl p-5" style={cs}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${card.iconColor === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : card.iconColor + "1a"}` }}>
                    <card.icon className="w-4 h-4" style={{ color: card.iconColor }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{card.label}</span>
                </div>
                <p className="text-[20px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{card.value}</p>
                {card.sub && <p className="text-[11px] mt-1" style={{ color: card.subColor || "var(--text-muted)" }}>{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-5" style={{ ...cs, border: "2px solid var(--accent)" }}>
              <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{editingId ? "Editar Acao" : "Nova Acao de Marketing"}</h3>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome da Acao</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Ex: Campanha Black Friday" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Canal</label>
                  <CustomSelect options={channelOptions} value={form.channel} onChange={val => setForm({ ...form, channel: val as MarketingChannelType })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Investimento (R$)</label>
                  <CurrencyInput value={form.investment} onChange={val => setForm({ ...form, investment: val })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Retorno Esperado (R$)</label>
                  <CurrencyInput value={form.expectedReturn} onChange={val => setForm({ ...form, expectedReturn: val })} placeholder="Opcional" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Data Inicio</label>
                  <DatePickerInput value={form.startDate} onChange={val => setForm({ ...form, startDate: val })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Data Fim (Opcional)</label>
                  <DatePickerInput value={form.endDate} onChange={val => setForm({ ...form, endDate: val })} placeholder="Sem prazo" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
                  <CustomSelect options={statusOptions} value={form.status} onChange={val => setForm({ ...form, status: val as MarketingAction["status"] })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Notas</label>
                  <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Observacoes..." />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Status do Pagamento</label>
                  <CustomSelect options={paymentStatusOptions} value={form.paymentStatus} onChange={val => setForm({ ...form, paymentStatus: val as MarketingAction["paymentStatus"] })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Forma de Pagamento</label>
                  <CustomSelect searchable allowCreate options={paymentMethodOpts} value={form.paymentMethod} onChange={val => setForm({ ...form, paymentMethod: val })} onCreate={val => addPaymentMethod(val)} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Parcelas</label>
                  <input type="text" inputMode="numeric" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value.replace(/\D/g, "") })} className="w-full rounded-xl px-4 py-2.5 text-[13px] text-center focus:outline-none" style={is} />
                </div>
                <div className="flex items-end pb-1">
                  {!editingId && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className="w-9 h-5 rounded-full transition-all relative"
                        style={{ backgroundColor: autoCreateEntry ? "var(--accent)" : "var(--border-default)" }}
                        onClick={() => setAutoCreateEntry(!autoCreateEntry)}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${autoCreateEntry ? "left-[18px]" : "left-0.5"}`} />
                      </div>
                      <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Lancar automaticamente</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Focal Services */}
              <div>
                <label className="text-[12px] block mb-2" style={{ color: "var(--text-secondary)" }}>Servicos Focais (Opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_CATEGORIES.map(svc => (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleFocalService(svc)}
                      className="px-3 py-1.5 rounded-lg text-[12px] transition-all"
                      style={{
                        backgroundColor: form.focalServices.includes(svc) ? "rgba(var(--accent-rgb),0.1)" : "var(--bg-input)",
                        border: form.focalServices.includes(svc) ? "1px solid rgba(var(--accent-rgb),0.3)" : "1px solid var(--border-default)",
                        color: form.focalServices.includes(svc) ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      {svc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tracking metrics (for editing) */}
              {editingId && (
                <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                    <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Metricas de Performance</span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {([
                      { key: "impressions", label: "Impressoes", icon: Eye },
                      { key: "clicks", label: "Cliques", icon: MousePointerClick },
                      { key: "leadsGenerated", label: "Leads", icon: Users },
                      { key: "conversions", label: "Conversoes", icon: ShoppingCart },
                      { key: "revenue", label: "Receita (R$)", icon: DollarSign },
                    ]).map(({ key, label, icon: Icon }) => (
                      <div key={key}>
                        <label className="text-[11px] flex items-center gap-1 mb-1" style={{ color: "var(--text-secondary)" }}><Icon className="w-3 h-3" />{label}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={(form as any)[key]}
                          onChange={e => setForm({ ...form, [key]: e.target.value.replace(/[^0-9.]/g, "") })}
                          className="w-full rounded-xl px-3 py-2 text-[12px] focus:outline-none"
                          style={is}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  {editingId ? "Atualizar" : "Criar Acao"}
                </button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Actions List */}
          {marketingActions.length === 0 && !showForm ? (
            <div className="rounded-2xl p-12 text-center" style={cs}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--bg-input)" }}>
                <Megaphone className="w-8 h-8" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
              </div>
              <p className="text-[15px] mb-1" style={{ color: "var(--text-primary)" }}>Nenhuma acao de marketing cadastrada</p>
              <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>Registre campanhas online, acoes offline e acompanhe o retorno de cada investimento.</p>
              {canAdd && (
                <button onClick={() => setShowForm(true)} className="px-4 py-2 text-[13px] rounded-xl inline-flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  <Plus className="w-4 h-4" /> Criar Primeira Acao
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {marketingActions.map(action => {
                const color = channelIcons[action.channel] || "#8a8a99";
                const sColors = statusColors[action.status];
                const actionRoas = action.investment > 0 && action.revenue ? action.revenue / action.investment : null;

                return (
                  <div key={action.id} className="rounded-2xl overflow-hidden" style={cs}>
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "1a" }}>
                        <Megaphone className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{action.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: sColors.bg, color: sColors.text }}>{statusLabels[action.status]}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ borderColor: color + "30", color, backgroundColor: color + "0d", border: `1px solid ${color}30` }}>
                            {MARKETING_CHANNELS[action.channel]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <span>{action.startDate.split("-").reverse().join("/")}{action.endDate ? ` - ${action.endDate.split("-").reverse().join("/")}` : ""}</span>
                          {action.focalServices && action.focalServices.length > 0 && (
                            <span>{action.focalServices.join(", ")}</span>
                          )}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-5 shrink-0">
                        <div className="text-center">
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Investimento</p>
                          <p className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(action.investment)}</p>
                        </div>
                        {action.revenue !== undefined && action.revenue > 0 && (
                          <div className="text-center">
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Receita</p>
                            <p className="text-[14px] text-[#22c55e]" style={{ fontWeight: 500 }}>{formatCurrency(action.revenue)}</p>
                          </div>
                        )}
                        {actionRoas !== null && (
                          <div className="text-center">
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>ROAS</p>
                            <p className="text-[14px]" style={{ fontWeight: 600, color: actionRoas >= 1 ? "#22c55e" : "#ef4444" }}>{actionRoas.toFixed(1)}x</p>
                          </div>
                        )}
                        <div className="shrink-0">
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                            backgroundColor: action.paymentStatus === "paid" ? "rgba(34,197,94,0.1)" : action.paymentStatus === "partial" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                            color: action.paymentStatus === "paid" ? "#22c55e" : action.paymentStatus === "partial" ? "#f59e0b" : "#ef4444",
                            border: `1px solid ${action.paymentStatus === "paid" ? "rgba(34,197,94,0.2)" : action.paymentStatus === "partial" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
                          }}>
                            {action.paymentStatus === "paid" ? "Pago" : action.paymentStatus === "partial" ? "Parcial" : "Pendente"}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <button onClick={() => openEdit(action)} className="p-2 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => { if (deleteConfirm === action.id) { handleDelete(action.id); } else { setDeleteConfirm(action.id); setTimeout(() => setDeleteConfirm(null), 3000); } }}
                            className="p-2 rounded-lg transition-all flex items-center gap-1"
                            style={{ color: "#ef4444", backgroundColor: deleteConfirm === action.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                            title={deleteConfirm === action.id ? "Confirmar exclusao" : "Excluir"}
                          >
                            <Trash2 className="w-4 h-4" />
                            {deleteConfirm === action.id && <span className="text-[10px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded metrics row */}
                    {(action.leadsGenerated || action.conversions || action.clicks || action.impressions) && (
                      <div className="px-5 py-3 flex items-center gap-6" style={{ borderTop: "1px solid var(--border-extra-subtle)", backgroundColor: "var(--bg-input)" }}>
                        {action.impressions && action.impressions > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Eye className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                            <span style={{ color: "var(--text-muted)" }}>Impressoes:</span>
                            <span style={{ color: "var(--text-primary)" }}>{action.impressions.toLocaleString("pt-BR")}</span>
                          </div>
                        )}
                        {action.clicks && action.clicks > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <MousePointerClick className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                            <span style={{ color: "var(--text-muted)" }}>Cliques:</span>
                            <span style={{ color: "var(--text-primary)" }}>{action.clicks.toLocaleString("pt-BR")}</span>
                            {action.impressions && action.impressions > 0 && (
                              <span className="text-[#3b82f6]">({((action.clicks / action.impressions) * 100).toFixed(2)}% CTR)</span>
                            )}
                          </div>
                        )}
                        {action.leadsGenerated && action.leadsGenerated > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Users className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                            <span style={{ color: "var(--text-muted)" }}>Leads:</span>
                            <span style={{ color: "var(--text-primary)" }}>{action.leadsGenerated}</span>
                            <span className="text-[#3b82f6]">(CPL: {formatCurrency(action.investment / action.leadsGenerated)})</span>
                          </div>
                        )}
                        {action.conversions && action.conversions > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <ShoppingCart className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                            <span style={{ color: "var(--text-muted)" }}>Conversoes:</span>
                            <span style={{ color: "var(--text-primary)" }}>{action.conversions}</span>
                            <span className="text-[#22c55e]">(CPA: {formatCurrency(action.investment / action.conversions)})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Meta Ads */}
            <div className="rounded-2xl p-6" style={cs}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[#3b82f6]" />
                </div>
                <div>
                  <h3 className="text-[16px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Meta Ads</h3>
                  <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Facebook e Instagram Ads</p>
                </div>
                <span className="ml-auto text-[11px] px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>Em breve</span>
              </div>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                Conecte sua conta Meta Business para importar automaticamente dados de campanhas, investimentos, leads,
                conversoes, CPL e CPA diretamente no sistema.
              </p>
              <div className="space-y-2 mb-6">
                {["Importacao automatica de gastos", "CPL e CPA em tempo real", "ROAS por campanha", "Integracao com o motor financeiro P.R.O."].map(feat => (
                  <div key={feat} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    <Check className="w-3.5 h-3.5 text-[#3b82f6]" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
              <button disabled className="w-full px-4 py-3 rounded-xl text-[13px] opacity-50 cursor-not-allowed flex items-center justify-center gap-2" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)", fontWeight: 500 }}>
                <Link2 className="w-4 h-4" /> Conectar Meta Ads
              </button>
            </div>

            {/* Google Ads */}
            <div className="rounded-2xl p-6" style={cs}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[#22c55e]" />
                </div>
                <div>
                  <h3 className="text-[16px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Google Ads</h3>
                  <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Search, Display e YouTube</p>
                </div>
                <span className="ml-auto text-[11px] px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>Em breve</span>
              </div>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                Conecte sua conta Google Ads para trazer dados de cliques, impressoes, conversoes e custos
                diretamente para suas analises financeiras.
              </p>
              <div className="space-y-2 mb-6">
                {["Custo por clique em tempo real", "Conversoes por campanha", "Integracao com fluxo de caixa", "Relatorios de performance unificados"].map(feat => (
                  <div key={feat} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
              <button disabled className="w-full px-4 py-3 rounded-xl text-[13px] opacity-50 cursor-not-allowed flex items-center justify-center gap-2" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", fontWeight: 500 }}>
                <Link2 className="w-4 h-4" /> Conectar Google Ads
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.05), transparent)", border: "1px solid rgba(var(--accent-rgb),0.15)" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                <Megaphone className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 className="text-[14px] mb-1" style={{ fontWeight: 500, color: "var(--accent)" }}>Marketing Inteligente</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Enquanto as integracoes nao estao disponiveis, voce pode <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>cadastrar acoes manualmente</span> na
                  aba "Acoes de Marketing". O sistema registra automaticamente os investimentos em Lancamentos ou Contas a Pagar,
                  e calcula ROAS, CPL e CPA com base nos dados informados. Isso ja traz uma precisao muito maior para o motor
                  financeiro calcular suas despesas reais de marketing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
