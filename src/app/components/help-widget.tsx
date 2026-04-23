import { useState } from "react";
import { LifeBuoy, X, Send, Loader2, Check, ChevronDown } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { apiFetch } from "../lib/api";
import { CustomSelect } from "./ui/custom-select";
import { motion, AnimatePresence } from "motion/react";

export function HelpWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Don't show for super admin (they have the admin panel)
  if (user?.email?.toLowerCase() === "admin@snyper.com.br") return null;

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    try {
      await apiFetch("/tickets", {
        method: "POST",
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), priority }),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSubject("");
        setMessage("");
        setPriority("medium");
        setIsOpen(false);
      }, 2500);
    } catch (err: any) {
      alert("Erro ao enviar chamado: " + (err.message || err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-105"
        style={{ right: 148, backgroundColor: "var(--accent)", color: "#fff" }}
        title="Ajuda e Suporte"
      >
        {isOpen ? <X className="w-5 h-5" /> : <LifeBuoy className="w-5 h-5" />}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 z-50 w-[360px] rounded-2xl shadow-2xl overflow-hidden"
            style={{ right: 148, backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" }}
          >
            {/* Header */}
            <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)", background: "linear-gradient(to right, rgba(var(--accent-rgb),0.08), transparent)" }}>
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5" style={{ color: "var(--accent)" }} />
                <h3 className="text-[14px]" style={{ fontWeight: 600, color: "var(--text-primary)" }}>Ajuda e Suporte</h3>
              </div>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>Envie um chamado e nossa equipe respondera o mais rapido possivel.</p>
            </div>

            {sent ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                  <Check className="w-6 h-6 text-[#22c55e]" />
                </div>
                <p className="text-[14px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Chamado enviado!</p>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Voce recebera uma resposta em breve.</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Assunto</label>
                  <input
                    value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="Descreva brevemente o problema"
                    className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Prioridade</label>
                  <CustomSelect
                    options={[
                      { value: "low", label: "Baixa - Duvida ou sugestao" },
                      { value: "medium", label: "Media - Problema pontual" },
                      { value: "high", label: "Alta - Funcionalidade comprometida" },
                      { value: "urgent", label: "Urgente - Sistema indisponivel" },
                    ]}
                    value={priority} onChange={setPriority}
                  />
                </div>
                <div>
                  <label className="text-[11px] mb-1 block" style={{ color: "var(--text-secondary)" }}>Mensagem</label>
                  <textarea
                    value={message} onChange={e => setMessage(e.target.value)}
                    placeholder="Descreva o problema em detalhes..."
                    rows={4}
                    className="w-full rounded-xl px-4 py-2.5 text-[13px] focus:outline-none resize-none"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "var(--accent)", color: "#fff", fontWeight: 500 }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Enviando..." : "Enviar Chamado"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
