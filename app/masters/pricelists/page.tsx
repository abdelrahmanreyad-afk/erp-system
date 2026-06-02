"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc,
  doc, query, where, writeBatch,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Loader2, ChevronRight, ArrowLeft, Save, Tag,
} from "lucide-react";

type Pricelist = { id: string; name: string; isOriginal?: boolean; createdAt?: any };
type PriceItem = { id: string; pricelist_id: string; variant_id: string; price: number };
type Variant = { id: string; name: string; code?: string; sku?: string; productId?: string };
type Product = { id: string; name: string };

export default function PricelistsPage() {
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPricelist, setSelectedPricelist] = useState<Pricelist | null>(null);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [searchVariant, setSearchVariant] = useState("");

  // Create pricelist dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Delete dialog
  const [deleteItem, setDeleteItem] = useState<Pricelist | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Rename dialog
  const [renameItem, setRenameItem] = useState<Pricelist | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [plSnap, piSnap, vSnap, pSnap] = await Promise.all([
      getDocs(collection(db, "pricelists")),
      getDocs(collection(db, "pricelist_items")),
      getDocs(collection(db, "variants")),
      getDocs(collection(db, "products")),
    ]);
    setPricelists(plSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pricelist)));
    setPriceItems(piSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceItem)));
    setVariants(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
    setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const getVariant = (id: string) => variants.find((v) => v.id === id);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getOriginal = () => pricelists.find((p) => p.isOriginal);

  function getItemsForPricelist(plId: string) {
    return priceItems.filter((i) => i.pricelist_id === plId);
  }

  function getPriceForVariant(plId: string, variantId: string) {
    return priceItems.find((i) => i.pricelist_id === plId && i.variant_id === variantId)?.price ?? 0;
  }

  // ── Open Pricelist ──
  function openPricelist(pl: Pricelist) {
    setSelectedPricelist(pl);
    setSearchVariant("");
    // Build editedPrices map from existing items
    const prices: Record<string, number> = {};
    variants.forEach((v) => {
      prices[v.id] = getPriceForVariant(pl.id, v.id);
    });
    setEditedPrices(prices);
  }

  // ── Save Prices ──
  async function handleSavePrices() {
    if (!selectedPricelist) return;
    setSaveLoading(true);
    try {
      const batch = writeBatch(db);
      const existingItems = getItemsForPricelist(selectedPricelist.id);

      for (const variant of variants) {
        const price = editedPrices[variant.id] ?? 0;
        const existing = existingItems.find((i) => i.variant_id === variant.id);
        if (existing) {
          batch.update(doc(db, "pricelist_items", existing.id), { price });
        } else {
          const newRef = doc(collection(db, "pricelist_items"));
          batch.set(newRef, {
            pricelist_id: selectedPricelist.id,
            variant_id: variant.id,
            price,
          });
        }
      }
      await batch.commit();
      await loadAll();
    } finally { setSaveLoading(false); }
  }

  // ── Create Pricelist ──
  async function handleCreate() {
    setCreateError("");
    if (!createName.trim()) { setCreateError("Name is required."); return; }
    if (pricelists.find((p) => p.name.toLowerCase() === createName.trim().toLowerCase())) {
      setCreateError("A pricelist with this name already exists."); return;
    }
    setCreateLoading(true);
    try {
      const isFirst = pricelists.length === 0;
      const newRef = await addDoc(collection(db, "pricelists"), {
        name: createName.trim(),
        isOriginal: isFirst,
        createdAt: new Date(),
      });

      // If not first, copy from Original
      if (!isFirst) {
        const original = getOriginal();
        if (original) {
          const originalItems = getItemsForPricelist(original.id);
          const batch = writeBatch(db);
          originalItems.forEach((item) => {
            const newItemRef = doc(collection(db, "pricelist_items"));
            batch.set(newItemRef, {
              pricelist_id: newRef.id,
              variant_id: item.variant_id,
              price: item.price,
            });
          });
          // Add items for variants not in original
          const coveredVariantIds = new Set(originalItems.map((i) => i.variant_id));
          variants.forEach((v) => {
            if (!coveredVariantIds.has(v.id)) {
              const newItemRef = doc(collection(db, "pricelist_items"));
              batch.set(newItemRef, { pricelist_id: newRef.id, variant_id: v.id, price: 0 });
            }
          });
          await batch.commit();
        }
      }

      setCreateOpen(false);
      setCreateName("");
      await loadAll();
    } finally { setCreateLoading(false); }
  }

  // ── Delete Pricelist ──
  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "pricelists", deleteItem.id));
      const items = getItemsForPricelist(deleteItem.id);
      items.forEach((i) => batch.delete(doc(db, "pricelist_items", i.id)));
      await batch.commit();
      setDeleteItem(null);
      if (selectedPricelist?.id === deleteItem.id) setSelectedPricelist(null);
      await loadAll();
    } finally { setDeleteLoading(false); }
  }

  // ── Rename Pricelist ──
  async function handleRename() {
    if (!renameItem || !renameName.trim()) return;
    setRenameLoading(true);
    try {
      await updateDoc(doc(db, "pricelists", renameItem.id), { name: renameName.trim() });
      if (selectedPricelist?.id === renameItem.id) {
        setSelectedPricelist({ ...selectedPricelist, name: renameName.trim() });
      }
      setRenameItem(null);
      await loadAll();
    } finally { setRenameLoading(false); }
  }

  const filteredVariants = variants.filter((v) => {
    if (!searchVariant) return true;
    const p = v.productId ? getProduct(v.productId) : undefined;
    const str = [v.name, v.code, v.sku, p?.name].filter(Boolean).join(" ").toLowerCase();
    return str.includes(searchVariant.toLowerCase());
  });

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Pricelist Detail View ──
  if (selectedPricelist) {
    const items = getItemsForPricelist(selectedPricelist.id);
    const totalValue = items.reduce((sum, i) => {
      const stockQty = 0; // placeholder
      return sum + i.price;
    }, 0);

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon-sm" onClick={() => setSelectedPricelist(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{selectedPricelist.name}</h1>
                {selectedPricelist.isOriginal && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Original</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{variants.length} variants</p>
            </div>
          </div>
          <Button onClick={handleSavePrices} disabled={saveLoading}>
            {saveLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Prices
          </Button>
        </div>

        {/* Search */}
        <input
          placeholder="Search variant, product, code..."
          value={searchVariant}
          onChange={(e) => setSearchVariant(e.target.value)}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Showing {filteredVariants.length} of {variants.length} variants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredVariants.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No variants found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4">Variant</th>
                    <th className="text-left py-3 px-4">Code</th>
                    <th className="text-left py-3 px-4">Product</th>
                    <th className="text-left py-3 px-4">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((v) => {
                    const p = v.productId ? getProduct(v.productId) : undefined;
                    return (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium">{v.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{v.code || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{p?.name || "—"}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min={0}
                            value={editedPrices[v.id] ?? 0}
                            onChange={(e) => setEditedPrices({ ...editedPrices, [v.id]: Number(e.target.value) })}
                            style={{ width: 100, padding: "4px 8px" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Pricelists List View ──
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pricelists</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage pricing for all variants</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Pricelist
        </Button>
      </div>

      {pricelists.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No pricelists yet. Create your first one — it will become the Original.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Original Pricelist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pricelists.map((pl) => {
            const items = getItemsForPricelist(pl.id);
            const variantsWithPrice = items.filter((i) => i.price > 0).length;
            return (
              <Card
                key={pl.id}
                className="cursor-pointer hover:border-border/80 transition-all hover:bg-muted/20"
                onClick={() => openPricelist(pl)}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{pl.name}</CardTitle>
                      {pl.isOriginal && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Original</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mt-1">
                    <div>
                      <p className="text-2xl font-bold">{variantsWithPrice}</p>
                      <p className="text-xs text-muted-foreground">Variants with price</p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-2xl font-bold">{variants.length}</p>
                      <p className="text-xs text-muted-foreground">Total variants</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setRenameItem(pl); setRenameName(pl.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Rename
                    </Button>
                    {!pl.isOriginal && (
                      <Button variant="destructive" size="sm" onClick={() => setDeleteItem(pl)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pricelists.length === 0 ? "Create Original Pricelist" : "Create New Pricelist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Pricelist Name</label>
              <input
                placeholder={pricelists.length === 0 ? "e.g. Original Price" : "e.g. Wholesale Price"}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            {pricelists.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Prices will be copied from <span className="text-foreground font-medium">{getOriginal()?.name}</span> as a starting point.
              </p>
            )}
            {createError && <p className="text-destructive text-sm">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={() => setRenameItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Pricelist</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">New Name</label>
              <input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renameLoading}>
              {renameLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Pricelist</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="text-foreground font-medium">{deleteItem?.name}</span>? All prices in this list will be lost.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}