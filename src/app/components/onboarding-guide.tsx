import { useState } from "react";
import { useOnboarding, type SetupStep } from "../lib/onboarding-context";
import { useNavigate } from "react-router";
import { useAuth } from "../lib/auth-context";
import {
  Compass, X, CheckCircle2, Circle, ArrowRight, ChevronDown, ChevronUp,
  Briefcase, Receipt, SlidersHorizontal, Landmark, Target, ContactRound,
  Kanban, CalendarPlus, Megaphone, Users, Sparkles, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const STEP_ICONS: Record<string, any> = {
  services: Briefcase,
  expenses: Receipt,
  variable_params: SlidersHorizontal,
  accounts: Landmark,
  goals: Target,
  clients: ContactRound,
  pipeline: Kanban,
  entries: CalendarPlus,
  marketing: Megaphone,
  team: Users,
};

const CATEGORY_LABELS: Record<string, string> = {
  essencial: "Essencial",
  recomendado: "Recomendado",
  opcional: "Opcional",
};

const CATEGORY_COLORS: Record<string, string> = {
  essencial: "var(--accent)",
  recomendado: "#3b82f6",
  opcional: "#8a8a99",
};

export function OnboardingGuide() {
  const { user } = useAuth();
  const {
    steps, completedCount, totalCount, progressPercent,
    isFullySetup, guideDismissedSteps, dismissGuideStep, resetDismissals,
  } = useOnboarding();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("essencial");

  // Don't show for super admin
  if (user?.email?.toLowerCase() === "admin@snyper.com.br") return null;
  if (totalCount === 0) return null;

  const groupedSteps = {
    essencial: steps.filter(s => s.category === "essencial"),
    recomendado: steps.filter(s => s.category === "recomendado"),
    opcional: steps.filter(s => s.category === "opcional"),
  };

  const handleGoToStep = (step: SetupStep) => {
    navigate(step.route);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button - positioned to the left of Help widget */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-105 group"
        style={{
          right: 88,
          backgroundColor: isFullySetup ? "rgba(34,197,94,0.15)" : "var(--bg-card)",
          border: `1px solid ${isFullySetup ? "rgba(34,197,94,0.3)" : "var(--border-default)"}`,
        }}
        title="Guia de Configuracao"
      >
        {isOpen ? (
          <X className="w-5 h-5" style={{ color: "var(--text-primary)" }} />
        ) : (
          <>
            <Compass className="w-5 h-5" style={{ color: isFullySetup ? "#22c55e" : "var(--accent)" }} />
            {/* Badge with pending count */}
            {!isFullySetup && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] px-1"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {totalCount - completedCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 z-50 w-[400px] max-h-[75vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ right: 88, backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}
          >
            {/* Header */}
            <div
              className="p-5 shrink-0"
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.08), transparent)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}
                  >
                    <Compass className="w-4.5 h-4.5" style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <h3 className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      Guia de Configuracao
                    </h3>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {isFullySetup ? "Tudo configurado!" : "Configure o sistema passo a passo"}
                    </p>
                  </div>
                </div>
                {completedCount > 0 && !isFullySetup && (
                  <button
                    onClick={resetDismissals}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    title="Resetar itens ignorados"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: isFullySetup ? "#22c55e" : "var(--accent)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[12px] tabular-nums shrink-0" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Body - scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: "thin" }}>
              {isFullySetup ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: "rgba(34,197,94,0.1)" }}
                  >
                    <Sparkles className="w-7 h-7" style={{ color: "#22c55e" }} />
                  </div>
                  <p className="text-[15px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    Parabens!
                  </p>
                  <p className="text-[13px] max-w-[280px]" style={{ color: "var(--text-secondary)" }}>
                    Seu sistema esta totalmente configurado. Bom trabalho!
                  </p>
                </div>
              ) : (
                (["essencial", "recomendado", "opcional"] as const).map(cat => {
                  const catSteps = groupedSteps[cat];
                  if (catSteps.length === 0) return null;
                  const catCompleted = catSteps.filter(s => s.completed).length;
                  const isExpanded = expandedCategory === cat;

                  return (
                    <div key={cat} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                      {/* Category header */}
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                        style={{ backgroundColor: "rgba(var(--accent-rgb),0.02)" }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                          />
                          <span className="text-[12px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {CATEGORY_LABELS[cat]}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: catCompleted === catSteps.length
                                ? "rgba(34,197,94,0.1)"
                                : "rgba(var(--accent-rgb),0.08)",
                              color: catCompleted === catSteps.length
                                ? "#22c55e"
                                : "var(--text-secondary)",
                              fontWeight: 500,
                            }}
                          >
                            {catCompleted}/{catSteps.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        ) : (
                          <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        )}
                      </button>

                      {/* Steps */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-2 pb-2 space-y-1">
                              {catSteps.map(step => {
                                const Icon = STEP_ICONS[step.id] || Circle;
                                const isDismissed = guideDismissedSteps.includes(step.id);

                                return (
                                  <div
                                    key={step.id}
                                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all ${
                                      step.completed ? "opacity-60" : isDismissed ? "opacity-40" : ""
                                    }`}
                                    style={{
                                      backgroundColor: step.completed ? "transparent" : "rgba(var(--accent-rgb),0.03)",
                                    }}
                                  >
                                    {/* Status icon */}
                                    <div className="mt-0.5 shrink-0">
                                      {step.completed ? (
                                        <CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} />
                                      ) : (
                                        <Icon className="w-4 h-4" style={{ color: CATEGORY_COLORS[step.category] }} />
                                      )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-[12px] ${step.completed ? "line-through" : ""}`}
                                        style={{
                                          fontWeight: step.completed ? 400 : 500,
                                          color: step.completed ? "var(--text-muted)" : "var(--text-primary)",
                                        }}
                                      >
                                        {step.title}
                                      </p>
                                      {!step.completed && !isDismissed && (
                                        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                          {step.description}
                                        </p>
                                      )}
                                    </div>

                                    {/* Actions */}
                                    {!step.completed && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {!isDismissed && (
                                          <>
                                            <button
                                              onClick={() => handleGoToStep(step)}
                                              className="p-1.5 rounded-md transition-colors"
                                              style={{ color: "var(--accent)" }}
                                              title="Ir para configuracao"
                                            >
                                              <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => dismissGuideStep(step.id)}
                                              className="p-1.5 rounded-md transition-colors"
                                              style={{ color: "var(--text-muted)" }}
                                              title="Ignorar por agora"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer tip */}
            {!isFullySetup && (
              <div
                className="px-4 py-2.5 shrink-0 text-center"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Voce pode ignorar passos e voltar a eles depois. Clique no X ao lado de cada item.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}