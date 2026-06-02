"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
  onSnapshot, getDocs, writeBatch,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Upload, Download, CheckCircle, XCircle, RotateCcw } from "lucide-react";

type Product = { id: string; name: string; code: string; brandId?: string; lineId?: string };
type Brand = { id: string; name: string };
type Line = { id: string; name: string };
type Variant = { id: string; code: string; sku: string; name: string; productId: string };

export default function VariantsPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", code: "", sku: "", productId: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editItem, setEditItem] = useState<Variant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", sku: "", productId: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteItem, setDeleteItem] = useState<Variant | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: { row: number; reason: string }[] } | null>(null);

  useEffect(() => {
    async function loadStatic() {
      const [b, l] = await Promise.all([
        getDocs(collection(db, "brands")),
        getDocs(collection(db, "lines")),
      ]);
      setBrands(b.docs.map((d) => ({ id: d.id, ...d.data() } as Brand)));
      setLines(l.docs.map((d) => ({ id: d.id, ...d.data() } as Line)));
    }
    loadStatic();

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    });
    const unsubVariants = onSnapshot(collection(db, "variants"), (snap) => {
      setVariants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
      setLoading(false);
    });
    return () => { unsubProducts(); unsubVariants(); };
  }, []);

  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name || "";
  const getLineName = (id: string) => lines.find((l) => l.id === id)?.name || "";

  // Check if code already exists
  function isCodeDuplicate(code: string, excludeId?: string) {
    return variants.some((v) => v.code.toLowerCase() === code.toLowerCase() && v.id !== excludeId);
  }

  // ── Add ──
  async function handleAdd() {
    setAddError("");
    if (!addForm.name || !addForm.code || !addForm.productId) {
      setAddError("Name, Code, and Product are required."); return;
    }
    if (isCodeDuplicate(addForm.code)) {
      setAddError(`Code "${addForm.code}" already exists. Please use a unique code.`); return;
    }
    setAddLoading(true);
    try {
      await addDoc(collection(db, "variants"), {
        name: addForm.name, code: addForm.code,
        sku: addForm.sku, productId: addForm.productId,
        createdAt: new Date(),
      });
      setAddOpen(false);
      setAddForm({ name: "", code: "", sku: "", productId: "" });
    } finally { setAddLoading(false); }
  }

  // ── Edit ──
  function openEdit(v: Variant) {
    setEditItem(v);
    setEditForm({ name: v.name, code: v.code, sku: v.sku, productId: v.productId });
    setEditError("");
  }

  async function handleEdit() {
    if (!editItem) return;
    setEditError("");
    if (isCodeDuplicate(editForm.code, editItem.id)) {
      setEditError(`Code "${editForm.code}" already exists. Please use a unique code.`); return;
    }
    setEditLoading(true);
    try {
      await updateDoc(doc(db, "variants", editItem.id), {
        name: editForm.name, code: editForm.code,
        sku: editForm.sku, productId: editForm.productId,
      });
      setEditItem(null);
    } finally { setEditLoading(false); }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "variants", deleteItem.id));
      setDeleteItem(null);
    } finally { setDeleteLoading(false); }
  }

  // ── Reset All ──
  async function handleReset() {
    setResetLoading(true);
    try {
      const snap = await getDocs(collection(db, "variants"));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      setResetOpen(false);
    } finally { setResetLoading(false); }
  }

  // ── CSV Import ──
  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    const result = { success: 0, failed: [] as { row: number; reason: string }[] };

    try {
      const text = await file.text();
      const rows = text.trim().split("\n");

      const productsSnap = await getDocs(collection(db, "products"));
      const latestProducts = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));

      // Get existing codes to check duplicates during import
      const existingCodes = new Set(variants.map((v) => v.code.toLowerCase()));

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map((s) => s.trim());
        const [variant_name, code, sku, product_code] = cols;
        const rowNum = i + 1;

        if (!variant_name || !code || !product_code) {
          result.failed.push({ row: rowNum, reason: "variant_name, code, and product_code are required." });
          continue;
        }

        if (existingCodes.has(code.toLowerCase())) {
          result.failed.push({ row: rowNum, reason: `Code "${code}" already exists.` });
          continue;
        }

        const product = latestProducts.find(
          (p) => p.code?.toLowerCase() === product_code.toLowerCase()
        );

        if (!product) {
          result.failed.push({ row: rowNum, reason: `Product code "${product_code}" not found.` });
          continue;
        }

        try {
          await addDoc(collection(db, "variants"), {
            name: variant_name, code, sku: sku || "",
            productId: product.id, createdAt: new Date(),
          });
          existingCodes.add(code.toLowerCase());
          result.success++;
        } catch (e: any) {
          result.failed.push({ row: rowNum, reason: e.message });
        }
      }
      setImportResult(result);
    } catch {
      setImportResult({ success: 0, failed: [{ row: 0, reason: "Failed to parse CSV file." }] });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const csv = "variant_name,code,sku,product_code\nair wrapper x2,RB-AW-X2,1514123,P0001\nVariant B,RB-VB-01,1234567,P0002";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "variants_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Variants</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage product variants</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset All
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Variant
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Total: {variants.length} variants</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : variants.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No variants found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Code</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Brand / Line</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const p = getProduct(v.productId);
                  return (
                    <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{v.code}</td>
                      <td className="py-3 px-4 font-medium">{v.name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{v.sku || "—"}</td>
                      <td className="py-3 px-4">
                        <div>{p?.name || "—"}</div>
                        {p?.code && <div className="text-xs text-muted-foreground font-mono">{p.code}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {p?.brandId && <div>{getBrandName(p.brandId)}</div>}
                        {p?.lineId && <div>{getLineName(p.lineId)}</div>}
                        {!p?.brandId && !p?.lineId && "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="icon-sm" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="destructive" size="icon-sm" onClick={() => setDeleteItem(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Variant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Variant Name</label>
              <input placeholder="e.g. air wrapper x2" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Code</label>
              <input placeholder="e.g. RB-AW-X2" value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">SKU</label>
              <input placeholder="e.g. 1514123" value={addForm.sku} onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Product</label>
              <select value={addForm.productId} onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })}>
                <option value="">Select Product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
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

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Variant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Variant Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Code</label>
              <input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">SKU</label>
              <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Product</label>
              <select value={editForm.productId} onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })}>
                <option value="">Select Product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
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

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Variant</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="text-foreground font-medium">{deleteItem?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset All Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset All Variants</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete <span className="text-foreground font-medium">all {variants.length} variants</span>. This action cannot be undone.
            </p>
            <p className="text-xs text-destructive">⚠ Stock records linked to these variants will lose their reference.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetLoading}>
              {resetLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset All Variants
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Variants from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              CSV columns: <span className="font-mono text-xs text-foreground">variant_name, code, sku, product_code</span>
            </p>
            <p className="text-xs text-muted-foreground">Duplicate codes will be skipped automatically.</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Download Template
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
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            {importResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{importResult.success} variants imported successfully</span>
                </div>
                {importResult.failed.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f.row > 0 ? `Row ${f.row}: ` : ""}{f.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportResult(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}