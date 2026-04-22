import { useState, useEffect, useRef, useCallback } from "react";
import { Logo } from "./ui/logo";
import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  CalendarPlus,
  Briefcase,
  Target,
  Users,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  Pencil,
  Check,
  X,
  User,
  RotateCcw,
  ContactRound,
  Kanban,
  FolderKanban,
  Sun,
  Moon,
  Crown,
  FileCheck,
  FileBarChart2,
} from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { motion, AnimatePresence } from "motion/react";
import svgPaths from "../../imports/svg-wbeul66jpv";
import { usePermissions } from "../lib/permissions-context";
import { useTheme } from "../lib/theme-context";

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Receipt,
  FileText,
  CalendarPlus,
  Briefcase,
  Target,
  Users,
  Megaphone,
  ContactRound,
  Kanban,
  FolderKanban,
  Crown,
  FileCheck,
  FileBarChart2,
};

const defaultNavItems = [
  { to: "/dashboard", iconName: "LayoutDashboard", label: "Dashboard" },,
  { to: "/clientes", iconName: "ContactRound", label: "Clientes" },
  { to: "/pipeline", iconName: "Kanban", label: "Pipeline" },
  { to: "/projetos", iconName: "FolderKanban", label: "Projetos" },
  { to: "/lancamentos", iconName: "CalendarPlus", label: "Lançamentos" },
  { to: "/despesas", iconName: "Receipt", label: "Despesas" },
  { to: "/contas", iconName: "FileText", label: "Contas" },
  { to: "/servicos", iconName: "Briefcase", label: "Serviços" },
  { to: "/marketing", iconName: "Megaphone", label: "Marketing" },
  { to: "/metas", iconName: "Target", label: "Metas" },
  { to: "/relatorios", iconName: "FileBarChart2", label: "Relatórios" },
  { to: "/equipe", iconName: "Users", label: "Equipe" },
  { to: "/notas-fiscais", iconName: "FileCheck", label: "Notas Fiscais (beta)" },
];

const STORAGE_KEY_ORDER = "@pilar:sidebar_order";
const STORAGE_KEY_COLLAPSED = "@pilar:sidebar_collapsed";

export function SidebarNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { canAccessRoute } = usePermissions();
  const { mode, toggleMode } = useTheme();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true"; } catch { return false; }
  });
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [navItems, setNavItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ORDER);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedPaths = new Set(parsed.map((p: any) => p.to));
        const merged = [
          ...parsed.filter((p: any) => defaultNavItems.some(d => d.to === p.to)),
          ...defaultNavItems.filter(d => !savedPaths.has(d.to)),
        ];
        return merged;
      }
    } catch {}
    return defaultNavItems;
  });
  const [editItems, setEditItems] = useState(navItems);

  const isExpanded = !collapsed || hovered;
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userName = user?.user_metadata?.name || user?.user_metadata?.nickname || user?.email?.split("@")[0] || "Usuario";
  const userPhoto = user?.user_metadata?.avatar_url || null;
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
    if (next) setHovered(false);
    // Dispatch storage event for useSidebarWidth to pick up
    window.dispatchEvent(new Event("sidebar-toggle"));
  }, [collapsed]);

  const handleMouseEnter = () => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHovered(true), 80);
  };

  const handleMouseLeave = () => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHovered(false), 200);
  };

  const startEdit = () => {
    setEditItems([...navItems]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditItems(navItems);
  };

  const saveEdit = () => {
    setNavItems(editItems);
    localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(editItems));
    setEditing(false);
  };

  const resetToDefault = () => {
    setEditItems([...defaultNavItems]);
  };

  // Drag handlers for reordering
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newItems = [...editItems];
    const dragged = newItems[dragIndex];
    newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, dragged);
    setEditItems(newItems);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const sidebarWidth = isExpanded ? 240 : 68;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed left-0 top-0 bottom-0 bg-[#0e0e10] border-r border-white/[0.06] flex flex-col z-50 overflow-hidden"
    >
      {/* Logo + Minimize Toggle */}
      <div className="px-3 py-5 flex items-center shrink-0" style={{ minHeight: 68 }}>
        <div className="flex-1 overflow-hidden px-1">
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="full-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Logo variant="full" className="h-7 w-auto" />
              </motion.div>
            ) : (
              <motion.div
                key="mini-logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex justify-center"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: "rgba(0,250,100,0.12)" }}>
                  <Logo variant="mark" className="w-6 h-6" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Minimize/Expand button at top */}
        {isExpanded && (
          <button
            onClick={toggleCollapsed}
            className="p-2 rounded-xl text-[#8a8a99] hover:text-white hover:bg-white/[0.06] transition-all shrink-0"
            title={collapsed ? "Fixar menu aberto" : "Minimizar menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-[16px] h-[16px]" />
            ) : (
              <PanelLeftClose className="w-[16px] h-[16px]" />
            )}
          </button>
        )}
      </div>

      {/* Edit mode header */}
      <AnimatePresence>
        {editing && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 overflow-hidden"
          >
            <div className="px-3 py-2.5 mb-2 bg-[#FF0074]/5 border border-[#FF0074]/15 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#FF0074]" style={{ fontWeight: 500 }}>Editar Menu</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={resetToDefault}
                    className="p-1 rounded-md hover:bg-white/[0.06] text-[#8a8a99] hover:text-[#f59e0b] transition-colors"
                    title="Restaurar ordem padrão"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={cancelEdit} className="p-1 rounded-md hover:bg-white/[0.06] text-[#8a8a99] hover:text-white transition-colors" title="Cancelar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={saveEdit} className="p-1 rounded-md hover:bg-[#FF0074]/10 text-[#FF0074] transition-colors" title="Salvar">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-[#8a8a99]">Arraste para reordenar os itens do menu</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto custom-scrollbar">
        {editing ? (
          // Edit mode - draggable items
          editItems.map((item, index) => {
            const IconComp = iconMap[item.iconName] || LayoutDashboard;
            return (
              <div
                key={item.to}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 px-2 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all ${
                  dragIndex === index ? "bg-[#FF0074]/10 border border-[#FF0074]/20 scale-[1.02]" : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <GripVertical className="w-3.5 h-3.5 text-[#8a8a99]/50 shrink-0" />
                <IconComp className="w-[18px] h-[18px] text-[#8a8a99] shrink-0" />
                {isExpanded && (
                  <span className="text-[13px] text-[#8a8a99] truncate">{item.label}</span>
                )}
              </div>
            );
          })
        ) : (
          // Normal nav
          navItems.filter((item) => canAccessRoute(item.to)).map((item) => {
            const IconComp = iconMap[item.iconName] || LayoutDashboard;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                    isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
                  } ${
                    isActive
                      ? "text-[#ffffff]"
                      : "text-[#8a8a99] hover:text-white hover:bg-white/[0.04]"
                  }`
                }
                style={({ isActive }: { isActive: boolean }) => isActive ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : {}}
                title={!isExpanded ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <IconComp className={`w-[18px] h-[18px] shrink-0 ${isActive ? "" : "text-[#8a8a99] group-hover:text-white"}`} style={isActive ? { color: "var(--accent-foreground)" } : {}} />
                    {isExpanded && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-[13px] truncate whitespace-nowrap"
                        style={{ fontWeight: isActive ? 600 : 400 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                    {isActive && isExpanded && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-foreground)", opacity: 0.4 }} />
                    )}
                  </>
                )}
              </NavLink>
            );
          })
        )}

        {/* Super Admin link - only visible for system owner */}
        {!editing && user?.email?.toLowerCase() === "admin@snyper.com.br" && (
          <>
            <div className="my-2 mx-2 border-t" style={{ borderColor: "var(--border-extra-subtle)" }} />
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                  isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
                } ${
                  isActive
                    ? "text-[#ffffff]"
                    : "text-[#8a8a99] hover:text-white hover:bg-white/[0.04]"
                }`
              }
              style={({ isActive }: { isActive: boolean }) => isActive ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : {}}
              title={!isExpanded ? "Painel Admin" : undefined}
            >
              {({ isActive }) => (
                <>
                  <Crown className={`w-[18px] h-[18px] shrink-0 ${isActive ? "" : "text-[#f59e0b] group-hover:text-[#f59e0b]"}`} style={isActive ? { color: "var(--accent-foreground)" } : {}} />
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-[13px] truncate whitespace-nowrap"
                      style={{ fontWeight: isActive ? 600 : 400 }}
                    >
                      Painel Admin
                    </motion.span>
                  )}
                  {isActive && isExpanded && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(var(--accent-foreground-rgb, 0,0,0),0.3)" }} />
                  )}
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/[0.06] shrink-0 space-y-1">
        {/* User info - clickable to go to profile */}
        <button
          onClick={() => navigate("/perfil")}
          className={`flex items-center gap-3 rounded-xl transition-all w-full hover:bg-white/[0.04] ${
            isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
          }`}
          title={!isExpanded ? userName : undefined}
        >
          {userPhoto ? (
            <img src={userPhoto} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] shrink-0" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 600 }}>
              {userInitials}
            </div>
          )}
          {isExpanded && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] text-white truncate" style={{ fontWeight: 500 }}>{userName}</p>
              <p className="text-[10px] text-[#8a8a99] truncate">{user?.email}</p>
            </div>
          )}
        </button>

        {/* Edit menu - full width button */}
        {!editing && (
          <button
            onClick={startEdit}
            className={`flex items-center gap-2.5 rounded-xl text-[#8a8a99] hover:text-white hover:bg-white/[0.04] transition-all w-full ${
              isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
            }`}
            title="Editar ordem do menu"
          >
            <Pencil className="w-[16px] h-[16px] shrink-0" />
            {isExpanded && <span className="text-[12px]">Editar menu</span>}
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleMode}
          className={`flex items-center gap-2.5 rounded-xl text-[#8a8a99] hover:text-white hover:bg-white/[0.04] transition-all w-full ${
            isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
          }`}
          title={mode === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {mode === "dark" ? (
            <Sun className="w-[16px] h-[16px] shrink-0 text-[#f59e0b]" />
          ) : (
            <Moon className="w-[16px] h-[16px] shrink-0 text-[#7c3aed]" />
          )}
          {isExpanded && <span className="text-[12px]">{mode === "dark" ? "Modo claro" : "Modo escuro"}</span>}
        </button>

        {/* Logout - full width button, red accent */}
        <button
          onClick={signOut}
          className={`flex items-center gap-2.5 rounded-xl text-[#ef4444]/70 hover:text-[#ef4444] hover:bg-[#ef4444]/5 transition-all w-full ${
            isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center"
          }`}
          title="Sair da conta"
        >
          <LogOut className="w-[16px] h-[16px] shrink-0" />
          {isExpanded && <span className="text-[12px]">Sair</span>}
        </button>

        {/* Version badge */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mx-1 mt-1 p-2.5 rounded-xl border"
            style={{ background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.08), transparent)", borderColor: "rgba(var(--accent-rgb),0.15)" }}
          >
            <p className="text-[11px]" style={{ fontWeight: 500, color: "var(--accent)" }}>MVP v1.0</p>
            <p className="text-[10px] text-[#8a8a99] mt-0.5">{`Serviços Digitais`}</p>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}

// Export the collapsed state getter for page-layout
export function useSidebarWidth() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true"; } catch { return false; }
  });

  useEffect(() => {
    const check = () => {
      const val = localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
      setCollapsed(val);
    };
    window.addEventListener("storage", check);
    window.addEventListener("sidebar-toggle", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("sidebar-toggle", check);
    };
  }, []);

  return collapsed ? 68 : 240;
}