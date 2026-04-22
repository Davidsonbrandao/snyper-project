import { useMemo, useRef } from "react";
import {
  FolderKanban, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Briefcase, User, Calendar,
  ArrowUpRight, BarChart3, Layers, Timer,
  ListChecks, Crown, Zap, Target, Paperclip,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router";
import { useFinance } from "../lib/finance-context";
import {
  formatCurrency,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS,
} from "../lib/finance-data";

const COLORS = ["#FF0074", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#8a8a99"];

interface Props {
  dateRange: { start: Date; end: Date };
  period: string;
}

export function DashboardProjectsTab({ dateRange, period }: Props) {
  const { projects, clients, services, commissionMembers } = useFinance();
  const navigate = useNavigate();
  const nowRef = useRef(new Date());
  const now = nowRef.current;

  const allActive = projects.filter(p => !["done", "cancelled"].includes(p.status));
  const allDone = projects.filter(p => p.status === "done");
  const allOverdue = allActive.filter(p => p.dueDate && new Date(p.dueDate + "T23:59:59") < now);

  // All tasks across all projects
  const allTasks = useMemo(() => projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectId: p.id, projectName: p.name }))), [projects]);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === "done").length;
  const inProgressTasks = allTasks.filter(t => t.status === "in_progress").length;
  const pendingTasks = allTasks.filter(t => t.status === "pending").length;
  const overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate + "T23:59:59") < now && t.status !== "done").length;

  // Deliverables count
  const totalDeliverables = projects.map(p => p.deliverables?.length || 0).reduce((s, n) => s + n, 0);

  // Stats
  const stats = useMemo(() => {
    const totalValue = allActive.reduce((s, p) => s + p.estimatedValue, 0);
    const completedValue = allDone.reduce((s, p) => s + p.estimatedValue, 0);

    const deliveryTimes = allDone
      .filter(p => p.completedAt && p.startDate)
      .map(p => differenceInDays(new Date(p.completedAt!), new Date(p.startDate)));
    const avgDeliveryDays = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((s, d) => s + d, 0) / deliveryTimes.length)
      : 0;

    const withDeadline = allDone.filter(p => p.dueDate && p.completedAt);
    const onTime = withDeadline.filter(p => new Date(p.completedAt!) <= new Date(p.dueDate! + "T23:59:59"));
    const onTimeRate = withDeadline.length > 0 ? Math.round((onTime.length / withDeadline.length) * 100) : 100;

    const taskRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return {
      active: allActive.length,
      done: allDone.length,
      overdue: allOverdue.length,
      totalValue,
      completedValue,
      avgDeliveryDays,
      onTimeRate,
      taskRate,
    };
  }, [projects, allActive, allDone, allOverdue, totalTasks, doneTasks]);

  // User/member ranking - tracks who is assigned to most tasks/projects
  const memberRanking = useMemo(() => {
    const map: Record<string, { name: string; totalTasks: number; doneTasks: number; inProgress: number; overdue: number; projects: Set<string> }> = {};

    // Count from task assignments
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        if (t.assignedTo) {
          if (!map[t.assignedTo]) map[t.assignedTo] = { name: "", totalTasks: 0, doneTasks: 0, inProgress: 0, overdue: 0, projects: new Set() };
          map[t.assignedTo].totalTasks++;
          map[t.assignedTo].projects.add(p.id);
          if (t.status === "done") map[t.assignedTo].doneTasks++;
          if (t.status === "in_progress") map[t.assignedTo].inProgress++;
          if (t.dueDate && new Date(t.dueDate + "T23:59:59") < now && t.status !== "done") map[t.assignedTo].overdue++;
        }
      });
      // Count from project assignment
      if (p.assignedTo) {
        if (!map[p.assignedTo]) map[p.assignedTo] = { name: "", totalTasks: 0, doneTasks: 0, inProgress: 0, overdue: 0, projects: new Set() };
        map[p.assignedTo].projects.add(p.id);
      }
    });

    // Resolve names
    Object.keys(map).forEach(id => {
      const member = commissionMembers.find(m => m.id === id);
      map[id].name = member?.name || "Sem nome";
    });

    return Object.entries(map)
      .map(([id, data]) => ({
        id,
        name: data.name,
        totalTasks: data.totalTasks,
        doneTasks: data.doneTasks,
        inProgress: data.inProgress,
        overdue: data.overdue,
        projectCount: data.projects.size,
        completionRate: data.totalTasks > 0 ? Math.round((data.doneTasks / data.totalTasks) * 100) : 0,
      }))
      .sort((a, b) => b.totalTasks - a.totalTasks)
      .slice(0, 8);
  }, [projects, commissionMembers, now]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({
      name: PROJECT_STATUS_LABELS[status] || status,
      value: count,
      color: PROJECT_STATUS_COLORS[status] || "#8a8a99",
    }));
  }, [projects]);

  // Priority distribution
  const priorityDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    allActive.forEach(p => { map[p.priority] = (map[p.priority] || 0) + 1; });
    return Object.entries(DEAL_PRIORITY_LABELS).map(([key, label]) => ({
      name: label,
      value: map[key] || 0,
      color: DEAL_PRIORITY_COLORS[key as keyof typeof DEAL_PRIORITY_COLORS],
    })).filter(d => d.value > 0);
  }, [allActive]);

  // By service
  const byService = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    projects.forEach(p => {
      const svcIds = p.serviceIds || (p.serviceId ? [p.serviceId] : []);
      if (svcIds.length === 0) {
        if (!map["Sem servico"]) map["Sem servico"] = { count: 0, value: 0 };
        map["Sem servico"].count++;
        map["Sem servico"].value += p.estimatedValue;
      } else {
        svcIds.forEach(sid => {
          const svc = services.find(s => s.id === sid)?.name || "Desconhecido";
          if (!map[svc]) map[svc] = { count: 0, value: 0 };
          map[svc].count++;
          map[svc].value += p.estimatedValue / svcIds.length;
        });
      }
    });
    return Object.entries(map).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.value - a.value);
  }, [projects, services]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { created: number; completed: number }> = {};
    projects.forEach(p => {
      const month = p.createdAt.substring(0, 7);
      if (!map[month]) map[month] = { created: 0, completed: 0 };
      map[month].created++;
    });
    allDone.forEach(p => {
      if (p.completedAt) {
        const month = p.completedAt.substring(0, 7);
        if (!map[month]) map[month] = { created: 0, completed: 0 };
        map[month].completed++;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM/yy", { locale: ptBR }),
        ...data,
      }));
  }, [projects, allDone]);

  // Upcoming deadlines
  const upcomingDeadlines = useMemo(() => {
    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    return allActive
      .filter(p => p.dueDate)
      .filter(p => new Date(p.dueDate! + "T23:59:59") <= in14Days)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 6);
  }, [allActive]);

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    const c = clients.find(cl => cl.id === clientId);
    if (!c) return null;
    return c.type === "pf" ? c.fullName : (c.nomeFantasia || c.razaoSocial);
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl px-4 py-3 shadow-xl" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
        <p className="text-[12px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-[11px]" style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" && p.value > 100 ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderKanban className="w-16 h-16 mb-4" style={{ color: "var(--text-muted)", opacity: 0.2 }} />
        <h3 className="text-[16px] mb-2" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Nenhum projeto cadastrado</h3>
        <p className="text-[13px] mb-6 max-w-md" style={{ color: "var(--text-secondary)" }}>
          Crie projetos na pagina de Projetos para acompanhar o progresso da producao e visualizar metricas aqui.
        </p>
        <button
          onClick={() => navigate("/projetos")}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}
        >
          <FolderKanban className="w-4 h-4" />
          Ir para Projetos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Projetos Ativos", value: String(stats.active), sub: `${stats.overdue} atrasado(s)`, icon: FolderKanban, color: "var(--accent)", subColor: stats.overdue > 0 ? "#ef4444" : "var(--text-muted)" },
          { label: "Valor em Producao", value: formatCurrency(stats.totalValue), sub: `${formatCurrency(stats.completedValue)} entregues`, icon: TrendingUp, color: "#3b82f6", subColor: "#22c55e" },
          { label: "Tempo Medio", value: `${stats.avgDeliveryDays}d`, sub: `${stats.onTimeRate}% no prazo`, icon: Timer, color: "#f59e0b", subColor: stats.onTimeRate >= 80 ? "#22c55e" : "#ef4444" },
          { label: "Total Tarefas", value: String(totalTasks), sub: `${doneTasks} concluidas`, icon: ListChecks, color: "#8b5cf6", subColor: "var(--text-muted)" },
          { label: "Tarefas em Atraso", value: String(overdueTasks), sub: `${inProgressTasks} em progresso`, icon: AlertTriangle, color: overdueTasks > 0 ? "#ef4444" : "var(--text-muted)", subColor: "#f59e0b" },
          { label: "Entregaveis", value: String(totalDeliverables), sub: `${stats.done} projetos entregues`, icon: Paperclip, color: "#22c55e", subColor: "var(--text-muted)" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: kpi.color === "var(--accent)" ? "rgba(var(--accent-rgb),0.1)" : `${kpi.color}15` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{kpi.label}</span>
            </div>
            <p className="text-[17px] mb-0.5" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{kpi.value}</p>
            <p className="text-[10px]" style={{ color: kpi.subColor }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Task Completion Bar */}
      {totalTasks > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Progresso Geral de Tarefas</h3>
            <span className="text-[13px]" style={{ fontWeight: 600, color: "var(--accent)" }}>{stats.taskRate}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "var(--border-subtle)" }}>
            {doneTasks > 0 && <div className="h-full transition-all" style={{ width: `${(doneTasks / totalTasks) * 100}%`, backgroundColor: "#22c55e" }} />}
            {inProgressTasks > 0 && <div className="h-full transition-all" style={{ width: `${(inProgressTasks / totalTasks) * 100}%`, backgroundColor: "#f59e0b" }} />}
            {pendingTasks > 0 && <div className="h-full transition-all" style={{ width: `${(pendingTasks / totalTasks) * 100}%`, backgroundColor: "#3b82f6" }} />}
          </div>
          <div className="flex gap-4 mt-2">
            {[
              { label: "Concluidas", count: doneTasks, color: "#22c55e" },
              { label: "Em progresso", count: inProgressTasks, color: "#f59e0b" },
              { label: "Pendentes", count: pendingTasks, color: "#3b82f6" },
              { label: "Atrasadas", count: overdueTasks, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}: <strong style={{ color: "var(--text-primary)" }}>{s.count}</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts + Ranking Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution - smaller */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[13px] mb-3" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Status dos Projetos</h3>
          {statusDistribution.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[120px] h-[120px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                      {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={customTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                    </div>
                    <span className="text-[11px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-center py-6" style={{ color: "var(--text-muted)" }}>Sem dados</p>
          )}
        </div>

        {/* Priority Distribution - smaller */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[13px] mb-3" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Prioridade (Ativos)</h3>
          {priorityDistribution.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[120px] h-[120px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={priorityDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                      {priorityDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={customTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {priorityDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                    </div>
                    <span className="text-[11px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-center py-6" style={{ color: "var(--text-muted)" }}>Nenhum projeto ativo</p>
          )}
        </div>

        {/* Performance Ranking */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <h3 className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Ranking de Performance</h3>
          </div>
          {memberRanking.length > 0 ? (
            <div className="space-y-2">
              {memberRanking.map((member, idx) => (
                <div key={member.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]" style={{
                    fontWeight: 700,
                    backgroundColor: idx === 0 ? "rgba(245,158,11,0.2)" : idx === 1 ? "rgba(192,192,192,0.2)" : idx === 2 ? "rgba(205,127,50,0.2)" : "var(--bg-card)",
                    color: idx === 0 ? "#f59e0b" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "var(--text-muted)",
                  }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{member.name}</p>
                    <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                      {member.projectCount} proj. / {member.totalTasks} tarefas
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px]" style={{ fontWeight: 600, color: member.completionRate >= 80 ? "#22c55e" : member.completionRate >= 50 ? "#f59e0b" : "var(--text-muted)" }}>
                      {member.completionRate}%
                    </p>
                    {member.overdue > 0 && (
                      <p className="text-[9px] text-[#ef4444]">{member.overdue} atraso(s)</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <User className="w-8 h-8 mb-2" style={{ color: "var(--text-muted)", opacity: 0.2 }} />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Atribua responsaveis nas tarefas e projetos para ver o ranking</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      {monthlyTrend.length > 0 && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[13px] mb-4" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Tendencia Mensal</h3>
          <div className="h-[200px]">
            <ResponsiveContainer>
              <BarChart data={monthlyTrend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={customTooltip} />
                <Bar dataKey="created" name="Criados" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" name="Concluidos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Service */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[13px] mb-4" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Projetos por Servico</h3>
          {byService.length > 0 ? (
            <div className="space-y-3">
              {byService.slice(0, 6).map((item, idx) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.count} proj.</span>
                      <span className="text-[11px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${byService[0].value > 0 ? (item.value / byService[0].value) * 100 : 0}%`,
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-center py-8" style={{ color: "var(--text-muted)" }}>Sem dados</p>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Proximos Prazos</h3>
            <button
              onClick={() => navigate("/projetos")}
              className="text-[11px] flex items-center gap-1 transition-colors"
              style={{ color: "var(--accent)" }}
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {upcomingDeadlines.length > 0 ? (
            <div className="space-y-2">
              {upcomingDeadlines.map((project) => {
                const daysLeft = differenceInDays(new Date(project.dueDate! + "T23:59:59"), now);
                const isOverdue = daysLeft < 0;
                const isUrgent = daysLeft >= 0 && daysLeft <= 3;
                const clientName = getClientName(project.clientId);

                return (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
                    style={{ backgroundColor: "var(--bg-input)" }}
                    onClick={() => navigate("/projetos")}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEAL_PRIORITY_COLORS[project.priority] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{project.name}</p>
                      {clientName && <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{clientName}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px]" style={{ fontWeight: 500, color: isOverdue ? "#ef4444" : isUrgent ? "#f59e0b" : "var(--text-muted)" }}>
                        {isOverdue ? `${Math.abs(daysLeft)}d atrasado` : daysLeft === 0 ? "Hoje" : `${daysLeft}d restantes`}
                      </p>
                      <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(project.dueDate! + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="w-8 h-8 mb-2" style={{ color: "#22c55e", opacity: 0.2 }} />
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Nenhum prazo proximo</p>
            </div>
          )}
        </div>

        {/* SLA Health Summary */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[13px] mb-4" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Saude dos Prazos (SLA)</h3>
          {(() => {
            const slaData = allActive.reduce((acc, p) => {
              if (!p.dueDate) { acc.noPrazo++; return acc; }
              const diff = Math.ceil((new Date(p.dueDate + "T23:59:59").getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              if (diff < 0) acc.overdue++;
              else if (diff <= 2) acc.critical++;
              else if (diff <= 5) acc.warning++;
              else acc.safe++;
              return acc;
            }, { overdue: 0, critical: 0, warning: 0, safe: 0, noPrazo: 0 });
            const total = allActive.length || 1;
            const segments = [
              { label: "Atrasados", value: slaData.overdue, color: "#ef4444" },
              { label: "Criticos (1-2d)", value: slaData.critical, color: "#f97316" },
              { label: "Atencao (3-5d)", value: slaData.warning, color: "#f59e0b" },
              { label: "No prazo", value: slaData.safe, color: "#22c55e" },
              { label: "Sem prazo", value: slaData.noPrazo, color: "#8a8a99" },
            ].filter(s => s.value > 0);
            return (
              <div className="space-y-3">
                <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: "var(--border-subtle)" }}>
                  {segments.map((seg) => (
                    <div key={seg.label} className="h-full transition-all" style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }} title={`${seg.label}: ${seg.value}`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {segments.map(seg => (
                    <div key={seg.label} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{seg.label}: <strong>{seg.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Revenue from completed projects */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <h3 className="text-[13px] mb-4" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Receita de Projetos Concluidos</h3>
          {allDone.length > 0 ? (
            <div className="space-y-2">
              {allDone.slice(0, 6).map((p) => {
                const clientName = getClientName(p.clientId) || "";
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-input)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#22c55e" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</p>
                      {clientName && <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{clientName}</p>}
                    </div>
                    <span className="text-[11px] shrink-0" style={{ fontWeight: 600, color: "#22c55e" }}>{formatCurrency(p.estimatedValue)}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 mt-2" style={{ borderTop: "1px solid var(--border-extra-subtle)" }}>
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Total concluido</span>
                <span className="text-[14px]" style={{ fontWeight: 600, color: "#22c55e" }}>{formatCurrency(stats.completedValue)}</span>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-center py-8" style={{ color: "var(--text-muted)" }}>Nenhum projeto concluido</p>
          )}
        </div>
      </div>
    </div>
  );
}
