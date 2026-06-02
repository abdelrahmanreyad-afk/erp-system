"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc, query, where,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Upload, Download, CheckCircle, XCircle } from "lucide-react";

type Brand = { id: string; name: string };
type Category = { id: string; name: string };
type Line = { id: string; name: string };
type Product = { id: string; code: string; name: string; brandId: string; categoryId: string; lineId: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", brandId: "", categoryId: "", lineId: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editItem, setEditItem] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: "", brandId: "", categoryId: "", lineId: "" });
  const [editLoading, setEditLoading] = useState(false);

  const [deleteItem, setDeleteItem] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: { row: number; reason: string }[] } | null>(null);

  async function loadAll() {
    setLoading(true);
    const [b, c, l, p] = await Promise.all([
      getDocs(collection(db, "brands")),
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "lines")),
      getDocs(collection(db, "products")),
    ]);
    setBrands(b.docs.map((d) => ({ id: d.id, ...d.data() } as Brand)));
    setCategories(c.docs.map((d) => ({ id: d.id, ...d.data() } as Category)));
    setLines(l.docs.map((d) => ({ id: d.id, ...d.data() } as Line)));
    setProducts(p.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function generateCode(existingProducts: Product[]) {
    const next = existingProducts.length + 1;
    return `P${String(next).padStart(4, "0")}`;
  }

  // ── Add ──
  async function handleAdd() {
    setAddError("");
    if (!addForm.name || !addForm.brandId || !addForm.categoryId || !addForm.lineId) {
      setAddError("All fields are required."); return;
    }
    setAddLoading(true);
    try {
      await addDoc(collection(db, "products"), {
        name: addForm.name,
        code: generateCode(products),
        brandId: addForm.brandId,
        categoryId: addForm.categoryId,
        lineId: addForm.lineId,
        createdAt: new Date(),
      });
      setAddOpen(false);
      setAddForm({ name: "", brandId: "", categoryId: "", lineId: "" });
      await loadAll();
    } finally { setAddLoading(false); }
  }

  // ── Edit ──
  function openEdit(p: Product) {
    setEditItem(p);
    setEditForm({ name: p.name, brandId: p.brandId, categoryId: p.categoryId, lineId: p.lineId });
  }

  async function handleEdit() {
    if (!editItem) return;
    setEditLoading(true);
    try {
      await updateDoc(doc(db, "products", editItem.id), {
        name: editForm.name, brandId: editForm.brandId,
        categoryId: editForm.categoryId, lineId: editForm.lineId,
      });
      setEditItem(null);
      await loadAll();
    } finally { setEditLoading(false); }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "products", deleteItem.id));
      setDeleteItem(null);
      await loadAll();
    } finally { setDeleteLoading(false); }
  }

  // ── CSV Import helpers ──
  async function getOrCreate(col: string, name: string, existing: { id: string; name: string }[]): Promise<string> {
    const found = existing.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (found) return found.id;
    const ref = await addDoc(collection(db, col), { name, createdAt: new Date() });
    existing.push({ id: ref.id, name });
    return ref.id;
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    const result = { success: 0, failed: [] as { row: number; reason: string }[] };

    try {
      const text = await file.text();
      const lines_csv = text.trim().split("\n");
      const localBrands = [...brands];
      const localCategories = [...categories];
      const localLines = [...lines];
      const localProducts = [...products];

      for (let i = 1; i < lines_csv.length; i++) {
        const row = lines_csv[i].split(",").map((s) => s.trim());
        const [product_name, brand_name, line_name, category_name] = row;
        const rowNum = i + 1;

        if (!product_name) { result.failed.push({ row: rowNum, reason: "Product name is required." }); continue; }

        try {
          const brandId = brand_name ? await getOrCreate("brands", brand_name, localBrands) : "";
          const lineId = line_name ? await getOrCreate("lines", line_name, localLines) : "";
          const categoryId = category_name ? await getOrCreate("categories", category_name, localCategories) : "";

          // Check if product already exists
          const exists = localProducts.find((p) => p.name.toLowerCase() === product_name.toLowerCase());
          if (exists) { result.failed.push({ row: rowNum, reason: `Product "${product_name}" already exists.` }); continue; }

          const code = generateCode(localProducts);
          await addDoc(collection(db, "products"), {
            name: product_name, code, brandId, categoryId, lineId, createdAt: new Date(),
          });
          localProducts.push({ id: "temp", code, name: product_name, brandId, categoryId, lineId });
          result.success++;
        } catch (e: any) {
          result.failed.push({ row: rowNum, reason: e.message });
        }
      }
      setImportResult(result);
      await loadAll();
    } catch {
      setImportResult({ success: 0, failed: [{ row: 0, reason: "Failed to parse CSV file." }] });
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const csv = "product_name,brand_name,line_name,category_name\nAirWrapper X2,RushBrush,Cosmetics,Skin Care\nProduct B,Brand X,Line Y,Category Z";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const getName = (arr: { id: string; name: string }[], id: string) => arr.find((x) => x.id === id)?.name || "—";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Total: {products.length} products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No products found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Code</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Brand</th>
                  <th className="text-left py-3 px-4">Line</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.code}</td>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{getName(brands, p.brandId)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{getName(lines, p.lineId)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{getName(categories, p.categoryId)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="icon-sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="destructive" size="icon-sm" onClick={() => setDeleteItem(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Product Name</label>
              <input placeholder="e.g. AirWrapper X2" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Brand</label>
              <select value={addForm.brandId} onChange={(e) => setAddForm({ ...addForm, brandId: e.target.value })}>
                <option value="">Select Brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Line</label>
              <select value={addForm.lineId} onChange={(e) => setAddForm({ ...addForm, lineId: e.target.value })}>
                <option value="">Select Line</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Category</label>
              <select value={addForm.categoryId} onChange={(e) => setAddForm({ ...addForm, categoryId: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Product Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Brand</label>
              <select value={editForm.brandId} onChange={(e) => setEditForm({ ...editForm, brandId: e.target.value })}>
                <option value="">Select Brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Line</label>
              <select value={editForm.lineId} onChange={(e) => setEditForm({ ...editForm, lineId: e.target.value })}>
                <option value="">Select Line</option>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Category</label>
              <select value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
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
          <DialogHeader><DialogTitle>Delete Product</DialogTitle></DialogHeader>
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

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Products from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              CSV columns: <span className="font-mono text-xs text-foreground">product_name, brand_name, line_name, category_name</span>
            </p>
            <p className="text-xs text-muted-foreground">Brands, Lines, and Categories will be created automatically if they don't exist.</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Download Template
            </Button>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-border/80 transition-colors" onClick={() => fileInputRef.current?.click()}>
              {importLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /> : (
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
                  <span>{importResult.success} products imported successfully</span>
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