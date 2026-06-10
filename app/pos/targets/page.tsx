"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/components/AuthContext";
import { Plus, Pencil, Trash2, Loader2, MapPin, Users, ChevronDown, ChevronRight } from "lucide-react";

// ── Types ──
type Location = { id: string; name: string; type?: string };
type Agent = { id: string; name: string; role: string };
type TargetDoc = {
  id: string;
  location_id: string;
  agent_id?: string;       // null/undefined = branch total target
  month: string;           // "YYYY-MM"
  amount: number;
  target_type: "branch" | "agent";
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonthLabel(m: string) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return `${MONTHS[parseInt(mo)-1]} ${y}`;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
}

function generateMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = -2; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    options.push({ value: val, label: getMonthLabel(val) });
  }
  return options;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function generateYearOptions() {
  const now = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => String(now - 1 + i));
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ══════════════════════════════════════════
export default function TargetsPage() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const [locations, setLocations] = useState<Location[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [targets, setTargets] = useState<TargetDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TargetDoc | null>(null);
  const [form, setForm] = useState({
    location_id: "",
    target_type: "branch" as "branch" | "agent",
    agent_id: "",
    month: getCurrentMonth(),
    amount: "",
  });
  // Separate month/year selectors for modal
  const [formMonth, setFormMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [formYear, setFormYear] = useState(String(new Date().getFullYear()));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<TargetDoc | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [lSnap, aSnap, tSnap] = await Promise.all([
        getDocs(collection(db, "locations")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "targets")),
      ]);
      setLocations(lSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location))
        .filter(l => l.type === "branch" || l.type === "branch_warehouse")
        .sort((a, b) => a.name.localeCompare(b.name)));
      setAgents(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agent))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setTargets(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as TargetDoc)));
      setLoading(false);
    }
    load();
  }, []);

  // Targets for selected month
  const monthTargets = useMemo(() =>
    targets.filter(t => t.month === selectedMonth), [targets, selectedMonth]);

  const getBranchTarget = (locId: string) =>
    monthTargets.find(t => t.target_type === "branch" && t.location_id === locId);

  const getAgentTargets = (locId: string) =>
    monthTargets.filter(t => t.target_type === "agent" && t.location_id === locId);

  const getAgentTarget = (locId: string, agentId: string) =>
    monthTargets.find(t => t.target_type === "agent" && t.location_id === locId && t.agent_id === agentId);

  // Total from agents = sum of agent targets
  const getBranchTotalFromAgents = (locId: string) =>
    getAgentTargets(locId).reduce((s, t) => s + t.amount, 0);

  // Agents that have targets in this branch
  const getBranchAgentsWithTargets = (locId: string) =>
    agents.filter(a => monthTargets.some(t => t.target_type === "agent" && t.location_id === locId && t.agent_id === a.id));

  function openAdd(locId?: string) {
    setEditTarget(null);
    const [y, m] = selectedMonth.split("-");
    setFormMonth(m);
    setFormYear(y);
    setForm({
      location_id: locId || "",
      target_type: "branch",
      agent_id: "",
      month: selectedMonth,
      amount: "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(t: TargetDoc) {
    setEditTarget(t);
    const [y, m] = t.month.split("-");
    setFormMonth(m);
    setFormYear(y);
    setForm({
      location_id: t.location_id,
      target_type: t.target_type,
      agent_id: t.agent_id || "",
      month: t.month,
      amount: String(t.amount),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError("");
    if (!form.location_id) { setFormError("Select a branch."); return; }
    if (form.target_type === "agent" && !form.agent_id) { setFormError("Select an agent."); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { setFormError("Enter a valid amount."); return; }

    // Check duplicate
    if (!editTarget) {
      const dup = form.target_type === "branch"
        ? monthTargets.find(t => t.target_type === "branch" && t.location_id === form.location_id && t.month === form.month)
        : monthTargets.find(t => t.target_type === "agent" && t.location_id === form.location_id && t.agent_id === form.agent_id && t.month === form.month);
      if (dup) { setFormError("Target already exists. Edit it instead."); return; }
    }

    setSaving(true);
    try {
      const data: any = {
        location_id: form.location_id,
        target_type: form.target_type,
        month: form.month,
        amount: Number(form.amount),
      };
      if (form.target_type === "agent") data.agent_id = form.agent_id;

      if (editTarget) {
        await updateDoc(doc(db, "targets", editTarget.id), data);
        setTargets(prev => prev.map(t => t.id === editTarget.id ? { ...t, ...data } : t));
      } else {
        const ref = await addDoc(collection(db, "targets"), data);
        setTargets(prev => [...prev, { id: ref.id, ...data }]);
      }
      setModalOpen(false);
    } catch (e: any) {
      setFormError("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "targets", deleteTarget.id));
      setTargets(prev => prev.filter(t => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      console.error(e);
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!isManager) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-muted-foreground text-sm">Access restricted to managers and admins.</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Targets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Set and manage monthly targets per branch and agent</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth.split("-")[1]}
              onChange={e => setSelectedMonth(`${selectedMonth.split("-")[0]}-${e.target.value}`)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={String(i+1).padStart(2,"0")}>{name}</option>
              ))}
            </select>
            <select
              value={selectedMonth.split("-")[0]}
              onChange={e => setSelectedMonth(`${e.target.value}-${selectedMonth.split("-")[1]}`)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
              {generateYearOptions().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => openAdd()}>
            <Plus className="h-4 w-4 mr-2" />Add Target
          </Button>
        </div>
      </div>

      {/* Branches */}
      <div className="space-y-3">
        {locations.map(loc => {
          const branchTarget = getBranchTarget(loc.id);
          const agentTargets = getAgentTargets(loc.id);
          const agentsWithTargets = getBranchAgentsWithTargets(loc.id);
          const agentTotal = getBranchTotalFromAgents(loc.id);
          const hasAgentTargets = agentTargets.length > 0;
          const effectiveTotal = branchTarget ? branchTarget.amount : (hasAgentTargets ? agentTotal : null);
          const isExpanded = expandedBranch === loc.id;

          return (
            <Card key={loc.id}>
              {/* Branch Row */}
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedBranch(isExpanded ? null : loc.id)}
                    className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  <MapPin className="h-4 w-4 text-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {effectiveTotal
                        ? <>Total Target: <span className="font-medium text-foreground">{fmt(effectiveTotal)}</span>
                          {hasAgentTargets && !branchTarget && <span className="ml-1">(from {agentTargets.length} agents)</span>}
                        </>
                        : "No target set"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Branch target actions */}
                    {branchTarget ? (
                      <>
                        <span className="text-xs text-muted-foreground mr-2">{fmt(branchTarget.amount)}</span>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(branchTarget)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(branchTarget)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditTarget(null);
                        const [y3, m3] = selectedMonth.split("-"); setFormMonth(m3); setFormYear(y3);
                      setForm({ location_id: loc.id, target_type: "branch", agent_id: "", month: selectedMonth, amount: "" });
                        setFormError("");
                        setModalOpen(true);
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Branch Total
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditTarget(null);
                      const [y4, m4] = selectedMonth.split("-"); setFormMonth(m4); setFormYear(y4);
                      setForm({ location_id: loc.id, target_type: "agent", agent_id: "", month: selectedMonth, amount: "" });
                      setFormError("");
                      setModalOpen(true);
                    }}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Agent
                    </Button>
                  </div>
                </div>

                {/* Agent Targets Expanded */}
                {isExpanded && (
                  <div className="mt-4 ml-8 space-y-2 border-t border-border/50 pt-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Users className="h-3.5 w-3.5" /> Agent Targets
                    </p>
                    {agentsWithTargets.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No agent targets set for this month.</p>
                    ) : (
                      agentsWithTargets.map(agent => {
                        const at = getAgentTarget(loc.id, agent.id);
                        if (!at) return null;
                        return (
                          <div key={agent.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg border border-border/40">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                              {agent.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{agent.name}</p>
                            </div>
                            <span className="text-xs font-semibold">{fmt(at.amount)}</span>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(at)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(at)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                    {hasAgentTargets && (
                      <div className="flex justify-between items-center px-2 pt-1 text-xs font-medium border-t border-border/40 mt-1">
                        <span className="text-muted-foreground">Agents Total</span>
                        <span>{fmt(agentTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Target" : "Add Target"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Target Type */}
            {!editTarget && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Target Type *</label>
                <div className="flex gap-2">
                  <button onClick={() => setForm(f => ({ ...f, target_type: "branch", agent_id: "" }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.target_type === "branch" ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}>
                    <MapPin className="h-3.5 w-3.5 inline mr-1" />Branch Total
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, target_type: "agent" }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.target_type === "agent" ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}>
                    <Users className="h-3.5 w-3.5 inline mr-1" />Agent
                  </button>
                </div>
              </div>
            )}

            {/* Branch */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Branch *</label>
              <SearchableSelect
                options={locations.map(l => ({ value: l.id, label: l.name }))}
                value={form.location_id}
                onChange={v => setForm(f => ({ ...f, location_id: v, agent_id: "" }))}
                placeholder="Select branch"
              />
            </div>

            {/* Agent (if agent type) */}
            {form.target_type === "agent" && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Agent *</label>
                <SearchableSelect
                  options={agents.map(a => ({ value: a.id, label: a.name }))}
                  value={form.agent_id}
                  onChange={v => setForm(f => ({ ...f, agent_id: v }))}
                  placeholder="Select agent"
                />
              </div>
            )}

            {/* Month + Year */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Month *</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={formMonth}
                  onChange={e => {
                    setFormMonth(e.target.value);
                    setForm(f => ({ ...f, month: `${formYear}-${e.target.value}` }));
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={String(i+1).padStart(2,"0")}>{name}</option>
                  ))}
                </select>
                <select value={formYear}
                  onChange={e => {
                    setFormYear(e.target.value);
                    setForm(f => ({ ...f, month: `${e.target.value}-${formMonth}` }));
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {generateYearOptions().map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Target Amount *</label>
              <input type="number" min={0} placeholder="e.g. 500000"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editTarget ? "Save Changes" : "Add Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Target</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}