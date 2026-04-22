import { useState, useMemo } from "react";
import {
  TrendingUp, Target, DollarSign, Users, MousePointerClick,
  Zap, ArrowUpRight, ExternalLink, Activity, Layers,
  BarChart3, Filter, Globe, Sparkles, Hash,
  ChevronDown, Radio, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
} from "recharts";
import { format, eachDayOfInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router";
import { useFinance } from "../lib/finance-context";
import { formatCurrency, MARKETING_CHANNELS } from "../lib/finance-data";
import type { MarketingAction, MarketingChannelType } from "../lib/finance-data";
import { useTheme } from "../lib/theme-context";

const META_COLOR = "#3b82f6";
const GOOGLE_COLOR = "#22c55e";
const EXTRA_COLOR = "#a855f7";
const BASE_COLORS = ["#00FA64", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#84cc16"];

type MarketingSource = "visao_geral" | "meta_ads" | "google_ads" | "acoes_extras";

interface Props {
  dateRange: { start: Date; end: Date };
  period: string;
}

// ==================== MOCK ADS DATA (simulated – will be replaced by real API) ====================

interface MockAdCampaign {
  id: string;
  name: string;
  source: "meta_ads" | "google_ads";
  status: "active" | "paused" | "completed";
  investment: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue: number;
  dailyData: { date: string; investment: number; impressions: number; clicks: number; leads: number; conversions: number; revenue: number }[];
}

function generateMockAdCampaigns(dateRange: { start: Date; end: Date }): MockAdCampaign[] {
  const days = Math.max(differenceInDays(dateRange.end, dateRange.start), 1);
  const daysList = eachDayOfInterval({ start: dateRange.start, end: new Date(Math.min(dateRange.end.getTime(), Date.now())) });

  const seed = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  const metaCampaigns = [
    { id: "meta_1", name: "Campanha Institucional - Instagram", status: "active" as const, baseInv: 120, baseCPM: 18, ctr: 2.8, convRate: 4.2, avgTicket: 1800 },
    { id: "meta_2", name: "Remarketing - Carrinho Abandonado", status: "active" as const, baseInv: 80, baseCPM: 22, ctr: 4.5, convRate: 8.5, avgTicket: 2200 },
    { id: "meta_3", name: "Lookalike - Clientes VIP", status: "paused" as const, baseInv: 65, baseCPM: 15, ctr: 1.9, convRate: 3.1, avgTicket: 1500 },
    { id: "meta_4", name: "Stories - Lançamento Novo Serviço", status: "active" as const, baseInv: 95, baseCPM: 20, ctr: 3.2, convRate: 5.0, avgTicket: 2500 },
  ];

  const googleCampaigns = [
    { id: "google_1", name: "Search - Palavras-chave Principais", status: "active" as const, baseInv: 90, baseCPM: 35, ctr: 6.5, convRate: 7.8, avgTicket: 2000 },
    { id: "google_2", name: "Display - Rede de Parceiros", status: "active" as const, baseInv: 45, baseCPM: 8, ctr: 0.8, convRate: 1.5, avgTicket: 1200 },
    { id: "google_3", name: "YouTube - Video Institucional", status: "completed" as const, baseInv: 55, baseCPM: 12, ctr: 1.2, convRate: 2.0, avgTicket: 1700 },
  ];

  const allTemplates = [
    ...metaCampaigns.map(c => ({ ...c, source: "meta_ads" as const })),
    ...googleCampaigns.map(c => ({ ...c, source: "google_ads" as const })),
  ];

  return allTemplates.map(template => {
    const dailyData = daysList.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayOfWeek = day.getDay();
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.65 : 1;
      const variance = 0.7 + ((seed(dateStr + template.id) % 60) / 100);

      const dailyInv = template.baseInv * weekendFactor * variance;
      const impressions = Math.round((dailyInv / template.baseCPM) * 1000 * variance);
      const clicks = Math.round(impressions * (template.ctr / 100) * (0.8 + (seed(dateStr + "c") % 40) / 100));
      const leads = Math.round(clicks * (template.convRate / 100) * 1.8 * (0.7 + (seed(dateStr + "l") % 60) / 100));
      const conversions = Math.round(leads * (template.convRate / 100) * (0.6 + (seed(dateStr + "v") % 80) / 100));
      const revenue = conversions * template.avgTicket * (0.8 + (seed(dateStr + "r") % 40) / 100);

      return { date: dateStr, investment: Math.round(dailyInv * 100) / 100, impressions, clicks, leads, conversions, revenue: Math.round(revenue * 100) / 100 };
    });

    const totals = dailyData.reduce((acc, d) => ({
      investment: acc.investment + d.investment,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      leads: acc.leads + d.leads,
      conversions: acc.conversions + d.conversions,
      revenue: acc.revenue + d.revenue,
    }), { investment: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0 });

    return { ...template, ...totals, dailyData };
  });
}

// ==================== COMPONENT ====================

export function DashboardMarketingTab({ dateRange, period }: Props) {
  const { marketingActions, entries, goals } = useFinance();
  const navigate = useNavigate();
  const { accent } = useTheme();
  const COLORS_MAP = useMemo(() => [accent, ...BASE_COLORS.slice(1)], [accent]);
  const [source, setSource] = useState<MarketingSource>("visao_geral");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);

  // Mock Ads campaigns
  const adsCampaigns = useMemo(() => generateMockAdCampaigns(dateRange), [dateRange]);

  const metaCampaigns = useMemo(() => adsCampaigns.filter(c => c.source === "meta_ads"), [adsCampaigns]);
  const googleCampaigns = useMemo(() => adsCampaigns.filter(c => c.source === "google_ads"), [adsCampaigns]);

  // Filter extra actions by date
  const filteredExtras = useMemo(() => {
    let filtered = marketingActions.filter(a => {
      const sd = new Date(a.startDate + "T12:00:00");
      return sd >= dateRange.start && sd <= dateRange.end;
    });
    if (statusFilter !== "all") filtered = filtered.filter(a => a.status === statusFilter);
    return filtered;
  }, [marketingActions, dateRange, statusFilter]);

  // Build campaign list for dropdown based on source
  const campaignList = useMemo(() => {
    if (source === "meta_ads") return metaCampaigns.map(c => ({ id: c.id, name: c.name }));
    if (source === "google_ads") return googleCampaigns.map(c => ({ id: c.id, name: c.name }));
    if (source === "acoes_extras") return filteredExtras.map(a => ({ id: a.id, name: a.name }));
    return [
      ...metaCampaigns.map(c => ({ id: c.id, name: `[Meta] ${c.name}` })),
      ...googleCampaigns.map(c => ({ id: c.id, name: `[Google] ${c.name}` })),
      ...filteredExtras.map(a => ({ id: a.id, name: `[Extra] ${a.name}` })),
    ];
  }, [source, metaCampaigns, googleCampaigns, filteredExtras]);

  // Aggregate stats based on source and campaign filter
  const stats = useMemo(() => {
    let adsData = { investment: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0 };
    let extraData = { investment: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0, revenue: 0 };

    const filterCampaigns = (campaigns: MockAdCampaign[]) => {
      if (selectedCampaign === "all") return campaigns;
      return campaigns.filter(c => c.id === selectedCampaign);
    };

    if (source === "visao_geral" || source === "meta_ads") {
      filterCampaigns(metaCampaigns).forEach(c => {
        adsData.investment += c.investment;
        adsData.impressions += c.impressions;
        adsData.clicks += c.clicks;
        adsData.leads += c.leads;
        adsData.conversions += c.conversions;
        adsData.revenue += c.revenue;
      });
    }
    if (source === "visao_geral" || source === "google_ads") {
      filterCampaigns(googleCampaigns).forEach(c => {
        adsData.investment += c.investment;
        adsData.impressions += c.impressions;
        adsData.clicks += c.clicks;
        adsData.leads += c.leads;
        adsData.conversions += c.conversions;
        adsData.revenue += c.revenue;
      });
    }
    if (source === "visao_geral" || source === "acoes_extras") {
      const extras = selectedCampaign === "all" ? filteredExtras : filteredExtras.filter(a => a.id === selectedCampaign);
      extras.forEach(a => {
        extraData.investment += a.investment;
        extraData.impressions += a.impressions || 0;
        extraData.clicks += a.clicks || 0;
        extraData.leads += a.leadsGenerated || 0;
        extraData.conversions += a.conversions || 0;
        extraData.revenue += a.revenue || 0;
      });
    }

    const total = {
      investment: adsData.investment + extraData.investment,
      impressions: adsData.impressions + extraData.impressions,
      clicks: adsData.clicks + extraData.clicks,
      leads: adsData.leads + extraData.leads,
      conversions: adsData.conversions + extraData.conversions,
      revenue: adsData.revenue + extraData.revenue,
    };

    const roas = total.investment > 0 ? total.revenue / total.investment : 0;
    const cpa = total.conversions > 0 ? total.investment / total.conversions : 0;
    const cpl = total.leads > 0 ? total.investment / total.leads : 0;
    const ctr = total.impressions > 0 ? (total.clicks / total.impressions) * 100 : 0;
    const conversionRate = total.leads > 0 ? (total.conversions / total.leads) * 100 : 0;
    const roi = total.investment > 0 ? ((total.revenue - total.investment) / total.investment) * 100 : 0;

    return { ...total, roas, cpa, cpl, ctr, conversionRate, roi, adsData, extraData };
  }, [source, selectedCampaign, metaCampaigns, googleCampaigns, filteredExtras]);

  // Trend chart data
  const trendData = useMemo(() => {
    const daysList = eachDayOfInterval({ start: dateRange.start, end: new Date(Math.min(dateRange.end.getTime(), Date.now())) });
    // Limit to 60 points for performance
    const step = Math.max(1, Math.floor(daysList.length / 60));
    const sampled = daysList.filter((_, i) => i % step === 0);

    return sampled.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      let metaInv = 0, metaConv = 0, googleInv = 0, googleConv = 0, extraInv = 0, extraConv = 0;

      if (source === "visao_geral" || source === "meta_ads") {
        metaCampaigns.forEach(c => {
          const dd = c.dailyData.find(d => d.date === dateStr);
          if (dd) { metaInv += dd.investment; metaConv += dd.conversions; }
        });
      }
      if (source === "visao_geral" || source === "google_ads") {
        googleCampaigns.forEach(c => {
          const dd = c.dailyData.find(d => d.date === dateStr);
          if (dd) { googleInv += dd.investment; googleConv += dd.conversions; }
        });
      }

      return {
        label: format(day, "dd/MM", { locale: ptBR }),
        metaInv, metaConv, googleInv, googleConv, extraInv, extraConv,
        totalInv: metaInv + googleInv + extraInv,
        totalConv: metaConv + googleConv + extraConv,
      };
    });
  }, [dateRange, source, metaCampaigns, googleCampaigns]);

  // Source distribution for pie
  const sourceDistribution = useMemo(() => {
    const data = [];
    if (source === "visao_geral") {
      const metaTotal = metaCampaigns.reduce((s, c) => s + c.investment, 0);
      const googleTotal = googleCampaigns.reduce((s, c) => s + c.investment, 0);
      const extraTotal = filteredExtras.reduce((s, a) => s + a.investment, 0);
      if (metaTotal > 0) data.push({ name: "Meta Ads", value: metaTotal, color: META_COLOR });
      if (googleTotal > 0) data.push({ name: "Google Ads", value: googleTotal, color: GOOGLE_COLOR });
      if (extraTotal > 0) data.push({ name: "Ações Extras", value: extraTotal, color: EXTRA_COLOR });
    } else if (source === "meta_ads") {
      metaCampaigns.forEach((c, i) => data.push({ name: c.name.split(" - ")[0], value: c.investment, color: COLORS_MAP[i % COLORS_MAP.length] }));
    } else if (source === "google_ads") {
      googleCampaigns.forEach((c, i) => data.push({ name: c.name.split(" - ")[0], value: c.investment, color: COLORS_MAP[(i + 3) % COLORS_MAP.length] }));
    } else {
      filteredExtras.forEach((a, i) => data.push({ name: a.name, value: a.investment, color: COLORS_MAP[(i + 1) % COLORS_MAP.length] }));
    }
    return data;
  }, [source, metaCampaigns, googleCampaigns, filteredExtras]);

  // Campaign ranking table
  const campaignRanking = useMemo(() => {
    const items: { id: string; name: string; source: string; sourceColor: string; investment: number; conversions: number; revenue: number; leads: number; roas: number; cpa: number; status: string }[] = [];

    const addAds = (campaigns: MockAdCampaign[], label: string, color: string) => {
      campaigns.forEach(c => {
        items.push({
          id: c.id, name: c.name, source: label, sourceColor: color,
          investment: c.investment, conversions: c.conversions, revenue: c.revenue, leads: c.leads,
          roas: c.investment > 0 ? c.revenue / c.investment : 0,
          cpa: c.conversions > 0 ? c.investment / c.conversions : 0,
          status: c.status === "active" ? "Ativa" : c.status === "paused" ? "Pausada" : "Concluída",
        });
      });
    };

    if (source === "visao_geral" || source === "meta_ads") addAds(metaCampaigns, "Meta", META_COLOR);
    if (source === "visao_geral" || source === "google_ads") addAds(googleCampaigns, "Google", GOOGLE_COLOR);
    if (source === "visao_geral" || source === "acoes_extras") {
      filteredExtras.forEach(a => {
        items.push({
          id: a.id, name: a.name, source: "Extra", sourceColor: EXTRA_COLOR,
          investment: a.investment, conversions: a.conversions || 0, revenue: a.revenue || 0, leads: a.leadsGenerated || 0,
          roas: a.investment > 0 ? (a.revenue || 0) / a.investment : 0,
          cpa: (a.conversions || 0) > 0 ? a.investment / (a.conversions || 1) : 0,
          status: a.status === "active" ? "Ativa" : a.status === "completed" ? "Concluída" : a.status === "planned" ? "Planejada" : "Cancelada",
        });
      });
    }

    return items.sort((a, b) => b.roas - a.roas);
  }, [source, metaCampaigns, googleCampaigns, filteredExtras]);

  // Funnel data
  const funnelSteps = useMemo(() => {
    const maxVal = Math.max(stats.impressions, 1);
    return [
      { label: "Impressões", value: stats.impressions, color: "#8a8a99", pct: 100 },
      { label: "Cliques", value: stats.clicks, color: META_COLOR, pct: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0 },
      { label: "Leads", value: stats.leads, color: "#f59e0b", pct: stats.impressions > 0 ? (stats.leads / stats.impressions) * 100 : 0 },
      { label: "Conversões", value: stats.conversions, color: GOOGLE_COLOR, pct: stats.impressions > 0 ? (stats.conversions / stats.impressions) * 100 : 0 },
    ];
  }, [stats]);

  // Goals
  const targetROAS = goals.targetROAS || 0;
  const targetCPA = goals.targetCPA || 0;

  const sourceButtons: { key: MarketingSource; label: string; icon: any; color: string }[] = [
    { key: "visao_geral", label: "Visão Geral", icon: BarChart3, color: accent },
    { key: "meta_ads", label: "Meta Ads", icon: Globe, color: META_COLOR },
    { key: "google_ads", label: "Google Ads", icon: Target, color: GOOGLE_COLOR },
    { key: "acoes_extras", label: "Ações Extras", icon: Sparkles, color: EXTRA_COLOR },
  ];

  return (
    <div className="space-y-5">
      {/* Source Tabs + Campaign Filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-[#131316] rounded-xl border border-white/[0.06]">
          {sourceButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => { setSource(btn.key); setSelectedCampaign("all"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] transition-all ${
                source === btn.key ? "text-white" : "text-[#8a8a99] hover:text-white hover:bg-white/[0.04]"
              }`}
              style={{
                fontWeight: source === btn.key ? 500 : 400,
                backgroundColor: source === btn.key ? `${btn.color}20` : undefined,
                borderWidth: source === btn.key ? 1 : 0,
                borderColor: source === btn.key ? `${btn.color}40` : undefined,
                borderStyle: "solid",
              }}
            >
              <btn.icon className="w-3.5 h-3.5" style={{ color: source === btn.key ? btn.color : undefined }} />
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Simulated badge */}
          {(source === "meta_ads" || source === "google_ads" || source === "visao_geral") && (
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20" style={{ fontWeight: 500 }}>
              <Radio className="w-3 h-3 inline mr-1" />
              Dados Simulados
            </span>
          )}

          {/* Status filter for extras */}
          {source === "acoes_extras" && (
            <div className="flex items-center gap-1 p-0.5 bg-[#1c1c21] rounded-lg border border-white/[0.06]">
              {[
                { key: "all", label: "Todas" },
                { key: "active", label: "Ativas" },
                { key: "completed", label: "Concluídas" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-[11px] transition-all ${
                    statusFilter === opt.key ? "bg-[#FF0074]/20 text-[#FF0074] border border-[#FF0074]/30" : "text-[#8a8a99] hover:text-white"
                  }`}
                  style={{ fontWeight: statusFilter === opt.key ? 500 : 400 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Campaign dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#131316] border border-white/[0.06] text-[12px] text-[#8a8a99] hover:text-white hover:border-white/[0.1] transition-all min-w-[180px]"
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="truncate flex-1 text-left">
                {selectedCampaign === "all" ? "Todas as Campanhas" : campaignList.find(c => c.id === selectedCampaign)?.name || "Campanha"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
            {showCampaignDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCampaignDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-64 overflow-y-auto bg-[#1c1c21] border border-white/[0.08] rounded-xl shadow-2xl custom-scrollbar">
                  <button
                    onClick={() => { setSelectedCampaign("all"); setShowCampaignDropdown(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[12px] hover:bg-white/[0.04] transition-colors ${selectedCampaign === "all" ? "text-[#FF0074]" : "text-[#8a8a99]"}`}
                    style={{ fontWeight: selectedCampaign === "all" ? 500 : 400 }}
                  >
                    Todas as Campanhas
                  </button>
                  {campaignList.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCampaign(c.id); setShowCampaignDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-[12px] hover:bg-white/[0.04] transition-colors truncate ${selectedCampaign === c.id ? "text-[#FF0074]" : "text-white/70"}`}
                      style={{ fontWeight: selectedCampaign === c.id ? 500 : 400 }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={() => navigate("/marketing")} className="text-[12px] text-[#FF0074] hover:underline flex items-center gap-1 ml-1 shrink-0">
            Gerenciar <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-7 gap-3">
        {[
          { label: "Investimento Total", value: formatCurrency(stats.investment), color: "#ef4444", icon: DollarSign, trend: null },
          { label: "Faturamento Total", value: formatCurrency(stats.revenue), color: "#22c55e", icon: TrendingUp, trend: null },
          { label: "ROAS", value: `${stats.roas.toFixed(2)}x`, color: stats.roas >= (targetROAS || 3) ? "#22c55e" : stats.roas >= 1 ? "#f59e0b" : "#ef4444", icon: Zap, sub: targetROAS ? `Meta: ${targetROAS}x` : undefined },
          { label: "CPA", value: formatCurrency(stats.cpa), color: targetCPA && stats.cpa <= targetCPA ? "#22c55e" : stats.cpa > 0 ? "#f59e0b" : "#8a8a99", icon: Target, sub: targetCPA ? `Meta: ${formatCurrency(targetCPA)}` : undefined },
          { label: "Conversões", value: stats.conversions.toLocaleString("pt-BR"), color: accent, icon: MousePointerClick, sub: `${stats.conversionRate.toFixed(1)}% taxa conv.` },
          { label: "Leads", value: stats.leads.toLocaleString("pt-BR"), color: "#f59e0b", icon: Users, sub: stats.cpl > 0 ? `CPL: ${formatCurrency(stats.cpl)}` : undefined },
          { label: "ROI", value: `${stats.roi.toFixed(0)}%`, color: stats.roi > 0 ? "#22c55e" : "#ef4444", icon: ArrowUpRight, sub: stats.impressions > 0 ? `CTR: ${stats.ctr.toFixed(2)}%` : undefined },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#131316] rounded-2xl p-4 border border-white/[0.06] relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{ background: `linear-gradient(135deg, ${kpi.color}, transparent 60%)` }} />
            <div className="relative">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${kpi.color}15` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
              <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">{kpi.label}</p>
              <p className="text-[20px] text-white mt-0.5" style={{ fontWeight: 600 }}>{kpi.value}</p>
              {kpi.sub && <p className="text-[10px] text-[#8a8a99] mt-0.5">{kpi.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2: Trend Chart + Source Distribution */}
      <div className="grid grid-cols-12 gap-4">
        {/* Trend Chart */}
        <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Tendência de Investimento e Conversões</h3>
              <p className="text-[12px] text-[#8a8a99] mt-0.5">Evolução diária no período selecionado</p>
            </div>
            <div className="flex items-center gap-4">
              {source === "visao_geral" ? (
                <>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: META_COLOR }} /> Meta</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOOGLE_COLOR }} /> Google</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full bg-[#FF0074]" /> Investimento</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#8a8a99]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOOGLE_COLOR }} /> Conversões</span>
                </>
              )}
            </div>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              {source === "visao_geral" ? (
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gMeta" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={META_COLOR} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={META_COLOR} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOOGLE_COLOR} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={GOOGLE_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis key="xaxis" dataKey="label" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(trendData.length / 8) - 1)} />
                  <YAxis key="yaxis" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip key="tooltip" contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "11px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  <Area key="area-meta" type="monotone" dataKey="metaInv" name="Meta Ads" stroke={META_COLOR} fill="url(#gMeta)" strokeWidth={2} dot={false} />
                  <Area key="area-google" type="monotone" dataKey="googleInv" name="Google Ads" stroke={GOOGLE_COLOR} fill="url(#gGoogle)" strokeWidth={2} dot={false} />
                </AreaChart>
              ) : (
                <LineChart data={trendData}>
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis key="xaxis" dataKey="label" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(trendData.length / 8) - 1)} />
                  <YAxis key="yaxis-inv" yAxisId="inv" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis key="yaxis-conv" yAxisId="conv" orientation="right" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip key="tooltip" contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "11px" }} formatter={(v: number, name: string) => [name.includes("Inv") ? formatCurrency(v) : v, name.includes("Inv") ? "Investimento" : "Conversões"]} />
                  <Line key="line-inv" yAxisId="inv" type="monotone" dataKey="totalInv" name="Investimento" stroke={accent} strokeWidth={2} dot={false} />
                  <Line key="line-conv" yAxisId="conv" type="monotone" dataKey="totalConv" name="Conversões" stroke={GOOGLE_COLOR} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Distribution + Funnel */}
        <div className="col-span-4 space-y-4">
          {/* Pie */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <h3 className="text-white text-[13px] mb-1" style={{ fontWeight: 500 }}>
              {source === "visao_geral" ? "Distribuição por Fonte" : "Distribuição por Campanha"}
            </h3>
            <p className="text-[11px] text-[#8a8a99] mb-3">Investimento</p>
            {sourceDistribution.length > 0 ? (
              <>
                <div style={{ height: 120 }} className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={52} paddingAngle={3} dataKey="value">
                        {sourceDistribution.map((entry, i) => <Cell key={entry.name} fill={entry.color || COLORS_MAP[i % COLORS_MAP.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "11px" }} formatter={(v: number) => [formatCurrency(v)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {sourceDistribution.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-[#8a8a99] truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || COLORS_MAP[i % COLORS_MAP.length] }} />
                        {item.name}
                      </span>
                      <span className="text-white shrink-0 ml-1">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-6 text-[12px] text-[#8a8a99]">Sem dados</div>
            )}
          </div>

          {/* Funnel */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-[#a855f7]" />
              <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>Funil de Conversão</h4>
            </div>
            <div className="space-y-3">
              {funnelSteps.map(step => (
                <div key={step.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-[#8a8a99]">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#8a8a99]">{step.pct.toFixed(1)}%</span>
                      <span className="text-[12px] text-white" style={{ fontWeight: 500 }}>{step.value.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(step.pct, 2)}%`, backgroundColor: step.color }} />
                  </div>
                </div>
              ))}
            </div>
            {stats.ctr > 0 && <p className="text-[10px] text-[#8a8a99] mt-3">CTR: {stats.ctr.toFixed(2)}% | Conv. Leads: {stats.conversionRate.toFixed(1)}%</p>}
          </div>
        </div>
      </div>

      {/* ROW 3: Platform Breakdown (only in Visao Geral) */}
      {source === "visao_geral" && (
        <div className="grid grid-cols-2 gap-4">
          {/* Meta Panel */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${META_COLOR}15` }}>
                <Globe className="w-[18px] h-[18px]" style={{ color: META_COLOR }} />
              </div>
              <div>
                <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Meta Ads</h3>
                <p className="text-[11px] text-[#8a8a99]">{metaCampaigns.length} campanhas</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Investimento", value: formatCurrency(stats.adsData.investment > 0 ? metaCampaigns.reduce((s, c) => s + c.investment, 0) : 0) },
                { label: "Conversões", value: metaCampaigns.reduce((s, c) => s + c.conversions, 0).toLocaleString("pt-BR") },
                { label: "ROAS", value: (() => { const inv = metaCampaigns.reduce((s, c) => s + c.investment, 0); const rev = metaCampaigns.reduce((s, c) => s + c.revenue, 0); return inv > 0 ? `${(rev / inv).toFixed(2)}x` : "0x"; })() },
              ].map(item => (
                <div key={item.label} className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.03]">
                  <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">{item.label}</p>
                  <p className="text-[16px] text-white mt-0.5" style={{ fontWeight: 600 }}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {metaCampaigns.slice(0, 3).map(c => {
                const roas = c.investment > 0 ? c.revenue / c.investment : 0;
                return (
                  <div key={c.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white/[0.01]">
                    <span className="text-[#8a8a99] truncate pr-2">{c.name}</span>
                    <span className={`shrink-0 ${roas >= 2 ? "text-[#22c55e]" : "text-[#f59e0b]"}`} style={{ fontWeight: 500 }}>{roas.toFixed(1)}x</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Google Panel */}
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${GOOGLE_COLOR}15` }}>
                <Target className="w-[18px] h-[18px]" style={{ color: GOOGLE_COLOR }} />
              </div>
              <div>
                <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Google Ads</h3>
                <p className="text-[11px] text-[#8a8a99]">{googleCampaigns.length} campanhas</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Investimento", value: formatCurrency(googleCampaigns.reduce((s, c) => s + c.investment, 0)) },
                { label: "Conversões", value: googleCampaigns.reduce((s, c) => s + c.conversions, 0).toLocaleString("pt-BR") },
                { label: "ROAS", value: (() => { const inv = googleCampaigns.reduce((s, c) => s + c.investment, 0); const rev = googleCampaigns.reduce((s, c) => s + c.revenue, 0); return inv > 0 ? `${(rev / inv).toFixed(2)}x` : "0x"; })() },
              ].map(item => (
                <div key={item.label} className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.03]">
                  <p className="text-[10px] text-[#8a8a99] uppercase tracking-wider">{item.label}</p>
                  <p className="text-[16px] text-white mt-0.5" style={{ fontWeight: 600 }}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {googleCampaigns.slice(0, 3).map(c => {
                const roas = c.investment > 0 ? c.revenue / c.investment : 0;
                return (
                  <div key={c.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white/[0.01]">
                    <span className="text-[#8a8a99] truncate pr-2">{c.name}</span>
                    <span className={`shrink-0 ${roas >= 2 ? "text-[#22c55e]" : "text-[#f59e0b]"}`} style={{ fontWeight: 500 }}>{roas.toFixed(1)}x</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ROW 3b: Extra Actions Insight (when viewing extras or general) */}
      {(source === "acoes_extras") && filteredExtras.length === 0 && (
        <div className="bg-[#131316] rounded-2xl p-10 border border-white/[0.06] text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#a855f7]/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7 text-[#a855f7]" />
          </div>
          <h3 className="text-white text-[16px] mb-2" style={{ fontWeight: 500 }}>Nenhuma ação extra no período</h3>
          <p className="text-[13px] text-[#8a8a99] max-w-md mx-auto mb-5">
            Cadastre ações de marketing como parcerias com influenciadores, eventos ou panfletagem para acompanhar investimento, leads, conversões e ROAS.
          </p>
          <button onClick={() => navigate("/marketing")} className="px-6 py-2.5 bg-[#a855f7] text-white text-[13px] rounded-xl hover:bg-[#a855f7]/90 transition-colors" style={{ fontWeight: 500 }}>
            Cadastrar Ação Extra
          </button>
        </div>
      )}

      {(source === "acoes_extras") && filteredExtras.length > 0 && (
        <div className="grid grid-cols-12 gap-4">
          {/* Extra Actions Performance Bar Chart */}
          <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <h3 className="text-white text-[15px] mb-1" style={{ fontWeight: 500 }}>Desempenho das Ações Extras</h3>
            <p className="text-[12px] text-[#8a8a99] mb-4">Investimento vs Receita por ação</p>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredExtras.map(a => ({
                  name: a.name.length > 18 ? a.name.substring(0, 18) + "..." : a.name,
                  investido: a.investment,
                  receita: a.revenue || 0,
                }))} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8a8a99" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                  <Bar dataKey="investido" fill="#ef4444" radius={[6, 6, 0, 0]} name="Investido" opacity={0.7} />
                  <Bar dataKey="receita" fill="#22c55e" radius={[6, 6, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Extra Actions Summary */}
          <div className="col-span-4 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-[#a855f7]" />
              <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>Resumo Ações Extras</h4>
            </div>
            <div className="space-y-3">
              {[
                { label: "Total Ações", value: filteredExtras.length.toString(), color: "#a855f7" },
                { label: "Investido", value: formatCurrency(stats.extraData.investment), color: "#ef4444" },
                { label: "Receita", value: formatCurrency(stats.extraData.revenue), color: "#22c55e" },
                { label: "Leads Gerados", value: stats.extraData.leads.toLocaleString("pt-BR"), color: "#f59e0b" },
                { label: "Vendas", value: stats.extraData.conversions.toLocaleString("pt-BR"), color: accent },
                { label: "ROAS", value: stats.extraData.investment > 0 ? `${(stats.extraData.revenue / stats.extraData.investment).toFixed(2)}x` : "0x", color: stats.extraData.revenue > stats.extraData.investment ? "#22c55e" : "#ef4444" },
                { label: "Conv. Leads", value: stats.extraData.leads > 0 ? `${((stats.extraData.conversions / stats.extraData.leads) * 100).toFixed(1)}%` : "0%", color: "#3b82f6" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-[#8a8a99]">{item.label}</span>
                  <span className="text-[13px]" style={{ color: item.color, fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {stats.extraData.leads > 0 && stats.extraData.conversions < stats.extraData.leads * 0.15 && (
              <div className="mt-4 p-3 rounded-xl bg-[#f59e0b]/8 border border-[#f59e0b]/15">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b] mt-0.5 shrink-0" />
                  <p className="text-[10px] text-white/70 leading-relaxed">
                    Taxa de conversão de leads abaixo de 15%. Considere implementar ações de follow-up para aumentar as vendas e reduzir o CPA.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROW 4: Campaign Ranking Table */}
      <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white text-[15px]" style={{ fontWeight: 500 }}>Ranking de Campanhas</h3>
            <p className="text-[12px] text-[#8a8a99] mt-0.5">Ordenado por ROAS (melhor retorno primeiro)</p>
          </div>
          <span className="text-[11px] text-[#8a8a99]">{campaignRanking.length} campanhas</span>
        </div>

        {campaignRanking.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["#", "Campanha", "Fonte", "Investimento", "Conversões", "Receita", "CPA", "ROAS", "Status"].map(h => (
                    <th key={h} className="text-left text-[10px] text-[#8a8a99] uppercase tracking-wider py-2.5 px-3 first:pl-0" style={{ fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaignRanking.slice(0, 10).map((item, i) => (
                  <tr key={item.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pl-0 pr-3 text-[13px] text-[#8a8a99]" style={{ fontWeight: 600 }}>#{i + 1}</td>
                    <td className="py-3 px-3">
                      <p className="text-[12px] text-white truncate max-w-[200px]">{item.name}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${item.sourceColor}15`, color: item.sourceColor, fontWeight: 500 }}>
                        {item.source}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[12px] text-white">{formatCurrency(item.investment)}</td>
                    <td className="py-3 px-3 text-[12px] text-white">{item.conversions.toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-3 text-[12px] text-[#22c55e]" style={{ fontWeight: 500 }}>{formatCurrency(item.revenue)}</td>
                    <td className="py-3 px-3 text-[12px] text-white">{item.conversions > 0 ? formatCurrency(item.cpa) : "-"}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[13px] ${item.roas >= 3 ? "text-[#22c55e]" : item.roas >= 1 ? "text-[#f59e0b]" : "text-[#ef4444]"}`} style={{ fontWeight: 600 }}>
                        {item.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md ${
                        item.status === "Ativa" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                        item.status === "Concluída" ? "bg-[#3b82f6]/10 text-[#3b82f6]" :
                        item.status === "Pausada" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                        item.status === "Planejada" ? "bg-[#a855f7]/10 text-[#a855f7]" :  
                        "bg-[#8a8a99]/10 text-[#8a8a99]"
                      }`} style={{ fontWeight: 500 }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12px] text-[#8a8a99] text-center py-6">Nenhuma campanha encontrada para os filtros selecionados</p>
        )}
      </div>

      {/* ROW 5: Insights + Marketing Provisions */}
      <div className="grid grid-cols-12 gap-4">
        {/* Insights */}
        <div className="col-span-8 bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#FF0074]" />
            <h3 className="text-white text-[14px]" style={{ fontWeight: 500 }}>Insights de Marketing</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Best campaign */}
            {campaignRanking.length > 0 && (
              <div className="p-4 rounded-xl bg-[#22c55e]/5 border border-[#22c55e]/10">
                <p className="text-[10px] text-[#22c55e] uppercase tracking-wider mb-1" style={{ fontWeight: 500 }}>Melhor Campanha (ROAS)</p>
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 500 }}>{campaignRanking[0].name}</p>
                <p className="text-[11px] text-[#8a8a99] mt-1">{campaignRanking[0].source} | ROAS: {campaignRanking[0].roas.toFixed(2)}x | {formatCurrency(campaignRanking[0].revenue)} em receita</p>
              </div>
            )}
            {/* Worst */}
            {campaignRanking.length > 1 && (
              <div className="p-4 rounded-xl bg-[#ef4444]/5 border border-[#ef4444]/10">
                <p className="text-[10px] text-[#ef4444] uppercase tracking-wider mb-1" style={{ fontWeight: 500 }}>Pior Campanha (ROAS)</p>
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 500 }}>{campaignRanking[campaignRanking.length - 1].name}</p>
                <p className="text-[11px] text-[#8a8a99] mt-1">{campaignRanking[campaignRanking.length - 1].source} | ROAS: {campaignRanking[campaignRanking.length - 1].roas.toFixed(2)}x | CPA: {formatCurrency(campaignRanking[campaignRanking.length - 1].cpa)}</p>
              </div>
            )}
            {/* Conversion efficiency */}
            <div className="p-4 rounded-xl bg-[#3b82f6]/5 border border-[#3b82f6]/10">
              <p className="text-[10px] text-[#3b82f6] uppercase tracking-wider mb-1" style={{ fontWeight: 500 }}>Eficiência de Conversão</p>
              <p className="text-[14px] text-white" style={{ fontWeight: 500 }}>
                {stats.conversionRate.toFixed(1)}% de leads convertidos
              </p>
              <p className="text-[11px] text-[#8a8a99] mt-1">
                {stats.leads.toLocaleString("pt-BR")} leads geraram {stats.conversions.toLocaleString("pt-BR")} vendas
              </p>
            </div>
            {/* ROI */}
            <div className="p-4 rounded-xl bg-[#FF0074]/5 border border-[#FF0074]/10">
              <p className="text-[10px] text-[#FF0074] uppercase tracking-wider mb-1" style={{ fontWeight: 500 }}>Retorno sobre Investimento</p>
              <p className="text-[14px] text-white" style={{ fontWeight: 500 }}>
                {stats.roi > 0 ? "+" : ""}{stats.roi.toFixed(0)}% ROI
              </p>
              <p className="text-[11px] text-[#8a8a99] mt-1">
                Investiu {formatCurrency(stats.investment)} e gerou {formatCurrency(stats.revenue)}
              </p>
            </div>
          </div>
        </div>

        {/* Provisions */}
        <div className="col-span-4 space-y-4">
          <div className="bg-[#131316] rounded-2xl p-5 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-[#3b82f6]" />
              <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>Reserva de Marketing</h4>
            </div>
            <p className="text-[24px] text-[#3b82f6]" style={{ fontWeight: 600 }}>
              {formatCurrency(entries.filter(e => e.type === "income").reduce((s, e) => s + (e.provisionedMarketing || 0), 0))}
            </p>
            <p className="text-[11px] text-[#8a8a99] mt-1">Provisionado das vendas do período</p>
          </div>
          <div className="bg-gradient-to-br from-[#FF0074]/10 to-[#FF0074]/3 rounded-2xl p-5 border border-[#FF0074]/15">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-[#FF0074]" />
              <h4 className="text-white text-[13px]" style={{ fontWeight: 500 }}>Total de Campanhas</h4>
            </div>
            <div className="flex items-end gap-4 mt-3">
              <div>
                <p className="text-[28px] text-white" style={{ fontWeight: 600 }}>{campaignRanking.length}</p>
                <p className="text-[10px] text-[#8a8a99]">no periodo</p>
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8a8a99]">Ativas</span>
                  <span className="text-[#22c55e]" style={{ fontWeight: 500 }}>{campaignRanking.filter(c => c.status === "Ativa").length}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8a8a99]">Pausadas</span>
                  <span className="text-[#f59e0b]" style={{ fontWeight: 500 }}>{campaignRanking.filter(c => c.status === "Pausada").length}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8a8a99]">Concluídas</span>
                  <span className="text-[#3b82f6]" style={{ fontWeight: 500 }}>{campaignRanking.filter(c => c.status === "Concluída").length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}