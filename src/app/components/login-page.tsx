import { useState, useEffect, useRef } from "react";
import { Logo } from "./ui/logo";
import {
  Mail, ArrowRight, Loader2, Shield, Lock, CheckCircle2,
  Fingerprint, KeyRound, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginPageProps {
  onSignIn: (email: string) => Promise<{ error: string | null }>;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

    // Cooldown timer for brute-force protection
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
    }
  }, [cooldown]);

  // Email validation
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) return;
    if (cooldown > 0) return;

    if (!isValidEmail(trimmed)) {
      setError("Formato de e-mail invalido.");
      return;
    }

    // Rate limiting: after 5 attempts, add cooldown
    if (attempts >= 5) {
      setCooldown(30);
      setAttempts(0);
      setError("Muitas tentativas. Aguarde 30 segundos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await onSignIn(trimmed);
      setLoading(false);
      setAttempts(prev => prev + 1);

      if (result.error) {
        if (result.error.includes("nao esta autorizado") || result.error.includes("user not found") || result.error.includes("Signups not allowed")) {
          setError("Este e-mail nao esta autorizado. Solicite acesso ao administrador do sistema.");
        } else {
          setError(result.error);
        }
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setLoading(false);
      setError("Erro de conexao. Verifique sua internet e tente novamente.");
    }
  };

  // Floating particles animation
  const particles = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 3,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 5,
  }));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ opacity: [0.03, 0.06, 0.03], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px]"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <motion.div
          animate={{ opacity: [0.02, 0.05, 0.02], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[130px]"
          style={{ backgroundColor: "var(--accent)" }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Floating particles */}
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: "var(--accent)",
              opacity: 0.15,
            }}
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              opacity: [0.1, 0.25, 0.1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[440px] z-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: "backOut" }}
            className="mb-5"
          >
            <Logo variant="full" className="h-10 w-auto" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-[12px] tracking-[0.2em] uppercase"
            style={{ color: "var(--text-muted)", fontWeight: 500 }}
          ><span className="italic">Planilha é tiro no escuro. aqui é tiro certo.</span></motion.p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border-extra-subtle)",
          }}
        >
          {/* Accent line at top */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-24 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, var(--accent), transparent)` }}
          />

          <AnimatePresence mode="wait">
            {success ? (
              /* Success state — magic link sent */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: "rgba(var(--accent-rgb),0.08)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}
                >
                  <Mail className="w-8 h-8" style={{ color: "var(--accent)" }} />
                </motion.div>
                <h2 className="text-[18px] mb-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  Link de Acesso Enviado
                </h2>
                <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>
                  Enviamos um link para <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Abra o e-mail e clique no link para acessar o sistema. O link expira em 1 hora.
                </p>
                <div className="mt-5 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Nao recebeu? Verifique a pasta de spam ou tente novamente em alguns minutos.
                  </p>
                </div>
                <button
                  onClick={() => { setSuccess(false); setEmail(""); setAttempts(0); }}
                  className="mt-4 text-[12px] transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  Usar outro e-mail
                </button>
              </motion.div>
            ) : (
              /* Login form */
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center mb-8">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(var(--accent-rgb),0.08)", border: "1px solid rgba(var(--accent-rgb),0.15)" }}
                  >
                    <KeyRound className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  </div>
                  <h2 className="text-[18px] mb-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    Acessar Sistema
                  </h2>
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    Informe seu e-mail cadastrado para entrar
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[11px] block mb-2 tracking-wide uppercase" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                      E-mail
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: email ? "var(--accent)" : "var(--text-muted)" }} />
                      <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        className="w-full rounded-xl pl-11 pr-4 py-3.5 text-[14px] focus:outline-none transition-all"
                        style={{
                          backgroundColor: "var(--bg-input)",
                          border: `1px solid ${error ? "rgba(239,68,68,0.3)" : "var(--border-default)"}`,
                          color: "var(--text-primary)",
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.5)" : "rgba(var(--accent-rgb),0.4)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.3)" : "var(--border-default)"}
                        placeholder="seu@email.com"
                        autoFocus
                        autoComplete="email"
                        disabled={loading || cooldown > 0}
                      />
                    </div>
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                          style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                          <p className="text-[12px] leading-relaxed" style={{ color: "#ef4444" }}>{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading || !email.trim() || cooldown > 0}
                    className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl transition-all text-[14px] disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-foreground)",
                      fontWeight: 600,
                      boxShadow: loading ? "none" : "0 4px 15px rgba(var(--accent-rgb),0.25)",
                    }}
                  >
                    {/* Hover glow effect */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)" }}
                    />
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                        <span className="relative z-10">Autenticando...</span>
                      </>
                    ) : cooldown > 0 ? (
                      <span className="relative z-10">Aguarde {cooldown}s</span>
                    ) : (
                      <>
                        <span className="relative z-10">Entrar</span>
                        <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                {/* Info text */}
                <p className="text-[11px] text-center mt-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  O acesso e restrito a usuarios previamente cadastrados pelo administrador do sistema.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center justify-center gap-6 mt-7"
        >
          {[
            { icon: Shield, label: "Acesso Seguro" },
            { icon: Lock, label: "Dados Criptografados" },
            { icon: Fingerprint, label: "Autenticacao JWT" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5">
              <badge.icon className="w-3 h-3" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
              <span className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>{badge.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center mt-5 text-[10px]"
          style={{ color: "var(--text-muted)", opacity: 0.3 }}
        >
          Desenvolvido por Davidson Brandão &copy; {new Date().getFullYear()}
        </motion.p>
      </motion.div>
    </div>
  );
}