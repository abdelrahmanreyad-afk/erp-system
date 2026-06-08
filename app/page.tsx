"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, RotateCcw, Loader2,
  AlertTriangle, Package, MapPin, ArrowUpRight, ArrowDownRight,
  Target, X, Filter, ChevronDown,
} from "lucide-react";

// ── Types ──
type Order = {
  id: string; order_id: string; date: string; transaction_type?: string;
  type?: string; location_id: string; sales_person_id: string;
  pricelist_id: string; net_amount: number; products?: any[];
  new_products?: any[]; payments?: any[]; order_discount?: number;
  total_discount?: number; createdAt: any; condition?: string;
  difference?: number; old_product?: any;
};
type Variant = { id: string; name: string; productId?: string };
type Location = { id: string; name: string; type?: string };
type Agent = { id: string; name: string; role: string };
type Pricelist = { id: string; name: string; isOriginal?: boolean };
type Stock = { id: string; variant_id: string; location_id: string; quantity: number };
type TargetDoc = { id: string; location_id: string; agent_id?: string; month: string; amount: number; target_type: "branch" | "agent" };

const TX_COLORS: Record<string, string> = {
  sale: "#3b82f6", refund: "#ef4444", replacement: "#f97316",
  zerocost: "#22c55e", ceo_request: "#a855f7",
};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function getMonth(dateStr: string) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function getMonthLabel(m: string) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${MONTHS[parseInt(mo)-1]} ${y?.slice(2)}`;
}
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}

// ── KPI Card ──
function KPICard({ title, value, sub, sub2, icon: Icon, color, trend, small }: {
  title: string; value: string; sub?: string; sub2?: string;
  icon: any; color: string; trend?: number; small?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{title}</p>
            <p className={`font-bold mt-1 ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {sub2 && <p className="text-xs text-muted-foreground">{sub2}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}% vs last month
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

// ── Filter Pill ──
function FilterPill({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-xs font-medium text-primary">
      <span>{label}: {value}</span>
      <button onClick={onClear} className="hover:opacity-70"><X className="h-3 w-3" /></button>
    </div>
  );
}

// ══════════════════════════════════════════
export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [targets, setTargets] = useState<TargetDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterPricelist, setFilterPricelist] = useState("");
  const [filterTxType, setFilterTxType] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function load() {
      const [oSnap, vSnap, lSnap, aSnap, plSnap, sSnap, tSnap] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(collection(db, "variants")),
        getDocs(collection(db, "locations")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "pricelists")),
        getDocs(collection(db, "stock")),
        getDocs(collection(db, "targets")),
      ]);
      setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setVariants(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Variant)));
      setLocations(lSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location))
        .filter(l => l.type === "branch" || l.type === "branch_warehouse")
        .sort((a, b) => a.name.localeCompare(b.name)));
      setAgents(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agent)));
      setPricelists(plSnap.docs.map(d => ({ id: d.id, ...d.data() } as Pricelist)));
      setStocks(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Stock)));
      setTargets(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as TargetDoc)));
      setLoading(false);
    }
    load();
  }, []);

  // ── Apply Filters ──
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.type !== "done") return false;
      if (filterDateFrom && o.date < filterDateFrom) return false;
      if (filterDateTo && o.date > filterDateTo) return false;
      if (filterLocation && o.location_id !== filterLocation) return false;
      if (filterAgent && o.sales_person_id !== filterAgent) return false;
      if (filterPricelist && o.pricelist_id !== filterPricelist) return false;
      if (filterTxType && (o.transaction_type || "sale") !== filterTxType) return false;
      if (filterMonth && !o.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [orders, filterDateFrom, filterDateTo, filterLocation, filterAgent, filterPricelist, filterTxType, filterMonth]);

  const sales = useMemo(() => filteredOrders.filter(o => !o.transaction_type || o.transaction_type === "sale"), [filteredOrders]);
  const refunds = useMemo(() => filteredOrders.filter(o => o.transaction_type === "refund"), [filteredOrders]);
  const replacements = useMemo(() => filteredOrders.filter(o => o.transaction_type === "replacement"), [filteredOrders]);
  const zerocosts = useMemo(() => filteredOrders.filter(o => o.transaction_type === "zerocost" || o.transaction_type === "ceo_request"), [filteredOrders]);

  // ── KPI Calculations ──
  const totalRevenue = useMemo(() => sales.reduce((s, o) => s + (o.net_amount || 0), 0), [sales]);
  const totalRefundAmt = useMemo(() => refunds.reduce((s, o) => s + Math.abs(o.net_amount || 0), 0), [refunds]);
  const totalDiscount = useMemo(() => sales.reduce((s, o) => s + (o.total_discount || 0), 0), [sales]);
  const totalUnits = useMemo(() => sales.reduce((s, o) => s + (o.products || []).reduce((ss: number, p: any) => ss + (p.quantity || 0), 0), 0), [sales]);
  const aov = sales.length ? totalRevenue / sales.length : 0;
  const upt = sales.length ? totalUnits / sales.length : 0;
  const refundRate = sales.length ? (refunds.length / sales.length) * 100 : 0;

  // Growth Rate (current month vs last month)
  const currentMonth = getCurrentMonth();
  const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = getMonth(lastMonthDate.toISOString().split("T")[0]);
  const currentRevenue = orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale") && o.date?.startsWith(currentMonth)).reduce((s, o) => s + (o.net_amount || 0), 0);
  const lastRevenue = orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale") && o.date?.startsWith(lastMonth)).reduce((s, o) => s + (o.net_amount || 0), 0);
  const growthRate = lastRevenue ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

  // Target for current month (branch totals)
  const currentMonthTargets = useMemo(() => {
    const monthKey = filterMonth || currentMonth;
    const branchTargets = targets.filter(t => t.month === monthKey && t.target_type === "branch");
    const agentTargets = targets.filter(t => t.month === monthKey && t.target_type === "agent");
    // For branches with no branch target, sum agent targets
    const totalTarget = locations.reduce((sum, loc) => {
      const bt = branchTargets.find(t => t.location_id === loc.id);
      if (bt) return sum + bt.amount;
      const agentSum = agentTargets.filter(t => t.location_id === loc.id).reduce((s, t) => s + t.amount, 0);
      return sum + agentSum;
    }, 0);
    const monthRevenue = orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale") && o.date?.startsWith(monthKey)
      && (!filterLocation || o.location_id === filterLocation)
      && (!filterAgent || o.sales_person_id === filterAgent)
    ).reduce((s, o) => s + (o.net_amount || 0), 0);
    const pct = totalTarget > 0 ? Math.round((monthRevenue / totalTarget) * 100) : null;
    return { total: totalTarget, achieved: monthRevenue, pct };
  }, [targets, orders, locations, filterMonth, filterLocation, filterAgent, currentMonth]);

  // ── Charts Data ──
  // Revenue by month
  const revenueByMonth = useMemo(() => {
    const map: Record<string, { revenue: number; refund: number }> = {};
    sales.forEach(o => { const m = getMonth(o.date); if (m) { if (!map[m]) map[m] = { revenue: 0, refund: 0 }; map[m].revenue += o.net_amount || 0; } });
    refunds.forEach(o => { const m = getMonth(o.date); if (m) { if (!map[m]) map[m] = { revenue: 0, refund: 0 }; map[m].refund += Math.abs(o.net_amount || 0); } });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([m, v]) => ({ month: getMonthLabel(m), ...v }));
  }, [sales, refunds]);

  // Daily last 30 days
  const dailyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      map[d.toISOString().split("T")[0]] = 0;
    }
    sales.forEach(o => { if (map[o.date] !== undefined) map[o.date] += o.net_amount || 0; });
    return Object.entries(map).map(([date, revenue]) => ({ day: date.slice(5), revenue }));
  }, [sales]);

  // Branch performance
  const branchPerf = useMemo(() => {
    const monthKey = filterMonth || currentMonth;
    const map: Record<string, { revenue: number; orders: number; refunds: number }> = {};
    sales.forEach(o => { if (!map[o.location_id]) map[o.location_id] = { revenue: 0, orders: 0, refunds: 0 }; map[o.location_id].revenue += o.net_amount || 0; map[o.location_id].orders++; });
    refunds.forEach(o => { if (!map[o.location_id]) map[o.location_id] = { revenue: 0, orders: 0, refunds: 0 }; map[o.location_id].refunds++; });
    const totalRev = Object.values(map).reduce((s, v) => s + v.revenue, 0);
    return Object.entries(map).map(([locId, d]) => {
      const locName = locations.find(l => l.id === locId)?.name || locId;
      const bt = targets.find(t => t.location_id === locId && t.month === monthKey && t.target_type === "branch");
      const agentSum = targets.filter(t => t.location_id === locId && t.month === monthKey && t.target_type === "agent").reduce((s, t) => s + t.amount, 0);
      const target = bt?.amount || agentSum || 0;
      const pct = target > 0 ? Math.round((d.revenue / target) * 100) : null;
      return { name: locName, ...d, weight: totalRev ? Math.round((d.revenue / totalRev) * 100) : 0, target, pct };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [sales, refunds, locations, targets, filterMonth, currentMonth]);

  // Agent performance
  const agentPerf = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number; units: number }> = {};
    sales.forEach(o => {
      if (!map[o.sales_person_id]) map[o.sales_person_id] = { revenue: 0, orders: 0, units: 0 };
      map[o.sales_person_id].revenue += o.net_amount || 0;
      map[o.sales_person_id].orders++;
      map[o.sales_person_id].units += (o.products || []).reduce((s: number, p: any) => s + (p.quantity || 0), 0);
    });
    return Object.entries(map).map(([id, d]) => ({
      name: agents.find(a => a.id === id)?.name || id, id, ...d,
      aov: d.orders ? d.revenue / d.orders : 0,
      upt: d.orders ? d.units / d.orders : 0,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales, agents]);

  // Top products
  const topProducts = useMemo(() => {
    const map: Record<string, { sold: number; refunded: number; revenue: number }> = {};
    sales.forEach(o => (o.products || []).forEach((p: any) => {
      if (!map[p.variant_id]) map[p.variant_id] = { sold: 0, refunded: 0, revenue: 0 };
      map[p.variant_id].sold += p.quantity || 0;
      map[p.variant_id].revenue += (p.final_price || 0) * (p.quantity || 0);
    }));
    refunds.forEach(o => (o.products || []).forEach((p: any) => {
      if (!map[p.variant_id]) map[p.variant_id] = { sold: 0, refunded: 0, revenue: 0 };
      map[p.variant_id].refunded += p.quantity || 0;
    }));
    return Object.entries(map).map(([varId, d]) => ({
      name: variants.find(v => v.id === varId)?.name || varId, ...d,
    })).sort((a, b) => b.sold - a.sold).slice(0, 10);
  }, [sales, refunds, variants]);

  // Run rate
  const runRate = useMemo(() => {
    const days = Math.max(1, (filterDateFrom && filterDateTo)
      ? Math.ceil((new Date(filterDateTo).getTime() - new Date(filterDateFrom).getTime()) / 86400000)
      : 90);
    return topProducts.map(p => {
      const dailyRate = p.sold / days;
      const stock = stocks.filter(s => s.variant_id !== undefined).reduce((sum, s) => {
        const v = variants.find(v => v.id === s.variant_id);
        return v?.name === p.name ? sum + (s.quantity || 0) : sum;
      }, 0);
      const daysLeft = dailyRate > 0 ? Math.round(stock / dailyRate) : null;
      return { ...p, dailyRate: Math.round(dailyRate * 10) / 10, stock, daysLeft, alert: daysLeft !== null && daysLeft < 30 };
    });
  }, [topProducts, stocks, variants, filterDateFrom, filterDateTo]);

  // TX Breakdown
  const txBreakdown = useMemo(() => [
    { name: "Sale", value: sales.length, color: TX_COLORS.sale },
    { name: "Refund", value: refunds.length, color: TX_COLORS.refund },
    { name: "Replacement", value: replacements.length, color: TX_COLORS.replacement },
    { name: "Zerocost/CEO", value: zerocosts.length, color: TX_COLORS.zerocost },
  ].filter(d => d.value > 0), [sales, refunds, replacements, zerocosts]);

  // Payment methods
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(o => (o.payments || []).forEach((p: any) => { map[p.method_id] = (map[p.method_id] || 0) + (p.amount || 0); }));
    return Object.entries(map).map(([id, amount]) => ({ name: id, amount })).sort((a, b) => b.amount - a.amount);
  }, [sales]);

  // Refund condition
  const refundCondition = useMemo(() => [
    { name: "Sealed", value: refunds.filter(o => o.condition === "sealed").length, color: "#22c55e" },
    { name: "Defect", value: refunds.filter(o => o.condition === "defect").length, color: "#ef4444" },
  ].filter(d => d.value > 0), [refunds]);

  // Discount per agent
  const discountAnalysis = useMemo(() => {
    const map: Record<string, { total: number; orders: number }> = {};
    sales.forEach(o => { if (!map[o.sales_person_id]) map[o.sales_person_id] = { total: 0, orders: 0 }; map[o.sales_person_id].total += o.total_discount || 0; map[o.sales_person_id].orders++; });
    return Object.entries(map).map(([id, d]) => ({
      name: agents.find(a => a.id === id)?.name || id,
      totalDiscount: d.total, avgDiscount: d.orders ? d.total / d.orders : 0,
    })).sort((a, b) => b.totalDiscount - a.totalDiscount).slice(0, 8);
  }, [sales, agents]);

  // Replacement diff
  const replacementDiff = useMemo(() => {
    const gains = replacements.filter(o => (o.difference || 0) > 0).reduce((s, o) => s + (o.difference || 0), 0);
    const losses = replacements.filter(o => (o.difference || 0) < 0).reduce((s, o) => s + Math.abs(o.difference || 0), 0);
    return { gains, losses, net: gains - losses };
  }, [replacements]);

  // Low stock
  const lowStock = useMemo(() =>
    stocks.filter(s => s.quantity <= 5 && s.quantity >= 0).map(s => ({
      variant: variants.find(v => v.id === s.variant_id)?.name || s.variant_id,
      location: locations.find(l => l.id === s.location_id)?.name || s.location_id,
      qty: s.quantity,
    })).sort((a, b) => a.qty - b.qty).slice(0, 10),
  [stocks, variants, locations]);

  const oldDrafts = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
    return orders.filter(o => { if (o.type !== "draft") return false; const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0); return d < cutoff; }).length;
  }, [orders]);

  // Active filters count
  const activeFilters = [filterDateFrom, filterDateTo, filterLocation, filterAgent, filterPricelist, filterTxType, filterMonth].filter(Boolean).length;

  function clearAllFilters() {
    setFilterDateFrom(""); setFilterDateTo(""); setFilterLocation("");
    setFilterAgent(""); setFilterPricelist(""); setFilterTxType(""); setFilterMonth("");
  }

  // Month options
  const monthOptions = useMemo(() => {
    const opts = [{ value: "", label: "All Months" }];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      opts.push({ value: val, label: getMonthLabel(val) });
    }
    return opts;
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 space-y-8">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comprehensive sales overview</p>
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters || activeFilters > 0 ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
          <Filter className="h-4 w-4" />
          Filters {activeFilters > 0 && <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">{activeFilters}</span>}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── FILTERS PANEL ── */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Date From */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date From</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            {/* Date To */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date To</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            {/* Month */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Month</label>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {/* Branch */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Branch</label>
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Branches</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {/* Agent */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Agent</label>
              <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Agents</option>
                {agents.sort((a,b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {/* Pricelist */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pricelist</label>
              <select value={filterPricelist} onChange={e => setFilterPricelist(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Pricelists</option>
                {pricelists.map(p => <option key={p.id} value={p.id}>{p.name}{p.isOriginal ? " (Original)" : ""}</option>)}
              </select>
            </div>
            {/* Transaction Type */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Transaction Type</label>
              <select value={filterTxType} onChange={e => setFilterTxType(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Types</option>
                <option value="sale">Sale</option>
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
                <option value="zerocost">Zerocost</option>
                <option value="ceo_request">CEO Request</option>
              </select>
            </div>
            {/* Clear */}
            <div className="flex items-end">
              <button onClick={clearAllFilters}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Clear All
              </button>
            </div>
          </div>
          {/* Active Filter Pills */}
          {activeFilters > 0 && (
            <div className="flex flex-wrap gap-2">
              {filterDateFrom && <FilterPill label="From" value={filterDateFrom} onClear={() => setFilterDateFrom("")} />}
              {filterDateTo && <FilterPill label="To" value={filterDateTo} onClear={() => setFilterDateTo("")} />}
              {filterMonth && <FilterPill label="Month" value={getMonthLabel(filterMonth)} onClear={() => setFilterMonth("")} />}
              {filterLocation && <FilterPill label="Branch" value={locations.find(l => l.id === filterLocation)?.name || filterLocation} onClear={() => setFilterLocation("")} />}
              {filterAgent && <FilterPill label="Agent" value={agents.find(a => a.id === filterAgent)?.name || filterAgent} onClear={() => setFilterAgent("")} />}
              {filterPricelist && <FilterPill label="Pricelist" value={pricelists.find(p => p.id === filterPricelist)?.name || filterPricelist} onClear={() => setFilterPricelist("")} />}
              {filterTxType && <FilterPill label="Type" value={filterTxType} onClear={() => setFilterTxType("")} />}
            </div>
          )}
        </div>
      )}

      {/* ── ALERTS ── */}
      {(oldDrafts > 0 || lowStock.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {oldDrafts > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {oldDrafts} draft order{oldDrafts > 1 ? "s" : ""} pending +3 days
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
              <Package className="h-4 w-4 shrink-0" />
              {lowStock.length} product{lowStock.length > 1 ? "s" : ""} low stock (≤5 units)
            </div>
          )}
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Revenue */}
        <KPICard title="Revenue" value={fmt(totalRevenue)} icon={TrendingUp}
          color="bg-blue-500/15 text-blue-500" trend={growthRate}
          sub={`${sales.length} orders`} />

        {/* Target */}
        <Card className="relative overflow-hidden">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Target</p>
                <p className="text-2xl font-bold mt-1">
                  {currentMonthTargets.pct !== null ? `${currentMonthTargets.pct}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmt(currentMonthTargets.achieved)} / {fmt(currentMonthTargets.total)}</p>
                {currentMonthTargets.pct !== null && (
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${currentMonthTargets.pct >= 100 ? "bg-green-500" : currentMonthTargets.pct >= 75 ? "bg-blue-500" : currentMonthTargets.pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, currentMonthTargets.pct)}%` }} />
                  </div>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500 shrink-0">
                <Target className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AOV */}
        <KPICard title="AOV" value={fmt(aov)} icon={ShoppingCart}
          color="bg-green-500/15 text-green-500"
          sub="Avg Order Value" />

        {/* UPT */}
        <KPICard title="UPT" value={upt.toFixed(2)} icon={Package}
          color="bg-orange-500/15 text-orange-500"
          sub="Units Per Transaction" />

        {/* Growth Rate */}
        <KPICard title="Growth Rate" value={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`}
          icon={growthRate >= 0 ? ArrowUpRight : ArrowDownRight}
          color={growthRate >= 0 ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}
          sub="vs last month" />

        {/* Refunds */}
        <KPICard title="Refunds" value={fmt(totalRefundAmt)} icon={RotateCcw}
          color="bg-red-500/15 text-red-500"
          sub={`${refunds.length} orders · ${refundRate.toFixed(1)}% rate`} />

        {/* Discounts */}
        <KPICard title="Discounts" value={fmt(totalDiscount)} icon={TrendingDown}
          color="bg-yellow-500/15 text-yellow-500"
          sub={sales.length ? `avg ${fmt(totalDiscount / sales.length)} / order` : undefined} />

        {/* Total Orders */}
        <KPICard title="Total Orders" value={filteredOrders.length.toString()} icon={ShoppingCart}
          color="bg-muted text-muted-foreground"
          sub={`${sales.length} sales · ${refunds.length} refunds`} />
      </div>

      {/* ── REVENUE OVER TIME ── */}
      <div>
        <SectionTitle title="Revenue Over Time" sub="Monthly sales vs refunds" />
        <Card>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="refund" name="Refunds" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── DAILY REVENUE ── */}
      <div>
        <SectionTitle title="Daily Revenue" sub="Last 30 days" />
        <Card>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyRevenue}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── BRANCH PERFORMANCE ── */}
      <div>
        <SectionTitle title="Branch Performance" sub="Revenue, weight and target achievement" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={Math.max(200, branchPerf.length * 40)}>
                <BarChart data={branchPerf} layout="vertical">
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 overflow-auto">
              <table className="w-full text-sm" style={{ minWidth: 380 }}>
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2">Branch</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Weight</th>
                    <th className="text-right py-2">Target</th>
                    <th className="text-right py-2">Refunds</th>
                  </tr>
                </thead>
                <tbody>
                  {branchPerf.map((b, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 text-xs font-medium truncate max-w-[120px]">{b.name}</td>
                      <td className="py-2 text-right text-xs">{fmt(b.revenue)}</td>
                      <td className="py-2 text-right text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 bg-muted rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${b.weight}%` }} />
                          </div>
                          {b.weight}%
                        </div>
                      </td>
                      <td className="py-2 text-right text-xs">
                        {b.pct !== null ? (
                          <span className={`font-medium ${b.pct >= 100 ? "text-green-500" : b.pct >= 75 ? "text-blue-500" : b.pct >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                            {b.pct}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2 text-right text-xs text-red-500">{b.refunds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── AGENT PERFORMANCE ── */}
      <div>
        <SectionTitle title="Agent Performance" sub="Top 10 agents — Revenue, AOV, UPT" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={agentPerf} layout="vertical">
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 overflow-auto">
              <table className="w-full text-sm" style={{ minWidth: 360 }}>
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Agent</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">AOV</th>
                    <th className="text-right py-2">UPT</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerf.map((a, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 text-xs text-muted-foreground">{i+1}</td>
                      <td className="py-2 text-xs font-medium truncate max-w-[120px]">{a.name}</td>
                      <td className="py-2 text-right text-xs">{fmt(a.revenue)}</td>
                      <td className="py-2 text-right text-xs">{fmt(a.aov)}</td>
                      <td className="py-2 text-right text-xs">{a.upt.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── TX BREAKDOWN + PAYMENT METHODS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle title="Transaction Breakdown" />
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={txBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {txBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <div>
          <SectionTitle title="Payment Methods" sub="Revenue distribution" />
          <Card>
            <CardContent className="pt-5 space-y-3">
              {paymentBreakdown.slice(0, 6).map((p, i) => {
                const total = paymentBreakdown.reduce((s, x) => s + x.amount, 0);
                const pct = total ? Math.round((p.amount / total) * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">{fmt(p.amount)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── TOP PRODUCTS + RUN RATE ── */}
      <div>
        <SectionTitle title="Top Products & Run Rate" sub="Best sellers with stock burn rate" />
        <Card>
          <CardContent className="pt-4 overflow-auto">
            <table className="w-full text-sm" style={{ minWidth: 600 }}>
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Sold</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Refunded</th>
                  <th className="text-right py-2">Daily Rate</th>
                  <th className="text-right py-2">Stock</th>
                  <th className="text-right py-2">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {runRate.map((r, i) => (
                  <tr key={i} className={`border-b border-border/40 hover:bg-muted/20 ${r.alert ? "bg-red-500/5" : ""}`}>
                    <td className="py-2 text-xs font-medium max-w-[200px] truncate">{r.name}</td>
                    <td className="py-2 text-right text-xs">{r.sold}</td>
                    <td className="py-2 text-right text-xs">{fmt(r.revenue)}</td>
                    <td className="py-2 text-right text-xs text-red-500">{r.refunded || 0}</td>
                    <td className="py-2 text-right text-xs">{r.dailyRate}/day</td>
                    <td className="py-2 text-right text-xs">{r.stock}</td>
                    <td className="py-2 text-right text-xs">
                      {r.daysLeft === null ? "—" : (
                        <span className={r.daysLeft < 7 ? "text-red-500 font-bold" : r.daysLeft < 30 ? "text-yellow-500 font-medium" : "text-green-500"}>
                          {r.daysLeft}d
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ── REFUND ANALYSIS ── */}
      <div>
        <SectionTitle title="Refund Analysis" sub="Condition breakdown and most returned products" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Sealed vs Defect</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={refundCondition} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                    {refundCondition.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardContent className="pt-4 overflow-auto">
              <p className="text-xs font-medium text-muted-foreground mb-3">Most Returned Products</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2">Product</th>
                    <th className="text-right py-2">Refunded</th>
                    <th className="text-right py-2">Sold</th>
                    <th className="text-right py-2">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.filter(p => p.refunded > 0).sort((a,b) => b.refunded - a.refunded).slice(0,6).map((p, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 text-xs font-medium truncate max-w-[180px]">{p.name}</td>
                      <td className="py-2 text-right text-xs text-red-500">{p.refunded}</td>
                      <td className="py-2 text-right text-xs">{p.sold}</td>
                      <td className="py-2 text-right text-xs">{p.sold ? `${Math.round((p.refunded/p.sold)*100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── REPLACEMENT + DISCOUNT ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle title="Replacement Impact" />
          <div className="space-y-3">
            {[
              { label: "Customer Paid Extra", value: replacementDiff.gains, color: "text-green-500" },
              { label: "We Refunded Extra", value: replacementDiff.losses, color: "text-red-500" },
              { label: "Net", value: replacementDiff.net, color: replacementDiff.net >= 0 ? "text-green-500" : "text-red-500" },
            ].map((item, i) => (
              <Card key={i}>
                <CardContent className="py-3 flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.value >= 0 ? "" : "-"}{fmt(Math.abs(item.value))}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle title="Discount Analysis" sub="Top discount givers" />
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={discountAnalysis} layout="vertical">
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="totalDiscount" name="Total Discount" fill="#f97316" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── LOW STOCK ── */}
      {lowStock.length > 0 && (
        <div>
          <SectionTitle title="Low Stock Alert" sub="Products with ≤5 units" />
          <Card>
            <CardContent className="pt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2">Product</th>
                    <th className="text-left py-2">Branch</th>
                    <th className="text-right py-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((s, i) => (
                    <tr key={i} className={`border-b border-border/40 ${s.qty === 0 ? "bg-red-500/5" : ""}`}>
                      <td className="py-2 text-xs font-medium">{s.variant}</td>
                      <td className="py-2 text-xs text-muted-foreground">{s.location}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-bold ${s.qty === 0 ? "text-red-500" : "text-yellow-500"}`}>{s.qty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}