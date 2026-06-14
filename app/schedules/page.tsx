"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Loader2, ChevronLeft, ChevronRight,
  Settings, Users, Calendar, Clock, Copy, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/components/AuthContext";

// ── Types ──
type Location = { id: string; name: string; type?: string };
type Agent = { id: string; name: string; role: string };
type TimeSlot = { id: string; label: string; start: string; end: string };
type Shift = { id: string; location_id: string; name: string; color: string; slots: TimeSlot[] };
type DayStatus = "normal_work" | "day_off" | "normal_leave" | "casual" | "unpaid" | "holiday" | "absent";
type ScheduleEntry = {
  id: string;
  location_id: string;
  agent_id: string;
  date: string; // YYYY-MM-DD
  shift_id: string;
  slot_id: string;
  status: DayStatus;
  cover_agent_id?: string;
  notes?: string;
};

// ── Constants ──
const STATUS_CONFIG: Record<DayStatus, { label: string; color: string; bg: string; short: string }> = {
  normal_work: { label: "Work",     color: "text-green-500",  bg: "bg-green-500/15",  short: "W"  },
  day_off:     { label: "Day Off",  color: "text-slate-400",  bg: "bg-slate-500/15",  short: "OFF"},
  normal_leave:{ label: "Normal",   color: "text-blue-500",   bg: "bg-blue-500/15",   short: "NL" },
  casual:      { label: "Casual",   color: "text-yellow-500", bg: "bg-yellow-500/15", short: "CL" },
  unpaid:      { label: "Unpaid",   color: "text-orange-500", bg: "bg-orange-500/15", short: "UL" },
  holiday:     { label: "Holiday",  color: "text-purple-500", bg: "bg-purple-500/15", short: "PH" },
  absent:      { label: "Absent",   color: "text-red-500",    bg: "bg-red-500/15",    short: "AB" },
};

const SHIFT_COLORS = ["#3b82f6","#22c55e","#f97316","#a855f7","#ef4444","#06b6d4","#eab308"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ══════════════════════════════════════════
export default function SchedulesPage() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";

  const [locations, setLocations] = useState<Location[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation
  const [selectedLocation, setSelectedLocation] = useState("");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [activeTab, setActiveTab] = useState<"schedule" | "shifts">("schedule");

  // Entry Modal
  const [entryModal, setEntryModal] = useState<{ agentId: string; date: string } | null>(null);
  const [entryForm, setEntryForm] = useState<{
    shift_id: string; slot_id: string; status: DayStatus;
    cover_agent_id: string; notes: string;
  }>({ shift_id: "", slot_id: "", status: "normal_work", cover_agent_id: "", notes: "" });
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState("");

  // Shift Modal
  const [shiftModal, setShiftModal] = useState<Shift | null | "new">(null);
  const [shiftForm, setShiftForm] = useState({ name: "", color: SHIFT_COLORS[0], slots: [{ label: "", start: "", end: "" }] });
  const [shiftSaving, setShiftSaving] = useState(false);
  const [shiftError, setShiftError] = useState("");

  // Delete
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy week
  const [copyLoading, setCopyLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [lSnap, aSnap, sSnap, eSnap] = await Promise.all([
        getDocs(collection(db, "locations")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "shifts")),
        getDocs(collection(db, "schedule_entries")),
      ]);
      const locs = lSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location))
        .filter(l => l.type === "branch" || l.type === "branch_warehouse")
        .sort((a, b) => a.name.localeCompare(b.name));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      setAgents(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agent))
        .filter(a => a.role === "agent")
        .sort((a, b) => a.name.localeCompare(b.name)));
      setShifts(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shift)));
      setEntries(eSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleEntry)));
      setLoading(false);
    }
    load();
  }, []);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const locationShifts = useMemo(() =>
    shifts.filter(s => s.location_id === selectedLocation), [shifts, selectedLocation]);

  const locationAgents = useMemo(() =>
    agents.filter(a => entries.some(e => e.location_id === selectedLocation && e.agent_id === a.id) ||
      agents.some(ag => ag.id === a.id)), [agents, entries, selectedLocation]);

  // All agents (for coverage purposes)
  const allAgentsForLocation = useMemo(() =>
    agents.filter(a => a.role === "agent"), [agents]);

  function getEntry(agentId: string, date: string) {
    return entries.find(e => e.agent_id === agentId && e.date === date && e.location_id === selectedLocation);
  }

  function openEntryModal(agentId: string, date: string) {
    if (!isManager) return;
    const existing = getEntry(agentId, date);
    setEntryForm({
      shift_id: existing?.shift_id || locationShifts[0]?.id || "",
      slot_id: existing?.slot_id || locationShifts[0]?.slots[0]?.id || "",
      status: existing?.status || "normal_work",
      cover_agent_id: existing?.cover_agent_id || "",
      notes: existing?.notes || "",
    });
    setEntryError("");
    setEntryModal({ agentId, date });
  }

  async function saveEntry() {
    if (!entryModal) return;
    setEntrySaving(true); setEntryError("");
    try {
      const data: any = {
        location_id: selectedLocation,
        agent_id: entryModal.agentId,
        date: entryModal.date,
        shift_id: entryForm.shift_id,
        slot_id: entryForm.slot_id,
        status: entryForm.status,
        notes: entryForm.notes || "",
      };
      if (entryForm.cover_agent_id) data.cover_agent_id = entryForm.cover_agent_id;

      const existing = getEntry(entryModal.agentId, entryModal.date);
      if (existing) {
        await updateDoc(doc(db, "schedule_entries", existing.id), data);
        setEntries(prev => prev.map(e => e.id === existing.id ? { ...e, ...data } : e));
      } else {
        const ref = await addDoc(collection(db, "schedule_entries"), data);
        setEntries(prev => [...prev, { id: ref.id, ...data }]);
      }
      setEntryModal(null);
    } catch (e: any) { setEntryError("Failed: " + e.message); }
    finally { setEntrySaving(false); }
  }

  async function deleteEntry(agentId: string, date: string) {
    const existing = getEntry(agentId, date);
    if (!existing) return;
    await deleteDoc(doc(db, "schedule_entries", existing.id));
    setEntries(prev => prev.filter(e => e.id !== existing.id));
  }

  // Copy this week to next week
  async function copyWeekToNext() {
    setCopyLoading(true);
    try {
      const nextWeek = new Date(weekStart);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextDates = getWeekDates(nextWeek);
      const thisWeekEntries = entries.filter(e =>
        e.location_id === selectedLocation && weekDates.includes(e.date)
      );
      for (let i = 0; i < 7; i++) {
        const dayEntries = thisWeekEntries.filter(e => e.date === weekDates[i]);
        for (const entry of dayEntries) {
          const nextDate = nextDates[i];
          const existing = entries.find(e => e.agent_id === entry.agent_id && e.date === nextDate && e.location_id === selectedLocation);
          const data = { ...entry, date: nextDate };
          delete (data as any).id;
          if (existing) {
            await updateDoc(doc(db, "schedule_entries", existing.id), data);
          } else {
            const ref = await addDoc(collection(db, "schedule_entries"), data);
            setEntries(prev => [...prev, { id: ref.id, ...data }]);
          }
        }
      }
      setWeekStart(nextWeek);
    } catch (e: any) { console.error(e); }
    finally { setCopyLoading(false); }
  }

  // Shift CRUD
  function openShiftModal(shift?: Shift) {
    if (shift) {
      setShiftModal(shift);
      setShiftForm({ name: shift.name, color: shift.color, slots: shift.slots.map(s => ({ ...s })) });
    } else {
      setShiftModal("new");
      setShiftForm({ name: "", color: SHIFT_COLORS[0], slots: [{ label: "", start: "", end: "" }] });
    }
    setShiftError("");
  }

  async function saveShift() {
    setShiftSaving(true); setShiftError("");
    try {
      if (!shiftForm.name.trim()) { setShiftError("Shift name is required."); setShiftSaving(false); return; }
      if (shiftForm.slots.some(s => !s.label || !s.start || !s.end)) { setShiftError("All time slots must be complete."); setShiftSaving(false); return; }
      const slots = shiftForm.slots.map((s, i) => ({ ...s, id: s.id || `slot_${Date.now()}_${i}` }));
      const data = { location_id: selectedLocation, name: shiftForm.name, color: shiftForm.color, slots };
      if (shiftModal === "new") {
        const ref = await addDoc(collection(db, "shifts"), data);
        setShifts(prev => [...prev, { id: ref.id, ...data }]);
      } else if (shiftModal) {
        await updateDoc(doc(db, "shifts", shiftModal.id), data);
        setShifts(prev => prev.map(s => s.id === (shiftModal as Shift).id ? { id: (shiftModal as Shift).id, ...data } : s));
      }
      setShiftModal(null);
    } catch (e: any) { setShiftError("Failed: " + e.message); }
    finally { setShiftSaving(false); }
  }

  async function handleDeleteShift() {
    if (!deleteShift) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "shifts", deleteShift.id));
      setShifts(prev => prev.filter(s => s.id !== deleteShift.id));
      setDeleteShift(null);
    } catch (e: any) { console.error(e); }
    finally { setDeleteLoading(false); }
  }

  // Coverage check: days with no agents working
  const coverageAlerts = useMemo(() => {
    return weekDates.filter(date => {
      const dayEntries = entries.filter(e =>
        e.location_id === selectedLocation && e.date === date && e.status === "normal_work"
      );
      return dayEntries.length === 0 && allAgentsForLocation.length > 0;
    });
  }, [weekDates, entries, selectedLocation, allAgentsForLocation]);

  const selectedShift = locationShifts.find(s => s.id === entryForm.shift_id);
  const needsCover = ["normal_leave","casual","unpaid","absent"].includes(entryForm.status);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Weekly shift management for agents</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Branch selector */}
          <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm">
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {[{ id: "schedule", label: "Schedule", icon: Calendar }, { id: "shifts", label: "Shift Setup", icon: Settings }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${activeTab === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center">
                {formatDate(weekDates[0])} — {formatDate(weekDates[6])} {new Date(weekDates[0]).getFullYear()}
              </span>
              <Button variant="outline" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {isManager && (
                <Button variant="outline" size="sm" onClick={copyWeekToNext} disabled={copyLoading}>
                  {copyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy to Next Week
                </Button>
              )}
            </div>
          </div>

          {/* Coverage Alerts */}
          {coverageAlerts.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No coverage on: {coverageAlerts.map(d => `${DAYS[new Date(d).getDay()]} ${formatDate(d)}`).join(", ")}
            </div>
          )}

          {/* Schedule Grid */}
          <Card>
            <CardContent className="pt-4 overflow-auto">
              <table className="w-full text-sm" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium w-36">Agent</th>
                    {weekDates.map((date, i) => (
                      <th key={date} className={`py-3 px-2 text-center text-muted-foreground font-medium ${date === new Date().toISOString().split("T")[0] ? "text-primary" : ""}`}>
                        <div>{DAYS[new Date(date).getDay()]}</div>
                        <div className="text-xs">{formatDate(date)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allAgentsForLocation.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">No agents found.</td></tr>
                  ) : (
                    allAgentsForLocation.map(agent => (
                      <tr key={agent.id} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                              {agent.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-xs font-medium truncate max-w-[100px]">{agent.name}</span>
                          </div>
                        </td>
                        {weekDates.map(date => {
                          const entry = getEntry(agent.id, date);
                          const status = entry?.status || null;
                          const shift = shifts.find(s => s.id === entry?.shift_id);
                          const slot = shift?.slots.find(sl => sl.id === entry?.slot_id);
                          const cfg = status ? STATUS_CONFIG[status] : null;
                          const coverAgent = entry?.cover_agent_id ? agents.find(a => a.id === entry.cover_agent_id) : null;
                          return (
                            <td key={date} className="py-1 px-1 text-center">
                              <button
                                onClick={() => openEntryModal(agent.id, date)}
                                className={`w-full min-h-[52px] rounded-lg border transition-all text-xs p-1.5 ${
                                  entry
                                    ? `${cfg?.bg} border-transparent hover:opacity-80`
                                    : "border-dashed border-border/50 hover:border-primary/40 hover:bg-muted/30"
                                }`}
                              >
                                {entry ? (
                                  <div className="space-y-0.5">
                                    {shift && (
                                      <div className="font-semibold truncate" style={{ color: shift.color }}>{shift.name}</div>
                                    )}
                                    {slot && <div className="text-muted-foreground text-[10px]">{slot.start}–{slot.end}</div>}
                                    <div className={`font-medium ${cfg?.color}`}>{cfg?.short}</div>
                                    {coverAgent && (
                                      <div className="text-[10px] text-blue-400 truncate">↔ {coverAgent.name.split(" ")[0]}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30 text-lg">+</span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                <span>{cfg.short}</span>
                <span>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SHIFTS TAB ── */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Manage shift types and time slots for this branch</p>
            {isManager && (
              <Button size="sm" onClick={() => openShiftModal()}>
                <Plus className="h-4 w-4 mr-1" />Add Shift
              </Button>
            )}
          </div>

          {locationShifts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
              No shifts configured for this branch yet.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locationShifts.map(shift => (
                <Card key={shift.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: shift.color }} />
                        <h3 className="font-semibold">{shift.name}</h3>
                      </div>
                      {isManager && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openShiftModal(shift)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteShift(shift)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {shift.slots.map(slot => (
                        <div key={slot.id} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border/40">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-medium">{slot.label}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{slot.start} – {slot.end}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ENTRY MODAL ── */}
      <Dialog open={!!entryModal} onOpenChange={() => setEntryModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entryModal && `${agents.find(a => a.id === entryModal.agentId)?.name} — ${DAYS[new Date(entryModal.date).getDay()]} ${formatDate(entryModal.date)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Shift */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Shift *</label>
              <select value={entryForm.shift_id}
                onChange={e => setEntryForm(f => ({ ...f, shift_id: e.target.value, slot_id: locationShifts.find(s => s.id === e.target.value)?.slots[0]?.id || "" }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <option value="">Select shift...</option>
                {locationShifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Time Slot */}
            {selectedShift && selectedShift.slots.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Time Slot *</label>
                <div className="flex flex-wrap gap-2">
                  {selectedShift.slots.map(slot => (
                    <button key={slot.id} onClick={() => setEntryForm(f => ({ ...f, slot_id: slot.id }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${entryForm.slot_id === slot.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}>
                      {slot.label} ({slot.start}–{slot.end})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Status *</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(STATUS_CONFIG) as [DayStatus, any][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => setEntryForm(f => ({ ...f, status: key, cover_agent_id: "" }))}
                    className={`py-2 px-2 rounded-lg border text-xs font-medium transition-all ${entryForm.status === key ? `${cfg.bg} border-transparent ${cfg.color}` : "border-border text-muted-foreground hover:border-border/80"}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Agent */}
            {needsCover && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Cover Agent (optional)</label>
                <select value={entryForm.cover_agent_id}
                  onChange={e => setEntryForm(f => ({ ...f, cover_agent_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="">No cover</option>
                  {agents.filter(a => a.id !== entryModal?.agentId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Notes</label>
              <textarea value={entryForm.notes} onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Optional notes..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />
            </div>

            {entryError && <p className="text-xs text-destructive">{entryError}</p>}
          </div>
          <DialogFooter>
            {getEntry(entryModal?.agentId || "", entryModal?.date || "") && (
              <Button variant="destructive" onClick={() => { deleteEntry(entryModal!.agentId, entryModal!.date); setEntryModal(null); }}>
                Clear
              </Button>
            )}
            <Button variant="outline" onClick={() => setEntryModal(null)}>Cancel</Button>
            <Button onClick={saveEntry} disabled={entrySaving}>
              {entrySaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SHIFT MODAL ── */}
      <Dialog open={!!shiftModal} onOpenChange={() => setShiftModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shiftModal === "new" ? "Add Shift" : "Edit Shift"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Shift Name *</label>
              <input placeholder="e.g. Morning" value={shiftForm.name}
                onChange={e => setShiftForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            {/* Color */}
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Color</label>
              <div className="flex gap-2">
                {SHIFT_COLORS.map(c => (
                  <button key={c} onClick={() => setShiftForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-all ${shiftForm.color === c ? "ring-2 ring-offset-2 ring-offset-background ring-white scale-110" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>

            {/* Time Slots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Time Slots *</label>
                <Button size="sm" variant="outline" onClick={() => setShiftForm(f => ({ ...f, slots: [...f.slots, { label: "", start: "", end: "" }] }))}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Slot
                </Button>
              </div>
              {shiftForm.slots.map((slot, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center p-2 bg-muted/20 rounded-lg border border-border/40">
                  <input placeholder="Label (e.g. Early)" value={slot.label}
                    onChange={e => { const s = [...shiftForm.slots]; s[i] = { ...s[i], label: e.target.value }; setShiftForm(f => ({ ...f, slots: s })); }} />
                  <input type="time" value={slot.start}
                    onChange={e => { const s = [...shiftForm.slots]; s[i] = { ...s[i], start: e.target.value }; setShiftForm(f => ({ ...f, slots: s })); }} />
                  <div className="flex items-center gap-1">
                    <input type="time" value={slot.end}
                      onChange={e => { const s = [...shiftForm.slots]; s[i] = { ...s[i], end: e.target.value }; setShiftForm(f => ({ ...f, slots: s })); }} />
                    {shiftForm.slots.length > 1 && (
                      <button onClick={() => setShiftForm(f => ({ ...f, slots: f.slots.filter((_, j) => j !== i) }))}
                        className="p-1 text-destructive hover:opacity-70">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {shiftError && <p className="text-xs text-destructive">{shiftError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftModal(null)}>Cancel</Button>
            <Button onClick={saveShift} disabled={shiftSaving}>
              {shiftSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {shiftModal === "new" ? "Add Shift" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE SHIFT CONFIRM ── */}
      <Dialog open={!!deleteShift} onOpenChange={() => setDeleteShift(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Shift</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure you want to delete "{deleteShift?.name}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteShift(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteShift} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}