"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, doc, query, where, writeBatch,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Plus, ArrowLeft, Pencil, Trash2, Loader2, ChevronRight, X,
} from "lucide-react";

// ── Types ──
type Variant = { id: string; name: string; code?: string; productId?: string };
type Product = { id: string; name: string };
type Location = { id: string; name: string; type?: string };
type Pricelist = { id: string; name: string; isOriginal?: boolean };
type PriceItem = { id: string; pricelist_id: string; variant_id: string; price: number };
type PaymentMethod = { id: string; name: string };
type AppUser = { id: string; name: string; role: string };
type StockItem = { id: string; variant_id: string; location_id: string; quantity: number };

type OrderProduct = {
  variant_id: string;
  quantity: number;
  unit_price: number;
  modified_price?: number;
  product_discount: number;
  final_price: number;
};

type PaymentEntry = { method_id: string; amount: number };

type Order = {
  id: string;
  order_id: string;
  date: string;
  sales_person_id: string;
  location_id: string;
  pricelist_id: string;
  products: OrderProduct[];
  order_discount: number;
  payments: PaymentEntry[];
  original_total: number;
  pricelist_total: number;
  total_discount: number;
  net_amount: number;
  createdAt: any;
};

// ── Product Row Component (fixes hooks-in-map issue) ──
function ProductRow({
  row, index, variants, products, priceItems, pricelistId,
  onUpdate, onRemove,
}: {
  row: OrderProduct;
  index: number;
  variants: Variant[];
  products: Product[];
  priceItems: PriceItem[];
  pricelistId: string;
  onUpdate: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}) {
  const [showDiscount, setShowDiscount] = useState(false);
  const [showModify, setShowModify] = useState(false);

  const getProduct = (id: string) => products.find((p) => p.id === id);
  const displayPrice = row.modified_price !== undefined ? row.modified_price : row.unit_price;
  const afterDiscount = row.product_discount > 0 ? displayPrice * (1 - row.product_discount / 100) : null;

  return (
    <div className="p-4 bg-muted/20 rounded-lg border border-border/50 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">Product</label>
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
          <label className="text-xs text-muted-foreground">Quantity</label>
          <input type="number" min={1} value={row.quantity}
            onChange={(e) => onUpdate(index, "quantity", Number(e.target.value))} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Price</label>
            <div className="flex items-center gap-1">
              {showModify ? (
                <input
                  type="number" min={0}
                  placeholder={String(row.unit_price)}
                  value={row.modified_price ?? ""}
                  onChange={(e) => onUpdate(index, "modified_price", e.target.value)}
                  style={{ flex: 1 }}
                />
              ) : (
                <div className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm">
                  {displayPrice > 0 ? displayPrice.toLocaleString() : "—"}
                </div>
              )}
              <button
                onClick={() => {
                  if (showModify) onUpdate(index, "modified_price", "");
                  setShowModify(!showModify);
                }}
                className={`p-2 rounded-lg border transition-colors ${showModify ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                title="Modify price"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <Button variant="destructive" size="icon-sm" onClick={() => onRemove(index)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Product Discount */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground">Extra Discount</label>
        <button
          onClick={() => {
            if (showDiscount) onUpdate(index, "product_discount", 0);
            setShowDiscount(!showDiscount);
          }}
          className={`relative w-10 h-5 rounded-full transition-colors ${showDiscount ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showDiscount ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        {showDiscount && (
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={100}
              value={row.product_discount}
              onChange={(e) => onUpdate(index, "product_discount", Number(e.target.value))}
              style={{ width: 80 }}
            />
            <span className="text-xs text-muted-foreground">%</span>
            {afterDiscount !== null && (
              <span className="text-xs text-green-500 font-medium">{afterDiscount.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function POSPage() {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [orders, setOrders] = useState<Order[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [orderId, setOrderId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pricelistId, setPricelistId] = useState("");
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [orderDiscountEnabled, setOrderDiscountEnabled] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadAll() {
    setLoading(true);
    const [oSnap, vSnap, pSnap, lSnap, plSnap, piSnap, pmSnap, uSnap] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "variants")),
      getDocs(collection(db, "products")),
      getDocs(collection(db, "locations")),
      getDocs(collection(db, "pricelists")),
      getDocs(collection(db, "pricelist_items")),
      getDocs(collection(db, "payment_methods")),
      getDocs(collection(db, "users")),
    ]);
    setOrders(oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
      .sort((a, b) => b.order_id?.localeCompare(a.order_id)));
    setVariants(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
    setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setLocations(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Location))
      .filter((l) => l.type === "branch" || l.type === "branch_warehouse"));
    const pls = plSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pricelist));
    setPricelists(pls);
    setPriceItems(piSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceItem)));
    setPaymentMethods(pmSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod)));
    setAgents(uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)).filter((u) => u.role === "agent"));
    const original = pls.find((p) => p.isOriginal);
    if (original) setPricelistId(original.id);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const getVariant = (id: string) => variants.find((v) => v.id === id);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getLocationName = (id: string) => locations.find((l) => l.id === id)?.name || id;
  const getPricelistName = (id: string) => pricelists.find((p) => p.id === id)?.name || id;
  const getPaymentMethodName = (id: string) => paymentMethods.find((p) => p.id === id)?.name || id;
  const getAgentName = (id: string) => agents.find((a) => a.id === id)?.name || id;

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
    setOrderProducts([...orderProducts, {
      variant_id: "", quantity: 1, unit_price: 0,
      modified_price: undefined, product_discount: 0, final_price: 0,
    }]);
  }

  function updateProductRow(index: number, field: string, value: any) {
    const updated = [...orderProducts];
    const row = { ...updated[index], [field]: value };
    if (field === "variant_id" && pricelistId) {
      row.unit_price = getPriceFromPricelist(value, pricelistId);
      row.modified_price = undefined;
    }
    if (field === "modified_price") {
      row.modified_price = value === "" ? undefined : Number(value);
    }
    if (field === "quantity") row.quantity = Number(value);
    if (field === "product_discount") row.product_discount = Number(value);
    row.final_price = calcFinalPrice(row.unit_price, row.modified_price, row.product_discount);
    updated[index] = row;
    setOrderProducts(updated);
  }

  function removeProductRow(index: number) {
    setOrderProducts(orderProducts.filter((_, i) => i !== index));
  }

  const plTotal = useMemo(() =>
    orderProducts.reduce((sum, p) => sum + p.final_price * p.quantity, 0),
    [orderProducts]);

  const originalTotal = useMemo(() =>
    orderProducts.reduce((sum, p) => sum + getOriginalPrice(p.variant_id) * p.quantity, 0),
    [orderProducts, pricelists, priceItems]);

  const afterOrderDiscount = orderDiscountEnabled ? plTotal * (1 - orderDiscount / 100) : plTotal;
  const totalDiscount = originalTotal - afterOrderDiscount;
  const netAmount = afterOrderDiscount;

  function addPayment() {
    const remaining = netAmount - payments.reduce((s, p) => s + p.amount, 0);
    setPayments([...payments, { method_id: "", amount: Math.max(0, Number(remaining.toFixed(2))) }]);
  }

  function updatePayment(index: number, field: string, value: any) {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: field === "amount" ? Number(value) : value };
    if (field === "amount" && index < updated.length - 1) {
      const paid = updated.slice(0, index + 1).reduce((s, p) => s + p.amount, 0);
      const remaining = netAmount - paid;
      if (remaining > 0) updated[index + 1] = { ...updated[index + 1], amount: Number(remaining.toFixed(2)) };
    }
    setPayments(updated);
  }

  function removePayment(index: number) {
    setPayments(payments.filter((_, i) => i !== index));
  }

  function resetForm() {
    setDate(today); setOrderId(""); setSalesPersonId(""); setLocationId("");
    setOrderProducts([]); setOrderDiscount(0); setOrderDiscountEnabled(false);
    setPayments([]); setCreateError("");
  }

  async function handleCreate() {
    setCreateError("");
    if (!orderId) { setCreateError("Order ID is required."); return; }
    if (!salesPersonId) { setCreateError("Sales person is required."); return; }
    if (!locationId) { setCreateError("Location is required."); return; }
    if (!pricelistId) { setCreateError("Pricelist is required."); return; }
    if (orderProducts.length === 0) { setCreateError("Add at least one product."); return; }
    if (orderProducts.some((p) => !p.variant_id || p.quantity <= 0)) {
      setCreateError("All products must have a variant and quantity > 0."); return;
    }
    if (payments.length === 0) { setCreateError("Add at least one payment method."); return; }
    if (payments.some((p) => !p.method_id)) { setCreateError("All payments must have a method."); return; }

    setCreateLoading(true);
    try {
      const batch = writeBatch(db);

      for (const item of orderProducts) {
        const stockSnap = await getDocs(query(
          collection(db, "stock"),
          where("variant_id", "==", item.variant_id),
          where("location_id", "==", locationId)
        ));
        if (!stockSnap.empty) {
          const stockDoc = stockSnap.docs[0];
          const newQty = Math.max(0, (stockDoc.data().quantity || 0) - item.quantity);
          batch.update(stockDoc.ref, { quantity: newQty });
        }
      }

      const orderRef = doc(collection(db, "orders"));
      batch.set(orderRef, {
        order_id: orderId, date,
        sales_person_id: salesPersonId,
        location_id: locationId,
        pricelist_id: pricelistId,
        products: orderProducts,
        order_discount: orderDiscountEnabled ? orderDiscount : 0,
        payments,
        original_total: originalTotal,
        pricelist_total: plTotal,
        total_discount: totalDiscount,
        net_amount: netAmount,
        createdAt: new Date(),
      });

      await batch.commit();
      resetForm();
      setView("list");
      await loadAll();
    } catch (e: any) {
      setCreateError("Failed to create order: " + e.message);
    } finally { setCreateLoading(false); }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  // ── Detail View ──
  if (view === "detail" && selectedOrder) {
    const o = selectedOrder;
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => { setView("list"); setSelectedOrder(null); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Order #{o.order_id}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {o.date} · {getAgentName(o.sales_person_id)} · {getLocationName(o.location_id)} · {getPricelistName(o.pricelist_id)}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Products</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Variant</th>
                  <th className="text-left py-3 px-4">Qty</th>
                  <th className="text-left py-3 px-4">Unit Price</th>
                  <th className="text-left py-3 px-4">Discount</th>
                  <th className="text-left py-3 px-4">Final Price</th>
                  <th className="text-left py-3 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {o.products.map((p, i) => {
                  const v = getVariant(p.variant_id);
                  const pr = v?.productId ? getProduct(v.productId) : undefined;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="font-medium">{v?.name || p.variant_id}</div>
                        {pr && <div className="text-xs text-muted-foreground">{pr.name}</div>}
                      </td>
                      <td className="py-3 px-4">{p.quantity}</td>
                      <td className="py-3 px-4">{(p.modified_price ?? p.unit_price).toLocaleString()}</td>
                      <td className="py-3 px-4">{p.product_discount > 0 ? `${p.product_discount}%` : "—"}</td>
                      <td className="py-3 px-4">{p.final_price.toLocaleString()}</td>
                      <td className="py-3 px-4 font-medium">{(p.final_price * p.quantity).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Payments</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {o.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{getPaymentMethodName(p.method_id)}</span>
                    <span className="font-medium">{p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Original Price</span>
                <span>{o.original_total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pricelist ({getPricelistName(o.pricelist_id)})</span>
                <span>{o.pricelist_total.toLocaleString()}</span>
              </div>
              {o.order_discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Order Discount ({o.order_discount}%)</span>
                  <span className="text-destructive">-{(o.pricelist_total * o.order_discount / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-destructive">
                <span>Total Discount</span>
                <span>-{o.total_discount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-base border-t border-border pt-2 mt-2">
                <span>Net Amount</span>
                <span>{o.net_amount.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Create View ──
  if (view === "create") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">New Order</h1>
            <p className="text-sm text-muted-foreground mt-1">Create a new sales order</p>
          </div>
        </div>

        {/* Order Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Order ID</label>
                <input placeholder="e.g. ORD-0001" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Sales Person</label>
                <SearchableSelect
                  options={[...agents].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name }))}
                  value={salesPersonId}
                  onChange={setSalesPersonId}
                  placeholder="Select agent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Location (Branch)</label>
                <SearchableSelect
                  options={[...locations].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ value: l.id, label: l.name }))}
                  value={locationId}
                  onChange={setLocationId}
                  placeholder="Select branch"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Pricelist</label>
                <SearchableSelect
                  options={[...pricelists].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({
                    value: p.id, label: p.name + (p.isOriginal ? " (Original)" : ""),
                  }))}
                  value={pricelistId}
                  onChange={(val) => {
                    setPricelistId(val);
                    setOrderProducts(orderProducts.map((p) => {
                      const newPrice = getPriceFromPricelist(p.variant_id, val);
                      return {
                        ...p,
                        unit_price: newPrice,
                        modified_price: undefined,
                        final_price: calcFinalPrice(newPrice, undefined, p.product_discount),
                      };
                    }));
                  }}
                  placeholder="Select pricelist"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Button size="sm" onClick={addProductRow}><Plus className="h-4 w-4 mr-1" />Add Product</Button>
            </div>
          </CardHeader>
          <CardContent>
            {orderProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No products yet.</p>
            ) : (
              <div className="space-y-3">
                {orderProducts.map((row, index) => (
                  <ProductRow
                    key={index}
                    row={row}
                    index={index}
                    variants={variants}
                    products={products}
                    priceItems={priceItems}
                    pricelistId={pricelistId}
                    onUpdate={updateProductRow}
                    onRemove={removeProductRow}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Discount */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Order Discount</label>
              <button
                onClick={() => { setOrderDiscountEnabled(!orderDiscountEnabled); if (orderDiscountEnabled) setOrderDiscount(0); }}
                className={`relative w-10 h-5 rounded-full transition-colors ${orderDiscountEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${orderDiscountEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              {orderDiscountEnabled && (
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={100} value={orderDiscount}
                    onChange={(e) => setOrderDiscount(Number(e.target.value))}
                    style={{ width: 80 }} />
                  <span className="text-sm text-muted-foreground">% on entire order</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
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
                      <SearchableSelect
                        options={[...paymentMethods].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name }))}
                        value={p.method_id}
                        onChange={(val) => updatePayment(index, "method_id", val)}
                        placeholder="Select method"
                      />
                    </div>
                    <input type="number" min={0} value={p.amount}
                      onChange={(e) => updatePayment(index, "amount", e.target.value)}
                      style={{ width: 120 }} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Total: {netAmount.toLocaleString()}
                    </span>
                    <Button variant="destructive" size="icon-sm" onClick={() => removePayment(index)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2 text-sm max-w-sm ml-auto">
              <div className="flex justify-between text-muted-foreground">
                <span>Original Price</span>
                <span>{originalTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pricelist Total</span>
                <span>{plTotal.toLocaleString()}</span>
              </div>
              {orderDiscountEnabled && orderDiscount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Order Discount ({orderDiscount}%)</span>
                  <span className="text-destructive">-{(plTotal * orderDiscount / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-destructive">
                <span>Total Discount</span>
                <span>-{totalDiscount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2">
                <span>Net Amount</span>
                <span>{netAmount.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {createError && <p className="text-destructive text-sm">{createError}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { resetForm(); setView("list"); }}>Cancel</Button>
          <Button onClick={handleCreate} disabled={createLoading}>
            {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Order
          </Button>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage sales orders</p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="h-4 w-4 mr-2" /> New Order
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{orders.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {orders.reduce((s, o) => s + (o.net_amount || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Discount</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {orders.reduce((s, o) => s + (o.total_discount || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Order ID</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Sales Person</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-left py-3 px-4">Items</th>
                  <th className="text-left py-3 px-4">Net Amount</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedOrder(o); setView("detail"); }}>
                    <td className="py-3 px-4 font-mono font-medium">{o.order_id}</td>
                    <td className="py-3 px-4 text-muted-foreground">{o.date}</td>
                    <td className="py-3 px-4">{getAgentName(o.sales_person_id)}</td>
                    <td className="py-3 px-4">{getLocationName(o.location_id)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{o.products?.length || 0} items</td>
                    <td className="py-3 px-4 font-medium">{o.net_amount?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right"><ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" /></td>
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