import { useState, useRef, useEffect } from "react";
import {
  Bell, X, Check, CheckCheck, Trash2,
  AlertTriangle, Trophy, XCircle, Calendar,
  ListChecks, DollarSign, Info, Megaphone, Target,
  UserCheck, Package,
} from "lucide-react";
import { useNotifications, type AppNotification } from "../lib/notification-context";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";

const ICON_MAP: Record<string, any> = {
  task_assigned: ListChecks,
  task_overdue: AlertTriangle,
  account_due: Calendar,
  deal_won: Trophy,
  deal_lost: XCircle,
  project_overdue: AlertTriangle,
  system: Info,
  goal_alert: Target,
  marketing_alert: Megaphone,
  expense_alert: DollarSign,
  deliverable_added: Package,
  member_tagged: UserCheck,
};

const COLOR_MAP: Record<string, string> = {
  task_assigned: "#3b82f6",
  task_overdue: "#ef4444",
  account_due: "#f59e0b",
  deal_won: "#22c55e",
  deal_lost: "#ef4444",
  project_overdue: "#ef4444",
  system: "#8a8a99",
  goal_alert: "#8b5cf6",
  marketing_alert: "#06b6d4",
  expense_alert: "#f59e0b",
  deliverable_added: "#22c55e",
  member_tagged: "#3b82f6",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const filteredNotifications = filter === "unread"
    ? notifications.filter(n => !n.read)
    : notifications;

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#FF0074] text-white text-[10px] px-1" style={{ fontWeight: 600 }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] rounded-2xl shadow-2xl overflow-hidden z-[100] flex flex-col"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Notificacoes</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-[#FF0074]/15 text-[#FF0074] px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>
                    {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg text-[#8a8a99] hover:text-[#22c55e] hover:bg-white/[0.04] transition-colors"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1.5 rounded-lg text-[#8a8a99] hover:text-[#ef4444] hover:bg-white/[0.04] transition-colors"
                    title="Limpar todas"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-[#8a8a99] hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
              {(["all", "unread"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-[11px] transition-all"
                  style={{
                    fontWeight: filter === f ? 500 : 400,
                    backgroundColor: filter === f ? "rgba(var(--accent-rgb),0.15)" : "transparent",
                    color: filter === f ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {f === "all" ? "Todas" : "Nao lidas"}
                </button>
              ))}
            </div>

            {/* Notifications list */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-10 h-10 mb-3" style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    {filter === "unread" ? "Nenhuma notificacao nao lida" : "Nenhuma notificacao"}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const IconComp = ICON_MAP[n.type] || Info;
                  const color = n.color || COLOR_MAP[n.type] || "#8a8a99";

                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border-extra-subtle)",
                        backgroundColor: !n.read ? "rgba(var(--accent-rgb),0.02)" : "transparent",
                      }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <IconComp className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12px] leading-tight" style={{ fontWeight: !n.read ? 500 : 400, color: !n.read ? "var(--text-primary)" : "var(--text-secondary)" }}>
                            {n.title}
                          </p>
                          <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                        {n.link && (
                          <span className="text-[10px] mt-1 inline-block" style={{ color: "var(--accent)" }}>Ver detalhes</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-1">
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                            className="p-1 rounded text-[#8a8a99] hover:text-[#22c55e] transition-colors"
                            title="Marcar como lida"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                          className="p-1 rounded text-[#8a8a99] hover:text-[#ef4444] transition-colors"
                          title="Remover"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ backgroundColor: "var(--accent)" }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}