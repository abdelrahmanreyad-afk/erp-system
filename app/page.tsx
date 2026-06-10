"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { X, Filter, ChevronDown, Loader2 } from "lucide-react";

// ── Types (shared) ──
export type Order = {
  id: string; order_id: string; date: string; transaction_type?: string;
  type?: string; location_id: string; sales_person_id: string;
  pricelist_id: string; net_amount: number; products?: any[];
  new_products?: any[]; payments?: any[]; order_discount?: number;
  total_discount?: number; createdAt: any; condition?: string;
  difference?: number; old_product?: any;
};
export type Variant = { id: string; name: string; productId?: string };
export type Location = { id: string; name: string; type?: string };
export type Agent = { id: string; name: string; role: string };
export type Pricelist = { id: string; name: string; isOriginal?: boolean };
export type Stock = { id: string; variant_id: string; location_id: string; quantity: number };
export type TargetDoc = { id: string; location_id: string; agent_id?: string; month: string; amount: number; target_type: "branch" | "agent" };

export const TX_COLORS: Record<string, string> = {
  sale: "#3b82f6", refund: "#ef4444", replacement: "#f97316",
  zerocost: "#22c55e", ceo_request: "#a855f7",
};
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
export function getMonth(dateStr: string) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
export function getMonthLabel(m: string) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${MONTHS[parseInt(mo)-1]} ${y?.slice(2)}`;
}
export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
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

// ── Lazy tab imports ──
import dynamic from "next/dynamic";
const SalesTab = dynamic(() => import("./_components/SalesTab"), { loading: () => <TabLoader /> });
const TargetsTab = dynamic(() => import("./_components/TargetsTab"), { loading: () => <TabLoader /> });
const OperationsTab = dynamic(() => import("./_components/OperationsTab"), { loading: () => <TabLoader /> });

function TabLoader() {
  return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const TABS = [
  { id: "sales", label: "Sales" },
  { id: "targets", label: "Targets" },
  { id: "operations", label: "Operations" },
];

// ══════════════════════════════════════════
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("sales");

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

  // ── Filtered Orders ──
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

  const activeFilters = [filterDateFrom, filterDateTo, filterLocation, filterAgent, filterPricelist, filterTxType, filterMonth].filter(Boolean).length;

  function clearAllFilters() {
    setFilterDateFrom(""); setFilterDateTo(""); setFilterLocation("");
    setFilterAgent(""); setFilterPricelist(""); setFilterTxType(""); setFilterMonth("");
  }

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

  const sharedProps = {
    orders, filteredOrders, variants, locations, agents,
    pricelists, stocks, targets, filterMonth, filterLocation, filterAgent,
    filterDateFrom, filterDateTo,
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sales & operations overview</p>
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showFilters || activeFilters > 0 ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters > 0 && <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">{activeFilters}</span>}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* ── FILTERS PANEL ── */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date From</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date To</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Month</label>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Branch</label>
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Branches</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Agent</label>
              <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Agents</option>
                {agents.sort((a,b) => a.name.localeCompare(b.name)).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pricelist</label>
              <select value={filterPricelist} onChange={e => setFilterPricelist(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">All Pricelists</option>
                {pricelists.map(p => <option key={p.id} value={p.id}>{p.name}{p.isOriginal ? " (Original)" : ""}</option>)}
              </select>
            </div>
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
            <div className="flex items-end">
              <button onClick={clearAllFilters}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Clear All
              </button>
            </div>
          </div>
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

      {/* ── TABS ── */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === "sales" && <SalesTab {...sharedProps} />}
      {activeTab === "targets" && <TargetsTab {...sharedProps} />}
      {activeTab === "operations" && <OperationsTab {...sharedProps} />}

    </div>
  );
}