"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";

type Area = { id: string; name: string };

type Location = {
  id: string;
  name: string;
  code: string;
  type: "branch" | "warehouse" | "branch_warehouse";
  area_id?: string;
};

const TYPE_LABELS: Record<string, string> = {
  branch: "Branch",
  warehouse: "Warehouse",
  branch_warehouse: "Branch Warehouse",
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  // Add
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", code: "", type: "branch", area_id: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit
  const [editItem, setEditItem] = useState<Location | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", type: "branch", area_id: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete
  const [deleteItem, setDeleteItem] = useState<Location | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Area management
  const [areaOpen, setAreaOpen] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [areaLoading, setAreaLoading] = useState(false);
  const [deleteAreaItem, setDeleteAreaItem] = useState<Area | null>(null);

  async function loadData() {
    setLoading(true);
    const [locSnap, areaSnap] = await Promise.all([
      getDocs(collection(db, "locations")),
      getDocs(collection(db, "areas")),
    ]);
    setLocations(locSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Location)));
    setAreas(areaSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Area)));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function getAreaName(id?: string) {
    return areas.find((a) => a.id === id)?.name || "—";
  }

  // ── Add Location ──
  async function handleAdd() {
    setAddError("");
    if (!addForm.name || !addForm.code) { setAddError("Name and Code are required."); return; }
    setAddLoading(true);
    try {
      await addDoc(collection(db, "locations"), {
        name: addForm.name,
        code: addForm.code,
        type: addForm.type,
        area_id: addForm.area_id || null,
        createdAt: new Date(),
      });
      setAddOpen(false);
      setAddForm({ name: "", code: "", type: "branch", area_id: "" });
      await loadData();
    } finally {
      setAddLoading(false);
    }
  }

  // ── Edit Location ──
  function openEdit(loc: Location) {
    setEditItem(loc);
    setEditForm({ name: loc.name, code: loc.code, type: loc.type, area_id: loc.area_id || "" });
    setEditError("");
  }

  async function handleEdit() {
    if (!editItem) return;
    setEditError("");
    if (!editForm.name || !editForm.code) { setEditError("Name and Code are required."); return; }
    setEditLoading(true);
    try {
      await updateDoc(doc(db, "locations", editItem.id), {
        name: editForm.name,
        code: editForm.code,
        type: editForm.type,
        area_id: editForm.area_id || null,
      });
      setEditItem(null);
      await loadData();
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete Location ──
  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "locations", deleteItem.id));
      setDeleteItem(null);
      await loadData();
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Add Area ──
  async function handleAddArea() {
    if (!newArea.trim()) return;
    setAreaLoading(true);
    await addDoc(collection(db, "areas"), { name: newArea.trim() });
    setNewArea("");
    await loadData();
    setAreaLoading(false);
  }

  // ── Delete Area ──
  async function handleDeleteArea() {
    if (!deleteAreaItem) return;
    await deleteDoc(doc(db, "areas", deleteAreaItem.id));
    setDeleteAreaItem(null);
    await loadData();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage warehouses and branches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAreaOpen(true)}>
            Manage Areas
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Total: {locations.length} locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No locations found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Code</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Area</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{loc.code}</td>
                    <td className="py-3 px-4 font-medium">{loc.name}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        {TYPE_LABELS[loc.type] || loc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {loc.area_id ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getAreaName(loc.area_id)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="icon-sm" onClick={() => openEdit(loc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="destructive" size="icon-sm" onClick={() => setDeleteItem(loc)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add Location Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Location</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Name</label>
              <input placeholder="e.g. Cairo Main Branch" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Code</label>
              <input placeholder="e.g. CAI-01" value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Type</label>
              <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}>
                <option value="branch">Branch</option>
                <option value="warehouse">Warehouse</option>
                <option value="branch_warehouse">Branch Warehouse</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Area</label>
              <select value={addForm.area_id} onChange={(e) => setAddForm({ ...addForm, area_id: e.target.value })}>
                <option value="">No Area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {addError && <p className="text-destructive text-sm">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading}>
              {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Location</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Code</label>
              <input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Type</label>
              <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                <option value="branch">Branch</option>
                <option value="warehouse">Warehouse</option>
                <option value="branch_warehouse">Branch Warehouse</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Area</label>
              <select value={editForm.area_id} onChange={(e) => setEditForm({ ...editForm, area_id: e.target.value })}>
                <option value="">No Area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Location</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="text-foreground font-medium">{deleteItem?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Areas Dialog */}
      <Dialog open={areaOpen} onOpenChange={setAreaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Areas</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <input
                placeholder="New area name (e.g. Cairo)"
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddArea()}
              />
              <Button onClick={handleAddArea} disabled={areaLoading}>
                {areaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <div className="space-y-1">
              {areas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No areas yet.</p>
              ) : (
                areas.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/30">
                    <span className="text-sm">{a.name}</span>
                    <Button variant="destructive" size="icon-sm" onClick={() => setDeleteAreaItem(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Area Confirm */}
      <Dialog open={!!deleteAreaItem} onOpenChange={() => setDeleteAreaItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Area</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="text-foreground font-medium">{deleteAreaItem?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAreaItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteArea}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}