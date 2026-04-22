import { useState, useMemo } from "react";
import { Calculator, X, ChevronDown, ChevronUp, ArrowRight, TrendingUp, AlertTriangle } from "lucide-react";
import { useFinance } from "../lib/finance-context";
import { calculateSaleIntelligence, formatCurrency, type VariableParameter } from "../lib/finance-data";
import { CustomSelect } from "./ui/custom-select";
import { CurrencyInput } from "./ui/currency-input";

export function QuickSimulator() {
  const { variableParams, paymentMethods, services } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [amount, setAmount] = useState<string>("5000");
  const [installments, setInstallments] = useState<string>("1");
  const [paymentMethod, setPaymentMethod] = useState<string>(() => {
    // Normalize comparison to handle accented vs non-accented strings
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const card = paymentMethods.find(p => normalize(p).includes("cartao") && normalize(p).includes("credito"));
    const pix = paymentMethods.find(p => normalize(p) === "pix");
    return card || pix || paymentMethods[0] || "";
  });
  const [cmv, setCmv] = useState<string>("0");
  const [selectedService, setSelectedService] = useState<string>("");

  const paymentMethodOpts = paymentMethods.map(p => ({ value: p, label: p }));
  const serviceOpts = [
    { value: "", label: "Nenhum (manual)" },
    ...services.map(s => ({ value: s.id, label: s.name })),
  ];

  const installmentOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: i === 0 ? "A vista" : `${i + 1}x`,
  }));

  // When a service is selected, auto-fill amount and CMV
  const handleServiceChange = (serviceId: string) => {
    setSelectedService(serviceId);
    if (serviceId) {
      const svc = services.find(s => s.id === serviceId);
      if (svc) {
        setAmount(String(svc.priceDisplay));
        if (svc.variableCostIsPercentage) {
          setCmv(String(Math.round(svc.priceDisplay * svc.variableCost / 100)));
        } else {
          setCmv(String(svc.variableCost));
        }
      }
    }
  };

  const simulatedResult = useMemo(() => {
    const grossAmount = parseFloat(amount) || 0;
    const directCostsTotal = parseFloat(cmv) || 0;
    const inst = parseInt(installments) || 1;

    return calculateSaleIntelligence(
      grossAmount,
      variableParams,
      paymentMethod,
      inst,
      [{ id: "simulator-cmv", description: "CMV", amount: directCostsTotal }]
    );
  }, [amount, installments, paymentMethod, cmv, variableParams]);

  const grossAmount = parseFloat(amount) || 0;
  const isHealthy = simulatedResult.profitMargin > 20;
  const isWarning = simulatedResult.profitMargin > 0 && simulatedResult.profitMargin <= 20;
  const isDanger = simulatedResult.profitMargin <= 0;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all z-50 group"
        style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        title="Simulador de Vendas"
      >
        <Calculator className="w-6 h-6" />
        <span
          className="absolute right-full mr-4 text-[12px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
          style={{ backgroundColor: "var(--bg-input)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
        >
          Simulador Rapido
        </span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 w-[380px] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden max-h-[calc(100vh-48px)]"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid rgba(var(--accent-rgb),0.3)" }}
    >
      <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(var(--accent-rgb),0.05)" }}>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Simulador de Cenarios</h3>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-[#8a8a99] hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1">
        <div className="p-5 space-y-4">
          {/* Service Quick-fill */}
          {services.length > 0 && (
            <div>
              <label className="text-[11px] text-[#8a8a99] block mb-1.5">Servico (preenche automático)</label>
              <CustomSelect
                options={serviceOpts}
                value={selectedService}
                onChange={handleServiceChange}
                placeholder="Selecione ou preencha manual"
              />
            </div>
          )}

          {/* Sale Amount */}
          <div>
            <label className="text-[11px] text-[#8a8a99] block mb-1.5">Valor da Venda</label>
            <CurrencyInput value={amount} onChange={setAmount} />
          </div>

          {/* Payment method + Installments */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#8a8a99] block mb-1.5">Forma de Pagto</label>
              <CustomSelect
                options={paymentMethodOpts}
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
            </div>
            <div>
              <label className="text-[11px] text-[#8a8a99] block mb-1.5">Parcelas</label>
              <CustomSelect
                options={installmentOptions}
                value={installments}
                onChange={setInstallments}
              />
            </div>
          </div>

          {/* CMV */}
          <div>
            <label className="text-[11px] text-[#8a8a99] block mb-1.5">Custos Diretos (CMV)</label>
            <CurrencyInput value={cmv} onChange={setCmv} placeholder="0,00" />
          </div>

          {/* Results */}
          <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#8a8a99]">Receita Bruta</span>
              <span className="text-[13px] text-white" style={{ fontWeight: 500 }}>{formatCurrency(simulatedResult.grossAmount)}</span>
            </div>

            {parseFloat(cmv) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#8a8a99]">Custos Diretos (CMV)</span>
                <span className="text-[13px] text-[#ef4444]">-{formatCurrency(parseFloat(cmv) || 0)}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#8a8a99]">Impostos</span>
              <span className="text-[13px] text-[#ef4444]">-{formatCurrency(simulatedResult.taxes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#8a8a99]">Taxas Gateway/Cartao</span>
              <span className="text-[13px] text-[#ef4444]">-{formatCurrency(simulatedResult.cardFees)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#8a8a99]">Comissões</span>
              <span className="text-[13px] text-[#f59e0b]">-{formatCurrency(simulatedResult.commissions)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#8a8a99]">Caixa Marketing</span>
              <span className="text-[13px] text-[#3b82f6]">-{formatCurrency(simulatedResult.marketing)}</span>
            </div>

            {/* Detailed breakdown toggle */}
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-[11px] text-[#FF0074] hover:text-[#FF0074]/80 transition-colors pt-1"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? "Ocultar detalhes" : "Ver detalhes por parametro"}
            </button>

            {showDetails && (
              <div className="bg-white/[0.02] rounded-xl p-3 space-y-1.5 border border-white/[0.04]">
                <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider mb-2" style={{ fontWeight: 500 }}>Parametros Variaveis Aplicados</p>
                {variableParams.filter(v => v.active).map(v => {
                  let deduction = 0;
                  if (v.unit === "%") {
                    if (v.type === "tax") deduction = grossAmount * v.value / 100;
                    else if (v.type === "card_fee") {
                      if (!v.paymentMethodRef || v.paymentMethodRef === paymentMethod) {
                        deduction = grossAmount * v.value / 100;
                      }
                    } else {
                      const netBase = grossAmount - simulatedResult.taxes - simulatedResult.cardFees;
                      deduction = netBase * v.value / 100;
                    }
                  }
                  if (deduction <= 0) return null;
                  
                  const typeLabel: Record<string, string> = {
                    tax: "Imposto",
                    card_fee: "Taxa",
                    commission: "Comissão",
                    marketing: "Marketing",
                    profit_margin: "Margem",
                    custom: "Outro",
                  };

                  return (
                    <div key={v.id} className="flex items-center justify-between">
                      <span className="text-[11px] text-[#8a8a99]">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] mr-1.5">{typeLabel[v.type] || v.type}</span>
                        {v.name} ({v.value}%)
                      </span>
                      <span className="text-[11px] text-white">-{formatCurrency(deduction)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Net result */}
            <div className={`mt-3 pt-3 border-t border-white/[0.06] rounded-xl p-3 ${
              isDanger ? "bg-[#ef4444]/5 border-[#ef4444]/10" : isWarning ? "bg-[#f59e0b]/5 border-[#f59e0b]/10" : "bg-[#22c55e]/5 border-[#22c55e]/10"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isDanger ? (
                    <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                  )}
                  <div>
                    <p className="text-[12px] text-white" style={{ fontWeight: 500 }}>Lucro Líquido Real</p>
                    <p className={`text-[10px] ${isDanger ? "text-[#ef4444]" : isWarning ? "text-[#f59e0b]" : "text-[#22c55e]"}`}>
                      Margem: {simulatedResult.profitMargin.toFixed(1)}%
                      {isDanger && " - Prejuizo!"}
                      {isWarning && " - Margem baixa"}
                    </p>
                  </div>
                </div>
                <span className={`text-[20px] ${isDanger ? "text-[#ef4444]" : isWarning ? "text-[#f59e0b]" : "text-[#22c55e]"}`} style={{ fontWeight: 600 }}>
                  {formatCurrency(simulatedResult.netAmount)}
                </span>
              </div>
            </div>

            {/* Quick comparison: what if PIX vs Card */}
            {paymentMethod !== "PIX" && grossAmount > 0 && (
              <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.04]">
                <p className="text-[10px] text-[#8a8a99] mb-1">
                  Se fosse PIX (a vista):
                </p>
                {(() => {
                  const pixResult = calculateSaleIntelligence(
                    grossAmount,
                    variableParams,
                    "PIX",
                    1,
                    [{ id: "simulator-cmv-pix", description: "CMV", amount: parseFloat(cmv) || 0 }]
                  );
                  const diff = pixResult.netAmount - simulatedResult.netAmount;
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#22c55e]">
                        +{formatCurrency(diff)} a mais de lucro
                      </span>
                      <span className="text-[12px] text-white" style={{ fontWeight: 500 }}>
                        {formatCurrency(pixResult.netAmount)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
