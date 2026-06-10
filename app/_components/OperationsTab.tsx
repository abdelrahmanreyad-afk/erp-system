"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { Package, RotateCcw, Repeat2, AlertTriangle, TrendingDown } from "lucide-react";
import { Order, Variant, Location, Agent, Stock, fmt, getMonth } from "../page";

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function KPICard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: any; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
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
  orders: Order[]; filteredOrders: Order[]; variants: Variant[];
  locations: Location[]; agents: Agent[]; stocks: Stock[];
};

export default function OperationsTab({ orders, filteredOrders, variants, locations, agents, stocks }: Props) {

  const sales = useMemo(() => filteredOrders.filter(o => !o.transaction_type || o.transaction_type === "sale"), [filteredOrders]);
  const refunds = useMemo(() => filteredOrders.filter(o => o.transaction_type === "refund"), [filteredOrders]);
  const replacements = useMemo(() => filteredOrders.filter(o => o.transaction_type === "replacement"), [filteredOrders]);
  const allSales = useMemo(() => orders.filter(o => o.type === "done" && (!o.transaction_type || o.transaction_type === "sale")), [orders]);

  // KPIs
  const refundRate = sales.length ? (refunds.length / sales.length) * 100 : 0;
  const totalRefundAmt = refunds.reduce((s, o) => s + Math.abs(o.net_amount || 0), 0);
  const replacementNet = replacements.reduce((s, o) => s + (o.difference || 0), 0);

  // Refund condition
  const refundCondition = useMemo(() => [
    { name: "Sealed", value: refunds.filter(o => o.condition === "sealed").length, color: "#22c55e" },
    { name: "Defect", value: refunds.filter(o => o.condition === "defect").length, color: "#ef4444" },
  ].filter(d => d.value > 0), [refunds]);

  // Avg refund time (days between sale and refund)
  const avgRefundTime = useMemo(() => {
    const times: number[] = [];
    refunds.forEach(o => {
      if (!o.original_order_id) return;
      const original = orders.find(s => s.order_id === o.original_order_id);
      if (!original) return;
      const diff = Math.abs(new Date(o.date).getTime() - new Date(original.date).getTime());
      times.push(diff / 86400000);
    });
    return times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;
  }, [refunds, orders]);

  // Most returned products
  const topRefunded = useMemo(() => {
    const map: Record<string, { refunded: number; sold: number }> = {};
    sales.forEach(o => (o.products || []).forEach((p: any) => {
      if (!map[p.variant_id]) map[p.variant_id] = { refunded: 0, sold: 0 };
      map[p.variant_id].sold += p.quantity || 0;
    }));
    refunds.forEach(o => (o.products || []).forEach((p: any) => {
      if (!map[p.variant_id]) map[p.variant_id] = { refunded: 0, sold: 0 };
      map[p.variant_id].refunded += p.quantity || 0;
    }));
    return Object.entries(map).filter(([, d]) => d.refunded > 0)
      .map(([varId, d]) => ({ name: variants.find(v => v.id === varId)?.name || varId, ...d, rate: d.sold ? Math.round((d.refunded / d.sold) * 100) : 0 }))
      .sort((a, b) => b.refunded - a.refunded).slice(0, 8);
  }, [sales, refunds, variants]);

  // Defect rate per branch
  const defectByBranch = useMemo(() => {
    return locations.map(loc => {
      const locRefunds = refunds.filter(o => o.location_id === loc.id);
      const defects = locRefunds.filter(o => o.condition === "defect").length;
      const locSales = sales.filter(o => o.location_id === loc.id).length;
      const defectRate = locSales ? Math.round((defects / locSales) * 100) : 0;
      return { name: loc.name, defects, defectRate, totalRefunds: locRefunds.length };
    }).filter(b => b.defects > 0 || b.totalRefunds > 0).sort((a, b) => b.defects - a.defects);
  }, [refunds, sales, locations]);

  // Replacement analysis
  const replacementAnalysis = useMemo(() => {
    const gains = replacements.filter(o => (o.difference || 0) > 0).reduce((s, o) => s + (o.difference || 0), 0);
    const losses = replacements.filter(o => (o.difference || 0) < 0).reduce((s, o) => s + Math.abs(o.difference || 0), 0);
    const sealed = replacements.filter(o => o.condition === "sealed").length;
    const defect = replacements.filter(o => o.condition === "defect").length;
    return { gains, losses, net: gains - losses, sealed, defect };
  }, [replacements]);

  // Discount analysis per agent
  const discountByAgent = useMemo(() => {
    const map: Record<string, { total: number; orders: number }> = {};
    sales.forEach(o => {
      if (!map[o.sales_person_id]) map[o.sales_person_id] = { total: 0, orders: 0 };
      map[o.sales_person_id].total += o.total_discount || 0;
      map[o.sales_person_id].orders++;
    });
    return Object.entries(map).map(([id, d]) => ({
      name: agents.find(a => a.id === id)?.name || id,
      totalDiscount: d.total, avgDiscount: d.orders ? Math.round(d.total / d.orders) : 0,
    })).sort((a, b) => b.totalDiscount - a.totalDiscount).slice(0, 8);
  }, [sales, agents]);

  // Low stock
  const lowStock = useMemo(() =>
    stocks.filter(s => s.quantity <= 5 && s.quantity >= 0).map(s => ({
      variant: variants.find(v => v.id === s.variant_id)?.name || s.variant_id,
      location: locations.find(l => l.id === s.location_id)?.name || s.location_id,
      qty: s.quantity,
    })).sort((a, b) => a.qty - b.qty).slice(0, 15),
  [stocks, variants, locations]);

  // Dead stock (variants with stock but 0 sales)
  const deadStock = useMemo(() => {
    const soldVariants = new Set(allSales.flatMap(o => (o.products || []).map((p: any) => p.variant_id)));
    return stocks.filter(s => s.quantity > 0 && !soldVariants.has(s.variant_id))
      .map(s => ({
        variant: variants.find(v => v.id === s.variant_id)?.name || s.variant_id,
        location: locations.find(l => l.id === s.location_id)?.name || s.location_id,
        qty: s.quantity,
      })).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [stocks, allSales, variants, locations]);

  // Stock turnover
  const stockTurnover = useMemo(() => {
    return locations.map(loc => {
      const totalSold = sales.filter(o => o.location_id === loc.id)
        .reduce((s, o) => s + (o.products || []).reduce((ss: number, p: any) => ss + (p.quantity || 0), 0), 0);
      const currentStock = stocks.filter(s => s.location_id === loc.id).reduce((sum, s) => sum + s.quantity, 0);
      const turnover = currentStock > 0 ? Math.round((totalSold / currentStock) * 10) / 10 : null;
      return { name: loc.name, totalSold, currentStock, turnover };
    }).filter(l => l.totalSold > 0 || l.currentStock > 0).sort((a, b) => (b.turnover || 0) - (a.turnover || 0));
  }, [sales, stocks, locations]);

  // Old drafts
  const oldDrafts = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
    return orders.filter(o => {
      if (o.type !== "draft") return false;
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
      return d < cutoff;
    });
  }, [orders]);

  return (
    <div className="space-y-8">

      {/* Alerts */}
      {(oldDrafts.length > 0 || lowStock.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {oldDrafts.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {oldDrafts.length} draft order{oldDrafts.length > 1 ? "s" : ""} pending +3 days
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Refund Rate" value={`${refundRate.toFixed(1)}%`} icon={RotateCcw}
          color="bg-red-500/15 text-red-500" sub={`${refunds.length} refunds · ${fmt(totalRefundAmt)}`} />
        <KPICard title="Avg Refund Time" value={avgRefundTime !== null ? `${avgRefundTime}d` : "—"}
          icon={RotateCcw} color="bg-orange-500/15 text-orange-500" sub="days between sale & refund" />
        <KPICard title="Replacements" value={String(replacements.length)} icon={Repeat2}
          color="bg-blue-500/15 text-blue-500" sub={`Net: ${replacementNet >= 0 ? "+" : ""}${fmt(replacementNet)}`} />
        <KPICard title="Dead Stock Items" value={String(deadStock.length)} icon={Package}
          color="bg-muted text-muted-foreground" sub="in stock, never sold" />
      </div>

      {/* Refund Analysis */}
      <div>
        <SectionTitle title="Refund Analysis" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sealed vs Defect */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Sealed vs Defect</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={refundCondition} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                    {refundCondition.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Most returned */}
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
                  {topRefunded.map((p, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 text-xs font-medium truncate max-w-[180px]">{p.name}</td>
                      <td className="py-2 text-right text-xs text-red-500">{p.refunded}</td>
                      <td className="py-2 text-right text-xs">{p.sold}</td>
                      <td className="py-2 text-right text-xs font-medium">{p.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Defect Rate per Branch */}
      <div>
        <SectionTitle title="Defect Rate per Branch" />
        <Card><CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={defectByBranch} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="defects" name="Defects" fill="#ef4444" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      {/* Replacement Analysis */}
      <div>
        <SectionTitle title="Replacement Impact" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Customer Paid Extra", value: replacementAnalysis.gains, color: "text-green-500" },
            { label: "We Refunded Extra", value: replacementAnalysis.losses, color: "text-red-500" },
            { label: "Net Impact", value: replacementAnalysis.net, color: replacementAnalysis.net >= 0 ? "text-green-500" : "text-red-500" },
            { label: "Sealed Returns", value: replacementAnalysis.sealed, color: "text-blue-500", isCount: true },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-xl font-bold mt-1 ${item.color}`}>
                  {(item as any).isCount ? item.value : `${item.value >= 0 ? "" : "-"}${fmt(Math.abs(item.value as number))}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Discount Analysis */}
      <div>
        <SectionTitle title="Discount Analysis" sub="Who gives the most discounts" />
        <Card><CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={discountByAgent} layout="vertical">
              <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="totalDiscount" name="Total Discount" fill="#f97316" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>

      {/* Stock Turnover */}
      <div>
        <SectionTitle title="Stock Turnover" sub="Sold units ÷ current stock per branch" />
        <Card><CardContent className="pt-4 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2">Branch</th>
                <th className="text-right py-2">Sold</th>
                <th className="text-right py-2">Stock</th>
                <th className="text-right py-2">Turnover</th>
              </tr>
            </thead>
            <tbody>
              {stockTurnover.map((s, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-2 text-xs font-medium">{s.name}</td>
                  <td className="py-2 text-right text-xs">{s.totalSold}</td>
                  <td className="py-2 text-right text-xs">{s.currentStock}</td>
                  <td className="py-2 text-right text-xs">
                    <span className={`font-medium ${(s.turnover || 0) >= 2 ? "text-green-500" : (s.turnover || 0) >= 1 ? "text-yellow-500" : "text-red-500"}`}>
                      {s.turnover !== null ? `${s.turnover}x` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>

      {/* Low Stock + Dead Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lowStock.length > 0 && (
          <div>
            <SectionTitle title="Low Stock Alert" sub="≤5 units" />
            <Card><CardContent className="pt-4 overflow-auto">
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
                      <td className="py-2 text-xs font-medium truncate max-w-[140px]">{s.variant}</td>
                      <td className="py-2 text-xs text-muted-foreground">{s.location}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs font-bold ${s.qty === 0 ? "text-red-500" : "text-yellow-500"}`}>{s.qty}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        )}
        {deadStock.length > 0 && (
          <div>
            <SectionTitle title="Dead Stock" sub="In stock but never sold" />
            <Card><CardContent className="pt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2">Product</th>
                    <th className="text-left py-2">Branch</th>
                    <th className="text-right py-2">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStock.map((s, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 text-xs font-medium truncate max-w-[140px]">{s.variant}</td>
                      <td className="py-2 text-xs text-muted-foreground">{s.location}</td>
                      <td className="py-2 text-right text-xs font-medium text-muted-foreground">{s.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        )}
      </div>

    </div>
  );
}