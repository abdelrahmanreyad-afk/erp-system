"use client";

import { useEffect, useState, useRef } from "react";
import {
  getStock, getVariants, getLocations,
  addStock, updateStockQuantity, deleteStock,
  importStockFromCSV, parseCSV,
  StockItem, Variant, Location,
} from "@/lib/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Upload, Download, CheckCircle, XCircle } from "lucide-react";

export default function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ variant_id: "", location_id: "", quantity: 0 });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteItem, setDeleteItem] = useState<StockItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: { row: number; reason: string }[] } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [s, v, l] = await Promise.all([getStock(), getVariants(), getLocations()]);
      setStock(s);
      setVariants(v);
      setLocations(l);
    } catch {
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function getVariantName(id: string) {
    const v = variants.find((v) => v.id === id);
    return v ? `${v.name}${v.code ? ` (${v.code})` : ""}` : id;
  }

  function getLocationName(id: string) {
    const l = locations.find((l) => l.id === id);
    return l ? `${l.name}${l.code ? ` (${l.code})` : ""}` : id;
  }

  async function handleAdd() {
    setAddError("");
    if (!addForm.variant_id || !addForm.location_id) {
      setAddError("Please select a variant and a location.");
      return;
    }
    setAddLoading(true);
    try {
      await addStock(addForm);
      setAddOpen(false);
      setAddForm({ variant_id: "", location_id: "", quantity: 0 });
      await loadData();
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEdit() {
    if (!editItem?.id) return;
    setEditLoading(true);
    try {
      await updateStockQuantity(editItem.id, editQty);
      setEditItem(null);
      await loadData();
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem?.id) return;
    setDeleteLoading(true);
    try {
      await deleteStock(deleteItem.id);
      setDeleteItem(null);
      await loadData();
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const result = await importStockFromCSV(rows, variants, locations);
      setImportResult(result);
      await loadData();
    } catch {
      setImportResult({ success: 0, failed: [{ row: 0, reason: "Failed to parse CSV file." }] });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const csv = "variant_code,location_code,quantity\nABC-01,WH-001,50\nABC-02,BR-001,30";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage stock levels for each variant per location</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Stock
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Total Records: {stock.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stock.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No stock records found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Variant</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-left py-3 px-4">Quantity</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">{getVariantName(item.variant_id)}</td>
                    <td className="py-3 px-4">{getLocationName(item.location_id)}</td>
                    <td className="py-3 px-4 font-medium">{item.quantity}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => { setEditItem(item); setEditQty(item.quantity); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => setDeleteItem(item)}
                        >
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

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Stock from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with columns: <span className="text-foreground font-mono text-xs">variant_code, location_code, quantity</span>
            </p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>

            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-border/80 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {importLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload CSV file</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
            />

            {importResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{importResult.success} records imported successfully</span>
                </div>
                {importResult.failed.length > 0 && (
                  <div className="space-y-1">
                    {importResult.failed.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          {f.row > 0 ? `Row ${f.row}: ` : ""}{f.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportResult(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Variant</label>
              <select
                className="w-full"
                value={addForm.variant_id}
                onChange={(e) => setAddForm({ ...addForm, variant_id: e.target.value })}
              >
                <option value="">Select a variant</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Location</label>
              <select
                className="w-full"
                value={addForm.location_id}
                onChange={(e) => setAddForm({ ...addForm, location_id: e.target.value })}
              >
                <option value="">Select a location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Quantity</label>
              <input
                type="number"
                min={0}
                value={addForm.quantity}
                onChange={(e) => setAddForm({ ...addForm, quantity: Number(e.target.value) })}
              />
            </div>
            {addError && <p className="text-destructive text-sm">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading}>
              {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Quantity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Variant: <span className="text-foreground font-medium">{editItem && getVariantName(editItem.variant_id)}</span></p>
              <p>Location: <span className="text-foreground font-medium">{editItem && getLocationName(editItem.location_id)}</span></p>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">New Quantity</label>
              <input
                type="number"
                min={0}
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stock</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete the stock for{" "}
            <span className="text-foreground font-medium">{deleteItem && getVariantName(deleteItem.variant_id)}</span>{" "}
            at{" "}
            <span className="text-foreground font-medium">{deleteItem && getLocationName(deleteItem.location_id)}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}