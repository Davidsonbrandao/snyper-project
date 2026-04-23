import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2, Users, CreditCard, Tag, LifeBuoy, BarChart3,
  Plus, Trash2, Pause, Play, Clock, Gift, Search,
  ChevronDown, ChevronRight, X, Check,
  Crown, Shield, Loader2, RefreshCcw, Copy,
  CircleDot, TrendingUp, Server, Ticket, Calendar,
  ArrowUpRight, ArrowDownRight, DollarSign, UserPlus,
  Zap, Mail, Repeat, Hash, Send, Eye, FileText,
  Phone, FileCheck, Pencil, Package, Lock, Unlock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { apiFetch } from "../lib/api";
import { CustomSelect } from "./ui/custom-select";
import { DatePickerInput } from "./ui/date-picker-input";
import { CurrencyInput, PercentInput } from "./ui/currency-input";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

// ============ Types ============
interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  semiAnnualPrice: number;
  annualPrice: number;
  semiAnnualDiscount: number;
  annualDiscount: number;
  enableSemiAnnual: boolean;
  enableAnnual: boolean;
  maxUsers: number;
  pricePerExtraUser: number;
  modules: Record<string, boolean>;
  isDefault?: boolean;
  active: boolean;
  color: string;
  order: number;
}

interface Tenant {
  id: string;
  companyName: string;
  cnpj?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  planId?: string;
  plan: string;
  status: "pending" | "active" | "trial" | "paused" | "expired" | "cancelled";
  trialDays?: number;
  trialEnd: string | null;
  createdAt: string;
  activeUsers: number;
  maxUsers: number;
  discount: number;
  couponCode: string | null;
  extraDays: number;
  notes: string;
  storageUsageMB: number;
  lastActiveAt: string;
  sentAt?: string | null;
}

interface Coupon {
  code: string;
  discountPercent: number;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  description: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  orgId: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  responses: { author: string; message: string; createdAt: string }[];
}

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  pausedTenants: number;
  expiredTenants: number;
  basicPlan: number;
  premiumPlan: number;
  totalUsers: number;
  openTickets: number;
  totalTickets: number;
  monthlyRevenue: number;
}

type AdminTab = "overview" | "tenants" | "plans" | "coupons" | "tickets";

const STATUS_COLORS: Record<string, string> = { pending: "#8b5cf6", active: "#22c55e", trial: "#3b82f6", paused: "#f59e0b", expired: "#ef4444", cancelled: "#8a8a99" };
const STATUS_LABELS: Record<string, string> = { pending: "Pendente", active: "Ativo", trial: "Trial", paused: "Pausado", expired: "Expirado", cancelled: "Cancelado" };
const PRIORITY_COLORS: Record<string, string> = { low: "#8a8a99", medium: "#3b82f6", high: "#f59e0b", urgent: "#ef4444" };
const PRIORITY_LABELS: Record<string, string> = { low: "Baixa", medium: "Media", high: "Alta", urgent: "Urgente" };
const TICKET_STATUS_LABELS: Record<string, string> = { open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido", closed: "Fechado" };

const PLAN_MODULES = [
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

const PLAN_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "---";
const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const daysRemaining = (trialEnd: string | null) => {
  if (!trialEnd) return null;
  return Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};
const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const cs = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const is = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

function generateId() { return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");

  const [showNewTenant, setShowNewTenant] = useState(false);
  const [newTenant, setNewTenant] = useState({ companyName: "", cnpj: "", ownerName: "", ownerEmail: "", ownerPhone: "", planId: "", trialDays: "7", couponCode: "", notes: "" });
  const [showNewCoupon, setShowNewCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: "", discountPercent: "10", expiresAt: "", maxUses: "", description: "" });

  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [addDaysValue, setAddDaysValue] = useState("7");
  const [ticketResponse, setTicketResponse] = useState<Record<string, string>>({});
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  // Delete confirm states (inline, no confirm())
  const [deleteTenantConfirm, setDeleteTenantConfirm] = useState<string | null>(null);
  const [deleteCouponConfirm, setDeleteCouponConfirm] = useState<string | null>(null);
  const [deletePlanConfirm, setDeletePlanConfirm] = useState<string | null>(null);
  const [sendLicenseConfirm, setSendLicenseConfirm] = useState<string | null>(null);

  // Plans editor
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);

  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.email?.toLowerCase() === "admin@snyper.com.br";

  const loadData = useCallback(async () => {
  if (!isSuperAdmin) return;

  setLoading(true);

  try {
    const [statsRes, couponRes, plansRes] = await Promise.allSettled([
      apiFetch("/admin/stats"),
      apiFetch("/admin/coupons"),
      apiFetch("/admin/plans"),
    ]);

    if (statsRes.status === "fulfilled") {
      setStats(
        statsRes.value.stats || {
          totalTenants: 0,
          activeTenants: 0,
          trialTenants: 0,
          pausedTenants: 0,
          expiredTenants: 0,
          basicPlan: 0,
          premiumPlan: 0,
          totalUsers: 0,
          openTickets: 0,
          totalTickets: 0,
          monthlyRevenue: 0,
        }
      );
      setTenants(statsRes.value.tenants || []);
      setTickets(statsRes.value.tickets || []);
    } else {
      console.error("Erro ao carregar /admin/stats:", statsRes.reason);
      setStats({
        totalTenants: 0,
        activeTenants: 0,
        trialTenants: 0,
        pausedTenants: 0,
        expiredTenants: 0,
        basicPlan: 0,
        premiumPlan: 0,
        totalUsers: 0,
        openTickets: 0,
        totalTickets: 0,
        monthlyRevenue: 0,
      });
      setTenants([]);
      setTickets([]);
    }

    if (couponRes.status === "fulfilled") {
      setCoupons(couponRes.value.coupons || []);
    } else {
      console.error("Erro ao carregar /admin/coupons:", couponRes.reason);
      setCoupons([]);
    }

    if (plansRes.status === "fulfilled") {
      setPlans(plansRes.value.plans || []);
    } else {
      console.error("Erro ao carregar /admin/plans:", plansRes.reason);
      setPlans([]);
    }
  } catch (err) {
    console.error("Erro ao carregar dados admin:", err);
    toast.error("Erro ao carregar dados do painel");
  } finally {
    setLoading(false);
  }
}, [isSuperAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  // Plan options for tenant form
  const planOptions = useMemo(() => [
    { value: "", label: "Selecione o plano" },
    ...plans.filter(p => p.active).map(p => ({ value: p.id, label: `${p.name} (${formatCurrency(p.monthlyPrice)}/mes)` })),
  ], [plans]);

  // ============ Computed Analytics ============
  const analytics = useMemo(() => {
    if (!stats) return null;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const activePaying = tenants.filter(t => t.status === "active");
    const mrr = activePaying.reduce((s, t) => {
      const plan = plans.find(p => p.id === t.planId);
      const price = plan?.monthlyPrice || 97;
      return s + price * (1 - (t.discount || 0) / 100);
    }, 0);
    const arr = mrr * 12;
    const newThisMonth = tenants.filter(t => t.createdAt?.startsWith(thisMonth)).length;
    const trialConversion = tenants.length > 0 ? Math.round((activePaying.length / Math.max(1, tenants.length)) * 100) : 0;
    const totalUsersAcross = tenants.reduce((s, t) => s + (t.activeUsers || 1), 0);

    const mrrTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      const yearSuffix = String(d.getFullYear()).slice(-2);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      mrrTrend.push({ month: `${label}/${yearSuffix}`, mrr: mrr * (0.3 + (5 - i) * 0.14) || 0, id: monthKey });
    }

    const planDist = plans.filter(p => p.active).map(p => ({
      name: p.name, value: tenants.filter(t => t.planId === p.id).length, color: p.color, id: p.id,
    })).filter(p => p.value > 0);

    const usersPerCompany = tenants.sort((a, b) => (b.activeUsers || 1) - (a.activeUsers || 1)).slice(0, 8).map((t, i) => ({ name: `${t.companyName.slice(0, 12)}${i > 0 ? '' : ''}`, users: t.activeUsers || 1, id: `upc-${t.id || i}` }));

    return { mrr, arr, newThisMonth, trialConversion, totalUsersAcross, mrrTrend, planDist, usersPerCompany };
  }, [stats, tenants, plans]);

  const filteredTenants = useMemo(() => tenants.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (planFilter !== "all" && t.planId !== planFilter) return false;
    if (search && !t.companyName.toLowerCase().includes(search.toLowerCase()) && !t.ownerEmail.toLowerCase().includes(search.toLowerCase()) && !(t.cnpj || "").includes(search)) return false;
    return true;
  }), [tenants, statusFilter, planFilter, search]);

  const filteredTickets = useMemo(() => tickets.filter(t => {
    if (ticketStatusFilter !== "all" && t.status !== ticketStatusFilter) return false;
    return true;
  }), [tickets, ticketStatusFilter]);

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="w-16 h-16" style={{ color: "var(--text-muted)" }} />
        <h2 className="text-[18px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Acesso Restrito</h2>
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>Este painel e exclusivo para o administrador do sistema.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // ============ Handlers ============
const handleCreateTenant = async () => {
  if (!newTenant.companyName || !newTenant.ownerName || !newTenant.ownerEmail) {
    toast.error("Preencha nome da empresa, responsável e e-mail");
    return;
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTenant.ownerEmail);
  if (!emailOk) {
    toast.error("Informe um e-mail válido para o responsável");
    return;
  }

  setSaving(true);

  try {
    const result = await apiFetch("/admin/tenants", {
      method: "POST",
      body: JSON.stringify({
        ...newTenant,
        trialDays: parseInt(newTenant.trialDays || "0", 10),
      }),
    });

    const createdTenant = result?.tenant;

    if (!createdTenant) {
      throw new Error("A empresa foi criada, mas o retorno veio vazio.");
    }

    setTenants((prev) => {
      return [createdTenant, ...prev.filter((t) => t.id !== createdTenant.id)];
    });

    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalTenants: prev.totalTenants + 1,
          }
        : prev
    );

    setSearch("");
    setStatusFilter("all");
    setPlanFilter("all");

    setShowNewTenant(false);
    setNewTenant({
      companyName: "",
      cnpj: "",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: "",
      planId: "",
      trialDays: "7",
      couponCode: "",
      notes: "",
    });

    toast.success("Empresa cadastrada com sucesso! Ela deve aparecer como Pendente.");

    loadData().catch((err) => {
      console.error("Erro ao sincronizar empresas após cadastro:", err);
    });
  } catch (err: any) {
    console.error("Erro ao cadastrar empresa:", err);
    toast.error("Erro ao cadastrar empresa: " + (err?.message || err));
  } finally {
    setSaving(false);
  }
};

const handleSendLicense = async (tenantId: string) => {
  setSaving(true);

  try {
    const result = await apiFetch(`/admin/tenants/${tenantId}/send-license`, {
      method: "POST",
    });

    const updatedTenant = result?.tenant;

    if (updatedTenant) {
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === tenantId ? { ...tenant, ...updatedTenant } : tenant
        )
      );
    }

    setSendLicenseConfirm(null);

    toast.success("Licença enviada com sucesso! O usuário já pode receber o acesso.");

    loadData().catch((err) => {
      console.error("Erro ao sincronizar empresas após envio de licença:", err);
    });
  } catch (err: any) {
    console.error("Erro ao enviar licença:", err);
    toast.error("Erro ao enviar licença: " + (err?.message || err));
  } finally {
    setSaving(false);
  }
};

const handleUpdateTenant = async (tenantId: string, updates: Partial<Tenant> & { addDays?: number }) => {
  setSaving(true);

  try {
    const result = await apiFetch(`/admin/tenants/${tenantId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    const updatedTenant = result?.tenant;

    if (updatedTenant) {
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === tenantId ? { ...tenant, ...updatedTenant } : tenant
        )
      );
    }

    toast.success("Empresa atualizada com sucesso");

    loadData().catch((err) => {
      console.error("Erro ao sincronizar empresas apos atualizacao:", err);
    });
  } catch (err: any) {
    console.error("Erro ao atualizar empresa:", err);
    toast.error("Erro ao atualizar empresa: " + (err?.message || err));
  } finally {
    setSaving(false);
  }
};

const handleDeleteTenant = async (id: string) => {
  setSaving(true);

  try {
    await apiFetch(`/admin/tenants/${id}`, { method: "DELETE" });

    setDeleteTenantConfirm(null);

    setTenants((prev) => prev.filter((tenant) => tenant.id !== id));

    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalTenants: Math.max(0, prev.totalTenants - 1),
          }
        : prev
    );

    toast.success("Empresa removida com sucesso");

    loadData().catch((err) => {
      console.error("Erro ao sincronizar empresas após exclusão:", err);
    });
  } catch (err: any) {
    console.error("Erro ao remover empresa:", err);
    toast.error("Erro ao remover empresa: " + (err?.message || err));
  } finally {
    setSaving(false);
  }
};

const handleCreateCoupon = async () => {
  if (!newCoupon.code || !newCoupon.discountPercent) {
    toast.error("Informe codigo e desconto");
    return;
  }

  setSaving(true);

  try {
    await apiFetch("/admin/coupons", {
      method: "POST",
      body: JSON.stringify({
        ...newCoupon,
        discountPercent: parseInt(newCoupon.discountPercent),
        maxUses: newCoupon.maxUses ? parseInt(newCoupon.maxUses) : null,
        expiresAt: newCoupon.expiresAt || null,
      }),
    });

    setShowNewCoupon(false);
    setNewCoupon({
      code: "",
      discountPercent: "10",
      expiresAt: "",
      maxUses: "",
      description: "",
    });

    toast.success("Cupom criado com sucesso");
    await loadData();
  } catch (err: any) {
    toast.error("Erro: " + (err.message || err));
  } finally {
    setSaving(false);
  }
};

const handleDeleteCoupon = async (code: string) => {
  try {
    await apiFetch(`/admin/coupons/${code}`, { method: "DELETE" });
    setDeleteCouponConfirm(null);
    toast.success("Cupom excluido");
    await loadData();
  } catch (err: any) {
    toast.error("Erro: " + (err.message || err));
  }
};

const handleToggleCoupon = async (cp: Coupon) => {
  try {
    await apiFetch("/admin/coupons", {
      method: "POST",
      body: JSON.stringify({ ...cp, active: !cp.active }),
    });
    toast.success(cp.active ? "Cupom pausado" : "Cupom reativado");
    await loadData();
  } catch (err: any) {
    toast.error("Erro: " + (err.message || err));
  }
};

const handleUpdateTicket = async (id: string, updates: any) => {
  try {
    await apiFetch(`/admin/tickets/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    await loadData();
  } catch (err: any) {
    toast.error("Erro: " + (err.message || err));
  }
};

const handleTicketRespond = async (ticket: SupportTicket) => {
  const msg = ticketResponse[ticket.id];
  if (!msg?.trim()) return;

  const responses = [
    ...(ticket.responses || []),
    {
      author: user?.user_metadata?.name || "Admin",
      message: msg.trim(),
      createdAt: new Date().toISOString(),
    },
  ];

  await handleUpdateTicket(ticket.id, {
    responses,
    status: "in_progress",
  });

  setTicketResponse((prev) => ({ ...prev, [ticket.id]: "" }));
  toast.success("Resposta enviada");
};

// ============ Plans Handlers ============
  const savePlans = async (newPlans: Plan[]) => {
    setPlans(newPlans);
    try {
      await apiFetch("/admin/plans", { method: "POST", body: JSON.stringify({ plans: newPlans }) });
    } catch (err: any) { toast.error("Erro ao salvar planos: " + (err.message || err)); }
  };

  const openNewPlan = () => {
    const allModules: Record<string, boolean> = {};
    PLAN_MODULES.forEach(m => { allModules[m.key] = true; });
    setEditingPlan({
      id: generateId(), name: "", description: "", monthlyPrice: 0, semiAnnualPrice: 0, annualPrice: 0,
      semiAnnualDiscount: 5, annualDiscount: 10, enableSemiAnnual: true, enableAnnual: true,
      maxUsers: 5, pricePerExtraUser: 29, modules: allModules, active: true,
      color: PLAN_COLORS[plans.length % PLAN_COLORS.length], order: plans.length,
    });
    setShowPlanForm(true);
  };

  const openEditPlan = (plan: Plan) => {
    const mods = { ...plan.modules };
    PLAN_MODULES.forEach(m => { if (mods[m.key] === undefined) mods[m.key] = true; });
    setEditingPlan({ ...plan, modules: mods });
    setShowPlanForm(true);
  };

  const savePlan = () => {
    if (!editingPlan || !editingPlan.name.trim()) { toast.error("Informe o nome do plano"); return; }
    const isNew = !plans.find(p => p.id === editingPlan.id);
    const updated = isNew ? [...plans, editingPlan] : plans.map(p => p.id === editingPlan.id ? editingPlan : p);
    savePlans(updated);
    setEditingPlan(null);
    setShowPlanForm(false);
    toast.success(isNew ? "Plano criado" : "Plano atualizado");
  };

  const deletePlan = (planId: string) => {
    const usedBy = tenants.filter(t => t.planId === planId).length;
    if (usedBy > 0) { toast.error(`Este plano esta em uso por ${usedBy} empresa(s)`); setDeletePlanConfirm(null); return; }
    savePlans(plans.filter(p => p.id !== planId));
    setDeletePlanConfirm(null);
    toast.success("Plano excluido");
  };

  const duplicatePlan = (plan: Plan) => {
    const dup = { ...plan, id: generateId(), name: `${plan.name} (Copia)`, isDefault: false };
    savePlans([...plans, dup]);
    toast.success("Plano duplicado");
  };

  const getPlanName = (planId?: string) => {
    if (!planId) return "Sem plano";
    const plan = plans.find(p => p.id === planId);
    return plan?.name || planId;
  };

  // ============ Stats Card ============
  const StatCard = ({ label, value, sub, icon: Icon, color, trend }: { label: string; value: string | number; sub?: string; icon: any; color: string; trend?: number }) => (
    <div className="rounded-2xl p-5" style={cs}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}12` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-[24px] leading-none" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {trend != null && (
          <span className="flex items-center gap-0.5 text-[11px]" style={{ color: trend >= 0 ? "#22c55e" : "#ef4444", fontWeight: 500 }}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</span>}
      </div>
    </div>
  );

  const totalStorageMB = tenants.reduce((s, t) => s + (t.storageUsageMB || 0), 0);
  const chartTooltipStyle = {
    contentStyle: { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12 },
    labelStyle: { color: "var(--text-primary)", fontWeight: 500 },
    itemStyle: { color: "var(--text-secondary)" },
  };

  const tabs: { key: AdminTab; label: string; icon: any; badge?: number }[] = [
    { key: "overview", label: "Visao Geral", icon: BarChart3 },
    { key: "tenants", label: "Empresas", icon: Building2, badge: stats?.totalTenants },
    { key: "plans", label: "Planos", icon: Package, badge: plans.length },
    { key: "coupons", label: "Cupons", icon: Tag, badge: coupons.length },
    { key: "tickets", label: "Chamados", icon: LifeBuoy, badge: stats?.openTickets },
  ];

  // Inline confirm button helper
  const ConfirmButton = ({ id, confirmId, onConfirm, setConfirmId, label, icon: BtnIcon, color = "#ef4444" }: any) => (
    <button
      onClick={(e) => { e.stopPropagation(); if (confirmId === id) { onConfirm(id); } else { setConfirmId(id); setTimeout(() => setConfirmId(null), 3000); } }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-[11px]"
      style={{
        backgroundColor: confirmId === id ? `${color}20` : `${color}10`,
        color: color,
        fontWeight: 500,
        boxShadow: confirmId === id ? `0 0 0 1px ${color}40` : "none",
      }}
    >
      <BtnIcon className="w-3 h-3" />
      {confirmId === id ? "Confirmar?" : label}
    </button>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.6))" }}>
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Painel Administrativo</h1>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Gestao completa: empresas, planos, cupons e suporte</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] transition-all" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}>
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={cs}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] transition-all"
            style={{ fontWeight: tab === t.key ? 500 : 400, backgroundColor: tab === t.key ? "var(--accent)" : "transparent", color: tab === t.key ? "#ffffff" : "var(--text-secondary)" }}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tab === t.key ? "rgba(255,255,255,0.2)" : "rgba(var(--accent-rgb),0.15)", color: tab === t.key ? "#fff" : "var(--accent)", fontWeight: 600 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ================== OVERVIEW ================== */}
      {tab === "overview" && stats && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="MRR (Receita Mensal)" value={formatCurrency(analytics.mrr)} sub="recorrente" icon={DollarSign} color="#22c55e" trend={12} />
            <StatCard label="ARR (Receita Anual)" value={formatCurrency(analytics.arr)} sub="projecao" icon={TrendingUp} color="var(--accent)" />
            <StatCard label="Empresas Ativas" value={stats.activeTenants} sub={`de ${stats.totalTenants} total`} icon={Building2} color="#3b82f6" />
            <StatCard label="Usuarios Totais" value={analytics.totalUsersAcross} sub="em todas empresas" icon={Users} color="#8b5cf6" />
            <StatCard label="Chamados Abertos" value={stats.openTickets} sub={`de ${stats.totalTickets} total`} icon={Ticket} color={stats.openTickets > 3 ? "#ef4444" : "#f59e0b"} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Novos este Mes" value={analytics.newThisMonth} icon={UserPlus} color="#06b6d4" />
            <StatCard label="Conversao Trial > Pago" value={`${analytics.trialConversion}%`} icon={Zap} color="#22c55e" />
            <StatCard label="Trials Ativos" value={stats.trialTenants} sub={stats.expiredTenants > 0 ? `${stats.expiredTenants} expirado${stats.expiredTenants > 1 ? "s" : ""}` : ""} icon={Clock} color="#f59e0b" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={cs}>
              <h3 className="text-[14px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Evolucao do MRR</h3>
              <p className="text-[11px] mb-4" style={{ color: "var(--text-secondary)" }}>Receita mensal recorrente (6 meses)</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analytics.mrrTrend}>
                  <defs><linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--border-extra-subtle)" />
                  <XAxis key="xaxis" dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis key="yaxis" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <ReTooltip key="tooltip" {...chartTooltipStyle} formatter={(v: number) => [formatCurrency(v), "MRR"]} />
                  <Area key="area-mrr" type="monotone" dataKey="mrr" stroke="#22c55e" fill="url(#mrrGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl p-5" style={cs}>
              <h3 className="text-[14px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Usuarios por Empresa</h3>
              <p className="text-[11px] mb-4" style={{ color: "var(--text-secondary)" }}>Top empresas</p>
              {analytics.usersPerCompany.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.usersPerCompany} layout="vertical">
                    <CartesianGrid key="grid" strokeDasharray="3 3" stroke="var(--border-extra-subtle)" horizontal={false} />
                    <XAxis key="xaxis" type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis key="yaxis" type="category" dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <ReTooltip key="tooltip" {...chartTooltipStyle} />
                    <Bar key="bar-users" dataKey="users" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-[200px]"><p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Nenhuma empresa cadastrada</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* ================== TENANTS TAB ================== */}
      {tab === "tenants" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Buscar empresa, e-mail ou CNPJ..." />
            </div>
            <div className="w-[160px]">
              <CustomSelect options={[{ value: "all", label: "Todos os Status" }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]} value={statusFilter} onChange={setStatusFilter} />
            </div>
            <div className="w-[160px]">
              <CustomSelect options={[{ value: "all", label: "Todos os Planos" }, ...plans.map(p => ({ value: p.id, label: p.name }))]} value={planFilter} onChange={setPlanFilter} />
            </div>
            <button onClick={() => setShowNewTenant(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] shrink-0" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
              <Plus className="w-4 h-4" /> Nova Empresa
            </button>
          </div>

          {/* New Tenant Form */}
          {showNewTenant && (
            <div className="rounded-2xl p-5 space-y-4" style={{ ...cs, border: "2px solid var(--accent)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                    <Building2 className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <h3 className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Cadastrar Nova Empresa</h3>
                </div>
                <button onClick={() => setShowNewTenant(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
              </div>

              <div className="p-3 rounded-xl flex items-center gap-2" style={{ backgroundColor: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}>
                <AlertTriangle className="w-4 h-4 text-[#8b5cf6] shrink-0" />
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  A empresa sera salva como <strong style={{ color: "#8b5cf6" }}>Pendente</strong>. Revise os dados e clique em <strong style={{ color: "#8b5cf6" }}>Enviar Licenca</strong> para criar a conta do usuario e liberar o acesso.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Nome da Empresa *</label>
                  <input value={newTenant.companyName} onChange={e => setNewTenant(p => ({ ...p, companyName: e.target.value }))} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Razao social ou fantasia" />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>CNPJ</label>
                  <input value={newTenant.cnpj} onChange={e => setNewTenant(p => ({ ...p, cnpj: maskCnpj(e.target.value) }))} maxLength={18} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Nome do Responsavel *</label>
                  <input value={newTenant.ownerName} onChange={e => setNewTenant(p => ({ ...p, ownerName: e.target.value }))} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>E-mail do Responsavel *</label>
                  <input type="email" value={newTenant.ownerEmail} onChange={e => setNewTenant(p => ({ ...p, ownerEmail: e.target.value }))} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="email@empresa.com" />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Telefone / WhatsApp</label>
                  <input value={newTenant.ownerPhone} onChange={e => setNewTenant(p => ({ ...p, ownerPhone: maskPhone(e.target.value) }))} maxLength={15} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Plano</label>
                  <CustomSelect options={planOptions} value={newTenant.planId} onChange={v => setNewTenant(p => ({ ...p, planId: v }))} placeholder="Selecione o plano" />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Periodo Trial</label>
                  <CustomSelect options={[{ value: "0", label: "Sem trial (ativo imediato)" }, { value: "7", label: "Trial 7 dias" }, { value: "14", label: "Trial 14 dias" }, { value: "30", label: "Trial 30 dias" }]} value={newTenant.trialDays} onChange={v => setNewTenant(p => ({ ...p, trialDays: v }))} />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Cupom (opcional)</label>
                  <input value={newTenant.couponCode} onChange={e => setNewTenant(p => ({ ...p, couponCode: e.target.value.toUpperCase() }))} placeholder="DESCONTO20" className="w-full rounded-xl px-4 py-2.5 text-[13px] font-mono focus:outline-none" style={is} />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Observacoes</label>
                  <input value={newTenant.notes} onChange={e => setNewTenant(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Anotacoes internas" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNewTenant(false)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={handleCreateTenant} disabled={saving || !newTenant.companyName || !newTenant.ownerEmail} className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Cadastrar Empresa
                </button>
              </div>
            </div>
          )}

          {/* Tenants List */}
          {filteredTenants.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={cs}>
              <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTenants.map(tenant => {
                const isExp = expandedTenant === tenant.id;
                const remaining = daysRemaining(tenant.trialEnd);
                const plan = plans.find(p => p.id === tenant.planId);
                const price = plan?.monthlyPrice || 0;
                const finalPrice = price * (1 - (tenant.discount || 0) / 100);

                return (
                  <div key={tenant.id} className="rounded-2xl overflow-hidden transition-all" style={{ ...cs, border: isExp ? "1px solid rgba(var(--accent-rgb),0.3)" : cs.border }}>
                    <div className="flex items-center gap-4 p-4 cursor-pointer transition-opacity" onClick={() => setExpandedTenant(isExp ? null : tenant.id)}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] shrink-0" style={{ fontWeight: 600, backgroundColor: `${STATUS_COLORS[tenant.status]}12`, color: STATUS_COLORS[tenant.status] }}>
                        {tenant.companyName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{tenant.companyName}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ fontWeight: 500, backgroundColor: `${STATUS_COLORS[tenant.status]}12`, color: STATUS_COLORS[tenant.status] }}>
                            {STATUS_LABELS[tenant.status]}
                          </span>
                          {plan && <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ fontWeight: 500, backgroundColor: `${plan.color}12`, color: plan.color }}>{plan.name}</span>}
                          {tenant.cnpj && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{tenant.cnpj}</span>}
                        </div>
                        <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {tenant.ownerName} - {tenant.ownerEmail}
                          {tenant.ownerPhone ? ` - ${tenant.ownerPhone}` : ""}
                          {tenant.status !== "pending" ? ` - ${tenant.activeUsers || 1} usuario${(tenant.activeUsers || 1) !== 1 ? "s" : ""}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {tenant.status === "pending" ? (
                          <p className="text-[13px]" style={{ fontWeight: 600, color: "#8b5cf6" }}>Pendente</p>
                        ) : tenant.status === "trial" ? (
                          <>
                            <p className="text-[13px]" style={{ fontWeight: 600, color: "#3b82f6" }}>Trial</p>
                            {remaining !== null && <p className="text-[11px]" style={{ color: remaining <= 3 ? "#ef4444" : remaining <= 7 ? "#f59e0b" : "#3b82f6", fontWeight: 500 }}>{remaining > 0 ? `${remaining}d restantes` : "Expirado"}</p>}
                          </>
                        ) : (
                          <p className="text-[13px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(finalPrice)}/mes</p>
                        )}
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>desde {formatDate(tenant.createdAt)}</p>
                      </div>
                      {isExp ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
                    </div>

                    {isExp && (
                      <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                        <div className="flex items-center gap-2 flex-wrap pt-3">
                          {tenant.status === "pending" && (
                            <button
                              onClick={() => { if (sendLicenseConfirm === tenant.id) { handleSendLicense(tenant.id); } else { setSendLicenseConfirm(tenant.id); setTimeout(() => setSendLicenseConfirm(null), 4000); } }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                              style={{ backgroundColor: sendLicenseConfirm === tenant.id ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500, boxShadow: sendLicenseConfirm === tenant.id ? "0 0 0 1px rgba(34,197,94,0.4)" : "none" }}
                            >
                              <Send className="w-3 h-3" /> {sendLicenseConfirm === tenant.id ? "Confirmar Envio?" : "Enviar Licenca"}
                            </button>
                          )}
                          {tenant.status === "active" && (
                            <button onClick={() => handleUpdateTenant(tenant.id, { status: "paused" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 500 }}><Pause className="w-3 h-3" /> Pausar</button>
                          )}
                          {(tenant.status === "paused" || tenant.status === "expired" || tenant.status === "cancelled") && (
                            <button onClick={() => handleUpdateTenant(tenant.id, { status: "active" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500 }}><Play className="w-3 h-3" /> Reativar</button>
                          )}
                          {(tenant.status === "trial" || tenant.status === "expired") && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleUpdateTenant(tenant.id, { addDays: parseInt(addDaysValue) })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 500 }}><Gift className="w-3 h-3" /> +{addDaysValue} dias</button>
                              <div className="w-[80px]"><CustomSelect options={[{ value: "3", label: "3 dias" }, { value: "7", label: "7 dias" }, { value: "14", label: "14 dias" }, { value: "30", label: "30 dias" }]} value={addDaysValue} onChange={setAddDaysValue} /></div>
                            </div>
                          )}
                          <div className="ml-auto">
                            <ConfirmButton id={tenant.id} confirmId={deleteTenantConfirm} onConfirm={handleDeleteTenant} setConfirmId={setDeleteTenantConfirm} label="Excluir" icon={Trash2} />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: "Responsavel", value: tenant.ownerName, icon: Users },
                            { label: "E-mail", value: tenant.ownerEmail, icon: Mail },
                            { label: "Telefone", value: tenant.ownerPhone || "---", icon: Phone },
                            { label: "CNPJ", value: tenant.cnpj || "---", icon: FileText },
                            { label: "Plano", value: getPlanName(tenant.planId), icon: Package },
                            { label: "Valor Final", value: tenant.discount > 0 ? `${formatCurrency(finalPrice)}/mes (-${tenant.discount}%)` : price > 0 ? `${formatCurrency(price)}/mes` : "---", icon: DollarSign },
                            { label: "Trial ate", value: tenant.trialEnd ? formatDate(tenant.trialEnd) : "---", icon: Calendar },
                            { label: "Observacoes", value: tenant.notes || "---", icon: FileCheck },
                          ].map(item => (
                            <div key={item.label} className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
                              <div className="flex items-center gap-1.5 mb-1"><item.icon className="w-3 h-3" style={{ color: "var(--text-muted)" }} /><p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.label}</p></div>
                              <p className="text-[12px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================== PLANS TAB ================== */}
      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Planos de Assinatura</h3>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Configure os planos disponiveis para comercializacao</p>
            </div>
            <button onClick={openNewPlan} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
              <Plus className="w-4 h-4" /> Novo Plano
            </button>
          </div>

          {/* Plan Form */}
          {showPlanForm && editingPlan && (
            <div className="rounded-2xl p-6 space-y-5" style={{ ...cs, border: `2px solid ${editingPlan.color}` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{plans.find(p => p.id === editingPlan.id) ? "Editar Plano" : "Novo Plano"}</h3>
                <button onClick={() => { setShowPlanForm(false); setEditingPlan(null); }} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Nome do Plano *</label>
                  <input value={editingPlan.name} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Ex: Basico, Profissional, Premium..." />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Descricao</label>
                  <input value={editingPlan.description} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} placeholder="Ideal para pequenas empresas..." />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Cor do Plano</label>
                  <div className="flex items-center gap-1.5">
                    {PLAN_COLORS.map(c => (
                      <button key={c} onClick={() => setEditingPlan({ ...editingPlan, color: c })} className="w-7 h-7 rounded-lg transition-all" style={{ backgroundColor: c, boxShadow: editingPlan.color === c ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${c}` : "none" }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: `${editingPlan.color}06`, border: `1px solid ${editingPlan.color}15` }}>
                <div className="flex items-center gap-2"><DollarSign className="w-4 h-4" style={{ color: editingPlan.color }} /><span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Precificacao</span></div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Preco Mensal (R$) *</label>
                    <CurrencyInput value={String(editingPlan.monthlyPrice)} onChange={v => setEditingPlan({ ...editingPlan, monthlyPrice: parseFloat(v) || 0 })} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>
                      <span className="flex items-center gap-2">Preco Semestral (R$)
                        <button onClick={() => setEditingPlan({ ...editingPlan, enableSemiAnnual: !editingPlan.enableSemiAnnual })} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: editingPlan.enableSemiAnnual ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: editingPlan.enableSemiAnnual ? "#22c55e" : "#ef4444" }}>
                          {editingPlan.enableSemiAnnual ? "Ativo" : "Inativo"}
                        </button>
                      </span>
                    </label>
                    <CurrencyInput value={String(editingPlan.semiAnnualPrice)} onChange={v => setEditingPlan({ ...editingPlan, semiAnnualPrice: parseFloat(v) || 0 })} placeholder="0,00" />
                    {editingPlan.enableSemiAnnual && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Desconto: {editingPlan.monthlyPrice > 0 ? Math.round((1 - editingPlan.semiAnnualPrice / (editingPlan.monthlyPrice * 6)) * 100) : 0}%</p>}
                  </div>
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>
                      <span className="flex items-center gap-2">Preco Anual (R$)
                        <button onClick={() => setEditingPlan({ ...editingPlan, enableAnnual: !editingPlan.enableAnnual })} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: editingPlan.enableAnnual ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: editingPlan.enableAnnual ? "#22c55e" : "#ef4444" }}>
                          {editingPlan.enableAnnual ? "Ativo" : "Inativo"}
                        </button>
                      </span>
                    </label>
                    <CurrencyInput value={String(editingPlan.annualPrice)} onChange={v => setEditingPlan({ ...editingPlan, annualPrice: parseFloat(v) || 0 })} placeholder="0,00" />
                    {editingPlan.enableAnnual && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Desconto: {editingPlan.monthlyPrice > 0 ? Math.round((1 - editingPlan.annualPrice / (editingPlan.monthlyPrice * 12)) * 100) : 0}%</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Max. Usuarios Inclusos</label>
                    <input type="number" value={editingPlan.maxUsers} onChange={e => setEditingPlan({ ...editingPlan, maxUsers: parseInt(e.target.value) || 1 })} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} />
                  </div>
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Valor por Usuario Adicional (R$)</label>
                    <CurrencyInput value={String(editingPlan.pricePerExtraUser)} onChange={v => setEditingPlan({ ...editingPlan, pricePerExtraUser: parseFloat(v) || 0 })} placeholder="0,00" />
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: `${editingPlan.color}06`, border: `1px solid ${editingPlan.color}15` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><Package className="w-4 h-4" style={{ color: editingPlan.color }} /><span className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Modulos Inclusos</span></div>
                  <button onClick={() => {
                    const allEnabled = PLAN_MODULES.every(m => editingPlan.modules[m.key]);
                    const mods: Record<string, boolean> = {};
                    PLAN_MODULES.forEach(m => { mods[m.key] = !allEnabled; });
                    setEditingPlan({ ...editingPlan, modules: mods });
                  }} className="text-[11px] px-2.5 py-1 rounded-lg" style={{ color: editingPlan.color, backgroundColor: `${editingPlan.color}10`, fontWeight: 500 }}>
                    {PLAN_MODULES.every(m => editingPlan.modules[m.key]) ? "Desmarcar Todos" : "Marcar Todos"}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {PLAN_MODULES.map(mod => (
                    <button key={mod.key} onClick={() => setEditingPlan({ ...editingPlan, modules: { ...editingPlan.modules, [mod.key]: !editingPlan.modules[mod.key] } })}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all text-left"
                      style={{ backgroundColor: editingPlan.modules[mod.key] ? `${editingPlan.color}10` : "var(--bg-input)", color: editingPlan.modules[mod.key] ? editingPlan.color : "var(--text-muted)", fontWeight: editingPlan.modules[mod.key] ? 500 : 400, boxShadow: editingPlan.modules[mod.key] ? `0 0 0 1px ${editingPlan.color}30` : "none" }}>
                      {editingPlan.modules[mod.key] ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      {mod.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={savePlan} disabled={!editingPlan.name.trim()} className="px-5 py-2.5 text-white rounded-xl text-[13px] disabled:opacity-50" style={{ backgroundColor: editingPlan.color, fontWeight: 500 }}>
                  {plans.find(p => p.id === editingPlan.id) ? "Salvar Alteracoes" : "Criar Plano"}
                </button>
                <button onClick={() => { setShowPlanForm(false); setEditingPlan(null); }} className="px-5 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Plans List */}
          {plans.length === 0 && !showPlanForm ? (
            <div className="text-center py-16 rounded-2xl" style={cs}>
              <Package className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-[15px] mb-1" style={{ color: "var(--text-primary)" }}>Nenhum plano criado</p>
              <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>Crie seus planos de assinatura para comecar a comercializar o sistema.</p>
              <button onClick={openNewPlan} className="px-4 py-2 text-[13px] rounded-xl inline-flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                <Plus className="w-4 h-4" /> Criar Primeiro Plano
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {plans.map(plan => {
                const usersOnPlan = tenants.filter(t => t.planId === plan.id).length;
                const enabledModules = PLAN_MODULES.filter(m => plan.modules[m.key]).length;
                return (
                  <div key={plan.id} className="rounded-2xl overflow-hidden" style={{ ...cs, opacity: plan.active ? 1 : 0.6 }}>
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${plan.color}15` }}>
                        <Package className="w-6 h-6" style={{ color: plan.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{plan.name}</span>
                          {!plan.active && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Inativo</span>}
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${plan.color}12`, color: plan.color }}>{usersOnPlan} empresa{usersOnPlan !== 1 ? "s" : ""}</span>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{plan.description || "Sem descricao"}</p>
                      </div>
                      <div className="text-right shrink-0 mr-2">
                        <p className="text-[18px]" style={{ fontWeight: 700, color: plan.color }}>{formatCurrency(plan.monthlyPrice)}<span className="text-[11px]" style={{ color: "var(--text-muted)" }}>/mes</span></p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>ate {plan.maxUsers} usuarios | {enabledModules}/{PLAN_MODULES.length} modulos</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditPlan(plan)} className="p-2 rounded-lg transition-all" style={{ color: "var(--text-muted)" }} title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => duplicatePlan(plan)} className="p-2 rounded-lg text-[#3b82f6]/60 hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all" title="Duplicar"><Copy className="w-4 h-4" /></button>
                        <ConfirmButton id={plan.id} confirmId={deletePlanConfirm} onConfirm={deletePlan} setConfirmId={setDeletePlanConfirm} label="Excluir" icon={Trash2} />
                      </div>
                    </div>
                    <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                      {PLAN_MODULES.map(mod => (
                        <span key={mod.key} className="text-[10px] px-2 py-0.5 rounded-full" style={{
                          backgroundColor: plan.modules[mod.key] ? `${plan.color}08` : "rgba(255,255,255,0.03)",
                          color: plan.modules[mod.key] ? plan.color : "var(--text-muted)",
                          textDecoration: plan.modules[mod.key] ? "none" : "line-through",
                          opacity: plan.modules[mod.key] ? 1 : 0.4,
                        }}>{mod.label}</span>
                      ))}
                      {plan.enableSemiAnnual && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "#22c55e" }}>Semestral: {formatCurrency(plan.semiAnnualPrice)}</span>}
                      {plan.enableAnnual && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "#22c55e" }}>Anual: {formatCurrency(plan.annualPrice)}</span>}
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(59,130,246,0.08)", color: "#3b82f6" }}>+R$ {plan.pricePerExtraUser}/usuario extra</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================== COUPONS TAB ================== */}
      {tab === "coupons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Cupons de Desconto</h3>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Gerencie cupons para aplicar ao cadastrar empresas</p>
            </div>
            <button onClick={() => setShowNewCoupon(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}><Plus className="w-4 h-4" /> Novo Cupom</button>
          </div>

          {/* Info card */}
          <div className="rounded-xl p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(var(--accent-rgb),0.04)", border: "1px solid rgba(var(--accent-rgb),0.1)" }}>
            <Tag className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <div>
              <p className="text-[12px]" style={{ fontWeight: 500, color: "var(--accent)" }}>Como funcionam os cupons</p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Os cupons sao aplicados <strong style={{ color: "var(--text-primary)" }}>manualmente</strong> ao cadastrar uma nova empresa na aba Empresas.
                Informe o codigo do cupom no campo correspondente e o desconto sera aplicado no valor do plano.
                Cupons <strong style={{ color: "var(--text-primary)" }}>nao</strong> sao aplicados automaticamente ao fim do trial.
              </p>
            </div>
          </div>

          {showNewCoupon && (
            <div className="rounded-2xl p-5 space-y-4" style={{ ...cs, border: "2px solid var(--accent)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}><Tag className="w-4 h-4" style={{ color: "var(--accent)" }} /></div>
                  <h3 className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Criar Cupom</h3>
                </div>
                <button onClick={() => setShowNewCoupon(false)}><X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Codigo</label><input value={newCoupon.code} onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="DESCONTO20" className="w-full rounded-xl px-4 py-2.5 text-[13px] font-mono focus:outline-none" style={is} /></div>
                <div><label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Desconto (%)</label><PercentInput value={newCoupon.discountPercent} onChange={v => setNewCoupon(p => ({ ...p, discountPercent: v }))} placeholder="10" /></div>
                <div><label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Validade</label><DatePickerInput value={newCoupon.expiresAt} onChange={v => setNewCoupon(p => ({ ...p, expiresAt: v }))} placeholder="Sem validade" /></div>
                <div><label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Limite de Uso</label><input value={newCoupon.maxUses} onChange={e => setNewCoupon(p => ({ ...p, maxUses: e.target.value }))} placeholder="Ilimitado" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} /></div>
                <div className="col-span-2"><label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Descricao</label><input value={newCoupon.description} onChange={e => setNewCoupon(p => ({ ...p, description: e.target.value }))} placeholder="Opcional" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={is} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewCoupon(false)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={handleCreateCoupon} disabled={saving || !newCoupon.code} className="flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Criar
                </button>
              </div>
            </div>
          )}

          {coupons.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={cs}><Tag className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} /><p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>Nenhum cupom criado</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {coupons.map(cp => {
                const isExpired = cp.expiresAt && new Date(cp.expiresAt) < new Date();
                const isMaxed = cp.maxUses && cp.usedCount >= cp.maxUses;
                const isValid = cp.active && !isExpired && !isMaxed;
                return (
                  <div key={cp.code} className="rounded-2xl p-4" style={{ ...cs, opacity: !isValid ? 0.7 : 1 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: isValid ? "rgba(var(--accent-rgb),0.1)" : "rgba(138,138,153,0.1)" }}>
                          <Tag className="w-5 h-5" style={{ color: isValid ? "var(--accent)" : "#8a8a99" }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{cp.code}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ fontWeight: 600, backgroundColor: isValid ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: isValid ? "#22c55e" : "#ef4444" }}>
                              {isValid ? "Ativo" : isExpired ? "Expirado" : isMaxed ? "Esgotado" : "Pausado"}
                            </span>
                          </div>
                          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{cp.description || "Sem descricao"}</p>
                        </div>
                      </div>
                      <span className="text-[22px] shrink-0" style={{ fontWeight: 700, color: "var(--accent)" }}>-{cp.discountPercent}%</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                      <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" style={{ color: "var(--text-muted)" }} /><span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Usado: <strong style={{ color: "var(--text-primary)" }}>{cp.usedCount}</strong>{cp.maxUses ? ` / ${cp.maxUses}` : ""}</span></div>
                      <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" style={{ color: "var(--text-muted)" }} /><span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{cp.expiresAt ? `Expira: ${formatDate(cp.expiresAt)}` : "Sem validade"}</span></div>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => { navigator.clipboard.writeText(cp.code); toast.success("Codigo copiado!"); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-secondary)" }} title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToggleCoupon(cp)} className="p-1.5 rounded-lg transition-colors" style={{ color: cp.active ? "#f59e0b" : "#22c55e" }} title={cp.active ? "Pausar" : "Reativar"}>
                          {cp.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => { if (deleteCouponConfirm === cp.code) { handleDeleteCoupon(cp.code); } else { setDeleteCouponConfirm(cp.code); setTimeout(() => setDeleteCouponConfirm(null), 3000); } }}
                          className="flex items-center gap-1 p-1.5 rounded-lg transition-all"
                          style={{ color: "#ef4444", backgroundColor: deleteCouponConfirm === cp.code ? "rgba(239,68,68,0.15)" : "transparent", boxShadow: deleteCouponConfirm === cp.code ? "0 0 0 1px rgba(239,68,68,0.3)" : "none" }}
                          title={deleteCouponConfirm === cp.code ? "Confirmar exclusao" : "Excluir"}>
                          <Trash2 className="w-3.5 h-3.5" />
                          {deleteCouponConfirm === cp.code && <span className="text-[10px] animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================== TICKETS TAB ================== */}
      {tab === "tickets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Chamados de Suporte</h3>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{stats?.openTickets || 0} abertos de {stats?.totalTickets || 0} total</p>
            </div>
            <div className="w-[180px]">
              <CustomSelect options={[{ value: "all", label: "Todos os Status" }, { value: "open", label: "Abertos" }, { value: "in_progress", label: "Em Andamento" }, { value: "resolved", label: "Resolvidos" }, { value: "closed", label: "Fechados" }]} value={ticketStatusFilter} onChange={setTicketStatusFilter} />
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={cs}><LifeBuoy className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} /><p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>Nenhum chamado</p></div>
          ) : (
            <div className="space-y-2">
              {filteredTickets.map(ticket => {
                const isExp = expandedTicket === ticket.id;
                const statusColor = ticket.status === "open" ? "#f59e0b" : ticket.status === "in_progress" ? "#3b82f6" : ticket.status === "resolved" ? "#22c55e" : "#8a8a99";
                return (
                  <div key={ticket.id} className="rounded-2xl overflow-hidden" style={{ ...cs, border: isExp ? `1px solid ${statusColor}40` : cs.border }}>
                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedTicket(isExp ? null : ticket.id)}>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[ticket.priority] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{ticket.subject}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ fontWeight: 500, backgroundColor: `${statusColor}12`, color: statusColor }}>{TICKET_STATUS_LABELS[ticket.status]}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ fontWeight: 500, backgroundColor: `${PRIORITY_COLORS[ticket.priority]}12`, color: PRIORITY_COLORS[ticket.priority] }}>{PRIORITY_LABELS[ticket.priority]}</span>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{ticket.userName} ({ticket.userEmail}) - {formatDate(ticket.createdAt)}</p>
                      </div>
                      {ticket.responses?.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{ticket.responses.length} resposta{ticket.responses.length > 1 ? "s" : ""}</span>}
                      {isExp ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
                    </div>
                    {isExp && (
                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                        <div className="p-3 rounded-xl mt-3 text-[13px] leading-relaxed" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}>{ticket.message}</div>
                        {(ticket.responses || []).map((r, i) => (
                          <div key={i} className="ml-6 p-3 rounded-xl" style={{ backgroundColor: "rgba(var(--accent-rgb),0.04)", border: "1px solid rgba(var(--accent-rgb),0.1)" }}>
                            <div className="flex items-center gap-2 mb-1"><Shield className="w-3 h-3" style={{ color: "var(--accent)" }} /><span className="text-[11px]" style={{ fontWeight: 500, color: "var(--accent)" }}>{r.author}</span><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formatDate(r.createdAt)}</span></div>
                            <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{r.message}</p>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-2">
                          {ticket.status !== "resolved" && ticket.status !== "closed" && <button onClick={() => handleUpdateTicket(ticket.id, { status: "resolved" })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500 }}><Check className="w-3 h-3" /> Resolver</button>}
                          {ticket.status !== "closed" && <button onClick={() => handleUpdateTicket(ticket.id, { status: "closed" })} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(138,138,153,0.1)", color: "#8a8a99", fontWeight: 500 }}><X className="w-3 h-3" /> Fechar</button>}
                        </div>
                        {ticket.status !== "closed" && (
                          <div className="flex items-center gap-2 ml-6">
                            <input value={ticketResponse[ticket.id] || ""} onChange={e => setTicketResponse(prev => ({ ...prev, [ticket.id]: e.target.value }))} placeholder="Responder ao chamado..." className="flex-1 rounded-xl px-4 py-2.5 text-[12px] focus:outline-none" style={is} onKeyDown={e => { if (e.key === "Enter") handleTicketRespond(ticket); }} />
                            <button onClick={() => handleTicketRespond(ticket)} className="px-4 py-2.5 rounded-xl text-[12px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>Enviar</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
