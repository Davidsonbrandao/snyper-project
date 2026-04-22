import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, User, Building2, Phone, Mail, FileText, MapPin, Plus, ExternalLink, X } from "lucide-react";
import { type Client } from "../../lib/finance-data";

interface ClientSearchSelectProps {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  onCreateNew?: () => void;
  placeholder?: string;
}

function normalizeDigits(str: string): string {
  return str.replace(/\D/g, "");
}

function getClientDisplayName(c: Client): string {
  return c.type === "pf" ? (c.fullName || "") : (c.nomeFantasia || c.razaoSocial || "");
}

function getClientDoc(c: Client): string {
  return c.type === "pf" ? (c.cpf || "") : (c.cnpj || "");
}

function formatDocShort(doc: string, type: "pf" | "pj"): string {
  const d = doc.replace(/\D/g, "");
  if (type === "pf" && d.length === 11) {
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }
  if (type === "pj" && d.length === 14) {
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  }
  return doc;
}

function formatPhoneShort(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

interface MatchInfo {
  field: string;
  icon: React.ReactNode;
  value: string;
}

function searchClient(client: Client, query: string): MatchInfo | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const qDigits = normalizeDigits(q);

  const name = getClientDisplayName(client);
  if (name.toLowerCase().includes(q)) {
    return { field: "Nome", icon: <User className="w-3 h-3" />, value: name };
  }

  // Contact name (PJ)
  if (client.contactName && client.contactName.toLowerCase().includes(q)) {
    return { field: "Contato", icon: <User className="w-3 h-3" />, value: client.contactName };
  }

  // Document (CPF/CNPJ) - search raw digits or formatted
  const doc = getClientDoc(client);
  const docDigits = normalizeDigits(doc);
  if (doc && (doc.toLowerCase().includes(q) || (qDigits.length >= 3 && docDigits.includes(qDigits)))) {
    return {
      field: client.type === "pf" ? "CPF" : "CNPJ",
      icon: <FileText className="w-3 h-3" />,
      value: formatDocShort(doc, client.type),
    };
  }

  // Razao Social (PJ) - secondary name match
  if (client.type === "pj" && client.razaoSocial && client.razaoSocial.toLowerCase().includes(q) && client.nomeFantasia) {
    return { field: "Razao Social", icon: <Building2 className="w-3 h-3" />, value: client.razaoSocial };
  }

  // Phone - search digits
  const phoneDigits = normalizeDigits(client.phone || "");
  if (phoneDigits && qDigits.length >= 3 && phoneDigits.includes(qDigits)) {
    return { field: "Telefone", icon: <Phone className="w-3 h-3" />, value: formatPhoneShort(client.phone || "") };
  }
  // Also match formatted phone
  if (client.phone && client.phone.includes(q)) {
    return { field: "Telefone", icon: <Phone className="w-3 h-3" />, value: formatPhoneShort(client.phone) };
  }

  // Email
  if (client.email && client.email.toLowerCase().includes(q)) {
    return { field: "E-mail", icon: <Mail className="w-3 h-3" />, value: client.email };
  }

  // City
  if (client.city && client.city.toLowerCase().includes(q)) {
    return { field: "Cidade", icon: <MapPin className="w-3 h-3" />, value: `${client.city}${client.state ? `/${client.state}` : ""}` };
  }

  // Neighborhood
  if (client.neighborhood && client.neighborhood.toLowerCase().includes(q)) {
    return { field: "Bairro", icon: <MapPin className="w-3 h-3" />, value: client.neighborhood };
  }

  // Inscricao Municipal
  if (client.inscricaoMunicipal && client.inscricaoMunicipal.toLowerCase().includes(q)) {
    return { field: "Inscr. Municipal", icon: <FileText className="w-3 h-3" />, value: client.inscricaoMunicipal };
  }

  // CEP
  if (client.cep && (client.cep.includes(q) || (qDigits.length >= 3 && normalizeDigits(client.cep).includes(qDigits)))) {
    return { field: "CEP", icon: <MapPin className="w-3 h-3" />, value: client.cep };
  }

  // Notes
  if (client.notes && client.notes.toLowerCase().includes(q)) {
    return { field: "Obs.", icon: <FileText className="w-3 h-3" />, value: client.notes.slice(0, 40) + (client.notes.length > 40 ? "..." : "") };
  }

  return null;
}

export function ClientSearchSelect({ clients, value, onChange, onCreateNew, placeholder = "Buscar cliente por nome, CPF, telefone, e-mail..." }: ClientSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Portal positioning
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 380;
      const openAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setPos({
        top: openAbove ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedClient = useMemo(() => clients.find(c => c.id === value), [clients, value]);
  const selectedName = selectedClient ? getClientDisplayName(selectedClient) : "";

  const results = useMemo(() => {
    if (!search.trim()) {
      // Show all clients sorted by name when no search
      return clients
        .map(c => ({ client: c, match: null as MatchInfo | null }))
        .sort((a, b) => getClientDisplayName(a.client).localeCompare(getClientDisplayName(b.client)));
    }
    const matches: { client: Client; match: MatchInfo }[] = [];
    for (const c of clients) {
      const m = searchClient(c, search);
      if (m) matches.push({ client: c, match: m });
    }
    return matches;
  }, [clients, search]);

  const openDropdown = () => {
    setIsOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (clientId: string) => {
    onChange(clientId);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    if (onCreateNew) {
      onCreateNew();
    }
  };

  const handleGoToClients = () => {
    setIsOpen(false);
    // Delegate external navigation to parent if needed; do nothing here to avoid losing form state
  };

  const dropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="bg-[#131316] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[380px]"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {/* Search input */}
      <div className="flex items-center px-3 py-2.5 border-b border-white/[0.06] bg-[#1c1c21]">
        <Search className="w-4 h-4 text-[#8a8a99] mr-2 shrink-0" />
        <input
          ref={inputRef}
          autoFocus
          type="text"
          placeholder="Digite nome, CPF, CNPJ, telefone, e-mail, cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length > 0) {
              e.preventDefault();
              handleSelect(results[0].client.id);
            }
            if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          className="w-full bg-transparent border-none outline-none text-[13px] text-white placeholder-[#8a8a99]"
        />
      </div>

      {/* Results list */}
      <div className="overflow-y-auto p-1.5 flex flex-col gap-0.5 custom-scrollbar flex-1">
        {results.length > 0 ? (
          results.map(({ client: c, match }) => {
            const displayName = getClientDisplayName(c);
            const isSelected = value === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={`flex flex-col w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  isSelected
                    ? "bg-[#FF0074]/10 text-[#FF0074]"
                    : "text-white hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {c.type === "pf" ? <User className="w-3.5 h-3.5 shrink-0 text-[#8a8a99]" /> : <Building2 className="w-3.5 h-3.5 shrink-0 text-[#8a8a99]" />}
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#8a8a99] shrink-0 uppercase">
                    {c.type === "pf" ? "PF" : "PJ"}
                  </span>
                </div>
                {/* Show what field matched (if searching) */}
                {match && match.field !== "Nome" && (
                  <div className="flex items-center gap-1.5 mt-1 ml-[22px] text-[11px] text-[#8a8a99]">
                    {match.icon}
                    <span className="text-[#8a8a99]">{match.field}:</span>
                    <span className="text-white/60 truncate">{match.value}</span>
                  </div>
                )}
                {/* Secondary info when not searching */}
                {!search.trim() && (c.email || c.phone) && (
                  <div className="flex items-center gap-3 mt-1 ml-[22px] text-[11px] text-[#8a8a99]">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {formatPhoneShort(c.phone)}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-2.5 h-2.5" />
                        {c.email}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })
        ) : null}

        {/* No results + actions */}
        {results.length === 0 && search.trim() && (
          <div className="px-3 py-3 text-center">
            <p className="text-[12px] text-[#8a8a99] mb-3">
              Nenhum cliente encontrado para "{search}"
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium bg-[#FF0074]/10 text-[#FF0074] hover:bg-[#FF0074]/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Novo Cliente
              </button>
              <button
                type="button"
                onClick={handleGoToClients}
                className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-[13px] text-[#8a8a99] hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ir para Clientes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer with quick actions (always visible when there are results but search is active) */}
      {search.trim() && results.length > 0 && (
        <div className="border-t border-white/[0.06] px-3 py-2 flex items-center justify-between bg-[#0d0d10]">
          <span className="text-[11px] text-[#8a8a99]">
            {results.length} resultado{results.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-1 text-[11px] text-[#FF0074] hover:text-[#FF0074]/80 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Novo
            </button>
            <span className="text-white/[0.1]">|</span>
            <button
              type="button"
              onClick={handleGoToClients}
              className="flex items-center gap-1 text-[11px] text-[#8a8a99] hover:text-white transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Ver todos
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className="w-full flex items-center justify-between bg-[#1c1c21] border border-white/[0.08] hover:border-[#FF0074]/40 transition-colors rounded-xl px-4 py-2.5 outline-none text-[13px] text-white group"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedClient ? (
            <>
              {selectedClient.type === "pf" ? <User className="w-3.5 h-3.5 text-[#FF0074] shrink-0" /> : <Building2 className="w-3.5 h-3.5 text-[#FF0074] shrink-0" />}
              <span className="text-white truncate">{selectedName}</span>
              {selectedClient.type === "pj" && selectedClient.razaoSocial && selectedClient.nomeFantasia && (
                <span className="text-[11px] text-[#8a8a99] truncate hidden sm:inline">({selectedClient.razaoSocial})</span>
              )}
            </>
          ) : (
            <span className="text-[#8a8a99] truncate">{placeholder}</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-white/[0.08] text-[#8a8a99] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <Search className="w-4 h-4 text-[#8a8a99] group-hover:text-[#FF0074] transition-colors" />
        </div>
      </button>

      {dropdown}
    </div>
  );
}
