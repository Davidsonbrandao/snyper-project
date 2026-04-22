import { useState, useMemo, useCallback } from "react";
import {
  Plus, Trash2, Briefcase, Calculator, Clock, DollarSign, Pencil, Copy,
  ShieldAlert, ShieldCheck, Tag, Percent, CreditCard, RefreshCw, ChevronDown,
  ChevronUp, FileText, Target, TrendingUp, X, BarChart3, Layers, Zap, AlertTriangle,
} from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, SERVICE_CATEGORIES, generateId, getPartnerMonthlyCost } from "../lib/finance-data";
import type { Service, ServiceCost } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput, PercentInput } from "./ui/currency-input";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const DELIVERY_TYPES = [
  { value: "unique", label: "Entrega Unica" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "recurring", label: "Recorrente" },
];

const INTEREST_OPTIONS = [
  { value: "client", label: "Cliente" },
  { value: "company", label: "Empresa" },
];

const CPA_TYPES = [
  { value: "R$", label: "R$" },
  { value: "%", label: "%" },
];

const DISCOUNT_TYPES = [
  { value: "%", label: "%" },
  { value: "R$", label: "R$" },
];

interface FormState {
  name: string;
  category: string;
  description: string;
  priceDisplay: string;
  discountType: "%" | "R$";
  discountValue: string;
  cashDiscountPercent: string;
  maxInstallments: string;
  interestBearer: "client" | "company";
  deliveryType: "unique" | "weekly" | "monthly" | "recurring";
  minDeliveryDays: string;
  maxDeliveryDays: string;
  costs: ServiceCost[];
  cpaMeta: string;
  cpaMetaType: "R$" | "%";
  marketingPercentage: string;
}

const emptyForm: FormState = {
  name: "",
  category: SERVICE_CATEGORIES[0],
  description: "",
  priceDisplay: "",
  discountType: "%",
  discountValue: "",
  cashDiscountPercent: "",
  maxInstallments: "12",
  interestBearer: "client",
  deliveryType: "unique",
  minDeliveryDays: "",
  maxDeliveryDays: "",
  costs: [],
  cpaMeta: "",
  cpaMetaType: "R$",
  marketingPercentage: "10",
};

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

export function ServicesPage() {
  const { services, addService, updateService, removeService, expenses, variableParams, partners } = useFinance();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const companyMarkup = useMemo(() => {
    const fixedExpenses = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
    const partnerTotal = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
    const varPercent = variableParams.filter(v => v.active && v.unit === "%" && v.type !== "profit_margin" && v.type !== "card_fee").reduce((s, v) => s + v.value, 0);
    const desiredMargin = variableParams.find(v => v.type === "profit_margin" && v.active)?.value || 20;
    return { fixedExpenses, partnerTotal, varPercent, desiredMargin };
  }, [expenses, partners, variableParams]);

  const calcPricesForService = useCallback((priceDisplay: number, discountType: "%" | "R$", discountValue: number, cashDiscountPercent: number, totalCosts: number) => {
    const discountAmount = discountType === "%" ? priceDisplay * (discountValue / 100) : discountValue;
    const priceMinInstallment = priceDisplay - discountAmount;
    const priceMinCash = priceMinInstallment * (1 - cashDiscountPercent / 100);
    const { varPercent, desiredMargin } = companyMarkup;
    const contributionMargin = 1 - (varPercent / 100) - (desiredMargin / 100);
    const suggestedPrice = contributionMargin > 0 ? totalCosts / contributionMargin : totalCosts * 2.5;
    const isMinRisky = priceMinInstallment < suggestedPrice * 0.7;
    const isCashRisky = priceMinCash < suggestedPrice * 0.6;
    return { priceMinInstallment, priceMinCash, suggestedPrice, isMinRisky, isCashRisky, discountAmount };
  }, [companyMarkup]);

  const openEdit = (service: Service) => {
    setForm({
      name: service.name,
      category: service.category,
      description: service.description || "",
      priceDisplay: String(service.priceDisplay),
      discountType: service.discountType || "%",
      discountValue: String(service.discountValue || 0),
      cashDiscountPercent: String(service.cashDiscountPercent || 0),
      maxInstallments: String(service.maxInstallments || 12),
      interestBearer: service.interestBearer || "client",
      deliveryType: service.deliveryType || "unique",
      minDeliveryDays: String(service.minDeliveryDays || ""),
      maxDeliveryDays: String(service.maxDeliveryDays || ""),
      costs: service.costs || [],
      cpaMeta: String(service.cpaMeta || ""),
      cpaMetaType: service.cpaMetaType || "R$",
      marketingPercentage: String(service.marketingPercentage),
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  const openDuplicate = (service: Service) => {
    openEdit({ ...service, name: service.name + " (copia)", id: "" });
    setEditingId(null);
  };

  const addCost = () => {
    setForm(prev => ({ ...prev, costs: [...prev.costs, { id: generateId(), name: "", amount: 0 }] }));
  };

  const updateCost = (id: string, field: "name" | "amount", value: any) => {
    setForm(prev => ({
      ...prev,
      costs: prev.costs.map(c => c.id === id ? { ...c, [field]: field === "amount" ? parseFloat(value) || 0 : value } : c),
    }));
  };

  const removeCost = (id: string) => {
    setForm(prev => ({ ...prev, costs: prev.costs.filter(c => c.id !== id) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.priceDisplay) {
      toast.error("Preencha o nome e o preco vitrine");
      return;
    }

    const priceDisplay = parseFloat(form.priceDisplay) || 0;
    const discountValue = parseFloat(form.discountValue) || 0;
    const cashDiscountPercent = parseFloat(form.cashDiscountPercent) || 0;
    const totalCosts = form.costs.reduce((s, c) => s + c.amount, 0);
    const { priceMinInstallment } = calcPricesForService(priceDisplay, form.discountType, discountValue, cashDiscountPercent, totalCosts);

    const data: Omit<Service, "id"> = {
      name: form.name,
      category: form.category,
      description: form.description,
      priceDisplay,
      priceMinimum: priceMinInstallment,
      averageTime: form.minDeliveryDays && form.maxDeliveryDays
        ? `${form.minDeliveryDays}-${form.maxDeliveryDays} dias`
        : form.minDeliveryDays ? `${form.minDeliveryDays} dias` : "",
      variableCost: totalCosts,
      variableCostIsPercentage: false,
      marketingPercentage: parseFloat(form.marketingPercentage) || 10,
      costs: form.costs.filter(c => c.name),
      minDeliveryDays: parseInt(form.minDeliveryDays) || 0,
      maxDeliveryDays: parseInt(form.maxDeliveryDays) || 0,
      discountType: form.discountType,
      discountValue,
      cashDiscountPercent,
      maxInstallments: parseInt(form.maxInstallments) || 12,
      interestBearer: form.interestBearer,
      deliveryType: form.deliveryType,
      cpaMeta: parseFloat(form.cpaMeta) || 0,
      cpaMetaType: form.cpaMetaType,
    };

    if (editingId) {
      updateService(editingId, data);
      toast.success("Servico atualizado com sucesso");
    } else {
      addService(data);
      toast.success("Servico cadastrado com sucesso");
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    removeService(id);
    setDeleteConfirm(null);
    toast.success("Servico excluido");
  };

  const ticketMedio = useMemo(() => {
    if (services.length === 0) return 0;
    return services.map(svc => svc.priceDisplay).reduce((s, n) => s + n, 0) / services.length;
  }, [services]);

  const avgMargin = useMemo(() => {
    if (services.length === 0) return 0;
    const totalMargin = services
      .map((svc) => {
        const costs = svc.costs?.reduce((cs, c) => cs + c.amount, 0) || svc.variableCost || 0;
        const mkt = (svc.priceDisplay * svc.marketingPercentage) / 100;
        return ((svc.priceDisplay - costs - mkt) / (svc.priceDisplay || 1)) * 100;
      })
      .reduce((s, n) => s + n, 0);
    return totalMargin / services.length;
  }, [services]);

  const avgDeliveryFromSales = useMemo(() => {
    const withDays = services.filter(s => s.minDeliveryDays && s.maxDeliveryDays);
    if (withDays.length === 0) return null;
    const avg = withDays.reduce((s, svc) => s + ((svc.minDeliveryDays || 0) + (svc.maxDeliveryDays || 0)) / 2, 0) / withDays.length;
    return Math.round(avg);
  }, [services]);

  const formPrices = useMemo(() => {
    const priceDisplay = parseFloat(form.priceDisplay) || 0;
    const discountValue = parseFloat(form.discountValue) || 0;
    const cashDiscount = parseFloat(form.cashDiscountPercent) || 0;
    const totalCosts = form.costs.reduce((s, c) => s + c.amount, 0);
    return calcPricesForService(priceDisplay, form.discountType, discountValue, cashDiscount, totalCosts);
  }, [form.priceDisplay, form.discountType, form.discountValue, form.cashDiscountPercent, form.costs, calcPricesForService]);

  const avgDays = useMemo(() => {
    const min = parseInt(form.minDeliveryDays) || 0;
    const max = parseInt(form.maxDeliveryDays) || 0;
    if (min && max) return Math.round((min + max) / 2);
    return null;
  }, [form.minDeliveryDays, form.maxDeliveryDays]);

  const categoryOptions = SERVICE_CATEGORIES.map(c => ({ value: c, label: c }));

  if (!can("servicos", "view")) return <NoAccessPage />;

  const canAdd = can("servicos", "add");
  const canEditPerm = can("servicos", "edit");
  const canDelete = can("servicos", "delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Catalogo de Servicos</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Precificacao estrategica dos seus servicos</p>
        </div>
        {canAdd && (
          <button
            onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition-colors text-[13px]"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Novo Servico
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: "Servicos Cadastrados", value: String(services.length), icon: Briefcase, iconColor: "var(--accent)" },
          { label: "Ticket Medio Vitrine", value: formatCurrency(ticketMedio), icon: DollarSign, iconColor: "#3b82f6" },
          { label: "Margem Media", value: `${avgMargin.toFixed(0)}%`, icon: TrendingUp, iconColor: "#22c55e", valueColor: avgMargin > 40 ? "#22c55e" : avgMargin > 20 ? "#f59e0b" : "#ef4444" },
          { label: "Prazo Medio", value: avgDeliveryFromSales ? `${avgDeliveryFromSales} dias` : "---", icon: Clock, iconColor: "#f59e0b" },
        ]).map(card => (
          <div key={card.label} className="rounded-2xl p-5" style={cs}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: card.iconColor === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : `${card.iconColor}1a` }}>
                <card.icon className="w-4 h-4" style={{ color: card.iconColor }} />
              </div>
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{card.label}</span>
            </div>
            <p className="text-[22px]" style={{ fontWeight: 600, color: (card as any).valueColor || "var(--text-primary)" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl overflow-hidden" style={{ ...cs, border: "2px solid var(--accent)" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              {editingId ? "Editar Servico" : "Cadastrar Servico"}
            </h3>
            <button type="button" onClick={handleCancel} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome do Servico</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: Site Institucional" />
              </div>
              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Categoria</label>
                <CustomSelect searchable options={categoryOptions} value={form.category} onChange={(val) => setForm({ ...form, category: val })} />
              </div>
              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Tipo de Entrega</label>
                <CustomSelect options={DELIVERY_TYPES} value={form.deliveryType} onChange={(val) => setForm({ ...form, deliveryType: val as any })} />
              </div>
            </div>

            {/* Row 2 */}
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Descricao do Servico</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={isStyle} placeholder="Descreva o que esta incluso no servico..." />
            </div>

            {/* Row 3: Prazos */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Prazo Minimo (dias)</label>
                <input type="number" value={form.minDeliveryDays} onChange={(e) => setForm({ ...form, minDeliveryDays: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: 15" />
              </div>
              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Prazo Maximo (dias)</label>
                <input type="number" value={form.maxDeliveryDays} onChange={(e) => setForm({ ...form, maxDeliveryDays: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: 45" />
              </div>
              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Prazo Medio (calculado)</label>
                <div className="w-full rounded-xl px-4 py-2.5 text-[13px]" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-extra-subtle)", color: "var(--text-muted)" }}>
                  {avgDays ? `${avgDays} dias` : "Preencha min e max"}
                </div>
              </div>
            </div>

            {/* Row 4: Custos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Layers className="w-3.5 h-3.5" /> Custos Fixos do Servico
                </label>
                <button type="button" onClick={addCost} className="flex items-center gap-1 text-[11px] transition-colors" style={{ color: "var(--accent)" }}>
                  <Plus className="w-3 h-3" /> Adicionar custo
                </button>
              </div>
              {form.costs.length === 0 && (
                <p className="text-[11px] italic py-2" style={{ color: "var(--text-muted)", opacity: 0.6 }}>Nenhum custo cadastrado. Ex: servidor, licenca, plugins...</p>
              )}
              <div className="space-y-2">
                {form.costs.map((cost) => (
                  <div key={cost.id} className="flex items-center gap-2">
                    <input value={cost.name} onChange={(e) => updateCost(cost.id, "name", e.target.value)} className="flex-1 rounded-xl px-3 py-2 text-[13px] focus:outline-none" style={isStyle} placeholder="Nome do custo (ex: Servidor)" />
                    <div className="w-[160px]">
                      <CurrencyInput value={String(cost.amount)} onChange={(val) => updateCost(cost.id, "amount", val)} placeholder="0,00" />
                    </div>
                    <button type="button" onClick={() => removeCost(cost.id)} className="p-2 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {form.costs.length > 0 && (
                <div className="flex items-center justify-end mt-2 text-[12px]">
                  <span className="mr-2" style={{ color: "var(--text-secondary)" }}>Total de custos:</span>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(form.costs.reduce((s, c) => s + c.amount, 0))}</span>
                </div>
              )}
            </div>

            {/* Row 5: Pricing */}
            <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-extra-subtle)" }}>
              <h4 className="text-[13px] flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                <Tag className="w-4 h-4" style={{ color: "var(--accent)" }} /> Precificacao
              </h4>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Preco Vitrine</label>
                  <CurrencyInput value={form.priceDisplay} onChange={(val) => setForm({ ...form, priceDisplay: val })} placeholder="0,00" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Desconto Maximo</label>
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                      {form.discountType === "%" ? (
                        <PercentInput value={form.discountValue} onChange={(val) => setForm({ ...form, discountValue: val })} placeholder="0" />
                      ) : (
                        <CurrencyInput value={form.discountValue} onChange={(val) => setForm({ ...form, discountValue: val })} placeholder="0,00" />
                      )}
                    </div>
                    <div className="w-[70px]">
                      <CustomSelect options={DISCOUNT_TYPES} value={form.discountType} onChange={(val) => setForm({ ...form, discountType: val as any })} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Desconto a Vista</label>
                  <PercentInput value={form.cashDiscountPercent} onChange={(val) => setForm({ ...form, cashDiscountPercent: val })} placeholder="0" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>% Marketing / CPA</label>
                  <PercentInput value={form.marketingPercentage} onChange={(val) => setForm({ ...form, marketingPercentage: val })} placeholder="10" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Parcelas Maximas</label>
                  <input type="number" value={form.maxInstallments} onChange={(e) => setForm({ ...form, maxInstallments: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="12" min="1" max="48" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Juros por conta de</label>
                  <CustomSelect options={INTEREST_OPTIONS} value={form.interestBearer} onChange={(val) => setForm({ ...form, interestBearer: val as any })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>CPA Meta</label>
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                      {form.cpaMetaType === "%" ? (
                        <PercentInput value={form.cpaMeta} onChange={(val) => setForm({ ...form, cpaMeta: val })} placeholder="0" />
                      ) : (
                        <CurrencyInput value={form.cpaMeta} onChange={(val) => setForm({ ...form, cpaMeta: val })} placeholder="0,00" />
                      )}
                    </div>
                    <div className="w-[70px]">
                      <CustomSelect options={CPA_TYPES} value={form.cpaMetaType} onChange={(val) => setForm({ ...form, cpaMetaType: val as any })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Computed prices preview */}
              {parseFloat(form.priceDisplay) > 0 && (
                <div className="grid grid-cols-4 gap-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-card)" }}>
                    <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Vitrine</p>
                    <p className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(parseFloat(form.priceDisplay) || 0)}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-card)" }}>
                    <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Min. a Prazo</p>
                    <p className="text-[16px]" style={{ fontWeight: 600, color: formPrices.isMinRisky ? "#ef4444" : "#f59e0b" }}>
                      {formatCurrency(formPrices.priceMinInstallment)}
                    </p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-card)" }}>
                    <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Min. a Vista</p>
                    <p className="text-[16px]" style={{ fontWeight: 600, color: formPrices.isCashRisky ? "#ef4444" : "#22c55e" }}>
                      {formatCurrency(formPrices.priceMinCash)}
                    </p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid rgba(var(--accent-rgb),0.15)" }}>
                    <p className="text-[10px] mb-1" style={{ color: "var(--accent)" }}>Sugerido (Markup)</p>
                    <p className="text-[16px]" style={{ fontWeight: 600, color: "var(--accent)" }}>
                      {formatCurrency(formPrices.suggestedPrice)}
                    </p>
                  </div>
                </div>
              )}

              {formPrices.isMinRisky && parseFloat(form.priceDisplay) > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
                  <p className="text-[11px] text-[#ef4444]">
                    O preco minimo esta abaixo do sugerido pelo markup da empresa. Risco de prejuizo!
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-6 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                {editingId ? "Atualizar Servico" : "Cadastrar Servico"}
              </button>
              <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Service Cards */}
      <div className="grid grid-cols-2 gap-4">
        {services.map((service) => {
          const totalCosts = service.costs?.reduce((s, c) => s + c.amount, 0) || (service.variableCostIsPercentage ? (service.priceDisplay * service.variableCost / 100) : service.variableCost);
          const marketingCost = (service.priceDisplay * service.marketingPercentage) / 100;
          const grossMargin = service.priceDisplay - totalCosts - marketingCost;
          const marginPercent = service.priceDisplay > 0 ? (grossMargin / service.priceDisplay) * 100 : 0;
          const isSelected = selectedService === service.id;

          const { priceMinInstallment, priceMinCash, suggestedPrice, isMinRisky } = calcPricesForService(
            service.priceDisplay, service.discountType || "%", service.discountValue || 0, service.cashDiscountPercent || 0, totalCosts
          );

          const deliveryLabel = service.deliveryType === "weekly" ? "Semanal" : service.deliveryType === "monthly" ? "Mensal" : service.deliveryType === "recurring" ? "Recorrente" : "Entrega Unica";

          return (
            <div
              key={service.id}
              className="rounded-2xl transition-all cursor-pointer"
              style={{
                ...cs,
                border: isSelected ? "1px solid rgba(var(--accent-rgb),0.4)" : "1px solid var(--border-subtle)",
              }}
              onClick={() => setSelectedService(isSelected ? null : service.id)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-[14px] truncate" style={{ color: "var(--text-primary)" }}>{service.name}</h4>
                      {isMinRisky && <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>{service.category}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>{deliveryLabel}</span>
                      {service.averageTime && (
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <Clock className="w-3 h-3" />{service.averageTime}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {canEditPerm && (
                      <button onClick={(e) => { e.stopPropagation(); openEdit(service); }} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canAdd && (
                      <button onClick={(e) => { e.stopPropagation(); openDuplicate(service); }} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Duplicar">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deleteConfirm === service.id) { handleDelete(service.id); }
                          else { setDeleteConfirm(service.id); setTimeout(() => setDeleteConfirm(null), 3000); }
                        }}
                        className="p-1.5 rounded-lg transition-all flex items-center gap-1"
                        style={{ color: "#ef4444", backgroundColor: deleteConfirm === service.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                        title={deleteConfirm === service.id ? "Confirmar exclusao" : "Excluir"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deleteConfirm === service.id && <span className="text-[9px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 prices */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "var(--bg-input)" }}>
                    <span className="text-[9px] block mb-0.5 uppercase" style={{ color: "var(--text-muted)" }}>Vitrine</span>
                    <span className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(service.priceDisplay)}</span>
                  </div>
                  <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "var(--bg-input)" }}>
                    <span className="text-[9px] block mb-0.5 uppercase" style={{ color: "var(--text-muted)" }}>Min. Prazo</span>
                    <span className="text-[14px] text-[#f59e0b]" style={{ fontWeight: 600 }}>{formatCurrency(priceMinInstallment)}</span>
                  </div>
                  <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "var(--bg-input)" }}>
                    <span className="text-[9px] block mb-0.5 uppercase" style={{ color: "var(--text-muted)" }}>Min. Vista</span>
                    <span className="text-[14px] text-[#22c55e]" style={{ fontWeight: 600 }}>{formatCurrency(priceMinCash)}</span>
                  </div>
                  <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "var(--bg-input)", border: "1px solid rgba(var(--accent-rgb),0.1)" }}>
                    <span className="text-[9px] block mb-0.5 uppercase" style={{ color: "var(--accent)" }}>Sugerido</span>
                    <span className="text-[14px]" style={{ fontWeight: 600, color: "var(--accent)" }}>{formatCurrency(suggestedPrice)}</span>
                  </div>
                </div>

                {/* Margin info */}
                <div className="space-y-1.5">
                  {(service.costs?.length || 0) > 0 && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span style={{ color: "var(--text-muted)" }}>Custos ({service.costs!.length})</span>
                      <span style={{ color: "var(--text-primary)" }}>{formatCurrency(totalCosts)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[12px]">
                    <span style={{ color: "var(--text-muted)" }}>Marketing ({service.marketingPercentage}%)</span>
                    <span style={{ color: "var(--text-primary)" }}>{formatCurrency(marketingCost)}</span>
                  </div>
                  <div className="h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
                  <div className="flex items-center justify-between text-[12px]">
                    <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Margem Bruta</span>
                    <span style={{ fontWeight: 600, color: marginPercent > 50 ? "#22c55e" : marginPercent > 30 ? "#f59e0b" : "#ef4444" }}>
                      {formatCurrency(grossMargin)} ({marginPercent.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Extra info row */}
                <div className="flex items-center gap-3 mt-3 pt-3 text-[11px]" style={{ borderTop: "1px solid var(--border-extra-subtle)", color: "var(--text-muted)" }}>
                  {service.maxInstallments && (
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Ate {service.maxInstallments}x
                    </span>
                  )}
                  {service.interestBearer && (
                    <span>Juros: {service.interestBearer === "client" ? "Cliente" : "Empresa"}</span>
                  )}
                  {service.cpaMeta && service.cpaMeta > 0 && (
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" /> CPA: {service.cpaMetaType === "R$" ? formatCurrency(service.cpaMeta) : `${service.cpaMeta}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isSelected && (
                <div className="px-5 pb-5 pt-0">
                  <div className="pt-4 space-y-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    {service.description && (
                      <div>
                        <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Descricao</p>
                        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{service.description}</p>
                      </div>
                    )}

                    {(service.costs?.length || 0) > 0 && (
                      <div>
                        <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Custos Detalhados</p>
                        <div className="space-y-1">
                          {service.costs!.map(c => (
                            <div key={c.id} className="flex items-center justify-between text-[12px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--bg-input)" }}>
                              <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(c.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {service.cashDiscountPercent && service.cashDiscountPercent > 0 && (
                      <div className="flex items-center gap-2 text-[12px]">
                        <Zap className="w-3.5 h-3.5 text-[#22c55e]" />
                        <span style={{ color: "var(--text-muted)" }}>Desconto a vista: <span className="text-[#22c55e]" style={{ fontWeight: 500 }}>{service.cashDiscountPercent}%</span></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {services.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <Briefcase className="w-12 h-12 mx-auto mb-3" style={{ opacity: 0.3 }} />
          <p className="text-[14px]" style={{ fontWeight: 500 }}>Nenhum servico cadastrado</p>
          <p className="text-[12px] mt-1">Cadastre seus servicos para precificacao estrategica inteligente.</p>
        </div>
      )}
    </div>
  );
}
