// Finance data store using React context + localStorage
export type ExpenseType = "fixed" | "variable";
export type ExpenseCategory = "aluguel" | "salarios" | "internet" | "software" | "marketing" | "impostos" | "comissoes" | "materiais" | "prolabore" | "outros";
export type AccountType = "payable" | "receivable";
export type AccountStatus = "pending" | "paid" | "overdue";
export type EntryType = "income" | "expense";

export interface Expense {
  id: string;
  name: string;
  type: "Fixo" | "Variável"; // Fixed vs Variable (Will transition to just Fixed)
  category: string;
  recurrence: string;
  supplier?: string;
  amount: number;
  unit: "R$" | "%";
  isPercentage?: boolean;
  dueDate?: string;
  autoPost?: boolean;
  description?: string;
  notes?: string;
  paymentMethod?: string;
}

export interface VariableParameter {
  id: string;
  name: string; // e.g., "Imposto Simples Nacional", "Marketing - Aquisição"
  type: "tax" | "card_fee" | "commission" | "marketing" | "profit_margin" | "custom";
  value: number;
  unit: "%" | "R$";
  incidence: "gross_revenue" | "net_revenue" | "fixed_per_sale";
  paymentMethodRef?: string; // e.g., "Cartão de Crédito", "PIX"
  installments?: number; // 1 to 12
  active: boolean;
}

export interface DirectCost {
  id: string;
  description?: string;
  name?: string;
  amount: number;
}

export interface ServiceCost {
  id: string;
  name: string;
  amount: number;
}

export interface Partner {
  id: string;
  name: string;
  role: string;
  desiredWithdrawal: number; // pro-labore / salario fixo (usado no break-even)
  type?: "socio" | "clt" | "pj" | "freelancer"; // tipo de vinculo
  fixedSalary?: number; // salario base (CLT/PJ mensal)
  hasCommission?: boolean;
  commissionRate?: number; // %
  commissionBase?: "gross" | "net";
  payPerProduction?: boolean;
  productionLabel?: string; // "video editado", "post criado", etc.
  productionRate?: number; // valor por unidade
  benefits?: {
    vr: number;
    va: number;
    vt: number;
    helpCost: number;
    other: number;
    otherLabel: string;
  };
  document?: string; // CPF ou CNPJ
  pixKey?: string;
  bankInfo?: string;
  paymentDay?: number;
  status?: "active" | "inactive";
}

// Calcula custo fixo mensal total de uma pessoa (salario + prolabore + beneficios)
export function getPartnerMonthlyCost(p: Partner): number {
  const base = (p.fixedSalary || 0) + (p.desiredWithdrawal || 0);
  const ben = p.benefits
    ? (p.benefits.vr + p.benefits.va + p.benefits.vt + p.benefits.helpCost + p.benefits.other)
    : 0;
  return base + ben;
}

export interface CommissionMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  bankAccount?: string;
  pixKey?: string;
  type: "vendedor" | "influenciador" | "indicador" | "parceiro";
  commissionMode: "unique" | "per_service"; // unique = same rate for all, per_service = different rates
  defaultRate: number; // % default commission
  defaultIncidence: "gross_revenue" | "net_revenue"; // apply on gross or net
  serviceRates?: { serviceId: string; rate: number; incidence: "gross_revenue" | "net_revenue" }[];
  active: boolean;
}

export interface Account {
  id: string;
  type: AccountType;
  description: string;
  amount: number;
  dueDate: string;
  status: AccountStatus;
  client?: string;
  category?: string;
}

export interface DailyEntry {
  id: string;
  date: string;
  type: EntryType;
  description: string;
  amount: number; // Gross amount
  category: string;
  client?: string;
  supplier?: string;
  status?: "pending" | "paid";
  expenseId?: string;
  recurrence?: string;
  paymentMethod?: string;
  
  // Smart Finance additions
  installments?: number;
  directCosts?: DirectCost[]; // Custo Direto / CMV
  provisionedTaxes?: number;
  provisionedFees?: number;
  provisionedCommissions?: number;
  provisionedMarketing?: number;
  netAmount?: number; // amount - costs - provisions
  
  // Commission tracking
  saleType?: "direct" | "commissioned"; // venda direta ou comissionada
  commissionMemberId?: string; // id do comissionado
  commissionAmount?: number; // valor calculado da comissao
  
  // Service tracking for CPA/ROAS
  serviceId?: string; // id do servico vinculado
  
  // Production payment tracking
  productionPayment?: boolean;
  productionPartnerId?: string;
  productionQuantity?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  priceDisplay: number;
  priceMinimum: number;
  averageTime: string;
  variableCost: number;
  variableCostIsPercentage: boolean;
  marketingPercentage: number;
  // Enhanced fields
  description?: string;
  costs?: ServiceCost[];
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  discountType?: "%" | "R$";
  discountValue?: number;
  cashDiscountPercent?: number;
  maxInstallments?: number;
  interestBearer?: "client" | "company";
  deliveryType?: "unique" | "weekly" | "monthly" | "recurring";
  cpaMeta?: number;
  cpaMetaType?: "R$" | "%";
}

export interface GoalsPRO {
  pessimistic: number;
  realistic: number;
  optimistic: number;
  aggressive?: number;
  workDaysPerMonth: number;
  // Marketing goals
  targetROAS?: number; // Return on Ad Spend target (e.g. 5 = 5x)
  targetCPA?: number; // Cost per Acquisition target in R$
  targetCPL?: number; // Cost per Lead target in R$
}

export type MarketingChannelType = "meta_ads" | "google_ads" | "outdoor" | "influencer" | "flyers" | "event" | "email" | "seo" | "other";

export interface MarketingAction {
  id: string;
  name: string;
  channel: MarketingChannelType;
  investment: number;
  expectedReturn?: number;
  startDate: string;
  endDate?: string;
  status: "planned" | "active" | "completed" | "cancelled";
  paymentStatus: "pending" | "paid" | "partial";
  paymentMethod?: string;
  installments?: number;
  focalServices?: string[]; // service categories this action targets
  notes?: string;
  // Tracking
  leadsGenerated?: number;
  conversions?: number;
  revenue?: number; // actual revenue attributed
  clicks?: number;
  impressions?: number;
}

export const MARKETING_CHANNELS: Record<MarketingChannelType, string> = {
  meta_ads: "Meta Ads (Facebook/Instagram)",
  google_ads: "Google Ads",
  outdoor: "Outdoor / Midia Fisica",
  influencer: "Influenciador(a)",
  flyers: "Folhetos / Impressos",
  event: "Evento / Feira",
  email: "E-mail Marketing",
  seo: "SEO / Organico",
  other: "Outro",
};

export const defaultMarketingActions: MarketingAction[] = [];

export const defaultExpenseCategories: string[] = [
  "Aluguel", "Salários", "Internet / Telecom", "Software / Ferramentas",
  "Marketing", "Impostos", "Comissões", "Materiais", "Pró-labore", "Outros",
];

export const defaultRecurrences: string[] = [
  "Mensal", "Semanal", "Quinzenal", "Trimestral", "Semestral", "Anual", "Avulso",
];

export const defaultSuppliers: string[] = [];

export const defaultPaymentMethods: string[] = [
  "PIX", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Dinheiro", "Transferência",
];

export const defaultVariableParameters: VariableParameter[] = [];
export const defaultPartners: Partner[] = [];
export const defaultCommissionMembers: CommissionMember[] = [];

export const mockExpenses: Expense[] = [];
export const mockAccounts: Account[] = [];
export const mockEntries: DailyEntry[] = [];
export const mockServices: Service[] = [];
export const mockGoals: GoalsPRO = {
  pessimistic: 0,
  realistic: 0,
  optimistic: 0,
  aggressive: 0,
  workDaysPerMonth: 22,
};

// Client Management
export type ClientType = "pf" | "pj";

export interface Client {
  id: string;
  type: ClientType;
  email: string;
  phone: string;
  notes?: string;
  createdAt: string;
  fullName?: string;
  cpf?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoMunicipal?: string;
  contactName?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

// Pipeline / Kanban
export type DealPriority = "low" | "medium" | "high" | "urgent";

export interface PipelineColumn {
  id: string;
  title: string;
  order: number;
  color: string;
  isWinColumn?: boolean;
  isLossColumn?: boolean;
}

export interface PipelineDeal {
  id: string;
  title: string;
  clientId?: string;
  serviceId?: string;
  serviceIds?: string[]; // multiple services support
  columnId: string;
  estimatedValue: number;
  probability: number;
  priority: DealPriority;
  contactName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  realValue?: number;
  paymentMethod?: string;
  installments?: number;
  paymentDate?: string;
  lossReason?: string;
  cancellationReason?: string;
}

export const DEFAULT_PIPELINE_COLUMNS: PipelineColumn[] = [
  { id: "col_prospect", title: "Prospecção", order: 0, color: "#3b82f6" },
  { id: "col_proposal", title: "Proposta Enviada", order: 1, color: "#8b5cf6" },
  { id: "col_negotiation", title: "Negociação", order: 2, color: "#f59e0b" },
  { id: "col_won", title: "Ganho", order: 3, color: "#22c55e", isWinColumn: true },
  { id: "col_lost", title: "Perdido", order: 4, color: "#ef4444", isLossColumn: true },
];

export const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const DEAL_PRIORITY_COLORS: Record<DealPriority, string> = {
  low: "#8a8a99",
  medium: "#3b82f6",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

// Projects / Production Kanban
export type ProjectStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "cancelled" | string;

export interface ProjectTag {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_PROJECT_TAGS: ProjectTag[] = [
  { id: "tag_design", label: "Design", color: "#ec4899" },
  { id: "tag_dev", label: "Desenvolvimento", color: "#3b82f6" },
  { id: "tag_content", label: "Conteudo", color: "#f59e0b" },
  { id: "tag_review", label: "Revisao", color: "#8b5cf6" },
  { id: "tag_urgent", label: "Urgente", color: "#ef4444" },
  { id: "tag_meeting", label: "Reuniao", color: "#06b6d4" },
];

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done";
  dueDate?: string;
  completedAt?: string;
  order: number;
  assignedTo?: string;
}

export interface Deliverable {
  id: string;
  type: "link" | "file";
  label: string;
  url: string; // URL for link or signed URL for file
  storagePath?: string; // Storage path for files (to refresh signed URLs)
  fileName?: string;
  fileSize?: number; // bytes
  mimeType?: string;
  createdAt: string;
  createdBy?: string;
  urlExpiresAt?: string; // ISO date when signed URL expires
}

export interface ProjectActivity {
  id: string;
  type: "created" | "status_changed" | "task_completed" | "deliverable_added" | "assigned" | "completed" | "cancelled" | "edited" | "entry_generated";
  description: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientId?: string;
  serviceId?: string;
  serviceIds?: string[]; // multiple services
  dealId?: string;
  status: ProjectStatus;
  priority: DealPriority;
  startDate: string;
  dueDate?: string;
  completedAt?: string;
  estimatedValue: number;
  tasks: ProjectTask[];
  deliverables?: Deliverable[];
  activityLog?: ProjectActivity[];
  tags?: string[]; // tag IDs
  notes?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  cancellationReason?: string;
  completionEntryId?: string; // ID of auto-generated financial entry
}

export interface ProjectColumn {
  id: string;
  title: string;
  status: ProjectStatus;
  order: number;
  color: string;
}

export const DEFAULT_PROJECT_COLUMNS: ProjectColumn[] = [
  { id: "proj_backlog", title: "Backlog", status: "backlog", order: 0, color: "#8a8a99" },
  { id: "proj_todo", title: "A Fazer", status: "todo", order: 1, color: "#3b82f6" },
  { id: "proj_progress", title: "Em Andamento", status: "in_progress", order: 2, color: "#f59e0b" },
  { id: "proj_review", title: "Em Revisao", status: "review", order: 3, color: "#8b5cf6" },
  { id: "proj_done", title: "Concluido", status: "done", order: 4, color: "#22c55e" },
  { id: "proj_cancelled", title: "Cancelado", status: "cancelled", order: 5, color: "#ef4444" },
];

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "A Fazer",
  in_progress: "Em Andamento",
  review: "Em Revisao",
  done: "Concluido",
  cancelled: "Cancelado",
};

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  backlog: "#8a8a99",
  todo: "#3b82f6",
  in_progress: "#f59e0b",
  review: "#8b5cf6",
  done: "#22c55e",
  cancelled: "#ef4444",
};

export const LOSS_REASONS = [
  "Preço acima do orçamento",
  "Escolheu concorrente",
  "Projeto cancelado",
  "Sem resposta / Ghosting",
  "Prazo não atendido",
  "Escopo inadequado",
  "Outro",
];

export const PROJECT_CANCEL_REASONS = [
  "Cliente cancelou",
  "Falta de pagamento",
  "Escopo inviável",
  "Mudança de prioridade",
  "Equipe indisponível",
  "Prazo estourado",
  "Projeto absorvido por outro",
  "Desistência mutua",
  "Outro",
];

// ========== Default data ==========
export const defaultClients: Client[] = [];
export const defaultPipelineColumns: PipelineColumn[] = [...DEFAULT_PIPELINE_COLUMNS];
export const defaultPipelineDeals: PipelineDeal[] = [];
export const defaultProjects: Project[] = [];
export const defaultProjectColumns: ProjectColumn[] = [...DEFAULT_PROJECT_COLUMNS];

// ========== Utility Functions ==========

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
}

export const SERVICE_CATEGORIES = [
  "Design", "Desenvolvimento", "Marketing", "Consultoria", "Conteudo",
  "Social Media", "Fotografia", "Video", "Treinamento", "Outro",
];

export interface BreakEvenResult {
  fixedCostsTotal: number;
  variableCostsPercent: number;
  breakEvenRevenue: number;
  breakEvenDaily: number;
  marginOfSafety: number;
  contributionMargin: number;
}

export function calculateSmartBreakEven(
  totalFixedExpenses: number,
  totalPartnerWithdrawals: number,
  totalVariablePercent: number
): BreakEvenResult {
  const fixedCostsTotal = totalFixedExpenses + totalPartnerWithdrawals;
  const variableCostsPercent = totalVariablePercent;

  const contributionMargin = (100 - variableCostsPercent) / 100;
  const breakEvenRevenue = contributionMargin > 0 ? fixedCostsTotal / contributionMargin : 0;
  const breakEvenDaily = breakEvenRevenue / 22;

  return {
    fixedCostsTotal,
    variableCostsPercent,
    breakEvenRevenue,
    breakEvenDaily,
    marginOfSafety: 0,
    contributionMargin: contributionMargin * 100,
  };
}

export function suggestSmartGoals(breakEven: BreakEvenResult): { pessimistic: number; realistic: number; optimistic: number; aggressive: number } {
  const base = breakEven.breakEvenRevenue;
  return {
    pessimistic: Math.round(base * 1.1),
    realistic: Math.round(base * 1.3),
    optimistic: Math.round(base * 1.6),
    aggressive: Math.round(base * 2.0),
  };
}

export interface SaleIntelligence {
  grossAmount: number;
  taxes: number;
  cardFees: number;
  fees: number;
  commissions: number;
  marketing: number;
  directCosts: number;
  directCostsTotal: number;
  netAmount: number;
  profitMargin: number;
  margin: number;
}

export function calculateSaleIntelligence(
  grossAmount: number,
  variableParams: VariableParameter[],
  paymentMethod?: string,
  installments?: number,
  directCosts?: DirectCost[],
  commissionRate?: number
): SaleIntelligence;
export function calculateSaleIntelligence(
  grossAmount: number,
  paymentMethod?: string,
  installments?: number,
  directCosts?: number | DirectCost[],
  variableParams?: VariableParameter[],
  commissionRate?: number
): SaleIntelligence;
export function calculateSaleIntelligence(
  grossAmount: number,
  variableParamsOrPaymentMethod: VariableParameter[] | string = [],
  paymentMethodOrInstallments?: string | number,
  installmentsOrDirectCosts?: number | DirectCost[],
  directCostsOrVariableParams?: DirectCost[] | VariableParameter[],
  variableParamsOrCommissionRate?: VariableParameter[] | number,
  commissionRate?: number
): SaleIntelligence {
  let resolvedVariableParams: VariableParameter[] = [];
  let resolvedPaymentMethod: string | undefined;
  let resolvedInstallments: number | undefined;
  let resolvedDirectCosts: DirectCost[] = [];
  let resolvedCommissionRate: number | undefined;

  if (Array.isArray(variableParamsOrPaymentMethod)) {
    resolvedVariableParams = variableParamsOrPaymentMethod;
    resolvedPaymentMethod =
      typeof paymentMethodOrInstallments === "string"
        ? paymentMethodOrInstallments
        : undefined;
    resolvedInstallments =
      typeof paymentMethodOrInstallments === "number"
        ? paymentMethodOrInstallments
        : typeof installmentsOrDirectCosts === "number"
          ? installmentsOrDirectCosts
          : undefined;
    resolvedDirectCosts = Array.isArray(directCostsOrVariableParams)
      ? (directCostsOrVariableParams as DirectCost[])
      : [];
    resolvedCommissionRate =
      typeof variableParamsOrCommissionRate === "number"
        ? variableParamsOrCommissionRate
        : commissionRate;
  } else {
    resolvedPaymentMethod = variableParamsOrPaymentMethod;
    resolvedInstallments =
      typeof paymentMethodOrInstallments === "number"
        ? paymentMethodOrInstallments
        : undefined;
    resolvedDirectCosts = Array.isArray(installmentsOrDirectCosts)
      ? installmentsOrDirectCosts
      : typeof installmentsOrDirectCosts === "number"
        ? [{ id: "legacy-direct-costs", description: "CMV", amount: installmentsOrDirectCosts }]
        : [];
    resolvedVariableParams = Array.isArray(directCostsOrVariableParams)
      ? (directCostsOrVariableParams as VariableParameter[])
      : [];
    resolvedCommissionRate =
      typeof variableParamsOrCommissionRate === "number"
        ? variableParamsOrCommissionRate
        : commissionRate;
  }

  let taxes = 0, cardFees = 0, commissions = 0, marketing = 0;
  const safeParams = Array.isArray(resolvedVariableParams) ? resolvedVariableParams : [];

  safeParams.filter(v => v.active).forEach(v => {
    const amount = v.unit === "%" ? (grossAmount * v.value / 100) : v.value;
    if (v.type === "tax") taxes += amount;
    else if (v.type === "card_fee") {
      if (!v.paymentMethodRef || v.paymentMethodRef === resolvedPaymentMethod) cardFees += amount;
    }
    else if (v.type === "commission") commissions += amount;
    else if (v.type === "marketing") marketing += amount;
  });

  if (resolvedCommissionRate) commissions = grossAmount * resolvedCommissionRate / 100;

  const directCostsTotal = (resolvedDirectCosts || []).reduce((s, c) => s + c.amount, 0);
  const netAmount = grossAmount - taxes - cardFees - commissions - marketing - directCostsTotal;
  const profitMargin = grossAmount > 0 ? (netAmount / grossAmount) * 100 : 0;

  return {
    grossAmount,
    taxes,
    cardFees,
    fees: cardFees,
    commissions,
    marketing,
    directCosts: directCostsTotal,
    directCostsTotal,
    netAmount,
    profitMargin,
    margin: profitMargin,
  };
}
