"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, doc, query, where,
  writeBatch, deleteDoc, updateDoc, getDoc,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useAuth } from "@/components/AuthContext";
import {
  Plus, ArrowLeft, Pencil, Trash2, Loader2, ChevronRight,
  X, Download, CheckSquare, Square, Trash, Upload, CheckCircle2, FileDown, RefreshCw, RotateCcw,
} from "lucide-react";
import * as XLSX from "xlsx";
import SheetSyncModal from "@/components/SheetSyncModal";

// ── Types ──
type Variant = { id: string; name: string; code?: string; productId?: string };
type Product = { id: string; name: string; brandId?: string; categoryId?: string; lineId?: string };
type Location = { id: string; name: string; type?: string; code?: string };
type Pricelist = { id: string; name: string; isOriginal?: boolean };
type PriceItem = { id: string; pricelist_id: string; variant_id: string; price: number };
type PaymentMethod = { id: string; name: string };
type AppUser = { id: string; name: string; role: string; code?: string };
type Brand = { id: string; name: string };
type Category = { id: string; name: string };
type Line = { id: string; name: string };
type OrderType = "draft" | "done";
type TransactionType = "sale" | "refund" | "replacement" | "zerocost" | "ceo_request";

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
  type: OrderType;
  transaction_type?: TransactionType;
  original_order_id?: string;
  old_product?: { variant_id: string; quantity: number; price: number };
  new_products?: any[];
  difference?: number;
  condition?: string;
  ticket_number?: string;
  note?: string;
  createdAt: any;
};

// ── Product Row Component ──
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
  const [showDiscount, setShowDiscount] = useState(row.product_discount > 0);
  const [showModify, setShowModify] = useState(row.modified_price !== undefined);

  const getProduct = (id: string) => products.find((p) => p.id === id);
  const displayPrice = row.modified_price !== undefined ? row.modified_price : row.unit_price;
  const afterDiscount = row.product_discount > 0 ? displayPrice * (1 - row.product_discount / 100) : null;

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [view, setView] = useState<"list" | "create" | "modify" | "detail">("list");
  const [orders, setOrders] = useState<Order[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Delete mode
  const [deleteMode, setDeleteMode] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterPricelist, setFilterPricelist] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLine, setFilterLine] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterVariant, setFilterVariant] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTransactionType, setFilterTransactionType] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
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
  const [modifyOrderId, setModifyOrderId] = useState<string | null>(null);

  // Mark as Done modal
  const [doneModalOrder, setDoneModalOrder] = useState<Order | null>(null);
  const [donePricelistId, setDonePricelistId] = useState("");
  const [doneDiscount, setDoneDiscount] = useState(0);
  const [doneDiscountEnabled, setDoneDiscountEnabled] = useState(false);
  const [donePayments, setDonePayments] = useState<PaymentEntry[]>([]);
  const [doneProducts, setDoneProducts] = useState<Array<{ variant_id: string; quantity: number; unit_price: number; product_discount: number; final_price: number }>>([]);
  const [doneLoading, setDoneLoading] = useState(false);
  const [doneError, setDoneError] = useState("");

  async function loadAll() {
    setLoading(true);
    const [oSnap, vSnap, pSnap, lSnap, plSnap, piSnap, pmSnap, uSnap, bSnap, cSnap, liSnap] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "variants")),
      getDocs(collection(db, "products")),
      getDocs(collection(db, "locations")),
      getDocs(collection(db, "pricelists")),
      getDocs(collection(db, "pricelist_items")),
      getDocs(collection(db, "payment_methods")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "brands")),
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "lines")),
    ]);
    setOrders(oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
      .sort((a, b) => { const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0); const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0); return tb.getTime() - ta.getTime(); }));
    setVariants(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
    setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    setLocations(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Location))
      .filter((l) => l.type === "branch" || l.type === "branch_warehouse"));
    const pls = plSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pricelist));
    setPricelists(pls);
    setPriceItems(piSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceItem)));
    setPaymentMethods(pmSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod)));
    setAgents(uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
    setBrands(bSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand)));
    setCategories(cSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)));
    setLines(liSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Line)));
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


  // Transaction type config
  const TX_TYPES: Record<string, { label: string; color: string }> = {
    sale:        { label: "Sale",        color: "bg-blue-500/15 text-blue-500" },
    refund:      { label: "Refund",      color: "bg-red-500/15 text-red-500" },
    replacement: { label: "Replacement", color: "bg-orange-500/15 text-orange-500" },
    zerocost:    { label: "Zerocost",    color: "bg-green-500/15 text-green-500" },
    ceo_request: { label: "CEO Request", color: "bg-purple-500/15 text-purple-500" },
  };
  function getTxBadge(type?: string) {
    const t = TX_TYPES[type || "sale"] || TX_TYPES["sale"];
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span>;
  }

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
      product_discount: 0, final_price: 0,
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
    setPayments([]); setCreateError(""); setModifyOrderId(null);
    const original = pricelists.find((p) => p.isOriginal);
    if (original) setPricelistId(original.id); else setPricelistId("");
  }

  // ── Validation + Stock Check ──
  async function validateAndCheckStock(): Promise<string | null> {
    if (!date) return "Date is required.";
    if (!orderId.trim()) return "Order ID is required.";
    if (!salesPersonId) return "Sales Person is required.";
    if (!locationId) return "Location is required.";
    if (!pricelistId) return "Pricelist is required.";
    if (orderProducts.length === 0) return "Add at least one product.";
    if (orderProducts.some((p) => !p.variant_id)) return "All products must have a variant selected.";
    if (orderProducts.some((p) => p.quantity <= 0)) return "All quantities must be greater than 0.";
    if (payments.length === 0) return "Add at least one payment method.";
    if (payments.some((p) => !p.method_id)) return "All payment entries must have a method selected.";
    if (payments.some((p) => p.amount <= 0)) return "All payment amounts must be greater than 0.";

    // Stock check
    for (const item of orderProducts) {
      const stockSnap = await getDocs(query(
        collection(db, "stock"),
        where("variant_id", "==", item.variant_id),
        where("location_id", "==", locationId)
      ));
      const available = stockSnap.empty ? 0 : (stockSnap.docs[0].data().quantity || 0);
      if (available < item.quantity) {
        const v = getVariant(item.variant_id);
        return `Insufficient stock for "${v?.name || item.variant_id}": available ${available}, requested ${item.quantity}.`;
      }
    }
    return null;
  }

  // ── Create Order ──
  async function handleCreate() {
    setCreateError("");
    setCreateLoading(true);
    try {
      const err = await validateAndCheckStock();
      if (err) { setCreateError(err); setCreateLoading(false); return; }

      const batch = writeBatch(db);

      const cleanProducts = orderProducts.map((p) => {
        const c: any = {
          variant_id: p.variant_id, quantity: p.quantity,
          unit_price: p.unit_price, product_discount: p.product_discount,
          final_price: p.final_price,
        };
        if (p.modified_price !== undefined) c.modified_price = p.modified_price;
        return c;
      });

      for (const item of orderProducts) {
        const stockSnap = await getDocs(query(
          collection(db, "stock"),
          where("variant_id", "==", item.variant_id),
          where("location_id", "==", locationId)
        ));
        if (!stockSnap.empty) {
          const newQty = (stockSnap.docs[0].data().quantity || 0) - item.quantity;
          batch.update(stockSnap.docs[0].ref, { quantity: newQty });
        }
      }

      const orderRef = doc(collection(db, "orders"));
      batch.set(orderRef, {
        order_id: orderId, date,
        sales_person_id: salesPersonId,
        location_id: locationId,
        pricelist_id: pricelistId,
        products: cleanProducts,
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

  // ── Modify Order ──
  function openModify(order: Order) {
    setModifyOrderId(order.id);
    setDate(order.date);
    setOrderId(order.order_id);
    setSalesPersonId(order.sales_person_id);
    setLocationId(order.location_id);
    setPricelistId(order.pricelist_id);
    setOrderProducts(order.products.map((p) => ({ ...p })));
    setOrderDiscount(order.order_discount || 0);
    setOrderDiscountEnabled((order.order_discount || 0) > 0);
    setPayments(order.payments.map((p) => ({ ...p })));
    setCreateError("");
    setView("modify");
  }

  async function handleModify() {
    if (!modifyOrderId) return;
    setCreateError("");
    setCreateLoading(true);
    try {
      // Basic validation (skip stock check on modify)
      if (!date) { setCreateError("Date is required."); setCreateLoading(false); return; }
      if (!orderId.trim()) { setCreateError("Order ID is required."); setCreateLoading(false); return; }
      if (!salesPersonId) { setCreateError("Sales Person is required."); setCreateLoading(false); return; }
      if (!locationId) { setCreateError("Location is required."); setCreateLoading(false); return; }
      if (!pricelistId) { setCreateError("Pricelist is required."); setCreateLoading(false); return; }
      if (orderProducts.length === 0) { setCreateError("Add at least one product."); setCreateLoading(false); return; }
      if (orderProducts.some((p) => !p.variant_id)) { setCreateError("All products must have a variant."); setCreateLoading(false); return; }
      if (payments.length === 0) { setCreateError("Add at least one payment method."); setCreateLoading(false); return; }
      if (payments.some((p) => !p.method_id)) { setCreateError("All payment entries need a method."); setCreateLoading(false); return; }

      const cleanProducts = orderProducts.map((p) => {
        const c: any = {
          variant_id: p.variant_id, quantity: p.quantity,
          unit_price: p.unit_price, product_discount: p.product_discount,
          final_price: p.final_price,
        };
        if (p.modified_price !== undefined) c.modified_price = p.modified_price;
        return c;
      });

      await updateDoc(doc(db, "orders", modifyOrderId), {
        order_id: orderId, date,
        sales_person_id: salesPersonId,
        location_id: locationId,
        pricelist_id: pricelistId,
        products: cleanProducts,
        order_discount: orderDiscountEnabled ? orderDiscount : 0,
        payments,
        original_total: originalTotal,
        pricelist_total: plTotal,
        total_discount: totalDiscount,
        net_amount: netAmount,
      });

      resetForm();
      setView("list");
      await loadAll();
    } catch (e: any) {
      setCreateError("Failed to update order: " + e.message);
    } finally { setCreateLoading(false); }
  }

  // ── Mark as Done ──
  function openDoneModal(order: Order) {
    setDoneModalOrder(order);
    const original = pricelists.find((p) => p.isOriginal);
    const plId = original?.id || "";
    setDonePricelistId(plId);
    setDoneDiscount(0);
    setDoneDiscountEnabled(false);
    setDonePayments([]);
    setDoneError("");
    // Init products with qty from order, price from original pricelist
    setDoneProducts(order.products.map((p) => {
      const price = plId ? (priceItems.find((i) => i.pricelist_id === plId && i.variant_id === p.variant_id)?.price ?? 0) : 0;
      return { variant_id: p.variant_id, quantity: p.quantity, unit_price: price, product_discount: 0, final_price: price };
    }));
  }

  function getDoneNetAmount(_order: Order, _plId: string, discPct: number, discEnabled: boolean) {
    const plTotal = doneProducts.reduce((sum, p) => sum + p.final_price * p.quantity, 0);
    return discEnabled ? plTotal * (1 - discPct / 100) : plTotal;
  }

  function updateDoneProduct(index: number, field: string, value: number) {
    const updated = [...doneProducts];
    const row = { ...updated[index], [field]: value };
    if (field === "unit_price" || field === "product_discount") {
      row.final_price = row.unit_price * (1 - row.product_discount / 100);
    }
    updated[index] = row;
    setDoneProducts(updated);
  }

  async function handleMarkAsDone() {
    if (!doneModalOrder) return;
    setDoneError("");
    if (!donePricelistId) { setDoneError("Pricelist is required."); return; }
    if (donePayments.length === 0) { setDoneError("Add at least one payment method."); return; }
    if (donePayments.some((p) => !p.method_id)) { setDoneError("All payments need a method."); return; }
    if (donePayments.some((p) => p.amount <= 0)) { setDoneError("All payment amounts must be > 0."); return; }

    setDoneLoading(true);
    try {
      const o = doneModalOrder;
      const plTotal = doneProducts.reduce((sum, p) => sum + p.final_price * p.quantity, 0);
      const originalTotal2 = o.products.reduce((sum, p) => sum + getOriginalPrice(p.variant_id) * p.quantity, 0);
      const netAmt = doneDiscountEnabled ? plTotal * (1 - doneDiscount / 100) : plTotal;
      const totalDisc = originalTotal2 - netAmt;
      const updatedProducts = doneProducts;

      const batch = writeBatch(db);

      // Deduct stock using doneProducts quantities
      for (const item of doneProducts) {
        const stockSnap = await getDocs(query(
          collection(db, "stock"),
          where("variant_id", "==", item.variant_id),
          where("location_id", "==", o.location_id)
        ));
        if (!stockSnap.empty) {
          const newQty = (stockSnap.docs[0].data().quantity || 0) - item.quantity;
          batch.update(stockSnap.docs[0].ref, { quantity: newQty });
        }
      }

      batch.update(doc(db, "orders", o.id), {
        type: "done",
        pricelist_id: donePricelistId,
        order_discount: doneDiscountEnabled ? doneDiscount : 0,
        payments: donePayments,
        products: updatedProducts,
        original_total: originalTotal2,
        pricelist_total: plTotal,
        total_discount: totalDisc,
        net_amount: netAmt,
        completedAt: new Date(),
      });

      await batch.commit();
      setDoneModalOrder(null);
      await loadAll();
    } catch (e: any) {
      setDoneError("Failed: " + e.message);
    } finally { setDoneLoading(false); }
  }

  // ── Delete Orders ──
  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} order(s)? This cannot be undone.`)) return;
    setDeleteLoading(true);
    const batch = writeBatch(db);
    selectedIds.forEach((id) => batch.delete(doc(db, "orders", id)));
    await batch.commit();
    setSelectedIds(new Set());
    setDeleteMode(false);
    setDeleteLoading(false);
    await loadAll();
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  // ── Filtered Orders ──
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const match =
          o.order_id?.toLowerCase().includes(q) ||
          getAgentName(o.sales_person_id).toLowerCase().includes(q) ||
          getLocationName(o.location_id).toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterLocation && o.location_id !== filterLocation) return false;
      if (filterAgent && o.sales_person_id !== filterAgent) return false;
      if (filterPricelist && o.pricelist_id !== filterPricelist) return false;
      if (filterDateFrom && o.date < filterDateFrom) return false;
      if (filterDateTo && o.date > filterDateTo) return false;
      if (filterType && o.type !== filterType) return false;
      if (filterTransactionType && (o.transaction_type || "sale") !== filterTransactionType) return false;
      if (filterPaymentMethod && !o.payments?.some((p) => p.method_id === filterPaymentMethod)) return false;
      if (filterVariant && !o.products?.some((p) => p.variant_id === filterVariant)) return false;
      if (filterProduct) {
        const variantIdsForProduct = variants.filter((v) => v.productId === filterProduct).map((v) => v.id);
        if (!o.products?.some((p) => variantIdsForProduct.includes(p.variant_id))) return false;
      }
      if (filterBrand) {
        const productIdsForBrand = products.filter((p) => p.brandId === filterBrand).map((p) => p.id);
        const variantIds = variants.filter((v) => v.productId && productIdsForBrand.includes(v.productId)).map((v) => v.id);
        if (!o.products?.some((p) => variantIds.includes(p.variant_id))) return false;
      }
      if (filterCategory) {
        const productIds = products.filter((p) => p.categoryId === filterCategory).map((p) => p.id);
        const variantIds = variants.filter((v) => v.productId && productIds.includes(v.productId)).map((v) => v.id);
        if (!o.products?.some((p) => variantIds.includes(p.variant_id))) return false;
      }
      if (filterLine) {
        const productIds = products.filter((p) => p.lineId === filterLine).map((p) => p.id);
        const variantIds = variants.filter((v) => v.productId && productIds.includes(v.productId)).map((v) => v.id);
        if (!o.products?.some((p) => variantIds.includes(p.variant_id))) return false;
      }
      return true;
    });
  }, [orders, filterSearch, filterLocation, filterAgent, filterPricelist, filterDateFrom, filterDateTo,
      filterType, filterTransactionType, filterPaymentMethod, filterVariant, filterProduct, filterBrand, filterCategory, filterLine,
      variants, products]);

  const hasFilters = filterSearch || filterLocation || filterAgent || filterPricelist ||
    filterDateFrom || filterDateTo || filterPaymentMethod || filterVariant || filterProduct ||
    filterBrand || filterCategory || filterLine || filterType || filterTransactionType;

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const paginatedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function clearFilters() {
    setFilterSearch(""); setFilterLocation(""); setFilterAgent(""); setFilterPricelist("");
    setFilterType(""); setFilterTransactionType(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterPaymentMethod("");
    setFilterVariant(""); setFilterProduct(""); setFilterBrand(""); setFilterCategory(""); setFilterLine("");
    setPage(1);
  }

  // ── Import CSV ──
  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true); setImportError(""); setImportSuccess("");

    const STATUS_MAP: Record<string, string> = {
      "sold": "sale", "sale": "sale",
      "refund": "refund", "replacement": "replacement",
      "zerocost": "zerocost", "zero cost": "zerocost",
      "ceo request": "ceo_request", "ceo_request": "ceo_request",
    };

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error("CSV is empty.");

      // Parse header
      const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const colIdx = (name: string) => header.findIndex(h => h === name.toLowerCase());

      const spColIdx    = colIdx("salesperson code");
      const locColIdx   = colIdx("location code");
      const dateColIdx  = colIdx("date");
      const orderColIdx = colIdx("order ref");
      const statusColIdx= colIdx("status");
      const nameColIdx  = colIdx("variant name");
      const codeColIdx  = colIdx("variant code");

      if ([spColIdx, locColIdx, dateColIdx, orderColIdx, statusColIdx, nameColIdx].includes(-1)) {
        throw new Error("Missing required columns. Expected: Salesperson Code, Location Code, Date, Order Ref, Status, Variant Name");
      }

      // Parse rows
      const grouped: Record<string, any[]> = {};
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
        const status = cols[statusColIdx]?.trim().toLowerCase();
        const txType = STATUS_MAP[status];
        if (!txType) continue; // skip unknown statuses

        const orderRef = cols[orderColIdx]?.trim();
        if (!orderRef) continue;

        if (!grouped[orderRef]) grouped[orderRef] = [];
        grouped[orderRef].push({ cols, txType });
      }

      if (Object.keys(grouped).length === 0) throw new Error("No valid rows found.");

      const batch = writeBatch(db);
      let count = 0;
      const today2 = new Date().toISOString().split("T")[0];

      for (const [orderRef, rows] of Object.entries(grouped)) {
        const first = rows[0];
        const cols = first.cols;
        const txType = first.txType;

        // Salesperson
        const spCode = cols[spColIdx]?.trim().toUpperCase();
        const sp = agents.find((a) => (a as any).code?.toUpperCase() === spCode || a.name?.toUpperCase() === spCode);

        // Location
        const locCode = cols[locColIdx]?.trim().toUpperCase();
        const loc = locations.find((l) => (l as any).code?.toUpperCase() === locCode || l.name?.toUpperCase() === locCode);

        // Date
        const rawDate = cols[dateColIdx]?.trim();
        let dateStr = today2;
        if (rawDate) {
          const parsed = new Date(rawDate);
          dateStr = isNaN(parsed.getTime()) ? rawDate : parsed.toISOString().split("T")[0];
        }

        // Products — one per row, match by name or code
        const draftProducts = rows.map(({ cols: c }) => {
          const varName = c[nameColIdx]?.trim();
          const varCode = codeColIdx !== -1 ? c[codeColIdx]?.trim().toUpperCase() : "";
          const v = variants.find((v) =>
            (varCode && (v as any).code?.toUpperCase() === varCode) ||
            v.name?.toLowerCase() === varName?.toLowerCase() ||
            v.name?.toLowerCase().includes(varName?.toLowerCase() || "")
          );
          return {
            variant_id: v?.id || varName || varCode,
            quantity: 1,
            unit_price: 0, product_discount: 0, final_price: 0,
          };
        }).filter(p => p.variant_id);

        if (draftProducts.length === 0) continue;

        const orderDocRef = doc(collection(db, "orders"));
        batch.set(orderDocRef, {
          order_id: orderRef,
          date: dateStr,
          sales_person_id: sp?.id || spCode,
          location_id: loc?.id || locCode,
          transaction_type: txType,
          pricelist_id: "",
          products: draftProducts,
          order_discount: 0, payments: [],
          original_total: 0, pricelist_total: 0, total_discount: 0, net_amount: 0,
          type: "draft",
          createdAt: new Date(),
        });
        count++;
      }

      await batch.commit();
      setImportSuccess(`✓ Imported ${count} draft order(s) successfully.`);
      await loadAll();
    } catch (err: any) {
      setImportError("Import failed: " + err.message);
    } finally {
      setImportLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  // ── Download XLSX ──
  function downloadXLSX() {
    const rows = filteredOrders.map((o) => ({
      "Order ID": o.order_id,
      "Date": o.date,
      "Sales Person": getAgentName(o.sales_person_id),
      "Location": getLocationName(o.location_id),
      "Pricelist": getPricelistName(o.pricelist_id),
      "Items": o.products?.length || 0,
      "Original Total": o.original_total,
      "Pricelist Total": o.pricelist_total,
      "Total Discount": o.total_discount,
      "Net Amount": o.net_amount,
      "Payment Methods": o.payments?.map((p) => `${getPaymentMethodName(p.method_id)}: ${p.amount}`).join(" | "),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split("T")[0]}.xlsx`);
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
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Order #{o.order_id}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {o.date} · {getAgentName(o.sales_person_id)} · {getLocationName(o.location_id)} · {getPricelistName(o.pricelist_id)}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {o.type === "done" && o.transaction_type !== "refund" && (
                <Button variant="outline" onClick={() => window.location.href = `/pos/${o.location_id}?refund=${encodeURIComponent(o.order_id)}`}
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                  <RotateCcw className="h-4 w-4 mr-2" /> Refund
                </Button>
              )}
              <Button variant="outline" onClick={() => openModify(o)}>
                <Pencil className="h-4 w-4 mr-2" /> Edit Order
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Products</CardTitle></CardHeader>
          <CardContent>
            {/* Replacement: show old + new products */}
            {o.transaction_type === "replacement" ? (
              <div className="space-y-4">
                {o.old_product && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-4">OLD PRODUCT</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-4">Variant</th>
                          <th className="text-left py-2 px-4">Qty</th>
                          <th className="text-left py-2 px-4">Price</th>
                          <th className="text-left py-2 px-4">Condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/50 bg-red-500/5">
                          <td className="py-2 px-4 font-medium">{getVariant(o.old_product.variant_id)?.name || o.old_product.variant_id}</td>
                          <td className="py-2 px-4">{o.old_product.quantity}</td>
                          <td className="py-2 px-4">{(o.old_product.price || 0).toLocaleString()}</td>
                          <td className="py-2 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${o.condition === "sealed" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                              {o.condition === "sealed" ? "📦 Sealed" : "⚠️ Defect"}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                {(o.new_products?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-4">NEW PRODUCT(S)</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-4">Variant</th>
                          <th className="text-left py-2 px-4">Qty</th>
                          <th className="text-left py-2 px-4">Unit Price</th>
                          <th className="text-left py-2 px-4">Discount</th>
                          <th className="text-left py-2 px-4">Final Price</th>
                          <th className="text-left py-2 px-4">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(o.new_products || []).map((p: any, i: number) => {
                          const v = getVariant(p.variant_id);
                          return (
                            <tr key={i} className="border-b border-border/50 bg-green-500/5">
                              <td className="py-2 px-4 font-medium">{v?.name || p.variant_id}</td>
                              <td className="py-2 px-4">{p.quantity}</td>
                              <td className="py-2 px-4">{(p.unit_price || 0).toLocaleString()}</td>
                              <td className="py-2 px-4">{p.product_discount > 0 ? `${p.product_discount}%` : "—"}</td>
                              <td className="py-2 px-4">{(p.final_price || 0).toLocaleString()}</td>
                              <td className="py-2 px-4 font-medium">{((p.final_price || 0) * p.quantity).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {o.difference !== undefined && (
                  <div className={`mx-4 p-3 rounded-lg border text-sm font-medium flex justify-between ${o.difference > 0 ? "bg-red-500/5 border-red-500/20 text-red-500" : "bg-green-500/5 border-green-500/20 text-green-500"}`}>
                    <span>Difference</span>
                    <span>{o.difference > 0 ? `+${o.difference.toLocaleString()}` : o.difference.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ) : (
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
                {(o.products || []).map((p: any, i: number) => {
                  const v = getVariant(p.variant_id);
                  const pr = v?.productId ? getProduct(v.productId) : undefined;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium">{v?.name || p.variant_id}</div>
                        {pr && <div className="text-xs text-muted-foreground">{pr.name}</div>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{p.quantity}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{(p.modified_price ?? p.unit_price).toLocaleString()}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{p.product_discount > 0 ? `${p.product_discount}%` : "—"}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{p.final_price.toLocaleString()}</td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{(p.final_price * p.quantity).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">Payments</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(o.payments || []).map((p, i) => (
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
              {o.transaction_type === "replacement" ? (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Old Product Value</span><span>{(o.old_product?.price || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>New Product(s) Value</span>
                    <span>{((o.net_amount || 0) + (o.old_product?.price || 0)).toLocaleString()}</span>
                  </div>
                  {o.condition === "defect" && o.ticket_number && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ticket #</span><span>{o.ticket_number}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2 ${(o.difference || 0) >= 0 ? "text-destructive" : "text-green-500"}`}>
                    <span>Difference</span><span>{(o.difference || 0).toLocaleString()}</span>
                  </div>
                </>
              ) : o.transaction_type === "refund" ? (
                <>
                  {o.condition && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Condition</span>
                      <span className={o.condition === "sealed" ? "text-green-500" : "text-red-500"}>
                        {o.condition === "sealed" ? "📦 Sealed" : "⚠️ Defect"}
                      </span>
                    </div>
                  )}
                  {o.ticket_number && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ticket #</span><span>{o.ticket_number}</span>
                    </div>
                  )}
                  {o.original_order_id && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Original Order</span><span>#{o.original_order_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2 text-red-500">
                    <span>Refund Amount</span><span>{(o.net_amount || 0).toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Original Price</span><span>{(o.original_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pricelist ({getPricelistName(o.pricelist_id)})</span><span>{(o.pricelist_total || 0).toLocaleString()}</span>
                  </div>
                  {o.order_discount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Order Discount ({o.order_discount}%)</span>
                      <span className="text-destructive">-{((o.pricelist_total || 0) * o.order_discount / 100).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-destructive">
                    <span>Total Discount</span><span>-{(o.total_discount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2">
                    <span>Net Amount</span><span>{(o.net_amount || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Create / Modify Form ──
  if (view === "create" || view === "modify") {
    const isModify = view === "modify";
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{isModify ? "Edit Order" : "New Order"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isModify ? "Modify an existing order" : "Create a new sales order"}
            </p>
          </div>
        </div>

        {/* Order Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Date <span className="text-destructive">*</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Order ID <span className="text-destructive">*</span></label>
                <input placeholder="e.g. ORD-0001" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Sales Person <span className="text-destructive">*</span></label>
                <SearchableSelect
                  options={[...agents].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name }))}
                  value={salesPersonId}
                  onChange={setSalesPersonId}
                  placeholder="Select agent"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Location (Branch) <span className="text-destructive">*</span></label>
                <SearchableSelect
                  options={[...locations].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ value: l.id, label: l.name }))}
                  value={locationId}
                  onChange={setLocationId}
                  placeholder="Select branch"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Pricelist <span className="text-destructive">*</span></label>
                <SearchableSelect
                  options={[...pricelists].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({
                    value: p.id, label: p.name + (p.isOriginal ? " (Original)" : ""),
                  }))}
                  value={pricelistId}
                  onChange={(val) => {
                    setPricelistId(val);
                    setOrderProducts(orderProducts.map((p) => {
                      const newPrice = getPriceFromPricelist(p.variant_id, val);
                      return { ...p, unit_price: newPrice, modified_price: undefined, final_price: calcFinalPrice(newPrice, undefined, p.product_discount) };
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
              <CardTitle className="text-sm font-medium">
                Products <span className="text-destructive">*</span>
              </CardTitle>
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
                    key={index} row={row} index={index}
                    variants={variants} products={products}
                    priceItems={priceItems} pricelistId={pricelistId}
                    onUpdate={updateProductRow} onRemove={removeProductRow}
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
                    onChange={(e) => setOrderDiscount(Number(e.target.value))} style={{ width: 80 }} />
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
              <CardTitle className="text-sm font-medium">
                Payment Methods <span className="text-destructive">*</span>
              </CardTitle>
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
                <span>Original Price</span><span>{originalTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pricelist Total</span><span>{plTotal.toLocaleString()}</span>
              </div>
              {orderDiscountEnabled && orderDiscount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Order Discount ({orderDiscount}%)</span>
                  <span className="text-destructive">-{(plTotal * orderDiscount / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-destructive">
                <span>Total Discount</span><span>-{totalDiscount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t border-border pt-2 mt-2">
                <span>Net Amount</span><span>{netAmount.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {createError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {createError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { resetForm(); setView("list"); }}>Cancel</Button>
          <Button onClick={isModify ? handleModify : handleCreate} disabled={createLoading}>
            {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isModify ? "Save Changes" : "Create Order"}
          </Button>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage sales orders</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setSyncOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Sync Sheets
          </Button>
          <Button variant="outline" onClick={() => csvInputRef.current?.click()} disabled={importLoading}>
            {importLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import CSV
          </Button>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <Button variant="outline" onClick={downloadXLSX}>
            <Download className="h-4 w-4 mr-2" /> Download XLSX
          </Button>
          {isAdmin && !deleteMode && (
            <Button variant="outline" onClick={() => { setDeleteMode(true); setSelectedIds(new Set()); }}>
              <Trash className="h-4 w-4 mr-2" /> Delete Orders
            </Button>
          )}
          {isAdmin && deleteMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => {
                if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
              }}>
                {selectedIds.size === filteredOrders.length ? <CheckSquare className="h-4 w-4 mr-1" /> : <Square className="h-4 w-4 mr-1" />}
                {selectedIds.size === filteredOrders.length ? "Deselect All" : "Select All"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedIds.size === 0 || deleteLoading}>
                {deleteLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete ({selectedIds.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }}>
                Cancel
              </Button>
            </>
          )}
          {!deleteMode && (
            <Button onClick={() => { resetForm(); setView("create"); }}>
              <Plus className="h-4 w-4 mr-2" /> New Order
            </Button>
          )}
        </div>
      </div>

      <SheetSyncModal open={syncOpen} onClose={() => setSyncOpen(false)} onSynced={loadAll} />

      {importSuccess && <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 text-sm font-medium">{importSuccess}</div>}
      {importError && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{importError}</div>}

      {/* Mark as Done Modal */}
      {doneModalOrder && (() => {
        const netAmt = getDoneNetAmount(doneModalOrder, donePricelistId, doneDiscount, doneDiscountEnabled);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Complete Order #{doneModalOrder.order_id}</h2>
                <button onClick={() => setDoneModalOrder(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[70vh]">
                {/* Pricelist */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pricelist *</label>
                  <SearchableSelect
                    options={[...pricelists].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.name }))}
                    value={donePricelistId}
                    onChange={(val) => {
                      setDonePricelistId(val);
                      setDoneProducts(doneProducts.map((p) => {
                        const price = priceItems.find((i) => i.pricelist_id === val && i.variant_id === p.variant_id)?.price ?? 0;
                        return { ...p, unit_price: price, final_price: price * (1 - p.product_discount / 100) };
                      }));
                    }}
                    placeholder="Select pricelist"
                  />
                </div>

                {/* Products Table */}
                {doneProducts.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Products</label>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left py-2 px-3">Variant</th>
                            <th className="text-center py-2 px-2">Qty</th>
                            <th className="text-center py-2 px-2">Price</th>
                            <th className="text-center py-2 px-2">Disc%</th>
                            <th className="text-right py-2 px-3">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {doneProducts.map((p, i) => {
                            const v = variants.find((v) => v.id === p.variant_id);
                            const pr = v?.productId ? products.find((pr) => pr.id === v.productId) : undefined;
                            return (
                              <tr key={i} className="border-b border-border/50 last:border-0">
                                <td className="py-2 px-3">
                                  <p className="font-medium truncate max-w-[120px]">{v?.name || p.variant_id}</p>
                                  {pr && <p className="text-muted-foreground truncate max-w-[120px]">{pr.name}</p>}
                                </td>
                                <td className="py-2 px-2">
                                  <input type="number" min={1} value={p.quantity}
                                    onChange={(e) => updateDoneProduct(i, "quantity", Number(e.target.value))}
                                    style={{ width: 55, textAlign: "center" }} />
                                </td>
                                <td className="py-2 px-2">
                                  <input type="number" min={0} value={p.unit_price}
                                    onChange={(e) => updateDoneProduct(i, "unit_price", Number(e.target.value))}
                                    style={{ width: 75, textAlign: "center" }} />
                                </td>
                                <td className="py-2 px-2">
                                  <input type="number" min={0} max={100} value={p.product_discount}
                                    onChange={(e) => updateDoneProduct(i, "product_discount", Number(e.target.value))}
                                    style={{ width: 55, textAlign: "center" }} />
                                </td>
                                <td className="py-2 px-3 text-right font-medium">
                                  {(p.final_price * p.quantity).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Order Discount */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Order Discount</label>
                  <button
                    onClick={() => { setDoneDiscountEnabled(!doneDiscountEnabled); if (doneDiscountEnabled) setDoneDiscount(0); }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${doneDiscountEnabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${doneDiscountEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                  {doneDiscountEnabled && (
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} max={100} value={doneDiscount}
                        onChange={(e) => setDoneDiscount(Number(e.target.value))} style={{ width: 80 }} />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Methods *</label>
                    <Button size="sm" onClick={() => {
                      const paid = donePayments.reduce((s, p) => s + p.amount, 0);
                      setDonePayments([...donePayments, { method_id: "", amount: Math.max(0, Number((netAmt - paid).toFixed(2))) }]);
                    }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  {donePayments.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <SearchableSelect
                          options={[...paymentMethods].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name }))}
                          value={p.method_id}
                          onChange={(val) => {
                            const updated = [...donePayments];
                            updated[i] = { ...updated[i], method_id: val };
                            setDonePayments(updated);
                          }}
                          placeholder="Method"
                        />
                      </div>
                      <input type="number" min={0} value={p.amount}
                        onChange={(e) => {
                          const updated = [...donePayments];
                          updated[i] = { ...updated[i], amount: Number(e.target.value) };
                          setDonePayments(updated);
                        }}
                        style={{ width: 100 }} />
                      <Button variant="destructive" size="icon-sm" onClick={() => setDonePayments(donePayments.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="p-3 bg-muted/30 rounded-lg space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{doneProducts.reduce((s, p) => s + p.final_price * p.quantity, 0).toLocaleString()}</span>
                  </div>
                  {doneDiscountEnabled && doneDiscount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Order Discount ({doneDiscount}%)</span>
                      <span className="text-destructive">-{(doneProducts.reduce((s, p) => s + p.final_price * p.quantity, 0) * doneDiscount / 100).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                    <span>Net Amount</span>
                    <span>{netAmt.toLocaleString()}</span>
                  </div>
                </div>

                {doneError && <p className="text-destructive text-sm">{doneError}</p>}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDoneModalOrder(null)}>Cancel</Button>
                <Button onClick={handleMarkAsDone} disabled={doneLoading} className="bg-green-600 hover:bg-green-700 text-white">
                  {doneLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Mark as Done
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{filteredOrders.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filteredOrders.reduce((s, o) => s + (o.net_amount || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Discount</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {filteredOrders.reduce((s, o) => s + (o.total_discount || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Row 1 */}
          <div className="flex flex-wrap items-end border-b border-border">
            <div className="flex flex-col gap-1 px-4 py-3 flex-1 min-w-[180px] border-r border-border">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Search</span>
              <input placeholder="Order ID, agent, location..." value={filterSearch} onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                className="bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/50 w-full p-0 h-6" />
            </div>
            <div className="flex flex-col gap-1 px-4 py-3 w-40 border-r border-border">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">From</span>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                className="bg-transparent border-0 outline-none text-sm text-foreground w-full p-0 h-6 [color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1 px-4 py-3 w-40 border-r border-border">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">To</span>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                className="bg-transparent border-0 outline-none text-sm text-foreground w-full p-0 h-6 [color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1 px-4 py-3 w-36 border-r border-border">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Status</span>
              <SearchableSelect options={[{ value: "", label: "All" }, { value: "draft", label: "Draft" }, { value: "done", label: "Done" }]}
                value={filterType} onChange={setFilterType} placeholder="All" />
            </div>
            <div className="flex flex-col gap-1 px-4 py-3 w-44 border-r border-border">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Transaction</span>
              <SearchableSelect options={[
                { value: "", label: "All" },
                { value: "sale", label: "Sale" },
                { value: "refund", label: "Refund" },
                { value: "replacement", label: "Replacement" },
                { value: "zerocost", label: "Zerocost" },
                { value: "ceo_request", label: "CEO Request" },
              ]} value={filterTransactionType} onChange={(v) => { setFilterTransactionType(v); setPage(1); }} placeholder="All" />
            </div>
            {hasFilters && (
              <div className="px-4 py-3 flex items-center">
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">Clear all</button>
              </div>
            )}
          </div>
          {/* Row 2 */}
          <div className="flex flex-wrap">
            {([
              { label: "Location", value: filterLocation, onChange: setFilterLocation, opts: locations },
              { label: "Agent", value: filterAgent, onChange: setFilterAgent, opts: agents },
              { label: "Pricelist", value: filterPricelist, onChange: setFilterPricelist, opts: pricelists },
              { label: "Payment Method", value: filterPaymentMethod, onChange: setFilterPaymentMethod, opts: paymentMethods },
              { label: "Brand", value: filterBrand, onChange: setFilterBrand, opts: brands },
              { label: "Category", value: filterCategory, onChange: setFilterCategory, opts: categories },
              { label: "Line", value: filterLine, onChange: setFilterLine, opts: lines },
              { label: "Product", value: filterProduct, onChange: setFilterProduct, opts: products },
              { label: "Variant", value: filterVariant, onChange: setFilterVariant, opts: variants },
            ] as { label: string; value: string; onChange: (v: string) => void; opts: { id: string; name: string }[] }[]).map(({ label, value, onChange, opts }, i, arr) => (
              <div key={label} className={`flex flex-col gap-1 px-4 py-3 w-44 ${i < arr.length - 1 ? "border-r border-border" : ""}`}>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <SearchableSelect
                  options={[{ value: "", label: "All" }, ...[...opts].sort((a, b) => a.name.localeCompare(b.name)).map((o) => ({ value: o.id, label: o.name }))]}
                  value={value} onChange={onChange} placeholder="All"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-4">
          {filteredOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              {hasFilters ? "No orders match the filters." : "No orders yet."}
            </p>
          ) : (
            <div className="overflow-x-auto pb-2" style={{scrollbarWidth:"thin"}}>
            <table className="text-sm" style={{minWidth:"1400px",width:"100%"}}>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {deleteMode && <th className="py-3 px-4 w-10"></th>}
                  <th className="text-left py-3 px-4 whitespace-nowrap">Order ID</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Created At</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Transaction</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Sales Person</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Location</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Pricelist</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Items</th>
                  <th className="text-left py-3 px-4 whitespace-nowrap">Net Amount</th>
                  {isAdmin && !deleteMode && <th className="text-right py-3 px-4"></th>}
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-b border-border/50 transition-colors ${deleteMode ? (selectedIds.has(o.id) ? "bg-destructive/10" : "hover:bg-muted/20") : "hover:bg-muted/30 cursor-pointer"}`}
                    onClick={() => {
                      if (deleteMode) { toggleSelect(o.id); return; }
                      setSelectedOrder(o); setView("detail");
                    }}
                  >
                    {deleteMode && (
                      <td className="py-3 px-4 whitespace-nowrap">
                        {selectedIds.has(o.id)
                          ? <CheckSquare className="h-4 w-4 text-destructive" />
                          : <Square className="h-4 w-4 text-muted-foreground" />}
                      </td>
                    )}
                    <td className="py-3 px-4 font-mono font-medium">{o.order_id}</td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{o.date}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : o.createdAt ? new Date(o.createdAt).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${o.type === "done" ? "bg-green-500/15 text-green-500" : "bg-yellow-500/15 text-yellow-500"}`}>
                        {o.type === "done" ? "Done" : "Draft"}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getTxBadge(o.transaction_type)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{getAgentName(o.sales_person_id)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{getLocationName(o.location_id)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{getPricelistName(o.pricelist_id)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{o.products?.length || 0} items</td>
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{o.net_amount?.toLocaleString()}</td>
                    {isAdmin && !deleteMode && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {o.type === "draft" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openDoneModal(o); }}
                              className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors text-green-500"
                              title="Mark as Done"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); openModify(o); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit order"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length} orders
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-border disabled:opacity-30 hover:bg-muted transition-colors">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-border disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p2 = start + i;
              return (
                <button key={p2} onClick={() => setPage(p2)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${p2 === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {p2}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-border disabled:opacity-30 hover:bg-muted transition-colors">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-border disabled:opacity-30 hover:bg-muted transition-colors">»</button>
          </div>
        </div>
      )}
    </div>
  );
}