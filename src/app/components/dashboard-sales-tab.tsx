import { formatCurrency } from "../lib/finance-data";
import { useTheme } from "../lib/theme-context";
import { useMemo, useRef } from "react";
import {
  ShoppingBag, TrendingUp, DollarSign, Users, Crown, Medal, Award,
  ArrowUpRight, Percent, BarChart3, Tag, User, ExternalLink, Layers,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { subMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router";
import { useFinance } from "../lib/finance-context";

const RANK_ICONS = [Crown, Medal, Award];

interface Props {
  dateRange: { start: Date; end: Date };
  period: string;
}

export function DashboardSalesTab({ dateRange, period }: Props) {
  const { entries, commissionMembers, services, clients } = useFinance();
  const navigate = useNavigate();

  // Stable 'now' reference to avoid unnecessary re-renders
  const nowRef = useRef(new Date());
  const now = nowRef.current;

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (e.type !== "income") return false;
      const d = new Date(e.date + "T12:00:00");
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [entries, dateRange]);

  const stats = useMemo(() => {
    const totalBruto = filtered.reduce((s, e) => s + e.amount, 0);
    const totalLiquido = filtered.reduce((s, e) => s + (e.netAmount || e.amount), 0);
    const qtdVendas = filtered.length;
    const ticketMedio = qtdVendas > 0 ? totalBruto / qtdVendas : 0;

    const commissioned = filtered.filter(e => e.saleType === "commissioned" && e.commissionMemberId);
    const direct = filtered.filter(e => !e.saleType || e.saleType === "direct");

    const totalComissioned = commissioned.reduce((s, e) => s + e.amount, 0);
    const totalDirect = direct.reduce((s, e) => s + e.amount, 0);
    const totalCommissionValue = commissioned.reduce((s, e) => s + (e.commissionAmount || 0), 0);
    const pendingCommissions = commissioned.filter(e => e.status === "pending").reduce((s, e) => s + (e.commissionAmount || 0), 0);

    return {
      totalBruto, totalLiquido, qtdVendas, ticketMedio,
      totalComissioned, totalDirect, totalCommissionValue, pendingCommissions,
      qtdCommissioned: commissioned.length,
      qtdDirect: direct.length,
    };
  }, [filtered]);

  // Revenue by category
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filtered.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const data = [];
    const months = period === "current_month" ? 6 : period === "3m" ? 3 : period === "6m" ? 6 : 12;
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const me = entries.filter(e => {
        if (e.type !== "income") return false;
        const ed = new Date(e.date + "T12:00:00");
        return ed.getMonth() === m && ed.getFullYear() === y;
      });
      data.push({
        label: format(d, "MMM/yy", { locale: ptBR }),
        receita: me.reduce((s, e) => s + e.amount, 0),
        qtd: me.length,
      });
    }
    return data;
  }, [entries, period]);

  // Commission ranking
  const ranking = useMemo(() => {
    const commEntries = filtered.filter(e => e.saleType === "commissioned" && e.commissionMemberId);
    const map: Record<string, { name: string; type: string; sold: number; qty: number; commission: number }> = {};
    commEntries.forEach(e => {
      const member = commissionMembers.find(m => m.id === e.commissionMemberId);
      if (!member) return;
      if (!map[member.id]) map[member.id] = { name: member.name, type: member.type, sold: 0, qty: 0, commission: 0 };
      map[member.id].sold += e.amount;
      map[member.id].qty += 1;
      map[member.id].commission += e.commissionAmount || 0;
    });
    return Object.values(map).sort((a, b) => b.sold - a.sold);
  }, [filtered, commissionMembers]);

  // Top clients - resolve clientId from clients list when available
  const topClients = useMemo(() => {
    const clientMap: Record<string, { amount: number; qty: number }> = {};
    filtered.forEach(e => {
      // Try to resolve client name from clientId first, then fall back to text field
      let name = "Sem cliente";
      if (e.serviceId) {
        // Check if there's a clientId-based match (from pipeline/win wizard entries)
        // The entry stores client as text, so we use it directly
      }
      if (e.client) {
        name = e.client;
      }
      // If we have clients in the database, try to match by name to enrich
      if (name !== "Sem cliente") {
        const matchedClient = clients.find(c => {
          const fullName = c.type === "pf" ? c.fullName : (c.nomeFantasia || c.razaoSocial);
          return fullName?.toLowerCase() === name.toLowerCase();
        });
        if (matchedClient) {
          // Use canonical name from database
          name = matchedClient.type === "pf" ? (matchedClient.fullName || name) : (matchedClient.nomeFantasia || matchedClient.razaoSocial || name);
        }
      }
      if (!clientMap[name]) clientMap[name] = { amount: 0, qty: 0 };
      clientMap[name].amount += e.amount;
      clientMap[name].qty += 1;
    });
    return Object.entries(clientMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [filtered, clients]);

  // Direct vs Commissioned pie
  const saleMixPie = useMemo(() => [
    { name: "Venda Direta", value: stats.totalDirect },
    { name: "Comissionada", value: stats.totalComissioned },
  ].filter(d => d.value > 0), [stats]);

  const typeLabels: Record<string, string> = { vendedor: "Vendedor", influenciador: "Influenciador", indicador: "Indicador", parceiro: "Parceiro" };

  const { accent } = useTheme();
  const COLORS = useMemo(() => [accent, "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"], [accent]);

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Vendido", value: formatCurrency(stats.totalBruto), color: "#22c55e", icon: TrendingUp, sub: `${stats.qtdVendas} vendas no periodo` },
          { label: "Ticket Medio", value: formatCurrency(stats.ticketMedio), color: "#f59e0b", icon: Tag },
          { label: "Vendas Diretas", value: String(stats.qtdDirect), color: accent, icon: ShoppingBag, sub: formatCurrency(stats.totalDirect) },
          { label: "Vendas Comissionadas", value: String(stats.qtdCommissioned), color: "#a855f7", icon: Users, sub: formatCurrency(stats.totalComissioned) },
          { label: "Comissoes Geradas", value: formatCurrency(stats.totalCommissionValue), color: "#3b82f6", icon: Percent },
          { label: "Comissoes Pendentes", value: formatCurrency(stats.pendingCommissions), color: stats.pendingCommissions > 0 ? "#ef4444" : "#8a8a99", icon: DollarSign },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#131316] rounded-2xl p-4 border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${kpi.color}15` }}>
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
            </div>
            <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">{kpi.label}</p>
            <p className="text-[18px] text-white mt-0.5" style={{ fontWeight: 600 }}>{kpi.value}</p>
            {kpi.sub && <p className="text-[10px] text-[#8a8a99] mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Trend + Category */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <h3 className="text-white text-[15px] mb-1" style={{ fontWeight: 500 }}>Evolução de Vendas</h3>
          <p className="text-[12px] text-[#8a8a99] mb-5">Receita bruta mensal</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="gSalesR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis key="xaxis" dataKey="label" stroke="#8a8a99" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis key="yaxis" stroke="#8a8a99" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip key="tooltip" contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number, name: string) => [name === "receita" ? formatCurrency(v) : v, name === "receita" ? "Receita" : "Qtd"]} />
                <Area key="area-receita" type="monotone" dataKey="receita" stroke={accent} fill="url(#gSalesR)" strokeWidth={2.5} dot={{ fill: accent, strokeWidth: 0, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
          <h3 className="text-white text-[14px] mb-1" style={{ fontWeight: 500 }}>Receita por Categoria</h3>
          <p className="text-[12px] text-[#8a8a99] mb-3">Serviços mais vendidos</p>
          {categoryData.length > 0 ? (
            <>
              <div style={{ height: 140 }} className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-auto">
                {categoryData.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-[#8a8a99] truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {item.name}
                    </span>
                    <span className="text-white shrink-0 ml-1">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-[#8a8a99]">Sem vendas no periodo</div>
          )}
        </div>
      </div>

      {/* Mix de Vendas + Ranking + Top Clientes */}
      <div className="grid grid-cols-12 gap-4">
        {/* Mix */}
        <div className="col-span-3 bg-[#131316] rounded-2xl p-5 border border-white/[0.06] flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-[#3b82f6]" />
            <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>Mix de Vendas</h4>
          </div>
          {saleMixPie.length > 0 ? (
            <>
              <div style={{ height: 130 }} className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={saleMixPie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4} dataKey="value">
                      <Cell fill={accent} />
                      <Cell fill="#a855f7" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v)]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-auto">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full bg-[#FF0074]" /> Direta</span>
                  <span className="text-[11px] text-white">{formatCurrency(stats.totalDirect)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full bg-[#a855f7]" /> Comissionada</span>
                  <span className="text-[11px] text-white">{formatCurrency(stats.totalComissioned)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-[#8a8a99]">Sem dados</div>
          )}
        </div>

        {/* Commission Ranking */}
        <div className="col-span-5 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#f59e0b]" />
              <h4 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Ranking de Comissionados</h4>
            </div>
            <button onClick={() => navigate("/equipe")} className="text-[11px] text-[#FF0074] hover:underline flex items-center gap-1">
              Ver equipe <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          {ranking.length > 0 ? (
            <div className="space-y-2">
              {ranking.slice(0, 5).map((member, i) => {
                const RankIcon = RANK_ICONS[i] || User;
                const rankColors = ["#f59e0b", "#c0c0c0", "#cd7f32", "#8a8a99", "#8a8a99"];
                return (
                  <div key={member.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${rankColors[i]}15` }}>
                      <RankIcon className="w-4 h-4" style={{ color: rankColors[i] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white truncate">{member.name}</p>
                      <p className="text-[10px] text-[#8a8a99]">{typeLabels[member.type] || member.type} / {member.qty} vendas</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] text-white" style={{ fontWeight: 500 }}>{formatCurrency(member.sold)}</p>
                      <p className="text-[10px] text-[#a855f7]">Com: {formatCurrency(member.commission)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-[12px] text-[#8a8a99]">Nenhuma venda comissionada no periodo</div>
          )}
        </div>

        {/* Top Clients */}
        <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-[#22c55e]" />
            <h4 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Top Clientes</h4>
          </div>
          {topClients.length > 0 ? (
            <div className="space-y-2.5">
              {topClients.map((client, i) => {
                const maxVal = topClients[0]?.amount || 1;
                const barW = (client.amount / maxVal) * 100;
                return (
                  <div key={client.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] text-white truncate">{client.name}</span>
                      <span className="text-[11px] text-[#8a8a99] shrink-0 ml-2">{client.qty}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-[11px] text-white shrink-0" style={{ fontWeight: 500 }}>{formatCurrency(client.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-[12px] text-[#8a8a99]">Sem dados de clientes</div>
          )}
        </div>
      </div>
    </div>
  );
}