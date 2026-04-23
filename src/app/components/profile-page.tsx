import { useState, useRef } from "react";
import { User, Mail, Phone, Camera, Save, X, Check, Shield, Key, Globe, Sun, Moon, Palette, Monitor } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { apiFetch } from "../lib/api";
import { useTheme, ACCENT_PRESETS, type ThemeMode } from "../lib/theme-context";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { mode, accent, setMode, setAccent } = useTheme();

  const [activeTab, setActiveTab] = useState<"profile" | "appearance">("profile");
  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [nickname, setNickname] = useState(user?.user_metadata?.nickname || "");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_AVATAR_SIZE_BYTES = 1024 * 1024; // 1 MB

  const email = user?.email || "";
  const userInitials = (name || email.split("@")[0])
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setError("");
  setSaved(false);

  if (!file.type.startsWith("image/")) {
    setError("Selecione uma imagem válida para a foto de perfil.");
    if (fileInputRef.current) fileInputRef.current.value = "";
    return;
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    setError("A foto de perfil deve ter no máximo 1 MB. Escolha uma imagem menor.");
    if (fileInputRef.current) fileInputRef.current.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
  reader.readAsDataURL(file);
};

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          nickname,
          phone,
          avatarUrl,
        }),
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao salvar o perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const whatsappLink = phone ? `https://wa.me/55${phone.replace(/\D/g, "")}` : "";

  const isDefaultAccent = accent.toUpperCase() === "#00FA64";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 style={{ color: "var(--text-primary)" }}>Meu Perfil</h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>Gerencie suas informacoes pessoais e personalize o sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
        <button
          onClick={() => setActiveTab("profile")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all"
          style={{
            fontWeight: activeTab === "profile" ? 500 : 400,
            backgroundColor: activeTab === "profile" ? "var(--accent)" : "transparent",
            color: activeTab === "profile" ? "var(--accent-foreground)" : "var(--text-secondary)",
          }}
        >
          <User className="w-4 h-4" />
          Dados Pessoais
        </button>
        <button
          onClick={() => setActiveTab("appearance")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] transition-all"
          style={{
            fontWeight: activeTab === "appearance" ? 500 : 400,
            backgroundColor: activeTab === "appearance" ? "var(--accent)" : "transparent",
            color: activeTab === "appearance" ? "var(--accent-foreground)" : "var(--text-secondary)",
          }}
        >
          <Palette className="w-4 h-4" />
          Personalizacao
        </button>
      </div>

      {/* ====== PROFILE TAB ====== */}
      {activeTab === "profile" && (
        <>
          {/* Avatar + Basic Info Card */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            {/* Cover gradient */}
            <div className="h-28 relative" style={{ background: `linear-gradient(to right, rgba(var(--accent-rgb),0.2), rgba(var(--accent-rgb),0.05), transparent)` }}>
              <div className="absolute -bottom-12 left-8">
                <div className="relative group">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-2xl object-cover shadow-xl" style={{ border: `4px solid var(--bg-card)` }} />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl shadow-xl flex items-center justify-center" style={{ backgroundColor: "var(--bg-input)", border: `4px solid var(--bg-card)` }}>
                      <span className="text-[28px]" style={{ fontWeight: 600, color: "var(--accent)" }}>{userInitials}</span>
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  <p
  className="mt-3 text-[11px] text-center"
  style={{ color: "var(--text-secondary)" }}
>
  Foto de perfil: envie uma imagem de até <strong>1 MB</strong>.
</p>
                </div>
              </div>
            </div>

            <div className="pt-16 px-8 pb-8 space-y-6">
              {/* Name + Nickname */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] flex items-center gap-1.5 mb-2" style={{ color: "var(--text-secondary)" }}>
                    <User className="w-3.5 h-3.5" /> Nome completo
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="text-[12px] flex items-center gap-1.5 mb-2" style={{ color: "var(--text-secondary)" }}>
                    <User className="w-3.5 h-3.5" /> Apelido
                  </label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="Como gosta de ser chamado"
                  />
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="text-[12px] flex items-center gap-1.5 mb-2" style={{ color: "var(--text-secondary)" }}>
                  <Mail className="w-3.5 h-3.5" /> E-mail
                </label>
                <div className="relative">
                  <input
                    value={email}
                    readOnly
                    className="w-full rounded-xl px-4 py-3 text-[14px] cursor-not-allowed"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#22c55e]" />
                    <span className="text-[10px] text-[#22c55e]">Verificado</span>
                  </div>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: "var(--text-secondary)" }}>O e-mail esta vinculado a sua conta e nao pode ser alterado diretamente aqui.</p>
              </div>

              {/* WhatsApp / Phone */}
              <div>
                <label className="text-[12px] flex items-center gap-1.5 mb-2" style={{ color: "var(--text-secondary)" }}>
                  <Phone className="w-3.5 h-3.5" /> WhatsApp / Telefone
                </label>
                <div className="flex items-center gap-3">
                  <input
                    value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    className="flex-1 rounded-xl px-4 py-3 text-[14px] focus:outline-none transition-colors"
                    style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                    placeholder="(00) 00000-0000"
                    maxLength={16}
                  />
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 rounded-xl text-[12px] transition-colors whitespace-nowrap flex items-center gap-1.5"
                      style={{ backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", fontWeight: 500 }}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Testar link
                    </a>
                  )}
                </div>
              </div>

              {/* Messages */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <X className="w-4 h-4 text-[#ef4444] shrink-0" />
                  <span className="text-[13px] text-[#ef4444]">{error}</span>
                </div>
              )}
              {saved && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <Check className="w-4 h-4 text-[#22c55e] shrink-0" />
                  <span className="text-[13px] text-[#22c55e]">Perfil atualizado com sucesso!</span>
                </div>
              )}

              {/* Save button */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Suas informacoes sao armazenadas com seguranca.
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl transition-colors text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Salvando..." : "Salvar Perfil"}
                </button>
              </div>
            </div>
          </div>

          {/* Account info card */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.1)" }}>
                <Key className="w-5 h-5 text-[#3b82f6]" />
              </div>
              <div>
                <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Informacoes da Conta</h3>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Detalhes de seguranca e acesso</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "ID da Conta", value: <span className="font-mono px-2 py-1 rounded text-[12px]" style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}>{user?.id?.slice(0, 8)}...</span> },
                { label: "Metodo de login", value: "E-mail / Magic Link" },
                { label: "Conta criada em", value: user?.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "---" },
                { label: "Ultimo acesso", value: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "---" },
              ].map((item, i, arr) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-extra-subtle)" : "none" }}
                >
                  <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                  <span className="text-[12px]" style={{ color: "var(--text-primary)" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ====== APPEARANCE TAB ====== */}
      {activeTab === "appearance" && (
        <>
          {/* Mode Selector */}
          <div className="rounded-2xl p-6 space-y-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                <Monitor className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Aparencia</h3>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Escolha entre modo claro e escuro</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Dark Mode Card */}
              <button
                onClick={() => setMode("dark")}
                className="relative p-5 rounded-2xl transition-all text-left group"
                style={{
                  backgroundColor: mode === "dark" ? "rgba(var(--accent-rgb),0.08)" : "var(--bg-input)",
                  border: mode === "dark" ? `2px solid var(--accent)` : "2px solid var(--border-default)",
                }}
              >
                {mode === "dark" && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-[#0a0a0b] flex items-center justify-center mb-3 border border-white/10">
                  <Moon className="w-5 h-5 text-[#8a8a99]" />
                </div>
                <p className="text-[14px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Modo Escuro</p>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Interface dark premium, ideal para uso noturno e ambientes com pouca luz</p>
                {/* Mini preview */}
                <div className="mt-4 rounded-lg overflow-hidden border border-white/5">
                  <div className="bg-[#0a0a0b] p-2 flex items-center gap-2">
                    <div className="w-14 h-full bg-[#0e0e10] rounded-md p-1 flex flex-col gap-0.5">
                      {[1,2,3].map(i => <div key={i} className="h-1 rounded bg-white/10" />)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 rounded bg-[#131316] w-full" />
                      <div className="flex gap-1">
                        <div className="h-6 rounded bg-[#131316] flex-1" />
                        <div className="h-6 rounded bg-[#131316] flex-1" />
                        <div className="h-6 rounded bg-[#131316] flex-1" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {/* Light Mode Card */}
              <button
                onClick={() => setMode("light")}
                className="relative p-5 rounded-2xl transition-all text-left group"
                style={{
                  backgroundColor: mode === "light" ? "rgba(var(--accent-rgb),0.08)" : "var(--bg-input)",
                  border: mode === "light" ? `2px solid var(--accent)` : "2px solid var(--border-default)",
                }}
              >
                {mode === "light" && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-[#f5f6fa] flex items-center justify-center mb-3 border border-black/10">
                  <Sun className="w-5 h-5 text-[#f59e0b]" />
                </div>
                <p className="text-[14px] mb-1" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Modo Claro</p>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Interface clean e moderna, ideal para uso diurno e ambientes iluminados</p>
                {/* Mini preview */}
                <div className="mt-4 rounded-lg overflow-hidden border border-black/10">
                  <div className="bg-[#f4f5f9] p-2 flex items-center gap-2">
                    <div className="w-14 h-full bg-white rounded-md p-1 flex flex-col gap-0.5 border border-black/5">
                      {[1,2,3].map(i => <div key={i} className="h-1 rounded bg-black/8" />)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 rounded bg-white w-full border border-black/5" />
                      <div className="flex gap-1">
                        <div className="h-6 rounded bg-white flex-1 border border-black/5" />
                        <div className="h-6 rounded bg-white flex-1 border border-black/5" />
                        <div className="h-6 rounded bg-white flex-1 border border-black/5" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Accent Color Selector */}
          <div className="rounded-2xl p-6 space-y-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                <Palette className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 className="text-[15px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Cor de Destaque</h3>
                <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Personalize a cor principal dos botoes, menus e elementos interativos</p>
              </div>
            </div>

            {/* Color presets grid */}
            <div className="grid grid-cols-5 gap-3">
              {ACCENT_PRESETS.map((preset) => {
                const isActive = accent.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    onClick={() => setAccent(preset.hex)}
                    className="relative p-4 rounded-xl transition-all text-left group"
                    style={{
                      backgroundColor: isActive ? `${preset.hex}12` : "var(--bg-input)",
                      border: isActive ? `2px solid ${preset.hex}` : "2px solid var(--border-default)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isActive && <Check className="w-4 h-4" style={{ color: "var(--accent-foreground)" }} />}
                      </div>
                      <div>
                        <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>{preset.label}</p>
                        <p className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>{preset.hex}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom color input */}
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                  style={{ WebkitAppearance: "none" }}
                />
                <div>
                  <p className="text-[13px]" style={{ fontWeight: 500, color: "var(--text-primary)" }}>Cor personalizada</p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Escolha qualquer cor do seletor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono px-2 py-1 rounded" style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}>
                  {accent.toUpperCase()}
                </span>
                {!isDefaultAccent && (
                  <button
                    onClick={() => setAccent("#00FA64")}
                    className="text-[11px] px-3 py-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  >
                    Restaurar padrao
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
              <p className="text-[12px]" style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Pre-visualizacao</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="px-4 py-2 rounded-xl text-[13px]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}>
                  Botao Primario
                </button>
                <button className="px-4 py-2 rounded-xl text-[13px]" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", fontWeight: 500 }}>
                  Botao Secundario
                </button>
                <span className="px-3 py-1 rounded-full text-[11px]" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}>
                  Badge de Destaque
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)" }}>
                  <Palette className="w-4 h-4" style={{ color: "var(--accent)" }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 rounded-full flex-1" style={{ backgroundColor: "var(--border-default)" }}>
                  <div className="h-full rounded-full w-2/3" style={{ backgroundColor: "var(--accent)" }} />
                </div>
                <span className="text-[11px]" style={{ color: "var(--accent)", fontWeight: 600 }}>67%</span>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: "rgba(var(--accent-rgb),0.05)", border: "1px solid rgba(var(--accent-rgb),0.15)" }}>
            <Palette className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
            <div>
              <p className="text-[13px] mb-1" style={{ fontWeight: 500, color: "var(--accent)" }}>Personalizacao individual</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                As preferencias de aparencia sao salvas por usuario. Cada membro da equipe pode escolher seu proprio tema e cor de destaque sem afetar os demais.
                As cores de status (verde para sucesso, vermelho para erro, etc.) permanecem fixas para manter a clareza visual.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
