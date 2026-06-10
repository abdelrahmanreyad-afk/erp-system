"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShoppingCart, RotateCcw,
  Package, ArrowUpRight, ArrowDownRight, Target,
} from "lucide-react";
import {
  Order, Variant, Location, Agent, Pricelist, Stock, TargetDoc,
  TX_COLORS, fmt, getMonth, getMonthLabel, getCurrentMonth,
} from "../page";

// ── Shared UI ──
function KPICard({ title, value, sub, sub2, icon: Icon, color, trend }: {
  title: string; value: string; sub?: string; sub2?: string;
  icon: any; color: string; trend?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {sub2 && <p className="text-xs text-muted-foreground">{sub2}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(trend).toFixed(1)}% vs last month
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
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

// ── Props ──
type Props = {
  orders: Order[]; filteredOrders: Order[]; variants: Variant[];
  locations: Location[]; agents: Agent[]; pricelists: Pricelist[];
  stocks: Stock[]; targets: TargetDoc[]; filterMonth: string;
  filterLocation: string; filterAgent: string;
  filterDateFrom: string; filterDateTo: string;
};

export default function SalesTab({ orders, filteredOrders, variants, locations, agents, pricelists, stocks, targets, filterMonth, filterLocation, filterAgent, filterDateFrom, filterDateTo }: Props) {

  const sales = useMemo(() => filteredOrders.filter(o => !o.transaction_type || o.transaction_type === "sale"), [filteredOrders]);
  const refunds = useMemo(() => filteredOrders.filter(o => o.transaction_type === "refund"), [filteredOrders]);
  const replacements = useMemo(() => filteredOrders.filter(o => o.transaction_type === "replacement"), [filteredOrders]);
  const zerocosts = useMemo(() => filteredOrders.filter(o => o.transaction_type === "zerocost" || o.transaction_type === "ceo_request"), [filteredOrders]);

  const totalRevenue = useMemo(() => sales.reduce((s, o) => s + (o.net_amount || 0), 0), [sales]);
  const totalRefundAmt = useMemo(() => refunds.reduce((s, o) => s + Math.abs(o.net_amount || 0), 0), [refunds]);
  const totalDiscount = useMemo(() => sales.reduce((s, o) => s + (o.total_discount || 0), 0), [sales]);
  const totalUnits = useMemo(() => sales.reduce((s, o) => s + (o.products || []).reduce((ss: number, p: any) => ss + (p.quantity || 0), 0), 0), [sales]);
  const aov = sales.length ? totalRevenue / sales.length : 0;
  const upt = sales.length ? totalUnits / sales.length : 0;
  const refundRate = sales.length ? (refunds.length / sales.length) * 100 : 0;

  // Growth rate
  const currentMonth = getCurrentMonth();
  const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = getMonth(lastMonthDate.toISOString().split("T")[0]);
  const currentRevenue = orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale") && o.date?.startsWith(currentMonth)).reduce((s, o) => s + (o.net_amount || 0), 0);
  const lastRevenue = orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale") && o.date?.startsWith(lastMonth)).reduce((s, o) => s + (o.net_amount || 0), 0);
  const growthRate = lastRevenue ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

  // Target card
  const currentMonthTargets = useMemo(() => {
    const monthKey = filterMonth || currentMonth;
    const branchTargets = targets.filter(t => t.month === monthKey && t.target_type === "branch");
    const agentTargets = targets.filter(t => t.month === monthKey && t.target_type === "agent");
    const totalTarget = locations.reduce((sum, loc) => {
      const bt = branchTargets.find(t => t.location_id === loc.id);
      if (bt) return sum + bt.amount;
      return sum + agentTargets.filter(t => t.location_id === loc.id).reduce((s, t) => s + t.amount, 0);
    }, 0);
    const monthRevenue = orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale") && o.date?.startsWith(monthKey)
      && (!filterLocation || o.location_id === filterLocation)
      && (!filterAgent || o.sales_person_id === filterAgent)
    ).reduce((s, o) => s + (o.net_amount || 0), 0);
    const pct = totalTarget > 0 ? Math.round((monthRevenue / totalTarget) * 100) : null;
    return { total: totalTarget, achieved: monthRevenue, pct };
  }, [targets, orders, locations, filterMonth, filterLocation, filterAgent, currentMonth]);

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
    for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); map[d.toISOString().split("T")[0]] = 0; }
    sales.forEach(o => { if (map[o.date] !== undefined) map[o.date] += o.net_amount || 0; });
    return Object.entries(map).map(([date, revenue]) => ({ day: date.slice(5), revenue }));
  }, [sales]);

  // Revenue by day of week
  const revenueByDow = useMemo(() => {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const map: Record<number, { revenue: number; orders: number }> = {};
    days.forEach((_, i) => { map[i] = { revenue: 0, orders: 0 }; });
    sales.forEach(o => { const d = new Date(o.date).getDay(); map[d].revenue += o.net_amount || 0; map[d].orders++; });
    return days.map((day, i) => ({ day, ...map[i] }));
  }, [sales]);

  // Branch performance
  const branchPerf = useMemo(() => {
    const monthKey = filterMonth || currentMonth;
    const map: Record<string, { revenue: number; orders: number; refunds: number }> = {};
    sales.forEach(o => { if (!map[o.location_id]) map[o.location_id] = { revenue: 0, orders: 0, refunds: 0 }; map[o.location_id].revenue += o.net_amount || 0; map[o.location_id].orders++; });
    refunds.forEach(o => { if (!map[o.location_id]) map[o.location_id] = { revenue: 0, orders: 0, refunds: 0 }; map[o.location_id].refunds++; });
    const totalRev = Object.values(map).reduce((s, v) => s + v.revenue, 0);
    return Object.entries(map).map(([locId, d]) => {
      const bt = targets.find(t => t.location_id === locId && t.month === monthKey && t.target_type === "branch");
      const agentSum = targets.filter(t => t.location_id === locId && t.month === monthKey && t.target_type === "agent").reduce((s, t) => s + t.amount, 0);
      const target = bt?.amount || agentSum || 0;
      const pct = target > 0 ? Math.round((d.revenue / target) * 100) : null;
      return { name: locations.find(l => l.id === locId)?.name || locId, ...d, weight: totalRev ? Math.round((d.revenue / totalRev) * 100) : 0, target, pct };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [sales, refunds, locations, targets, filterMonth, currentMonth]);

  // Revenue heatmap (branch × month)
  const heatmapData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    return locations.slice(0, 8).map(loc => {
      const row: any = { branch: loc.name.slice(0, 12) };
      months.forEach(m => {
        row[getMonthLabel(m)] = sales.filter(o => o.location_id === loc.id && o.date.startsWith(m)).reduce((s, o) => s + (o.net_amount || 0), 0);
      });
      return row;
    });
  }, [sales, locations]);

  const heatmapMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(getMonthLabel(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`));
    }
    return months;
  }, []);

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
      const varId = Object.entries(variants.reduce((m: any, v) => { m[v.name] = v.id; return m; }, {})).find(([n]) => n === p.name)?.[1];
      const stock = stocks.filter(s => s.variant_id === varId).reduce((sum, s) => sum + (s.quantity || 0), 0);
      const dailyRate = p.sold / days;
      const daysLeft = dailyRate > 0 ? Math.round(stock / dailyRate) : null;
      return { ...p, dailyRate: Math.round(dailyRate * 10) / 10, stock, daysLeft, alert: daysLeft !== null && daysLeft < 30 };
    });
  }, [topProducts, stocks, variants, filterDateFrom, filterDateTo]);

  // Basket size distribution
  const basketDist = useMemo(() => {
    const map: Record<string, number> = { "1 item": 0, "2 items": 0, "3 items": 0, "4+ items": 0 };
    sales.forEach(o => {
      const count = (o.products || []).reduce((s: number, p: any) => s + (p.quantity || 0), 0);
      if (count === 1) map["1 item"]++;
      else if (count === 2) map["2 items"]++;
      else if (count === 3) map["3 items"]++;
      else map["4+ items"]++;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sales]);

  // Pricelist performance
  const pricelistPerf = useMemo(() => {
    const map: Record<string, { revenue: number; orders: number }> = {};
    sales.forEach(o => {
      if (!map[o.pricelist_id]) map[o.pricelist_id] = { revenue: 0, orders: 0 };
      map[o.pricelist_id].revenue += o.net_amount || 0;
      map[o.pricelist_id].orders++;
    });
    return Object.entries(map).map(([id, d]) => ({
      name: pricelists.find(p => p.id === id)?.name || id, ...d,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [sales, pricelists]);

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

  const maxHeat = useMemo(() => Math.max(...heatmapData.flatMap(r => heatmapMonths.map(m => r[m] || 0)), 1), [heatmapData, heatmapMonths]);

  return (
    <div className="space-y-8">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Revenue" value={fmt(totalRevenue)} icon={TrendingUp}
          color="bg-blue-500/15 text-blue-500" trend={growthRate} sub={`${sales.length} orders`} />

        {/* Target Card */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Target</p>
                <p className="text-2xl font-bold mt-1">{currentMonthTargets.pct !== null ? `${currentMonthTargets.pct}%` : "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmt(currentMonthTargets.achieved)} / {fmt(currentMonthTargets.total)}</p>
                {currentMonthTargets.pct !== null && (
                  <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${currentMonthTargets.pct >= 100 ? "bg-green-500" : currentMonthTargets.pct >= 75 ? "bg-blue-500" : currentMonthTargets.pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, currentMonthTargets.pct)}%` }} />
                  </div>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500 shrink-0"><Target className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        <KPICard title="AOV" value={fmt(aov)} icon={ShoppingCart} color="bg-green-500/15 text-green-500" sub="Avg Order Value" />
        <KPICard title="UPT" value={upt.toFixed(2)} icon={Package} color="bg-orange-500/15 text-orange-500" sub="Units Per Transaction" />
        <KPICard title="Growth Rate" value={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`}
          icon={growthRate >= 0 ? ArrowUpRight : ArrowDownRight}
          color={growthRate >= 0 ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"} sub="vs last month" />
        <KPICard title="Refunds" value={fmt(totalRefundAmt)} icon={RotateCcw} color="bg-red-500/15 text-red-500"
          sub={`${refunds.length} orders · ${refundRate.toFixed(1)}% rate`} />
        <KPICard title="Discounts" value={fmt(totalDiscount)} icon={TrendingDown} color="bg-yellow-500/15 text-yellow-500"
          sub={sales.length ? `avg ${fmt(totalDiscount / sales.length)} / order` : undefined} />
        <KPICard title="Total Orders" value={filteredOrders.length.toString()} icon={ShoppingCart}
          color="bg-muted text-muted-foreground" sub={`${sales.length} sales · ${refunds.length} refunds`} />
      </div>

      {/* Revenue Over Time */}
      <div>
        <SectionTitle title="Revenue Over Time" sub="Monthly sales vs refunds" />
        <Card><CardContent className="pt-4">
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
        </CardContent></Card>
      </div>

      {/* Daily + Day of Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle title="Daily Revenue" sub="Last 30 days" />
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyRevenue}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
        <div>
          <SectionTitle title="Revenue by Day of Week" sub="Best selling days" />
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={revenueByDow}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#a855f7" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
      </div>

      {/* Revenue Heatmap */}
      <div>
        <SectionTitle title="Revenue Heatmap" sub="Branch × Month" />
        <Card><CardContent className="pt-4 overflow-auto">
          <table className="w-full text-xs" style={{ minWidth: 500 }}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Branch</th>
                {heatmapMonths.map(m => <th key={m} className="py-2 px-2 text-muted-foreground font-medium text-center">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">{row.branch}</td>
                  {heatmapMonths.map(m => {
                    const val = row[m] || 0;
                    const opacity = val > 0 ? 0.15 + (val / maxHeat) * 0.75 : 0;
                    return (
                      <td key={m} className="py-2 px-2 text-center rounded" style={{ background: `rgba(59,130,246,${opacity})` }}>
                        {val > 0 ? fmt(val) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>

      {/* Branch Performance */}
      <div>
        <SectionTitle title="Branch Performance" sub="Revenue, weight and target %" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={Math.max(200, branchPerf.length * 40)}>
              <BarChart data={branchPerf} layout="vertical">
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
          <Card><CardContent className="pt-4 overflow-auto">
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
                        </div>{b.weight}%
                      </div>
                    </td>
                    <td className="py-2 text-right text-xs">
                      {b.pct !== null ? <span className={`font-medium ${b.pct >= 100 ? "text-green-500" : b.pct >= 75 ? "text-blue-500" : b.pct >= 50 ? "text-yellow-500" : "text-red-500"}`}>{b.pct}%</span> : "—"}
                    </td>
                    <td className="py-2 text-right text-xs text-red-500">{b.refunds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </div>
      </div>

      {/* Agent Performance */}
      <div>
        <SectionTitle title="Agent Performance" sub="Revenue, AOV, UPT — Top 10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agentPerf} layout="vertical">
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
          <Card><CardContent className="pt-4 overflow-auto">
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
          </CardContent></Card>
        </div>
      </div>

      {/* TX Breakdown + Payment + Basket + Pricelist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle title="Transaction Breakdown" />
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={txBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {txBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
        <div>
          <SectionTitle title="Payment Methods" sub="Revenue distribution" />
          <Card><CardContent className="pt-5 space-y-3">
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
          </CardContent></Card>
        </div>
        <div>
          <SectionTitle title="Basket Size Distribution" sub="Units per order" />
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={basketDist}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Orders" fill="#f97316" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
        <div>
          <SectionTitle title="Pricelist Performance" sub="Revenue per pricelist" />
          <Card><CardContent className="pt-4 space-y-3">
            {pricelistPerf.map((p, i) => {
              const total = pricelistPerf.reduce((s, x) => s + x.revenue, 0);
              const pct = total ? Math.round((p.revenue / total) * 100) : 0;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{fmt(p.revenue)} · {p.orders} orders</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent></Card>
        </div>
      </div>

      {/* Top Products + Run Rate */}
      <div>
        <SectionTitle title="Top Products & Run Rate" sub="Best sellers with stock burn rate" />
        <Card><CardContent className="pt-4 overflow-auto">
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
                      <span className={r.daysLeft < 7 ? "text-red-500 font-bold" : r.daysLeft < 30 ? "text-yellow-500 font-medium" : "text-green-500"}>{r.daysLeft}d</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>

    </div>
  );
}