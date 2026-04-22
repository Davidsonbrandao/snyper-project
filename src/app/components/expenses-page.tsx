import { useState, useMemo } from "react";
import { Plus, Trash2, Receipt, TrendingDown, DollarSign, Pencil, Copy, Calendar, Settings2, Users, Briefcase, CreditCard, Package, Ban } from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, calculateSmartBreakEven, type Expense, type VariableParameter, type Partner, getPartnerMonthlyCost } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput, PercentInput } from "./ui/currency-input";
import { DayPickerInput } from "./ui/date-picker-input";
import { RecurrenceToggle, recurrenceConfigToString, stringToRecurrenceConfig, type RecurrenceConfig } from "./ui/recurrence-toggle";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

export function ExpensesPage() {
  const {
    expenses, addExpense, updateExpense, removeExpense,
    variableParams, addVariableParam, updateVariableParam, removeVariableParam,
    partners, addPartner, updatePartner, removePartner,
    expenseCategories, addExpenseCategory,
    recurrences, addRecurrence,
    suppliers, addSupplier,
    paymentMethods, addPaymentMethod
  } = useFinance();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<"fixed" | "variables" | "partners">("fixed");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyForm: {
    name: string;
    supplier: string;
    type: Expense["type"];
    unit: "R$" | "%";
    category: string;
    recurrence: string;
    paymentMethod: string;
    amount: string;
    dueDate: string;
    autoPost: boolean;
    description: string;
    notes: string;
  } = {
    name: "", supplier: "", type: "Fixo", unit: "R$",
    category: expenseCategories[0] || "", recurrence: recurrences[0] || "Mensal",
    paymentMethod: paymentMethods[0] || "PIX",
    amount: "", dueDate: "", autoPost: true, description: "", notes: ""
  };
  const [form, setForm] = useState(emptyForm);
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({ enabled: true, frequency: "monthly" });

  const emptyVarForm = {
    name: "", type: "tax" as "tax" | "card_fee" | "commission" | "marketing" | "profit_margin" | "custom",
    value: "", unit: "%" as "%" | "R$", incidence: "gross_revenue" as "gross_revenue" | "net_revenue" | "fixed_per_sale",
    paymentMethodRef: "", installments: "", active: true
  };
  const [varForm, setVarForm] = useState(emptyVarForm);
  const [showVarForm, setShowVarForm] = useState(false);

  const emptyPartnerForm = {
    name: "", role: "", desiredWithdrawal: "",
    type: "socio" as "socio" | "clt" | "pj" | "freelancer",
    fixedSalary: "", hasCommission: false, commissionRate: "", commissionBase: "gross" as "gross" | "net",
    payPerProduction: false, productionLabel: "", productionRate: "",
    benefitsVr: "", benefitsVa: "", benefitsVt: "", benefitsHelpCost: "", benefitsOther: "", benefitsOtherLabel: "",
    document: "", pixKey: "", bankInfo: "", paymentDay: "",
    status: "active" as "active" | "inactive",
  };
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [partnerFilter, setPartnerFilter] = useState<"all" | "socio" | "clt" | "pj" | "freelancer">("all");

  const filtered = expenses.filter((e) => filter === "all" || e.recurrence === filter);

  const totalFixedExpensesAmount = expenses.map(e => e.unit === "R$" ? e.amount : 0).reduce((s, n) => s + n, 0);
  const autoPostCount = expenses.filter((e) => e.autoPost).length;
  const totalPartnerWithdrawals = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
  const totalVariablePercent = variableParams.filter(v => v.active && v.unit === "%" && v.type !== "profit_margin" && v.type !== "card_fee").reduce((s, v) => s + v.value, 0);

  const breakEven = calculateSmartBreakEven(totalFixedExpensesAmount, totalPartnerWithdrawals, totalVariablePercent);

  const categoryOptions = expenseCategories.map(c => ({ value: c, label: c }));
  const supplierOptions = suppliers.map(s => ({ value: s, label: s }));
  const paymentMethodOptions = paymentMethods.map(p => ({ value: p, label: p }));

  const varTypeOptions = [
    { value: "tax", label: "Imposto" },
    { value: "card_fee", label: "Taxa de Cartao / Gateway" },
    { value: "commission", label: "Comissao de Venda" },
    { value: "marketing", label: "Marketing / Aquisicao" },
    { value: "profit_margin", label: "Margem de Lucro Desejada" },
    { value: "custom", label: "Outro" },
  ];

  const openEdit = (expense: Expense) => {
    setForm({
      name: expense.name, supplier: expense.supplier || "", type: expense.type || "Fixo",
      unit: expense.unit || (expense.isPercentage ? "%" : "R$"), category: expense.category,
      recurrence: expense.recurrence, paymentMethod: expense.paymentMethod || "PIX",
      amount: String(expense.amount), dueDate: expense.dueDate || "",
      autoPost: expense.autoPost ?? false, description: expense.description || "", notes: expense.notes || "",
    });
    setRecurrenceConfig(stringToRecurrenceConfig(expense.recurrence));
    setEditingId(expense.id);
    setShowForm(true);
  };

  const openDuplicate = (expense: Expense) => {
    setForm({
      name: expense.name + " (copia)", supplier: expense.supplier || "", type: expense.type || "Fixo",
      unit: expense.unit || (expense.isPercentage ? "%" : "R$"), category: expense.category,
      recurrence: expense.recurrence, paymentMethod: expense.paymentMethod || "PIX",
      amount: String(expense.amount), dueDate: expense.dueDate || "",
      autoPost: expense.autoPost ?? false, description: expense.description || "", notes: expense.notes || "",
    });
    setRecurrenceConfig(stringToRecurrenceConfig(expense.recurrence));
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.amount) { toast.error("Preencha o nome e o valor"); return; }
    const recStr = recurrenceConfigToString(recurrenceConfig);
    const data = {
      name: form.name, supplier: form.supplier, type: "Fixo" as const, unit: form.unit,
      isPercentage: form.unit === "%", category: form.category, recurrence: recStr,
      paymentMethod: form.paymentMethod, amount: parseFloat(form.amount), dueDate: form.dueDate,
      autoPost: form.autoPost, description: form.description, notes: form.notes,
    };
    if (editingId) { updateExpense(editingId, data); toast.success("Despesa atualizada"); }
    else { addExpense(data); toast.success("Despesa cadastrada"); }
    setForm(emptyForm); setRecurrenceConfig({ enabled: true, frequency: "monthly" }); setEditingId(null); setShowForm(false);
  };

  const handleVarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!varForm.name || !varForm.value) { toast.error("Preencha o nome e o valor"); return; }
    const data = {
      name: varForm.name, type: varForm.type, value: parseFloat(varForm.value), unit: varForm.unit,
      incidence: varForm.incidence, paymentMethodRef: varForm.paymentMethodRef,
      installments: varForm.installments ? parseInt(varForm.installments) : undefined, active: varForm.active,
    };
    if (editingId) { updateVariableParam(editingId, data); toast.success("Parametro atualizado"); }
    else { addVariableParam(data); toast.success("Parametro cadastrado"); }
    setVarForm(emptyVarForm); setEditingId(null); setShowVarForm(false);
  };

  const openVarEdit = (v: VariableParameter) => {
    setVarForm({
      name: v.name, type: v.type, value: String(v.value), unit: v.unit,
      incidence: v.incidence, paymentMethodRef: v.paymentMethodRef || "",
      installments: v.installments ? String(v.installments) : "", active: v.active
    });
    setEditingId(v.id); setShowVarForm(true);
  };

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerForm.name) { toast.error("Preencha o nome"); return; }
    const pf = partnerForm;
    const isSocio = pf.type === "socio";
    if (isSocio && !pf.desiredWithdrawal) { toast.error("Preencha a retirada (pro-labore)"); return; }
    if ((pf.type === "clt" || pf.type === "pj") && !pf.fixedSalary && !pf.payPerProduction) { toast.error("Preencha o salario fixo ou ative pagamento por producao"); return; }
    if (pf.type === "freelancer" && !pf.payPerProduction && !pf.fixedSalary) { toast.error("Freelancer precisa de valor por producao ou valor fixo"); return; }
    if (pf.payPerProduction && (!pf.productionLabel || !pf.productionRate)) { toast.error("Preencha a unidade de producao e o valor por unidade"); return; }

    const data: Omit<Partner, "id"> = {
      name: pf.name,
      role: pf.role,
      type: pf.type,
      desiredWithdrawal: parseFloat(pf.desiredWithdrawal) || 0,
      fixedSalary: parseFloat(pf.fixedSalary) || 0,
      hasCommission: pf.hasCommission,
      commissionRate: parseFloat(pf.commissionRate) || 0,
      commissionBase: pf.commissionBase,
      payPerProduction: pf.payPerProduction,
      productionLabel: pf.productionLabel,
      productionRate: parseFloat(pf.productionRate) || 0,
      benefits: {
        vr: parseFloat(pf.benefitsVr) || 0,
        va: parseFloat(pf.benefitsVa) || 0,
        vt: parseFloat(pf.benefitsVt) || 0,
        helpCost: parseFloat(pf.benefitsHelpCost) || 0,
        other: parseFloat(pf.benefitsOther) || 0,
        otherLabel: pf.benefitsOtherLabel,
      },
      document: pf.document,
      pixKey: pf.pixKey,
      bankInfo: pf.bankInfo,
      paymentDay: parseInt(pf.paymentDay) || undefined,
      status: pf.status,
    };
    if (editingId) { updatePartner(editingId, data); toast.success("Pessoa atualizada"); }
    else { addPartner(data); toast.success("Pessoa adicionada"); }
    setPartnerForm(emptyPartnerForm); setEditingId(null); setShowPartnerForm(false);
  };

  const openPartnerEdit = (p: Partner) => {
    setPartnerForm({
      name: p.name, role: p.role, desiredWithdrawal: String(p.desiredWithdrawal || ""),
      type: p.type || "socio",
      fixedSalary: String(p.fixedSalary || ""),
      hasCommission: p.hasCommission || false,
      commissionRate: String(p.commissionRate || ""),
      commissionBase: p.commissionBase || "gross",
      payPerProduction: p.payPerProduction || false,
      productionLabel: p.productionLabel || "",
      productionRate: String(p.productionRate || ""),
      benefitsVr: String(p.benefits?.vr || ""),
      benefitsVa: String(p.benefits?.va || ""),
      benefitsVt: String(p.benefits?.vt || ""),
      benefitsHelpCost: String(p.benefits?.helpCost || ""),
      benefitsOther: String(p.benefits?.other || ""),
      benefitsOtherLabel: p.benefits?.otherLabel || "",
      document: p.document || "",
      pixKey: p.pixKey || "",
      bankInfo: p.bankInfo || "",
      paymentDay: String(p.paymentDay || ""),
      status: p.status || "active",
    });
    setEditingId(p.id); setShowPartnerForm(true);
  };

  const handleCancel = () => {
    setForm(emptyForm); setVarForm(emptyVarForm); setPartnerForm(emptyPartnerForm);
    setRecurrenceConfig({ enabled: true, frequency: "monthly" });
    setEditingId(null); setShowForm(false); setShowVarForm(false); setShowPartnerForm(false);
  };

  const confirmDelete = (id: string, fn: (id: string) => void, label: string) => {
    if (deleteConfirm === id) {
      fn(id); setDeleteConfirm(null); toast.success(`${label} excluido`);
    } else {
      setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const filterTabs = useMemo(() => {
    const tabs = [{ key: "all", label: "Todas" }];
    const unique = new Set(expenses.map(e => e.recurrence));
    unique.forEach(r => { if (r) tabs.push({ key: r, label: r }); });
    return tabs;
  }, [expenses]);

  if (!can("despesas", "view")) return <NoAccessPage />;

  const canAdd = can("despesas", "add");
  const canEditPerm = can("despesas", "edit");
  const canDelete = can("despesas", "delete");

  const thStyle: React.CSSProperties = { fontWeight: 500, color: "var(--text-muted)" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Estrutura de Custos</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie despesas fixas, parametros de vendas e retiradas.</p>
        </div>

        {activeTab === "fixed" && canAdd && (
          <button onClick={() => { setEditingId(null); setForm(emptyForm); setRecurrenceConfig({ enabled: true, frequency: "monthly" }); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Nova Despesa Fixa
          </button>
        )}
        {activeTab === "variables" && canAdd && (
          <button onClick={() => { setEditingId(null); setVarForm(emptyVarForm); setShowVarForm(!showVarForm); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "#f59e0b", fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Novo Parametro
          </button>
        )}
        {activeTab === "partners" && canAdd && (
          <button onClick={() => { setEditingId(null); setPartnerForm(emptyPartnerForm); setShowPartnerForm(!showPartnerForm); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "#3b82f6", fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Adicionar Pessoa
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={cs}>
        {([
          { key: "fixed" as const, label: "Despesas Fixas", icon: Receipt },
          { key: "variables" as const, label: "Parametros e Impostos", icon: Settings2 },
          { key: "partners" as const, label: "Salarios & Retiradas", icon: Users },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowForm(false); setShowVarForm(false); setShowPartnerForm(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all"
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

      {/* ===== FIXED TAB ===== */}
      {activeTab === "fixed" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: "Custo Fixo Total Base", value: formatCurrency(totalFixedExpensesAmount), icon: Receipt, iconColor: "#ef4444" },
              { label: "Lancamentos Automaticos", value: `${autoPostCount}`, sub: "despesas", icon: Calendar, iconColor: "#f59e0b" },
              { label: "Ponto de Equilibrio", value: formatCurrency(breakEven.breakEvenRevenue), icon: DollarSign, iconColor: "#3b82f6" },
            ]).map(c => (
              <div key={c.label} className="rounded-2xl p-5" style={cs}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.iconColor + "1a" }}>
                    <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{c.label}</span>
                </div>
                <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {c.value} {c.sub && <span className="text-[14px] font-normal" style={{ color: "var(--text-muted)" }}>{c.sub}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-5" style={{ ...cs, border: "2px solid var(--accent)" }}>
              <h3 className="text-[15px] mb-4" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{editingId ? "Editar Despesa" : "Cadastrar Nova Despesa"}</h3>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome / Titulo</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: Aluguel do escritorio" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Fornecedor / Empresa</label>
                  <CustomSelect searchable allowCreate options={supplierOptions} value={form.supplier} onChange={(val) => setForm({ ...form, supplier: val })} onCreate={(val) => addSupplier(val)} placeholder="Selecione ou crie..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Categoria</label>
                  <CustomSelect searchable allowCreate options={categoryOptions} value={form.category} onChange={(val) => setForm({ ...form, category: val })} onCreate={(val) => addExpenseCategory(val)} placeholder="Selecione ou crie..." />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Forma de Pagamento</label>
                  <CustomSelect searchable allowCreate options={paymentMethodOptions} value={form.paymentMethod} onChange={(val) => setForm({ ...form, paymentMethod: val })} onCreate={(val) => addPaymentMethod(val)} placeholder="Selecione ou crie..." />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-4">
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Valor Base</label>
                  <div className="flex">
                    <button type="button" onClick={() => setForm({ ...form, unit: form.unit === "R$" ? "%" : "R$" })} className="rounded-l-xl px-3 text-[12px] shrink-0 transition-colors" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", borderRight: "none", color: "var(--text-secondary)" }}>
                      {form.unit}
                    </button>
                    {form.unit === "R$" ? (
                      <div className="flex-1"><CurrencyInput value={form.amount} onChange={(val) => setForm({ ...form, amount: val })} prefix="" className="!rounded-l-none" /></div>
                    ) : (
                      <div className="flex-1"><PercentInput value={form.amount} onChange={(val) => setForm({ ...form, amount: val })} className="!rounded-l-none" /></div>
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Vencimento</label>
                  <DayPickerInput value={form.dueDate} onChange={(val) => setForm({ ...form, dueDate: val })} placeholder="Dia do mes" />
                </div>
                <div className="col-span-5 flex items-end pb-0.5">
                  <RecurrenceToggle value={recurrenceConfig} onChange={setRecurrenceConfig} />
                </div>
              </div>

              <div>
                <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Observacoes / Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none min-h-[80px] resize-none" style={isStyle} placeholder="Informacoes adicionais, link do contrato, detalhes do fornecedor..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  {editingId ? "Atualizar Despesa" : "Salvar Despesa"}
                </button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit overflow-x-auto max-w-full custom-scrollbar" style={cs}>
            {filterTabs.map((tab) => (
              <button key={tab.key} onClick={() => setFilter(tab.key)} className="px-4 py-2 rounded-lg text-[12px] whitespace-nowrap transition-all" style={{ fontWeight: filter === tab.key ? 500 : 400, backgroundColor: filter === tab.key ? "var(--accent)" : "transparent", color: filter === tab.key ? "var(--accent-foreground)" : "var(--text-secondary)" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={cs}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Despesa Fixa</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Fornecedor</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Categoria</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Recorrencia</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Pgto / Auto</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Valor Fixo</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => (
                  <tr key={expense.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] block" style={{ color: "var(--text-primary)" }}>{expense.name}</span>
                      {expense.notes && <span className="text-[11px] line-clamp-1 mt-0.5" style={{ color: "var(--text-muted)" }}>{expense.notes}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--text-muted)" }}>{expense.supplier || "-"}</td>
                    <td className="px-5 py-3.5"><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{expense.category}</span></td>
                    <td className="px-5 py-3.5"><span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{expense.recurrence}</span></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{expense.paymentMethod || "Pix"}</span>
                        {expense.autoPost ? (
                          <span className="text-[10px] text-[#22c55e] flex items-center gap-1"><Calendar className="w-3 h-3"/> Auto</span>
                        ) : (
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>Manual</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {expense.unit === "%" || expense.isPercentage ? `${expense.amount}%` : formatCurrency(expense.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditPerm && (
                          <button onClick={() => openEdit(expense)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canAdd && (
                          <button onClick={() => openDuplicate(expense)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Duplicar">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => confirmDelete(expense.id, removeExpense, "Despesa")}
                            className="p-1.5 rounded-lg transition-all flex items-center gap-1"
                            style={{ color: "#ef4444", backgroundColor: deleteConfirm === expense.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                            title={deleteConfirm === expense.id ? "Confirmar exclusao" : "Excluir"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleteConfirm === expense.id && <span className="text-[9px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== VARIABLES TAB ===== */}
      {activeTab === "variables" && (
        <div className="space-y-6">
          {showVarForm && (
            <form onSubmit={handleVarSubmit} className="rounded-2xl p-6 space-y-5" style={{ ...cs, border: "2px solid #f59e0b" }}>
              <h3 className="text-[15px] mb-4" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{editingId ? "Editar Parametro" : "Novo Parametro Variavel"}</h3>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome da Variavel</label>
                  <input value={varForm.name} onChange={(e) => setVarForm({ ...varForm, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: Simples Nacional" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Tipo do Parametro</label>
                  <CustomSelect options={varTypeOptions} value={varForm.type} onChange={(val) => setVarForm({ ...varForm, type: val as any })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Valor</label>
                  <div className="flex">
                    <button type="button" onClick={() => setVarForm({ ...varForm, unit: varForm.unit === "R$" ? "%" : "R$" })} className="rounded-l-xl px-3 text-[12px] shrink-0 transition-colors" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", borderRight: "none", color: "var(--text-secondary)" }}>
                      {varForm.unit}
                    </button>
                    {varForm.unit === "R$" ? (
                      <div className="flex-1"><CurrencyInput value={varForm.value} onChange={(val) => setVarForm({ ...varForm, value: val })} prefix="" className="!rounded-l-none" /></div>
                    ) : (
                      <div className="flex-1"><PercentInput value={varForm.value} onChange={(val) => setVarForm({ ...varForm, value: val })} className="!rounded-l-none !pr-4" /></div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Incidencia</label>
                  <CustomSelect
                    options={[
                      { value: "gross_revenue", label: "Sobre Faturamento Bruto" },
                      { value: "net_revenue", label: "Sobre Liquido" },
                      { value: "fixed_per_sale", label: "Fixo por Venda" }
                    ]}
                    value={varForm.incidence}
                    onChange={(val) => setVarForm({ ...varForm, incidence: val as any })}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={varForm.active} onChange={(e) => setVarForm({ ...varForm, active: e.target.checked })} className="sr-only" />
                      <div className="w-5 h-5 rounded border flex items-center justify-center transition-colors" style={{ backgroundColor: varForm.active ? "#f59e0b" : "var(--bg-input)", borderColor: varForm.active ? "#f59e0b" : "var(--border-default)" }}>
                        {varForm.active && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>Variavel Ativa</span>
                  </label>
                </div>
              </div>

              {varForm.type === "card_fee" && (
                <div className="grid grid-cols-2 gap-5 p-4 rounded-xl" style={{ backgroundColor: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)" }}>
                  <div>
                    <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Meio de Pagamento Especifico</label>
                    <CustomSelect options={[{ value: "", label: "Qualquer / Todos" }, ...paymentMethodOptions]} value={varForm.paymentMethodRef} onChange={(val) => setVarForm({ ...varForm, paymentMethodRef: val })} placeholder="Ex: Cartao de Credito" />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Numero de Parcelas (Opcional)</label>
                    <input type="text" inputMode="numeric" value={varForm.installments} onChange={(e) => setVarForm({ ...varForm, installments: e.target.value.replace(/\D/g, "") })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: 12" />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-5 py-2.5 bg-[#f59e0b] text-white rounded-xl hover:bg-[#f59e0b]/90 transition-colors text-[13px]" style={{ fontWeight: 500 }}>
                  {editingId ? "Atualizar Parametro" : "Salvar Parametro"}
                </button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl overflow-hidden" style={cs}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Parametro</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Tipo</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Condicao</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Taxa / Valor</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Status</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {variableParams.length === 0 ? (
                  <tr style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                    <td colSpan={6} className="px-5 py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Nenhum parametro cadastrado.
                    </td>
                  </tr>
                ) : (
                  variableParams.map((v) => (
                    <tr key={v.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                      <td className="px-5 py-3.5"><span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{v.name}</span></td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                          {varTypeOptions.find(o => o.value === v.type)?.label || v.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {v.incidence === "gross_revenue" ? "Sobre Bruto" : v.incidence === "net_revenue" ? "Sobre Liquido" : "Fixo por Venda"}
                          </span>
                          {v.type === "card_fee" && (
                            <span className="text-[10px] text-[#f59e0b]">
                              {v.paymentMethodRef || "Qualquer"} {v.installments ? `(${v.installments}x)` : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                          {v.unit === "%" ? `${v.value}%` : formatCurrency(v.value)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[11px]" style={{ color: v.active ? "#22c55e" : "var(--text-muted)" }}>
                          {v.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditPerm && (
                            <button onClick={() => openVarEdit(v)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => confirmDelete(v.id, removeVariableParam, "Parametro")}
                              className="p-1.5 rounded-lg transition-all flex items-center gap-1"
                              style={{ color: "#ef4444", backgroundColor: deleteConfirm === v.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                              title={deleteConfirm === v.id ? "Confirmar exclusao" : "Excluir"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deleteConfirm === v.id && <span className="text-[9px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== PARTNERS TAB ===== */}
      {activeTab === "partners" && (() => {
        const TYPE_LABELS: Record<string, string> = { socio: "Socio", clt: "CLT", pj: "PJ / MEI", freelancer: "Freelancer" };
        const TYPE_COLORS: Record<string, string> = { socio: "#8b5cf6", clt: "#3b82f6", pj: "#f59e0b", freelancer: "#22c55e" };
        const filteredPartners = partners.filter(p => partnerFilter === "all" || (p.type || "socio") === partnerFilter);
        const totalFixedPeople = partners.map(getPartnerMonthlyCost).reduce((s, n) => s + n, 0);
        const productionPeople = partners.filter(p => p.payPerProduction);

        return (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {([
              { label: "Total de Pessoas", value: String(partners.length), icon: Users, iconColor: "#3b82f6" },
              { label: "Custo Fixo Mensal", value: formatCurrency(totalFixedPeople), icon: DollarSign, iconColor: "#ef4444" },
              { label: "Por Producao", value: `${productionPeople.length}`, sub: "pessoas", icon: Package, iconColor: "#f59e0b" },
              { label: "Com Comissao", value: String(partners.filter(p => p.hasCommission).length), icon: Briefcase, iconColor: "#8b5cf6" },
            ]).map(c => (
              <div key={c.label} className="rounded-2xl p-5" style={cs}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.iconColor + "1a" }}>
                    <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{c.label}</span>
                </div>
                <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {c.value} {c.sub && <span className="text-[14px] font-normal" style={{ color: "var(--text-muted)" }}>{c.sub}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Form */}
          {showPartnerForm && (
            <form onSubmit={handlePartnerSubmit} className="rounded-2xl p-6 space-y-5" style={{ ...cs, border: "2px solid #3b82f6" }}>
              <h3 className="text-[15px] mb-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{editingId ? "Editar Pessoa" : "Adicionar Pessoa"}</h3>

              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Tipo de Vinculo</label>
                  <CustomSelect options={[
                    { value: "socio", label: "Socio / Pro-labore" },
                    { value: "clt", label: "Funcionario CLT" },
                    { value: "pj", label: "Prestador PJ / MEI" },
                    { value: "freelancer", label: "Freelancer / Sob Demanda" },
                  ]} value={partnerForm.type} onChange={(val) => setPartnerForm({ ...partnerForm, type: val as any })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Nome Completo</label>
                  <input value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Nome da pessoa" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Cargo / Funcao</label>
                  <input value={partnerForm.role} onChange={(e) => setPartnerForm({ ...partnerForm, role: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: Editor de Video, Diretor..." />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {partnerForm.type === "socio" ? (
                  <div>
                    <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Retirada / Pro-labore</label>
                    <CurrencyInput value={partnerForm.desiredWithdrawal} onChange={(val) => setPartnerForm({ ...partnerForm, desiredWithdrawal: val })} />
                  </div>
                ) : (
                  <div>
                    <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Salario / Valor Fixo Mensal</label>
                    <CurrencyInput value={partnerForm.fixedSalary} onChange={(val) => setPartnerForm({ ...partnerForm, fixedSalary: val })} />
                  </div>
                )}
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Dia de Pagamento</label>
                  <input type="text" inputMode="numeric" value={partnerForm.paymentDay} onChange={(e) => setPartnerForm({ ...partnerForm, paymentDay: e.target.value.replace(/\D/g, "").slice(0, 2) })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: 5, 10, 15..." />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" checked={partnerForm.status === "active"} onChange={(e) => setPartnerForm({ ...partnerForm, status: e.target.checked ? "active" : "inactive" })} className="sr-only" />
                      <div className="w-5 h-5 rounded border flex items-center justify-center transition-colors" style={{ backgroundColor: partnerForm.status === "active" ? "#22c55e" : "var(--bg-input)", borderColor: partnerForm.status === "active" ? "#22c55e" : "var(--border-default)" }}>
                        {partnerForm.status === "active" && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>Ativo</span>
                  </label>
                </div>
              </div>

              {/* Pagamento por producao */}
              <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)" }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={partnerForm.payPerProduction} onChange={(e) => setPartnerForm({ ...partnerForm, payPerProduction: e.target.checked })} className="sr-only" />
                    <div className="w-5 h-5 rounded border flex items-center justify-center transition-colors" style={{ backgroundColor: partnerForm.payPerProduction ? "#f59e0b" : "var(--bg-input)", borderColor: partnerForm.payPerProduction ? "#f59e0b" : "var(--border-default)" }}>
                      {partnerForm.payPerProduction && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Pagamento por Producao / Demanda</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>- valor por unidade produzida</span>
                </label>
                {partnerForm.payPerProduction && (
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Unidade de Producao</label>
                      <input value={partnerForm.productionLabel} onChange={(e) => setPartnerForm({ ...partnerForm, productionLabel: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Ex: video editado, post criado, arte..." />
                    </div>
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Valor por Unidade (R$)</label>
                      <CurrencyInput value={partnerForm.productionRate} onChange={(val) => setPartnerForm({ ...partnerForm, productionRate: val })} />
                    </div>
                  </div>
                )}
              </div>

              {/* Comissao */}
              <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.1)" }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="relative flex items-center justify-center">
                    <input type="checkbox" checked={partnerForm.hasCommission} onChange={(e) => setPartnerForm({ ...partnerForm, hasCommission: e.target.checked })} className="sr-only" />
                    <div className="w-5 h-5 rounded border flex items-center justify-center transition-colors" style={{ backgroundColor: partnerForm.hasCommission ? "#8b5cf6" : "var(--bg-input)", borderColor: partnerForm.hasCommission ? "#8b5cf6" : "var(--border-default)" }}>
                      {partnerForm.hasCommission && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Recebe Comissao sobre Vendas</span>
                </label>
                {partnerForm.hasCommission && (
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Taxa de Comissao (%)</label>
                      <PercentInput value={partnerForm.commissionRate} onChange={(val) => setPartnerForm({ ...partnerForm, commissionRate: val })} />
                    </div>
                    <div>
                      <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Base de Calculo</label>
                      <CustomSelect options={[
                        { value: "gross", label: "Sobre Faturamento Bruto" },
                        { value: "net", label: "Sobre Liquido" },
                      ]} value={partnerForm.commissionBase} onChange={(val) => setPartnerForm({ ...partnerForm, commissionBase: val as any })} />
                    </div>
                  </div>
                )}
              </div>

              {/* Beneficios - only for CLT/PJ */}
              {(partnerForm.type === "clt" || partnerForm.type === "pj") && (
                <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)" }}>
                  <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Beneficios Mensais</p>
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Vale Refeicao</label>
                      <CurrencyInput value={partnerForm.benefitsVr} onChange={(val) => setPartnerForm({ ...partnerForm, benefitsVr: val })} />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Vale Alimentacao</label>
                      <CurrencyInput value={partnerForm.benefitsVa} onChange={(val) => setPartnerForm({ ...partnerForm, benefitsVa: val })} />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Vale Transporte</label>
                      <CurrencyInput value={partnerForm.benefitsVt} onChange={(val) => setPartnerForm({ ...partnerForm, benefitsVt: val })} />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Ajuda de Custo</label>
                      <CurrencyInput value={partnerForm.benefitsHelpCost} onChange={(val) => setPartnerForm({ ...partnerForm, benefitsHelpCost: val })} />
                    </div>
                    <div>
                      <label className="text-[11px] block mb-1" style={{ color: "var(--text-secondary)" }}>Outros</label>
                      <CurrencyInput value={partnerForm.benefitsOther} onChange={(val) => setPartnerForm({ ...partnerForm, benefitsOther: val })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Dados fiscais */}
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>CPF / CNPJ</label>
                  <input value={partnerForm.document} onChange={(e) => setPartnerForm({ ...partnerForm, document: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Documento" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Chave PIX</label>
                  <input value={partnerForm.pixKey} onChange={(e) => setPartnerForm({ ...partnerForm, pixKey: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="CPF, e-mail, telefone..." />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Dados Bancarios</label>
                  <input value={partnerForm.bankInfo} onChange={(e) => setPartnerForm({ ...partnerForm, bankInfo: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Banco, agencia, conta..." />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-5 py-2.5 bg-[#3b82f6] text-white rounded-xl hover:bg-[#3b82f6]/90 transition-colors text-[13px]" style={{ fontWeight: 500 }}>
                  {editingId ? "Atualizar" : "Salvar"}
                </button>
                <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={cs}>
            {([
              { key: "all" as const, label: "Todos" },
              { key: "socio" as const, label: "Socios" },
              { key: "clt" as const, label: "CLT" },
              { key: "pj" as const, label: "PJ / MEI" },
              { key: "freelancer" as const, label: "Freelancers" },
            ]).map(f => (
              <button key={f.key} onClick={() => setPartnerFilter(f.key)} className="px-4 py-2 rounded-lg text-[12px] transition-all" style={{ fontWeight: partnerFilter === f.key ? 500 : 400, backgroundColor: partnerFilter === f.key ? "#3b82f6" : "transparent", color: partnerFilter === f.key ? "#fff" : "var(--text-secondary)" }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={cs}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Pessoa</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Vinculo</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Remuneracao</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Producao</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Custo Mensal</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.length === 0 ? (
                  <tr style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                    <td colSpan={6} className="px-5 py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Nenhuma pessoa cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((p) => {
                    const pType = p.type || "socio";
                    const monthlyCost = getPartnerMonthlyCost(p);
                    return (
                    <tr key={p.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-extra-subtle)", opacity: p.status === "inactive" ? 0.5 : 1 }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px]" style={{ backgroundColor: TYPE_COLORS[pType] + "1a", color: TYPE_COLORS[pType], fontWeight: 600 }}>
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[13px] block" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.role}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[pType] + "1a", color: TYPE_COLORS[pType], fontWeight: 500 }}>
                          {TYPE_LABELS[pType]}
                        </span>
                        {p.status === "inactive" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Inativo</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          {pType === "socio" && p.desiredWithdrawal > 0 && (
                            <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>Pro-labore: {formatCurrency(p.desiredWithdrawal)}</span>
                          )}
                          {pType !== "socio" && (p.fixedSalary || 0) > 0 && (
                            <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>Fixo: {formatCurrency(p.fixedSalary || 0)}</span>
                          )}
                          {p.hasCommission && (
                            <span className="text-[11px]" style={{ color: "#8b5cf6" }}>Comissao: {p.commissionRate}% ({p.commissionBase === "gross" ? "bruto" : "liquido"})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {p.payPerProduction ? (
                          <span className="text-[12px]" style={{ color: "#f59e0b" }}>{formatCurrency(p.productionRate || 0)} / {p.productionLabel || "unidade"}</span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(monthlyCost)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditPerm && (
                            <button onClick={() => openPartnerEdit(p)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => confirmDelete(p.id, removePartner, "Pessoa")}
                              className="p-1.5 rounded-lg transition-all flex items-center gap-1"
                              style={{ color: "#ef4444", backgroundColor: deleteConfirm === p.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                              title={deleteConfirm === p.id ? "Confirmar exclusao" : "Excluir"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deleteConfirm === p.id && <span className="text-[9px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
