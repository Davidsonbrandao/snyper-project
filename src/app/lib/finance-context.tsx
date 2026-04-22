import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import {
  type Expense, type Account, type DailyEntry, type Service, type GoalsPRO,
  type VariableParameter, type Partner, type CommissionMember, type MarketingAction,
  type Client, type PipelineColumn, type PipelineDeal,
  type Project, type ProjectColumn,
  mockExpenses, mockAccounts, mockEntries, mockServices, mockGoals,
  defaultExpenseCategories, defaultRecurrences, defaultSuppliers, defaultPaymentMethods,
  defaultVariableParameters, defaultPartners, defaultCommissionMembers, defaultMarketingActions,
  defaultClients, defaultPipelineColumns, defaultPipelineDeals,
  defaultProjects, defaultProjectColumns,
  generateId,
} from "./finance-data";
import { apiFetch } from "./supabase";
import { useAuth } from "./auth-context";

interface FinanceContextType {
  expenses: Expense[];
  variableParams: VariableParameter[];
  partners: Partner[];
  commissionMembers: CommissionMember[];
  marketingActions: MarketingAction[];
  expenseCategories: string[];
  recurrences: string[];
  suppliers: string[];
  paymentMethods: string[];
  accounts: Account[];
  entries: DailyEntry[];
  services: Service[];
  goals: GoalsPRO;
  clients: Client[];
  pipelineColumns: PipelineColumn[];
  pipelineDeals: PipelineDeal[];
  projects: Project[];
  projectColumns: ProjectColumn[];
  isLoading: boolean;
  addExpense: (expense: Omit<Expense, "id">) => void;
  updateExpense: (id: string, expense: Omit<Expense, "id">) => void;
  removeExpense: (id: string) => void;
  addVariableParam: (param: Omit<VariableParameter, "id">) => void;
  updateVariableParam: (id: string, param: Omit<VariableParameter, "id">) => void;
  removeVariableParam: (id: string) => void;
  addPartner: (partner: Omit<Partner, "id">) => void;
  updatePartner: (id: string, partner: Omit<Partner, "id">) => void;
  removePartner: (id: string) => void;
  addCommissionMember: (member: Omit<CommissionMember, "id">) => void;
  updateCommissionMember: (id: string, member: Omit<CommissionMember, "id">) => void;
  removeCommissionMember: (id: string) => void;
  addMarketingAction: (action: Omit<MarketingAction, "id">) => void;
  updateMarketingAction: (id: string, action: Omit<MarketingAction, "id">) => void;
  removeMarketingAction: (id: string) => void;
  addExpenseCategory: (cat: string) => void;
  addRecurrence: (rec: string) => void;
  addSupplier: (sup: string) => void;
  addPaymentMethod: (method: string) => void;
  addAccount: (account: Omit<Account, "id">) => void;
  updateAccount: (id: string, account: Omit<Account, "id">) => void;
  updateAccountStatus: (id: string, status: Account["status"]) => void;
  removeAccount: (id: string) => void;
  addEntry: (entry: Omit<DailyEntry, "id">) => void;
  updateEntry: (id: string, entry: Omit<DailyEntry, "id">) => void;
  removeEntry: (id: string) => void;
  addService: (service: Omit<Service, "id">) => void;
  updateService: (id: string, service: Omit<Service, "id">) => void;
  removeService: (id: string) => void;
  updateGoals: (goals: GoalsPRO) => void;
  addClient: (client: Omit<Client, "id">) => Client;
  updateClient: (id: string, client: Omit<Client, "id">) => void;
  removeClient: (id: string) => void;
  setPipelineColumns: (columns: PipelineColumn[]) => void;
  addPipelineColumn: (column: Omit<PipelineColumn, "id">) => void;
  updatePipelineColumn: (id: string, column: Omit<PipelineColumn, "id">) => void;
  removePipelineColumn: (id: string) => void;
  addPipelineDeal: (deal: Omit<PipelineDeal, "id">) => void;
  updatePipelineDeal: (id: string, deal: Omit<PipelineDeal, "id">) => void;
  removePipelineDeal: (id: string) => void;
  moveDeal: (dealId: string, toColumnId: string) => void;
  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (id: string, project: Omit<Project, "id">) => void;
  removeProject: (id: string) => void;
  moveProject: (projectId: string, status: string) => void;
  setProjectColumns: (columns: ProjectColumn[]) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [variableParams, setVariableParams] = useState<VariableParameter[]>(defaultVariableParameters);
  const [partners, setPartners] = useState<Partner[]>(defaultPartners);
  const [commissionMembers, setCommissionMembers] = useState<CommissionMember[]>(defaultCommissionMembers);
  const [marketingActions, setMarketingActions] = useState<MarketingAction[]>(defaultMarketingActions);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(defaultExpenseCategories);
  const [recurrences, setRecurrences] = useState<string[]>(defaultRecurrences);
  const [suppliers, setSuppliers] = useState<string[]>(defaultSuppliers);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(defaultPaymentMethods);
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [entries, setEntries] = useState<DailyEntry[]>(mockEntries);
  const [services, setServices] = useState<Service[]>(mockServices);
  const [goals, setGoals] = useState<GoalsPRO>(mockGoals);
  const [clients, setClients] = useState<Client[]>(defaultClients);
  const [pipelineColumns, _setPipelineColumns] = useState<PipelineColumn[]>(defaultPipelineColumns);
  const [pipelineDeals, _setPipelineDeals] = useState<PipelineDeal[]>(defaultPipelineDeals);
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [projectColumns, _setProjectColumns] = useState<ProjectColumn[]>(defaultProjectColumns);
  const [isLoading, setIsLoading] = useState(true);

  const initialized = useRef(false);

  // Fetch from server – only when we have both a user AND a valid session token
  useEffect(() => {
    if (!user || !session?.access_token) {
      initialized.current = false;
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    initialized.current = false;

    // Retry helper for cold-start / transient errors
    async function fetchWithRetry(retries = 3): Promise<any> {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const data = await apiFetch("/finance");
          return data;
        } catch (err: any) {
          if (attempt === retries) throw err;
          const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    fetchWithRetry()
      .then((data) => {
        if (cancelled) return;
        if (data && data.financeData) {
          if (data.financeData.expenses) setExpenses(data.financeData.expenses);
          if (data.financeData.variableParams) setVariableParams(data.financeData.variableParams);
          if (data.financeData.partners) setPartners(data.financeData.partners);
          if (data.financeData.commissionMembers) setCommissionMembers(data.financeData.commissionMembers);
          if (data.financeData.marketingActions) setMarketingActions(data.financeData.marketingActions);
          if (data.financeData.accounts) setAccounts(data.financeData.accounts);
          if (data.financeData.entries) setEntries(data.financeData.entries);
          if (data.financeData.services) setServices(data.financeData.services);
          if (data.financeData.goals) setGoals(data.financeData.goals);
          if (data.financeData.expenseCategories) setExpenseCategories(data.financeData.expenseCategories);
          if (data.financeData.recurrences) setRecurrences(data.financeData.recurrences);
          if (data.financeData.suppliers) setSuppliers(data.financeData.suppliers);
          if (data.financeData.paymentMethods) setPaymentMethods(data.financeData.paymentMethods);
          if (data.financeData.clients) setClients(data.financeData.clients);
          if (data.financeData.pipelineColumns) _setPipelineColumns(data.financeData.pipelineColumns);
          if (data.financeData.pipelineDeals) _setPipelineDeals(data.financeData.pipelineDeals);
          if (data.financeData.projects) setProjects(data.financeData.projects);
          if (data.financeData.projectColumns) _setProjectColumns(data.financeData.projectColumns);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Error fetching finance data from server (all retries exhausted):", err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          initialized.current = true;
        }
      });

    return () => { cancelled = true; };
  }, [user, session?.access_token]);

  // Save to server on changes with a debounce
  useEffect(() => {
    if (!initialized.current || !user || !session?.access_token || isLoading) return;

    const timer = setTimeout(() => {
      apiFetch("/finance", {
        method: "POST",
        body: JSON.stringify({
          expenses,
          variableParams,
          partners,
          commissionMembers,
          marketingActions,
          expenseCategories,
          recurrences,
          suppliers,
          paymentMethods,
          accounts,
          entries,
          services,
          goals,
          clients,
          pipelineColumns,
          pipelineDeals,
          projects,
          projectColumns,
        }),
      }).catch((err) => console.error("Error saving finance data to server:", err));
    }, 1500);

    return () => clearTimeout(timer);
  }, [expenses, variableParams, partners, commissionMembers, marketingActions, expenseCategories, recurrences, suppliers, paymentMethods, accounts, entries, services, goals, clients, pipelineColumns, pipelineDeals, projects, projectColumns, user, session?.access_token, isLoading]);

  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    const id = generateId();
    const newExpense = { ...expense, id };
    setExpenses((prev) => [...prev, newExpense]);
    
    // Auto-post entry creation if autoPost is true and dueDate is provided
    if (newExpense.autoPost && newExpense.dueDate) {
      const today = new Date();
      // Assume dueDate is a day of month "05" or full date "2026-03-05"
      let nextDate = newExpense.dueDate;
      if (nextDate.length <= 2) {
        const day = parseInt(nextDate);
        today.setDate(day);
        if (today < new Date()) {
          today.setMonth(today.getMonth() + 1);
        }
        nextDate = today.toISOString().split("T")[0];
      }

      addEntry({
        date: nextDate,
        type: "expense",
        description: newExpense.name,
        amount: newExpense.amount,
        category: newExpense.category,
        supplier: newExpense.supplier,
        expenseId: id,
        recurrence: newExpense.recurrence,
        paymentMethod: newExpense.paymentMethod,
        status: "pending",
      });
    }
  }, []);

  const updateExpense = useCallback((id: string, expense: Omit<Expense, "id">) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...expense, id } : e)));
  }, []);

  const removeExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addVariableParam = useCallback((param: Omit<VariableParameter, "id">) => {
    setVariableParams((prev) => [...prev, { ...param, id: generateId() }]);
  }, []);

  const updateVariableParam = useCallback((id: string, param: Omit<VariableParameter, "id">) => {
    setVariableParams((prev) => prev.map((p) => (p.id === id ? { ...param, id } : p)));
  }, []);

  const removeVariableParam = useCallback((id: string) => {
    setVariableParams((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addPartner = useCallback((partner: Omit<Partner, "id">) => {
    setPartners((prev) => [...prev, { ...partner, id: generateId() }]);
  }, []);

  const updatePartner = useCallback((id: string, partner: Omit<Partner, "id">) => {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...partner, id } : p)));
  }, []);

  const removePartner = useCallback((id: string) => {
    setPartners((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addCommissionMember = useCallback((member: Omit<CommissionMember, "id">) => {
    setCommissionMembers((prev) => [...prev, { ...member, id: generateId() }]);
  }, []);

  const updateCommissionMember = useCallback((id: string, member: Omit<CommissionMember, "id">) => {
    setCommissionMembers((prev) => prev.map((m) => (m.id === id ? { ...member, id } : m)));
  }, []);

  const removeCommissionMember = useCallback((id: string) => {
    setCommissionMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addMarketingAction = useCallback((action: Omit<MarketingAction, "id">) => {
    setMarketingActions((prev) => [...prev, { ...action, id: generateId() }]);
  }, []);

  const updateMarketingAction = useCallback((id: string, action: Omit<MarketingAction, "id">) => {
    setMarketingActions((prev) => prev.map((a) => (a.id === id ? { ...action, id } : a)));
  }, []);

  const removeMarketingAction = useCallback((id: string) => {
    setMarketingActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addExpenseCategory = useCallback((cat: string) => {
    setExpenseCategories((prev) => prev.includes(cat) ? prev : [...prev, cat]);
  }, []);

  const addRecurrence = useCallback((rec: string) => {
    setRecurrences((prev) => prev.includes(rec) ? prev : [...prev, rec]);
  }, []);

  const addSupplier = useCallback((sup: string) => {
    setSuppliers((prev) => prev.includes(sup) ? prev : [...prev, sup]);
  }, []);

  const addPaymentMethod = useCallback((method: string) => {
    setPaymentMethods((prev) => prev.includes(method) ? prev : [...prev, method]);
  }, []);

  const addAccount = useCallback((account: Omit<Account, "id">) => {
    setAccounts((prev) => [...prev, { ...account, id: generateId() }]);
  }, []);

  const updateAccount = useCallback((id: string, account: Omit<Account, "id">) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...account, id } : a)));
  }, []);

  const updateAccountStatus = useCallback((id: string, status: Account["status"]) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addEntry = useCallback((entry: Omit<DailyEntry, "id">) => {
    setEntries((prev) => [{ ...entry, id: generateId() }, ...prev]);
  }, []);

  const updateEntry = useCallback((id: string, entry: Omit<DailyEntry, "id">) => {
    setEntries((prev) => {
      const oldEntry = prev.find(e => e.id === id);
      const isStatusChangeToPaid = oldEntry?.status === "pending" && entry.status === "paid";
      
      const updated = prev.map((e) => (e.id === id ? { ...entry, id } : e));
      
      // Auto-generate next recurrence if marked as paid
      if (isStatusChangeToPaid && entry.expenseId && entry.recurrence && entry.recurrence !== "Única" && entry.recurrence !== "Unica") {
        const nextDate = new Date(entry.date + "T12:00:00");
        
        switch (entry.recurrence.toLowerCase()) {
          case "mensal": nextDate.setMonth(nextDate.getMonth() + 1); break;
          case "bimestral": nextDate.setMonth(nextDate.getMonth() + 2); break;
          case "trimestral": nextDate.setMonth(nextDate.getMonth() + 3); break;
          case "semestral": nextDate.setMonth(nextDate.getMonth() + 6); break;
          case "anual": nextDate.setFullYear(nextDate.getFullYear() + 1); break;
          case "semanal": nextDate.setDate(nextDate.getDate() + 7); break;
        }

        const nextEntry = {
          ...entry,
          id: generateId(),
          date: nextDate.toISOString().split("T")[0],
          status: "pending" as const
        };
        
        return [nextEntry, ...updated];
      }
      
      return updated;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addService = useCallback((service: Omit<Service, "id">) => {
    setServices((prev) => [...prev, { ...service, id: generateId() }]);
  }, []);

  const updateService = useCallback((id: string, service: Omit<Service, "id">) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...service, id } : s)));
  }, []);

  const removeService = useCallback((id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateGoals = useCallback((newGoals: GoalsPRO) => {
    setGoals(newGoals);
  }, []);

  const addClient = useCallback((client: Omit<Client, "id">) => {
    const newClient: Client = { ...client, id: generateId() };
    setClients((prev) => [...prev, newClient]);
    return newClient;
  }, []);

  const updateClient = useCallback((id: string, client: Omit<Client, "id">) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...client, id } : c)));
  }, []);

  const removeClient = useCallback((id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setPipelineColumns = useCallback((columns: PipelineColumn[]) => {
    _setPipelineColumns(columns);
  }, []);

  const addPipelineColumn = useCallback((column: Omit<PipelineColumn, "id">) => {
    _setPipelineColumns((prev) => [...prev, { ...column, id: generateId() }]);
  }, []);

  const updatePipelineColumn = useCallback((id: string, column: Omit<PipelineColumn, "id">) => {
    _setPipelineColumns((prev) => prev.map((c) => (c.id === id ? { ...column, id } : c)));
  }, []);

  const removePipelineColumn = useCallback((id: string) => {
    _setPipelineColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addPipelineDeal = useCallback((deal: Omit<PipelineDeal, "id">) => {
    _setPipelineDeals((prev) => [...prev, { ...deal, id: generateId() }]);
  }, []);

  const updatePipelineDeal = useCallback((id: string, deal: Omit<PipelineDeal, "id">) => {
    _setPipelineDeals((prev) => prev.map((d) => (d.id === id ? { ...deal, id } : d)));
  }, []);

  const removePipelineDeal = useCallback((id: string) => {
    _setPipelineDeals((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const moveDeal = useCallback((dealId: string, toColumnId: string) => {
    _setPipelineDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, columnId: toColumnId } : d)));
  }, []);

  const addProject = useCallback((project: Omit<Project, "id">) => {
    setProjects((prev) => [...prev, { ...project, id: generateId() }]);
  }, []);

  const updateProject = useCallback((id: string, project: Omit<Project, "id">) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...project, id } : p)));
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const moveProject = useCallback((projectId: string, status: string) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: status as any, updatedAt: new Date().toISOString(), ...(status === "done" ? { completedAt: new Date().toISOString() } : {}) } : p)));
  }, []);

  const setProjectColumns = useCallback((columns: ProjectColumn[]) => {
    _setProjectColumns(columns);
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        expenses, variableParams, partners, commissionMembers, marketingActions, expenseCategories, recurrences, suppliers, paymentMethods, accounts, entries, services, goals, clients, pipelineColumns, pipelineDeals, projects, projectColumns, isLoading,
        addExpense, updateExpense, removeExpense, 
        addVariableParam, updateVariableParam, removeVariableParam,
        addPartner, updatePartner, removePartner,
        addCommissionMember, updateCommissionMember, removeCommissionMember,
        addMarketingAction, updateMarketingAction, removeMarketingAction,
        addExpenseCategory, addRecurrence, addSupplier, addPaymentMethod,
        addAccount, updateAccount, updateAccountStatus, removeAccount,
        addEntry, updateEntry, removeEntry,
        addService, updateService, removeService,
        updateGoals,
        addClient, updateClient, removeClient,
        setPipelineColumns, addPipelineColumn, updatePipelineColumn, removePipelineColumn,
        addPipelineDeal, updatePipelineDeal, removePipelineDeal,
        moveDeal,
        addProject, updateProject, removeProject, moveProject, setProjectColumns,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    console.warn("useFinance must be used within a FinanceProvider");
    // Fallback during fast refresh / unmounts to prevent crashes
    return {
      expenses: [],
      variableParams: [],
      partners: [],
      commissionMembers: [],
      marketingActions: [],
      expenseCategories: [],
      recurrences: [],
      suppliers: [],
      paymentMethods: [],
      accounts: [],
      entries: [],
      services: [],
      goals: mockGoals,
      clients: [],
      pipelineColumns: [],
      pipelineDeals: [],
      projects: [],
      projectColumns: [],
      isLoading: false,
      addExpense: () => {},
      updateExpense: () => {},
      removeExpense: () => {},
      addVariableParam: () => {},
      updateVariableParam: () => {},
      removeVariableParam: () => {},
      addPartner: () => {},
      updatePartner: () => {},
      removePartner: () => {},
      addCommissionMember: () => {},
      updateCommissionMember: () => {},
      removeCommissionMember: () => {},
      addMarketingAction: () => {},
      updateMarketingAction: () => {},
      removeMarketingAction: () => {},
      addExpenseCategory: () => {},
      addRecurrence: () => {},
      addSupplier: () => {},
      addPaymentMethod: () => {},
      addAccount: () => {},
      updateAccount: () => {},
      updateAccountStatus: () => {},
      removeAccount: () => {},
      addEntry: () => {},
      updateEntry: () => {},
      removeEntry: () => {},
      addService: () => {},
      updateService: () => {},
      removeService: () => {},
      updateGoals: () => {},
      addClient: () => ({ id: "", type: "pf" as const, email: "", phone: "", createdAt: "" }),
      updateClient: () => {},
      removeClient: () => {},
      setPipelineColumns: () => {},
      addPipelineColumn: () => {},
      updatePipelineColumn: () => {},
      removePipelineColumn: () => {},
      addPipelineDeal: () => {},
      updatePipelineDeal: () => {},
      removePipelineDeal: () => {},
      moveDeal: () => {},
      addProject: () => {},
      updateProject: () => {},
      removeProject: () => {},
      moveProject: () => {},
      setProjectColumns: () => {},
    };
  }
  return ctx;
}