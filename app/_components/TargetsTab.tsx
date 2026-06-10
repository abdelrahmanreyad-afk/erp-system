"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { MapPin, Users, Target, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Order, Location, Agent, TargetDoc,
  fmt, getMonth, getMonthLabel, getCurrentMonth, MONTHS,
} from "../page";

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

type Props = {
  orders: Order[]; filteredOrders: Order[];
  locations: Location[]; agents: Agent[]; targets: TargetDoc[];
  filterMonth: string; filterLocation: string; filterAgent: string;
};

export default function TargetsTab({ orders, filteredOrders, locations, agents, targets, filterMonth, filterLocation, filterAgent }: Props) {

  const currentMonth = getCurrentMonth();
  const monthKey = filterMonth || currentMonth;

  const sales = useMemo(() => orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale")), [orders]);

  // Helper: get revenue for a location/agent in a month
  const getRevenue = (locId: string, agentId: string | null, month: string) =>
    sales.filter(o =>
      o.location_id === locId &&
      (!agentId || o.sales_person_id === agentId) &&
      o.date.startsWith(month)
    ).reduce((s, o) => s + (o.net_amount || 0), 0);

  // Branch targets for current month
  const branchTargets = useMemo(() => {
    const bts = targets.filter(t => t.month === monthKey && t.target_type === "branch");
    const ats = targets.filter(t => t.month === monthKey && t.target_type === "agent");
    return locations.map(loc => {
      const bt = bts.find(t => t.location_id === loc.id);
      const agentSum = ats.filter(t => t.location_id === loc.id).reduce((s, t) => s + t.amount, 0);
      const target = bt?.amount || agentSum || 0;
      const achieved = getRevenue(loc.id, null, monthKey);
      const pct = target > 0 ? Math.round((achieved / target) * 100) : null;
      const remaining = target > achieved ? target - achieved : 0;
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const daysLeft = daysInMonth - daysPassed;
      const dailyNeeded = daysLeft > 0 && remaining > 0 ? Math.round(remaining / daysLeft) : 0;
      return { loc, target, achieved, pct, remaining, dailyNeeded, daysLeft };
    }).filter(b => b.target > 0 || b.achieved > 0);
  }, [targets, locations, monthKey, sales]);

  // KPI summary
  const totalTarget = branchTargets.reduce((s, b) => s + b.target, 0);
  const totalAchieved = branchTargets.reduce((s, b) => s + b.achieved, 0);
  const totalPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const branchesOnTarget = branchTargets.filter(b => b.pct !== null && b.pct >= 100).length;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysLeft = daysInMonth - daysPassed;
  const totalRemaining = totalTarget - totalAchieved;
  const dailyNeeded = daysLeft > 0 && totalRemaining > 0 ? Math.round(totalRemaining / daysLeft) : 0;

  // Target vs Achieved — last 6 months
  const targetHistory = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    return months.map(m => {
      const bts = targets.filter(t => t.month === m && t.target_type === "branch");
      const ats = targets.filter(t => t.month === m && t.target_type === "agent");
      const target = locations.reduce((sum, loc) => {
        const bt = bts.find(t => t.location_id === loc.id);
        if (bt) return sum + bt.amount;
        return sum + ats.filter(t => t.location_id === loc.id).reduce((s, t) => s + t.amount, 0);
      }, 0);
      const achieved = sales.filter(o => o.date.startsWith(m)).reduce((s, o) => s + (o.net_amount || 0), 0);
      return { month: getMonthLabel(m), target, achieved };
    });
  }, [targets, locations, sales]);

  // Agent targets
  const agentTargets = useMemo(() => {
    const ats = targets.filter(t => t.month === monthKey && t.target_type === "agent");
    return ats.map(t => {
      const agent = agents.find(a => a.id === t.agent_id);
      const loc = locations.find(l => l.id === t.location_id);
      const achieved = getRevenue(t.location_id, t.agent_id || null, monthKey);
      const pct = t.amount > 0 ? Math.round((achieved / t.amount) * 100) : null;
      return { agent, loc, target: t.amount, achieved, pct };
    }).sort((a, b) => (b.pct || 0) - (a.pct || 0));
  }, [targets, agents, locations, monthKey, sales]);

  // Burn rate: how much % of target achieved per day
  const burnRate = useMemo(() => {
    const days: { day: string; cumRevenue: number; targetLine: number }[] = [];
    if (totalTarget === 0) return days;
    const dailyTarget = totalTarget / daysInMonth;
    const now2 = new Date();
    for (let i = 1; i <= daysPassed; i++) {
      const d = new Date(now2.getFullYear(), now2.getMonth(), i);
      const dateStr = d.toISOString().split("T")[0];
      const dayRev = sales.filter(o => o.date === dateStr).reduce((s, o) => s + (o.net_amount || 0), 0);
      const prev = days[days.length - 1]?.cumRevenue || 0;
      days.push({ day: String(i), cumRevenue: prev + dayRev, targetLine: Math.round(dailyTarget * i) });
    }
    return days;
  }, [sales, totalTarget, daysInMonth, daysPassed]);

  // Best month per branch (all time)
  const bestMonths = useMemo(() => {
    return locations.map(loc => {
      const monthMap: Record<string, number> = {};
      sales.filter(o => o.location_id === loc.id).forEach(o => {
        const m = getMonth(o.date);
        if (m) monthMap[m] = (monthMap[m] || 0) + (o.net_amount || 0);
      });
      const best = Object.entries(monthMap).sort(([,a],[,b]) => b - a)[0];
      return { name: loc.name, bestMonth: best ? getMonthLabel(best[0]) : "—", bestRevenue: best ? best[1] : 0 };
    }).sort((a, b) => b.bestRevenue - a.bestRevenue);
  }, [sales, locations]);

  return (
    <div className="space-y-8">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Overall % */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Achievement</p>
                <p className="text-2xl font-bold mt-1">{totalPct}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmt(totalAchieved)} / {fmt(totalTarget)}</p>
                <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${totalPct >= 100 ? "bg-green-500" : totalPct >= 75 ? "bg-blue-500" : totalPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, totalPct)}%` }} />
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-500 shrink-0"><Target className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Branches on target */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">On Target</p>
                <p className="text-2xl font-bold mt-1 text-green-500">{branchesOnTarget}</p>
                <p className="text-xs text-muted-foreground mt-0.5">of {branchTargets.length} branches</p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-500/15 text-green-500 shrink-0"><CheckCircle2 className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Remaining */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Remaining</p>
                <p className="text-2xl font-bold mt-1 text-orange-500">{fmt(Math.max(0, totalRemaining))}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{daysLeft} days left</p>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-500 shrink-0"><AlertTriangle className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>

        {/* Daily needed */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Needed / Day</p>
                <p className="text-2xl font-bold mt-1">{fmt(dailyNeeded)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">to hit target</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-500 shrink-0"><TrendingUp className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target vs Achieved History */}
      <div>
        <SectionTitle title="Target vs Achieved" sub="Last 6 months" />
        <Card><CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={targetHistory}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="target" name="Target" fill="#6366f1" radius={[3,3,0,0]} opacity={0.5} />
              <Bar dataKey="achieved" name="Achieved" fill="#22c55e" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      {/* Burn Rate Chart */}
      {burnRate.length > 0 && (
        <div>
          <SectionTitle title="Monthly Burn Rate" sub={`Cumulative revenue vs target pace — ${getMonthLabel(monthKey)}`} />
          <Card><CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={burnRate}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cumRevenue" name="Achieved" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="targetLine" name="Target Pace" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>
      )}

      {/* Branch Progress */}
      <div>
        <SectionTitle title="Branch Progress" sub={getMonthLabel(monthKey)} />
        <div className="space-y-3">
          {branchTargets.map((b, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{b.loc.name}</p>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                    <span>Achieved: <span className="text-foreground font-medium">{fmt(b.achieved)}</span></span>
                    <span>Target: <span className="text-foreground font-medium">{fmt(b.target)}</span></span>
                    <span>Remaining: <span className="text-orange-500 font-medium">{fmt(b.remaining)}</span></span>
                    {b.dailyNeeded > 0 && <span>Need/day: <span className="text-blue-500 font-medium">{fmt(b.dailyNeeded)}</span></span>}
                  </div>
                  <span className={`text-sm font-bold w-12 text-right ${b.pct !== null && b.pct >= 100 ? "text-green-500" : b.pct !== null && b.pct >= 75 ? "text-blue-500" : b.pct !== null && b.pct >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                    {b.pct !== null ? `${b.pct}%` : "—"}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${b.pct !== null && b.pct >= 100 ? "bg-green-500" : b.pct !== null && b.pct >= 75 ? "bg-blue-500" : b.pct !== null && b.pct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, b.pct || 0)}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Agent Ranking */}
      {agentTargets.length > 0 && (
        <div>
          <SectionTitle title="Agent Target Ranking" sub={getMonthLabel(monthKey)} />
          <Card><CardContent className="pt-4 overflow-auto">
            <table className="w-full text-sm" style={{ minWidth: 500 }}>
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Agent</th>
                  <th className="text-left py-2">Branch</th>
                  <th className="text-right py-2">Achieved</th>
                  <th className="text-right py-2">Target</th>
                  <th className="text-right py-2 w-40">Progress</th>
                  <th className="text-right py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {agentTargets.map((a, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="py-2 text-xs text-muted-foreground">{i+1}</td>
                    <td className="py-2 text-xs font-medium">{a.agent?.name || "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{a.loc?.name || "—"}</td>
                    <td className="py-2 text-right text-xs">{fmt(a.achieved)}</td>
                    <td className="py-2 text-right text-xs">{fmt(a.target)}</td>
                    <td className="py-2 text-right">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${(a.pct||0) >= 100 ? "bg-green-500" : (a.pct||0) >= 75 ? "bg-blue-500" : (a.pct||0) >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, a.pct||0)}%` }} />
                      </div>
                    </td>
                    <td className={`py-2 text-right text-xs font-bold ${(a.pct||0) >= 100 ? "text-green-500" : (a.pct||0) >= 75 ? "text-blue-500" : (a.pct||0) >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                      {a.pct !== null ? `${a.pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </div>
      )}

      {/* Best Month per Branch */}
      <div>
        <SectionTitle title="Best Month per Branch" sub="All-time highest revenue month" />
        <Card><CardContent className="pt-4 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2">Branch</th>
                <th className="text-left py-2">Best Month</th>
                <th className="text-right py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {bestMonths.map((b, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2 text-xs font-medium">{b.name}</td>
                  <td className="py-2 text-xs text-muted-foreground">{b.bestMonth}</td>
                  <td className="py-2 text-right text-xs font-medium text-green-500">{fmt(b.bestRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>

    </div>
  );
}