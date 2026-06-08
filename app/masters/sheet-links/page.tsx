"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  onSnapshot, getDocs,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Loader2, Link2, ExternalLink,
  CheckCircle2, AlertCircle, Copy, Check, Settings2,
} from "lucide-react";

type Location = { id: string; name: string; code: string };

export type ColumnMapping = {
  salesperson: string; // e.g. "A"
  location: string;    // e.g. "B"
  date: string;        // e.g. "C"
  order_id: string;    // e.g. "D"
  variants: string;    // e.g. "F"
};

export type SheetLink = {
  id: string;
  location_id: string;
  sheet_url: string;
  sheet_id: string;
  tab_name: string;
  header_row: number;
  column_mapping: ColumnMapping;
  active: boolean;
};

const COLUMNS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

const DEFAULT_MAPPING: ColumnMapping = {
  salesperson: "A",
  location: "B",
  date: "C",
  order_id: "D",
  variants: "F",
};

const FIELD_LABELS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "salesperson", label: "Salesperson Code", required: true },
  { key: "location",    label: "Location Code",    required: true },
  { key: "date",        label: "Date",             required: true },
  { key: "order_id",    label: "Order ID",         required: true },
  { key: "variants",    label: "Variants (comma-separated)", required: true },
];

function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : "";
}

function colToIndex(col: string): number {
  return col.toUpperCase().charCodeAt(0) - 65;
}

function MappingRow({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 text-sm">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </div>
      <select
        className="w-20 px-2 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {COLUMNS.map((c) => <option key={c} value={c}>Col {c}</option>)}
      </select>
    </div>
  );
}

export default function SheetLinksPage() {
  const [links, setLinks] = useState<SheetLink[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState("");

  const emptyForm = () => ({
    location_id: "", sheet_url: "", tab_name: "Orders",
    header_row: 1,
    column_mapping: { ...DEFAULT_MAPPING },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm());
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editItem, setEditItem] = useState<SheetLink | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteItem, setDeleteItem] = useState<SheetLink | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "locations")).then((snap) =>
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Location)))
    );
    const unsub = onSnapshot(collection(db, "branch_sheets"), (snap) => {
      setLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SheetLink)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getLocation = (id: string) => locations.find((l) => l.id === id);

  function validateForm(form: typeof addForm, excludeId?: string) {
    if (!form.location_id) return "Please select a location.";
    if (!form.sheet_url) return "Please enter a Google Sheet URL.";
    if (!extractSheetId(form.sheet_url)) return "Invalid Google Sheet URL.";
    if (links.some((l) => l.location_id === form.location_id && l.id !== excludeId))
      return "This location already has a sheet linked.";
    const m = form.column_mapping;
    const cols = [m.salesperson, m.location, m.date, m.order_id, m.variants];
    if (new Set(cols).size !== cols.length) return "Each column must be mapped to a different letter.";
    return "";
  }

  async function handleAdd() {
    const err = validateForm(addForm);
    if (err) { setAddError(err); return; }
    setAddLoading(true);
    try {
      await addDoc(collection(db, "branch_sheets"), {
        location_id: addForm.location_id,
        sheet_url: addForm.sheet_url,
        sheet_id: extractSheetId(addForm.sheet_url),
        tab_name: addForm.tab_name || "Orders",
        header_row: addForm.header_row || 1,
        column_mapping: addForm.column_mapping,
        active: true,
        createdAt: new Date(),
      });
      setAddOpen(false);
      setAddForm(emptyForm());
    } catch (e: any) { setAddError(e.message); }
    finally { setAddLoading(false); }
  }

  function openEdit(item: SheetLink) {
    setEditItem(item);
    setEditForm({
      location_id: item.location_id,
      sheet_url: item.sheet_url,
      tab_name: item.tab_name,
      header_row: item.header_row || 1,
      column_mapping: { ...DEFAULT_MAPPING, ...item.column_mapping },
    });
    setEditError("");
  }

  async function handleEdit() {
    if (!editItem) return;
    const err = validateForm(editForm, editItem.id);
    if (err) { setEditError(err); return; }
    setEditLoading(true);
    try {
      await updateDoc(doc(db, "branch_sheets", editItem.id), {
        location_id: editForm.location_id,
        sheet_url: editForm.sheet_url,
        sheet_id: extractSheetId(editForm.sheet_url),
        tab_name: editForm.tab_name || "Orders",
        header_row: editForm.header_row || 1,
        column_mapping: editForm.column_mapping,
      });
      setEditItem(null);
    } catch (e: any) { setEditError(e.message); }
    finally { setEditLoading(false); }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "branch_sheets", deleteItem.id));
      setDeleteItem(null);
    } catch (e: any) { console.error(e); }
    finally { setDeleteLoading(false); }
  }

  async function toggleActive(item: SheetLink) {
    await updateDoc(doc(db, "branch_sheets", item.id), { active: !item.active });
  }

  function copyMapping(link: SheetLink) {
    const m = link.column_mapping;
    const loc = getLocation(link.location_id);
    const text = `Branch: ${loc?.name} (${loc?.code})
Sheet ID: ${link.sheet_id}
Tab: ${link.tab_name} | Header Row: ${link.header_row}
Column Mapping:
  Salesperson → Col ${m?.salesperson || "A"}
  Location    → Col ${m?.location || "B"}
  Date        → Col ${m?.date || "C"}
  Order ID    → Col ${m?.order_id || "D"}
  Variants    → Col ${m?.variants || "F"}`;
    navigator.clipboard.writeText(text);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(""), 2000);
  }

  const unlinkedLocations = locations.filter(
    (l) => !links.some((lk) => lk.location_id === l.id)
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const FormFields = ({
    form, setForm, error,
  }: {
    form: ReturnType<typeof emptyForm>;
    setForm: React.Dispatch<React.SetStateAction<any>>;
    error: string;
  }) => (
    <div className="space-y-4 py-2">
      {/* Branch */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Branch <span className="text-destructive">*</span></label>
        <select
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.location_id}
          onChange={(e) => setForm((f: any) => ({ ...f, location_id: e.target.value }))}
        >
          <option value="">Select branch...</option>
          {locations.sort((a, b) => a.name.localeCompare(b.name)).map((l) => (
            <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
          ))}
        </select>
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Google Sheet URL <span className="text-destructive">*</span></label>
        <input
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={form.sheet_url}
          onChange={(e) => setForm((f: any) => ({ ...f, sheet_url: e.target.value }))}
        />
        {form.sheet_url && !extractSheetId(form.sheet_url) && (
          <p className="text-xs text-destructive">Invalid URL</p>
        )}
        {form.sheet_url && extractSheetId(form.sheet_url) && (
          <p className="text-xs text-green-500">✓ Sheet ID detected</p>
        )}
      </div>

      {/* Tab + Header Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tab Name</label>
          <input
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Orders"
            value={form.tab_name}
            onChange={(e) => setForm((f: any) => ({ ...f, tab_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Header Row #</label>
          <input
            type="number" min={1} max={10}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.header_row}
            onChange={(e) => setForm((f: any) => ({ ...f, header_row: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground">Data starts from row {(form.header_row || 1) + 1}</p>
        </div>
      </div>

      {/* Column Mapping */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <label className="text-sm font-medium">Column Mapping</label>
        </div>
        <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5">
          {FIELD_LABELS.map(({ key, label, required }) => (
            <MappingRow
              key={key}
              label={label}
              required={required}
              value={form.column_mapping[key] || "A"}
              onChange={(v) => setForm((f: any) => ({
                ...f,
                column_mapping: { ...f.column_mapping, [key]: v }
              }))}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Map each data field to its column letter in the sheet.
          Variants column should contain comma-separated variant codes.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sheet Links</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure each branch's Google Sheet and column mapping for order sync.
          </p>
        </div>
        <Button onClick={() => { setAddOpen(true); setAddError(""); setAddForm(emptyForm()); }}>
          <Plus className="h-4 w-4 mr-2" /> Link Sheet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Linked</p>
          <p className="text-2xl font-bold">{links.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Active</p>
          <p className="text-2xl font-bold text-green-500">{links.filter((l) => l.active).length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unlinked</p>
          <p className="text-2xl font-bold text-yellow-500">{unlinkedLocations.length}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Linked Branches
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Link2 className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">No sheets linked yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Branch</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tab / Header</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Column Mapping</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {links.map((link) => {
                    const loc = getLocation(link.location_id);
                    const m = link.column_mapping || DEFAULT_MAPPING;
                    return (
                      <tr key={link.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium">{loc?.name || "Unknown"}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground font-mono">{loc?.code}</span>
                            <a href={link.sheet_url} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm">{link.tab_name}</div>
                          <div className="text-xs text-muted-foreground">Header: Row {link.header_row || 1}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {[
                              { label: "SP", col: m.salesperson },
                              { label: "Loc", col: m.location },
                              { label: "Date", col: m.date },
                              { label: "OID", col: m.order_id },
                              { label: "Var", col: m.variants },
                            ].map(({ label, col }) => (
                              <span key={label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                                <span className="text-muted-foreground">{label}:</span>{col}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => toggleActive(link)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              link.active
                                ? "bg-green-500/15 text-green-500 hover:bg-green-500/25"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}>
                            {link.active
                              ? <><CheckCircle2 className="h-3 w-3" /> Active</>
                              : <><AlertCircle className="h-3 w-3" /> Inactive</>}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => copyMapping(link)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Copy config summary">
                              {copiedId === link.id
                                ? <Check className="h-3.5 w-3.5 text-green-500" />
                                : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => openEdit(link)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteItem(link)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {unlinkedLocations.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Unlinked Branches</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {unlinkedLocations.map((l) => l.name).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Link Google Sheet
            </DialogTitle>
          </DialogHeader>
          <FormFields form={addForm} setForm={setAddForm} error={addError} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading}>
              {addLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Link Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit Sheet Link
            </DialogTitle>
          </DialogHeader>
          <FormFields form={editForm} setForm={setEditForm} error={editError} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Sheet Link?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will unlink the Google Sheet from{" "}
            <strong>{getLocation(deleteItem?.location_id || "")?.name}</strong>.
            Orders already synced won't be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}