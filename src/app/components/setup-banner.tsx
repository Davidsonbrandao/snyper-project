import { useOnboarding } from "../lib/onboarding-context";
import { useNavigate } from "react-router";
import { X, ArrowRight, CheckCircle2, Rocket, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function SetupBanner() {
  const {
    steps, completedCount, totalCount, progressPercent,
    isFullySetup, bannerDismissed, dismissBanner, nextPendingStep,
  } = useOnboarding();
  const navigate = useNavigate();

  // Don't render if fully set up, dismissed, or no steps
  if (isFullySetup || bannerDismissed || totalCount === 0) return null;

  const pendingEssential = steps.filter(s => !s.completed && s.category === "essencial");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgba(var(--accent-rgb),0.12) 0%, rgba(var(--accent-rgb),0.04) 100%)`,
          borderBottom: "1px solid rgba(var(--accent-rgb),0.15)",
        }}
      >
        <div className="px-6 py-3 flex items-center gap-4">
          {/* Icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(var(--accent-rgb),0.15)" }}
          >
            {completedCount < 3 ? (
              <Rocket className="w-4 h-4" style={{ color: "var(--accent)" }} />
            ) : (
              <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
            )}
          </div>

          {/* Progress info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-[13px] truncate" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                {completedCount === 0
                  ? "Bem-vindo! Configure seu sistema passo a passo"
                  : pendingEssential.length > 0
                    ? `${pendingEssential.length} configuracao${pendingEssential.length > 1 ? "oes" : ""} essencial${pendingEssential.length > 1 ? "is" : ""} pendente${pendingEssential.length > 1 ? "s" : ""}`
                    : `Quase la! ${totalCount - completedCount} passo${totalCount - completedCount > 1 ? "s" : ""} opcional${totalCount - completedCount > 1 ? "is" : ""} restante${totalCount - completedCount > 1 ? "s" : ""}`
                }
              </p>

              {/* Mini progress bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(var(--accent-rgb),0.15)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: "var(--accent)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[11px] tabular-nums" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  {completedCount}/{totalCount}
                </span>
              </div>
            </div>

            {nextPendingStep && (
              <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                Proximo: {nextPendingStep.title}
              </p>
            )}
          </div>

          {/* Action button */}
          {nextPendingStep && (
            <button
              onClick={() => navigate(nextPendingStep.route)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] shrink-0 transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: "var(--accent)",
                color: "#fff",
                fontWeight: 500,
              }}
            >
              Configurar
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={dismissBanner}
            className="p-1 rounded-md shrink-0 transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="Fechar lembrete"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
