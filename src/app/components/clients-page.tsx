import { useState, useMemo } from "react";
import {
  Plus, Trash2, Pencil, Search, Phone, Mail, Building2, User, MapPin,
  X, ChevronDown, ChevronUp, Users, CreditCard,
  Copy, CheckCircle2,
} from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { type Client, type ClientType, BR_STATES } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { motion, AnimatePresence } from "motion/react";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";

const stateOptions = BR_STATES.map(s => ({ value: s, label: s }));

const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
const lblStyle: React.CSSProperties = { color: "var(--text-secondary)" };

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return phone;
}

function formatDoc(doc: string, type: "cpf" | "cnpj"): string {
  const d = doc.replace(/\D/g, "");
  if (type === "cpf" && d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (type === "cnpj" && d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

function getWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

interface ClientFormState {
  type: ClientType; fullName: string; cpf: string;
  razaoSocial: string; nomeFantasia: string; cnpj: string; inscricaoMunicipal: string; contactName: string;
  email: string; phone: string;
  cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string;
  notes: string;
}

const emptyForm: ClientFormState = {
  type: "pj", fullName: "", cpf: "",
  razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoMunicipal: "", contactName: "",
  email: "", phone: "",
  cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  notes: "",
};

export function ClientsPage() {
  const { clients, addClient, updateClient, removeClient } = useFinance();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "pf" | "pj">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = clients;
    if (typeFilter !== "all") list = list.filter(c => c.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const name = c.type === "pf" ? c.fullName : (c.nomeFantasia || c.razaoSocial);
        const doc = c.type === "pf" ? c.cpf : c.cnpj;
        return (name || "").toLowerCase().includes(q) || (doc || "").includes(q) || (c.email || "").toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.city || "").toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [clients, search, typeFilter]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };

  const openEdit = (client: Client) => {
    setForm({
      type: client.type, fullName: client.fullName || "", cpf: client.cpf || "",
      razaoSocial: client.razaoSocial || "", nomeFantasia: client.nomeFantasia || "",
      cnpj: client.cnpj || "", inscricaoMunicipal: client.inscricaoMunicipal || "",
      contactName: client.contactName || "", email: client.email || "", phone: client.phone || "",
      cep: client.cep || "", street: client.street || "", number: client.number || "",
      complement: client.complement || "", neighborhood: client.neighborhood || "",
      city: client.city || "", state: client.state || "", notes: client.notes || "",
    });
    setEditingId(client.id); setShowForm(true);
  };

  const handleSave = () => {
    const isPF = form.type === "pf";
    if (isPF && !form.fullName.trim()) { toast.error("Informe o nome completo"); return; }
    if (!isPF && !form.razaoSocial.trim() && !form.nomeFantasia.trim()) { toast.error("Informe a razao social ou nome fantasia"); return; }

    const now = new Date().toISOString();
    const data: Omit<Client, "id"> = {
      type: form.type, email: form.email, phone: form.phone, notes: form.notes || undefined,
      createdAt: editingId ? (clients.find(c => c.id === editingId)?.createdAt || now) : now,
      fullName: isPF ? form.fullName : undefined, cpf: isPF ? form.cpf : undefined,
      razaoSocial: !isPF ? form.razaoSocial : undefined, nomeFantasia: !isPF ? form.nomeFantasia : undefined,
      cnpj: !isPF ? form.cnpj : undefined, inscricaoMunicipal: !isPF ? form.inscricaoMunicipal : undefined,
      contactName: !isPF ? form.contactName : undefined,
      cep: form.cep || undefined, street: form.street || undefined, number: form.number || undefined,
      complement: form.complement || undefined, neighborhood: form.neighborhood || undefined,
      city: form.city || undefined, state: form.state || undefined,
    };

    if (editingId) { updateClient(editingId, data); toast.success("Cliente atualizado"); }
    else { addClient(data); toast.success("Cliente cadastrado"); }
    setShowForm(false); setEditingId(null); setForm(emptyForm);
  };

  const canSave = form.type === "pf" ? form.fullName.trim().length > 0 : (form.razaoSocial.trim().length > 0 || form.nomeFantasia.trim().length > 0);
  const getClientName = (c: Client) => c.type === "pf" ? (c.fullName || "") : (c.nomeFantasia || c.razaoSocial || "");
  const getClientDoc = (c: Client) => c.type === "pf" ? (c.cpf ? formatDoc(c.cpf, "cpf") : "") : (c.cnpj ? formatDoc(c.cnpj, "cnpj") : "");

  const handleCopy = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); };

  const totalPF = clients.filter(c => c.type === "pf").length;
  const totalPJ = clients.filter(c => c.type === "pj").length;

  if (!can("clientes", "view")) return <NoAccessPage />;

  const canAdd = can("clientes", "add");
  const canEditPerm = can("clientes", "edit");
  const canDelete = can("clientes", "delete");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Clientes</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie sua base de clientes PF e PJ</p>
        </div>
        {canAdd && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] transition-colors" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: "Total de Clientes", value: clients.length, icon: Users, color: "var(--accent)" },
          { label: "Pessoa Fisica", value: totalPF, icon: User, color: "#3b82f6" },
          { label: "Pessoa Juridica", value: totalPJ, icon: Building2, color: "#8b5cf6" },
        ]).map((stat) => (
          <div key={stat.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.color === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : `${stat.color}15` }}>
                <stat.icon className="w-[18px] h-[18px]" style={{ color: stat.color }} />
              </div>
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{stat.label}</span>
            </div>
            <p className="text-2xl" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, documento, e-mail, telefone..." className="w-full rounded-xl py-2.5 pl-10 pr-4 text-[13px] focus:outline-none" style={isStyle} />
        </div>
        <div className="flex rounded-xl p-0.5" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
          {(["all", "pf", "pj"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className="px-4 py-2 rounded-lg text-[12px] transition-colors" style={{
              fontWeight: typeFilter === t ? 600 : 400,
              backgroundColor: typeFilter === t ? "var(--accent)" : "transparent",
              color: typeFilter === t ? "white" : "var(--text-muted)",
            }}>
              {t === "all" ? "Todos" : t === "pf" ? "PF" : "PJ"}
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }} className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{editingId ? "Editar Cliente" : "Novo Cliente"}</h2>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto custom-scrollbar p-6 space-y-5">
                {/* PF/PJ Toggle */}
                <div>
                  <label className="text-[12px] mb-2 block" style={lblStyle}>Tipo de Cliente</label>
                  <div className="flex rounded-xl p-1" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: "pf" }))} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] transition-all" style={{
                      fontWeight: form.type === "pf" ? 600 : 400,
                      backgroundColor: form.type === "pf" ? "var(--accent)" : "transparent",
                      color: form.type === "pf" ? "white" : "var(--text-muted)",
                    }}>
                      <User className="w-4 h-4" /> Pessoa Fisica
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, type: "pj" }))} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] transition-all" style={{
                      fontWeight: form.type === "pj" ? 600 : 400,
                      backgroundColor: form.type === "pj" ? "var(--accent)" : "transparent",
                      color: form.type === "pj" ? "white" : "var(--text-muted)",
                    }}>
                      <Building2 className="w-4 h-4" /> Pessoa Juridica
                    </button>
                  </div>
                </div>

                {/* PF Fields */}
                {form.type === "pf" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Nome Completo *</label>
                      <input type="text" value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Nome completo do cliente" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>CPF</label>
                      <input type="text" value={form.cpf} onChange={(e) => setForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="000.000.000-00" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                  </div>
                )}

                {/* PJ Fields */}
                {form.type === "pj" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Razao Social *</label>
                      <input type="text" value={form.razaoSocial} onChange={(e) => setForm(f => ({ ...f, razaoSocial: e.target.value }))} placeholder="Razao social da empresa" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Nome Fantasia</label>
                      <input type="text" value={form.nomeFantasia} onChange={(e) => setForm(f => ({ ...f, nomeFantasia: e.target.value }))} placeholder="Nome fantasia" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>CNPJ</label>
                      <input type="text" value={form.cnpj} onChange={(e) => setForm(f => ({ ...f, cnpj: e.target.value.replace(/\D/g, "").slice(0, 14) }))} placeholder="00.000.000/0000-00" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Inscricao Municipal</label>
                      <input type="text" value={form.inscricaoMunicipal} onChange={(e) => setForm(f => ({ ...f, inscricaoMunicipal: e.target.value }))} placeholder="Inscricao municipal" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Nome do Contato</label>
                      <input type="text" value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Pessoa de contato" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                  </div>
                )}

                {/* Contact Info */}
                <div>
                  <h3 className="text-[13px] mb-3" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Contato</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Telefone</label>
                      <input type="text" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="(00) 00000-0000" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div>
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>E-mail</label>
                      <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-[13px] mb-3" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Endereco</h3>
                  <div className="grid grid-cols-6 gap-4">
                    <div className="col-span-2">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>CEP</label>
                      <input type="text" value={form.cep} onChange={(e) => setForm(f => ({ ...f, cep: e.target.value.replace(/\D/g, "").slice(0, 8) }))} placeholder="00000-000" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Rua</label>
                      <input type="text" value={form.street} onChange={(e) => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Nome da rua" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Numero</label>
                      <input type="text" value={form.number} onChange={(e) => setForm(f => ({ ...f, number: e.target.value }))} placeholder="N" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Complemento</label>
                      <input type="text" value={form.complement} onChange={(e) => setForm(f => ({ ...f, complement: e.target.value }))} placeholder="Sala, andar..." className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Bairro</label>
                      <input type="text" value={form.neighborhood} onChange={(e) => setForm(f => ({ ...f, neighborhood: e.target.value }))} placeholder="Bairro" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Cidade</label>
                      <input type="text" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[12px] mb-1.5 block" style={lblStyle}>Estado</label>
                      <CustomSelect options={stateOptions} value={form.state} onChange={(v) => setForm(f => ({ ...f, state: v }))} placeholder="UF" searchable />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Observacoes</label>
                  <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre o cliente..." rows={3} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={isStyle} />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2.5 text-[13px] transition-colors rounded-xl" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={!canSave} className="px-6 py-2.5 rounded-xl text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  {editingId ? "Salvar Alteracoes" : "Cadastrar Cliente"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <Users className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
          <p className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-muted)" }}>
            {clients.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado encontrado"}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            {clients.length === 0 ? "Clique em \"Novo Cliente\" para comecar" : "Tente buscar com outros termos"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => {
            const name = getClientName(client);
            const doc = getClientDoc(client);
            const isExpanded = expandedId === client.id;

            return (
              <motion.div key={client.id} layout className="rounded-2xl overflow-hidden transition-colors" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                {/* Main Row */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : client.id)}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${client.type === "pf" ? "bg-[#3b82f6]/10" : "bg-[#8b5cf6]/10"}`}>
                    {client.type === "pf" ? <User className="w-[18px] h-[18px] text-[#3b82f6]" /> : <Building2 className="w-[18px] h-[18px] text-[#8b5cf6]" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{name}</p>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] ${client.type === "pf" ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "bg-[#8b5cf6]/10 text-[#8b5cf6]"}`} style={{ fontWeight: 600 }}>
                        {client.type === "pf" ? "PF" : "PJ"}
                      </span>
                    </div>
                    {doc && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{doc}</p>}
                  </div>

                  {/* Contact Quick Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {client.phone && (
                      <a href={getWhatsAppLink(client.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 rounded-lg bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors" title="Abrir WhatsApp">
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {client.email && (
                      <a href={`mailto:${client.email}`} onClick={(e) => e.stopPropagation()} className="p-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors" title="Enviar e-mail">
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {canEditPerm && (
                      <button onClick={(e) => { e.stopPropagation(); openEdit(client); }} className="p-2 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deleteConfirm === client.id) { removeClient(client.id); setDeleteConfirm(null); toast.success("Cliente excluido"); }
                          else { setDeleteConfirm(client.id); setTimeout(() => setDeleteConfirm(null), 3000); }
                        }}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: "#ef4444", backgroundColor: deleteConfirm === client.id ? "rgba(239,68,68,0.1)" : "transparent" }}
                        title={deleteConfirm === client.id ? "Clique novamente para confirmar" : "Excluir"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="ml-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-5 pb-5 pt-1" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                          {client.type === "pj" && client.contactName && <DetailItem label="Contato" value={client.contactName} icon={User} />}
                          {client.phone && <DetailItem label="Telefone" value={formatPhone(client.phone)} icon={Phone} copyable onCopy={() => handleCopy(client.phone, `phone-${client.id}`)} copied={copiedId === `phone-${client.id}`} />}
                          {client.email && <DetailItem label="E-mail" value={client.email} icon={Mail} copyable onCopy={() => handleCopy(client.email, `email-${client.id}`)} copied={copiedId === `email-${client.id}`} />}
                          {client.type === "pj" && client.inscricaoMunicipal && <DetailItem label="Inscr. Municipal" value={client.inscricaoMunicipal} icon={CreditCard} />}
                          {(client.street || client.city) && (
                            <div className="col-span-2 md:col-span-3">
                              <DetailItem label="Endereco" value={[client.street && `${client.street}${client.number ? `, ${client.number}` : ""}`, client.complement, client.neighborhood, client.city && `${client.city}${client.state ? ` - ${client.state}` : ""}`, client.cep].filter(Boolean).join(" / ")} icon={MapPin} />
                            </div>
                          )}
                          {client.notes && (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Observacoes</p>
                              <p className="text-[12px] rounded-lg p-3" style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-base)" }}>{client.notes}</p>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] mt-4" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                          Cadastrado em {new Date(client.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, icon: Icon, copyable, onCopy, copied }: {
  label: string; value: string; icon: any; copyable?: boolean; onCopy?: () => void; copied?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--bg-input)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
          {copyable && onCopy && (
            <button onClick={onCopy} className="p-0.5 rounded transition-colors shrink-0" style={{ color: "var(--text-muted)" }}>
              {copied ? <CheckCircle2 className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}