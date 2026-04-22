import { useState, useMemo } from "react";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Calendar, Pencil, Copy, CheckCircle2, Clock, ChevronDown, ChevronUp, GripVertical, Percent, User, Package } from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, SERVICE_CATEGORIES, type EntryType, type DailyEntry, calculateSaleIntelligence, type DirectCost } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput } from "./ui/currency-input";
import { DatePickerInput } from "./ui/date-picker-input";
import { RecurrenceToggle, recurrenceConfigToString, stringToRecurrenceConfig, type RecurrenceConfig } from "./ui/recurrence-toggle";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

export function EntriesPage() {
  const {
    entries, addEntry, updateEntry, removeEntry,
    expenseCategories, addExpenseCategory,
    suppliers, addSupplier,
    paymentMethods, addPaymentMethod,
    variableParams,
    commissionMembers, services,
    partners,
  } = useFinance();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const emptyForm = {
    date: today, type: "income" as EntryType, description: "", amount: "",
    category: SERVICE_CATEGORIES[0], client: "", supplier: "", paymentMethod: paymentMethods[0] || "PIX", status: "paid" as "pending" | "paid",
    installments: "1"
  };
  const [form, setForm] = useState(emptyForm);
  const [showCMV, setShowCMV] = useState(false);
  const [directCosts, setDirectCosts] = useState<DirectCost[]>([]);
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({ enabled: false, frequency: "monthly" });
  const [saleType, setSaleType] = useState<"direct" | "commissioned">("direct");
  const [commissionMemberId, setCommissionMemberId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [isProductionPayment, setIsProductionPayment] = useState(false);
  const [productionPartnerId, setProductionPartnerId] = useState("");
  const [productionQuantity, setProductionQuantity] = useState("");

  const productionPartners = partners.filter(p => p.payPerProduction && p.status !== "inactive");
  const selectedProductionPartner = productionPartners.find(p => p.id === productionPartnerId);
  const productionTotal = selectedProductionPartner && productionQuantity
    ? (selectedProductionPartner.productionRate || 0) * (parseFloat(productionQuantity) || 0)
    : 0;

  const liveIntelligence = useMemo(() => {
    if (form.type !== "income" || !form.amount) return null;
    const amount = parseFloat(form.amount) || 0;
    const costsTotal = directCosts.reduce((s, c) => s + c.amount, 0);
    return calculateSaleIntelligence(amount, form.paymentMethod, parseInt(form.installments) || 1, costsTotal, variableParams);
  }, [form.amount, form.type, form.paymentMethod, form.installments, directCosts, variableParams]);

  const selectedMember = commissionMembers.find(m => m.id === commissionMemberId);
  const memberCommission = useMemo(() => {
    if (saleType !== "commissioned" || !selectedMember || !form.amount) return 0;
    const grossAmount = parseFloat(form.amount) || 0;
    if (grossAmount <= 0) return 0;
    let rate = selectedMember.defaultRate;
    let incidence = selectedMember.defaultIncidence;
    if (selectedMember.commissionMode === "per_service" && selectedMember.serviceRates) {
      const svc = services.find(s => s.category === form.category);
      if (svc) {
        const svcRate = selectedMember.serviceRates.find(r => r.serviceId === svc.id);
        if (svcRate) { rate = svcRate.rate; incidence = svcRate.incidence; }
      }
    }
    if (incidence === "gross_revenue") return grossAmount * (rate / 100);
    const netBase = liveIntelligence ? (liveIntelligence.grossAmount - liveIntelligence.directCostsTotal - liveIntelligence.taxes - liveIntelligence.fees) : grossAmount;
    return netBase * (rate / 100);
  }, [saleType, selectedMember, form.amount, form.category, services, liveIntelligence]);

  const filtered = entries
    .filter((e) => filter === "all" || e.type === filter)
    .filter((e) => statusFilter === "all" || (statusFilter === "pending" && e.status === "pending") || (statusFilter === "paid" && e.status !== "pending"))
    .filter((e) => recurrenceFilter === "all" || e.recurrence === recurrenceFilter);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    filtered.forEach((entry) => { if (!groups[entry.date]) groups[entry.date] = []; groups[entry.date].push(entry); });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const todayTotals = useMemo(() => {
    const todayEntries = entries.filter((e) => e.date === today && e.status !== "pending");
    const income = todayEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = todayEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [entries, today]);

  const openEdit = (entry: DailyEntry) => {
    setForm({
      date: entry.date, type: entry.type, description: entry.description, amount: String(entry.amount),
      category: entry.category, client: entry.client || "", supplier: entry.supplier || "",
      paymentMethod: entry.paymentMethod || "PIX", status: entry.status || "paid",
      installments: entry.installments ? String(entry.installments) : "1",
    });
    setDirectCosts(entry.directCosts || []);
    setShowCMV(!!(entry.directCosts && entry.directCosts.length > 0));
    setEditingId(entry.id);
    setRecurrenceConfig(stringToRecurrenceConfig(entry.recurrence));
    setSaleType(entry.saleType || "direct");
    setCommissionMemberId(entry.commissionMemberId || "");
    setSelectedServiceId(entry.serviceId || "");
    setIsProductionPayment(entry.productionPayment || false);
    setProductionPartnerId(entry.productionPartnerId || "");
    setProductionQuantity(entry.productionQuantity || "");
    setShowForm(true);
  };

  const openDuplicate = (entry: DailyEntry) => {
    setForm({
      date: today, type: entry.type, description: entry.description + " (copia)", amount: String(entry.amount),
      category: entry.category, client: entry.client || "", supplier: entry.supplier || "",
      paymentMethod: entry.paymentMethod || "PIX", status: "pending",
      installments: entry.installments ? String(entry.installments) : "1",
    });
    setDirectCosts(entry.directCosts || []);
    setShowCMV(!!(entry.directCosts && entry.directCosts.length > 0));
    setEditingId(null);
    setRecurrenceConfig(stringToRecurrenceConfig(entry.recurrence));
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount) { toast.error("Preencha descricao e valor"); return; }

    const existingEntry = editingId ? entries.find(e => e.id === editingId) : null;

    const data: Omit<DailyEntry, "id"> = {
      date: form.date, type: form.type, description: form.description, amount: parseFloat(form.amount),
      category: form.category, client: form.type === "income" ? form.client : undefined,
      supplier: form.type === "expense" ? form.supplier : undefined, paymentMethod: form.paymentMethod,
      status: form.status, expenseId: existingEntry?.expenseId,
      recurrence: recurrenceConfigToString(recurrenceConfig), installments: parseInt(form.installments) || 1,
    };

    if (form.type === "income" && liveIntelligence) {
      data.directCosts = directCosts;
      data.provisionedTaxes = liveIntelligence.taxes;
      data.provisionedFees = liveIntelligence.fees;
      data.provisionedCommissions = liveIntelligence.commissions;
      data.provisionedMarketing = liveIntelligence.marketing;
      data.netAmount = liveIntelligence.netAmount;
      data.serviceId = selectedServiceId || undefined;

      if (saleType === "commissioned" && commissionMemberId && memberCommission > 0) {
        data.saleType = "commissioned"; data.commissionMemberId = commissionMemberId;
        data.commissionAmount = memberCommission;
        data.provisionedCommissions = (data.provisionedCommissions || 0) + memberCommission;
        data.netAmount = (data.netAmount || 0) - memberCommission;
      } else { data.saleType = "direct"; }

      if (isProductionPayment && productionPartnerId && productionQuantity) {
        data.productionPayment = true;
        data.productionPartnerId = productionPartnerId;
        data.productionQuantity = productionQuantity;
        data.directCosts = [...(data.directCosts || []), { id: Math.random().toString(), description: `Producao - ${selectedProductionPartner?.name || "Prestador"}`, amount: productionTotal }];
      }
    }

    // Production payment for expense type
    if (form.type === "expense" && isProductionPayment && productionPartnerId && productionQuantity) {
      data.productionPayment = true;
      data.productionPartnerId = productionPartnerId;
      data.productionQuantity = productionQuantity;
      data.amount = productionTotal;
      data.description = data.description || `Pagamento de producao - ${selectedProductionPartner?.name || "Prestador"}`;
      data.supplier = selectedProductionPartner?.name || data.supplier;
    }

    if (editingId) { updateEntry(editingId, data); toast.success("Lancamento atualizado"); }
    else { addEntry(data); toast.success("Lancamento cadastrado"); }

    setForm(emptyForm); setDirectCosts([]); setShowCMV(false); setEditingId(null); setShowForm(false);
  };

  const handleCancel = () => {
    setForm(emptyForm); setDirectCosts([]); setShowCMV(false); setEditingId(null);
    setRecurrenceConfig({ enabled: false, frequency: "monthly" }); setSaleType("direct");
    setCommissionMemberId(""); setSelectedServiceId("");
    setIsProductionPayment(false); setProductionPartnerId(""); setProductionQuantity("");
    setShowForm(false);
  };

  const addDirectCost = () => { setDirectCosts([...directCosts, { id: Math.random().toString(), description: "", amount: 0 }]); };
  const updateDirectCost = (id: string, field: "description" | "amount", val: string | number) => { setDirectCosts(directCosts.map(c => c.id === id ? { ...c, [field]: val } : c)); };
  const removeDirectCost = (id: string) => { setDirectCosts(directCosts.filter(c => c.id !== id)); };

  const markAsPaid = (entry: DailyEntry) => { updateEntry(entry.id, { ...entry, status: "paid" }); toast.success("Lancamento efetivado"); };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) { removeEntry(id); setDeleteConfirm(null); toast.success("Lancamento excluido"); }
    else { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    if (dateStr === today) return "Hoje";
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(date);
  };

  const incomeCategories = SERVICE_CATEGORIES.map(c => ({ value: c, label: c }));
  const expenseCatOpts = expenseCategories.map(c => ({ value: c, label: c }));
  const supplierOpts = suppliers.map(s => ({ value: s, label: s }));
  const paymentMethodOpts = paymentMethods.map(p => ({ value: p, label: p }));
  const typeOptions = [{ value: "income", label: "Receita" }, { value: "expense", label: "Despesa" }];
  const statusOptions = [{ value: "pending", label: "Pendente / A Vencer" }, { value: "paid", label: "Pago / Recebido" }];

  const recurrenceFilterTabs = useMemo(() => {
    const tabs = [{ key: "all", label: "Todas as Recorrencias" }];
    const unique = new Set(entries.map(e => e.recurrence).filter(Boolean));
    unique.forEach(r => { if (r) tabs.push({ key: r, label: r }); });
    return tabs;
  }, [entries]);

  if (!can("lancamentos", "view")) return <NoAccessPage />;

  const canAdd = can("lancamentos", "add");
  const canEditPerm = can("lancamentos", "edit");
  const canDelete = can("lancamentos", "delete");

  const tabStyle = (active: boolean, accent = true) => ({
    fontWeight: active ? 500 : 400,
    backgroundColor: active ? (accent ? "var(--accent)" : "var(--bg-hover)") : "transparent",
    color: active ? (accent ? "var(--accent-foreground)" : "var(--text-primary)") : "var(--text-secondary)",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Lancamentos</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie e efetive o fluxo de caixa diario</p>
        </div>
        {canAdd && (
          <button onClick={() => { setEditingId(null); setForm(emptyForm); setSelectedServiceId(""); setSaleType("direct"); setCommissionMemberId(""); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Novo Lancamento
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: "Entradas Hoje (Efetivadas)", value: formatCurrency(todayTotals.income), icon: ArrowUpRight, iconColor: "#22c55e", valueColor: "#22c55e" },
          { label: "Saidas Hoje (Pagas)", value: formatCurrency(todayTotals.expense), icon: ArrowDownRight, iconColor: "#ef4444", valueColor: "#ef4444" },
          { label: "Saldo Realizado do Dia", value: formatCurrency(todayTotals.net), icon: Calendar, iconColor: "var(--accent)", valueColor: todayTotals.net >= 0 ? "var(--accent)" : "#ef4444" },
        ]).map(c => (
          <div key={c.label} className="rounded-2xl p-5" style={cs}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.iconColor === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : c.iconColor + "1a" }}>
                <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
              </div>
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{c.label}</span>
            </div>
            <p className="text-[22px]" style={{ fontWeight: 600, color: c.valueColor }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4" style={{ ...cs, border: "2px solid var(--accent)" }}>
          <h3 className="text-[15px] mb-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{editingId ? "Editar Lancamento" : "Novo Lancamento"}</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Data</label>
              <DatePickerInput value={form.date} onChange={(val) => setForm({ ...form, date: val })} />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Tipo</label>
              <CustomSelect options={typeOptions} value={form.type} onChange={(val) => setForm({ ...form, type: val as EntryType, category: val === "income" ? incomeCategories[0].value : (expenseCatOpts[0]?.value || "Outros") })} />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Categoria</label>
              <CustomSelect searchable allowCreate={form.type === "expense"} options={form.type === "income" ? incomeCategories : expenseCatOpts} value={form.category} onChange={(val) => setForm({ ...form, category: val })} onCreate={(val) => form.type === "expense" && addExpenseCategory(val)} />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Valor (R$)</label>
              <CurrencyInput value={form.amount} onChange={(val) => setForm({ ...form, amount: val })} placeholder="0,00" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Descricao</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Detalhes..." />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {form.type === "income" ? "Cliente (Opcional)" : "Fornecedor (Opcional)"}
              </label>
              {form.type === "income" ? (
                <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: TechCorp" />
              ) : (
                <CustomSelect searchable allowCreate options={supplierOpts} value={form.supplier} onChange={(val) => setForm({ ...form, supplier: val })} onCreate={(val) => addSupplier(val)} placeholder="Selecione ou crie..." />
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Forma de Pagamento</label>
                <CustomSelect searchable allowCreate options={paymentMethodOpts} value={form.paymentMethod} onChange={(val) => setForm({ ...form, paymentMethod: val })} onCreate={(val) => addPaymentMethod(val)} placeholder="Selecione..." />
              </div>
              {form.type === "income" && (
                <div className="w-[80px]">
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Parcelas</label>
                  <input type="number" min="1" max="36" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} className="w-full rounded-xl px-2 py-2.5 text-[13px] text-center focus:outline-none" style={isStyle} />
                </div>
              )}
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
              <CustomSelect options={statusOptions} value={form.status} onChange={(val) => setForm({ ...form, status: val as "pending" | "paid" })} />
            </div>
          </div>

          {/* Recurrence + Commission Row */}
          <div className="flex items-center gap-6 pt-1">
            {form.type === "income" && services.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[12px] shrink-0" style={{ color: "var(--text-secondary)" }}>Servico:</label>
                <div className="w-52">
                  <CustomSelect
                    options={[{ value: "", label: "Nenhum" }, ...services.map(s => ({ value: s.id, label: s.name }))]}
                    value={selectedServiceId}
                    onChange={(val) => {
                      setSelectedServiceId(val);
                      if (val) {
                        const svc = services.find(s => s.id === val);
                        if (svc) {
                          setForm(prev => ({ ...prev, category: svc.category }));
                          if (!form.amount) setForm(prev => ({ ...prev, amount: String(svc.priceDisplay) }));
                        }
                      }
                    }}
                    placeholder="Vincular servico..."
                  />
                </div>
              </div>
            )}
            <RecurrenceToggle value={recurrenceConfig} onChange={setRecurrenceConfig} />

            {form.type === "income" && commissionMembers.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                  <button type="button" onClick={() => { setSaleType("direct"); setCommissionMemberId(""); }} className="px-3 py-1.5 rounded-md text-[12px] transition-all" style={tabStyle(saleType === "direct")}>
                    Venda Direta
                  </button>
                  <button type="button" onClick={() => setSaleType("commissioned")} className="px-3 py-1.5 rounded-md text-[12px] transition-all flex items-center gap-1" style={{ backgroundColor: saleType === "commissioned" ? "#22c55e" : "transparent", color: saleType === "commissioned" ? "#fff" : "var(--text-secondary)" }}>
                    <Percent className="w-3 h-3" /> Com Comissao
                  </button>
                </div>

                {saleType === "commissioned" && (
                  <div className="flex items-center gap-2">
                    <div className="w-48">
                      <CustomSelect options={commissionMembers.filter(m => m.active).map(m => ({ value: m.id, label: m.name }))} value={commissionMemberId} onChange={setCommissionMemberId} placeholder="Selecionar..." />
                    </div>
                    {memberCommission > 0 && (
                      <span className="text-[11px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {selectedMember?.name.split(" ")[0]}: {formatCurrency(memberCommission)}
                        <span style={{ color: "var(--text-muted)" }}>({selectedMember?.defaultRate}%)</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Production Payment Section - for expenses */}
          {form.type === "expense" && productionPartners.length > 0 && (
            <div className="rounded-xl p-4 space-y-4 mt-2" style={{ backgroundColor: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={isProductionPayment} onChange={(e) => {
                    setIsProductionPayment(e.target.checked);
                    if (!e.target.checked) { setProductionPartnerId(""); setProductionQuantity(""); }
                  }} className="sr-only" />
                  <div className="w-5 h-5 rounded border flex items-center justify-center transition-colors" style={{ backgroundColor: isProductionPayment ? "#f59e0b" : "var(--bg-input)", borderColor: isProductionPayment ? "#f59e0b" : "var(--border-default)" }}>
                    {isProductionPayment && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
                <Package className="w-4 h-4" style={{ color: "#f59e0b" }} />
                <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Pagamento de Prestador por Producao</span>
              </label>

              {isProductionPayment && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Prestador</label>
                      <CustomSelect
                        options={productionPartners.map(p => ({
                          value: p.id,
                          label: `${p.name} - ${formatCurrency(p.productionRate || 0)}/${p.productionLabel || "un."}`
                        }))}
                        value={productionPartnerId}
                        onChange={(val) => {
                          setProductionPartnerId(val);
                          const partner = productionPartners.find(p => p.id === val);
                          if (partner) {
                            setForm(prev => ({
                              ...prev,
                              description: prev.description || `Pagamento de producao - ${partner.name}`,
                              supplier: partner.name,
                            }));
                          }
                        }}
                        placeholder="Selecione o prestador..."
                      />
                    </div>
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Quantidade {selectedProductionPartner ? `(${selectedProductionPartner.productionLabel || "unidades"})` : ""}
                      </label>
                      <input
                        type="text" inputMode="numeric"
                        value={productionQuantity}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, "");
                          setProductionQuantity(val);
                        }}
                        className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                        style={isStyle}
                        placeholder="Ex: 20"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Valor por Unidade</label>
                      <div className="rounded-xl px-4 py-2.5 text-[13px]" style={{ ...isStyle, opacity: 0.7 }}>
                        {selectedProductionPartner ? formatCurrency(selectedProductionPartner.productionRate || 0) : "R$ 0,00"}
                      </div>
                    </div>
                  </div>

                  {/* Calculation summary */}
                  {productionTotal > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Qtd</p>
                          <p className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{productionQuantity}</p>
                        </div>
                        <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>x</span>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Valor Un.</p>
                          <p className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(selectedProductionPartner?.productionRate || 0)}</p>
                        </div>
                        <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>=</span>
                        <div className="text-center">
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: "#f59e0b" }}>Total a Pagar</p>
                          <p className="text-[18px]" style={{ fontWeight: 700, color: "#f59e0b" }}>{formatCurrency(productionTotal)}</p>
                        </div>
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Este valor sera usado como valor do lancamento
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CMV Section */}
          {form.type === "income" && (
            <div className="rounded-xl overflow-hidden mt-4" style={{ border: "1px solid var(--border-subtle)" }}>
              <button type="button" onClick={() => setShowCMV(!showCMV)} className="w-full flex items-center justify-between p-4 transition-colors" style={{ backgroundColor: "var(--bg-input)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Custos Diretos da Venda (CMV)</span>
                  {directCosts.length > 0 && (
                    <span className="text-[10px] bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-0.5 rounded-full border border-[#f59e0b]/30">
                      {directCosts.length} itens: {formatCurrency(directCosts.reduce((s, c) => s + c.amount, 0))}
                    </span>
                  )}
                </div>
                {showCMV ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
              </button>

              {showCMV && (
                <div className="p-4 space-y-3" style={{ backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Registre custos especificos que voce tera apenas por realizar esta venda (ex: template, hospedagem, freelancer especifico).</p>

                  {directCosts.map((cost) => (
                    <div key={cost.id} className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 cursor-grab" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                      <input value={cost.description} onChange={(e) => updateDirectCost(cost.id, "description", e.target.value)} placeholder="Ex: Licenca do Template" className="flex-1 rounded-xl px-4 py-2 text-[13px] focus:outline-none" style={isStyle} />
                      <input type="number" step="0.01" value={cost.amount || ""} onChange={(e) => updateDirectCost(cost.id, "amount", parseFloat(e.target.value) || 0)} placeholder="Valor R$" className="w-[120px] rounded-xl px-4 py-2 text-[13px] focus:outline-none" style={isStyle} />
                      <button type="button" onClick={() => removeDirectCost(cost.id)} className="p-2 text-[#ef4444] rounded-lg hover:bg-[#ef4444]/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addDirectCost} className="text-[12px] flex items-center gap-1 font-medium pt-1" style={{ color: "#f59e0b" }}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar Custo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Intelligence Panel */}
          {form.type === "income" && liveIntelligence && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: "linear-gradient(to bottom right, rgba(34,197,94,0.08), transparent)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Analise de Receita Liquida</span>
                <span className="text-[12px] text-[#22c55e] font-medium bg-[#22c55e]/10 px-2 py-0.5 rounded">Margem: {liveIntelligence.margin.toFixed(1)}%</span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Venda Bruta</p>
                  <p className="text-[14px]" style={{ color: "var(--text-primary)" }}>{formatCurrency(liveIntelligence.grossAmount)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Deducoes Previsiveis</p>
                  <div className="text-[10px] text-[#ef4444]/80 flex flex-col gap-0.5">
                    {liveIntelligence.directCostsTotal > 0 && <span>CMV: -{formatCurrency(liveIntelligence.directCostsTotal)}</span>}
                    {liveIntelligence.taxes > 0 && <span>Impostos: -{formatCurrency(liveIntelligence.taxes)}</span>}
                    {liveIntelligence.fees > 0 && <span>Taxas: -{formatCurrency(liveIntelligence.fees)}</span>}
                    {liveIntelligence.commissions > 0 && <span>Comissao: -{formatCurrency(liveIntelligence.commissions)}</span>}
                  </div>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Reserva de Marketing</p>
                  <p className="text-[14px] text-[#3b82f6]">{formatCurrency(liveIntelligence.marketing)}</p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Lucro Liquido Real</p>
                  <p className="text-[18px] text-[#22c55e] font-bold">{formatCurrency(liveIntelligence.netAmount)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
              {editingId ? "Atualizar" : "Salvar Lancamento"}
            </button>
            <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={cs}>
          {[{ key: "all", label: "Todos" }, { key: "income", label: "Receitas" }, { key: "expense", label: "Despesas" }].map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key as typeof filter)} className="px-4 py-2 rounded-lg text-[12px] transition-all" style={tabStyle(filter === tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={cs}>
          {[{ key: "all", label: "Todos os Status" }, { key: "pending", label: "Pendente / A Vencer" }, { key: "paid", label: "Pago / Efetivado" }].map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key as typeof statusFilter)} className="px-4 py-2 rounded-lg text-[12px] transition-all" style={tabStyle(statusFilter === tab.key, false)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl w-fit overflow-x-auto max-w-full custom-scrollbar" style={cs}>
          {recurrenceFilterTabs.map((tab) => (
            <button key={tab.key} onClick={() => setRecurrenceFilter(tab.key)} className="px-4 py-2 rounded-lg text-[12px] whitespace-nowrap transition-all" style={tabStyle(recurrenceFilter === tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped entries */}
      <div className="space-y-4">
        {grouped.map(([date, dayEntries]) => {
          const dayIncome = dayEntries.filter((e) => e.type === "income" && e.status !== "pending").reduce((s, e) => s + e.amount, 0);
          const dayExpense = dayEntries.filter((e) => e.type === "expense" && e.status !== "pending").reduce((s, e) => s + e.amount, 0);
          const pendingCount = dayEntries.filter(e => e.status === "pending").length;

          return (
            <div key={date} className="rounded-2xl overflow-hidden" style={cs}>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] capitalize" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    {formatFullDate(date)}
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-2 py-0.5 rounded-full border border-[#f59e0b]/20">
                      {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {dayIncome > 0 && <span className="text-[12px] text-[#22c55e]">+{formatCurrency(dayIncome)}</span>}
                  {dayExpense > 0 && <span className="text-[12px] text-[#ef4444]">-{formatCurrency(dayExpense)}</span>}
                </div>
              </div>
              <div>
                {dayEntries.map((entry, i) => {
                  const isPending = entry.status === "pending";
                  const actor = entry.type === "income" ? entry.client : entry.supplier;

                  return (
                    <div key={entry.id} className="flex items-center gap-4 px-5 py-3 transition-colors" style={{ borderBottom: i < dayEntries.length - 1 ? "1px solid var(--border-extra-subtle)" : "none", opacity: isPending ? 0.7 : 1 }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isPending ? "var(--bg-input)" : entry.type === "income" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                        {entry.type === "income" ? (
                          <ArrowUpRight className="w-4 h-4" style={{ color: isPending ? "var(--text-muted)" : "#22c55e" }} />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" style={{ color: isPending ? "var(--text-muted)" : "#ef4444" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>{entry.description}</p>
                          {entry.recurrence && entry.recurrence !== "Unica" && entry.recurrence !== "Única" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}>
                              {entry.recurrence}
                            </span>
                          )}
                          {entry.type === "income" && entry.netAmount !== undefined && (
                            <span className="text-[9px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-1.5 py-0.5 rounded" title="Lucro Liquido Real Estimado">
                              Liquido: {formatCurrency(entry.netAmount)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: "var(--text-muted)" }}>
                          <span>{entry.category}</span>
                          {actor && (<><span className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--border-subtle)" }}></span><span>{actor}</span></>)}
                          {entry.paymentMethod && (<><span className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--border-subtle)" }}></span><span style={{ color: "var(--text-secondary)" }}>{entry.paymentMethod} {entry.installments && entry.installments > 1 ? `(${entry.installments}x)` : ""}</span></>)}
                        </p>
                      </div>

                      {isPending ? (
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-muted)" }}>{formatCurrency(entry.amount)}</span>
                          <span className="flex items-center gap-1 text-[10px] text-[#f59e0b]"><Clock className="w-3 h-3" /> A Vencer</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <p className="text-[13px]" style={{ fontWeight: 500, color: entry.type === "income" ? "#22c55e" : "#ef4444" }}>
                            {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
                          </p>
                          <span className="flex items-center gap-1 text-[10px] text-[#22c55e]"><CheckCircle2 className="w-3 h-3" /> Efetivado</span>
                        </div>
                      )}

                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        {isPending && canEditPerm && (
                          <button onClick={() => markAsPaid(entry)} className="p-1.5 rounded-lg transition-all flex items-center gap-1 px-2 text-[#22c55e] hover:bg-[#22c55e]/10 border border-transparent hover:border-[#22c55e]/20" title="Marcar como Pago/Recebido">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-medium uppercase tracking-wide">Baixar</span>
                          </button>
                        )}
                        {canEditPerm && (
                          <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canAdd && (
                          <button onClick={() => openDuplicate(entry)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Duplicar">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 rounded-lg transition-all flex items-center gap-1"
                            style={{ color: "#ef4444", backgroundColor: deleteConfirm === entry.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                            title={deleteConfirm === entry.id ? "Confirmar exclusao" : "Excluir"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleteConfirm === entry.id && <span className="text-[9px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}