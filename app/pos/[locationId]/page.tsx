"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, doc, query, where, writeBatch,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/components/AuthContext";
import {
  Plus, Pencil, Trash2, Loader2, X,
  ShoppingCart, RotateCcw, Repeat2, Gift, Star, Search,
} from "lucide-react";

// ── Types ──
type TransactionType = "sale" | "refund" | "replacement" | "zerocost" | "ceo_request";
type Variant = { id: string; name: string; code?: string; productId?: string };
type Product = { id: string; name: string };
type Location = { id: string; name: string; type?: string };
type Pricelist = { id: string; name: string; isOriginal?: boolean };
type PriceItem = { id: string; pricelist_id: string; variant_id: string; price: number };
type PaymentMethod = { id: string; name: string };
type AppUser = { id: string; name: string; role: string };
type OrderProduct = {
  variant_id: string; quantity: number; unit_price: number;
  modified_price?: number; product_discount: number; final_price: number;
};
type PaymentEntry = { method_id: string; amount: number };
type ExistingOrder = {
  id: string; order_id: string; date: string;
  products: OrderProduct[]; pricelist_id: string;
  net_amount: number; location_id: string;
  sales_person_id: string;
  payments: PaymentEntry[];
  order_discount?: number;
  transaction_type?: string;
};

// ── Transaction Type Config ──
const TRANSACTION_TYPES: {
  value: TransactionType; label: string; icon: React.ReactNode;
  activeColor: string; activeBg: string; activeBorder: string;
}[] = [
  { value: "sale", label: "Sale", icon: <ShoppingCart className="h-3.5 w-3.5" />, activeColor: "text-blue-500", activeBg: "bg-blue-500/10", activeBorder: "border-blue-500/40" },
  { value: "refund", label: "Refund", icon: <RotateCcw className="h-3.5 w-3.5" />, activeColor: "text-red-500", activeBg: "bg-red-500/10", activeBorder: "border-red-500/40" },
  { value: "replacement", label: "Replacement", icon: <Repeat2 className="h-3.5 w-3.5" />, activeColor: "text-orange-500", activeBg: "bg-orange-500/10", activeBorder: "border-orange-500/40" },
  { value: "zerocost", label: "Zerocost", icon: <Gift className="h-3.5 w-3.5" />, activeColor: "text-green-500", activeBg: "bg-green-500/10", activeBorder: "border-green-500/40" },
  { value: "ceo_request", label: "CEO Request", icon: <Star className="h-3.5 w-3.5" />, activeColor: "text-purple-500", activeBg: "bg-purple-500/10", activeBorder: "border-purple-500/40" },
];

// ── Product Row (for Sale / Zerocost / CEO) ──
function ProductRow({ row, index, variants, products, onUpdate, onRemove, forceZero }: {
  row: OrderProduct; index: number; variants: Variant[]; products: Product[];
  onUpdate: (i: number, f: string, v: any) => void; onRemove: (i: number) => void;
  forceZero?: boolean;
}) {
  const [showDiscount, setShowDiscount] = useState(row.product_discount > 0);
  const [showModify, setShowModify] = useState(row.modified_price !== undefined);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const displayPrice = forceZero ? 0 : (row.modified_price !== undefined ? row.modified_price : row.unit_price);
  const afterDiscount = !forceZero && row.product_discount > 0 ? displayPrice * (1 - row.product_discount / 100) : null;

  return (
    <div className="p-4 bg-muted/20 rounded-lg border border-border/50 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">Product *</label>
          <SearchableSelect
            options={[...variants].sort((a, b) => a.name.localeCompare(b.name)).map((v) => {
              const pr = v.productId ? getProduct(v.productId) : undefined;
              return { value: v.id, label: `${v.name}${pr ? ` — ${pr.name}` : ""}` };
            })}
            value={row.variant_id}
            onChange={(val) => onUpdate(index, "variant_id", val)}
            placeholder="Select product"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Quantity *</label>
          <input type="number" min={1} value={row.quantity}
            onChange={(e) => onUpdate(index, "quantity", Number(e.target.value))} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Price</label>
            {forceZero ? (
              <div className="px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground">0</div>
            ) : (
              <div className="flex items-center gap-1">
                {showModify ? (
                  <input type="number" min={0} placeholder={String(row.unit_price)}
                    value={row.modified_price ?? ""}
                    onChange={(e) => onUpdate(index, "modified_price", e.target.value)} style={{ flex: 1 }} />
                ) : (
                  <div className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm">
                    {displayPrice > 0 ? displayPrice.toLocaleString() : "—"}
                  </div>
                )}
                <button onClick={() => { if (showModify) onUpdate(index, "modified_price", ""); setShowModify(!showModify); }}
                  className={`p-2 rounded-lg border transition-colors ${showModify ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <Button variant="destructive" size="icon-sm" onClick={() => onRemove(index)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {!forceZero && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Extra Discount</label>
          <button onClick={() => { if (showDiscount) onUpdate(index, "product_discount", 0); setShowDiscount(!showDiscount); }}
            className={`relative w-10 h-5 rounded-full transition-colors ${showDiscount ? "bg-primary" : "bg-muted"}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showDiscount ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          {showDiscount && (
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} value={row.product_discount}
                onChange={(e) => onUpdate(index, "product_discount", Number(e.target.value))} style={{ width: 80 }} />
              <span className="text-xs text-muted-foreground">%</span>
              {afterDiscount !== null && <span className="text-xs text-green-500 font-medium">{afterDiscount.toFixed(2)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Order Search Box ──
function OrderSearchBox({ onFound, allOrders, variants, products }: {
  onFound: (o: ExistingOrder) => void;
  allOrders: ExistingOrder[];
  variants: Variant[];
  products: Product[];
}) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<ExistingOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return [];
    const t = q.trim().toLowerCase();
    return allOrders.filter((o) =>
      (o.order_id || "").toString().toLowerCase().includes(t)
    ).slice(0, 10);
  }, [q, allOrders]);

  function select(o: ExistingOrder) {
    setQ(o.order_id?.toString() || "");
    setResult(o); setNotFound(false); setShowDropdown(false); onFound(o);
  }

  function search() {
    const trimmed = q.trim().toLowerCase();
    const found = allOrders.find((o) =>
      (o.order_id || "").toString().toLowerCase().trim() === trimmed
    );
    if (found) { select(found); }
    else if (filtered.length > 0) { select(filtered[0]); }
    else { setResult(null); setNotFound(true); }
  }

  const getVariantName = (id: string) => {
    const v = variants.find((v) => v.id === id);
    const p = v?.productId ? products.find((p) => p.id === v.productId) : undefined;
    return v ? `${v.name}${p ? ` — ${p.name}` : ""}` : id;
  };

  return (
    <div className="space-y-3">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input placeholder="Enter Order ID..." value={q}
            onChange={(e) => { setQ(e.target.value); setShowDropdown(true); setNotFound(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setShowDropdown(false); search(); } if (e.key === "Escape") setShowDropdown(false); }}
            onFocus={() => q && setShowDropdown(true)}
            className="w-full" />
          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {filtered.map((o) => (
                <button key={o.id} onClick={() => select(o)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left">
                  <span className="font-medium">{o.order_id}</span>
                  <span className="text-xs text-muted-foreground">{o.date} · {o.net_amount?.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => { setShowDropdown(false); search(); }}><Search className="h-4 w-4 mr-1" />Search</Button>
      </div>
      {notFound && <p className="text-xs text-destructive">Order not found. ({allOrders.length} orders loaded)</p>}
      {result && (
        <div className="p-3 bg-muted/20 rounded-lg border border-border/50 text-sm space-y-1">
          <p className="font-medium">{result.order_id} — {result.date}</p>
          <p className="text-xs text-muted-foreground">Net: {result.net_amount.toLocaleString()}</p>
          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
            {result.products.map((p, i) => (
              <p key={i}>• {getVariantName(p.variant_id)} × {p.quantity} @ {p.final_price.toLocaleString()}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── REFUND FORM ──
function RefundForm({ variants, products, pricelists, priceItems, allOrders, agents, payments, setPayments, paymentMethods, autoRefundOrderId, onDataChange }: any) {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [foundOrder, setFoundOrder] = useState<ExistingOrder | null>(null);
  // selected items: map of variant_id -> { qty, modifiedPrice }
  const [selectedItems, setSelectedItems] = useState<Record<string, { qty: number; modifiedPrice?: number; showModify: boolean; showExtraDiscount?: boolean; extraDiscount?: number }>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [condition, setCondition] = useState<"sealed" | "defect" | "">("");
  const [ticketNumber, setTicketNumber] = useState("");
  // Manual fields
  const [manualOrderId, setManualOrderId] = useState("");
  const [manualVariantId, setManualVariantId] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualPrice, setManualPrice] = useState(0);
  const [manualModifiedPrice, setManualModifiedPrice] = useState<number | undefined>(undefined);
  const [showManualModify, setShowManualModify] = useState(false);

  const getAgentName = (id: string) => agents.find((a: AppUser) => a.id === id)?.name || id;

  // Auto-fill from URL param
  useEffect(() => {
    if (!autoRefundOrderId || !allOrders.length) return;
    const found = allOrders.find((o: ExistingOrder) =>
      (o.order_id || "").toString().toLowerCase().trim() === autoRefundOrderId.toLowerCase().trim()
    );
    if (found) {
      setIsRegistered(true);
      setFoundOrder(found);
      setSelectedItems({});
      setSelectAll(false);
    }
  }, [autoRefundOrderId, allOrders]);

  // Auto-populate payments from original order (amount updated separately when items selected)
  useEffect(() => {
    if (foundOrder?.payments?.length) {
      setPayments(foundOrder.payments.map((p: PaymentEntry) => ({ method_id: p.method_id, amount: 0 })));
    }
  }, [foundOrder]);

  // When select all toggled
  useEffect(() => {
    if (!foundOrder) return;
    if (selectAll) {
      const all: Record<string, { qty: number; modifiedPrice?: number; showModify: boolean; showExtraDiscount?: boolean; extraDiscount?: number }> = {};
      foundOrder.products.forEach((p: OrderProduct) => {
        all[p.variant_id] = { qty: p.quantity, modifiedPrice: undefined, showModify: false };
      });
      setSelectedItems(all);
    } else {
      setSelectedItems({});
    }
  }, [selectAll]);

  const toggleItem = (variantId: string, originalQty: number, originalPrice: number) => {
    if (selectedItems[variantId]) {
      const n = { ...selectedItems };
      delete n[variantId];
      setSelectedItems(n);
    } else {
      setSelectedItems({ ...selectedItems, [variantId]: { qty: originalQty, modifiedPrice: undefined, showModify: false } });
    }
  };

  const updateItem = (variantId: string, field: string, value: any) => {
    setSelectedItems({ ...selectedItems, [variantId]: { ...selectedItems[variantId], [field]: value } });
  };

  const grandTotal = useMemo(() => {
    if (!foundOrder) return 0;
    return foundOrder.products
      .filter((p: OrderProduct) => selectedItems[p.variant_id])
      .reduce((sum: number, p: OrderProduct) => {
        const item = selectedItems[p.variant_id];
        const basePrice = p.final_price;
        const extraDiscount = item.extraDiscount || 0;
        const priceAfterExtra = item.showExtraDiscount && extraDiscount > 0
          ? basePrice * (1 - extraDiscount / 100)
          : basePrice;
        const effectivePrice = item.modifiedPrice !== undefined ? item.modifiedPrice : priceAfterExtra;
        return sum + effectivePrice * item.qty;
      }, 0);
  }, [selectedItems, foundOrder]);

  // Update payment amounts proportionally when grandTotal changes
  useEffect(() => {
    if (!foundOrder?.payments?.length || grandTotal === 0) return;
    const originalTotal = foundOrder.payments.reduce((s: number, p: PaymentEntry) => s + p.amount, 0);
    if (originalTotal === 0) return;
    setPayments(foundOrder.payments.map((p: PaymentEntry) => ({
      method_id: p.method_id,
      amount: Math.round((p.amount / originalTotal) * grandTotal * 100) / 100,
    })));
  }, [grandTotal]);

  const manualDisplayPrice = manualModifiedPrice !== undefined ? manualModifiedPrice : manualPrice;

  useEffect(() => {
    onDataChange({
      isRegistered, foundOrder, selectedItems, grandTotal,
      condition, ticketNumber,
      manualOrderId, manualVariantId, manualQty, manualPrice, manualModifiedPrice, manualDisplayPrice,
    });
  }, [isRegistered, foundOrder, selectedItems, condition, ticketNumber,
    manualOrderId, manualVariantId, manualQty, manualPrice, manualModifiedPrice]);

  return (
    <div className="space-y-4">
      {/* Registered toggle */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Is this order registered in the system?</p>
          <div className="flex gap-2">
            <button onClick={() => { setIsRegistered(true); setFoundOrder(null); setSelectedItems({}); setSelectAll(false); }}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${isRegistered === true ? "bg-blue-500/10 border-blue-500/40 text-blue-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
              ✓ Registered
            </button>
            <button onClick={() => { setIsRegistered(false); setFoundOrder(null); setSelectedItems({}); setPayments([]); }}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${isRegistered === false ? "bg-orange-500/10 border-orange-500/40 text-orange-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
              ✗ Not Registered
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Registered flow */}
      {isRegistered === true && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm font-medium">Search Order</p>
            <OrderSearchBox onFound={(o) => { setFoundOrder(o); setSelectedItems({}); setSelectAll(false); }} allOrders={allOrders} variants={variants} products={products} />
            {foundOrder && (
              <div className="space-y-4">
                {/* Agent + original payments info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/20 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Sales Agent</p>
                    <p className="text-sm font-medium">{getAgentName(foundOrder.sales_person_id)}</p>
                  </div>
                  <div className="p-3 bg-muted/20 rounded-lg border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Original Net Amount</p>
                    <p className="text-sm font-medium">{foundOrder.net_amount?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Items selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Select Items to Return</label>
                    <button onClick={() => setSelectAll(!selectAll)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${selectAll ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {selectAll ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  {foundOrder.products.map((p: OrderProduct) => {
                    const v = variants.find((v: Variant) => v.id === p.variant_id);
                    const pr = v?.productId ? products.find((pr: Product) => pr.id === v.productId) : undefined;
                    const isSelected = !!selectedItems[p.variant_id];
                    const item = selectedItems[p.variant_id];
                    const basePrice = p.final_price;
                    const extraDiscount = item?.extraDiscount || 0;
                    const priceAfterExtra = item?.showExtraDiscount && extraDiscount > 0
                      ? basePrice * (1 - extraDiscount / 100)
                      : basePrice;
                    const effectivePrice = item?.modifiedPrice !== undefined ? item.modifiedPrice : priceAfterExtra;
                    const lineTotal = effectivePrice * (item?.qty || p.quantity);
                    return (
                      <div key={p.variant_id} className={`rounded-lg border transition-all ${isSelected ? "border-primary/40 bg-primary/5" : "border-border/50 bg-muted/10"}`}>
                        {/* Row header */}
                        <div className="flex items-center gap-3 p-3">
                          <button onClick={() => toggleItem(p.variant_id, p.quantity, p.final_price)}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary border-primary text-white" : "border-border"}`}>
                            {isSelected && <span className="text-xs">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{v?.name || p.variant_id}{pr ? ` — ${pr.name}` : ""}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <p className="text-xs text-muted-foreground">
                                Pricelist: {p.unit_price?.toLocaleString() || p.final_price.toLocaleString()}
                              </p>
                              {(p.product_discount || 0) > 0 && (
                                <span className="text-xs bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                                  {p.product_discount}% off → {p.final_price.toLocaleString()}
                                </span>
                              )}
                              <p className="text-xs text-muted-foreground">× {p.quantity}</p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">Refund</p>
                              <p className="text-sm font-semibold text-red-500">-{lineTotal.toLocaleString()}</p>
                            </div>
                          )}
                        </div>

                        {/* Selected controls */}
                        {isSelected && (
                          <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                            <div className="flex items-center gap-4 flex-wrap">
                              {/* Qty */}
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">Qty:</p>
                                <input type="number" min={1} max={p.quantity} value={item.qty}
                                  onChange={(e) => updateItem(p.variant_id, "qty", Number(e.target.value))}
                                  style={{ width: 60 }} className="text-xs" />
                                <p className="text-xs text-muted-foreground">/ {p.quantity}</p>
                              </div>

                              {/* Extra Discount switch */}
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">Extra Discount</p>
                                <button
                                  onClick={() => {
                                    updateItem(p.variant_id, "showExtraDiscount", !item.showExtraDiscount);
                                    if (item.showExtraDiscount) updateItem(p.variant_id, "extraDiscount", 0);
                                  }}
                                  className={`relative w-8 h-4 rounded-full transition-colors ${item.showExtraDiscount ? "bg-primary" : "bg-muted"}`}>
                                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${item.showExtraDiscount ? "translate-x-4" : "translate-x-0.5"}`} />
                                </button>
                                {item.showExtraDiscount && (
                                  <div className="flex items-center gap-1">
                                    <input type="number" min={0} max={100} value={item.extraDiscount || ""}
                                      onChange={(e) => updateItem(p.variant_id, "extraDiscount", Number(e.target.value))}
                                      style={{ width: 55 }} className="text-xs" />
                                    <span className="text-xs text-muted-foreground">%</span>
                                    {extraDiscount > 0 && (
                                      <span className="text-xs text-green-500 font-medium">
                                        → {priceAfterExtra.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Modify price */}
                              <div className="flex items-center gap-1">
                                <p className="text-xs text-muted-foreground">Override:</p>
                                {item.showModify ? (
                                  <input type="number" min={0} value={item.modifiedPrice ?? ""}
                                    onChange={(e) => updateItem(p.variant_id, "modifiedPrice", e.target.value === "" ? undefined : Number(e.target.value))}
                                    style={{ width: 80 }} className="text-xs" />
                                ) : (
                                  <div className="px-2 py-1 bg-card border border-border rounded text-xs">
                                    {effectivePrice.toLocaleString()}
                                  </div>
                                )}
                                <button onClick={() => { updateItem(p.variant_id, "showModify", !item.showModify); if (item.showModify) updateItem(p.variant_id, "modifiedPrice", undefined); }}
                                  className={`p-1 rounded border transition-colors ${item.showModify ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grand Total */}
                {Object.keys(selectedItems).length > 0 && (
                  <div className="flex justify-between items-center p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <span className="text-sm font-medium">Grand Total to Refund</span>
                    <span className="text-lg font-bold text-red-500">-{grandTotal.toLocaleString()}</span>
                  </div>
                )}

                {/* Payment methods — auto-filled from original order */}
                {Object.keys(selectedItems).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Refund via</p>
                      <Button size="sm" onClick={() => setPayments([...payments, { method_id: "", amount: 0 }])}>
                        <Plus className="h-4 w-4 mr-1" />Add
                      </Button>
                    </div>
                    {payments.map((p: PaymentEntry, index: number) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1">
                          <SearchableSelect
                            options={paymentMethods.map((m: PaymentMethod) => ({ value: m.id, label: m.name }))}
                            value={p.method_id}
                            onChange={(val) => { const u = [...payments]; u[index] = { ...u[index], method_id: val }; setPayments(u); }}
                            placeholder="Select method"
                          />
                        </div>
                        <input type="number" min={0} value={p.amount}
                          onChange={(e) => { const u = [...payments]; u[index] = { ...u[index], amount: Number(e.target.value) }; setPayments(u); }}
                          style={{ width: 120 }} />
                        <Button variant="destructive" size="icon-sm" onClick={() => setPayments(payments.filter((_: any, i: number) => i !== index))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Not Registered flow */}
      {isRegistered === false && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">Manual Entry</p>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Order ID (Reference)</label>
              <input placeholder="e.g. ORD-0001" value={manualOrderId} onChange={(e) => setManualOrderId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Variant *</label>
              <SearchableSelect
                options={[...variants].sort((a: Variant, b: Variant) => a.name.localeCompare(b.name)).map((v: Variant) => {
                  const pr = v.productId ? products.find((p: Product) => p.id === v.productId) : undefined;
                  return { value: v.id, label: `${v.name}${pr ? ` — ${pr.name}` : ""}` };
                })}
                value={manualVariantId}
                onChange={setManualVariantId}
                placeholder="Select variant"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Quantity *</label>
                <input type="number" min={1} value={manualQty} onChange={(e) => setManualQty(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Price</label>
                <div className="flex items-center gap-1">
                  {showManualModify ? (
                    <input type="number" min={0} value={manualModifiedPrice ?? ""}
                      onChange={(e) => setManualModifiedPrice(e.target.value === "" ? undefined : Number(e.target.value))}
                      style={{ flex: 1 }} />
                  ) : (
                    <input type="number" min={0} value={manualPrice} onChange={(e) => setManualPrice(Number(e.target.value))} style={{ flex: 1 }} />
                  )}
                  <button onClick={() => { if (showManualModify) setManualModifiedPrice(undefined); setShowManualModify(!showManualModify); }}
                    className={`p-2 rounded-lg border transition-colors ${showManualModify ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Total: -{(manualDisplayPrice * manualQty).toLocaleString()}</p>
              </div>
            </div>
            {/* Manual payments */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Refund via</p>
                <Button size="sm" onClick={() => setPayments([...payments, { method_id: "", amount: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
              {payments.map((p: PaymentEntry, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <SearchableSelect
                      options={paymentMethods.map((m: PaymentMethod) => ({ value: m.id, label: m.name }))}
                      value={p.method_id}
                      onChange={(val) => { const u = [...payments]; u[index] = { ...u[index], method_id: val }; setPayments(u); }}
                      placeholder="Select method"
                    />
                  </div>
                  <input type="number" min={0} value={p.amount}
                    onChange={(e) => { const u = [...payments]; u[index] = { ...u[index], amount: Number(e.target.value) }; setPayments(u); }}
                    style={{ width: 120 }} />
                  <Button variant="destructive" size="icon-sm" onClick={() => setPayments(payments.filter((_: any, i: number) => i !== index))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Condition - Required */}
      {isRegistered !== null && (
        <Card className={!condition && isRegistered !== null ? "border-destructive/50" : ""}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Product Condition</p>
              <span className="text-destructive text-sm">*</span>
              {!condition && <span className="text-xs text-destructive ml-auto">Required</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCondition("sealed")}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${condition === "sealed" ? "bg-green-500/10 border-green-500/40 text-green-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
                📦 Sealed — Return to Stock
              </button>
              <button onClick={() => setCondition("defect")}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${condition === "defect" ? "bg-red-500/10 border-red-500/40 text-red-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
                ⚠️ Defect — No Stock Return
              </button>
            </div>
            {condition === "defect" && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Ticket Number</label>
                <input placeholder="Enter ticket number..." value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── REPLACEMENT FORM ──
function ReplacementForm({ variants, products, pricelists, priceItems, allOrders, payments, setPayments, paymentMethods, onDataChange }: any) {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [foundOrder, setFoundOrder] = useState<ExistingOrder | null>(null);
  const [oldVariantId, setOldVariantId] = useState("");
  const [oldQty, setOldQty] = useState(1);
  const [newProducts, setNewProducts] = useState<OrderProduct[]>([]);
  const [condition, setCondition] = useState<"sealed" | "defect" | "">("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [pricelistId, setPricelistId] = useState("");
  // Manual
  const [manualOrderId, setManualOrderId] = useState("");
  const [manualOldVariantId, setManualOldVariantId] = useState("");
  const [manualOldQty, setManualOldQty] = useState(1);
  const [manualOldPrice, setManualOldPrice] = useState(0);

  const getPrice = (variantId: string, plId: string) =>
    priceItems.find((i: PriceItem) => i.pricelist_id === plId && i.variant_id === variantId)?.price ?? 0;

  const oldPrice = useMemo(() => {
    if (!oldVariantId || !pricelistId) return 0;
    return getPrice(oldVariantId, pricelistId);
  }, [oldVariantId, pricelistId]);

  const newTotal = useMemo(() =>
    newProducts.reduce((sum, p) => sum + p.final_price * p.quantity, 0), [newProducts]);

  const oldTotal = isRegistered ? oldPrice * oldQty : manualOldPrice * manualOldQty;
  const difference = newTotal - oldTotal;

  function addNewProduct() {
    setNewProducts([...newProducts, { variant_id: "", quantity: 1, unit_price: 0, product_discount: 0, final_price: 0 }]);
  }

  function updateNewProduct(index: number, field: string, value: any) {
    const updated = [...newProducts];
    const row = { ...updated[index], [field]: value };
    if (field === "variant_id" && pricelistId) {
      row.unit_price = getPrice(value, pricelistId);
      row.modified_price = undefined;
    }
    if (field === "modified_price") row.modified_price = value === "" ? undefined : Number(value);
    if (field === "quantity") row.quantity = Number(value);
    if (field === "product_discount") row.product_discount = Number(value);
    const base = row.modified_price !== undefined ? row.modified_price : row.unit_price;
    row.final_price = base * (1 - row.product_discount / 100);
    updated[index] = row;
    setNewProducts(updated);
  }

  useEffect(() => {
    onDataChange({
      isRegistered, foundOrder, oldVariantId, oldQty, oldPrice, oldTotal,
      newProducts, newTotal, difference, condition, ticketNumber, pricelistId,
      manualOrderId, manualOldVariantId, manualOldQty, manualOldPrice,
    });
  }, [isRegistered, foundOrder, oldVariantId, oldQty, newProducts, condition, ticketNumber,
    pricelistId, manualOrderId, manualOldVariantId, manualOldQty, manualOldPrice]);

  return (
    <div className="space-y-4">
      {/* Registered toggle */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Is this order registered in the system?</p>
          <div className="flex gap-2">
            <button onClick={() => setIsRegistered(true)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${isRegistered === true ? "bg-blue-500/10 border-blue-500/40 text-blue-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
              ✓ Registered
            </button>
            <button onClick={() => setIsRegistered(false)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${isRegistered === false ? "bg-orange-500/10 border-orange-500/40 text-orange-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
              ✗ Not Registered
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Pricelist */}
      {isRegistered !== null && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Pricelist *</label>
              <SearchableSelect
                options={[...pricelists].sort((a: Pricelist, b: Pricelist) => a.name.localeCompare(b.name)).map((p: Pricelist) => ({
                  value: p.id, label: p.name + (p.isOriginal ? " (Original)" : ""),
                }))}
                value={pricelistId}
                onChange={(val) => {
                  setPricelistId(val);
                  setNewProducts(newProducts.map((p) => {
                    const newPrice = getPrice(p.variant_id, val);
                    return { ...p, unit_price: newPrice, modified_price: undefined, final_price: newPrice * (1 - p.product_discount / 100) };
                  }));
                }}
                placeholder="Select pricelist"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registered: search + old variant */}
      {isRegistered === true && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm font-medium">Search Original Order</p>
            <OrderSearchBox onFound={setFoundOrder} allOrders={allOrders} variants={variants} products={products} />
            {foundOrder && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Variant to Replace (Old) *</label>
                  <SearchableSelect
                    options={foundOrder.products.map((p: OrderProduct) => {
                      const v = variants.find((v: Variant) => v.id === p.variant_id);
                      const pr = v?.productId ? products.find((pr: Product) => pr.id === v.productId) : undefined;
                      return { value: p.variant_id, label: `${v?.name || p.variant_id}${pr ? ` — ${pr.name}` : ""}` };
                    })}
                    value={oldVariantId}
                    onChange={setOldVariantId}
                    placeholder="Select old variant"
                  />
                </div>
                {oldVariantId && (
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Quantity</label>
                    <input type="number" min={1} value={oldQty} onChange={(e) => setOldQty(Number(e.target.value))} style={{ width: 120 }} />
                    <p className="text-xs text-muted-foreground">Price: {oldPrice.toLocaleString()} × {oldQty} = {oldTotal.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Not registered: manual old product */}
      {isRegistered === false && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">Old Product (Manual)</p>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Order ID</label>
              <input placeholder="e.g. ORD-0001" value={manualOrderId} onChange={(e) => setManualOrderId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Old Variant *</label>
              <SearchableSelect
                options={[...variants].sort((a: Variant, b: Variant) => a.name.localeCompare(b.name)).map((v: Variant) => {
                  const pr = v.productId ? products.find((p: Product) => p.id === v.productId) : undefined;
                  return { value: v.id, label: `${v.name}${pr ? ` — ${pr.name}` : ""}` };
                })}
                value={manualOldVariantId}
                onChange={(val) => {
                  setManualOldVariantId(val);
                  if (pricelistId) setManualOldPrice(getPrice(val, pricelistId));
                }}
                placeholder="Select old variant"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Quantity</label>
                <input type="number" min={1} value={manualOldQty} onChange={(e) => setManualOldQty(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Price</label>
                <input type="number" min={0} value={manualOldPrice} onChange={(e) => setManualOldPrice(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Total: {(manualOldPrice * manualOldQty).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Products */}
      {isRegistered !== null && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">New Product(s) *</CardTitle>
              <Button size="sm" onClick={addNewProduct}><Plus className="h-4 w-4 mr-1" />Add Product</Button>
            </div>
          </CardHeader>
          <CardContent>
            {newProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">No new products yet.</p>
            ) : (
              <div className="space-y-3">
                {newProducts.map((row, index) => (
                  <ProductRow key={index} row={row} index={index} variants={variants} products={products}
                    onUpdate={updateNewProduct} onRemove={(i) => setNewProducts(newProducts.filter((_, idx) => idx !== i))} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Condition */}
      {isRegistered !== null && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">Old Product Condition</p>
            <div className="flex gap-2">
              <button onClick={() => setCondition("sealed")}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${condition === "sealed" ? "bg-green-500/10 border-green-500/40 text-green-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
                📦 Sealed — Return to Stock
              </button>
              <button onClick={() => setCondition("defect")}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${condition === "defect" ? "bg-red-500/10 border-red-500/40 text-red-500" : "border-border text-muted-foreground hover:border-border/80"}`}>
                ⚠️ Defect — No Stock Return
              </button>
            </div>
            {condition === "defect" && (
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Ticket Number</label>
                <input placeholder="Enter ticket number..." value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Difference Summary */}
      {isRegistered !== null && newProducts.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2 text-sm max-w-sm ml-auto">
              <div className="flex justify-between text-muted-foreground">
                <span>Old Product Value</span><span>{oldTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>New Product(s) Value</span><span>{newTotal.toLocaleString()}</span>
              </div>
              <div className={`flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2 ${difference > 0 ? "text-destructive" : "text-green-500"}`}>
                <span>Difference</span>
                <span>{difference > 0 ? `+${difference.toLocaleString()}` : difference.toLocaleString()}</span>
              </div>
              {difference > 0 && <p className="text-xs text-muted-foreground">Customer pays the difference.</p>}
              {difference < 0 && <p className="text-xs text-muted-foreground">Refund to customer.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments (only if difference != 0) */}
      {isRegistered !== null && condition && difference !== 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <Button size="sm" onClick={() => setPayments([...payments, { method_id: "", amount: Math.abs(difference) }])}>
                <Plus className="h-4 w-4 mr-1" />Add Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">No payment methods added.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((p: PaymentEntry, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <SearchableSelect
                        options={paymentMethods.map((m: PaymentMethod) => ({ value: m.id, label: m.name }))}
                        value={p.method_id}
                        onChange={(val) => { const u = [...payments]; u[index] = { ...u[index], method_id: val }; setPayments(u); }}
                        placeholder="Select method"
                      />
                    </div>
                    <input type="number" min={0} value={p.amount}
                      onChange={(e) => { const u = [...payments]; u[index] = { ...u[index], amount: Number(e.target.value) }; setPayments(u); }}
                      style={{ width: 120 }} />
                    <Button variant="destructive" size="icon-sm" onClick={() => setPayments(payments.filter((_: any, i: number) => i !== index))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ── MAIN PAGE ──
// ══════════════════════════════════════════
export default function POSCreatePage() {
  const params = useParams();
  const locationId = params?.locationId as string;
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [transactionType, setTransactionType] = useState<TransactionType>("sale");
  const [autoRefundOrderId, setAutoRefundOrderId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [allOrders, setAllOrders] = useState<ExistingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [success, setSuccess] = useState(false);

  // Sale / Zerocost / CEO fields
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [orderId, setOrderId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [pricelistId, setPricelistId] = useState("");
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDiscountEnabled, setOrderDiscountEnabled] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [note, setNote] = useState("");

  // Refund / Replacement data (from child forms)
  const [refundData, setRefundData] = useState<any>({});
  const [replacementData, setReplacementData] = useState<any>({});

  // Shared payments for refund/replacement
  const [subPayments, setSubPayments] = useState<PaymentEntry[]>([]);

  const activeType = TRANSACTION_TYPES.find((t) => t.value === transactionType)!;
  const forceZero = transactionType === "zerocost" || transactionType === "ceo_request";

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [vSnap, pSnap, lSnap, plSnap, piSnap, pmSnap, uSnap, oSnap] = await Promise.all([
        getDocs(collection(db, "variants")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "locations")),
        getDocs(collection(db, "pricelists")),
        getDocs(collection(db, "pricelist_items")),
        getDocs(collection(db, "payment_methods")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "orders")),
      ]);
      setVariants(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
      setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      const loc = lSnap.docs.find((d) => d.id === locationId);
      if (loc) setLocation({ id: loc.id, ...loc.data() } as Location);
      const pls = plSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pricelist));
      setPricelists(pls);
      setPriceItems(piSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceItem)));
      setPaymentMethods(pmSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod)));
      setAgents(uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
      const loadedOrders = oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ExistingOrder));
      setAllOrders(loadedOrders);
      // Auto-open refund if ?refund= param present
      const refundParam = searchParams?.get("refund");
      if (refundParam) {
        setTransactionType("refund");
        setAutoRefundOrderId(refundParam);
      }
      const original = pls.find((p) => p.isOriginal);
      if (original) setPricelistId(original.id);
      if ((user as any)?.id) setSalesPersonId((user as any).id);
      setLoading(false);
    }
    load();
  }, [locationId, user]);

  function getPriceFromPricelist(variantId: string, plId: string) {
    return priceItems.find((i) => i.pricelist_id === plId && i.variant_id === variantId)?.price ?? 0;
  }
  function getOriginalPrice(variantId: string) {
    const original = pricelists.find((p) => p.isOriginal);
    if (!original) return 0;
    return getPriceFromPricelist(variantId, original.id);
  }
  function calcFinalPrice(unitPrice: number, modifiedPrice: number | undefined, discountPct: number) {
    const base = modifiedPrice !== undefined ? modifiedPrice : unitPrice;
    return base * (1 - discountPct / 100);
  }
  function addProductRow() {
    setOrderProducts([...orderProducts, { variant_id: "", quantity: 1, unit_price: 0, product_discount: 0, final_price: 0 }]);
  }
  function updateProductRow(index: number, field: string, value: any) {
    const updated = [...orderProducts];
    const row = { ...updated[index], [field]: value };
    if (field === "variant_id" && pricelistId) { row.unit_price = getPriceFromPricelist(value, pricelistId); row.modified_price = undefined; }
    if (field === "modified_price") row.modified_price = value === "" ? undefined : Number(value);
    if (field === "quantity") row.quantity = Number(value);
    if (field === "product_discount") row.product_discount = Number(value);
    row.final_price = forceZero ? 0 : calcFinalPrice(row.unit_price, row.modified_price, row.product_discount);
    updated[index] = row;
    setOrderProducts(updated);
  }
  function removeProductRow(index: number) { setOrderProducts(orderProducts.filter((_, i) => i !== index)); }

  const plTotal = useMemo(() => orderProducts.reduce((sum, p) => sum + p.final_price * p.quantity, 0), [orderProducts]);
  const originalTotal = useMemo(() => orderProducts.reduce((sum, p) => sum + getOriginalPrice(p.variant_id) * p.quantity, 0), [orderProducts, pricelists, priceItems]);
  const afterOrderDiscount = orderDiscountEnabled ? plTotal * (1 - orderDiscount / 100) : plTotal;
  const totalDiscount = originalTotal - afterOrderDiscount;
  const netAmount = forceZero ? 0 : afterOrderDiscount;

  function addPayment() {
    const remaining = netAmount - payments.reduce((s, p) => s + p.amount, 0);
    setPayments([...payments, { method_id: "", amount: Math.max(0, Number(remaining.toFixed(2))) }]);
  }
  function updatePayment(index: number, field: string, value: any) {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: field === "amount" ? Number(value) : value };
    setPayments(updated);
  }
  function removePayment(index: number) { setPayments(payments.filter((_, i) => i !== index)); }

  function resetForm() {
    setDate(today); setOrderId(""); setSalesPersonId((user as any)?.id || "");
    setOrderProducts([]); setOrderDiscount(0); setOrderDiscountEnabled(false);
    setPayments([]); setSubPayments([]); setNote(""); setCreateError("");
    const original = pricelists.find((p) => p.isOriginal);
    if (original) setPricelistId(original.id); else setPricelistId("");
  }

  async function handleCreate() {
    setCreateError(""); setCreateLoading(true);
    try {
      const batch = writeBatch(db);

      // ── SALE / ZEROCOST / CEO ──
      if (["sale", "zerocost", "ceo_request"].includes(transactionType)) {
        if (!date || !orderId.trim() || !salesPersonId || !pricelistId) { setCreateError("Please fill all required fields."); setCreateLoading(false); return; }
        if (orderProducts.length === 0 || orderProducts.some((p) => !p.variant_id || p.quantity <= 0)) { setCreateError("Add valid products."); setCreateLoading(false); return; }
        if (!forceZero && (payments.length === 0 || payments.some((p) => !p.method_id || p.amount <= 0))) { setCreateError("Add valid payment methods."); setCreateLoading(false); return; }

        // Stock check
        for (const item of orderProducts) {
          const stockSnap = await getDocs(query(collection(db, "stock"), where("variant_id", "==", item.variant_id), where("location_id", "==", locationId)));
          const available = stockSnap.empty ? 0 : (stockSnap.docs[0].data().quantity || 0);
          if (available < item.quantity) {
            const v = variants.find((v) => v.id === item.variant_id);
            setCreateError(`Insufficient stock for "${v?.name}": available ${available}, requested ${item.quantity}.`);
            setCreateLoading(false); return;
          }
        }
        // Deduct stock
        for (const item of orderProducts) {
          const stockSnap = await getDocs(query(collection(db, "stock"), where("variant_id", "==", item.variant_id), where("location_id", "==", locationId)));
          if (!stockSnap.empty) batch.update(stockSnap.docs[0].ref, { quantity: (stockSnap.docs[0].data().quantity || 0) - item.quantity });
        }
        const cleanProducts = orderProducts.map((p) => {
          const c: any = { variant_id: p.variant_id, quantity: p.quantity, unit_price: forceZero ? 0 : p.unit_price, product_discount: p.product_discount, final_price: forceZero ? 0 : p.final_price };
          if (!forceZero && p.modified_price !== undefined) c.modified_price = p.modified_price;
          return c;
        });
        const orderRef = doc(collection(db, "orders"));
        batch.set(orderRef, {
          order_id: orderId, date, transaction_type: transactionType,
          sales_person_id: salesPersonId, location_id: locationId, pricelist_id: pricelistId,
          products: cleanProducts, order_discount: orderDiscountEnabled ? orderDiscount : 0,
          payments: forceZero ? [] : payments,
          original_total: forceZero ? 0 : originalTotal,
          pricelist_total: forceZero ? 0 : plTotal,
          total_discount: forceZero ? 0 : totalDiscount,
          net_amount: forceZero ? 0 : netAmount,
          type: "done",
          ...(note ? { note } : {}),
          createdAt: new Date(),
        });
      }

      // ── REFUND ──
      else if (transactionType === "refund") {
        const d = refundData;
        if (!d.condition) { setCreateError("Select product condition."); setCreateLoading(false); return; }

        if (d.isRegistered) {
          // Registered: use selectedItems
          const selected = d.selectedItems as Record<string, { qty: number; modifiedPrice?: number }>;
          if (!selected || Object.keys(selected).length === 0) { setCreateError("Select at least one item to refund."); setCreateLoading(false); return; }
          if (!d.foundOrder) { setCreateError("No order found."); setCreateLoading(false); return; }

          // Return stock if sealed
          if (d.condition === "sealed") {
            for (const [varId, item] of Object.entries(selected)) {
              const stockSnap = await getDocs(query(collection(db, "stock"), where("variant_id", "==", varId), where("location_id", "==", locationId)));
              if (!stockSnap.empty) batch.update(stockSnap.docs[0].ref, { quantity: (stockSnap.docs[0].data().quantity || 0) + item.qty });
              else { const newRef = doc(collection(db, "stock")); batch.set(newRef, { variant_id: varId, location_id: locationId, quantity: item.qty }); }
            }
          }

          const refundProducts = d.foundOrder.products
            .filter((p: OrderProduct) => selected[p.variant_id])
            .map((p: OrderProduct) => {
              const item = selected[p.variant_id];
              const price = item.modifiedPrice !== undefined ? item.modifiedPrice : p.final_price;
              return { variant_id: p.variant_id, quantity: item.qty, unit_price: price, final_price: price, product_discount: 0 };
            });

          const orderRef = doc(collection(db, "orders"));
          batch.set(orderRef, {
            transaction_type: "refund",
            is_registered: true,
            order_id: d.foundOrder.order_id,
            original_order_id: d.foundOrder.order_id,
            original_order_ref: d.foundOrder.id,
            pricelist_id: d.foundOrder.pricelist_id || "",
            location_id: locationId,
            products: refundProducts,
            net_amount: -d.grandTotal,
            condition: d.condition,
            ...(d.condition === "defect" ? { ticket_number: d.ticketNumber } : {}),
            payments: subPayments,
            sales_person_id: d.foundOrder.sales_person_id,
            date: today,
            type: "done",
            createdAt: new Date(),
          });
        } else {
          // Not registered: manual
          const varId = d.manualVariantId;
          const qty = d.manualQty;
          const price = d.manualDisplayPrice;
          if (!varId) { setCreateError("Select a variant to refund."); setCreateLoading(false); return; }
          if (d.condition === "sealed") {
            const stockSnap = await getDocs(query(collection(db, "stock"), where("variant_id", "==", varId), where("location_id", "==", locationId)));
            if (!stockSnap.empty) batch.update(stockSnap.docs[0].ref, { quantity: (stockSnap.docs[0].data().quantity || 0) + qty });
            else { const newRef = doc(collection(db, "stock")); batch.set(newRef, { variant_id: varId, location_id: locationId, quantity: qty }); }
          }
          const orderRef = doc(collection(db, "orders"));
          batch.set(orderRef, {
            transaction_type: "refund",
            is_registered: false,
            order_id: d.manualOrderId || "",
            original_order_id: d.manualOrderId,
            pricelist_id: "",
            location_id: locationId,
            products: [{ variant_id: varId, quantity: qty, unit_price: price, final_price: price, product_discount: 0 }],
            net_amount: -(price * qty),
            condition: d.condition,
            ...(d.condition === "defect" ? { ticket_number: d.ticketNumber } : {}),
            payments: subPayments,
            sales_person_id: salesPersonId,
            date: today,
            type: "done",
            createdAt: new Date(),
          });
        }
      }

      // ── REPLACEMENT ──
      else if (transactionType === "replacement") {
        const d = replacementData;
        if (!d.condition) { setCreateError("Select old product condition."); setCreateLoading(false); return; }
        if (!d.newProducts || d.newProducts.length === 0) { setCreateError("Add new products."); setCreateLoading(false); return; }
        const oldVarId = d.isRegistered ? d.oldVariantId : d.manualOldVariantId;
        const oldQty = d.isRegistered ? d.oldQty : d.manualOldQty;

        // Return old stock if sealed
        if (d.condition === "sealed" && oldVarId) {
          const stockSnap = await getDocs(query(collection(db, "stock"), where("variant_id", "==", oldVarId), where("location_id", "==", locationId)));
          if (!stockSnap.empty) batch.update(stockSnap.docs[0].ref, { quantity: (stockSnap.docs[0].data().quantity || 0) + oldQty });
          else {
            const newRef = doc(collection(db, "stock"));
            batch.set(newRef, { variant_id: oldVarId, location_id: locationId, quantity: oldQty });
          }
        }
        // Deduct new products stock
        for (const item of d.newProducts) {
          const stockSnap = await getDocs(query(collection(db, "stock"), where("variant_id", "==", item.variant_id), where("location_id", "==", locationId)));
          if (!stockSnap.empty) batch.update(stockSnap.docs[0].ref, { quantity: (stockSnap.docs[0].data().quantity || 0) - item.quantity });
        }
        const orderRef = doc(collection(db, "orders"));
        batch.set(orderRef, {
          transaction_type: "replacement",
          is_registered: d.isRegistered ?? false,
          order_id: d.isRegistered ? (d.foundOrder?.order_id || "") : (d.manualOrderId || ""),
          original_order_id: d.isRegistered ? (d.foundOrder?.order_id || "") : (d.manualOrderId || ""),
          original_order_ref: d.isRegistered ? (d.foundOrder?.id || "") : "",
          location_id: locationId,
          pricelist_id: d.isRegistered ? (d.foundOrder?.pricelist_id || d.pricelistId || "") : (d.pricelistId || ""),
          old_product: { variant_id: oldVarId || "", quantity: oldQty || 0, price: d.oldTotal || 0 },
          new_products: (d.newProducts || []).map((p: any) => ({
            variant_id: p.variant_id || "",
            quantity: p.quantity || 0,
            unit_price: p.unit_price || 0,
            final_price: p.final_price || 0,
            product_discount: p.product_discount || 0,
            ...(p.modified_price !== undefined ? { modified_price: p.modified_price } : {}),
          })),
          difference: d.difference || 0,
          net_amount: d.difference || 0,
          condition: d.condition || "",
          ticket_number: d.condition === "defect" ? (d.ticketNumber || "") : "",
          payments: subPayments || [],
          sales_person_id: salesPersonId || "",
          date: today,
          type: "done",
          createdAt: new Date(),
        });
      }

      await batch.commit();
      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setCreateError("Failed: " + e.message);
    } finally {
      setCreateLoading(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">New Order</h1>
        <p className="text-sm text-muted-foreground mt-1">{location ? `Branch: ${location.name}` : "Point of Sale"}</p>
      </div>

      {/* Transaction Type Menu */}
      <div className="flex items-center gap-2 flex-wrap">
        {TRANSACTION_TYPES.map((type) => {
          const isActive = transactionType === type.value;
          return (
            <button key={type.value} onClick={() => { setTransactionType(type.value); resetForm(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${isActive ? `${type.activeBg} ${type.activeBorder} ${type.activeColor}` : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"}`}>
              {type.icon}{type.label}
            </button>
          );
        })}
      </div>

      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 text-sm font-medium">
          ✓ Order created successfully!
        </div>
      )}

      {/* ── SALE / ZEROCOST / CEO ── */}
      {["sale", "zerocost", "ceo_request"].includes(transactionType) && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Date *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Order ID *</label>
                  <input placeholder="e.g. ORD-0001" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Sales Person *</label>
                  <SearchableSelect options={[...agents].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name }))}
                    value={salesPersonId} onChange={setSalesPersonId} placeholder="Select agent" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Location</label>
                  <div className="px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm font-medium">{location?.name || locationId}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Pricelist *</label>
                  <SearchableSelect
                    options={[...pricelists].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name + (p.isOriginal ? " (Original)" : "") }))}
                    value={pricelistId}
                    onChange={(val) => { setPricelistId(val); setOrderProducts(orderProducts.map((p) => { const np = getPriceFromPricelist(p.variant_id, val); return { ...p, unit_price: np, modified_price: undefined, final_price: calcFinalPrice(np, undefined, p.product_discount) }; })); }}
                    placeholder="Select pricelist" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Products *</CardTitle>
                <Button size="sm" onClick={addProductRow}><Plus className="h-4 w-4 mr-1" />Add Product</Button>
              </div>
            </CardHeader>
            <CardContent>
              {orderProducts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">No products yet.</p>
              ) : (
                <div className="space-y-3">
                  {orderProducts.map((row, index) => (
                    <ProductRow key={index} row={row} index={index} variants={variants} products={products}
                      onUpdate={updateProductRow} onRemove={removeProductRow} forceZero={forceZero} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {!forceZero && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Order Discount</label>
                  <button onClick={() => { setOrderDiscountEnabled(!orderDiscountEnabled); if (orderDiscountEnabled) setOrderDiscount(0); }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${orderDiscountEnabled ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${orderDiscountEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  {orderDiscountEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} value={orderDiscount} onChange={(e) => setOrderDiscount(Number(e.target.value))} style={{ width: 80 }} />
                      <span className="text-sm text-muted-foreground">% on entire order</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {forceZero && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Note</label>
                  <textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm resize-none" rows={3} />
                </div>
              </CardContent>
            </Card>
          )}

          {!forceZero && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Payment Methods *</CardTitle>
                  <Button size="sm" onClick={addPayment}><Plus className="h-4 w-4 mr-1" />Add Payment</Button>
                </div>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">No payment methods added.</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((p, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="flex-1">
                          <SearchableSelect options={[...paymentMethods].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name }))}
                            value={p.method_id} onChange={(val) => updatePayment(index, "method_id", val)} placeholder="Select method" />
                        </div>
                        <input type="number" min={0} value={p.amount} onChange={(e) => updatePayment(index, "amount", e.target.value)} style={{ width: 120 }} />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Total: {netAmount.toLocaleString()}</span>
                        <Button variant="destructive" size="icon-sm" onClick={() => removePayment(index)}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm max-w-sm ml-auto">
                <div className="flex justify-between text-muted-foreground"><span>Original Price</span><span>{originalTotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Pricelist Total</span><span>{plTotal.toLocaleString()}</span></div>
                {!forceZero && orderDiscountEnabled && orderDiscount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Order Discount ({orderDiscount}%)</span>
                    <span className="text-destructive">-{(plTotal * orderDiscount / 100).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-destructive"><span>Total Discount</span><span>-{totalDiscount.toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2">
                  <span>Net Amount</span><span>{netAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── REFUND ── */}
      {transactionType === "refund" && (
        <RefundForm
          variants={variants} products={products} pricelists={pricelists}
          priceItems={priceItems} allOrders={allOrders} agents={agents}
          payments={subPayments} setPayments={setSubPayments}
          paymentMethods={paymentMethods}
          autoRefundOrderId={autoRefundOrderId}
          onDataChange={setRefundData}
        />
      )}

      {/* ── REPLACEMENT ── */}
      {transactionType === "replacement" && (
        <ReplacementForm
          variants={variants} products={products} pricelists={pricelists}
          priceItems={priceItems} allOrders={allOrders}
          payments={subPayments} setPayments={setSubPayments}
          paymentMethods={paymentMethods}
          onDataChange={setReplacementData}
        />
      )}

      {createError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{createError}</div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={resetForm}>Clear Form</Button>
        <Button onClick={handleCreate} disabled={createLoading}>
          {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Order
        </Button>
      </div>
    </div>
  );
}