import { useEffect, useRef, useState } from "react";
import { Logo } from "./ui/logo";
import {
  Mail,
  ArrowRight,
  Loader2,
  Shield,
  Lock,
  Fingerprint,
  KeyRound,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginPageProps {
  onSignIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  onAcceptInvite: (inviteToken: string) => Promise<{ error: string | null }>;
  inviteToken?: string;
  inviteEmail?: string;
}

export function LoginPage({
  onSignIn,
  onAcceptInvite,
  inviteToken,
  inviteEmail,
}: LoginPageProps) {
  const [email, setEmail] = useState(inviteEmail || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inviteDoneRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail);
    }
  }, [inviteEmail]);

  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      };
    }
  }, [cooldown]);

  useEffect(() => {
    const runInvite = async () => {
      if (!inviteToken || inviteDoneRef.current) return;
      inviteDoneRef.current = true;
      setLoading(true);
      setError("");

      const result = await onAcceptInvite(inviteToken);
      if (result.error) {
        setError(result.error);
        inviteDoneRef.current = false;
      } else {
        setSuccess(true);
      }

      setLoading(false);
    };

    void runInvite();
  }, [inviteToken, onAcceptInvite]);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) return;
    if (cooldown > 0) return;

    if (!isValidEmail(trimmedEmail)) {
      setError("Formato de e-mail invalido.");
      return;
    }

    if (attempts >= 5) {
      setCooldown(30);
      setAttempts(0);
      setError("Muitas tentativas. Aguarde 30 segundos.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await onSignIn(trimmedEmail, password);
      setAttempts((prev) => prev + 1);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Erro de conexao. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const particles = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 3,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 5,
  }));

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
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
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              backgroundColor: "var(--accent)",
              opacity: 0.15,
            }}
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              opacity: [0.1, 0.25, 0.1],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
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
          >
            <span className="italic">Sistema proprio, sem dependencia externa.</span>
          </motion.p>
        </div>

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
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-24 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, var(--accent), transparent)` }}
          />

          <AnimatePresence mode="wait">
            {success ? (
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
                  style={{
                    backgroundColor: "rgba(var(--accent-rgb),0.08)",
                    border: "1px solid rgba(var(--accent-rgb),0.2)",
                  }}
                >
                  <Lock className="w-8 h-8" style={{ color: "var(--accent)" }} />
                </motion.div>
                <h2 className="text-[18px] mb-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  Acesso liberado
                </h2>
                <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>
                  Voce ja pode entrar no sistema.
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Se a tela nao trocar sozinha, aguarde alguns segundos.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center mb-8">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{
                      backgroundColor: "rgba(var(--accent-rgb),0.08)",
                      border: "1px solid rgba(var(--accent-rgb),0.15)",
                    }}
                  >
                    <KeyRound className="w-5 h-5" style={{ color: "var(--accent)" }} />
                  </div>
                  <h2 className="text-[18px] mb-2" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    Acessar Sistema
                  </h2>
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    Entre com seu e-mail e senha, ou use o convite se recebeu um link de acesso.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      className="text-[11px] block mb-2 tracking-wide uppercase"
                      style={{ color: "var(--text-muted)", fontWeight: 500 }}
                    >
                      E-mail
                    </label>
                    <div className="relative group">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
                        style={{ color: email ? "var(--accent)" : "var(--text-muted)" }}
                      />
                      <input
                        ref={inputRef}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError("");
                        }}
                        className="w-full rounded-xl pl-11 pr-4 py-3.5 text-[14px] focus:outline-none transition-all"
                        style={{
                          backgroundColor: "var(--bg-input)",
                          border: `1px solid ${error ? "rgba(239,68,68,0.3)" : "var(--border-default)"}`,
                          color: "var(--text-primary)",
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = error
                            ? "rgba(239,68,68,0.5)"
                            : "rgba(var(--accent-rgb),0.4)")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = error
                            ? "rgba(239,68,68,0.3)"
                            : "var(--border-default)")
                        }
                        placeholder="seu@email.com"
                        autoFocus
                        autoComplete="email"
                        disabled={loading || cooldown > 0}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="text-[11px] block mb-2 tracking-wide uppercase"
                      style={{ color: "var(--text-muted)", fontWeight: 500 }}
                    >
                      Senha
                    </label>
                    <div className="relative group">
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                        }}
                        className="w-full rounded-xl pl-4 pr-11 py-3.5 text-[14px] focus:outline-none transition-all"
                        style={{
                          backgroundColor: "var(--bg-input)",
                          border: `1px solid ${error ? "rgba(239,68,68,0.3)" : "var(--border-default)"}`,
                          color: "var(--text-primary)",
                        }}
                        placeholder="Sua senha"
                        autoComplete="current-password"
                        disabled={loading || cooldown > 0}
                      />
                    </div>
                  </div>

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
                          style={{
                            backgroundColor: "rgba(239,68,68,0.08)",
                            border: "1px solid rgba(239,68,68,0.15)",
                          }}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                          <p className="text-[12px] leading-relaxed" style={{ color: "#ef4444" }}>
                            {error}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !password.trim() || cooldown > 0}
                    className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl transition-all text-[14px] disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-foreground)",
                      fontWeight: 600,
                      boxShadow: loading ? "none" : "0 4px 15px rgba(var(--accent-rgb),0.25)",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)",
                      }}
                    />
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin relative z-10" />
                        <span className="relative z-10">
                          {inviteToken ? "Ativando convite..." : "Autenticando..."}
                        </span>
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

                <p
                  className="text-[11px] text-center mt-5 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  O acesso e restrito a usuarios previamente cadastrados pelo administrador do sistema.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center justify-center gap-6 mt-7"
        >
          {[
            { icon: Shield, label: "Acesso Seguro" },
            { icon: Lock, label: "Dados Locais" },
            { icon: Fingerprint, label: "Sessao do VPS" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-1.5">
              <badge.icon className="w-3 h-3" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
              <span className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                {badge.label}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center mt-5 text-[10px]"
          style={{ color: "var(--text-muted)", opacity: 0.3 }}
        >
          Desenvolvido por Davidson Brandao &copy; {new Date().getFullYear()}
        </motion.p>
      </motion.div>
    </div>
  );
}

