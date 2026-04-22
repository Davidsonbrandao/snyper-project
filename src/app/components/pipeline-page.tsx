import React, { useState, useMemo, useCallback } from "react";
import {
  Plus, Trash2, Pencil, X, GripVertical, Settings2, RotateCcw,
  DollarSign, User, Briefcase, Phone, Search,
  TrendingUp, Target, Columns3, Trophy, XCircle,
  Check, FolderKanban, Receipt, Clock,
  CreditCard, ArrowUpRight, Zap, Sparkles,
  Building2, Mail, UserPlus,
} from "lucide-react";
import { useFinance } from "../lib/finance-context";
import {
  type PipelineColumn, type PipelineDeal, type DealPriority, type Client,
  formatCurrency, generateId, calculateSaleIntelligence,
  DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS, LOSS_REASONS,
  DEFAULT_PIPELINE_COLUMNS,
} from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { MultiSelect } from "./ui/multi-select";
import { CurrencyInput } from "./ui/currency-input";
import { DatePickerInput } from "./ui/date-picker-input";
import { ClientSearchSelect } from "./ui/client-search-select";
import { motion, AnimatePresence } from "motion/react";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const COLUMN_COLORS = [
  "#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

const priorityOptions = Object.entries(DEAL_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
const lossReasonOptions = LOSS_REASONS.map(r => ({ value: r, label: r }));

const cs: React.CSSProperties = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
const lblStyle: React.CSSProperties = { color: "var(--text-secondary)" };

interface DealFormState {
  title: string; clientId: string; serviceId: string; serviceIds: string[]; estimatedValue: string;
  probability: string; priority: DealPriority; contactName: string; notes: string;
}

const emptyDealForm: DealFormState = {
  title: "", clientId: "", serviceId: "", serviceIds: [], estimatedValue: "",
  probability: "50", priority: "medium", contactName: "", notes: "",
};

interface WinWizardState {
  realValue: string; paymentMethod: string; installments: string;
  paymentDate: string; paymentStatus: "paid" | "pending";
  saleType: "direct" | "commissioned"; commissionMemberId: string; commissionRate: string;
  createEntry: boolean; createProject: boolean;
  projectStartDate: string; projectDueDate: string; projectPriority: DealPriority;
}

// ===== Quick Client Form =====
interface QuickClientForm {
  type: "pf" | "pj";
  fullName: string;
  cpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  phone: string;
  contactName: string;
}
const emptyQuickClient: QuickClientForm = {
  type: "pf", fullName: "", cpf: "", razaoSocial: "", nomeFantasia: "",
  cnpj: "", email: "", phone: "", contactName: "",
};

export function PipelinePage() {
  const {
    pipelineColumns, pipelineDeals, clients, services, paymentMethods,
    commissionMembers, variableParams,
    setPipelineColumns, addPipelineColumn, updatePipelineColumn, removePipelineColumn,
    addPipelineDeal, updatePipelineDeal, removePipelineDeal, moveDeal,
    addEntry, addProject, addClient,
  } = useFinance();
  const { can } = usePermissions();

  // Quick-add client inline state
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClient, setQuickClient] = useState<QuickClientForm>(emptyQuickClient);
  const [quickClientSaving, setQuickClientSaving] = useState(false);

  const handleQuickClientSave = useCallback(() => {
    if (quickClient.type === "pf" && !quickClient.fullName.trim()) {
      toast.error("Informe o nome completo");
      return;
    }
    if (quickClient.type === "pj" && !quickClient.razaoSocial.trim() && !quickClient.nomeFantasia.trim()) {
      toast.error("Informe a Razao Social ou Nome Fantasia");
      return;
    }
    if (!quickClient.email.trim() && !quickClient.phone.trim()) {
      toast.error("Informe ao menos e-mail ou telefone");
      return;
    }
    setQuickClientSaving(true);

    const newClient = addClient({
      type: quickClient.type,
      email: quickClient.email.trim(),
      phone: quickClient.phone.trim(),
      createdAt: new Date().toISOString(),
      ...(quickClient.type === "pf"
        ? { fullName: quickClient.fullName.trim(), cpf: quickClient.cpf.trim() }
        : {
            razaoSocial: quickClient.razaoSocial.trim(),
            nomeFantasia: quickClient.nomeFantasia.trim(),
            cnpj: quickClient.cnpj.trim(),
            contactName: quickClient.contactName.trim(),
          }
      ),
    });

    // Immediately set the client in the deal form using the returned ID
    setDealForm(f => ({ ...f, clientId: newClient.id }));
    setQuickClient(emptyQuickClient);
    setShowQuickClient(false);
    setQuickClientSaving(false);
    toast.success("Cliente cadastrado e vinculado");
  }, [quickClient, addClient]);

  const sortedColumns = useMemo(() => [...pipelineColumns].sort((a, b) => a.order - b.order), [pipelineColumns]);

  const [showDealForm, setShowDealForm] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [dealFormColumnId, setDealFormColumnId] = useState<string>("");
  const [dealForm, setDealForm] = useState<DealFormState>(emptyDealForm);

  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [editingColumns, setEditingColumns] = useState<PipelineColumn[]>([]);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COLUMN_COLORS[0]);

  const [showWinModal, setShowWinModal] = useState(false);
  const [winDealId, setWinDealId] = useState<string | null>(null);
  const [winWizard, setWinWizard] = useState<WinWizardState>({
    realValue: "", paymentMethod: "PIX", installments: "1",
    paymentDate: "", paymentStatus: "pending",
    saleType: "direct", commissionMemberId: "", commissionRate: "",
    createEntry: true, createProject: true,
    projectStartDate: "", projectDueDate: "", projectPriority: "medium",
  });

  const [showLossModal, setShowLossModal] = useState(false);
  const [lossDealId, setLossDealId] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");

  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [expandedDealId, setExpandedDealId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const serviceOptions = useMemo(() => services.map(s => ({ value: s.id, label: s.name })), [services]);
  const paymentMethodOptions = paymentMethods.map(p => ({ value: p, label: p }));
  const activeCommissionMembers = useMemo(() => commissionMembers.filter(m => m.active).map(m => ({ value: m.id, label: `${m.name} (${m.type})` })), [commissionMembers]);

  // Stats
  const activeDeals = pipelineDeals.filter(d => { const col = pipelineColumns.find(c => c.id === d.columnId); return col && !col.isWinColumn && !col.isLossColumn; });
  const totalPipelineValue = activeDeals.reduce((s, d) => s + d.estimatedValue, 0);
  const weightedValue = activeDeals.reduce((s, d) => s + (d.estimatedValue * d.probability / 100), 0);
  const wonDeals = pipelineDeals.filter(d => { const col = pipelineColumns.find(c => c.id === d.columnId); return col?.isWinColumn; });
  const lostDeals = pipelineDeals.filter(d => { const col = pipelineColumns.find(c => c.id === d.columnId); return col?.isLossColumn; });
  const totalWonValue = wonDeals.reduce((s, d) => s + (d.realValue || d.estimatedValue), 0);
  const winRate = (wonDeals.length + lostDeals.length) > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;

  const getClientName = (clientId?: string) => { if (!clientId) return null; const c = clients.find(cl => cl.id === clientId); if (!c) return null; return c.type === "pf" ? c.fullName : (c.nomeFantasia || c.razaoSocial); };
  const getServiceName = (serviceId?: string) => serviceId ? services.find(s => s.id === serviceId)?.name || null : null;
  const getClientPhone = (clientId?: string) => clientId ? clients.find(c => c.id === clientId)?.phone || null : null;

  const filteredDeals = useMemo(() => {
    let deals = pipelineDeals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      deals = deals.filter(d => {
        const clientName = getClientName(d.clientId)?.toLowerCase() || "";
        const svcIds = d.serviceIds || (d.serviceId ? [d.serviceId] : []);
        const svcNames = svcIds.map(id => getServiceName(id)?.toLowerCase() || "").join(" ");
        return d.title.toLowerCase().includes(q) || clientName.includes(q) || svcNames.includes(q) || (d.contactName || "").toLowerCase().includes(q);
      });
    }
    if (filterPriority !== "all") deals = deals.filter(d => d.priority === filterPriority);
    return deals;
  }, [pipelineDeals, searchQuery, filterPriority]);

  const getDealAge = (deal: PipelineDeal) => {
    const created = new Date(deal.updatedAt || deal.createdAt);
    return Math.floor((new Date().getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const openNewDeal = (columnId: string) => { setDealForm(emptyDealForm); setDealFormColumnId(columnId); setEditingDealId(null); setShowDealForm(true); };

  const openEditDeal = (deal: PipelineDeal) => {
    setDealForm({ title: deal.title, clientId: deal.clientId || "", serviceId: deal.serviceId || "", serviceIds: deal.serviceIds || (deal.serviceId ? [deal.serviceId] : []), estimatedValue: deal.estimatedValue ? String(deal.estimatedValue) : "", probability: String(deal.probability), priority: deal.priority, contactName: deal.contactName || "", notes: deal.notes || "" });
    setDealFormColumnId(deal.columnId); setEditingDealId(deal.id); setShowDealForm(true);
  };

  const saveDeal = () => {
    if (!dealForm.title.trim()) { toast.error("Informe o titulo da oportunidade"); return; }
    const now = new Date().toISOString();
    const data: Omit<PipelineDeal, "id"> = {
      title: dealForm.title, clientId: dealForm.clientId || undefined,
      serviceId: dealForm.serviceIds[0] || dealForm.serviceId || undefined,
      serviceIds: dealForm.serviceIds.length > 0 ? dealForm.serviceIds : undefined,
      columnId: dealFormColumnId, estimatedValue: parseFloat(dealForm.estimatedValue) || 0,
      probability: parseInt(dealForm.probability) || 50, priority: dealForm.priority,
      contactName: dealForm.contactName || undefined, notes: dealForm.notes || undefined,
      createdAt: editingDealId ? (pipelineDeals.find(d => d.id === editingDealId)?.createdAt || now) : now, updatedAt: now,
    };
    if (editingDealId) { updatePipelineDeal(editingDealId, data); toast.success("Oportunidade atualizada"); }
    else { addPipelineDeal(data); toast.success("Oportunidade criada"); }
    setShowDealForm(false); setEditingDealId(null);
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, dealId: string) => { setDragDealId(dealId); e.dataTransfer.effectAllowed = "move"; if (e.currentTarget instanceof HTMLElement) e.dataTransfer.setDragImage(e.currentTarget, 100, 30); };
  const handleDragOver = (e: React.DragEvent, columnId: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColumnId(columnId); };
  const handleDragLeave = () => setDragOverColumnId(null);
  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault(); setDragOverColumnId(null);
    if (!dragDealId) return;
    const deal = pipelineDeals.find(d => d.id === dragDealId);
    if (!deal || deal.columnId === columnId) { setDragDealId(null); return; }
    const targetCol = pipelineColumns.find(c => c.id === columnId);
    if (targetCol?.isWinColumn) { openWinWizard(dragDealId); setDragDealId(null); return; }
    if (targetCol?.isLossColumn) { setLossDealId(dragDealId); setLossReason(""); setShowLossModal(true); setDragDealId(null); return; }
    moveDeal(dragDealId, columnId); toast.success(`Oportunidade movida para ${targetCol?.title}`); setDragDealId(null);
  };
  const handleDragEnd = () => { setDragDealId(null); setDragOverColumnId(null); };

  // Win Wizard
  const openWinWizard = (dealId: string) => {
    const deal = pipelineDeals.find(d => d.id === dealId);
    if (!deal) return;
    const today = new Date().toISOString().split("T")[0];
    setWinDealId(dealId);
    setWinWizard({ realValue: String(deal.estimatedValue), paymentMethod: paymentMethods[0] || "PIX", installments: "1", paymentDate: today, paymentStatus: "pending", saleType: "direct", commissionMemberId: "", commissionRate: "", createEntry: true, createProject: true, projectStartDate: today, projectDueDate: "", projectPriority: deal.priority });
    setShowWinModal(true);
  };

  const winPreview = useMemo(() => {
    if (!winDealId) return null;
    const deal = pipelineDeals.find(d => d.id === winDealId);
    if (!deal) return null;
    const realValue = parseFloat(winWizard.realValue) || deal.estimatedValue;
    const installments = parseInt(winWizard.installments) || 1;
    const intelligence = calculateSaleIntelligence(realValue, winWizard.paymentMethod, installments, 0, variableParams);
    let commissionAmount = 0;
    if (winWizard.saleType === "commissioned" && winWizard.commissionMemberId) {
      const member = commissionMembers.find(m => m.id === winWizard.commissionMemberId);
      if (member) { const rate = parseFloat(winWizard.commissionRate) || member.defaultRate; const base = member.defaultIncidence === "net_revenue" ? intelligence.netAmount : realValue; commissionAmount = base * (rate / 100); }
    }
    return { ...intelligence, commissionAmount, finalNet: intelligence.netAmount - commissionAmount, clientName: getClientName(deal.clientId), serviceName: getServiceName(deal.serviceId), dealTitle: deal.title };
  }, [winDealId, winWizard, pipelineDeals, variableParams, commissionMembers]);

  const confirmWin = () => {
    if (!winDealId || !winPreview) return;
    const deal = pipelineDeals.find(d => d.id === winDealId);
    if (!deal) return;
    const winColumn = pipelineColumns.find(c => c.isWinColumn);
    if (!winColumn) return;
    const realValue = parseFloat(winWizard.realValue) || deal.estimatedValue;
    const now = new Date().toISOString();
    const installments = parseInt(winWizard.installments) || 1;

    updatePipelineDeal(winDealId, { ...deal, columnId: winColumn.id, realValue, paymentMethod: winWizard.paymentMethod, installments, paymentDate: winWizard.paymentDate, closedAt: now, updatedAt: now });

    if (winWizard.createEntry) {
      const client = clients.find(c => c.id === deal.clientId);
      const service = services.find(s => s.id === deal.serviceId);
      const clientName = client ? (client.type === "pf" ? client.fullName : (client.nomeFantasia || client.razaoSocial)) : deal.contactName;
      addEntry({ date: winWizard.paymentDate || now.split("T")[0], type: "income", description: deal.title, amount: realValue, category: service?.category || "Desenvolvimento Web", client: clientName || "", paymentMethod: winWizard.paymentMethod, installments, status: winWizard.paymentStatus, serviceId: deal.serviceId || undefined, saleType: winWizard.saleType, commissionMemberId: winWizard.saleType === "commissioned" ? winWizard.commissionMemberId || undefined : undefined, commissionAmount: winWizard.saleType === "commissioned" ? winPreview.commissionAmount : undefined, provisionedTaxes: winPreview.taxes, provisionedFees: winPreview.fees, provisionedCommissions: winPreview.commissionAmount, provisionedMarketing: winPreview.marketing, netAmount: winPreview.finalNet });
    }

    if (winWizard.createProject) {
      const dealSvcIds = deal.serviceIds || (deal.serviceId ? [deal.serviceId] : undefined);
      addProject({ name: deal.title, description: `Projeto originado do negocio "${deal.title}"`, clientId: deal.clientId || undefined, serviceId: dealSvcIds?.[0] || deal.serviceId || undefined, serviceIds: dealSvcIds, dealId: deal.id, status: "todo", priority: winWizard.projectPriority, startDate: winWizard.projectStartDate || now.split("T")[0], dueDate: winWizard.projectDueDate || undefined, estimatedValue: realValue, tasks: [], notes: deal.notes || undefined, createdAt: now, updatedAt: now, assignedTo: undefined });
    }

    toast.success("Negocio fechado com sucesso!");
    setShowWinModal(false); setWinDealId(null);
  };

  const confirmLoss = () => {
    if (!lossDealId) return;
    const deal = pipelineDeals.find(d => d.id === lossDealId);
    if (!deal) return;
    const lossColumn = pipelineColumns.find(c => c.isLossColumn);
    if (!lossColumn) return;
    updatePipelineDeal(lossDealId, { ...deal, columnId: lossColumn.id, lossReason, closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    toast.success("Perda registrada");
    setShowLossModal(false); setLossDealId(null);
  };

  const openColumnSettings = () => { setEditingColumns([...sortedColumns]); setNewColTitle(""); setNewColColor(COLUMN_COLORS[0]); setShowColumnSettings(true); };
  const addNewColumn = () => {
    if (!newColTitle.trim()) return;
    const maxOrder = editingColumns.reduce((max, c) => Math.max(max, c.order), -1);
    setEditingColumns(prev => [...prev, { id: generateId(), title: newColTitle.trim(), order: maxOrder + 1, color: newColColor }]);
    setNewColTitle(""); setNewColColor(COLUMN_COLORS[(editingColumns.length + 1) % COLUMN_COLORS.length]);
  };
  const saveColumnSettings = () => {
    const reindexed = editingColumns.map((c, i) => ({ ...c, order: i }));
    setPipelineColumns(reindexed); setShowColumnSettings(false); toast.success("Colunas atualizadas");
  };
  const resetColumns = () => { setEditingColumns([...DEFAULT_PIPELINE_COLUMNS]); };

  const conversionRates = useMemo(() => {
    const nonTerminalCols = sortedColumns.filter(c => !c.isWinColumn && !c.isLossColumn);
    const rates: Record<string, number> = {};
    for (let i = 0; i < nonTerminalCols.length - 1; i++) {
      const currentCol = nonTerminalCols[i];
      const dealsInCurrent = pipelineDeals.filter(d => d.columnId === currentCol.id).length;
      const laterColIds = new Set(nonTerminalCols.slice(i + 1).map(c => c.id));
      const winCol = sortedColumns.find(c => c.isWinColumn);
      const lossCol = sortedColumns.find(c => c.isLossColumn);
      if (winCol) laterColIds.add(winCol.id);
      if (lossCol) laterColIds.add(lossCol.id);
      const totalTouched = dealsInCurrent + pipelineDeals.filter(d => laterColIds.has(d.columnId)).length;
      rates[currentCol.id] = totalTouched > 0 ? Math.round(((totalTouched - dealsInCurrent) / totalTouched) * 100) : 0;
    }
    return rates;
  }, [pipelineDeals, sortedColumns]);

  // Loss insights - top objections
  const lossInsights = useMemo(() => {
    const reasons: Record<string, number> = {};
    lostDeals.forEach(d => {
      const r = d.lossReason || "Nao informado";
      reasons[r] = (reasons[r] || 0) + 1;
    });
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [lostDeals]);

  if (!can("pipeline", "view")) return <NoAccessPage />;

  const canAdd = can("pipeline", "add");
  const canEditPerm = can("pipeline", "edit");
  const canDelete = can("pipeline", "delete");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Pipeline de Vendas</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie suas oportunidades de negocio</p>
        </div>
        <div className="flex items-center gap-2">
          {canEditPerm && (
            <button onClick={openColumnSettings} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] transition-colors" style={{ color: "var(--text-muted)", border: "1px solid var(--border-default)" }}>
              <Settings2 className="w-4 h-4" /> Personalizar
            </button>
          )}
          {canAdd && (
            <button onClick={() => openNewDeal(sortedColumns[0]?.id || "")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] transition-colors" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
              <Plus className="w-4 h-4" /> Nova Oportunidade
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {([
          { label: "Oportunidades Ativas", value: String(activeDeals.length), icon: Target, color: "var(--accent)" },
          { label: "Valor Total Pipeline", value: formatCurrency(totalPipelineValue), icon: DollarSign, color: "#3b82f6" },
          { label: "Valor Ponderado", value: formatCurrency(weightedValue), icon: TrendingUp, color: "#f59e0b", sub: "por probabilidade" },
          { label: "Negocios Ganhos", value: formatCurrency(totalWonValue), icon: Trophy, color: "#22c55e", sub: `${wonDeals.length} fechados` },
          { label: "Taxa de Conversao", value: `${winRate}%`, icon: Zap, color: winRate >= 50 ? "#22c55e" : winRate >= 25 ? "#f59e0b" : "#ef4444", sub: `${wonDeals.length}W / ${lostDeals.length}L` },
        ]).map((stat) => (
          <div key={stat.label} className="rounded-2xl p-4" style={cs}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.color === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : `${stat.color}15` }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{stat.label}</span>
            </div>
            <p className="text-lg" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{stat.value}</p>
            {stat.sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Loss Insights */}
      {lossInsights.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-[#ef4444]" />
            <h3 className="text-[13px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Principais Objecoes ({lostDeals.length} perdas)</h3>
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>Use esses dados para refinar sua estrategia</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {lossInsights.map(([reason, count]) => {
              const pct = Math.round((count / lostDeals.length) * 100);
              return (
                <div key={reason} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-extra-subtle)" }}>
                  <div className="h-6 w-1 rounded-full bg-[#ef4444]" style={{ opacity: Math.max(0.3, pct / 100) }} />
                  <div>
                    <p className="text-[11px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{reason}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{count}x ({pct}%)</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Buscar oportunidades por nome, cliente ou servico..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none transition-colors" style={isStyle} />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={cs}>
          {[{ key: "all", label: "Todas" }, { key: "urgent", label: "Urgente" }, { key: "high", label: "Alta" }, { key: "medium", label: "Media" }, { key: "low", label: "Baixa" }].map(opt => (
            <button key={opt.key} onClick={() => setFilterPriority(opt.key)} className="px-3 py-1.5 rounded-lg text-[11px] transition-all" style={{
              fontWeight: filterPriority === opt.key ? 500 : 400,
              backgroundColor: filterPriority === opt.key ? "rgba(var(--accent-rgb),0.15)" : "transparent",
              color: filterPriority === opt.key ? "var(--accent)" : "var(--text-secondary)",
              border: filterPriority === opt.key ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid transparent",
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar" style={{ minHeight: "60vh" }}>
        {sortedColumns.map((column) => {
          const columnDeals = filteredDeals.filter(d => d.columnId === column.id).sort((a, b) => {
            const pOrder: Record<DealPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
            return pOrder[a.priority] - pOrder[b.priority];
          });
          const columnValue = columnDeals.reduce((s, d) => s + d.estimatedValue, 0);
          const isDragOver = dragOverColumnId === column.id;
          const convRate = conversionRates[column.id];
          const colWidth = sortedColumns.length <= 4 ? "min-w-[260px] flex-1" : sortedColumns.length <= 6 ? "min-w-[240px] w-[260px]" : "min-w-[220px] w-[240px]";

          return (
            <div key={column.id} className={`flex-shrink-0 ${colWidth} flex flex-col rounded-2xl transition-all duration-200`} style={{ backgroundColor: isDragOver ? "var(--bg-hover)" : "var(--bg-card)", border: "1px solid var(--border-subtle)", boxShadow: isDragOver ? "inset 0 0 0 2px rgba(var(--accent-rgb),0.3)" : "none" }} onDragOver={(e) => handleDragOver(e, column.id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, column.id)}>
              {/* Column Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                  <h3 className="text-[13px] flex-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{column.title}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>{columnDeals.length}</span>
                </div>
                {!column.isWinColumn && !column.isLossColumn && columnDeals.length > 0 && (
                  <div className="flex items-center justify-between ml-5">
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{formatCurrency(columnValue)}</p>
                    {convRate !== undefined && convRate > 0 && (
                      <span className="text-[9px] text-[#22c55e]/70 flex items-center gap-0.5">
                        <ArrowUpRight className="w-2.5 h-2.5" /> {convRate}%
                      </span>
                    )}
                  </div>
                )}
                {column.isWinColumn && columnDeals.length > 0 && (
                  <p className="text-[11px] text-[#22c55e] ml-5">{formatCurrency(columnDeals.reduce((s, d) => s + (d.realValue || d.estimatedValue), 0))}</p>
                )}
              </div>

              {/* Column Body */}
              <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto custom-scrollbar">
                {columnDeals.map((deal) => {
                  const clientName = getClientName(deal.clientId);
                  const dealServiceIds = deal.serviceIds || (deal.serviceId ? [deal.serviceId] : []);
                  const serviceNames = dealServiceIds.map(id => getServiceName(id)).filter(Boolean);
                  const clientPhone = getClientPhone(deal.clientId);
                  const isExpanded = expandedDealId === deal.id;
                  const isDragging = dragDealId === deal.id;
                  const age = getDealAge(deal);
                  const isStale = age > 14 && !column.isWinColumn && !column.isLossColumn;

                  return (
                    <motion.div key={deal.id} layout draggable={!column.isWinColumn && !column.isLossColumn && canEditPerm} onDragStart={(e: any) => canEditPerm ? handleDragStart(e, deal.id) : undefined} onDragEnd={handleDragEnd} className="rounded-xl overflow-hidden transition-all cursor-grab active:cursor-grabbing" style={{
                      backgroundColor: "var(--bg-card)",
                      borderWidth: 1, borderStyle: "solid",
                      borderColor: isDragging ? "rgba(var(--accent-rgb),0.3)" : isStale ? "rgba(245,158,11,0.2)" : "var(--border-subtle)",
                      borderLeftWidth: 3, borderLeftColor: DEAL_PRIORITY_COLORS[deal.priority],
                      opacity: isDragging ? 0.4 : 1, transform: isDragging ? "scale(0.98)" : "none",
                    }}>
                      <div className="p-3.5 group/card relative" onClick={() => setExpandedDealId(isExpanded ? null : deal.id)}>
                        {!column.isWinColumn && !column.isLossColumn && canEditPerm && (
                          <button onClick={(e) => { e.stopPropagation(); openEditDeal(deal); }} className="absolute top-2 right-2 p-2 rounded-lg transition-all opacity-0 group-hover/card:opacity-100 z-10 shadow-lg" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }} title="Editar oportunidade">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="flex items-start justify-between gap-2 mb-2 pr-8">
                          <p className="text-[13px] leading-tight flex-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{deal.title}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: `${DEAL_PRIORITY_COLORS[deal.priority]}15`, color: DEAL_PRIORITY_COLORS[deal.priority], fontWeight: 600 }}>
                            {DEAL_PRIORITY_LABELS[deal.priority]}
                          </span>
                        </div>

                        <p className="text-[14px] mb-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {column.isWinColumn && deal.realValue ? formatCurrency(deal.realValue) : formatCurrency(deal.estimatedValue)}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {clientName && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                              <User className="w-3 h-3" /> {clientName}
                            </span>
                          )}
                          {serviceNames.length > 0 && serviceNames.map((sn, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                              <Briefcase className="w-3 h-3" /> {sn}
                            </span>
                          ))}
                          {!column.isWinColumn && !column.isLossColumn && age > 0 && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: isStale ? "#f59e0b" : "var(--text-muted)", backgroundColor: isStale ? "rgba(245,158,11,0.1)" : "var(--bg-input)" }}>
                              <Clock className="w-3 h-3" /> {age}d
                            </span>
                          )}
                        </div>

                        {/* Probability Bar */}
                        {!column.isWinColumn && !column.isLossColumn && (
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Probabilidade</span>
                              <span className="text-[10px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{deal.probability}%</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${deal.probability}%`, backgroundColor: deal.probability >= 70 ? "#22c55e" : deal.probability >= 40 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                          </div>
                        )}

                        {column.isWinColumn && deal.paymentMethod && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-[#22c55e]/60 flex items-center gap-1">
                              <CreditCard className="w-3 h-3" /> {deal.paymentMethod}
                              {deal.installments && deal.installments > 1 ? ` ${deal.installments}x` : ""}
                            </span>
                          </div>
                        )}

                        {column.isLossColumn && deal.lossReason && (
                          <p className="text-[10px] text-[#ef4444]/70 mt-2 bg-[#ef4444]/5 rounded-md px-2 py-1">{deal.lossReason}</p>
                        )}
                      </div>

                      {/* Expanded Actions */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                            <div className="px-3.5 pb-3.5 pt-1 space-y-2" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                              {deal.contactName && (
                                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Contato: <span style={{ color: "var(--text-primary)" }}>{deal.contactName}</span></p>
                              )}
                              {deal.notes && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{deal.notes}</p>}
                              {deal.createdAt && (
                                <p className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                                  Criado em {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
                                  {deal.closedAt && ` / Fechado em ${new Date(deal.closedAt).toLocaleDateString("pt-BR")}`}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 pt-1">
                                {clientPhone && (
                                  <a href={`https://wa.me/55${clientPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors" title="WhatsApp">
                                    <Phone className="w-3 h-3" />
                                  </a>
                                )}
                                {!column.isWinColumn && !column.isLossColumn && (
                                  <>
                                    {canEditPerm && (
                                      <button onClick={(e) => { e.stopPropagation(); openEditDeal(deal); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }} title="Editar">
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    )}
                                    {canEditPerm && (
                                      <button onClick={(e) => { e.stopPropagation(); openWinWizard(deal.id); }} className="p-1.5 rounded-lg text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors" title="Marcar como Ganho">
                                        <Trophy className="w-3 h-3" />
                                      </button>
                                    )}
                                  </>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (deleteConfirm === deal.id) { removePipelineDeal(deal.id); setDeleteConfirm(null); setExpandedDealId(null); toast.success("Oportunidade excluida"); }
                                      else { setDeleteConfirm(deal.id); setTimeout(() => setDeleteConfirm(null), 3000); }
                                    }}
                                    className="flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all"
                                    style={{ color: "#ef4444", backgroundColor: deleteConfirm === deal.id ? "rgba(239,68,68,0.15)" : "transparent" }}
                                    title={deleteConfirm === deal.id ? "Clique para confirmar" : "Excluir"}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    {deleteConfirm === deal.id && <span className="text-[9px] whitespace-nowrap animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {!column.isWinColumn && !column.isLossColumn && canAdd && (
                  <button onClick={() => openNewDeal(column.id)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed text-[12px] transition-all" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}

                {columnDeals.length === 0 && (column.isWinColumn || column.isLossColumn) && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    {column.isWinColumn ? <Trophy className="w-8 h-8 text-[#22c55e]/20 mb-2" /> : <XCircle className="w-8 h-8 text-[#ef4444]/20 mb-2" />}
                    <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>Arraste oportunidades para ca</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal Form Modal */}
      <AnimatePresence>
        {showDealForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowDealForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{editingDealId ? "Editar Oportunidade" : "Nova Oportunidade"}</h2>
                <button onClick={() => setShowDealForm(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
              </div>

              <div className="overflow-y-auto custom-scrollbar p-6 space-y-4">
                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Titulo da Oportunidade *</label>
                  <input type="text" value={dealForm.title} onChange={(e) => setDealForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Site institucional - Empresa XYZ" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Cliente</label>
                    <ClientSearchSelect clients={clients} value={dealForm.clientId} onChange={(v) => setDealForm(f => ({ ...f, clientId: v }))} onCreateNew={() => { setQuickClient(emptyQuickClient); setShowQuickClient(true); }} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Servicos</label>
                    <MultiSelect
                      options={serviceOptions}
                      value={dealForm.serviceIds}
                      onChange={(ids) => {
                        const totalValue = ids.reduce((sum, id) => {
                          const svc = services.find(s => s.id === id);
                          return sum + (svc?.priceDisplay || 0);
                        }, 0);
                        setDealForm(f => ({
                          ...f,
                          serviceIds: ids,
                          serviceId: ids[0] || "",
                          estimatedValue: ids.length > 0 && !f.estimatedValue ? String(totalValue) : f.estimatedValue,
                        }));
                      }}
                      placeholder="Selecionar servicos"
                      searchable
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Valor Estimado</label>
                    <CurrencyInput value={dealForm.estimatedValue} onChange={(v) => setDealForm(f => ({ ...f, estimatedValue: v }))} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Probabilidade (%)</label>
                    <div className="relative">
                      <input type="text" inputMode="numeric" value={dealForm.probability} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); const num = Math.min(100, parseInt(v) || 0); setDealForm(f => ({ ...f, probability: v ? String(num) : "" })); }} className="w-full rounded-xl px-4 py-2.5 pr-8 text-[13px] focus:outline-none" style={isStyle} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: "var(--text-muted)" }}>%</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Prioridade</label>
                    <CustomSelect options={priorityOptions} value={dealForm.priority} onChange={(v) => setDealForm(f => ({ ...f, priority: v as DealPriority }))} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Etapa</label>
                    <CustomSelect options={sortedColumns.filter(c => !c.isWinColumn && !c.isLossColumn).map(c => ({ value: c.id, label: c.title }))} value={dealFormColumnId} onChange={(v) => setDealFormColumnId(v)} />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Nome do Contato</label>
                  <input type="text" value={dealForm.contactName} onChange={(e) => setDealForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Pessoa de contato" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                </div>
                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Observacoes</label>
                  <textarea value={dealForm.notes} onChange={(e) => setDealForm(f => ({ ...f, notes: e.target.value }))} placeholder="Detalhes da oportunidade..." rows={3} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={isStyle} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => setShowDealForm(false)} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={saveDeal} disabled={!dealForm.title.trim()} className="px-6 py-2.5 rounded-xl text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  {editingDealId ? "Salvar" : "Criar Oportunidade"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Add Client Modal */}
      <AnimatePresence>
        {showQuickClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowQuickClient(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                    <UserPlus className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <h3 className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Cadastro Rapido de Cliente</h3>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Sera vinculado automaticamente a oportunidade</p>
                  </div>
                </div>
                <button onClick={() => setShowQuickClient(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(["pf", "pj"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuickClient(f => ({ ...f, type: t }))}
                      className="flex-1 py-2.5 rounded-xl text-[12px] border transition-all"
                      style={{
                        fontWeight: quickClient.type === t ? 500 : 400,
                        backgroundColor: quickClient.type === t ? "rgba(var(--accent-rgb),0.1)" : "transparent",
                        borderColor: quickClient.type === t ? "rgba(var(--accent-rgb),0.3)" : "var(--border-default)",
                        color: quickClient.type === t ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      {t === "pf" ? "Pessoa Fisica (PF)" : "Pessoa Juridica (PJ)"}
                    </button>
                  ))}
                </div>

                {quickClient.type === "pf" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Nome Completo *</label>
                      <input
                        autoFocus
                        type="text"
                        value={quickClient.fullName}
                        onChange={e => setQuickClient(f => ({ ...f, fullName: e.target.value }))}
                        placeholder="Ex: Joao da Silva"
                        className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                        style={isStyle}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>E-mail</label>
                        <input type="email" value={quickClient.email} onChange={e => setQuickClient(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                      </div>
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Telefone / WhatsApp</label>
                        <input type="tel" value={quickClient.phone} onChange={e => setQuickClient(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Razao Social *</label>
                      <input
                        autoFocus
                        type="text"
                        value={quickClient.razaoSocial}
                        onChange={e => setQuickClient(f => ({ ...f, razaoSocial: e.target.value }))}
                        placeholder="Ex: Empresa LTDA"
                        className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                        style={isStyle}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Nome Fantasia</label>
                      <input type="text" value={quickClient.nomeFantasia} onChange={e => setQuickClient(f => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Nome comercial" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Nome do Contato</label>
                        <input type="text" value={quickClient.contactName} onChange={e => setQuickClient(f => ({ ...f, contactName: e.target.value }))} placeholder="Responsavel" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                      </div>
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>CNPJ</label>
                        <input type="text" value={quickClient.cnpj} onChange={e => setQuickClient(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>E-mail</label>
                        <input type="email" value={quickClient.email} onChange={e => setQuickClient(f => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                      </div>
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Telefone</label>
                        <input type="tel" value={quickClient.phone} onChange={e => setQuickClient(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 3000-0000" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => setShowQuickClient(false)}
                  className="px-4 py-2.5 text-[13px] rounded-xl transition-colors"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleQuickClientSave}
                  disabled={quickClientSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
                >
                  {quickClientSaving ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Cadastrar e Vincular
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win Wizard Modal */}
      <AnimatePresence>
        {showWinModal && winPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              {/* Header */}
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)", background: "linear-gradient(to right, rgba(34,197,94,0.1), transparent)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#22c55e]/15 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Negocio Fechado!</h2>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{winPreview.dealTitle}</p>
                  </div>
                  <button onClick={() => { setShowWinModal(false); setWinDealId(null); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto custom-scrollbar p-6 space-y-5 flex-1">
                {/* Section 1: Valor & Pagamento */}
                <div>
                  <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    <DollarSign className="w-4 h-4 text-[#22c55e]" /> Valor e Pagamento
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={lblStyle}>Valor Final do Negocio</label>
                      <CurrencyInput value={winWizard.realValue} onChange={(v) => setWinWizard(f => ({ ...f, realValue: v }))} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={lblStyle}>Forma de Pagamento</label>
                      <CustomSelect options={paymentMethodOptions} value={winWizard.paymentMethod} onChange={(v) => setWinWizard(f => ({ ...f, paymentMethod: v }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={lblStyle}>Parcelas</label>
                      <input type="text" inputMode="numeric" value={winWizard.installments} onChange={(e) => setWinWizard(f => ({ ...f, installments: e.target.value.replace(/\D/g, "").slice(0, 2) || "1" }))} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={lblStyle}>Data do Pagamento</label>
                      <DatePickerInput value={winWizard.paymentDate} onChange={(v) => setWinWizard(f => ({ ...f, paymentDate: v }))} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1.5 block" style={lblStyle}>Status</label>
                      <div className="flex gap-2">
                        {(["pending", "paid"] as const).map(s => (
                          <button key={s} onClick={() => setWinWizard(f => ({ ...f, paymentStatus: s }))} className="flex-1 py-2.5 rounded-xl text-[12px] border transition-all" style={{
                            fontWeight: winWizard.paymentStatus === s ? 500 : 400,
                            ...(winWizard.paymentStatus === s
                              ? s === "paid" ? { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)", color: "#22c55e" } : { backgroundColor: "rgba(245,158,11,0.15)", borderColor: "rgba(245,158,11,0.3)", color: "#f59e0b" }
                              : { borderColor: "var(--border-default)", color: "var(--text-muted)" }
                            ),
                          }}>
                            {s === "paid" ? "Pago" : "Pendente"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Tipo de Venda */}
                <div className="pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    <User className="w-4 h-4 text-[#a855f7]" /> Tipo de Venda
                  </h3>
                  <div className="flex gap-3 mb-3">
                    {(["direct", "commissioned"] as const).map(t => (
                      <button key={t} onClick={() => setWinWizard(f => ({ ...f, saleType: t }))} className="flex-1 py-3 rounded-xl text-[12px] border transition-all" style={{
                        fontWeight: winWizard.saleType === t ? 500 : 400,
                        ...(winWizard.saleType === t
                          ? { backgroundColor: "rgba(var(--accent-rgb),0.1)", borderColor: "rgba(var(--accent-rgb),0.3)", color: "var(--accent)" }
                          : { borderColor: "var(--border-default)", color: "var(--text-muted)" }
                        ),
                      }}>
                        {t === "direct" ? "Venda Direta" : "Venda Comissionada"}
                      </button>
                    ))}
                  </div>

                  {winWizard.saleType === "commissioned" && (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={lblStyle}>Comissionado</label>
                        <CustomSelect options={activeCommissionMembers} value={winWizard.commissionMemberId} onChange={(v) => { const member = commissionMembers.find(m => m.id === v); setWinWizard(f => ({ ...f, commissionMemberId: v, commissionRate: member ? String(member.defaultRate) : f.commissionRate })); }} placeholder="Selecionar" searchable />
                      </div>
                      <div>
                        <label className="text-[11px] mb-1.5 block" style={lblStyle}>Taxa de Comissao (%)</label>
                        <div className="relative">
                          <input type="text" inputMode="numeric" value={winWizard.commissionRate} onChange={(e) => setWinWizard(f => ({ ...f, commissionRate: e.target.value.replace(/[^\d.]/g, "") }))} className="w-full rounded-xl px-4 py-2.5 pr-8 text-[13px] focus:outline-none" style={isStyle} placeholder="10" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: "var(--text-muted)" }}>%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Automacoes */}
                <div className="pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} /> Automacoes Inteligentes
                  </h3>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border cursor-pointer transition-all" style={{ backgroundColor: winWizard.createEntry ? "rgba(34,197,94,0.05)" : "transparent", borderColor: winWizard.createEntry ? "rgba(34,197,94,0.2)" : "var(--border-subtle)" }} onClick={() => setWinWizard(f => ({ ...f, createEntry: !f.createEntry }))}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: winWizard.createEntry ? "rgba(34,197,94,0.15)" : "var(--bg-input)" }}>
                            <Receipt className="w-4 h-4" style={{ color: winWizard.createEntry ? "#22c55e" : "var(--text-muted)" }} />
                          </div>
                          <div>
                            <p className="text-[12px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Lancar como Receita</p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Cria automaticamente um lancamento de receita com provisoes calculadas</p>
                          </div>
                        </div>
                        <div className="w-10 h-5.5 rounded-full transition-all relative" style={{ backgroundColor: winWizard.createEntry ? "#22c55e" : "var(--border-subtle)" }}>
                          <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all shadow-sm ${winWizard.createEntry ? "left-[calc(100%-20px)]" : "left-0.5"}`} />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border cursor-pointer transition-all" style={{ backgroundColor: winWizard.createProject ? "rgba(59,130,246,0.05)" : "transparent", borderColor: winWizard.createProject ? "rgba(59,130,246,0.2)" : "var(--border-subtle)" }} onClick={() => setWinWizard(f => ({ ...f, createProject: !f.createProject }))}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: winWizard.createProject ? "rgba(59,130,246,0.15)" : "var(--bg-input)" }}>
                            <FolderKanban className="w-4 h-4" style={{ color: winWizard.createProject ? "#3b82f6" : "var(--text-muted)" }} />
                          </div>
                          <div>
                            <p className="text-[12px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Criar Projeto Automaticamente</p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Envia para o Kanban de producao com dados pre-preenchidos</p>
                          </div>
                        </div>
                        <div className="w-10 h-5.5 rounded-full transition-all relative" style={{ backgroundColor: winWizard.createProject ? "#3b82f6" : "var(--border-subtle)" }}>
                          <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all shadow-sm ${winWizard.createProject ? "left-[calc(100%-20px)]" : "left-0.5"}`} />
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {winWizard.createProject && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-3 gap-3 pt-1 pb-1">
                            <div>
                              <label className="text-[10px] mb-1 block" style={lblStyle}>Inicio do Projeto</label>
                              <DatePickerInput value={winWizard.projectStartDate} onChange={(v) => setWinWizard(f => ({ ...f, projectStartDate: v }))} />
                            </div>
                            <div>
                              <label className="text-[10px] mb-1 block" style={lblStyle}>Prazo de Entrega</label>
                              <DatePickerInput value={winWizard.projectDueDate} onChange={(v) => setWinWizard(f => ({ ...f, projectDueDate: v }))} />
                            </div>
                            <div>
                              <label className="text-[10px] mb-1 block" style={lblStyle}>Prioridade</label>
                              <CustomSelect options={priorityOptions} value={winWizard.projectPriority} onChange={(v) => setWinWizard(f => ({ ...f, projectPriority: v as DealPriority }))} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Section 4: Preview Financeiro */}
                <div className="pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    <Zap className="w-4 h-4 text-[#f59e0b]" /> Previsao Financeira
                  </h3>
                  <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--bg-base)" }}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span style={{ color: "var(--text-muted)" }}>Valor Bruto</span>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(winPreview.grossAmount)}</span>
                    </div>
                    {winPreview.taxes > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--text-muted)" }}>Impostos</span>
                        <span className="text-[#ef4444]">-{formatCurrency(winPreview.taxes)}</span>
                      </div>
                    )}
                    {winPreview.fees > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--text-muted)" }}>Taxas Gateway</span>
                        <span className="text-[#f59e0b]">-{formatCurrency(winPreview.fees)}</span>
                      </div>
                    )}
                    {winPreview.marketing > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--text-muted)" }}>Marketing (reserva)</span>
                        <span className="text-[#3b82f6]">-{formatCurrency(winPreview.marketing)}</span>
                      </div>
                    )}
                    {winPreview.commissionAmount > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--text-muted)" }}>Comissao</span>
                        <span className="text-[#a855f7]">-{formatCurrency(winPreview.commissionAmount)}</span>
                      </div>
                    )}
                    <div className="pt-2 mt-2 flex items-center justify-between text-[13px]" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Receita Liquida Estimada</span>
                      <span style={{ fontWeight: 600, color: "var(--accent)" }}>{formatCurrency(winPreview.finalNet)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--text-muted)" }}>Margem liquida</span>
                      <span style={{ color: winPreview.margin >= 20 ? "#22c55e" : winPreview.margin >= 10 ? "#f59e0b" : "#ef4444" }}>
                        {winPreview.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {winWizard.createEntry && (
                      <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/15">
                        <Check className="w-3 h-3" /> Lancamento de receita ({winWizard.paymentStatus === "paid" ? "pago" : "pendente"})
                      </span>
                    )}
                    {winWizard.createProject && (
                      <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/15">
                        <Check className="w-3 h-3" /> Projeto no Kanban
                      </span>
                    )}
                    {winWizard.saleType === "commissioned" && winWizard.commissionMemberId && (
                      <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/15">
                        <Check className="w-3 h-3" /> Comissao: {formatCurrency(winPreview.commissionAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-base)" }}>
                <button onClick={() => { setShowWinModal(false); setWinDealId(null); }} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
                <button onClick={confirmWin} className="flex items-center gap-2 px-8 py-2.5 bg-[#22c55e] text-white rounded-xl text-[13px] hover:bg-[#22c55e]/90 transition-colors shadow-lg shadow-[#22c55e]/20" style={{ fontWeight: 500 }}>
                  <Trophy className="w-4 h-4" /> Confirmar Venda
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loss Modal */}
      <AnimatePresence>
        {showLossModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl bg-[#ef4444]/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <div>
                  <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Negocio Perdido</h2>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Registre o motivo para aprendizado futuro</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Motivo da Perda</label>
                  <CustomSelect options={lossReasonOptions} value={lossReason} onChange={(v) => setLossReason(v)} placeholder="Selecionar motivo" searchable allowCreate onCreate={(newReason) => setLossReason(newReason)} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => { setShowLossModal(false); setLossDealId(null); }} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
                <button onClick={confirmLoss} className="px-6 py-2.5 bg-[#ef4444] text-white rounded-xl text-[13px] hover:bg-[#ef4444]/90 transition-colors" style={{ fontWeight: 500 }}>
                  Registrar Perda
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column Settings Modal */}
      <AnimatePresence>
        {showColumnSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowColumnSettings(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <Columns3 className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Personalizar Colunas</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetColumns} className="p-1.5 rounded-lg text-[#f59e0b] transition-colors" title="Restaurar padrao"><RotateCcw className="w-4 h-4" /></button>
                  <button onClick={() => setShowColumnSettings(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="overflow-y-auto custom-scrollbar p-6 space-y-3">
                {editingColumns.map((col, index) => (
                  <div key={col.id} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-extra-subtle)" }}>
                    <GripVertical className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <input type="text" value={col.title} onChange={(e) => setEditingColumns(prev => prev.map((c, i) => i === index ? { ...c, title: e.target.value } : c))} className="flex-1 bg-transparent text-[13px] focus:outline-none" style={{ color: "var(--text-primary)" }} />
                    <div className="flex items-center gap-1.5 shrink-0">
                      {col.isWinColumn && <span className="text-[9px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-md" style={{ fontWeight: 600 }}>GANHO</span>}
                      {col.isLossColumn && <span className="text-[9px] text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded-md" style={{ fontWeight: 600 }}>PERDIDO</span>}
                      <div className="relative group">
                        <button className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ border: "1px solid var(--border-default)" }}>
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.color }} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 rounded-xl p-2 shadow-2xl hidden group-hover:flex flex-wrap gap-1 w-[140px] z-10" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
                          {COLUMN_COLORS.map(c => (
                            <button key={c} onClick={() => setEditingColumns(prev => prev.map((col2, i) => i === index ? { ...col2, color: c } : col2))} className={`w-5 h-5 rounded-md transition-all ${col.color === c ? "ring-2 ring-white scale-110" : "hover:scale-110"}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      {!col.isWinColumn && !col.isLossColumn && (
                        <button onClick={() => setEditingColumns(prev => prev.filter((_, i) => i !== index))} className="p-1 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/5 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-3 rounded-xl p-3 border border-dashed" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-default)" }}>
                  <Plus className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input type="text" value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNewColumn()} placeholder="Nome da nova coluna..." className="flex-1 bg-transparent text-[13px] focus:outline-none" style={{ color: "var(--text-primary)" }} />
                  <button onClick={addNewColumn} disabled={!newColTitle.trim()} className="px-3 py-1.5 rounded-lg text-[11px] transition-colors disabled:opacity-30" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => setShowColumnSettings(false)} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={saveColumnSettings} className="px-6 py-2.5 rounded-xl text-[13px] transition-colors" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  Salvar Colunas
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
