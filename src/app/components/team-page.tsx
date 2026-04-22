import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Trash2, Users, Mail, Phone, Shield, UserPlus, Loader2, CheckCircle2,
  Pencil, MessageCircle, Percent, ExternalLink, MapPin, CreditCard, Key,
  User, Star, Copy, Link2, Check, X, Eye, FilePlus, FileEdit, Ban,
  ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, LayoutGrid, Settings2,
  ArrowRight, Lock, Unlock, Search, AlertTriangle, RefreshCw,
} from "lucide-react";
import { apiFetch } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, generateId, type CommissionMember } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput, PercentInput } from "./ui/currency-input";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage } from "./permission-gate";
import { toast } from "sonner";

// ========== Types ==========
interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "member";
  status: "active" | "invited";
  createdAt: string;
  profileId?: string;
}

interface ModulePermission {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

interface AccessProfile {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  permissions: Record<string, ModulePermission>;
}

// System modules for permission matrix
const SYSTEM_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clientes", label: "Clientes" },
  { key: "pipeline", label: "Pipeline de Vendas" },
  { key: "projetos", label: "Projetos" },
  { key: "lancamentos", label: "Lancamentos" },
  { key: "despesas", label: "Despesas" },
  { key: "contas", label: "Contas a Pagar/Receber" },
  { key: "servicos", label: "Servicos" },
  { key: "marketing", label: "Marketing" },
  { key: "metas", label: "Metas" },
  { key: "notas_fiscais", label: "Notas Fiscais" },
  { key: "equipe", label: "Equipe" },
];

const PERMISSION_LABELS: Record<keyof ModulePermission, { label: string; icon: any; color: string }> = {
  view: { label: "Visualizar", icon: Eye, color: "#3b82f6" },
  add: { label: "Adicionar", icon: FilePlus, color: "#22c55e" },
  edit: { label: "Editar", icon: FileEdit, color: "#f59e0b" },
  delete: { label: "Excluir", icon: Trash2, color: "#ef4444" },
};

function createFullPermissions(): Record<string, ModulePermission> {
  const perms: Record<string, ModulePermission> = {};
  SYSTEM_MODULES.forEach(m => {
    perms[m.key] = { view: true, add: true, edit: true, delete: true };
  });
  return perms;
}

function createViewOnlyPermissions(): Record<string, ModulePermission> {
  const perms: Record<string, ModulePermission> = {};
  SYSTEM_MODULES.forEach(m => {
    perms[m.key] = { view: true, add: false, edit: false, delete: false };
  });
  return perms;
}

function createEditorPermissions(): Record<string, ModulePermission> {
  const perms: Record<string, ModulePermission> = {};
  SYSTEM_MODULES.forEach(m => {
    perms[m.key] = { view: true, add: true, edit: true, delete: false };
  });
  perms["equipe"] = { view: false, add: false, edit: false, delete: false };
  return perms;
}

const DEFAULT_PROFILES: AccessProfile[] = [
  {
    id: "profile_admin",
    name: "Administrador",
    description: "Acesso total a todos os modulos do sistema",
    isDefault: true,
    permissions: createFullPermissions(),
  },
  {
    id: "profile_editor",
    name: "Editor",
    description: "Pode visualizar, adicionar e editar, sem permissao para excluir",
    permissions: createEditorPermissions(),
  },
  {
    id: "profile_viewer",
    name: "Visualizador",
    description: "Apenas visualizacao, sem permissao para alterar dados",
    permissions: createViewOnlyPermissions(),
  },
];

// ========== Phone mask ==========
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

// ========== Commission labels ==========
const commissionTypeLabels: Record<string, string> = {
  vendedor: "Vendedor(a)",
  influenciador: "Influenciador(a)",
  indicador: "Indicador(a)",
  parceiro: "Parceiro(a)",
};

const commissionTypeOptions = [
  { value: "vendedor", label: "Vendedor(a)" },
  { value: "influenciador", label: "Influenciador(a)" },
  { value: "indicador", label: "Indicador(a)" },
  { value: "parceiro", label: "Parceiro(a)" },
];

const commissionModeOptions = [
  { value: "unique", label: "Comissao unica para tudo" },
  { value: "per_service", label: "Comissao diferente por servico" },
];

const incidenceOptions = [
  { value: "gross_revenue", label: "Sobre Bruto" },
  { value: "net_revenue", label: "Sobre Liquido" },
];

// ========== Local Storage ==========
const PROFILES_KEY = "@pilar:access_profiles";

function loadProfiles(): AccessProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_PROFILES;
}

function saveProfiles(profiles: AccessProfile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event("profiles-updated"));
  apiFetch("/profiles", {
    method: "POST",
    body: JSON.stringify({ profiles }),
  }).catch((err) => console.error("Erro ao salvar perfis no servidor:", err));
}

// ========== Styles helpers ==========
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
const labelStyle: React.CSSProperties = { color: "var(--text-secondary)" };

// ========== Main Component ==========
export function TeamPage() {
  const { user } = useAuth();
  const { services, commissionMembers, addCommissionMember, updateCommissionMember, removeCommissionMember } = useFinance();
  const { can } = usePermissions();

  // System users tab
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", profileId: "profile_editor" });

  // Post-invite dialog
  const [inviteResult, setInviteResult] = useState<{
    name: string;
    email: string;
    activationLink: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete confirm for members
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState<string | null>(null);

  // Edit member profile
  const [editingMemberProfile, setEditingMemberProfile] = useState<string | null>(null);
  const [memberProfileValue, setMemberProfileValue] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Commission tab
  const [activeTab, setActiveTab] = useState<"users" | "commission" | "profiles">("users");
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Access Profiles
  const [profiles, setProfiles] = useState<AccessProfile[]>(loadProfiles);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [deleteProfileConfirm, setDeleteProfileConfirm] = useState<string | null>(null);
  const [deleteCommConfirm, setDeleteCommConfirm] = useState<string | null>(null);

  // Track if profiles have been modified locally (avoid saving on mount)
  const [profilesDirty, setProfilesDirty] = useState(false);

  // Persist profiles only when dirty
  useEffect(() => {
    if (profilesDirty) {
      saveProfiles(profiles);
      setProfilesDirty(false);
    }
  }, [profiles, profilesDirty]);

  const updateProfiles = (updater: (prev: AccessProfile[]) => AccessProfile[]) => {
    setProfiles(updater);
    setProfilesDirty(true);
  };

  const emptyCommissionForm = {
    name: "", phone: "", email: "", address: "", bankAccount: "", pixKey: "",
    type: "vendedor" as CommissionMember["type"],
    commissionMode: "unique" as CommissionMember["commissionMode"],
    defaultRate: "", defaultIncidence: "gross_revenue" as "gross_revenue" | "net_revenue",
    serviceRates: [] as { serviceId: string; rate: number; incidence: "gross_revenue" | "net_revenue" }[],
    active: true,
  };
  const [commForm, setCommForm] = useState(emptyCommissionForm);

  // Load members
  const loadMembers = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch("/team");
      setMembers(data.members || []);
    } catch (err) {
      console.error("Erro ao carregar membros da equipe:", err);
      toast.error("Erro ao carregar membros da equipe");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Profile options for the invite form
  const profileOptions = useMemo(() =>
    profiles.map(p => ({ value: p.id, label: p.name })),
    [profiles]
  );

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.phone && m.phone.includes(q))
    );
  }, [members, searchQuery]);

  // ========== Invite Handlers ==========
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do membro");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Informe o e-mail do membro");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/team/invite", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          profileId: form.profileId,
        }),
      });

      const baseUrl = window.location.origin;
      const activationLink = `${baseUrl}/?login=${encodeURIComponent(form.email)}`;

      setInviteResult({
        name: form.name,
        email: form.email,
        activationLink,
      });

      setForm({ name: "", email: "", phone: "", profileId: "profile_editor" });
      setShowForm(false);
      toast.success(`Membro ${form.name} cadastrado com sucesso!`);
      loadMembers();
    } catch (err: any) {
      console.error("Erro ao convidar membro:", err);
      const msg = err?.message || "Erro desconhecido";
      if (msg.includes("already been registered") || msg.includes("already exists")) {
        toast.error("Este e-mail ja esta cadastrado no sistema");
      } else {
        toast.error("Erro ao convidar membro: " + msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await apiFetch(`/team/${memberId}`, { method: "DELETE" });
      setDeleteMemberConfirm(null);
      toast.success("Membro removido com sucesso");
      loadMembers();
    } catch (err: any) {
      console.error("Erro ao remover membro:", err);
      toast.error("Erro ao remover membro: " + (err?.message || "erro desconhecido"));
    }
  };

  const handleUpdateMemberProfile = async (memberId: string, profileId: string) => {
    try {
      await apiFetch(`/team/${memberId}/profile`, {
        method: "PUT",
        body: JSON.stringify({ profileId }),
      });
      setEditingMemberProfile(null);
      toast.success("Perfil do membro atualizado");
      loadMembers();
    } catch (err: any) {
      console.error("Erro ao atualizar perfil do membro:", err);
      toast.error("Erro ao atualizar perfil: " + (err?.message || "erro desconhecido"));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const openWhatsAppInvite = (phone: string, name: string, link: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const number = cleaned.startsWith("55") ? cleaned : "55" + cleaned;
    const message = encodeURIComponent(
      `Ola ${name}! Voce foi convidado(a) para acessar nosso sistema de gestao financeira.\n\n` +
      `Para ativar sua conta e acessar o sistema, clique no link abaixo:\n${link}\n\n` +
      `Basta informar seu e-mail no campo de login e pronto! Bem-vindo(a) a equipe!`
    );
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
  };

  // ========== Commission handlers ==========
  const handleCommissionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commForm.name.trim()) {
      toast.error("Informe o nome do comissionado");
      return;
    }
    const data: Omit<CommissionMember, "id"> = {
      name: commForm.name,
      phone: commForm.phone,
      email: commForm.email,
      address: commForm.address,
      bankAccount: commForm.bankAccount,
      pixKey: commForm.pixKey,
      type: commForm.type,
      commissionMode: commForm.commissionMode,
      defaultRate: parseFloat(commForm.defaultRate) || 0,
      defaultIncidence: commForm.defaultIncidence,
      serviceRates: commForm.commissionMode === "per_service" ? commForm.serviceRates : undefined,
      active: commForm.active,
    };
    if (editingCommissionId) {
      updateCommissionMember(editingCommissionId, data);
      toast.success("Comissionado atualizado com sucesso");
    } else {
      addCommissionMember(data);
      toast.success("Comissionado cadastrado com sucesso");
    }
    setCommForm(emptyCommissionForm);
    setEditingCommissionId(null);
    setShowCommissionForm(false);
  };

  const openCommissionEdit = (m: CommissionMember) => {
    setCommForm({
      name: m.name,
      phone: m.phone,
      email: m.email,
      address: m.address || "",
      bankAccount: m.bankAccount || "",
      pixKey: m.pixKey || "",
      type: m.type,
      commissionMode: m.commissionMode,
      defaultRate: String(m.defaultRate),
      defaultIncidence: m.defaultIncidence,
      serviceRates: m.serviceRates || [],
      active: m.active,
    });
    setEditingCommissionId(m.id);
    setShowCommissionForm(true);
  };

  const cancelCommission = () => {
    setCommForm(emptyCommissionForm);
    setEditingCommissionId(null);
    setShowCommissionForm(false);
  };

  const addServiceRate = () => {
    const availableServices = services.filter(s => !commForm.serviceRates.find(r => r.serviceId === s.id));
    if (availableServices.length === 0) {
      toast.error("Todos os servicos ja foram adicionados");
      return;
    }
    setCommForm({
      ...commForm,
      serviceRates: [...commForm.serviceRates, { serviceId: availableServices[0].id, rate: 0, incidence: "gross_revenue" }],
    });
  };

  const updateServiceRate = (index: number, field: string, value: any) => {
    const updated = [...commForm.serviceRates];
    updated[index] = { ...updated[index], [field]: value };
    setCommForm({ ...commForm, serviceRates: updated });
  };

  const removeServiceRate = (index: number) => {
    setCommForm({ ...commForm, serviceRates: commForm.serviceRates.filter((_, i) => i !== index) });
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    const number = cleaned.startsWith("55") ? cleaned : "55" + cleaned;
    window.open(`https://wa.me/${number}`, "_blank");
  };

  // ========== Profile Handlers ==========
  const openNewProfile = () => {
    setEditingProfile({
      id: generateId(),
      name: "",
      description: "",
      permissions: createViewOnlyPermissions(),
    });
    setShowProfileForm(true);
  };

  const openEditProfile = (profile: AccessProfile) => {
    const perms = { ...profile.permissions };
    SYSTEM_MODULES.forEach(m => {
      if (!perms[m.key]) {
        perms[m.key] = { view: false, add: false, edit: false, delete: false };
      }
    });
    setEditingProfile({ ...profile, permissions: perms });
    setShowProfileForm(true);
  };

  const duplicateProfile = (profile: AccessProfile) => {
    const newProfile: AccessProfile = {
      ...profile,
      id: generateId(),
      name: `${profile.name} (Copia)`,
      isDefault: false,
    };
    updateProfiles(prev => [...prev, newProfile]);
    toast.success(`Perfil "${profile.name}" duplicado`);
  };

  const removeProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile?.isDefault) return;
    // Check if any member is using this profile
    const membersUsingProfile = members.filter(m => m.profileId === profileId);
    if (membersUsingProfile.length > 0) {
      toast.error(`Este perfil esta sendo usado por ${membersUsingProfile.length} membro(s). Altere o perfil dos membros antes de excluir.`);
      setDeleteProfileConfirm(null);
      return;
    }
    updateProfiles(prev => prev.filter(p => p.id !== profileId));
    setDeleteProfileConfirm(null);
    toast.success("Perfil excluido com sucesso");
  };

  const saveProfile = () => {
    if (!editingProfile || !editingProfile.name.trim()) {
      toast.error("Informe o nome do perfil");
      return;
    }
    const isNew = !profiles.find(p => p.id === editingProfile.id);
    updateProfiles(prev => {
      const exists = prev.find(p => p.id === editingProfile.id);
      if (exists) {
        return prev.map(p => p.id === editingProfile.id ? editingProfile : p);
      }
      return [...prev, editingProfile];
    });
    setEditingProfile(null);
    setShowProfileForm(false);
    toast.success(isNew ? "Perfil criado com sucesso" : "Perfil atualizado com sucesso");
  };

  const togglePermission = (moduleKey: string, action: keyof ModulePermission) => {
    if (!editingProfile) return;
    setEditingProfile(prev => {
      if (!prev) return prev;
      const currentPerms = prev.permissions[moduleKey] || { view: false, add: false, edit: false, delete: false };
      const newValue = !currentPerms[action];

      if (action === "view" && !newValue) {
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [moduleKey]: { view: false, add: false, edit: false, delete: false },
          },
        };
      }

      if (action !== "view" && newValue) {
        return {
          ...prev,
          permissions: {
            ...prev.permissions,
            [moduleKey]: { ...currentPerms, [action]: true, view: true },
          },
        };
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleKey]: { ...currentPerms, [action]: newValue },
        },
      };
    });
  };

  const toggleAllModule = (moduleKey: string) => {
    if (!editingProfile) return;
    const currentPerms = editingProfile.permissions[moduleKey];
    const allEnabled = currentPerms && currentPerms.view && currentPerms.add && currentPerms.edit && currentPerms.delete;
    const newPerms = allEnabled
      ? { view: false, add: false, edit: false, delete: false }
      : { view: true, add: true, edit: true, delete: true };
    setEditingProfile(prev => prev ? {
      ...prev,
      permissions: { ...prev.permissions, [moduleKey]: newPerms },
    } : prev);
  };

  const toggleAllPermission = (action: keyof ModulePermission) => {
    if (!editingProfile) return;
    const allEnabled = SYSTEM_MODULES.every(m => editingProfile.permissions[m.key]?.[action]);
    setEditingProfile(prev => {
      if (!prev) return prev;
      const newPerms = { ...prev.permissions };
      SYSTEM_MODULES.forEach(m => {
        const current = newPerms[m.key] || { view: false, add: false, edit: false, delete: false };
        if (action === "view") {
          if (allEnabled) {
            newPerms[m.key] = { view: false, add: false, edit: false, delete: false };
          } else {
            newPerms[m.key] = { ...current, view: true };
          }
        } else {
          newPerms[m.key] = {
            ...current,
            [action]: !allEnabled,
            view: !allEnabled ? true : current.view,
          };
        }
      });
      return { ...prev, permissions: newPerms };
    });
  };

  const getProfileName = (profileId?: string) => {
    if (!profileId) return "Sem perfil";
    const profile = profiles.find(p => p.id === profileId);
    return profile?.name || "Perfil removido";
  };

  const adminCount = members.filter((m) => m.role === "admin").length;
  const memberCount = members.filter((m) => m.role === "member").length;

  if (!can("equipe", "view")) return <NoAccessPage />;

  const canAdd = can("equipe", "add");
  const canEdit = can("equipe", "edit");
  const canDelete = can("equipe", "delete");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Equipe</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie usuarios, perfis de acesso e comissionados</p>
        </div>
        {activeTab === "users" && canAdd && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition-colors text-[13px]"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
          >
            <UserPlus className="w-4 h-4" />
            Convidar Membro
          </button>
        )}
        {activeTab === "commission" && canAdd && (
          <button
            onClick={() => { setEditingCommissionId(null); setCommForm(emptyCommissionForm); setShowCommissionForm(!showCommissionForm); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e] text-white rounded-xl hover:bg-[#22c55e]/90 transition-colors text-[13px]"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            Novo Comissionado
          </button>
        )}
        {activeTab === "profiles" && canAdd && (
          <button
            onClick={openNewProfile}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#a855f7] text-white rounded-xl hover:bg-[#a855f7]/90 transition-colors text-[13px]"
            style={{ fontWeight: 500 }}
          >
            <ShieldCheck className="w-4 h-4" />
            Novo Perfil
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        {([
          { key: "users" as const, label: "Usuarios", icon: Users },
          { key: "profiles" as const, label: "Perfis de Acesso", icon: Shield },
          { key: "commission" as const, label: "Comissionados", icon: Percent },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all"
            style={{
              backgroundColor: activeTab === t.key ? "var(--accent)" : "transparent",
              color: activeTab === t.key ? "var(--accent-foreground)" : "var(--text-secondary)",
              fontWeight: activeTab === t.key ? 500 : 400,
            }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== INVITE RESULT DIALOG ========== */}
      {inviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
              </div>
              <div>
                <h3 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Membro Cadastrado</h3>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{inviteResult.name} ({inviteResult.email})</p>
              </div>
            </div>

            <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Link de Ativacao</span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Envie este link para o usuario acessar o sistema. Ele precisara informar o e-mail cadastrado para fazer login.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg px-3 py-2 text-[12px] truncate" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-secondary)", border: "1px solid var(--border-extra-subtle)" }}>
                  {inviteResult.activationLink}
                </div>
                <button
                  onClick={() => copyToClipboard(inviteResult.activationLink)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] transition-all"
                  style={{
                    backgroundColor: copiedLink ? "rgba(34,197,94,0.1)" : "rgba(var(--accent-rgb),0.1)",
                    color: copiedLink ? "#22c55e" : "var(--accent)",
                    fontWeight: 500,
                  }}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {inviteResult && (
                <button
                  onClick={() => {
                    const phone = members.find(m => m.email === inviteResult.email)?.phone || "";
                    if (phone) {
                      openWhatsAppInvite(phone, inviteResult.name, inviteResult.activationLink);
                    } else {
                      const message = encodeURIComponent(
                        `Ola ${inviteResult.name}! Voce foi convidado(a) para acessar nosso sistema de gestao financeira.\n\n` +
                        `Para ativar sua conta, acesse: ${inviteResult.activationLink}\n\n` +
                        `Basta informar seu e-mail no campo de login e pronto! Bem-vindo(a) a equipe!`
                      );
                      window.open(`https://wa.me/?text=${message}`, "_blank");
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e]/10 text-[#22c55e] rounded-xl hover:bg-[#22c55e]/20 transition-colors text-[13px]"
                  style={{ fontWeight: 500 }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Enviar via WhatsApp
                </button>
              )}
              <button
                onClick={() => {
                  const mailTo = `mailto:${inviteResult.email}?subject=${encodeURIComponent("Convite - Sistema de Gestao Financeira")}&body=${encodeURIComponent(
                    `Ola ${inviteResult.name},\n\nVoce foi convidado(a) para acessar nosso sistema de gestao financeira.\n\nAcesse o link abaixo para ativar sua conta:\n${inviteResult.activationLink}\n\nInforme seu e-mail cadastrado no campo de login.\n\nBem-vindo(a) a equipe!`
                  )}`;
                  window.open(mailTo, "_blank");
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded-xl hover:bg-[#3b82f6]/20 transition-colors text-[13px]"
                style={{ fontWeight: 500 }}
              >
                <Mail className="w-4 h-4" />
                Enviar por E-mail
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { setInviteResult(null); setCopiedLink(false); }}
                className="px-4 py-2.5 rounded-xl transition-colors text-[13px]"
                style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== USERS TAB ========== */}
      {activeTab === "users" && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                  <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Total de Membros</span>
              </div>
              <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{members.length}</p>
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#a855f7]/10 flex items-center justify-center"><Shield className="w-4 h-4 text-[#a855f7]" /></div>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Administradores</span>
              </div>
              <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{adminCount}</p>
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center"><UserPlus className="w-4 h-4 text-[#3b82f6]" /></div>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Colaboradores</span>
              </div>
              <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{memberCount}</p>
            </div>
          </div>

          {showForm && canAdd && (
            <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "2px solid var(--accent)" }}>
              <h3 className="text-[15px] mb-2" style={{ color: "var(--text-primary)", fontWeight: 500 }}>Convidar Novo Membro</h3>
              <p className="text-[12px] -mt-1" style={{ color: "var(--text-secondary)" }}>
                O membro sera cadastrado e podera acessar o sistema via Magic Link.
                Apos o cadastro, voce recebera o link de ativacao para enviar ao usuario.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Nome Completo</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="Nome do membro" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>E-mail</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="email@exemplo.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Telefone / WhatsApp</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} maxLength={15} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Perfil de Acesso</label>
                  <CustomSelect
                    options={profileOptions}
                    value={form.profileId}
                    onChange={(val) => setForm({ ...form, profileId: val })}
                    placeholder="Selecione o perfil"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-colors text-[13px] disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Cadastrar e Gerar Link
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Cancelar</button>
              </div>
            </form>
          )}

          {/* Search bar */}
          {members.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone..."
                className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none"
                style={inputStyle}
              />
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Membro</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Contato</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Perfil</th>
                  <th className="text-left px-5 py-3 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Status</th>
                  <th className="text-right px-5 py-3 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--text-muted)" }} /></td></tr>
                ) : filteredMembers.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                    <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      {searchQuery ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"}
                    </p>
                  </td></tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="transition-colors hover:brightness-105" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px]" style={{
                            fontWeight: 600,
                            backgroundColor: member.role === "admin" ? "rgba(var(--accent-rgb),0.1)" : "rgba(59,130,246,0.1)",
                            color: member.role === "admin" ? "var(--accent)" : "#3b82f6"
                          }}>
                            {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{member.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] block" style={{ color: "var(--text-secondary)" }}>{member.email}</span>
                        {member.phone && <span className="text-[11px] block" style={{ color: "var(--text-muted)" }}>{member.phone}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {member.role === "admin" ? (
                          <span className="text-[11px] px-2.5 py-1 rounded-full" style={{ fontWeight: 500, backgroundColor: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)" }}>
                            Administrador
                          </span>
                        ) : editingMemberProfile === member.id ? (
                          <div className="flex items-center gap-1">
                            <div className="w-32">
                              <CustomSelect
                                options={profileOptions}
                                value={memberProfileValue}
                                onChange={(val) => setMemberProfileValue(val)}
                              />
                            </div>
                            <button onClick={() => handleUpdateMemberProfile(member.id, memberProfileValue)} className="p-1 rounded-md text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors" title="Salvar">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingMemberProfile(null)} className="p-1 rounded-md hover:bg-white/[0.06] transition-colors" style={{ color: "var(--text-muted)" }} title="Cancelar">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (!canEdit) return;
                              setEditingMemberProfile(member.id);
                              setMemberProfileValue(member.profileId || "profile_editor");
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors group"
                            style={{ fontWeight: 500, backgroundColor: "rgba(168,85,247,0.12)", color: "#a855f7", cursor: canEdit ? "pointer" : "default" }}
                            title={canEdit ? "Clique para alterar o perfil" : ""}
                            disabled={!canEdit}
                          >
                            {getProfileName(member.profileId)}
                            {canEdit && <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] px-2.5 py-1 rounded-full" style={{
                          fontWeight: 500,
                          backgroundColor: member.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                          color: member.status === "active" ? "#22c55e" : "#f59e0b"
                        }}>
                          {member.status === "active" ? "Ativo" : "Convidado"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {member.phone && (
                            <button onClick={() => openWhatsApp(member.phone)} className="p-1.5 rounded-lg text-[#22c55e]/60 hover:text-[#22c55e] hover:bg-[#22c55e]/10 transition-all" title="WhatsApp">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {member.role !== "admin" && canDelete && (
                            <button
                              onClick={() => {
                                if (deleteMemberConfirm === member.id) {
                                  handleRemove(member.id);
                                } else {
                                  setDeleteMemberConfirm(member.id);
                                  setTimeout(() => setDeleteMemberConfirm(null), 3000);
                                }
                              }}
                              className={`flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all ${
                                deleteMemberConfirm === member.id
                                  ? "bg-[#ef4444]/15 text-[#ef4444] ring-1 ring-[#ef4444]/30"
                                  : "text-[#ef4444]/40 hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                              }`}
                              title={deleteMemberConfirm === member.id ? "Clique para confirmar" : "Remover membro"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deleteMemberConfirm === member.id && (
                                <span className="text-[10px] whitespace-nowrap animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>
                              )}
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
        </>
      )}

      {/* ========== ACCESS PROFILES TAB ========== */}
      {activeTab === "profiles" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#a855f7]/10 flex items-center justify-center"><Shield className="w-4 h-4 text-[#a855f7]" /></div>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Total de Perfis</span>
              </div>
              <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{profiles.length}</p>
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                  <Lock className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Perfis Padrao</span>
              </div>
              <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{profiles.filter(p => p.isDefault).length}</p>
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center"><Unlock className="w-4 h-4 text-[#22c55e]" /></div>
                <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Perfis Customizados</span>
              </div>
              <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{profiles.filter(p => !p.isDefault).length}</p>
            </div>
          </div>

          {/* Profile Form / Editor */}
          {showProfileForm && editingProfile && canEdit && (
            <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: "var(--bg-card)", border: "2px solid #a855f7" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                  {profiles.find(p => p.id === editingProfile.id) ? "Editar Perfil" : "Novo Perfil de Acesso"}
                </h3>
                <button onClick={() => { setShowProfileForm(false); setEditingProfile(null); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Nome do Perfil</label>
                  <input
                    value={editingProfile.name}
                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                    style={inputStyle}
                    placeholder="Ex: Gerente, Analista, Estagiario..."
                  />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Descricao</label>
                  <input
                    value={editingProfile.description}
                    onChange={(e) => setEditingProfile({ ...editingProfile, description: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                    style={inputStyle}
                    placeholder="Breve descricao das permissoes"
                  />
                </div>
              </div>

              {/* Permissions Matrix */}
              <div className="p-4 bg-[#a855f7]/5 border border-[#a855f7]/10 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-[#a855f7]" />
                  <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Matriz de Permissoes</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)", minWidth: 180 }}>Modulo</th>
                        {Object.entries(PERMISSION_LABELS).map(([key, config]) => {
                          const allEnabled = SYSTEM_MODULES.every(m => editingProfile.permissions[m.key]?.[key as keyof ModulePermission]);
                          return (
                            <th key={key} className="text-center px-2 py-2 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)", minWidth: 90 }}>
                              <button
                                onClick={() => toggleAllPermission(key as keyof ModulePermission)}
                                className="flex items-center gap-1 mx-auto transition-colors"
                                title={`Marcar/desmarcar todos: ${config.label}`}
                              >
                                <config.icon className="w-3 h-3" style={{ color: config.color }} />
                                {config.label}
                              </button>
                            </th>
                          );
                        })}
                        <th className="text-center px-2 py-2 text-[11px] uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Todos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SYSTEM_MODULES.map((mod) => {
                        const perms = editingProfile.permissions[mod.key] || { view: false, add: false, edit: false, delete: false };
                        const allEnabled = perms.view && perms.add && perms.edit && perms.delete;
                        const noneEnabled = !perms.view && !perms.add && !perms.edit && !perms.delete;
                        return (
                          <tr key={mod.key} className="transition-colors" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
                            <td className="px-3 py-2.5">
                              <span className="text-[13px]" style={{ color: "var(--text-primary)" }}>{mod.label}</span>
                            </td>
                            {(Object.keys(PERMISSION_LABELS) as (keyof ModulePermission)[]).map((action) => (
                              <td key={action} className="text-center px-2 py-2.5">
                                <button
                                  onClick={() => togglePermission(mod.key, action)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto"
                                  style={{
                                    backgroundColor: perms[action] ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                                    boxShadow: perms[action] ? `0 0 0 1px ${PERMISSION_LABELS[action].color}40` : "none",
                                  }}
                                >
                                  {perms[action] ? (
                                    <Check className="w-3.5 h-3.5" style={{ color: PERMISSION_LABELS[action].color }} />
                                  ) : (
                                    <X className="w-3 h-3" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                                  )}
                                </button>
                              </td>
                            ))}
                            <td className="text-center px-2 py-2.5">
                              <button
                                onClick={() => toggleAllModule(mod.key)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all mx-auto"
                                style={{
                                  backgroundColor: allEnabled ? "rgba(168,85,247,0.1)" : noneEnabled ? "rgba(255,255,255,0.02)" : "rgba(245,158,11,0.1)",
                                  boxShadow: allEnabled ? "0 0 0 1px rgba(168,85,247,0.3)" : noneEnabled ? "none" : "0 0 0 1px rgba(245,158,11,0.2)",
                                }}
                              >
                                {allEnabled ? (
                                  <Check className="w-3.5 h-3.5 text-[#a855f7]" />
                                ) : noneEnabled ? (
                                  <X className="w-3 h-3" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                                ) : (
                                  <span className="w-2 h-0.5 bg-[#f59e0b] rounded-full" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={saveProfile}
                  disabled={!editingProfile.name.trim()}
                  className="px-5 py-2.5 bg-[#a855f7] text-white rounded-xl hover:bg-[#a855f7]/90 transition-colors text-[13px] disabled:opacity-50"
                  style={{ fontWeight: 500 }}
                >
                  {profiles.find(p => p.id === editingProfile.id) ? "Salvar Alteracoes" : "Criar Perfil"}
                </button>
                <button onClick={() => { setShowProfileForm(false); setEditingProfile(null); }} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Profiles List */}
          <div className="space-y-3">
            {profiles.map((profile) => {
              const enabledModules = SYSTEM_MODULES.filter(m => profile.permissions[m.key]?.view).length;
              const totalPerms = SYSTEM_MODULES.reduce((sum, m) => {
                const p = profile.permissions[m.key];
                if (!p) return sum;
                return sum + (p.view ? 1 : 0) + (p.add ? 1 : 0) + (p.edit ? 1 : 0) + (p.delete ? 1 : 0);
              }, 0);
              const maxPerms = SYSTEM_MODULES.length * 4;
              const permPercent = Math.round((totalPerms / maxPerms) * 100);
              const membersUsing = members.filter(m => m.profileId === profile.id).length;

              return (
                <div key={profile.id} className="rounded-2xl overflow-hidden" style={cardStyle}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      profile.isDefault ? "" : "bg-[#a855f7]/10"
                    }`} style={profile.isDefault ? { backgroundColor: "rgba(var(--accent-rgb),0.1)" } : {}}>
                      {profile.isDefault ? (
                        <ShieldCheck className="w-5 h-5" style={{ color: "var(--accent)" }} />
                      ) : (
                        <Shield className="w-5 h-5 text-[#a855f7]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{profile.name}</span>
                        {profile.isDefault && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ fontWeight: 600, backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)" }}>PADRAO</span>
                        )}
                        {membersUsing > 0 && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
                            {membersUsing} membro{membersUsing !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{profile.description || "Sem descricao"}</p>
                    </div>

                    <div className="text-right shrink-0 mr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${permPercent}%`,
                              backgroundColor: permPercent === 100 ? "#22c55e" : permPercent > 50 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{permPercent}%</span>
                      </div>
                      <span className="text-[11px] mt-0.5 block" style={{ color: "var(--text-secondary)" }}>{enabledModules}/{SYSTEM_MODULES.length} modulos</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <button
                          onClick={() => openEditProfile(profile)}
                          className="p-2 rounded-lg transition-all"
                          style={{ color: "var(--text-muted)" }}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {canAdd && (
                        <button
                          onClick={() => duplicateProfile(profile)}
                          className="p-2 rounded-lg text-[#3b82f6]/60 hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
                          title="Duplicar perfil"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      {!profile.isDefault && canDelete && (
                        <button
                          onClick={() => {
                            if (deleteProfileConfirm === profile.id) {
                              removeProfile(profile.id);
                            } else {
                              setDeleteProfileConfirm(profile.id);
                              setTimeout(() => setDeleteProfileConfirm(null), 3000);
                            }
                          }}
                          className={`flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all ${
                            deleteProfileConfirm === profile.id
                              ? "bg-[#ef4444]/15 text-[#ef4444] ring-1 ring-[#ef4444]/30"
                              : "text-[#ef4444]/40 hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                          }`}
                          title={deleteProfileConfirm === profile.id ? "Clique para confirmar" : "Excluir perfil"}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deleteProfileConfirm === profile.id && (
                            <span className="text-[10px] whitespace-nowrap animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Permission summary badges */}
                  <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                    {SYSTEM_MODULES.map((mod) => {
                      const perms = profile.permissions[mod.key];
                      if (!perms) return (
                        <span key={mod.key} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.03)", color: "var(--text-muted)", opacity: 0.4, textDecoration: "line-through" }}>
                          {mod.label}
                        </span>
                      );
                      const allEnabled = perms.view && perms.add && perms.edit && perms.delete;
                      const hasView = perms.view;
                      const hasAny = perms.add || perms.edit || perms.delete;

                      if (!hasView) return (
                        <span key={mod.key} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.03)", color: "var(--text-muted)", opacity: 0.4, textDecoration: "line-through" }}>
                          {mod.label}
                        </span>
                      );

                      return (
                        <span
                          key={mod.key}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: allEnabled ? "rgba(34,197,94,0.08)" : hasAny ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)",
                            color: allEnabled ? "#22c55e" : hasAny ? "#f59e0b" : "#3b82f6",
                          }}
                        >
                          {mod.label}
                          {allEnabled && " (Total)"}
                          {!allEnabled && hasAny && " (Parcial)"}
                          {!allEnabled && !hasAny && " (Leitura)"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info card */}
          <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.05), transparent)", border: "1px solid rgba(168,85,247,0.15)" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#a855f7]/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[#a855f7]" />
              </div>
              <div>
                <h3 className="text-[#a855f7] text-[14px] mb-1" style={{ fontWeight: 500 }}>Como funcionam os Perfis de Acesso</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Crie perfis com diferentes niveis de permissao para controlar o acesso da sua equipe.
                  Cada perfil define quais modulos o usuario pode <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>visualizar</span>,{" "}
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>adicionar</span>,{" "}
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>editar</span> e{" "}
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>excluir</span> dados.
                  Ao convidar um novo membro, selecione o perfil desejado. Voce pode duplicar perfis existentes para criar variacoes rapidamente.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== COMMISSION TAB ========== */}
      {activeTab === "commission" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {(["vendedor", "influenciador", "indicador", "parceiro"] as const).map((type) => {
              const count = commissionMembers.filter(m => m.type === type && m.active).length;
              const colors: Record<string, string> = { vendedor: "#22c55e", influenciador: "#a855f7", indicador: "#3b82f6", parceiro: "#f59e0b" };
              const Icons: Record<string, any> = { vendedor: User, influenciador: Star, indicador: ExternalLink, parceiro: Users };
              const Icon = Icons[type];
              return (
                <div key={type} className="rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: colors[type] + "1a" }}>
                      <Icon className="w-4 h-4" style={{ color: colors[type] }} />
                    </div>
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{commissionTypeLabels[type]}s</span>
                  </div>
                  <p className="text-[22px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{count}</p>
                </div>
              );
            })}
          </div>

          {/* Commission Form */}
          {showCommissionForm && (canAdd || editingCommissionId) && (
            <form onSubmit={handleCommissionSubmit} className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: "var(--bg-card)", border: "2px solid #22c55e" }}>
              <h3 className="text-[15px] mb-2" style={{ color: "var(--text-primary)", fontWeight: 500 }}>{editingCommissionId ? "Editar Comissionado" : "Novo Comissionado"}</h3>
              <p className="text-[12px] -mt-1" style={{ color: "var(--text-secondary)" }}>Cadastre vendedores, influenciadores, indicadores ou parceiros para calculo de comissoes.</p>
              
              {/* Row 1: Name, Type, Phone */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Nome Completo</label>
                  <input value={commForm.name} onChange={(e) => setCommForm({ ...commForm, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="Nome completo" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Tipo</label>
                  <CustomSelect options={commissionTypeOptions} value={commForm.type} onChange={(val) => setCommForm({ ...commForm, type: val as any })} />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Telefone / WhatsApp</label>
                  <input value={commForm.phone} onChange={(e) => setCommForm({ ...commForm, phone: maskPhone(e.target.value) })} maxLength={15} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="(11) 99999-9999" />
                </div>
              </div>

              {/* Row 2: Email, Address */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>E-mail</label>
                  <input type="email" value={commForm.email} onChange={(e) => setCommForm({ ...commForm, email: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Endereco (Opcional)</label>
                  <input value={commForm.address} onChange={(e) => setCommForm({ ...commForm, address: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="Cidade, Estado" />
                </div>
              </div>

              {/* Row 3: Bank, PIX */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Conta Bancaria</label>
                  <input value={commForm.bankAccount} onChange={(e) => setCommForm({ ...commForm, bankAccount: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="Banco / Ag / Conta" />
                </div>
                <div>
                  <label className="text-[12px] block mb-1.5" style={labelStyle}>Chave PIX</label>
                  <input value={commForm.pixKey} onChange={(e) => setCommForm({ ...commForm, pixKey: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} placeholder="CPF, e-mail, telefone..." />
                </div>
              </div>

              {/* Commission Config */}
              <div className="p-4 bg-[#22c55e]/5 border border-[#22c55e]/10 rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Configuracao de Comissao</span>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[12px] block mb-1.5" style={labelStyle}>Modo de Comissao</label>
                    <CustomSelect options={commissionModeOptions} value={commForm.commissionMode} onChange={(val) => setCommForm({ ...commForm, commissionMode: val as any })} />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1.5" style={labelStyle}>{commForm.commissionMode === "unique" ? "Comissao (%)" : "Comissao Padrao (%)"}</label>
                    <PercentInput value={commForm.defaultRate} onChange={(val) => setCommForm({ ...commForm, defaultRate: val })} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1.5" style={labelStyle}>Incidencia</label>
                    <CustomSelect options={incidenceOptions} value={commForm.defaultIncidence} onChange={(val) => setCommForm({ ...commForm, defaultIncidence: val as any })} />
                  </div>
                </div>

                {commForm.commissionMode === "per_service" && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Configure comissoes diferentes para cada servico:</p>
                    {commForm.serviceRates.map((sr, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <CustomSelect
                            options={services.map(s => ({ value: s.id, label: s.name }))}
                            value={sr.serviceId}
                            onChange={(val) => updateServiceRate(i, "serviceId", val)}
                            placeholder="Selecione o servico"
                          />
                        </div>
                        <div className="w-24">
                          <PercentInput value={String(sr.rate)} onChange={(val) => updateServiceRate(i, "rate", parseFloat(val) || 0)} placeholder="%" />
                        </div>
                        <div className="w-36">
                          <CustomSelect options={incidenceOptions} value={sr.incidence} onChange={(val) => updateServiceRate(i, "incidence", val)} />
                        </div>
                        <button type="button" onClick={() => removeServiceRate(i)} className="p-2 text-[#ef4444]/60 hover:text-[#ef4444] transition-colors rounded-lg hover:bg-[#ef4444]/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addServiceRate} className="text-[12px] text-[#22c55e] hover:text-[#22c55e]/80 flex items-center gap-1" style={{ fontWeight: 500 }}>
                      <Plus className="w-3.5 h-3.5" /> Adicionar Servico
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-5 py-2.5 bg-[#22c55e] text-white rounded-xl hover:bg-[#22c55e]/90 transition-colors text-[13px]" style={{ fontWeight: 500 }}>
                  {editingCommissionId ? "Atualizar" : "Cadastrar"}
                </button>
                <button type="button" onClick={cancelCommission} className="px-5 py-2.5 rounded-xl transition-colors text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Cancelar</button>
              </div>
            </form>
          )}

          {/* Commission Members List */}
          {commissionMembers.length === 0 && !showCommissionForm ? (
            <div className="rounded-2xl p-12 text-center" style={cardStyle}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--bg-input)" }}>
                <Percent className="w-8 h-8" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
              </div>
              <p className="text-[15px] mb-1" style={{ color: "var(--text-primary)" }}>Nenhum comissionado cadastrado</p>
              <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>Cadastre vendedores, influenciadores ou indicadores para calcular comissoes automaticamente nas vendas.</p>
              {canAdd && (
                <button onClick={() => setShowCommissionForm(true)} className="px-4 py-2 bg-[#22c55e] text-white text-[13px] rounded-xl hover:bg-[#22c55e]/90 transition-colors inline-flex items-center gap-2" style={{ fontWeight: 500 }}>
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeiro Comissionado
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {commissionMembers.map((m) => {
                const isExpanded = expandedMember === m.id;
                const colors: Record<string, string> = { vendedor: "#22c55e", influenciador: "#a855f7", indicador: "#3b82f6", parceiro: "#f59e0b" };
                const color = colors[m.type] || "#8a8a99";

                return (
                  <div key={m.id} className="rounded-2xl overflow-hidden" style={cardStyle}>
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors"
                      onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] shrink-0" style={{ fontWeight: 600, backgroundColor: color + "1a", color }}>
                        {m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: color + "1a", color }}>{commissionTypeLabels[m.type]}</span>
                          {!m.active && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Inativo</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{m.email}</span>
                          {m.phone && <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{m.phone}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{m.defaultRate}%</span>
                        <span className="text-[11px] block" style={{ color: "var(--text-secondary)" }}>{m.defaultIncidence === "gross_revenue" ? "s/ Bruto" : "s/ Liquido"}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.phone && (
                          <button onClick={(e) => { e.stopPropagation(); openWhatsApp(m.phone); }} className="p-2 rounded-lg text-[#22c55e]/60 hover:text-[#22c55e] hover:bg-[#22c55e]/10 transition-all" title="WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); openCommissionEdit(m); }} className="p-2 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (deleteCommConfirm === m.id) {
                                removeCommissionMember(m.id);
                                setDeleteCommConfirm(null);
                                toast.success("Comissionado removido");
                              } else {
                                setDeleteCommConfirm(m.id);
                                setTimeout(() => setDeleteCommConfirm(null), 3000);
                              }
                            }}
                            className={`flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all ${
                              deleteCommConfirm === m.id
                                ? "bg-[#ef4444]/15 text-[#ef4444] ring-1 ring-[#ef4444]/30"
                                : "text-[#ef4444]/40 hover:text-[#ef4444] hover:bg-[#ef4444]/10"
                            }`}
                            title={deleteCommConfirm === m.id ? "Clique para confirmar" : "Excluir"}
                          >
                            <Trash2 className="w-4 h-4" />
                            {deleteCommConfirm === m.id && (
                              <span className="text-[10px] whitespace-nowrap animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-4 pt-0" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                        <div className="grid grid-cols-4 gap-4 pt-4">
                          {m.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                              <div>
                                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Endereco</p>
                                <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{m.address}</p>
                              </div>
                            </div>
                          )}
                          {m.bankAccount && (
                            <div className="flex items-start gap-2">
                              <CreditCard className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                              <div>
                                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Conta Bancaria</p>
                                <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{m.bankAccount}</p>
                              </div>
                            </div>
                          )}
                          {m.pixKey && (
                            <div className="flex items-start gap-2">
                              <Key className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                              <div>
                                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Chave PIX</p>
                                <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{m.pixKey}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-2">
                            <Percent className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                            <div>
                              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Modo</p>
                              <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{m.commissionMode === "unique" ? "Comissao unica" : "Por servico"}</p>
                            </div>
                          </div>
                        </div>

                        {m.commissionMode === "per_service" && m.serviceRates && m.serviceRates.length > 0 && (
                          <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
                            <p className="text-[11px] mb-2 uppercase tracking-wider" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Comissoes por Servico</p>
                            <div className="space-y-1.5">
                              {m.serviceRates.map((sr, i) => {
                                const svc = services.find(s => s.id === sr.serviceId);
                                return (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{svc?.name || "Servico removido"}</span>
                                    <span className="text-[12px] text-[#22c55e]">{sr.rate}% {sr.incidence === "gross_revenue" ? "(Bruto)" : "(Liquido)"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Info card */}
          <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.05), transparent)", border: "1px solid rgba(34,197,94,0.15)" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 flex items-center justify-center shrink-0">
                <Percent className="w-5 h-5 text-[#22c55e]" />
              </div>
              <div>
                <h3 className="text-[#22c55e] text-[14px] mb-1" style={{ fontWeight: 500 }}>Como funciona</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Comissionados nao possuem acesso ao sistema. Sao cadastrados apenas para calculo automatico de comissoes.
                  Ao registrar uma <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Receita/Venda</span> nos Lancamentos,
                  voce pode marcar se foi venda direta ou comissionada e selecionar o responsavel. O sistema calcula
                  a comissao automaticamente com base nas regras configuradas aqui.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
