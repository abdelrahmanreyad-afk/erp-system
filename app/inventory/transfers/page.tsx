"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, updateDoc, doc, getDoc,
  query, where, writeBatch,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Plus, ArrowLeft, Trash2, Loader2, CheckCircle, Clock,
  ArrowRight, Eye, Package, ChevronRight,
} from "lucide-react";

// ── Types ──
type Location = { id: string; name: string; code?: string; type?: string };
type Variant = { id: string; name: string; code?: string; productId?: string };
type Product = { id: string; name: string };
type StockItem = { id: string; variant_id: string; location_id: string; quantity: number };

type TransferItem = { variant_id: string; quantity: number };
type Transfer = {
  id: string;
  number: string;
  from_location_id: string;
  to_location_id: string;
  status: "draft" | "done";
  items: TransferItem[];
  createdAt: any;
  notes?: string;
};

const MAIN_ID = "MAIN";
const MAIN_LOCATION = { id: MAIN_ID, name: "Main (External)", code: "", type: "external" };

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Create form
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Stock check dialog
  const [stockCheckVariant, setStockCheckVariant] = useState<Variant | null>(null);

  // Done confirm
  const [doneTransfer, setDoneTransfer] = useState<Transfer | null>(null);
  const [doneLoading, setDoneLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [tSnap, lSnap, vSnap, pSnap, sSnap] = await Promise.all([
      getDocs(collection(db, "transfers")),
      getDocs(collection(db, "locations")),
      getDocs(collection(db, "variants")),
      getDocs(collection(db, "products")),
      getDocs(collection(db, "stock")),
    ]);
    setTransfers(tSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transfer))
      .sort((a, b) => b.number?.localeCompare(a.number)));
    setLocations(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Location)));
    setVariants(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
    setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setStock(sSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StockItem)));
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Helpers
  const getVariant = (id: string) => variants.find((v) => v.id === id);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getLocationName = (id: string) => {
    if (id === MAIN_ID) return "Main (External)";
    return locations.find((l) => l.id === id)?.name || id;
  };

  function getStockQty(variantId: string, locationId: string) {
    if (locationId === MAIN_ID) return "∞";
    return stock.find((s) => s.variant_id === variantId && s.location_id === locationId)?.quantity ?? 0;
  }

  function getStockAcrossLocations(variantId: string) {
    return locations.map((l) => ({
      location: l,
      quantity: stock.find((s) => s.variant_id === variantId && s.location_id === l.id)?.quantity ?? 0,
    })).filter((x) => x.quantity > 0);
  }

  function generateNumber(existing: Transfer[]) {
    const next = existing.length + 1;
    return `TRF-${String(next).padStart(4, "0")}`;
  }

  // ── All locations including Main ──
  const allLocationOptions = useMemo(() => {
    const locs = [MAIN_LOCATION, ...locations].sort((a, b) => {
      if (a.id === MAIN_ID) return -1;
      if (b.id === MAIN_ID) return 1;
      return a.name.localeCompare(b.name);
    });
    return locs.map((l) => ({ value: l.id, label: l.id === MAIN_ID ? "Main (External)" : l.name }));
  }, [locations]);

  const variantOptions = useMemo(() => {
    return [...variants]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => {
        const p = v.productId ? getProduct(v.productId) : undefined;
        return { value: v.id, label: `${v.name}${p ? ` — ${p.name}` : ""}` };
      });
  }, [variants, products]);

  // ── Add item to transfer ──
  function addItem() {
    setItems([...items, { variant_id: "", quantity: 1 }]);
  }

  function updateItem(index: number, field: keyof TransferItem, value: any) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: field === "quantity" ? Number(value) : value };
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  // ── Create Transfer ──
  async function handleCreate() {
    setCreateError("");
    if (!fromId || !toId) { setCreateError("From and To locations are required."); return; }
    if (fromId === toId) { setCreateError("From and To cannot be the same location."); return; }
    if (items.length === 0) { setCreateError("Add at least one item."); return; }
    if (items.some((i) => !i.variant_id || i.quantity <= 0)) {
      setCreateError("All items must have a variant and quantity > 0."); return;
    }
    setCreateLoading(true);
    try {
      const number = generateNumber(transfers);
      await addDoc(collection(db, "transfers"), {
        number,
        from_location_id: fromId,
        to_location_id: toId,
        status: "draft",
        items,
        notes,
        createdAt: new Date(),
      });
      setView("list");
      setFromId(""); setToId(""); setNotes(""); setItems([]);
      await loadAll();
    } finally { setCreateLoading(false); }
  }

  // ── Mark as Done ──
  async function handleDone(transfer: Transfer) {
    setDoneLoading(true);
    try {
      const batch = writeBatch(db);

      for (const item of transfer.items) {
        const { variant_id, quantity } = item;

        // Deduct from source (unless Main)
        if (transfer.from_location_id !== MAIN_ID) {
          const stockSnap = await getDocs(query(
            collection(db, "stock"),
            where("variant_id", "==", variant_id),
            where("location_id", "==", transfer.from_location_id)
          ));
          if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            const newQty = (stockDoc.data().quantity || 0) - quantity;
            batch.update(stockDoc.ref, { quantity: Math.max(0, newQty) });
          }
        }

        // Add to destination (unless Main)
        if (transfer.to_location_id !== MAIN_ID) {
          const stockSnap = await getDocs(query(
            collection(db, "stock"),
            where("variant_id", "==", variant_id),
            where("location_id", "==", transfer.to_location_id)
          ));
          if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            const newQty = (stockDoc.data().quantity || 0) + quantity;
            batch.update(stockDoc.ref, { quantity: newQty });
          } else {
            // Create stock record if doesn't exist
            const newRef = doc(collection(db, "stock"));
            batch.set(newRef, {
              variant_id,
              location_id: transfer.to_location_id,
              quantity,
            });
          }
        }
      }

      // Update transfer status
      batch.update(doc(db, "transfers", transfer.id), { status: "done", doneAt: new Date() });
      await batch.commit();
      setDoneTransfer(null);
      setSelectedTransfer({ ...transfer, status: "done" });
      await loadAll();
    } finally { setDoneLoading(false); }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Detail View ──
  if (view === "detail" && selectedTransfer) {
    const t = selectedTransfer;
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon-sm" onClick={() => { setView("list"); setSelectedTransfer(null); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{t.number}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "done" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                  {t.status === "done" ? "Done" : "Draft"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <span>{getLocationName(t.from_location_id)}</span>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>{getLocationName(t.to_location_id)}</span>
              </div>
            </div>
          </div>
          {t.status === "draft" && (
            <Button onClick={() => setDoneTransfer(t)}>
              <CheckCircle className="h-4 w-4 mr-2" /> Mark as Done
            </Button>
          )}
        </div>

        {t.notes && (
          <p className="text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg">{t.notes}</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t.items.length} items</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Variant</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Qty</th>
                  {t.status === "draft" && t.from_location_id !== MAIN_ID && (
                    <th className="text-left py-3 px-4">Available at Source</th>
                  )}
                  <th className="text-left py-3 px-4">Stock in Other Locations</th>
                </tr>
              </thead>
              <tbody>
                {t.items.map((item, i) => {
                  const v = getVariant(item.variant_id);
                  const p = v?.productId ? getProduct(v.productId) : undefined;
                  const available = getStockQty(item.variant_id, t.from_location_id);
                  const otherStock = getStockAcrossLocations(item.variant_id)
                    .filter((x) => x.location.id !== t.from_location_id);
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{v?.name || item.variant_id}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p?.name || "—"}</td>
                      <td className="py-3 px-4 font-medium">{item.quantity}</td>
                      {t.status === "draft" && t.from_location_id !== MAIN_ID && (
                        <td className="py-3 px-4">
                          <span className={`text-sm font-medium ${typeof available === "number" && available < item.quantity ? "text-destructive" : "text-green-500"}`}>
                            {available}
                          </span>
                        </td>
                      )}
                      <td className="py-3 px-4">
                        {otherStock.length === 0 ? (
                          <span className="text-muted-foreground text-xs">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {otherStock.map((x) => (
                              <span key={x.location.id} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                {x.location.name}: {x.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Done Confirm */}
        <Dialog open={!!doneTransfer} onOpenChange={() => setDoneTransfer(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirm Transfer</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Mark <span className="text-foreground font-medium">{doneTransfer?.number}</span> as Done? This will update stock levels.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDoneTransfer(null)}>Cancel</Button>
              <Button onClick={() => doneTransfer && handleDone(doneTransfer)} disabled={doneLoading}>
                {doneLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Create View ──
  if (view === "create") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => { setView("list"); setFromId(""); setToId(""); setItems([]); setNotes(""); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">New Transfer</h1>
            <p className="text-sm text-muted-foreground mt-1">Create a stock transfer between locations</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">From</label>
                <SearchableSelect
                  options={allLocationOptions}
                  value={fromId}
                  onChange={setFromId}
                  placeholder="Select source"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">To</label>
                <SearchableSelect
                  options={allLocationOptions.filter((o) => o.value !== fromId)}
                  value={toId}
                  onChange={setToId}
                  placeholder="Select destination"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Notes (optional)</label>
              <input placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Items</CardTitle>
              <Button size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No items yet. Click "Add Item" to start.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const v = item.variant_id ? getVariant(item.variant_id) : null;
                  const available = item.variant_id && fromId ? getStockQty(item.variant_id, fromId) : null;
                  const otherStock = item.variant_id ? getStockAcrossLocations(item.variant_id) : [];

                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg border border-border/50">
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Variant</label>
                          <SearchableSelect
                            options={variantOptions}
                            value={item.variant_id}
                            onChange={(val) => updateItem(index, "variant_id", val)}
                            placeholder="Select variant"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 pt-5">
                        {/* Stock check button */}
                        {item.variant_id && (
                          <button
                            onClick={() => setStockCheckVariant(v || null)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> Check stock
                          </button>
                        )}
                        {/* Available at source */}
                        {available !== null && fromId !== MAIN_ID && (
                          <span className={`text-xs ${typeof available === "number" && available < item.quantity ? "text-destructive" : "text-green-500"}`}>
                            Available: {available}
                          </span>
                        )}
                        <Button variant="destructive" size="icon-sm" onClick={() => removeItem(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {createError && <p className="text-destructive text-sm">{createError}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setView("list"); setFromId(""); setToId(""); setItems([]); setNotes(""); }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createLoading}>
            {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Transfer
          </Button>
        </div>

        {/* Stock Check Dialog */}
        <Dialog open={!!stockCheckVariant} onOpenChange={() => setStockCheckVariant(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stock — {stockCheckVariant?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              {stockCheckVariant && (() => {
                const allStock = getStockAcrossLocations(stockCheckVariant.id);
                return allStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No stock found in any location.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-3">Location</th>
                        <th className="text-left py-2 px-3">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStock.map((x) => (
                        <tr key={x.location.id} className="border-b border-border/50">
                          <td className="py-2 px-3">{x.location.name}</td>
                          <td className="py-2 px-3 font-medium">{x.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStockCheckVariant(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── List View ──
  const draftCount = transfers.filter((t) => t.status === "draft").length;
  const doneCount = transfers.filter((t) => t.status === "done").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transfers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage stock transfers between locations</p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="h-4 w-4 mr-2" /> New Transfer
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{transfers.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Draft</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-500">{draftCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Done</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-500">{doneCount}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {transfers.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No transfers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Number</th>
                  <th className="text-left py-3 px-4">From</th>
                  <th className="text-left py-3 px-4">To</th>
                  <th className="text-left py-3 px-4">Items</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedTransfer(t); setView("detail"); }}
                  >
                    <td className="py-3 px-4 font-mono font-medium">{t.number}</td>
                    <td className="py-3 px-4">{getLocationName(t.from_location_id)}</td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        {getLocationName(t.to_location_id)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{t.items?.length || 0} items</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${t.status === "done" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                        {t.status === "done" ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {t.status === "done" ? "Done" : "Draft"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}