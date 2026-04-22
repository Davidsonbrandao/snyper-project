import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, Pencil, Copy } from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, formatDate, type AccountType, type AccountStatus } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput } from "./ui/currency-input";
import { DatePickerInput } from "./ui/date-picker-input";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
const thStyle: React.CSSProperties = { fontWeight: 500, color: "var(--text-muted)" };

export function AccountsPage() {
  const { accounts, addAccount, updateAccount, updateAccountStatus, removeAccount } = useFinance();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "receivable" | "payable">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const emptyForm = { type: "receivable" as AccountType, description: "", amount: "", dueDate: "", client: "", status: "pending" as AccountStatus };
  const [form, setForm] = useState(emptyForm);

  const filtered = accounts
    .filter((a) => filter === "all" || a.type === filter)
    .filter((a) => statusFilter === "all" || a.status === statusFilter);

  const totalReceber = accounts.filter((a) => a.type === "receivable" && a.status !== "paid").reduce((s, a) => s + a.amount, 0);
  const totalPagar = accounts.filter((a) => a.type === "payable" && a.status !== "paid").reduce((s, a) => s + a.amount, 0);
  const overdue = accounts.filter((a) => a.status === "overdue");

  const openEdit = (account: typeof accounts[0]) => {
    setForm({ type: account.type, description: account.description, amount: String(account.amount), dueDate: account.dueDate, client: account.client || "", status: account.status });
    setEditingId(account.id);
    setShowForm(true);
  };

  const openDuplicate = (account: typeof accounts[0]) => {
    setForm({ type: account.type, description: account.description + " (copia)", amount: String(account.amount), dueDate: account.dueDate, client: account.client || "", status: "pending" });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.dueDate) {
      toast.error("Preencha descricao, valor e vencimento");
      return;
    }
    const data = {
      type: form.type, description: form.description, amount: parseFloat(form.amount),
      dueDate: form.dueDate, status: editingId ? form.status : ("pending" as AccountStatus),
      client: form.client || undefined,
    };
    if (editingId) { updateAccount(editingId, data); toast.success("Conta atualizada"); }
    else { addAccount(data); toast.success("Conta cadastrada"); }
    setForm(emptyForm); setEditingId(null); setShowForm(false);
  };

  const handleCancel = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) { removeAccount(id); setDeleteConfirm(null); toast.success("Conta excluida"); }
    else { setDeleteConfirm(id); setTimeout(() => setDeleteConfirm(null), 3000); }
  };

  const statusIcon = (status: AccountStatus) => {
    switch (status) {
      case "paid": return <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />;
      case "pending": return <Clock className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case "overdue": return <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" />;
    }
  };
  const statusLabel = (status: AccountStatus) => {
    switch (status) { case "paid": return "Pago"; case "pending": return "Pendente"; case "overdue": return "Atrasado"; }
  };
  const statusColor = (status: AccountStatus) => {
    switch (status) {
      case "paid": return { bg: "rgba(34,197,94,0.12)", text: "#22c55e" };
      case "pending": return { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" };
      case "overdue": return { bg: "rgba(239,68,68,0.12)", text: "#ef4444" };
    }
  };

  const typeOptions = [
    { value: "receivable", label: "A Receber" },
    { value: "payable", label: "A Pagar" }
  ];
  const statusOptions = [
    { value: "pending", label: "Pendente" },
    { value: "paid", label: "Pago" },
    { value: "overdue", label: "Atrasado" }
  ];

  if (!can("contas", "view")) return <NoAccessPage />;

  const canAdd = can("contas", "add");
  const canEditPerm = can("contas", "edit");
  const canDelete = can("contas", "delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Contas</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Contas a pagar e a receber</p>
        </div>
        {canAdd && (
          <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(!showForm); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: "Total a Receber", value: formatCurrency(totalReceber), icon: ArrowUpRight, iconColor: "#22c55e", valueColor: "#22c55e" },
          { label: "Total a Pagar", value: formatCurrency(totalPagar), icon: ArrowDownRight, iconColor: "#ef4444", valueColor: "#ef4444" },
          { label: "Contas Atrasadas", value: String(overdue.length), icon: AlertTriangle, iconColor: "#f59e0b", valueColor: "#f59e0b", sub: `${formatCurrency(overdue.reduce((s, a) => s + a.amount, 0))} em atraso` },
        ]).map(c => (
          <div key={c.label} className="rounded-2xl p-5" style={cs}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.iconColor + "1a" }}>
                <c.icon className="w-4 h-4" style={{ color: c.iconColor }} />
              </div>
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{c.label}</span>
            </div>
            <p className="text-[22px]" style={{ fontWeight: 600, color: c.valueColor }}>{c.value}</p>
            {c.sub && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4" style={{ ...cs, border: "2px solid var(--accent)" }}>
          <h3 className="text-[15px] mb-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{editingId ? "Editar Conta" : "Adicionar Conta"}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Tipo</label>
              <CustomSelect options={typeOptions} value={form.type} onChange={(val) => setForm({ ...form, type: val as AccountType })} />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Cliente (opcional)</label>
              <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Nome do cliente" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Descricao</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} placeholder="Descricao da conta" />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Valor (R$)</label>
              <CurrencyInput value={form.amount} onChange={(val) => setForm({ ...form, amount: val })} placeholder="0,00" />
            </div>
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Vencimento</label>
              <DatePickerInput value={form.dueDate} onChange={(val) => setForm({ ...form, dueDate: val })} placeholder="Selecionar data" />
            </div>
          </div>
          {editingId && (
            <div>
              <label className="text-[12px] block mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
              <div className="w-48">
                <CustomSelect options={statusOptions} value={form.status} onChange={(val) => setForm({ ...form, status: val as AccountStatus })} />
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button type="submit" className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
              {editingId ? "Atualizar" : "Salvar"}
            </button>
            <button type="button" onClick={handleCancel} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={cs}>
          {([
            { key: "all", label: "Todas" },
            { key: "receivable", label: "A Receber" },
            { key: "payable", label: "A Pagar" },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} className="px-4 py-2 rounded-lg text-[12px] transition-all" style={{ fontWeight: filter === tab.key ? 500 : 400, backgroundColor: filter === tab.key ? "var(--accent)" : "transparent", color: filter === tab.key ? "var(--accent-foreground)" : "var(--text-secondary)" }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={cs}>
          {([
            { key: "all", label: "Todos" },
            { key: "pending", label: "Pendente" },
            { key: "paid", label: "Pago" },
            { key: "overdue", label: "Atrasado" },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)} className="px-3 py-2 rounded-lg text-[12px] transition-all" style={{ fontWeight: statusFilter === tab.key ? 500 : 400, backgroundColor: statusFilter === tab.key ? "var(--bg-hover)" : "transparent", color: statusFilter === tab.key ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={cs}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Descricao</th>
              <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Tipo</th>
              <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Vencimento</th>
              <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Status</th>
              <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Valor</th>
              <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={thStyle}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((account) => {
              const sc = statusColor(account.status);
              return (
                <tr key={account.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{account.description}</span>
                    {account.client && <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{account.client}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-[12px]" style={{ color: account.type === "receivable" ? "#22c55e" : "#ef4444" }}>
                      {account.type === "receivable" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {account.type === "receivable" ? "Receber" : "Pagar"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                    {formatDate(account.dueDate)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full" style={{ fontWeight: 500, backgroundColor: sc.bg, color: sc.text }}>
                      {statusIcon(account.status)}
                      {statusLabel(account.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(account.amount)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEditPerm && (
                        <button onClick={() => openEdit(account)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canAdd && (
                        <button onClick={() => openDuplicate(account)} className="p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Duplicar">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canEditPerm && account.status !== "paid" && (
                        <button onClick={() => { updateAccountStatus(account.id, "paid"); toast.success("Conta marcada como paga"); }} className="p-1.5 rounded-lg transition-all text-[#22c55e] hover:bg-[#22c55e]/10" title="Marcar como pago">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="p-1.5 rounded-lg transition-all flex items-center gap-1"
                          style={{ color: "#ef4444", backgroundColor: deleteConfirm === account.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                          title={deleteConfirm === account.id ? "Confirmar exclusao" : "Excluir"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deleteConfirm === account.id && <span className="text-[9px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}