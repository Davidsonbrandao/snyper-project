import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Plus, Trash2, Pencil, X, Settings2, RotateCcw,
  FolderKanban, User, Briefcase, Calendar, CheckCircle2,
  Clock, ListChecks, AlertTriangle, ChevronDown,
  Search, GripVertical, Tag, Link2, FileText, ExternalLink, Paperclip,
  Upload, Loader2, Image as ImageIcon, Filter,
  Download, History, DollarSign, Timer, Eye, RefreshCw,
} from "lucide-react";
import { useFinance } from "../lib/finance-context";
import {
  type Project, type ProjectColumn, type ProjectTask, type ProjectStatus, type DealPriority,
  type Deliverable, type ProjectActivity,
  formatCurrency, generateId,
  DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  DEFAULT_PROJECT_COLUMNS, DEFAULT_PROJECT_TAGS, type ProjectTag, PROJECT_CANCEL_REASONS,
} from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { MultiSelect } from "./ui/multi-select";
import { CurrencyInput } from "./ui/currency-input";
import { DatePickerInput } from "./ui/date-picker-input";
import { ClientSearchSelect } from "./ui/client-search-select";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { usePermissions } from "../lib/permissions-context";
import { NoAccessPage, ReadOnlyBadge } from "./permission-gate";
import { toast } from "sonner";
import { useNotifications } from "../lib/notification-context";
import { apiFetchUpload, apiFetch } from "../lib/supabase";

const COLUMN_COLORS = [
  "#8a8a99", "#3b82f6", "#f59e0b", "#8b5cf6", "#22c55e", "#ef4444",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6",
];

const priorityOptions = Object.entries(DEAL_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

const cs: React.CSSProperties = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" };
const isStyle: React.CSSProperties = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" };

interface ProjectFormState {
  name: string; description: string; clientId: string; serviceId: string; serviceIds: string[]; dealId: string;
  priority: DealPriority; startDate: string; dueDate: string; estimatedValue: string;
  notes: string; assignedTo: string; tags: string[];
}

const emptyProjectForm: ProjectFormState = {
  name: "", description: "", clientId: "", serviceId: "", serviceIds: [], dealId: "",
  priority: "medium", startDate: new Date().toISOString().split("T")[0],
  dueDate: "", estimatedValue: "", notes: "", assignedTo: "", tags: [],
};

interface TaskFormState { title: string; description: string; dueDate: string; status: "pending" | "in_progress" | "done"; assignedTo: string; }
const emptyTaskForm: TaskFormState = { title: "", description: "", dueDate: "", status: "pending", assignedTo: "" };

export function ProjectsPage() {
  const {
    projects, projectColumns, clients, services, pipelineDeals, pipelineColumns, commissionMembers,
    addProject, updateProject, removeProject, moveProject, setProjectColumns,
    addEntry,
  } = useFinance();
  const { can } = usePermissions();
  const { addNotification } = useNotifications();

  const sortedColumns = useMemo(() => [...projectColumns].sort((a, b) => a.order - b.order), [projectColumns]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [formStatus, setFormStatus] = useState<ProjectStatus>("todo");
  const [formTasks, setFormTasks] = useState<ProjectTask[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm);
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);

  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [editingColumns, setEditingColumns] = useState<ProjectColumn[]>([]);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COLUMN_COLORS[0]);
  const [newColStatus, setNewColStatus] = useState("");

  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Deliverables
  const [formDeliverables, setFormDeliverables] = useState<Deliverable[]>([]);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [deliverableType, setDeliverableType] = useState<"link" | "file">("link");
  const [deliverableLabel, setDeliverableLabel] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingDeliverableId, setDeletingDeliverableId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelProjectId, setCancelProjectId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // URL refresh tracking
  const [refreshedUrls, setRefreshedUrls] = useState<Record<string, string>>({});

  const navigate = useNavigate();

  const serviceOptions = useMemo(() => services.map(s => ({ value: s.id, label: s.name })), [services]);

  const wonDeals = useMemo(() => {
    const winColIds = pipelineColumns.filter(c => c.isWinColumn).map(c => c.id);
    return pipelineDeals.filter(d => winColIds.includes(d.columnId)).filter(d => !projects.some(p => p.dealId === d.id));
  }, [pipelineDeals, pipelineColumns, projects]);

  const dealOptions = useMemo(() => wonDeals.map(d => ({ value: d.id, label: d.title })), [wonDeals]);
  const memberOptions = useMemo(() => commissionMembers.filter(m => m.active).map(m => ({ value: m.id, label: m.name })), [commissionMembers]);

  const statusOptions = useMemo(() => {
    const fromLabels = Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
    const customStatuses = projectColumns.filter(c => !PROJECT_STATUS_LABELS[c.status]).map(c => ({ value: c.status, label: c.title }));
    return [...fromLabels, ...customStatuses];
  }, [projectColumns]);

  const activeProjects = projects.filter(p => !["done", "cancelled"].includes(p.status));
  const completedProjects = projects.filter(p => p.status === "done");
  const totalActiveValue = activeProjects.reduce((s, p) => s + p.estimatedValue, 0);
  const overdueProjects = activeProjects.filter(p => p.dueDate && new Date(p.dueDate + "T23:59:59") < new Date());

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    const c = clients.find(cl => cl.id === clientId);
    if (!c) return null;
    return c.type === "pf" ? c.fullName : (c.nomeFantasia || c.razaoSocial);
  };
  const getServiceName = (serviceId?: string) => serviceId ? services.find(s => s.id === serviceId)?.name || null : null;
  const getMemberName = (memberId?: string) => memberId ? commissionMembers.find(m => m.id === memberId)?.name || null : null;

  // Activity log helper
  const createActivity = (type: ProjectActivity["type"], description: string, metadata?: Record<string, any>): ProjectActivity => ({
    id: generateId(), type, description, timestamp: new Date().toISOString(), metadata,
  });

  // SLA helper - days remaining until deadline
  const getDaysRemaining = (dueDate?: string) => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate + "T23:59:59").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getSlaColor = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return "#ef4444"; // overdue
    if (days <= 2) return "#ef4444"; // critical
    if (days <= 5) return "#f59e0b"; // warning
    return "#22c55e"; // safe
  };

  const getSlaLabel = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return `${Math.abs(days)}d atrasado`;
    if (days === 0) return "Vence hoje";
    if (days === 1) return "Vence amanha";
    return `${days}d restantes`;
  };

  // Auto-generate financial entry on project completion
  const generateCompletionEntry = (project: Project) => {
    if (!project.estimatedValue || project.estimatedValue <= 0) return;
    const clientName = getClientName(project.clientId) || "Cliente";
    const svcIds = project.serviceIds || (project.serviceId ? [project.serviceId] : []);
    const svcNames = svcIds.map(id => getServiceName(id)).filter(Boolean).join(", ");

    addEntry({
      date: new Date().toISOString().split("T")[0],
      type: "income",
      description: `Projeto concluido: ${project.name}${svcNames ? ` (${svcNames})` : ""}`,
      amount: project.estimatedValue,
      category: "Projetos",
      client: clientName,
      status: "pending",
      serviceId: svcIds[0] || undefined,
    });

    toast.success(`Lancamento de receita de ${formatCurrency(project.estimatedValue)} gerado automaticamente`);
  };

  // Refresh expired signed URL for a deliverable
  const refreshDeliverableUrl = async (deliverable: Deliverable): Promise<string | null> => {
    if (!deliverable.storagePath) return null;
    try {
      const result = await apiFetch("/upload/refresh-url", {
        method: "POST",
        body: JSON.stringify({ storagePath: deliverable.storagePath }),
      });
      return result.url || null;
    } catch (err) {
      console.error("Error refreshing deliverable URL:", err);
      return null;
    }
  };

  const getProjectProgress = (project: Project) => {
    if (!project.tasks || project.tasks.length === 0) {
      if (project.status === "done") return 100;
      if (project.status === "cancelled") return 0;
      const statusProgress: Record<ProjectStatus, number> = { backlog: 0, todo: 10, in_progress: 50, review: 80, done: 100, cancelled: 0 };
      return statusProgress[project.status] || 0;
    }
    const done = project.tasks.filter(t => t.status === "done").length;
    return Math.round((done / project.tasks.length) * 100);
  };

  const openNewProject = (status: ProjectStatus) => { setForm(emptyProjectForm); setFormStatus(status); setFormTasks([]); setFormDeliverables([]); setEditingId(null); setShowForm(true); };

  const openEditProject = (project: Project) => {
    setForm({
      name: project.name, description: project.description || "", clientId: project.clientId || "",
      serviceId: project.serviceId || "", serviceIds: project.serviceIds || (project.serviceId ? [project.serviceId] : []),
      dealId: project.dealId || "", priority: project.priority,
      startDate: project.startDate, dueDate: project.dueDate || "",
      estimatedValue: project.estimatedValue ? String(project.estimatedValue) : "",
      notes: project.notes || "", assignedTo: project.assignedTo || "", tags: project.tags || [],
    });
    setFormStatus(project.status); setFormTasks([...(project.tasks || [])]); setFormDeliverables([...(project.deliverables || [])]); setEditingId(project.id); setShowForm(true);
  };

  const openFromDeal = (dealId: string) => {
    const deal = pipelineDeals.find(d => d.id === dealId);
    if (!deal) return;
    const svcIds = deal.serviceIds || (deal.serviceId ? [deal.serviceId] : []);
    setForm({
      name: deal.title, description: "", clientId: deal.clientId || "", serviceId: deal.serviceId || "",
      serviceIds: svcIds,
      dealId: deal.id, priority: deal.priority, startDate: new Date().toISOString().split("T")[0],
      dueDate: "", estimatedValue: String(deal.realValue || deal.estimatedValue), notes: deal.notes || "",
      assignedTo: "", tags: [],
    });
    setFormStatus("todo"); setFormTasks([]); setFormDeliverables([]); setEditingId(null); setShowForm(true);
  };

  const saveProject = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do projeto"); return; }
    const now = new Date().toISOString();
    const svcIds = form.serviceIds.length > 0 ? form.serviceIds : (form.serviceId ? [form.serviceId] : undefined);
    const data: Omit<Project, "id"> = {
      name: form.name, description: form.description || undefined, clientId: form.clientId || undefined,
      serviceId: form.serviceIds[0] || form.serviceId || undefined,
      serviceIds: svcIds,
      dealId: form.dealId || undefined, status: formStatus,
      priority: form.priority, startDate: form.startDate, dueDate: form.dueDate || undefined,
      estimatedValue: parseFloat(form.estimatedValue) || 0, tasks: formTasks,
      deliverables: formDeliverables.length > 0 ? formDeliverables : undefined,
      tags: form.tags.length > 0 ? form.tags : undefined, notes: form.notes || undefined,
      assignedTo: form.assignedTo || undefined,
      createdAt: editingId ? (projects.find(p => p.id === editingId)?.createdAt || now) : now,
      updatedAt: now, completedAt: formStatus === "done" ? now : undefined,
      activityLog: (() => {
        const existing = editingId ? (projects.find(p => p.id === editingId)?.activityLog || []) : [];
        if (!editingId) return [createActivity("created", `Projeto "${form.name}" criado`)];
        const prev = projects.find(p => p.id === editingId);
        const logs = [...existing];
        if (prev && prev.status !== formStatus) {
          logs.push(createActivity("status_changed", `Status: "${PROJECT_STATUS_LABELS[prev.status] || prev.status}" → "${PROJECT_STATUS_LABELS[formStatus] || formStatus}"`));
        }
        logs.push(createActivity("edited", "Projeto editado"));
        return logs;
      })(),
    };

    // Notify assigned members on tasks
    if (!editingId) {
      formTasks.forEach(t => {
        if (t.assignedTo) {
          const member = commissionMembers.find(m => m.id === t.assignedTo);
          if (member) {
            addNotification({
              type: "member_tagged",
              title: "Nova tarefa atribuida",
              message: `${member.name} foi atribuido(a) a tarefa "${t.title}" no projeto "${form.name}"`,
              link: "/projetos",
              icon: "UserCheck",
              color: "#3b82f6",
            });
          }
        }
      });
      if (form.assignedTo) {
        const member = commissionMembers.find(m => m.id === form.assignedTo);
        if (member) {
          addNotification({
            type: "member_tagged",
            title: "Atribuido a projeto",
            message: `${member.name} foi atribuido(a) como responsavel pelo projeto "${form.name}"`,
            link: "/projetos",
            icon: "UserCheck",
            color: "var(--accent)",
          });
        }
      }
    }

    if (editingId) { updateProject(editingId, data); toast.success("Projeto atualizado"); }
    else { addProject(data); toast.success("Projeto criado"); }

    // Notify on project completion via save
    if (formStatus === "done") {
      const existing = editingId ? projects.find(p => p.id === editingId) : null;
      if (!existing || existing.status !== "done") {
        const delCount = formDeliverables.length;
        const tasksDone = formTasks.filter(t => t.status === "done").length;
        const tasksTotal = formTasks.length;
        addNotification({
          type: "project_completed",
          title: "Projeto concluido",
          message: `"${form.name}" foi concluido! ${tasksTotal > 0 ? `Tarefas: ${tasksDone}/${tasksTotal}.` : ""} ${delCount > 0 ? `${delCount} entregavel(is).` : "Nenhum entregavel."}`,
          link: "/projetos",
          icon: "CheckCircle2",
          color: "#22c55e",
        });
        generateCompletionEntry(data as Project);
      }
    }

    setShowForm(false); setEditingId(null);
  };

  const openAddTask = () => { setTaskForm(emptyTaskForm); setEditingTaskIdx(null); setShowTaskForm(true); };
  const openEditTask = (idx: number) => {
    const t = formTasks[idx];
    setTaskForm({ title: t.title, description: t.description || "", dueDate: t.dueDate || "", status: t.status, assignedTo: t.assignedTo || "" });
    setEditingTaskIdx(idx); setShowTaskForm(true);
  };

  const saveTask = () => {
    const task: ProjectTask = {
      id: editingTaskIdx !== null ? formTasks[editingTaskIdx].id : generateId(),
      title: taskForm.title, description: taskForm.description || undefined,
      dueDate: taskForm.dueDate || undefined, status: taskForm.status,
      assignedTo: taskForm.assignedTo || undefined,
      completedAt: taskForm.status === "done" ? new Date().toISOString() : undefined,
      order: editingTaskIdx !== null ? formTasks[editingTaskIdx].order : formTasks.length,
    };
    if (editingTaskIdx !== null) setFormTasks(prev => prev.map((t, i) => i === editingTaskIdx ? task : t));
    else setFormTasks(prev => [...prev, task]);
    setShowTaskForm(false);
  };

  const addDeliverable = () => {
    if (!deliverableLabel.trim()) { toast.error("Informe o titulo do entregavel"); return; }
    if (deliverableType === "link" && !deliverableUrl.trim()) { toast.error("Informe a URL do entregavel"); return; }
    if (deliverableType === "file") { fileInputRef.current?.click(); return; }
    const del: Deliverable = {
      id: generateId(),
      type: "link",
      label: deliverableLabel,
      url: deliverableUrl,
      createdAt: new Date().toISOString(),
    };
    setFormDeliverables(prev => [...prev, del]);
    setDeliverableLabel(""); setDeliverableUrl(""); setShowDeliverableForm(false);

    // Notify about deliverable
    if (editingId) {
      addNotification({
        type: "deliverable_added",
        title: "Novo entregavel adicionado",
        message: `Entregavel "${deliverableLabel}" adicionado ao projeto "${form.name}"`,
        link: "/projetos",
        icon: "Package",
        color: "#22c55e",
      });
    }
    toast.success("Entregavel adicionado");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo excede o limite de 10MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) { toast.error("Tipo nao permitido. Aceitos: imagens (JPG, PNG, GIF, WebP) e PDF."); return; }

    const label = deliverableLabel.trim() || file.name;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await apiFetchUpload("/upload/deliverable", fd);
      const del: Deliverable = {
        id: generateId(),
        type: "file",
        label,
        url: result.url,
        storagePath: result.storagePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        createdAt: new Date().toISOString(),
        urlExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      setFormDeliverables(prev => [...prev, del]);
      setDeliverableLabel(""); setDeliverableUrl(""); setShowDeliverableForm(false);
      toast.success("Arquivo enviado com sucesso");

      if (editingId) {
        addNotification({
          type: "deliverable_added",
          title: "Arquivo entregavel enviado",
          message: `Arquivo "${label}" enviado ao projeto "${form.name}"`,
          link: "/projetos",
          icon: "Package",
          color: "#22c55e",
        });
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDeliverable = async (id: string) => {
    const deliverable = formDeliverables.find(d => d.id === id);
    if (!deliverable) return;

    if (deliverable.type === "file" && deliverable.storagePath) {
      setDeletingDeliverableId(id);
      try {
        await apiFetch("/upload/deliverable", {
          method: "DELETE",
          body: JSON.stringify({ storagePath: deliverable.storagePath }),
        });
      } catch (err: any) {
        console.error("Delete deliverable error:", err);
        toast.error(err.message || "Erro ao excluir arquivo");
        setDeletingDeliverableId(null);
        return;
      }
    }

    setFormDeliverables(prev => prev.filter(d => d.id !== id));
    setDeletingDeliverableId(null);
  };

  const removeTask = (idx: number) => { setFormTasks(prev => prev.filter((_, i) => i !== idx)); };

  const toggleTaskStatus = (projectId: string, taskId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedTasks = project.tasks.map(t => {
      if (t.id === taskId) {
        const nextStatus = t.status === "done" ? "pending" : t.status === "pending" ? "in_progress" : "done";
        return { ...t, status: nextStatus as any, completedAt: nextStatus === "done" ? new Date().toISOString() : undefined };
      }
      return t;
    });
    const task = project.tasks.find(t => t.id === taskId);
    const nextStatus = task ? (task.status === "done" ? "pending" : task.status === "pending" ? "in_progress" : "done") : "";
    const existingLog = project.activityLog || [];
    const newLog = nextStatus === "done" && task
      ? [...existingLog, createActivity("task_completed", `Tarefa "${task.title}" concluida`)]
      : existingLog;
    updateProject(projectId, { ...project, tasks: updatedTasks, activityLog: newLog, updatedAt: new Date().toISOString() });
  };

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDragProjectId(projectId); e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) e.dataTransfer.setDragImage(e.currentTarget, 100, 30);
  };
  const handleDragOver = (e: React.DragEvent, columnId: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverColumnId(columnId); };
  const handleDragLeave = () => setDragOverColumnId(null);
  const handleDrop = (e: React.DragEvent, column: ProjectColumn) => {
    e.preventDefault(); setDragOverColumnId(null);
    if (!dragProjectId) return;
    const project = projects.find(p => p.id === dragProjectId);
    if (!project || project.status === column.status) { setDragProjectId(null); return; }
    if (column.status === "cancelled") {
      setCancelProjectId(dragProjectId); setCancelReason(""); setShowCancelModal(true); setDragProjectId(null); return;
    }
    // Build activity log
    const existingLog = project.activityLog || [];
    const newActivity = createActivity("status_changed", `Status alterado de "${PROJECT_STATUS_LABELS[project.status] || project.status}" para "${column.title}"`);
    const updatedLog = [...existingLog, newActivity];

    moveProject(dragProjectId, column.status);
    // Update with activity log
    const movedProject = { ...project, status: column.status, activityLog: updatedLog, updatedAt: new Date().toISOString(), ...(column.status === "done" ? { completedAt: new Date().toISOString() } : {}) };
    updateProject(dragProjectId, movedProject);

    toast.success(`Projeto movido para ${column.title}`);

    // On project completion: notify + generate financial entry
    if (column.status === "done" && project.status !== "done") {
      const delCount = project.deliverables?.length || 0;
      const tasksDone = project.tasks?.filter(t => t.status === "done").length || 0;
      const tasksTotal = project.tasks?.length || 0;
      addNotification({
        type: "project_completed",
        title: "Projeto concluido",
        message: `"${project.name}" foi concluido! ${tasksTotal > 0 ? `Tarefas: ${tasksDone}/${tasksTotal}.` : ""} ${delCount > 0 ? `${delCount} entregavel(is).` : "Nenhum entregavel."}`,
        link: "/projetos",
        icon: "CheckCircle2",
        color: "#22c55e",
      });
      generateCompletionEntry(project);
    }
    setDragProjectId(null);
  };
  const handleDragEnd = () => { setDragProjectId(null); setDragOverColumnId(null); };

  const openColumnSettings = () => { setEditingColumns([...sortedColumns]); setShowColumnSettings(true); };
  const saveColumnSettings = () => {
    const reindexed = editingColumns.map((c, i) => ({ ...c, order: i }));
    setProjectColumns(reindexed); setShowColumnSettings(false); toast.success("Colunas atualizadas");
  };
  const resetColumns = () => { setEditingColumns([...DEFAULT_PROJECT_COLUMNS]); };

  const confirmCancel = () => {
    if (!cancelProjectId) return;
    const project = projects.find(p => p.id === cancelProjectId);
    if (!project) return;
    updateProject(cancelProjectId, { ...project, status: "cancelled", cancellationReason: cancelReason, updatedAt: new Date().toISOString() });
    toast.success("Projeto cancelado");
    setShowCancelModal(false); setCancelProjectId(null);
  };

  const cancelReasonOptions = PROJECT_CANCEL_REASONS.map(r => ({ value: r, label: r }));

  // Auto-refresh expired signed URLs when a project is expanded
  useEffect(() => {
    if (!expandedProjectId) return;
    const project = projects.find(p => p.id === expandedProjectId);
    if (!project?.deliverables) return;
    const now = Date.now();
    project.deliverables.forEach(async (del) => {
      if (del.type !== "file" || !del.storagePath) return;
      if (refreshedUrls[del.id]) return; // already refreshed this session
      const isExpired = del.urlExpiresAt && new Date(del.urlExpiresAt).getTime() < now;
      // Also refresh if URL is > 6 days old (proactive)
      const isOld = del.urlExpiresAt && (new Date(del.urlExpiresAt).getTime() - now) < 24 * 60 * 60 * 1000;
      if (isExpired || isOld) {
        const newUrl = await refreshDeliverableUrl(del);
        if (newUrl) {
          setRefreshedUrls(prev => ({ ...prev, [del.id]: newUrl }));
          // Also update the project in context with the new URL
          const updatedDeliverables = project.deliverables!.map(d =>
            d.id === del.id ? { ...d, url: newUrl, urlExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } : d
          );
          updateProject(project.id, { ...project, deliverables: updatedDeliverables });
        }
      }
    });
  }, [expandedProjectId]);

  // Cancel insights
  const cancelledProjects = projects.filter(p => p.status === "cancelled");
  const cancelInsights = useMemo(() => {
    const reasons: Record<string, number> = {};
    cancelledProjects.forEach(p => {
      const r = p.cancellationReason || "Nao informado";
      reasons[r] = (reasons[r] || 0) + 1;
    });
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [cancelledProjects]);

  const taskStatusLabel: Record<string, string> = { pending: "Pendente", in_progress: "Fazendo", done: "Feita" };
  const taskStatusColor: Record<string, string> = { pending: "#8a8a99", in_progress: "#f59e0b", done: "#22c55e" };

  const [showDealDropdown, setShowDealDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterSla, setFilterSla] = useState<string>("all");

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => {
        const clientName = getClientName(p.clientId)?.toLowerCase() || "";
        const svcIds = p.serviceIds || (p.serviceId ? [p.serviceId] : []);
        const svcNames = svcIds.map(id => getServiceName(id)?.toLowerCase() || "").join(" ");
        return p.name.toLowerCase().includes(q) || clientName.includes(q) || svcNames.includes(q);
      });
    }
    if (filterPriority !== "all") list = list.filter(p => p.priority === filterPriority);
    if (filterAssignee !== "all") {
      list = list.filter(p => {
        if (p.assignedTo === filterAssignee) return true;
        if (p.tasks?.some(t => t.assignedTo === filterAssignee)) return true;
        return false;
      });
    }
    if (filterSla !== "all") {
      list = list.filter(p => {
        const days = getDaysRemaining(p.dueDate);
        if (filterSla === "overdue") return days !== null && days < 0;
        if (filterSla === "critical") return days !== null && days >= 0 && days <= 2;
        if (filterSla === "warning") return days !== null && days >= 3 && days <= 5;
        if (filterSla === "safe") return days !== null && days > 5;
        if (filterSla === "no_date") return days === null;
        return true;
      });
    }
    return list;
  }, [projects, searchQuery, filterPriority, filterAssignee, filterSla]);

  // Auto-notifications for critical SLA (< 2 days)
  const notifiedSlaRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    activeProjects.forEach(p => {
      const days = getDaysRemaining(p.dueDate);
      if (days !== null && days >= 0 && days <= 2 && !notifiedSlaRef.current.has(p.id)) {
        notifiedSlaRef.current.add(p.id);
        const slaText = days === 0 ? "vence hoje" : days === 1 ? "vence amanha" : `vence em ${days} dias`;
        addNotification({
          title: "SLA Critico",
          message: `O projeto "${p.name}" ${slaText}!`,
          type: "project_overdue",
          color: "#ef4444",
        });
      }
    });
  }, [activeProjects]);

  if (!can("projetos", "view")) return <NoAccessPage />;

  const canAdd = can("projetos", "add");
  const canEditPerm = can("projetos", "edit");
  const canDelete = can("projetos", "delete");
  const lblStyle: React.CSSProperties = { color: "var(--text-secondary)" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Projetos</h1>
            {!canAdd && !canEditPerm && !canDelete && <ReadOnlyBadge />}
          </div>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Acompanhe a producao e entrega dos seus projetos</p>
        </div>
        <div className="flex items-center gap-2">
          {canAdd && wonDeals.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowDealDropdown(prev => !prev)} className="flex items-center gap-2 px-3 py-2.5 text-[#f59e0b] border border-[#f59e0b]/20 rounded-xl text-[12px] hover:bg-[#f59e0b]/5 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Criar de Negocio Ganho
                <ChevronDown className={`w-3 h-3 transition-transform ${showDealDropdown ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showDealDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDealDropdown(false)} />
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-full mt-1 w-72 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
                      <p className="px-4 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-extra-subtle)" }}>Negocios ganhos sem projeto</p>
                      {wonDeals.map(deal => (
                        <button key={deal.id} onClick={() => { openFromDeal(deal.id); setShowDealDropdown(false); }} className="w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between" style={{ color: "var(--text-secondary)" }}>
                          <span className="truncate">{deal.title}</span>
                          <span className="text-[10px] text-[#f59e0b] shrink-0 ml-2">{formatCurrency(deal.realValue || deal.estimatedValue)}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
          {canEditPerm && (
            <button onClick={openColumnSettings} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] transition-colors" style={{ color: "var(--text-muted)", border: "1px solid var(--border-default)" }}>
              <Settings2 className="w-4 h-4" /> Personalizar
            </button>
          )}
          {canAdd && (
            <button onClick={() => openNewProject("todo")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] transition-colors" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {(() => {
          const urgentSla = activeProjects.filter(p => { const d = getDaysRemaining(p.dueDate); return d !== null && d >= 0 && d <= 3; }).length;
          const allTasksCount = projects.map(p => p.tasks?.length || 0).reduce((s, n) => s + n, 0);
          const doneTasksCount = projects.map(p => p.tasks?.filter(t => t.status === "done").length || 0).reduce((s, n) => s + n, 0);
          const taskRate = allTasksCount > 0 ? Math.round((doneTasksCount / allTasksCount) * 100) : 0;
          return [
            { label: "Projetos Ativos", value: String(activeProjects.length), icon: FolderKanban, color: "var(--accent)" },
            { label: "Valor em Producao", value: formatCurrency(totalActiveValue), icon: Briefcase, color: "#3b82f6" },
            { label: "Concluidos", value: String(completedProjects.length), icon: CheckCircle2, color: "#22c55e" },
            { label: "Atrasados", value: String(overdueProjects.length), icon: AlertTriangle, color: overdueProjects.length > 0 ? "#ef4444" : "var(--text-muted)" },
            { label: "Vencem em Breve", value: String(urgentSla), icon: Timer, color: urgentSla > 0 ? "#f59e0b" : "var(--text-muted)" },
            { label: "Tarefas Concluidas", value: `${taskRate}%`, icon: ListChecks, color: taskRate >= 80 ? "#22c55e" : taskRate >= 50 ? "#f59e0b" : "#3b82f6" },
          ];
        })().map((stat) => (
          <div key={stat.label} className="rounded-2xl p-4" style={cs}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.color === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : `${stat.color}15` }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{stat.label}</span>
            </div>
            <p className="text-lg" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input type="text" placeholder="Buscar projetos por nome, cliente ou servico..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none transition-colors" style={isStyle} />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={cs}>
          {[
            { key: "all", label: "Todas" }, { key: "urgent", label: "Urgente" },
            { key: "high", label: "Alta" }, { key: "medium", label: "Media" }, { key: "low", label: "Baixa" },
          ].map(opt => (
            <button key={opt.key} onClick={() => setFilterPriority(opt.key)} className="px-3 py-1.5 rounded-lg text-[11px] transition-all" style={{
              fontWeight: filterPriority === opt.key ? 500 : 400,
              backgroundColor: filterPriority === opt.key ? "rgba(var(--accent-rgb),0.15)" : "transparent",
              color: filterPriority === opt.key ? "var(--accent)" : "var(--text-secondary)",
              border: filterPriority === opt.key ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid transparent",
            }}>
              {opt.label}
            </button>
          ))}
        </div>
        {memberOptions.length > 0 && (
          <div className="relative">
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="appearance-none rounded-xl pl-8 pr-8 py-2.5 text-[12px] focus:outline-none cursor-pointer"
              style={{
                ...cs,
                color: filterAssignee !== "all" ? "var(--accent)" : "var(--text-secondary)",
                borderColor: filterAssignee !== "all" ? "rgba(var(--accent-rgb),0.35)" : undefined,
              }}
            >
              <option value="all">Todos os membros</option>
              {memberOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: filterAssignee !== "all" ? "var(--accent)" : "var(--text-muted)" }} />
            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
          </div>
        )}
        <div className="relative">
          <select
            value={filterSla}
            onChange={e => setFilterSla(e.target.value)}
            className="appearance-none rounded-xl pl-8 pr-8 py-2.5 text-[12px] focus:outline-none cursor-pointer"
            style={{
              ...cs,
              color: filterSla !== "all" ? (filterSla === "overdue" || filterSla === "critical" ? "#ef4444" : filterSla === "warning" ? "#f59e0b" : filterSla === "safe" ? "#22c55e" : "var(--accent)") : "var(--text-secondary)",
              borderColor: filterSla !== "all" ? (filterSla === "overdue" || filterSla === "critical" ? "rgba(239,68,68,0.35)" : filterSla === "warning" ? "rgba(245,158,11,0.35)" : filterSla === "safe" ? "rgba(34,197,94,0.35)" : "rgba(var(--accent-rgb),0.35)") : undefined,
            }}
          >
            <option value="all">Todos os SLA</option>
            <option value="overdue">Atrasados</option>
            <option value="critical">Critico (0-2 dias)</option>
            <option value="warning">Atencao (3-5 dias)</option>
            <option value="safe">No prazo (+5 dias)</option>
            <option value="no_date">Sem prazo</option>
          </select>
          <Timer className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: filterSla !== "all" ? (filterSla === "overdue" || filterSla === "critical" ? "#ef4444" : filterSla === "warning" ? "#f59e0b" : "#22c55e") : "var(--text-muted)" }} />
          <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      {/* Cancel Insights */}
      {cancelInsights.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
            <h3 className="text-[13px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Motivos de Cancelamento ({cancelledProjects.length} projetos)</h3>
            <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>Identifique padroes para prevenir cancelamentos</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {cancelInsights.map(([reason, count]) => {
              const pct = Math.round((count / cancelledProjects.length) * 100);
              return (
                <div key={reason} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-extra-subtle)" }}>
                  <div className="h-6 w-1 rounded-full bg-[#ef4444]" style={{ opacity: Math.max(0.3, pct / 100) }} />
                  <div>
                    <p className="text-[11px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{reason}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{count}x ({pct}%)</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar" style={{ minHeight: "60vh" }}>
        {sortedColumns.map((column) => {
          const columnProjects = filteredProjects.filter(p => p.status === column.status).sort((a, b) => {
            const pOrder: Record<DealPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
            return pOrder[a.priority] - pOrder[b.priority];
          });
          const isDragOver = dragOverColumnId === column.id;
          const isTerminal = column.status === "done" || column.status === "cancelled";
          const colWidth = sortedColumns.length <= 4 ? "min-w-[260px] flex-1" : sortedColumns.length <= 6 ? "min-w-[240px] w-[260px]" : "min-w-[220px] w-[240px]";

          return (
            <div
              key={column.id}
              className={`flex-shrink-0 ${colWidth} flex flex-col rounded-2xl transition-all duration-200`}
              style={{
                backgroundColor: isDragOver ? "var(--bg-hover)" : "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                boxShadow: isDragOver ? "inset 0 0 0 2px rgba(var(--accent-rgb),0.3)" : "none",
              }}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column)}
            >
              {/* Column Header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                  <h3 className="text-[13px] flex-1" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{column.title}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                    {columnProjects.length}
                  </span>
                </div>
                {columnProjects.length > 0 && !isTerminal && (
                  <p className="text-[11px] ml-5" style={{ color: "var(--text-muted)" }}>
                    {formatCurrency(columnProjects.reduce((s, p) => s + p.estimatedValue, 0))}
                  </p>
                )}
              </div>

              {/* Column Body */}
              <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto custom-scrollbar">
                {columnProjects.map((project) => {
                  const clientName = getClientName(project.clientId);
                  const projectServiceIds = project.serviceIds || (project.serviceId ? [project.serviceId] : []);
                  const serviceNames = projectServiceIds.map(id => getServiceName(id)).filter(Boolean);
                  const memberName = getMemberName(project.assignedTo);
                  const isExpanded = expandedProjectId === project.id;
                  const isDragging = dragProjectId === project.id;
                  const progress = getProjectProgress(project);
                  const isOverdue = project.dueDate && new Date(project.dueDate + "T23:59:59") < new Date() && !isTerminal;
                  const totalTasks = project.tasks?.length || 0;
                  const doneTasks = project.tasks?.filter(t => t.status === "done").length || 0;
                  const deliverablesCount = project.deliverables?.length || 0;
                  const daysRemaining = !isTerminal ? getDaysRemaining(project.dueDate) : null;
                  const slaColor = getSlaColor(daysRemaining);
                  const slaLabel = getSlaLabel(daysRemaining);

                  return (
                    <motion.div
                      key={project.id}
                      layout
                      draggable={canEditPerm}
                      onDragStart={(e: any) => canEditPerm ? handleDragStart(e, project.id) : undefined}
                      onDragEnd={handleDragEnd}
                      className="rounded-xl overflow-hidden transition-all cursor-grab active:cursor-grabbing"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderWidth: 1, borderStyle: "solid",
                        borderColor: isDragging ? "rgba(var(--accent-rgb),0.3)" : isOverdue ? "rgba(239,68,68,0.3)" : "var(--border-subtle)",
                        borderLeftWidth: 3, borderLeftColor: DEAL_PRIORITY_COLORS[project.priority],
                        opacity: isDragging ? 0.4 : 1, transform: isDragging ? "scale(0.98)" : "none",
                      }}
                    >
                      <div className="p-3.5 group/card relative" onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}>
                        {canEditPerm && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditProject(project); }}
                            className="absolute top-2 right-2 p-2 rounded-lg transition-all opacity-0 group-hover/card:opacity-100 z-10 shadow-lg"
                            style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}
                            title="Editar projeto"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="flex items-start justify-between gap-2 mb-2 pr-8">
                          <p className="text-[13px] leading-tight flex-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{project.name}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: `${DEAL_PRIORITY_COLORS[project.priority]}15`, color: DEAL_PRIORITY_COLORS[project.priority], fontWeight: 600 }}>
                            {DEAL_PRIORITY_LABELS[project.priority]}
                          </span>
                        </div>

                        {project.estimatedValue > 0 && (
                          <p className="text-[14px] mb-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(project.estimatedValue)}</p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {clientName && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                              <User className="w-3 h-3" /> {clientName}
                            </span>
                          )}
                          {serviceNames.length > 0 && serviceNames.map((sn, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                              <Briefcase className="w-3 h-3" /> {sn}
                            </span>
                          ))}
                          {memberName && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>
                              <User className="w-3 h-3" /> {memberName}
                            </span>
                          )}
                          {project.dueDate && (
                            <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md`} style={{ color: slaColor || "var(--text-muted)", backgroundColor: slaColor ? `${slaColor}15` : "var(--bg-input)" }}>
                              <Timer className="w-3 h-3" />
                              {slaLabel || new Date(project.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                          {deliverablesCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: "#22c55e", backgroundColor: "rgba(34,197,94,0.1)" }}>
                              <Paperclip className="w-3 h-3" /> {deliverablesCount}
                            </span>
                          )}
                        </div>

                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {project.tags.map(tagId => {
                              const tag = DEFAULT_PROJECT_TAGS.find(t => t.id === tagId);
                              if (!tag) return null;
                              return (
                                <span key={tagId} className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${tag.color}15`, color: tag.color, fontWeight: 500 }}>
                                  <Tag className="w-2.5 h-2.5" /> {tag.label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Progress Bar */}
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                              {totalTasks > 0 ? (<><ListChecks className="w-3 h-3" /> {doneTasks}/{totalTasks}</>) : "Progresso"}
                            </span>
                            <span className="text-[10px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: progress >= 100 ? "#22c55e" : progress >= 50 ? "#f59e0b" : "#3b82f6" }} />
                          </div>
                        </div>

                        {isOverdue && (
                          <div className="flex items-center gap-1 mt-2 text-[10px] px-2 py-1 rounded-md" style={{ color: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)" }}>
                            <AlertTriangle className="w-3 h-3" /> Atrasado {daysRemaining !== null ? `ha ${Math.abs(daysRemaining)} dia(s)` : ""}
                          </div>
                        )}
                        {column.status === "cancelled" && project.cancellationReason && (
                          <p className="text-[10px] text-[#ef4444]/70 mt-2 bg-[#ef4444]/5 rounded-md px-2 py-1">{project.cancellationReason}</p>
                        )}
                      </div>

                      {/* Expanded View */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                            <div className="px-3.5 pb-3.5 pt-1 space-y-2" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                              {project.description && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{project.description}</p>}
                              {project.notes && <p className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>{project.notes}</p>}

                              {totalTasks > 0 && (
                                <div className="space-y-1 pt-1">
                                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: "var(--text-muted)" }}>Tarefas</p>
                                  {project.tasks.map((task) => {
                                    const taskMember = task.assignedTo ? getMemberName(task.assignedTo) : null;
                                    return (
                                      <button
                                        key={task.id}
                                        onClick={(e) => { e.stopPropagation(); toggleTaskStatus(project.id, task.id); }}
                                        className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg transition-colors group"
                                      >
                                        <div className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors" style={{ borderColor: taskStatusColor[task.status], backgroundColor: task.status === "done" ? `${taskStatusColor[task.status]}20` : "transparent" }}>
                                          {task.status === "done" && <CheckCircle2 className="w-2.5 h-2.5" style={{ color: taskStatusColor[task.status] }} />}
                                          {task.status === "in_progress" && <Clock className="w-2.5 h-2.5" style={{ color: taskStatusColor[task.status] }} />}
                                        </div>
                                        <span className="text-[11px] flex-1" style={{ color: task.status === "done" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none" }}>
                                          {task.title}
                                        </span>
                                        {taskMember && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                                            {taskMember}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Deliverables */}
                              {project.deliverables && project.deliverables.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ fontWeight: 600, color: "var(--text-muted)" }}>Entregaveis</p>
                                  {project.deliverables.map((del) => {
                                    const isImage = del.mimeType?.startsWith("image/");
                                    const fileSize = del.fileSize ? (del.fileSize < 1024 * 1024 ? `${(del.fileSize / 1024).toFixed(0)} KB` : `${(del.fileSize / (1024 * 1024)).toFixed(1)} MB`) : null;
                                    const resolvedUrl = refreshedUrls[del.id] || del.url;
                                    return (
                                      <div key={del.id} className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
                                        {/* Image thumbnail preview */}
                                        {del.type === "file" && isImage && resolvedUrl && (
                                          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block">
                                            <img
                                              src={resolvedUrl}
                                              alt={del.label}
                                              className="w-full h-24 object-cover rounded-t-lg cursor-pointer hover:opacity-80 transition-opacity"
                                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                          </a>
                                        )}
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                          {del.type === "link" ? <Link2 className="w-3 h-3 shrink-0" style={{ color: "#3b82f6" }} /> : isImage ? <ImageIcon className="w-3 h-3 shrink-0" style={{ color: "#22c55e" }} /> : <FileText className="w-3 h-3 shrink-0" style={{ color: "#f59e0b" }} />}
                                          <div className="flex-1 min-w-0">
                                            <span className="text-[11px] truncate block" style={{ color: "var(--text-primary)" }}>{del.label}</span>
                                            {fileSize && <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{fileSize}</span>}
                                          </div>
                                          {resolvedUrl && (
                                            <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="px-2 py-0.5 rounded-md text-[9px] flex items-center gap-1 transition-colors shrink-0" style={{ backgroundColor: del.type === "link" ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)", color: del.type === "link" ? "#3b82f6" : "#f59e0b", fontWeight: 500 }}>
                                              {del.type === "link" ? <><ExternalLink className="w-2.5 h-2.5" /> Abrir</> : <><Download className="w-2.5 h-2.5" /> Baixar</>}
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Activity Log */}
                              {project.activityLog && project.activityLog.length > 0 && (
                                <div className="space-y-1 pt-1">
                                  <p className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1" style={{ fontWeight: 600, color: "var(--text-muted)" }}>
                                    <History className="w-3 h-3" /> Historico
                                  </p>
                                  <div className="space-y-0.5 max-h-28 overflow-y-auto custom-scrollbar">
                                    {[...project.activityLog].reverse().slice(0, 8).map((act) => (
                                      <div key={act.id} className="flex items-start gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: "rgba(var(--accent-rgb),0.03)" }}>
                                        <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--accent)" }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{act.description}</p>
                                          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{new Date(act.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Completion entry indicator */}
                              {project.status === "done" && project.estimatedValue > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                                  <DollarSign className="w-3 h-3" style={{ color: "#22c55e" }} />
                                  <span className="text-[10px]" style={{ color: "#22c55e", fontWeight: 500 }}>
                                    Receita de {formatCurrency(project.estimatedValue)} lancada
                                  </span>
                                </div>
                              )}

                              <p className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                                Criado em {new Date(project.createdAt).toLocaleDateString("pt-BR")}
                                {project.completedAt && ` / Concluido em ${new Date(project.completedAt).toLocaleDateString("pt-BR")}`}
                              </p>

                              <div className="flex items-center gap-1.5 pt-1">
                                {canEditPerm && (
                                  <button onClick={(e) => { e.stopPropagation(); openEditProject(project); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (deleteConfirm === project.id) {
                                        removeProject(project.id); setDeleteConfirm(null); setExpandedProjectId(null); toast.success("Projeto excluido");
                                      } else { setDeleteConfirm(project.id); setTimeout(() => setDeleteConfirm(null), 3000); }
                                    }}
                                    className="flex items-center gap-1 px-1.5 py-1 rounded-lg transition-all"
                                    style={{ color: "#ef4444", backgroundColor: deleteConfirm === project.id ? "rgba(239,68,68,0.15)" : "transparent" }}
                                    title={deleteConfirm === project.id ? "Clique para confirmar" : "Excluir"}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    {deleteConfirm === project.id && <span className="text-[9px] whitespace-nowrap animate-pulse" style={{ fontWeight: 600 }}>Confirmar?</span>}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {column.status !== "done" && column.status !== "cancelled" && canAdd && (
                  <button onClick={() => openNewProject(column.status)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed text-[12px] transition-all" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}

                {columnProjects.length === 0 && isTerminal && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    {column.status === "done" ? <CheckCircle2 className="w-8 h-8 text-[#22c55e]/20 mb-2" /> : <X className="w-8 h-8 text-[#ef4444]/20 mb-2" />}
                    <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>Arraste projetos para ca</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {editingId ? "Editar Projeto" : "Novo Projeto"}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto custom-scrollbar p-6 space-y-4">
                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Nome do Projeto *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Site institucional - Empresa XYZ" className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none" style={isStyle} />
                </div>

                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Descricao</label>
                  <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes do projeto..." rows={2} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={isStyle} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Cliente</label>
                    <ClientSearchSelect clients={clients} value={form.clientId} onChange={(v) => setForm(f => ({ ...f, clientId: v }))} onCreateNew={() => navigate("/clientes")} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Servicos</label>
                    <MultiSelect
                      options={serviceOptions}
                      value={form.serviceIds}
                      onChange={(ids) => {
                        const totalValue = ids.reduce((sum, id) => {
                          const svc = services.find(s => s.id === id);
                          return sum + (svc?.priceDisplay || 0);
                        }, 0);
                        setForm(f => ({
                          ...f,
                          serviceIds: ids,
                          serviceId: ids[0] || "",
                          estimatedValue: ids.length > 0 && !f.estimatedValue ? String(totalValue) : f.estimatedValue,
                        }));
                      }}
                      placeholder="Selecionar servicos"
                      searchable
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Valor</label>
                    <CurrencyInput value={form.estimatedValue} onChange={(v) => setForm(f => ({ ...f, estimatedValue: v }))} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Prioridade</label>
                    <CustomSelect options={priorityOptions} value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v as DealPriority }))} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Status</label>
                    <CustomSelect options={statusOptions} value={formStatus} onChange={(v) => setFormStatus(v as ProjectStatus)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Data de Inicio</label>
                    <DatePickerInput value={form.startDate} onChange={(v) => setForm(f => ({ ...f, startDate: v }))} />
                  </div>
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Prazo de Entrega</label>
                    <DatePickerInput value={form.dueDate} onChange={(v) => setForm(f => ({ ...f, dueDate: v }))} />
                  </div>
                </div>

                {memberOptions.length > 0 && (
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Responsavel</label>
                    <CustomSelect options={memberOptions} value={form.assignedTo} onChange={(v) => setForm(f => ({ ...f, assignedTo: v }))} placeholder="Selecionar responsavel" searchable />
                  </div>
                )}

                {dealOptions.length > 0 && !editingId && (
                  <div>
                    <label className="text-[12px] mb-1.5 block" style={lblStyle}>Vincular Negocio Ganho</label>
                    <CustomSelect options={dealOptions} value={form.dealId} onChange={(v) => { if (v) openFromDeal(v); setForm(f => ({ ...f, dealId: v })); }} placeholder="Opcional - vincular a um negocio do pipeline" searchable />
                  </div>
                )}

                {/* Tags */}
                <div>
                  <label className="text-[12px] mb-1.5 flex items-center gap-1.5" style={lblStyle}>
                    <Tag className="w-3.5 h-3.5" /> Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_PROJECT_TAGS.map(tag => {
                      const isSelected = form.tags.includes(tag.id);
                      return (
                        <button key={tag.id} type="button" onClick={() => setForm(f => ({ ...f, tags: isSelected ? f.tags.filter(t => t !== tag.id) : [...f.tags, tag.id] }))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border transition-all" style={{
                          backgroundColor: isSelected ? `${tag.color}20` : "transparent",
                          color: isSelected ? tag.color : "var(--text-muted)",
                          fontWeight: isSelected ? 500 : 400,
                          borderColor: isSelected ? "transparent" : "var(--border-subtle)",
                        }}>
                          <Tag className="w-3 h-3" /> {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tasks Section */}
                <div className="pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[12px] flex items-center gap-2" style={lblStyle}>
                      <ListChecks className="w-4 h-4" /> Tarefas ({formTasks.length})
                    </label>
                    <button onClick={openAddTask} className="flex items-center gap-1 text-[11px] transition-colors" style={{ color: "var(--accent)" }}>
                      <Plus className="w-3 h-3" /> Adicionar Tarefa
                    </button>
                  </div>

                  {formTasks.length > 0 && (
                    <div className="space-y-1.5">
                      {formTasks.map((task, idx) => (
                        <div key={task.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: taskStatusColor[task.status] }} />
                          <span className="text-[12px] flex-1" style={{ color: task.status === "done" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : "none" }}>
                            {task.title}
                          </span>
                          {task.assignedTo && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)" }}>
                              {getMemberName(task.assignedTo)}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{taskStatusLabel[task.status]}</span>
                          <button onClick={() => openEditTask(idx)} className="p-1 transition-colors" style={{ color: "var(--text-muted)" }}><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => removeTask(idx)} className="p-1 text-[#ef4444] transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {showTaskForm && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-3 rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                          <input type="text" value={taskForm.title} onChange={(e) => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Titulo da tarefa" className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                          <div className="grid grid-cols-3 gap-3">
                            <DatePickerInput value={taskForm.dueDate} onChange={(v) => setTaskForm(f => ({ ...f, dueDate: v }))} />
                            <CustomSelect options={[{ value: "pending", label: "Pendente" }, { value: "in_progress", label: "Fazendo" }, { value: "done", label: "Feita" }]} value={taskForm.status} onChange={(v) => setTaskForm(f => ({ ...f, status: v as any }))} />
                            {memberOptions.length > 0 && <CustomSelect options={memberOptions} value={taskForm.assignedTo} onChange={(v) => setTaskForm(f => ({ ...f, assignedTo: v }))} placeholder="Responsavel" searchable />}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={saveTask} disabled={!taskForm.title.trim()} className="px-4 py-1.5 rounded-lg text-[11px] transition-colors disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                              {editingTaskIdx !== null ? "Salvar" : "Adicionar"}
                            </button>
                            <button onClick={() => setShowTaskForm(false)} className="px-3 py-1.5 text-[11px] transition-colors" style={{ color: "var(--text-muted)" }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Deliverables Section */}
                <div className="pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[12px] flex items-center gap-2" style={lblStyle}>
                      <Paperclip className="w-4 h-4" /> Entregaveis ({formDeliverables.length})
                    </label>
                    <button onClick={() => { setShowDeliverableForm(true); setDeliverableType("link"); setDeliverableLabel(""); setDeliverableUrl(""); }} className="flex items-center gap-1 text-[11px] transition-colors" style={{ color: "var(--accent)" }}>
                      <Plus className="w-3 h-3" /> Adicionar Entregavel
                    </button>
                  </div>

                  {formDeliverables.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {formDeliverables.map((del) => (
                        <div key={del.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
                          {del.type === "link" ? <Link2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#3b82f6" }} /> : del.mimeType?.startsWith("image/") ? <ImageIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "#8b5cf6" }} /> : <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "#f59e0b" }} />}
                          <span className="text-[12px] flex-1 truncate" style={{ color: "var(--text-primary)" }}>{del.label}</span>
                          {del.type === "file" && del.fileSize && (
                            <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)" }}>
                              {del.fileSize < 1024 * 1024 ? `${(del.fileSize / 1024).toFixed(0)}KB` : `${(del.fileSize / 1024 / 1024).toFixed(1)}MB`}
                            </span>
                          )}
                          {del.url && (
                            <a href={del.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 transition-colors" style={{ color: del.type === "link" ? "#3b82f6" : "#8b5cf6" }}>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button onClick={() => void removeDeliverable(del.id)} disabled={deletingDeliverableId === del.id} className="p-1 text-[#ef4444] transition-colors disabled:opacity-50">
                            {deletingDeliverableId === del.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {showDeliverableForm && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}>
                          <div className="flex gap-2">
                            {(["link", "file"] as const).map(t => (
                              <button key={t} onClick={() => setDeliverableType(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all" style={{
                                backgroundColor: deliverableType === t ? "rgba(var(--accent-rgb),0.15)" : "transparent",
                                color: deliverableType === t ? "var(--accent)" : "var(--text-muted)",
                                border: deliverableType === t ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid var(--border-subtle)",
                                fontWeight: deliverableType === t ? 500 : 400,
                              }}>
                                {t === "link" ? <Link2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                {t === "link" ? "Link" : "Arquivo"}
                              </button>
                            ))}
                          </div>
                          <input type="text" value={deliverableLabel} onChange={(e) => setDeliverableLabel(e.target.value)} placeholder="Titulo do entregavel" className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                          {deliverableType === "link" ? (
                            <input type="url" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg px-3 py-2 text-[12px] focus:outline-none" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }} />
                          ) : (
                            <div
                              className="text-center py-4 rounded-lg border border-dashed cursor-pointer transition-colors"
                              style={{ borderColor: uploadingFile ? "var(--accent)" : "var(--border-default)" }}
                              onClick={() => !uploadingFile && fileInputRef.current?.click()}
                            >
                              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" className="hidden" onChange={handleFileUpload} />
                              {uploadingFile ? (
                                <>
                                  <Loader2 className="w-6 h-6 mx-auto mb-1 animate-spin" style={{ color: "var(--accent)" }} />
                                  <p className="text-[11px]" style={{ color: "var(--accent)" }}>Enviando arquivo...</p>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-6 h-6 mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Clique para selecionar arquivo</p>
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>Imagens (JPG, PNG, GIF, WebP) e PDF ate 10MB</p>
                                </>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {deliverableType === "link" ? (
                              <button onClick={addDeliverable} disabled={!deliverableLabel.trim() || !deliverableUrl.trim()} className="px-4 py-1.5 rounded-lg text-[11px] transition-colors disabled:opacity-40" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                                Adicionar
                              </button>
                            ) : (
                              <button onClick={() => { if (!deliverableLabel.trim()) { toast.error("Informe o titulo do entregavel"); return; } fileInputRef.current?.click(); }} disabled={uploadingFile} className="px-4 py-1.5 rounded-lg text-[11px] transition-colors disabled:opacity-40 flex items-center gap-1.5" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                                {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                {uploadingFile ? "Enviando..." : "Enviar Arquivo"}
                              </button>
                            )}
                            <button onClick={() => setShowDeliverableForm(false)} className="px-3 py-1.5 text-[11px] transition-colors" style={{ color: "var(--text-muted)" }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="text-[12px] mb-1.5 block" style={lblStyle}>Observacoes</label>
                  <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotacoes internas..." rows={2} className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none" style={isStyle} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
                <button onClick={saveProject} disabled={!form.name.trim()} className="px-6 py-2.5 rounded-xl text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                  {editingId ? "Salvar" : "Criar Projeto"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column Settings Modal */}
      <AnimatePresence>
        {showColumnSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowColumnSettings(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Personalizar Colunas</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetColumns} className="p-1.5 rounded-lg transition-colors text-[#f59e0b]" title="Restaurar padrao">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowColumnSettings(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto custom-scrollbar p-6 space-y-3">
                {editingColumns.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: "var(--bg-base)", border: "1px solid var(--border-extra-subtle)" }}>
                    <GripVertical className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                    <input type="text" value={col.title} onChange={(e) => setEditingColumns(prev => prev.map((c, i) => i === idx ? { ...c, title: e.target.value } : c))} className="flex-1 bg-transparent text-[13px] focus:outline-none" style={{ color: "var(--text-primary)" }} />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] px-2 py-0.5 rounded-md" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-input)" }}>{col.status}</span>
                      <div className="relative group">
                        <button className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ border: "1px solid var(--border-default)" }}>
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.color }} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 rounded-xl p-2 shadow-2xl hidden group-hover:flex flex-wrap gap-1 w-[140px] z-10" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
                          {COLUMN_COLORS.map(c => (
                            <button key={c} onClick={() => setEditingColumns(prev => prev.map((col2, i) => i === idx ? { ...col2, color: c } : col2))} className={`w-5 h-5 rounded-md transition-all ${col.color === c ? "ring-2 ring-white scale-110" : "hover:scale-110"}`} style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                      {editingColumns.length > 2 && (
                        <button onClick={() => setEditingColumns(prev => prev.filter((_, i) => i !== idx))} className="p-1 rounded-lg text-[#ef4444] hover:bg-[#ef4444]/5 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add New Column */}
                <div className="rounded-xl p-3 border border-dashed space-y-2" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-default)" }}>
                  <div className="flex items-center gap-3">
                    <Plus className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <input type="text" value={newColTitle} onChange={(e) => { setNewColTitle(e.target.value); if (!newColStatus) setNewColStatus(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")); }} placeholder="Nome da nova coluna..." className="flex-1 bg-transparent text-[13px] focus:outline-none" style={{ color: "var(--text-primary)" }} />
                    <div className="relative group">
                      <button className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ border: "1px solid var(--border-default)" }}>
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: newColColor }} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 rounded-xl p-2 shadow-2xl hidden group-hover:flex flex-wrap gap-1 w-[140px] z-10" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
                        {COLUMN_COLORS.map(c => (
                          <button key={c} onClick={() => setNewColColor(c)} className={`w-5 h-5 rounded-md transition-all ${newColColor === c ? "ring-2 ring-white scale-110" : "hover:scale-110"}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (newColTitle.trim()) {
                          const statusKey = newColStatus || newColTitle.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
                          setEditingColumns(prev => [...prev, { id: generateId(), title: newColTitle.trim(), color: newColColor, status: statusKey as ProjectStatus, order: prev.length }]);
                          setNewColTitle(""); setNewColColor(COLUMN_COLORS[(editingColumns.length + 1) % COLUMN_COLORS.length]); setNewColStatus("");
                        }
                      }}
                      disabled={!newColTitle.trim()}
                      className="px-3 py-1.5 rounded-lg text-[11px] transition-colors disabled:opacity-30"
                      style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => setShowColumnSettings(false)} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Cancelar
                </button>
                <button onClick={saveColumnSettings} className="px-6 py-2.5 rounded-xl text-[13px] transition-colors" style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}>
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancellation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-xl bg-[#ef4444]/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#ef4444]" />
                </div>
                <div>
                  <h2 className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Cancelar Projeto</h2>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Registre o motivo para analise futura</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[12px] mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Motivo do Cancelamento</label>
                  <CustomSelect options={cancelReasonOptions} value={cancelReason} onChange={(v) => setCancelReason(v)} placeholder="Selecionar motivo" searchable allowCreate onCreate={(v) => setCancelReason(v)} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => { setShowCancelModal(false); setCancelProjectId(null); }} className="px-4 py-2.5 text-[13px] rounded-xl transition-colors" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  Voltar
                </button>
                <button onClick={confirmCancel} className="px-6 py-2.5 bg-[#ef4444] text-white rounded-xl text-[13px] hover:bg-[#ef4444]/90 transition-colors" style={{ fontWeight: 500 }}>
                  Confirmar Cancelamento
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
