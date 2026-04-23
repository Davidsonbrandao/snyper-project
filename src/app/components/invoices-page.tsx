import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText, Plus, Search, Filter, Download, Mail, Send,
  Eye, Trash2, Copy, Check, X, Loader2, ChevronDown,
  ChevronRight, AlertTriangle, Clock, CheckCircle2,
  Ban, ArrowUpRight, DollarSign, FileCheck, FilePlus2,
  Printer, Link2, ExternalLink, Upload, Shield, Settings,
  Building2, User, Phone, MapPin, Hash, Calendar,
  CreditCard, Package, Percent, ShieldCheck, RotateCcw,
  MoreHorizontal, AlertCircle, FileX, FilePen, Zap,
  TrendingUp, BarChart3, Boxes, ChevronLeft, Undo2,
  FileDown, FileCode, Archive, ListChecks,
} from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { useAuth } from "../lib/auth-context";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { CustomSelect } from "./ui/custom-select";
import { DatePickerInput } from "./ui/date-picker-input";
import { apiFetch } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ============ Masks ============
const maskCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const maskCep = (v: string) => v.replace(/\D/g, "").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

// ============ Types ============
export type InvoiceStatus = "draft" | "pending" | "approved" | "emitted" | "cancelled" | "corrected";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  ncm?: string;
  cfop?: string;
  unit?: string;
}

export interface Invoice {
  id: string;
  number: string;
  series: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  // Client
  clientId?: string;
  clientName: string;
  clientDocument: string; // CPF ou CNPJ
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientCep: string;
  clientInscricaoMunicipal?: string;
  // Items
  items: InvoiceItem[];
  // Totals
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  // Payment
  paymentMethod: string;
  installments: number;
  // Metadata
  dealId?: string;
  dealTitle?: string;
  description: string;
  observations?: string;
  createdAt: string;
  emittedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  correctionLetter?: string;
  correctedAt?: string;
  // Delivery
  sentByEmail: boolean;
  sentAt?: string;
  shareLink?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  // NF-e
  nfeKey?: string; // Chave de acesso
  nfeProtocol?: string;
  nfeSefazStatus?: string;
}

export interface NfeConfig {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  regimeTributario: string; // 1-Simples, 2-Simples Excesso, 3-Normal
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  certificateA1Uploaded: boolean;
  certificateExpiry?: string;
  ambiente: "homologacao" | "producao";
  ultimoNumeroNfe: number;
  serieNfe: string;
  aliquotaIss?: number;
  codigoMunicipio?: string;
  // Integration
  integrationProvider?: "enotas" | "focusnfe" | "webmaniabrq" | "";
  integrationEnabled?: boolean;
  integrationApiKey?: string;
  integrationApiSecret?: string;
  integrationTokenExtra?: string;
  integrationStatus?: "disconnected" | "connected" | "error";
  integrationLastTest?: string;
}

// ============ Constants ============
const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Rascunho", color: "#8a8a99", icon: FilePen },
  pending: { label: "Pendente", color: "#f59e0b", icon: Clock },
  approved: { label: "Aprovada", color: "#3b82f6", icon: FileCheck },
  emitted: { label: "Emitida", color: "#22c55e", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "#ef4444", icon: Ban },
  corrected: { label: "Corrigida", color: "#8b5cf6", icon: FilePen },
};

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto Bancario" },
  { value: "cartao_credito", label: "Cartao de Credito" },
  { value: "cartao_debito", label: "Cartao de Debito" },
  { value: "transferencia", label: "Transferencia Bancaria" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outros", label: "Outros" },
];

const REGIME_TRIBUTARIO = [
  { value: "1", label: "Simples Nacional" },
  { value: "2", label: "Simples Nacional - Excesso" },
  { value: "3", label: "Regime Normal" },
];

const UF_OPTIONS = "AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO".split(",").map(uf => ({ value: uf, label: uf }));

const formatCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "---";
const generateId = () => `nf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

type TabKey = "dashboard" | "notas" | "emissao" | "config";

const DEFAULT_CONFIG: NfeConfig = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "",
  inscricaoMunicipal: "", regimeTributario: "1", endereco: "", numero: "",
  bairro: "", cidade: "", uf: "SP", cep: "", telefone: "", email: "",
  certificateA1Uploaded: false, ambiente: "homologacao",
  ultimoNumeroNfe: 0, serieNfe: "1",
  integrationProvider: "", integrationEnabled: false, integrationApiKey: "",
  integrationApiSecret: "", integrationTokenExtra: "", integrationStatus: "disconnected",
  integrationLastTest: "",
};

export function InvoicesPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const { clients, pipelineDeals, pipelineColumns } = useFinance();

  // State
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [config, setConfig] = useState<NfeConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Edit/View
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [showEmailModal, setShowEmailModal] = useState<Invoice | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [showDanfePreview, setShowDanfePreview] = useState<Invoice | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showInutilizacao, setShowInutilizacao] = useState(false);
  const [inutNumInicio, setInutNumInicio] = useState("");
  const [inutNumFim, setInutNumFim] = useState("");
  const [inutJustificativa, setInutJustificativa] = useState("");

  if (!can("notas_fiscais", "view")) return <NoAccessPage />;

  // Load data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [invRes, cfgRes] = await Promise.all([
          apiFetch("/invoices").catch(() => ({ invoices: [] })),
          apiFetch("/invoices/config").catch(() => ({ config: DEFAULT_CONFIG })),
        ]);
        if (cancelled) return;
        setInvoices(invRes.invoices || []);
        setConfig(cfgRes.config || DEFAULT_CONFIG);
      } catch (err) {
        console.error("Erro ao carregar notas:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const saveInvoices = useCallback(async (updated: Invoice[]) => {
    setInvoices(updated);
    try {
      await apiFetch("/invoices", { method: "POST", body: JSON.stringify({ invoices: updated }) });
    } catch (err) { console.error("Erro ao salvar notas:", err); }
  }, []);

  const saveConfig = useCallback(async (updated: NfeConfig) => {
    setConfig(updated);
    try {
      await apiFetch("/invoices/config", { method: "POST", body: JSON.stringify({ config: updated }) });
    } catch (err) { console.error("Erro ao salvar config:", err); }
  }, []);

  // ============ Computed ============
  const wonDeals = useMemo(() => {
    const winColIds = pipelineColumns.filter(c => c.isWinColumn).map(c => c.id);
    return pipelineDeals.filter(d => winColIds.includes(d.columnId));
  }, [pipelineDeals, pipelineColumns]);

  // Deals without invoices
  const dealsWithoutInvoice = useMemo(() => {
    const invoicedDealIds = new Set(invoices.filter(i => i.dealId).map(i => i.dealId));
    return wonDeals.filter(d => !invoicedDealIds.has(d.id));
  }, [wonDeals, invoices]);

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (search && !inv.clientName.toLowerCase().includes(search.toLowerCase()) && !inv.number.includes(search) && !inv.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && inv.issueDate < dateFrom) return false;
    if (dateTo && inv.issueDate > dateTo) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [invoices, statusFilter, search, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const emitted = invoices.filter(i => i.status === "emitted");
    const pending = invoices.filter(i => i.status === "pending");
    const draft = invoices.filter(i => i.status === "draft");
    const cancelled = invoices.filter(i => i.status === "cancelled");
    return {
      totalEmitted: emitted.length,
      totalPending: pending.length,
      totalDraft: draft.length,
      totalCancelled: cancelled.length,
      totalValue: emitted.reduce((s, i) => s + i.total, 0),
      pendingValue: pending.reduce((s, i) => s + i.total, 0),
      avgTicket: emitted.length > 0 ? emitted.reduce((s, i) => s + i.total, 0) / emitted.length : 0,
      dealsAwaitingInvoice: dealsWithoutInvoice.length,
      totalCancelledValue: cancelled.reduce((s, i) => s + i.total, 0),
    };
  }, [invoices, dealsWithoutInvoice]);

  const monthlyChartData = useMemo(() => {
    const months: Record<string, { emitidas: number; valor: number }> = {};
    const mNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      months[key] = { emitidas: 0, valor: 0 };
    }
    invoices.filter(inv => inv.status === "emitted" && inv.emittedAt).forEach(inv => {
      const d = new Date(inv.emittedAt!);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (months[key]) { months[key].emitidas++; months[key].valor += inv.total; }
    });
    return Object.entries(months).map(([k, v]) => {
      const [y, m] = k.split("-");
      return { name: `${mNames[parseInt(m)-1]}/${y.slice(2)}`, emitidas: v.emitidas, valor: v.valor };
    });
  }, [invoices]);

  // ============ Handlers ============
  const createInvoiceFromDeal = (deal: any) => {
    const client = clients.find(c => c.id === deal.clientId);
    const nextNum = String(config.ultimoNumeroNfe + 1).padStart(9, "0");

    const newInvoice: Invoice = {
      id: generateId(),
      number: nextNum,
      series: config.serieNfe || "1",
      status: "draft",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: deal.paymentDate || new Date().toISOString().split("T")[0],
      clientId: deal.clientId || "",
      clientName: client?.razaoSocial || client?.nomeFantasia || client?.fullName || deal.contactName || "",
      clientDocument: client?.cnpj || client?.cpf || "",
      clientEmail: client?.email || "",
      clientPhone: client?.phone || "",
      clientAddress: client ? `${client.street || ""}, ${client.number || ""}` : "",
      clientCity: client?.city || "",
      clientState: client?.state || "",
      clientCep: client?.cep || "",
      clientInscricaoMunicipal: client?.inscricaoMunicipal || "",
      items: [{
        id: "item_1",
        description: deal.title,
        quantity: 1,
        unitPrice: deal.realValue || deal.estimatedValue || 0,
        total: deal.realValue || deal.estimatedValue || 0,
        unit: "UN",
      }],
      subtotal: deal.realValue || deal.estimatedValue || 0,
      discount: 0,
      taxRate: config.aliquotaIss || 0,
      taxAmount: 0,
      total: deal.realValue || deal.estimatedValue || 0,
      paymentMethod: deal.paymentMethod || "pix",
      installments: deal.installments || 1,
      dealId: deal.id,
      dealTitle: deal.title,
      description: `NF-e ref. ${deal.title}`,
      createdAt: new Date().toISOString(),
      sentByEmail: false,
    };

    setEditingInvoice(newInvoice);
    setTab("emissao");
  };

  const createBlankInvoice = () => {
    const nextNum = String(config.ultimoNumeroNfe + 1).padStart(9, "0");
    const newInvoice: Invoice = {
      id: generateId(),
      number: nextNum,
      series: config.serieNfe || "1",
      status: "draft",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date().toISOString().split("T")[0],
      clientName: "", clientDocument: "", clientEmail: "", clientPhone: "",
      clientAddress: "", clientCity: "", clientState: "", clientCep: "",
      items: [{ id: "item_1", description: "", quantity: 1, unitPrice: 0, total: 0, unit: "UN" }],
      subtotal: 0, discount: 0, taxRate: config.aliquotaIss || 0, taxAmount: 0, total: 0,
      paymentMethod: "pix", installments: 1, description: "",
      createdAt: new Date().toISOString(), sentByEmail: false,
    };
    setEditingInvoice(newInvoice);
    setTab("emissao");
  };

  const duplicateInvoice = (inv: Invoice) => {
    const nextNum = String(config.ultimoNumeroNfe + 1).padStart(9, "0");
    const clone: Invoice = {
      ...inv,
      id: generateId(),
      number: nextNum,
      status: "draft",
      createdAt: new Date().toISOString(),
      emittedAt: undefined, cancelledAt: undefined, cancelReason: undefined,
      correctionLetter: undefined, correctedAt: undefined,
      sentByEmail: false, sentAt: undefined,
      nfeKey: undefined, nfeProtocol: undefined,
      shareLink: undefined, pdfUrl: undefined, xmlUrl: undefined,
    };
    setEditingInvoice(clone);
    setTab("emissao");
  };

  const saveInvoice = async (inv: Invoice) => {
    const exists = invoices.find(i => i.id === inv.id);
    let updated: Invoice[];
    if (exists) {
      updated = invoices.map(i => i.id === inv.id ? inv : i);
    } else {
      updated = [...invoices, inv];
      // Update last number
      const num = parseInt(inv.number);
      if (num > config.ultimoNumeroNfe) {
        await saveConfig({ ...config, ultimoNumeroNfe: num });
      }
    }
    await saveInvoices(updated);
    setEditingInvoice(null);
  };

  const approveInvoice = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    const missing = validateInvoice(inv);
    if (missing.length > 0) {
      toast.error("Dados faltantes para aprovacao", { description: missing.join(", ") });
      return;
    }
    const updated = invoices.map(i => i.id === id ? { ...i, status: "approved" as InvoiceStatus } : i);
    await saveInvoices(updated);
    toast.success("Nota aprovada com sucesso");
  };

  const emitInvoice = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv || inv.status !== "approved") return;
    setSaving(true);
    try {
      // In production, this would call SEFAZ via an API like eNotas/Focus NFe
      // Simulating emission with protocol generation
      const protocol = `${Date.now()}`;
      const nfeKey = `${config.uf === "SP" ? "35" : "00"}${new Date().getFullYear()}${config.cnpj?.replace(/\D/g, "").slice(0, 14).padEnd(14, "0")}55${inv.series.padStart(3, "0")}${inv.number}1${protocol.slice(-8)}0`;

      const shareToken = Math.random().toString(36).slice(2, 14);
      const shareLink = `${window.location.origin}/nfe/${shareToken}`;

      const updated = invoices.map(i => i.id === id ? {
        ...i,
        status: "emitted" as InvoiceStatus,
        emittedAt: new Date().toISOString(),
        nfeKey: nfeKey,
        nfeProtocol: protocol,
        nfeSefazStatus: "100 - Autorizado",
        shareLink,
      } : i);
      await saveInvoices(updated);
      toast.success("NF-e emitida com sucesso", { description: `Protocolo: ${protocol}` });
    } catch (err) {
      console.error("Erro ao emitir NF-e:", err);
      toast.error("Erro ao emitir NF-e. Verifique a configuracao e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const cancelInvoice = async (id: string) => {
    if (!cancelReason.trim()) return;
    const updated = invoices.map(i => i.id === id ? {
      ...i, status: "cancelled" as InvoiceStatus,
      cancelledAt: new Date().toISOString(),
      cancelReason: cancelReason.trim(),
    } : i);
    await saveInvoices(updated);
    setShowCancelModal(null);
    setCancelReason("");
    toast.success("NF-e cancelada com sucesso");
  };

  const correctInvoice = async (id: string) => {
    if (!correctionText.trim()) return;
    const updated = invoices.map(i => i.id === id ? {
      ...i, status: "corrected" as InvoiceStatus,
      correctionLetter: correctionText.trim(),
      correctedAt: new Date().toISOString(),
    } : i);
    await saveInvoices(updated);
    setShowCorrectionModal(null);
    setCorrectionText("");
    toast.success("Carta de correcao registrada");
  };

  const sendEmail = async (inv: Invoice) => {
    setSaving(true);
    try {
      // In production would send actual email via backend
      const updated = invoices.map(i => i.id === inv.id ? {
        ...i, sentByEmail: true, sentAt: new Date().toISOString(),
      } : i);
      await saveInvoices(updated);
      setShowEmailModal(null);
      setEmailTo("");
      setEmailSubject("");
      toast.success("E-mail enviado com sucesso");
    } catch (err) {
      console.error("Erro ao enviar email:", err);
    } finally { setSaving(false); }
  };

  const batchApprove = async () => {
    const updated = invoices.map(i => {
      if (!selectedIds.has(i.id) || i.status !== "pending") return i;
      const missing = validateInvoice(i);
      if (missing.length > 0) return i;
      return { ...i, status: "approved" as InvoiceStatus };
    });
    await saveInvoices(updated);
    const approved = updated.filter(i => i.status === "approved").length - invoices.filter(i => i.status === "approved").length;
    toast.success(`Notas aprovadas em lote`);
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const batchEmit = async () => {
    setSaving(true);
    const protocol = `${Date.now()}`;
    const updated = invoices.map(i => {
      if (!selectedIds.has(i.id) || i.status !== "approved") return i;
      const shareToken = Math.random().toString(36).slice(2, 14);
      return {
        ...i, status: "emitted" as InvoiceStatus,
        emittedAt: new Date().toISOString(),
        nfeProtocol: `${protocol}_${i.id.slice(-4)}`,
        shareLink: `${window.location.origin}/nfe/${shareToken}`,
        nfeSefazStatus: "100 - Autorizado",
      };
    });
    await saveInvoices(updated);
    toast.success("Notas emitidas em lote com sucesso");
    setSelectedIds(new Set());
    setBatchMode(false);
    setSaving(false);
  };

  const deleteInvoice = async (id: string) => {
    await saveInvoices(invoices.filter(i => i.id !== id));
    setShowDeleteConfirm(null);
    toast.success("Rascunho excluido com sucesso");
  };

  const revertToDraft = async (id: string) => {
    const updated = invoices.map(i => i.id === id ? { ...i, status: "draft" as InvoiceStatus } : i);
    await saveInvoices(updated);
    toast.info("Nota devolvida para rascunho");
  };

  const downloadSimulated = (inv: Invoice, type: "pdf" | "xml") => {
    toast.info(`Download do ${type.toUpperCase()} sera disponivel apos integracao com API de emissao (eNotas, Focus NFe ou WebmaniaBR)`);
  };

  const handleInutilizacao = async () => {
    if (!inutJustificativa.trim() || inutJustificativa.trim().length < 15) {
      toast.error("Justificativa deve ter no minimo 15 caracteres");
      return;
    }
    toast.success(`Inutilizacao de ${inutNumInicio} a ${inutNumFim} registrada. Sera enviada a SEFAZ apos integracao.`);
    setShowInutilizacao(false);
    setInutNumInicio(""); setInutNumFim(""); setInutJustificativa("");
  };

  const copyShareLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado para a area de transferencia");
  };

  // Validate
  const validateInvoice = (inv: Invoice): string[] => {
    const missing: string[] = [];
    if (!inv.clientName) missing.push("- Nome do cliente");
    if (!inv.clientDocument) missing.push("- CPF/CNPJ do cliente");
    if (!inv.items.length || !inv.items[0]?.description) missing.push("- Descricao do item");
    if (inv.total <= 0) missing.push("- Valor total deve ser maior que zero");
    if (!config.cnpj) missing.push("- CNPJ do emitente (Configuracoes)");
    if (!config.razaoSocial) missing.push("- Razao Social do emitente (Configuracoes)");
    if (!config.certificateA1Uploaded) missing.push("- Certificado Digital A1 (Configuracoes)");
    return missing;
  };

  // Tab definitions
  const tabItems: { key: TabKey; label: string; icon: any; badge?: number }[] = [
    { key: "dashboard", label: "Painel", icon: BarChart3 },
    { key: "notas", label: "Notas Fiscais", icon: FileText, badge: invoices.length },
    { key: "emissao", label: "Emissao", icon: FilePlus2 },
    { key: "config", label: "Configuracoes", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // ============ STAT CARD ============
  const StatCard = ({ label, value, sub, icon: Icon, color }: any) => (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}12` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-[24px] leading-none" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {!can("notas_fiscais", "edit") && <ReadOnlyBadge />}

      {/* Beta Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
          <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px]" style={{ fontWeight: 500, color: "#f59e0b" }}>Funcionalidade em fase beta</p>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Este modulo ainda esta em testes e aprimoramentos. Algumas funcionalidades podem conter erros ou comportamentos inesperados ate a finalizacao completa.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.6))" }}>
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[20px]" style={{ fontWeight: 700, color: "var(--text-primary)" }}>Notas Fiscais <span className="text-[11px] px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 500, verticalAlign: "middle" }}>beta</span></h1>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Emissao, gestao e envio de NF-e</p>
          </div>
        </div>
        {can("notas_fiscais", "add") && (
          <div className="flex items-center gap-2">
            {dealsWithoutInvoice.length > 0 && (
              <span className="text-[11px] px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 500 }}>
                {dealsWithoutInvoice.length} venda{dealsWithoutInvoice.length !== 1 ? "s" : ""} sem nota
              </span>
            )}
            <button onClick={() => setShowInutilizacao(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", fontWeight: 500 }}>
              <Archive className="w-4 h-4" /> Inutilizar
            </button>
            <button onClick={createBlankInvoice} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
              <Plus className="w-4 h-4" /> Nova Nota
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        {tabItems.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] transition-all" style={{ fontWeight: tab === t.key ? 500 : 400, backgroundColor: tab === t.key ? "var(--accent)" : "transparent", color: tab === t.key ? "#ffffff" : "var(--text-secondary)" }}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tab === t.key ? "rgba(255,255,255,0.2)" : "rgba(var(--accent-rgb),0.15)", color: tab === t.key ? "#fff" : "var(--accent)", fontWeight: 600 }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ============ DASHBOARD TAB ============ */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Notas Emitidas" value={stats.totalEmitted} sub={`${formatCurrency(stats.totalValue)} faturado`} icon={CheckCircle2} color="#22c55e" />
            <StatCard label="Pendentes Emissao" value={stats.totalPending} sub={`${formatCurrency(stats.pendingValue)} a faturar`} icon={Clock} color="#f59e0b" />
            <StatCard label="Rascunhos" value={stats.totalDraft} sub="aguardando dados" icon={FilePen} color="#3b82f6" />
            <StatCard label="Ticket Medio" value={formatCurrency(stats.avgTicket)} sub="por nota emitida" icon={TrendingUp} color="var(--accent)" />
          </div>

          {/* Monthly Chart */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[13px] mb-4 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                <BarChart3 className="w-4 h-4" style={{ color: "var(--accent)" }} /> Faturamento Mensal (Ultimos 6 Meses)
              </h3>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-extra-subtle)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                      formatter={(v: number) => [formatCurrency(v), "Faturado"]}
                    />
                    <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                      {monthlyChartData.map((_, idx) => (
                        <Cell key={`bar-${idx}`} fill={idx === monthlyChartData.length - 1 ? "var(--accent)" : "rgba(var(--accent-rgb),0.3)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <h3 className="text-[13px] mb-4 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                <ListChecks className="w-4 h-4" style={{ color: "var(--accent)" }} /> Resumo por Status
              </h3>
              <div className="space-y-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const count = invoices.filter(i => i.status === key).length;
                  const value = invoices.filter(i => i.status === key).reduce((s, i) => s + i.total, 0);
                  const pct = invoices.length > 0 ? (count / invoices.length) * 100 : 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{count} nota{count !== 1 ? "s" : ""}</span>
                          <span className="text-[11px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Deals awaiting invoice */}
          {dealsWithoutInvoice.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(245,158,11,0.04)" }}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" style={{ color: "#f59e0b" }} />
                  <h3 className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Vendas Ganhas sem Nota Fiscal</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 600 }}>{dealsWithoutInvoice.length}</span>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-extra-subtle)" }}>
                {dealsWithoutInvoice.slice(0, 5).map(deal => {
                  const client = clients.find(c => c.id === deal.clientId);
                  return (
                    <div key={deal.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                          <DollarSign className="w-4 h-4" style={{ color: "#22c55e" }} />
                        </div>
                        <div>
                          <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{deal.title}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {client?.fullName || client?.nomeFantasia || deal.contactName || "Sem cliente"} - {formatCurrency(deal.realValue || deal.estimatedValue)}
                          </p>
                        </div>
                      </div>
                      {can("notas_fiscais", "add") && (
                        <button onClick={() => createInvoiceFromDeal(deal)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 500 }}>
                          <FilePlus2 className="w-3.5 h-3.5" /> Gerar Nota
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Config status */}
          {(!config.cnpj || !config.certificateA1Uploaded) && (
            <div className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle className="w-5 h-5" style={{ color: "#ef4444" }} />
              </div>
              <div className="flex-1">
                <p className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Configuracao Incompleta</p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {!config.cnpj && "CNPJ do emitente nao configurado. "}
                  {!config.certificateA1Uploaded && "Certificado Digital A1 nao enviado. "}
                  Configure na aba "Configuracoes" para emitir notas.
                </p>
              </div>
              <button onClick={() => setTab("config")} className="px-4 py-2 rounded-xl text-[12px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                Configurar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ NOTAS LIST TAB ============ */}
      {tab === "notas" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} placeholder="Buscar por cliente, numero ou descricao..." />
            </div>
            <div className="w-[160px]">
              <CustomSelect
                options={[
                  { value: "all", label: "Todos os Status" },
                  ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
                value={statusFilter} onChange={setStatusFilter}
              />
            </div>
            <div className="w-[140px]">
              <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="Data inicio" />
            </div>
            <div className="w-[140px]">
              <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="Data fim" />
            </div>
            {can("notas_fiscais", "edit") && (
              <button onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }} className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] transition-all`} style={{ backgroundColor: batchMode ? "rgba(var(--accent-rgb),0.1)" : "var(--bg-hover)", border: `1px solid ${batchMode ? "var(--accent)" : "var(--border-default)"}`, color: batchMode ? "var(--accent)" : "var(--text-secondary)", fontWeight: batchMode ? 500 : 400 }}>
                <Boxes className="w-4 h-4" /> Lote
              </button>
            )}
          </div>

          {/* Batch actions */}
          {batchMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: "rgba(var(--accent-rgb),0.06)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}>
              <span className="text-[12px]" style={{ color: "var(--accent)", fontWeight: 500 }}>
                {selectedIds.size} nota{selectedIds.size > 1 ? "s" : ""} selecionada{selectedIds.size > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={batchApprove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 500 }}>
                  <FileCheck className="w-3 h-3" /> Aprovar Selecionadas
                </button>
                <button onClick={batchEmit} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500 }}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Emitir Selecionadas
                </button>
              </div>
            </div>
          )}

          {/* Summary strip */}
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-primary)" }}>{filteredInvoices.length}</strong> nota{filteredInvoices.length !== 1 ? "s" : ""}
            </span>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => {
              const count = filteredInvoices.filter(i => i.status === k).length;
              if (!count) return null;
              return (
                <span key={k} className="flex items-center gap-1 text-[11px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                  <span style={{ color: "var(--text-muted)" }}>{v.label}: {count}</span>
                </span>
              );
            })}
          </div>

          {/* Invoices List */}
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
                {search || statusFilter !== "all" ? "Nenhuma nota encontrada com esses filtros" : "Nenhuma nota fiscal criada"}
              </p>
              {!search && statusFilter === "all" && can("notas_fiscais", "add") && (
                <button onClick={createBlankInvoice} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] mx-auto" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                  <Plus className="w-4 h-4" /> Criar Primeira Nota
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map(inv => {
                const isExp = expandedId === inv.id;
                const statusCfg = STATUS_CONFIG[inv.status];
                const StatusIcon = statusCfg.icon;
                const missing = validateInvoice(inv);

                return (
                  <div key={inv.id} className="rounded-2xl overflow-hidden transition-all" style={{ backgroundColor: "var(--bg-card)", border: isExp ? `1px solid ${statusCfg.color}40` : "1px solid var(--border-subtle)" }}>
                    {/* Row */}
                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExp ? null : inv.id)}>
                      {batchMode && (inv.status === "pending" || inv.status === "approved") && (
                        <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={e => {
                          e.stopPropagation();
                          const next = new Set(selectedIds);
                          if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id);
                          setSelectedIds(next);
                        }} onClick={e => e.stopPropagation()} className="w-4 h-4 rounded accent-[var(--accent)]" />
                      )}

                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${statusCfg.color}12` }}>
                        <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-mono" style={{ fontWeight: 600, color: "var(--text-primary)" }}>#{inv.number}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontWeight: 500, backgroundColor: `${statusCfg.color}12`, color: statusCfg.color }}>{statusCfg.label}</span>
                          {inv.dealTitle && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 500 }}>Pipeline</span>}
                          {inv.sentByEmail && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500 }}>Enviada</span>}
                          {missing.length > 0 && inv.status === "draft" && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 500 }}>Dados incompletos</span>}
                        </div>
                        <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {inv.clientName || "Sem cliente"} - {inv.description || inv.items[0]?.description || "Sem descricao"}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(inv.total)}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{formatDate(inv.issueDate)}</p>
                      </div>

                      {isExp ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
                    </div>

                    {/* Expanded */}
                    {isExp && (
                      <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap pt-3">
                          {inv.status === "draft" && can("notas_fiscais", "edit") && (
                            <>
                              <button onClick={() => { setEditingInvoice(inv); setTab("emissao"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 500 }}>
                                <FilePen className="w-3 h-3" /> Editar
                              </button>
                              <button onClick={() => {
                                const updated = invoices.map(i => i.id === inv.id ? { ...i, status: "pending" as InvoiceStatus } : i);
                                saveInvoices(updated);
                              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 500 }}>
                                <Clock className="w-3 h-3" /> Enviar p/ Aprovacao
                              </button>
                            </>
                          )}
                          {inv.status === "pending" && can("notas_fiscais", "edit") && (
                            <>
                              <button onClick={() => approveInvoice(inv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 500 }}>
                                <FileCheck className="w-3 h-3" /> Aprovar
                              </button>
                              <button onClick={() => revertToDraft(inv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)", fontWeight: 500 }}>
                                <Undo2 className="w-3 h-3" /> Devolver p/ Rascunho
                              </button>
                            </>
                          )}
                          {inv.status === "approved" && can("notas_fiscais", "edit") && (
                            <button onClick={() => emitInvoice(inv.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500 }}>
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Emitir NF-e
                            </button>
                          )}
                          {inv.status === "emitted" && (
                            <>
                              <button onClick={() => {
                                setShowEmailModal(inv);
                                setEmailTo(inv.clientEmail);
                                setEmailSubject(`NF-e #${inv.number} - ${config.nomeFantasia || config.razaoSocial}`);
                              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 500 }}>
                                <Mail className="w-3 h-3" /> Enviar por E-mail
                              </button>
                              {inv.shareLink && (
                                <button onClick={() => copyShareLink(inv.shareLink!)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 500 }}>
                                  <Link2 className="w-3 h-3" /> Copiar Link WhatsApp
                                </button>
                              )}
                              <button onClick={() => setShowCancelModal(inv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 500 }}>
                                <Ban className="w-3 h-3" /> Cancelar NF-e
                              </button>
                              <button onClick={() => setShowCorrectionModal(inv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#8b5cf6", fontWeight: 500 }}>
                                <FilePen className="w-3 h-3" /> Carta de Correcao
                              </button>
                              <button onClick={() => downloadSimulated(inv, "pdf")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)", fontWeight: 500 }}>
                                <FileDown className="w-3 h-3" /> PDF (DANFE)
                              </button>
                              <button onClick={() => downloadSimulated(inv, "xml")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)", fontWeight: 500 }}>
                                <FileCode className="w-3 h-3" /> XML
                              </button>
                              <button onClick={() => setShowDanfePreview(inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 500 }}>
                                <Eye className="w-3 h-3" /> Visualizar DANFE
                              </button>
                            </>
                          )}
                          <button onClick={() => duplicateInvoice(inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)", fontWeight: 500 }}>
                            <Copy className="w-3 h-3" /> Duplicar
                          </button>
                          {inv.status === "draft" && can("notas_fiscais", "delete") && (
                            <button onClick={() => setShowDeleteConfirm(inv.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] ml-auto" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 500 }}>
                              <Trash2 className="w-3 h-3" /> Excluir
                            </button>
                          )}
                          {/* Preview button for any invoice */}
                          {inv.status !== "emitted" && (
                            <button onClick={() => setShowDanfePreview(inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 500 }}>
                              <Eye className="w-3 h-3" /> Pre-visualizar
                            </button>
                          )}
                        </div>

                        {/* Detail Grid */}
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: "Cliente", value: inv.clientName || "---", icon: User },
                            { label: "CPF/CNPJ", value: inv.clientDocument || "---", icon: Hash },
                            { label: "E-mail", value: inv.clientEmail || "---", icon: Mail },
                            { label: "Telefone", value: inv.clientPhone || "---", icon: Phone },
                            { label: "Emissao", value: formatDate(inv.issueDate), icon: Calendar },
                            { label: "Vencimento", value: formatDate(inv.dueDate), icon: Calendar },
                            { label: "Pagamento", value: PAYMENT_METHODS.find(p => p.value === inv.paymentMethod)?.label || inv.paymentMethod, icon: CreditCard },
                            { label: "Parcelas", value: `${inv.installments}x`, icon: Boxes },
                          ].map(item => (
                            <div key={item.label} className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <item.icon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                              </div>
                              <p className="text-[12px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Items Table */}
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-extra-subtle)" }}>
                          <div className="grid grid-cols-[1fr_80px_100px_100px] gap-2 px-3 py-2 text-[10px]" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)", fontWeight: 500 }}>
                            <span>DESCRICAO</span><span className="text-right">QTD</span><span className="text-right">UNIT.</span><span className="text-right">TOTAL</span>
                          </div>
                          {inv.items.map(item => (
                            <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px] gap-2 px-3 py-2 text-[12px]" style={{ borderTop: "1px solid var(--border-extra-subtle)", color: "var(--text-primary)" }}>
                              <span className="truncate">{item.description || "---"}</span>
                              <span className="text-right">{item.quantity}</span>
                              <span className="text-right">{formatCurrency(item.unitPrice)}</span>
                              <span className="text-right" style={{ fontWeight: 500 }}>{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                          <div className="px-3 py-2 text-right space-y-0.5" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
                            {inv.discount > 0 && (
                              <div className="flex justify-end gap-4 text-[11px]">
                                <span style={{ color: "var(--text-muted)" }}>Desconto:</span>
                                <span style={{ color: "#ef4444", fontWeight: 500 }}>-{formatCurrency(inv.discount)}</span>
                              </div>
                            )}
                            {inv.taxAmount > 0 && (
                              <div className="flex justify-end gap-4 text-[11px]">
                                <span style={{ color: "var(--text-muted)" }}>Impostos ({inv.taxRate}%):</span>
                                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{formatCurrency(inv.taxAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-end gap-4 text-[13px]">
                              <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Total:</span>
                              <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{formatCurrency(inv.total)}</span>
                            </div>
                          </div>
                        </div>

                        {/* NF-e Technical Info */}
                        {inv.nfeKey && (
                          <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
                            <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Dados da NF-e</p>
                            <div className="flex items-center gap-4 text-[11px]">
                              <span style={{ color: "var(--text-secondary)" }}>Chave: <strong className="font-mono" style={{ color: "var(--text-primary)" }}>{inv.nfeKey}</strong></span>
                            </div>
                            {inv.nfeProtocol && (
                              <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>Protocolo: <strong className="font-mono" style={{ color: "var(--text-primary)" }}>{inv.nfeProtocol}</strong></p>
                            )}
                            {inv.nfeSefazStatus && (
                              <p className="text-[11px] mt-0.5" style={{ color: "#22c55e" }}>{inv.nfeSefazStatus}</p>
                            )}
                          </div>
                        )}

                        {inv.correctionLetter && (
                          <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
                            <p className="text-[10px] mb-1" style={{ color: "#8b5cf6", fontWeight: 500 }}>Carta de Correcao</p>
                            <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{inv.correctionLetter}</p>
                            {inv.correctedAt && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Em {formatDate(inv.correctedAt)}</p>}
                          </div>
                        )}

                        {inv.cancelReason && (
                          <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)" }}>
                            <p className="text-[10px] mb-1" style={{ color: "#ef4444", fontWeight: 500 }}>Motivo do Cancelamento</p>
                            <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>{inv.cancelReason}</p>
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

      {/* ============ EMISSAO TAB (Form) ============ */}
      {tab === "emissao" && (
        <InvoiceForm
          invoice={editingInvoice}
          clients={clients}
          config={config}
          onSave={async (inv) => { await saveInvoice(inv); setTab("notas"); }}
          onCancel={() => { setEditingInvoice(null); setTab("notas"); }}
          canEdit={can("notas_fiscais", "edit")}
        />
      )}

      {/* ============ CONFIG TAB ============ */}
      {tab === "config" && (
        <ConfigPanel config={config} onSave={saveConfig} canEdit={can("notas_fiscais", "edit")} />
      )}

      {/* ============ MODALS ============ */}
      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowCancelModal(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5" style={{ color: "#ef4444" }} />
                <h3 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Cancelar NF-e</h3>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>O cancelamento sera enviado para a SEFAZ. Informe o motivo (minimo 15 caracteres):</p>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento..." rows={3} className="w-full rounded-xl px-4 py-3 text-[13px] focus:outline-none resize-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCancelModal(null)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Voltar</button>
                <button onClick={() => cancelInvoice(showCancelModal)} disabled={cancelReason.trim().length < 15} className="px-5 py-2 rounded-xl text-white text-[13px] disabled:opacity-40" style={{ backgroundColor: "#ef4444", fontWeight: 500 }}>Confirmar Cancelamento</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Correction Letter Modal */}
      <AnimatePresence>
        {showCorrectionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowCorrectionModal(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <FilePen className="w-5 h-5" style={{ color: "#8b5cf6" }} />
                <h3 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Carta de Correcao (CC-e)</h3>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>A carta de correcao nao pode alterar valores. Use para corrigir dados como endereco, nome, etc. (minimo 15 caracteres)</p>
              <textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="Texto da correcao..." rows={4} className="w-full rounded-xl px-4 py-3 text-[13px] focus:outline-none resize-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCorrectionModal(null)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Voltar</button>
                <button onClick={() => correctInvoice(showCorrectionModal)} disabled={correctionText.trim().length < 15} className="px-5 py-2 rounded-xl text-white text-[13px] disabled:opacity-40" style={{ backgroundColor: "#8b5cf6", fontWeight: 500 }}>Enviar CC-e</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowEmailModal(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" style={{ color: "#3b82f6" }} />
                <h3 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Enviar NF-e por E-mail</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Destinatario</label>
                  <input value={emailTo} onChange={e => setEmailTo(e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Assunto</label>
                  <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>O e-mail incluira o PDF e XML da NF-e #{showEmailModal.number} no valor de {formatCurrency(showEmailModal.total)}.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowEmailModal(null)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={() => sendEmail(showEmailModal)} disabled={saving || !emailTo} className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-[13px] disabled:opacity-40" style={{ backgroundColor: "#3b82f6", fontWeight: 500 }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" style={{ color: "#ef4444" }} />
                <h3 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Excluir Rascunho</h3>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Tem certeza que deseja excluir este rascunho? Esta acao nao pode ser desfeita.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={() => deleteInvoice(showDeleteConfirm)} className="px-5 py-2 rounded-xl text-white text-[13px]" style={{ backgroundColor: "#ef4444", fontWeight: 500 }}>Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DANFE Preview Modal */}
      <AnimatePresence>
        {showDanfePreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowDanfePreview(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" style={{ backgroundColor: "#ffffff" }} onClick={e => e.stopPropagation()}>
              {/* DANFE Header */}
              <div className="p-6 border-b-2 border-black">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-[8px] text-gray-500 uppercase tracking-wider">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA</p>
                    <p className="text-[7px] text-gray-400">0 - ENTRADA / 1 - SAIDA</p>
                  </div>
                  <div className="text-center px-4 border-l border-r border-black">
                    <p className="text-[20px] font-bold text-black">NF-e</p>
                    <p className="text-[10px] text-black">N. {showDanfePreview.number}</p>
                    <p className="text-[10px] text-black">Serie {showDanfePreview.series}</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] text-gray-500 font-mono break-all">{showDanfePreview.nfeKey || "CHAVE PENDENTE"}</p>
                  </div>
                </div>
                <div className="border border-gray-300 p-3 rounded">
                  <p className="text-[14px] font-bold text-black">{config.razaoSocial || "RAZAO SOCIAL NAO CONFIGURADA"}</p>
                  <p className="text-[10px] text-gray-700">{config.nomeFantasia}</p>
                  <p className="text-[10px] text-gray-600">{config.endereco}{config.numero ? `, ${config.numero}` : ""} - {config.bairro} - {config.cidade}/{config.uf} - CEP: {config.cep}</p>
                  <p className="text-[10px] text-gray-600">CNPJ: {config.cnpj} | IE: {config.inscricaoEstadual} | Tel: {config.telefone}</p>
                </div>
              </div>

              {/* Destinatario */}
              <div className="p-4 border-b border-gray-300">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-2">DESTINATARIO / REMETENTE</p>
                <div className="grid grid-cols-[1fr_200px] gap-3">
                  <div>
                    <p className="text-[8px] text-gray-400">NOME / RAZAO SOCIAL</p>
                    <p className="text-[11px] text-black font-medium">{showDanfePreview.clientName || "---"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-400">CNPJ / CPF</p>
                    <p className="text-[11px] text-black font-medium">{showDanfePreview.clientDocument || "---"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-400">ENDERECO</p>
                    <p className="text-[11px] text-black">{showDanfePreview.clientAddress || "---"}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-400">MUNICIPIO / UF</p>
                    <p className="text-[11px] text-black">{showDanfePreview.clientCity || "---"} / {showDanfePreview.clientState || "---"}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="p-4 border-b border-gray-300">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-2">DADOS DOS PRODUTOS / SERVICOS</p>
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-1 text-gray-500 font-medium">DESCRICAO</th>
                      <th className="text-center py-1 text-gray-500 font-medium w-12">NCM</th>
                      <th className="text-center py-1 text-gray-500 font-medium w-10">UN</th>
                      <th className="text-right py-1 text-gray-500 font-medium w-12">QTD</th>
                      <th className="text-right py-1 text-gray-500 font-medium w-20">VL UNIT</th>
                      <th className="text-right py-1 text-gray-500 font-medium w-20">VL TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showDanfePreview.items.map(item => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="py-1 text-black">{item.description || "---"}</td>
                        <td className="text-center py-1 text-black">{item.ncm || "---"}</td>
                        <td className="text-center py-1 text-black">{item.unit || "UN"}</td>
                        <td className="text-right py-1 text-black">{item.quantity}</td>
                        <td className="text-right py-1 text-black">{item.unitPrice.toFixed(2)}</td>
                        <td className="text-right py-1 text-black font-medium">{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="p-4 border-b border-gray-300">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-2">CALCULO DO IMPOSTO</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <p className="text-[8px] text-gray-400">VL TOTAL PRODUTOS</p>
                    <p className="text-[12px] text-black font-medium">{showDanfePreview.subtotal.toFixed(2)}</p>
                  </div>
                  {showDanfePreview.discount > 0 && (
                    <div>
                      <p className="text-[8px] text-gray-400">DESCONTO</p>
                      <p className="text-[12px] text-red-600 font-medium">{showDanfePreview.discount.toFixed(2)}</p>
                    </div>
                  )}
                  {showDanfePreview.taxAmount > 0 && (
                    <div>
                      <p className="text-[8px] text-gray-400">VL IMPOSTOS</p>
                      <p className="text-[12px] text-black font-medium">{showDanfePreview.taxAmount.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[8px] text-gray-400">VL TOTAL DA NOTA</p>
                    <p className="text-[14px] text-black font-bold">{showDanfePreview.total.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Info adicional */}
              <div className="p-4 border-b border-gray-300">
                <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-1">DADOS ADICIONAIS</p>
                <p className="text-[10px] text-gray-700">{showDanfePreview.description || showDanfePreview.observations || "Sem informacoes adicionais"}</p>
                {showDanfePreview.nfeSefazStatus && (
                  <p className="text-[10px] text-green-600 mt-1 font-medium">{showDanfePreview.nfeSefazStatus} | Protocolo: {showDanfePreview.nfeProtocol}</p>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 flex items-center justify-between">
                <p className="text-[9px] text-gray-400">Emissao: {formatDate(showDanfePreview.issueDate)} | Vencimento: {formatDate(showDanfePreview.dueDate)} | Pagamento: {PAYMENT_METHODS.find(p => p.value === showDanfePreview.paymentMethod)?.label || showDanfePreview.paymentMethod}</p>
                <button onClick={() => setShowDanfePreview(null)} className="px-4 py-2 rounded-xl text-[12px] bg-gray-100 text-gray-700 hover:bg-gray-200">Fechar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inutilizacao Modal */}
      <AnimatePresence>
        {showInutilizacao && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowInutilizacao(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5" style={{ color: "var(--accent)" }} />
                <h3 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Inutilizacao de Numeracao</h3>
              </div>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                Inutilize faixas de numeracao que nao serao utilizadas (ex: saltos de numeracao). Sera comunicado a SEFAZ apos integracao.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Numero Inicio</label>
                  <input value={inutNumInicio} onChange={e => setInutNumInicio(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 1" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Numero Fim</label>
                  <input value={inutNumFim} onChange={e => setInutNumFim(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 10" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div>
                <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Justificativa (min. 15 caracteres)</label>
                <textarea value={inutJustificativa} onChange={e => setInutJustificativa(e.target.value)} placeholder="Motivo da inutilizacao..." rows={3} className="w-full rounded-xl px-4 py-3 text-[13px] focus:outline-none resize-none" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowInutilizacao(false)} className="px-4 py-2 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Cancelar</button>
                <button onClick={handleInutilizacao} disabled={!inutNumInicio || !inutNumFim || inutJustificativa.trim().length < 15} className="px-5 py-2 rounded-xl text-[13px] disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>Inutilizar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Invoice Form Component ============
function InvoiceForm({ invoice, clients, config, onSave, onCancel, canEdit }: {
  invoice: Invoice | null;
  clients: any[];
  config: NfeConfig;
  onSave: (inv: Invoice) => Promise<void>;
  onCancel: () => void;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<Invoice>(() => invoice || {
    id: generateId(), number: String(config.ultimoNumeroNfe + 1).padStart(9, "0"),
    series: config.serieNfe || "1", status: "draft",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date().toISOString().split("T")[0],
    clientName: "", clientDocument: "", clientEmail: "", clientPhone: "",
    clientAddress: "", clientCity: "", clientState: "", clientCep: "",
    items: [{ id: "item_1", description: "", quantity: 1, unitPrice: 0, total: 0, unit: "UN" }],
    subtotal: 0, discount: 0, taxRate: config.aliquotaIss || 0, taxAmount: 0, total: 0,
    paymentMethod: "pix", installments: 1, description: "",
    createdAt: new Date().toISOString(), sentByEmail: false,
  });
  const [saving, setSaving] = useState(false);

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const recalcTotals = (items: InvoiceItem[], discount: number, taxRate: number) => {
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const afterDiscount = subtotal - discount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount;
    setForm(p => ({ ...p, items, subtotal, discount, taxRate, taxAmount, total }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const newItems = [...form.items];
    (newItems[idx] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice") {
      newItems[idx].total = newItems[idx].quantity * newItems[idx].unitPrice;
    }
    recalcTotals(newItems, form.discount, form.taxRate);
  };

  const addItem = () => {
    const newItems = [...form.items, { id: `item_${Date.now()}`, description: "", quantity: 1, unitPrice: 0, total: 0, unit: "UN" }];
    recalcTotals(newItems, form.discount, form.taxRate);
  };

  const removeItem = (idx: number) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== idx);
    recalcTotals(newItems, form.discount, form.taxRate);
  };

  const selectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setForm(p => ({
      ...p,
      clientId,
      clientName: client.razaoSocial || client.nomeFantasia || client.fullName || "",
      clientDocument: client.cnpj || client.cpf || "",
      clientEmail: client.email || "",
      clientPhone: client.phone || "",
      clientAddress: `${client.street || ""}, ${client.number || ""}`,
      clientCity: client.city || "",
      clientState: client.state || "",
      clientCep: client.cep || "",
      clientInscricaoMunicipal: client.inscricaoMunicipal || "",
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); toast.success("Nota salva como rascunho"); } finally { setSaving(false); }
  };

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.razaoSocial || c.nomeFantasia || c.fullName || c.email || c.id,
  }));

  const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
  const labelStyle = { color: "var(--text-secondary)" };

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onCancel} className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        <ChevronLeft className="w-4 h-4" /> Voltar para lista
      </button>

      {/* Preview Banner */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.6))" }}>
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[16px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {invoice ? `Editando NF-e #${form.number}` : "Nova Nota Fiscal"}
              </h2>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Preencha os dados e envie para aprovacao</p>
            </div>
          </div>
          <p className="text-[22px]" style={{ fontWeight: 700, color: "var(--accent)" }}>{formatCurrency(form.total)}</p>
        </div>

        {/* Client Section */}
        <div className="mb-5">
          <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
            <User className="w-4 h-4" style={{ color: "var(--accent)" }} /> Dados do Cliente
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Selecionar Cliente Cadastrado</label>
              <CustomSelect options={[{ value: "", label: "Selecionar..." }, ...clientOptions]} value={form.clientId || ""} onChange={selectClient} searchable />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Razao Social / Nome</label>
              <input value={form.clientName} onChange={e => updateField("clientName", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>CPF/CNPJ</label>
              <input value={form.clientDocument} onChange={e => updateField("clientDocument", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" maxLength={18} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>E-mail</label>
              <input value={form.clientEmail} onChange={e => updateField("clientEmail", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Telefone</label>
              <input value={form.clientPhone} onChange={e => updateField("clientPhone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Endereco</label>
              <input value={form.clientAddress} onChange={e => updateField("clientAddress", e.target.value)} placeholder="Rua, numero" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Cidade</label>
              <input value={form.clientCity} onChange={e => updateField("clientCity", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] mb-1 block" style={labelStyle}>UF</label>
                <CustomSelect options={UF_OPTIONS} value={form.clientState} onChange={v => updateField("clientState", v)} />
              </div>
              <div>
                <label className="text-[11px] mb-1 block" style={labelStyle}>CEP</label>
                <input value={form.clientCep} onChange={e => updateField("clientCep", maskCep(e.target.value))} placeholder="00000-000" maxLength={9} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="mb-5">
          <h3 className="text-[13px] mb-3 flex items-center justify-between" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: "var(--accent)" }} /> Itens / Servicos
            </span>
            <button onClick={addItem} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 500 }}>
              <Plus className="w-3 h-3" /> Adicionar
            </button>
          </h3>
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={item.id} className="space-y-1.5">
                <div className="grid grid-cols-[1fr_80px_120px_120px_36px] gap-2 items-end">
                  <div>
                    {idx === 0 && <label className="text-[10px] mb-1 block" style={labelStyle}>Descricao</label>}
                    <input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Descricao do servico ou produto" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} />
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[10px] mb-1 block" style={labelStyle}>Qtd</label>}
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} className="w-full rounded-xl px-3 py-2.5 text-[13px] text-center focus:outline-none" style={inputStyle} />
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[10px] mb-1 block" style={labelStyle}>Valor Unit.</label>}
                    <input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", Number(e.target.value))} className="w-full rounded-xl px-3 py-2.5 text-[13px] text-right focus:outline-none" style={inputStyle} />
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[10px] mb-1 block" style={labelStyle}>Total</label>}
                    <div className="rounded-xl px-3 py-2.5 text-[13px] text-right" style={{ ...inputStyle, opacity: 0.7 }}>{formatCurrency(item.total)}</div>
                  </div>
                  <button onClick={() => removeItem(idx)} className="p-2 rounded-lg" style={{ color: form.items.length > 1 ? "#ef4444" : "var(--text-muted)" }} disabled={form.items.length <= 1}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* NCM, CFOP, Unidade */}
                <div className="grid grid-cols-[120px_120px_80px_1fr] gap-2 ml-0">
                  <div>
                    {idx === 0 && <label className="text-[9px] mb-0.5 block" style={{ color: "var(--text-muted)" }}>NCM</label>}
                    <input value={item.ncm || ""} onChange={e => updateItem(idx, "ncm", e.target.value)} placeholder="00000000" maxLength={10} className="w-full rounded-lg px-3 py-1.5 text-[11px] focus:outline-none" style={inputStyle} />
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[9px] mb-0.5 block" style={{ color: "var(--text-muted)" }}>CFOP</label>}
                    <input value={item.cfop || ""} onChange={e => updateItem(idx, "cfop", e.target.value)} placeholder="5102" maxLength={4} className="w-full rounded-lg px-3 py-1.5 text-[11px] focus:outline-none" style={inputStyle} />
                  </div>
                  <div>
                    {idx === 0 && <label className="text-[9px] mb-0.5 block" style={{ color: "var(--text-muted)" }}>Unidade</label>}
                    <input value={item.unit || "UN"} onChange={e => updateItem(idx, "unit", e.target.value)} className="w-full rounded-lg px-3 py-1.5 text-[11px] focus:outline-none" style={inputStyle} />
                  </div>
                  <div />
                </div>
                {idx < form.items.length - 1 && <div className="border-b pt-1" style={{ borderColor: "var(--border-extra-subtle)" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Totals + Payment */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              <CreditCard className="w-4 h-4" style={{ color: "var(--accent)" }} /> Pagamento
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] mb-1 block" style={labelStyle}>Forma de Pagamento</label>
                <CustomSelect options={PAYMENT_METHODS} value={form.paymentMethod} onChange={v => updateField("paymentMethod", v)} />
              </div>
              <div>
                <label className="text-[11px] mb-1 block" style={labelStyle}>Parcelas</label>
                <CustomSelect options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}x` }))} value={String(form.installments)} onChange={v => updateField("installments", Number(v))} />
              </div>
              <div>
                <label className="text-[11px] mb-1 block" style={labelStyle}>Data Emissao</label>
                <DatePickerInput value={form.issueDate} onChange={v => updateField("issueDate", v)} />
              </div>
              <div>
                <label className="text-[11px] mb-1 block" style={labelStyle}>Data Vencimento</label>
                <DatePickerInput value={form.dueDate} onChange={v => updateField("dueDate", v)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-[11px] mb-1 block" style={labelStyle}>Descricao da NF-e</label>
              <textarea value={form.description} onChange={e => updateField("description", e.target.value)} rows={2} placeholder="Descricao principal que aparecera na nota" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={inputStyle} />
            </div>
            <div className="mt-3">
              <label className="text-[11px] mb-1 block" style={labelStyle}>Observacoes Adicionais</label>
              <textarea value={form.observations || ""} onChange={e => updateField("observations", e.target.value)} rows={2} placeholder="Informacoes complementares (opcional)" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={inputStyle} />
            </div>
          </div>

          <div>
            <h3 className="text-[13px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
              <DollarSign className="w-4 h-4" style={{ color: "var(--accent)" }} /> Totalizadores
            </h3>
            <div className="space-y-3 p-4 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
              <div className="flex justify-between text-[13px]">
                <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(form.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span style={{ color: "var(--text-secondary)" }}>Desconto (R$)</span>
                <input type="number" step="0.01" value={form.discount} onChange={e => recalcTotals(form.items, Number(e.target.value), form.taxRate)} className="w-[120px] rounded-lg px-3 py-1.5 text-[13px] text-right focus:outline-none" style={inputStyle} />
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span style={{ color: "var(--text-secondary)" }}>Impostos (%)</span>
                <input type="number" step="0.01" value={form.taxRate} onChange={e => recalcTotals(form.items, form.discount, Number(e.target.value))} className="w-[120px] rounded-lg px-3 py-1.5 text-[13px] text-right focus:outline-none" style={inputStyle} />
              </div>
              {form.taxAmount > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: "var(--text-muted)" }}>Valor imposto</span>
                  <span style={{ color: "var(--text-secondary)" }}>{formatCurrency(form.taxAmount)}</span>
                </div>
              )}
              <div className="pt-3 flex justify-between text-[16px]" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>Total</span>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>{formatCurrency(form.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Validation warnings */}
        {(() => {
          const warnings: string[] = [];
          if (!form.clientName) warnings.push("Nome do cliente");
          if (!form.clientDocument) warnings.push("CPF/CNPJ");
          if (!form.items[0]?.description) warnings.push("Descricao do item");
          if (form.total <= 0) warnings.push("Valor total > 0");
          return warnings.length > 0 ? (
            <div className="flex items-start gap-3 p-3 rounded-xl mt-4" style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
              <div>
                <p className="text-[12px]" style={{ fontWeight: 500, color: "#f59e0b" }}>Campos obrigatorios pendentes</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{warnings.join(" | ")}</p>
              </div>
            </div>
          ) : null;
        })()}

        {/* Save buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-[13px]" style={{ color: "var(--text-secondary)" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontWeight: 500 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Salvar Rascunho
          </button>
          <button onClick={async () => {
            const warnings: string[] = [];
            if (!form.clientName) warnings.push("Nome do cliente");
            if (!form.clientDocument) warnings.push("CPF/CNPJ");
            if (!form.items[0]?.description) warnings.push("Descricao do item");
            if (form.total <= 0) warnings.push("Valor total deve ser maior que zero");
            if (warnings.length > 0) {
              toast.error("Preencha os campos obrigatorios", { description: warnings.join(", ") });
              return;
            }
            const updated = { ...form, status: "pending" as InvoiceStatus };
            setSaving(true);
            try { await onSave(updated); toast.success("Nota enviada para aprovacao"); } finally { setSaving(false); }
          }} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar para Aprovacao
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Config Panel Component ============
function ConfigPanel({ config, onSave, canEdit }: {
  config: NfeConfig;
  onSave: (cfg: NfeConfig) => Promise<void>;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<NfeConfig>(config);
  const [saving, setSaving] = useState(false);

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); toast.success("Configuracoes salvas com sucesso"); } finally { setSaving(false); }
  };

  const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };
  const labelStyle = { color: "var(--text-secondary)" };

  return (
    <div className="space-y-5">
      {/* Company Info */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <h3 className="text-[14px] mb-4 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
          <Building2 className="w-4 h-4" style={{ color: "var(--accent)" }} /> Dados do Emitente
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Razao Social</label>
            <input value={form.razaoSocial} onChange={e => updateField("razaoSocial", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Nome Fantasia</label>
            <input value={form.nomeFantasia} onChange={e => updateField("nomeFantasia", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>CNPJ</label>
            <input value={form.cnpj} onChange={e => updateField("cnpj", maskCpfCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Inscricao Estadual</label>
            <input value={form.inscricaoEstadual} onChange={e => updateField("inscricaoEstadual", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Inscricao Municipal</label>
            <input value={form.inscricaoMunicipal} onChange={e => updateField("inscricaoMunicipal", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Regime Tributario</label>
            <CustomSelect options={REGIME_TRIBUTARIO} value={form.regimeTributario} onChange={v => updateField("regimeTributario", v)} disabled={!canEdit} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="col-span-2">
            <label className="text-[11px] mb-1 block" style={labelStyle}>Endereco</label>
            <input value={form.endereco} onChange={e => updateField("endereco", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Numero</label>
            <input value={form.numero} onChange={e => updateField("numero", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Bairro</label>
            <input value={form.bairro} onChange={e => updateField("bairro", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Cidade</label>
            <input value={form.cidade} onChange={e => updateField("cidade", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>UF</label>
            <CustomSelect options={UF_OPTIONS} value={form.uf} onChange={v => updateField("uf", v)} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>CEP</label>
            <input value={form.cep} onChange={e => updateField("cep", maskCep(e.target.value))} placeholder="00000-000" maxLength={9} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-[11px] mb-1 block" style={labelStyle}>Telefone</label>
            <input value={form.telefone} onChange={e => updateField("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
          </div>
        </div>
      </div>

      {/* Certificate + NF-e Settings */}
      <div className="grid grid-cols-2 gap-5">
        {/* Certificate A1 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[14px] mb-4 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent)" }} /> Certificado Digital A1
          </h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: form.certificateA1Uploaded ? "rgba(34,197,94,0.05)" : "rgba(245,158,11,0.05)", border: `1px solid ${form.certificateA1Uploaded ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: form.certificateA1Uploaded ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)" }}>
                {form.certificateA1Uploaded ? <ShieldCheck className="w-5 h-5 text-[#22c55e]" /> : <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />}
              </div>
              <div className="flex-1">
                <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                  {form.certificateA1Uploaded ? "Certificado A1 instalado" : "Nenhum certificado instalado"}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {form.certificateA1Uploaded && form.certificateExpiry ? `Valido ate ${form.certificateExpiry}` : "Envie o arquivo .pfx do certificado A1"}
                </p>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              O certificado digital A1 (.pfx) e necessario para assinar as notas fiscais eletronicas e comunicar com a SEFAZ. A senha do certificado sera solicitada no momento do envio.
            </p>
            {canEdit && (
              <button onClick={() => updateField("certificateA1Uploaded", !form.certificateA1Uploaded)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] w-full justify-center" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontWeight: 500 }}>
                <Upload className="w-4 h-4" /> {form.certificateA1Uploaded ? "Substituir Certificado" : "Enviar Certificado A1 (.pfx)"}
              </button>
            )}
          </div>
        </div>

        {/* NF-e Settings */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[14px] mb-4 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
            <Settings className="w-4 h-4" style={{ color: "var(--accent)" }} /> Configuracoes NF-e
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Serie NF-e</label>
              <input value={form.serieNfe} onChange={e => updateField("serieNfe", e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Ultimo Numero</label>
              <input type="number" value={form.ultimoNumeroNfe} onChange={e => updateField("ultimoNumeroNfe", Number(e.target.value))} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Ambiente</label>
              <CustomSelect
                options={[
                  { value: "homologacao", label: "Homologacao (Testes)" },
                  { value: "producao", label: "Producao" },
                ]}
                value={form.ambiente} onChange={v => updateField("ambiente", v)} disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-[11px] mb-1 block" style={labelStyle}>Aliquota ISS (%)</label>
              <input type="number" step="0.01" value={form.aliquotaIss || ""} onChange={e => updateField("aliquotaIss", Number(e.target.value))} placeholder="Ex: 5.00" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] mb-1 block" style={labelStyle}>Codigo Municipio IBGE</label>
              <input value={form.codigoMunicipio || ""} onChange={e => updateField("codigoMunicipio", e.target.value)} placeholder="Ex: 3550308 (Sao Paulo)" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={inputStyle} disabled={!canEdit} />
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: form.ambiente === "producao" ? "rgba(239,68,68,0.05)" : "rgba(59,130,246,0.05)", border: `1px solid ${form.ambiente === "producao" ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"}` }}>
            <div className="flex items-center gap-2 text-[12px]" style={{ fontWeight: 500, color: form.ambiente === "producao" ? "#ef4444" : "#3b82f6" }}>
              {form.ambiente === "producao" ? <AlertTriangle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              {form.ambiente === "producao" ? "AMBIENTE DE PRODUCAO - Notas serao enviadas para a SEFAZ" : "Ambiente de Homologacao - Notas de teste (sem validade fiscal)"}
            </div>
          </div>
        </div>
      </div>

      {/* Integration Provider */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <h3 className="text-[14px] mb-4 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
          <Zap className="w-4 h-4" style={{ color: "var(--accent)" }} /> Integracao com API de Emissao
        </h3>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-secondary)" }}>
          Selecione um provedor intermediario para emissao de NF-e/NFS-e via SEFAZ. A API intermediaria cuida da comunicacao, assinatura e retorno do XML/PDF autorizado.
        </p>

        {/* Provider Cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {([
            { id: "enotas" as const, name: "eNotas", desc: "Gateway completo para NF-e, NFS-e, NFC-e e CT-e. Suporte a todos os municipios.", url: "enotas.com.br", fields: [{ key: "apiKey", label: "API Key" }] },
            { id: "focusnfe" as const, name: "Focus NFe", desc: "API robusta com alta disponibilidade. NF-e, NFS-e e NFC-e com documentacao detalhada.", url: "focusnfe.com.br", fields: [{ key: "apiKey", label: "Token de Acesso" }] },
            { id: "webmaniabrq" as const, name: "WebmaniaBR", desc: "Emissao simplificada com painel administrativo. NF-e, NFS-e e NFC-e para PMEs.", url: "webmaniabr.com", fields: [{ key: "apiKey", label: "Access Token" }, { key: "apiSecret", label: "Access Token Secret" }, { key: "tokenExtra", label: "Consumer Key" }] },
          ]).map(provider => {
            const isSelected = form.integrationProvider === provider.id;
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => canEdit && updateField("integrationProvider", isSelected ? "" : provider.id)}
                disabled={!canEdit}
                className="p-4 rounded-xl text-left transition-all relative"
                style={{
                  backgroundColor: isSelected ? "rgba(var(--accent-rgb, 99,102,241), 0.06)" : "var(--bg-input)",
                  border: `2px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                  cursor: canEdit ? "pointer" : "default",
                }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <p className="text-[13px] mb-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{provider.name}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{provider.desc}</p>
                <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <ExternalLink className="w-3 h-3" /> {provider.url}
                </div>
              </button>
            );
          })}
        </div>

        {/* Toggle + Config when provider selected */}
        {form.integrationProvider && (
          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.integrationEnabled ? "rgba(34,197,94,0.1)" : "rgba(138,138,153,0.1)" }}>
                  {form.integrationEnabled ? <CheckCircle2 className="w-4 h-4 text-[#22c55e]" /> : <Ban className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                </div>
                <div>
                  <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    Integracao {form.integrationProvider === "enotas" ? "eNotas" : form.integrationProvider === "focusnfe" ? "Focus NFe" : "WebmaniaBR"}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {form.integrationEnabled ? "Ativa - notas serao emitidas via API" : "Desativada - emissao manual"}
                  </p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => updateField("integrationEnabled", !form.integrationEnabled)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: form.integrationEnabled ? "var(--accent)" : "var(--border-default)" }}
                >
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: form.integrationEnabled ? "22px" : "2px" }} />
                </button>
              )}
            </div>

            {/* API Keys */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
              <h4 className="text-[12px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                <Shield className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} /> Credenciais da API
              </h4>
              <div className="space-y-3">
                {/* API Key - always shown */}
                <div>
                  <label className="text-[11px] mb-1 block" style={labelStyle}>
                    {form.integrationProvider === "enotas" ? "API Key" : form.integrationProvider === "focusnfe" ? "Token de Acesso" : "Access Token"}
                  </label>
                  <input
                    type="password"
                    value={form.integrationApiKey || ""}
                    onChange={e => updateField("integrationApiKey", e.target.value)}
                    placeholder="Cole sua chave aqui..."
                    className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none font-mono"
                    style={inputStyle}
                    disabled={!canEdit}
                  />
                </div>

                {/* API Secret - for WebmaniaBR */}
                {form.integrationProvider === "webmaniabrq" && (
                  <>
                    <div>
                      <label className="text-[11px] mb-1 block" style={labelStyle}>Access Token Secret</label>
                      <input
                        type="password"
                        value={form.integrationApiSecret || ""}
                        onChange={e => updateField("integrationApiSecret", e.target.value)}
                        placeholder="Cole o secret aqui..."
                        className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none font-mono"
                        style={inputStyle}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={labelStyle}>Consumer Key</label>
                      <input
                        type="password"
                        value={form.integrationTokenExtra || ""}
                        onChange={e => updateField("integrationTokenExtra", e.target.value)}
                        placeholder="Cole a consumer key aqui..."
                        className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none font-mono"
                        style={inputStyle}
                        disabled={!canEdit}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Connection Status */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{
                    backgroundColor: form.integrationStatus === "connected" ? "#22c55e" : form.integrationStatus === "error" ? "#ef4444" : "#8a8a99"
                  }} />
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {form.integrationStatus === "connected" ? "Conectado" : form.integrationStatus === "error" ? "Erro na conexao" : "Nao testado"}
                  </span>
                  {form.integrationLastTest && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      (Ultimo teste: {form.integrationLastTest})
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      if (!form.integrationApiKey) {
                        toast.error("Preencha a chave da API antes de testar");
                        return;
                      }
                      if (form.integrationProvider === "webmaniabrq" && (!form.integrationApiSecret || !form.integrationTokenExtra)) {
                        toast.error("Preencha todas as credenciais da WebmaniaBR");
                        return;
                      }
                      updateField("integrationStatus", "connected");
                      updateField("integrationLastTest", new Date().toLocaleString("pt-BR"));
                      toast.success("Conexao com a API testada com sucesso (simulado)");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors"
                    style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}
                  >
                    <Link2 className="w-3.5 h-3.5" /> Testar Conexao
                  </button>
                )}
              </div>
            </div>

            {/* Provider-specific info */}
            <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)" }}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-[#3b82f6] shrink-0" />
                <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {form.integrationProvider === "enotas" && (
                    <>
                      <p className="mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Como obter sua API Key eNotas:</p>
                      <p>1. Acesse o painel em <span style={{ color: "var(--accent)" }}>app.enotas.com.br</span></p>
                      <p>2. Va em Configuracoes &gt; Integracao &gt; API</p>
                      <p>3. Copie a API Key gerada e cole no campo acima</p>
                      <p className="mt-1">4. Cadastre sua empresa e certificado digital A1 no painel eNotas</p>
                    </>
                  )}
                  {form.integrationProvider === "focusnfe" && (
                    <>
                      <p className="mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Como obter seu Token Focus NFe:</p>
                      <p>1. Acesse <span style={{ color: "var(--accent)" }}>app.focusnfe.com.br</span></p>
                      <p>2. Va em Configuracoes &gt; Tokens de Acesso</p>
                      <p>3. Crie um token para o ambiente desejado (homologacao/producao)</p>
                      <p className="mt-1">4. Configure sua empresa e envie o certificado A1 pelo painel Focus</p>
                    </>
                  )}
                  {form.integrationProvider === "webmaniabrq" && (
                    <>
                      <p className="mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Como obter credenciais WebmaniaBR:</p>
                      <p>1. Acesse <span style={{ color: "var(--accent)" }}>webmaniabr.com/painel</span></p>
                      <p>2. Va em API &gt; Credenciais</p>
                      <p>3. Copie Access Token, Access Token Secret e Consumer Key</p>
                      <p className="mt-1">4. Configure a empresa e o certificado A1 no painel WebmaniaBR</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEFAZ Info Cards */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <h3 className="text-[14px] mb-3 flex items-center gap-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>
          <FileCheck className="w-4 h-4" style={{ color: "var(--accent)" }} /> Comunicacao SEFAZ
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
            <p className="text-[12px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Comunicacao Segura</p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Assinatura XML com certificado A1, comunicacao TLS 1.2+ com webservices SEFAZ estadual.</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
            <p className="text-[12px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Layout NF-e 4.0</p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Compativel com o layout mais recente da NF-e (versao 4.0), incluindo DANFE em PDF.</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--bg-input)" }}>
            <p className="text-[12px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Eventos Fiscais</p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Suporte a cancelamento (em ate 24h), carta de correcao (CC-e) e inutilizacao de numeracao.</p>
          </div>
        </div>
      </div>

      {/* Save */}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px]" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar Configuracoes
          </button>
        </div>
      )}
    </div>
  );
}
