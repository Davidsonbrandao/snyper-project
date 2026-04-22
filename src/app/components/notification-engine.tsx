import { useEffect, useRef, useCallback } from "react";
import { useFinance } from "../lib/finance-context";
import { useNotifications } from "../lib/notification-context";

/**
 * NotificationEngine - runs periodically and generates notifications based on data state.
 * Covers: accounts, projects, tasks, pipeline deals, marketing actions, expenses with due dates.
 */
export function NotificationEngine() {
  const { accounts, projects, pipelineDeals, pipelineColumns, expenses, marketingActions } = useFinance();
  const { notifications, addNotification } = useNotifications();
  const checkedRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const runChecks = useCallback(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const todayDate = new Date(today + "T23:59:59");

    // Helper: get date string N days from today
    const daysFromNow = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + n);
      return d.toISOString().split("T")[0];
    };
    const tomorrow = daysFromNow(1);
    const in3Days = daysFromNow(3);
    const in7Days = daysFromNow(7);

    // Helper: check and add notification (avoids duplicates)
    const notify = (key: string, data: Parameters<typeof addNotification>[0]) => {
      if (checkedRef.current.has(key)) return;
      checkedRef.current.add(key);
      addNotification(data);
    };

    // ============================================
    // 1. CONTAS A PAGAR / RECEBER
    // ============================================
    accounts.forEach(acc => {
      if (acc.status === "paid") return;

      // Overdue
      if (acc.dueDate < today) {
        notify(`account_overdue_${acc.id}_${acc.dueDate}`, {
          type: "account_due",
          title: acc.type === "payable" ? "Conta a pagar vencida" : "Conta a receber vencida",
          message: `${acc.description} - R$ ${acc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (venceu em ${formatDateBR(acc.dueDate)})`,
          link: "/contas",
          color: "#ef4444",
        });
      }
      // Due today
      else if (acc.dueDate === today) {
        notify(`account_today_${acc.id}_${acc.dueDate}`, {
          type: "account_due",
          title: acc.type === "payable" ? "Conta a pagar vence hoje" : "Conta a receber vence hoje",
          message: `${acc.description} - R$ ${acc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          link: "/contas",
          color: "#f59e0b",
        });
      }
      // Due tomorrow
      else if (acc.dueDate === tomorrow) {
        notify(`account_tomorrow_${acc.id}_${acc.dueDate}`, {
          type: "account_due",
          title: acc.type === "payable" ? "Conta a pagar vence amanha" : "Conta a receber vence amanha",
          message: `${acc.description} - R$ ${acc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          link: "/contas",
          color: "#f59e0b",
        });
      }
      // Due in 3 days
      else if (acc.dueDate <= in3Days && acc.dueDate > tomorrow) {
        notify(`account_3d_${acc.id}_${acc.dueDate}`, {
          type: "account_due",
          title: acc.type === "payable" ? "Conta a pagar proxima" : "Conta a receber proxima",
          message: `${acc.description} vence em ${formatDateBR(acc.dueDate)} - R$ ${acc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          link: "/contas",
          color: "#3b82f6",
        });
      }
    });

    // ============================================
    // 2. PROJETOS
    // ============================================
    projects.forEach(proj => {
      if (proj.status === "done" || proj.status === "cancelled") return;
      if (!proj.dueDate) return;

      // Overdue
      if (proj.dueDate < today) {
        notify(`project_overdue_${proj.id}`, {
          type: "project_overdue",
          title: "Projeto atrasado",
          message: `"${proj.name}" ultrapassou o prazo (${formatDateBR(proj.dueDate)})`,
          link: "/projetos",
          color: "#ef4444",
        });
      }
      // Due today
      else if (proj.dueDate === today) {
        notify(`project_today_${proj.id}`, {
          type: "project_overdue",
          title: "Projeto vence hoje",
          message: `"${proj.name}" tem entrega prevista para hoje`,
          link: "/projetos",
          color: "#f59e0b",
        });
      }
      // Due tomorrow
      else if (proj.dueDate === tomorrow) {
        notify(`project_tomorrow_${proj.id}`, {
          type: "project_overdue",
          title: "Projeto vence amanha",
          message: `"${proj.name}" tem entrega prevista para amanha`,
          link: "/projetos",
          color: "#f59e0b",
        });
      }
      // Due in 3 days
      else if (proj.dueDate <= in3Days && proj.dueDate > tomorrow) {
        notify(`project_3d_${proj.id}`, {
          type: "project_overdue",
          title: "Projeto com prazo proximo",
          message: `"${proj.name}" vence em ${formatDateBR(proj.dueDate)}`,
          link: "/projetos",
          color: "#3b82f6",
        });
      }
    });

    // ============================================
    // 3. TAREFAS DE PROJETOS
    // ============================================
    projects.forEach(proj => {
      if (proj.status === "done" || proj.status === "cancelled") return;
      (proj.tasks || []).forEach(task => {
        if (task.status === "done" || !task.dueDate) return;

        if (task.dueDate < today) {
          notify(`task_overdue_${proj.id}_${task.id}`, {
            type: "task_overdue",
            title: "Tarefa vencida",
            message: `"${task.title}" no projeto "${proj.name}" (venceu em ${formatDateBR(task.dueDate)})`,
            link: "/projetos",
            color: "#ef4444",
          });
        } else if (task.dueDate === today) {
          notify(`task_today_${proj.id}_${task.id}`, {
            type: "task_overdue",
            title: "Tarefa vence hoje",
            message: `"${task.title}" no projeto "${proj.name}"`,
            link: "/projetos",
            color: "#f59e0b",
          });
        } else if (task.dueDate === tomorrow) {
          notify(`task_tomorrow_${proj.id}_${task.id}`, {
            type: "task_overdue",
            title: "Tarefa vence amanha",
            message: `"${task.title}" no projeto "${proj.name}"`,
            link: "/projetos",
            color: "#f59e0b",
          });
        }
      });
    });

    // ============================================
    // 4. PIPELINE - Deals parados (sem atualizar ha 7+ dias)
    // ============================================
    pipelineDeals.forEach(deal => {
      // Skip closed deals (won/lost)
      const col = pipelineColumns.find(c => c.id === deal.columnId);
      if (col?.isWinColumn || col?.isLossColumn) return;

      const updatedAt = new Date(deal.updatedAt || deal.createdAt);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceUpdate >= 7) {
        notify(`deal_stale_${deal.id}_${Math.floor(daysSinceUpdate / 7)}`, {
          type: "system",
          title: "Negociacao parada",
          message: `"${deal.title}" esta sem movimentacao ha ${daysSinceUpdate} dias (${col?.title || "Pipeline"})`,
          link: "/pipeline",
          color: "#f59e0b",
        });
      }
    });

    // ============================================
    // 5. ACOES DE MARKETING - pagamento pendente ou campanha encerrada
    // ============================================
    (marketingActions || []).forEach(action => {
      // Payment pending and end date passed
      if (action.paymentStatus !== "paid" && action.endDate && action.endDate < today) {
        notify(`marketing_payment_${action.id}`, {
          type: "system",
          title: "Pagamento pendente de campanha",
          message: `"${action.name}" encerrou em ${formatDateBR(action.endDate)} mas o pagamento esta ${action.paymentStatus === "partial" ? "parcial" : "pendente"}`,
          link: "/marketing",
          color: "#f59e0b",
        });
      }

      // Campaign starts today
      if (action.startDate === today && action.status === "planned") {
        notify(`marketing_start_${action.id}`, {
          type: "system",
          title: "Campanha inicia hoje",
          message: `"${action.name}" esta programada para comecar hoje`,
          link: "/marketing",
          color: "#3b82f6",
        });
      }

      // Campaign ends today
      if (action.endDate === today && action.status === "active") {
        notify(`marketing_end_${action.id}`, {
          type: "system",
          title: "Campanha encerra hoje",
          message: `"${action.name}" esta programada para encerrar hoje`,
          link: "/marketing",
          color: "#f59e0b",
        });
      }
    });

    // ============================================
    // 6. DESPESAS FIXAS - com vencimento proximo
    // ============================================
    (expenses || []).forEach(exp => {
      if (!exp.dueDate) return;

      // Due today
      if (exp.dueDate === today) {
        notify(`expense_today_${exp.id}_${exp.dueDate}`, {
          type: "account_due",
          title: "Despesa fixa vence hoje",
          message: `${exp.name} - ${exp.unit === "%" ? `${exp.amount}%` : `R$ ${exp.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}`,
          link: "/despesas",
          color: "#f59e0b",
        });
      }
      // Due tomorrow
      else if (exp.dueDate === tomorrow) {
        notify(`expense_tomorrow_${exp.id}_${exp.dueDate}`, {
          type: "account_due",
          title: "Despesa fixa vence amanha",
          message: `${exp.name} - ${exp.unit === "%" ? `${exp.amount}%` : `R$ ${exp.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}`,
          link: "/despesas",
          color: "#3b82f6",
        });
      }
      // Overdue
      else if (exp.dueDate < today) {
        notify(`expense_overdue_${exp.id}_${exp.dueDate}`, {
          type: "account_due",
          title: "Despesa fixa vencida",
          message: `${exp.name} venceu em ${formatDateBR(exp.dueDate)}`,
          link: "/despesas",
          color: "#ef4444",
        });
      }
    });

    // ============================================
    // 7. PIPELINE - Deals ganhos (comemoracao)
    // ============================================
    pipelineDeals.forEach(deal => {
      const col = pipelineColumns.find(c => c.id === deal.columnId);
      if (!col?.isWinColumn) return;
      if (!deal.closedAt) return;

      const closedDate = deal.closedAt.split("T")[0];
      if (closedDate === today) {
        notify(`deal_won_${deal.id}`, {
          type: "deal_won",
          title: "Negociacao fechada com sucesso",
          message: `"${deal.title}" - R$ ${(deal.realValue || deal.estimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          link: "/pipeline",
          color: "#22c55e",
        });
      }
    });

  }, [accounts, projects, pipelineDeals, pipelineColumns, expenses, marketingActions, addNotification]);

  // Initialize checked set from existing notifications to avoid duplicates on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      // Mark any existing notification keys as checked
      notifications.forEach(n => {
        // Use a combination of type + title + partial message as dedup key
        checkedRef.current.add(`${n.type}_${n.title}_${n.message?.slice(0, 30)}`);
      });
    }
  }, []);

  // Run checks when data changes and on an interval (every 5 min)
  useEffect(() => {
    // Small delay to let data settle after load
    const timer = setTimeout(() => runChecks(), 2000);
    const interval = setInterval(runChecks, 5 * 60 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [runChecks]);

  return null;
}

// Format date to BR format
function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
