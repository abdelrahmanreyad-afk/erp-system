"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";

type Variant = { id: string; name: string; productId?: string };
type Product = { id: string; name: string };
type Location = { id: string; name: string };
type Pricelist = { id: string; name: string; isOriginal?: boolean };
type PaymentMethod = { id: string; name: string };
type AppUser = { id: string; name: string };

type OrderProduct = {
  variant_id: string; quantity: number; unit_price: number;
  modified_price?: number; product_discount: number; final_price: number;
};
type PaymentEntry = { method_id: string; amount: number };
type Order = {
  id: string; order_id: string; date: string;
  sales_person_id: string; location_id: string; pricelist_id: string;
  products: OrderProduct[]; order_discount: number; payments: PaymentEntry[];
  original_total: number; pricelist_total: number; total_discount: number; net_amount: number;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [oSnap, vSnap, pSnap, lSnap, plSnap, pmSnap, uSnap] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(collection(db, "variants")),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "locations")),
        getDocs(collection(db, "pricelists")),
        getDocs(collection(db, "payment_methods")),
        getDocs(collection(db, "users")),
      ]);
      setOrders(oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => b.order_id?.localeCompare(a.order_id)));
      setVariants(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant)));
      setProducts(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      setLocations(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Location)));
      setPricelists(plSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pricelist)));
      setPaymentMethods(pmSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod)));
      setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
      setLoading(false);
    }
    load();
  }, []);

  const getVariant = (id: string) => variants.find((v) => v.id === id);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getLocationName = (id: string) => locations.find((l) => l.id === id)?.name || id;
  const getPricelistName = (id: string) => pricelists.find((p) => p.id === id)?.name || id;
  const getPaymentMethodName = (id: string) => paymentMethods.find((p) => p.id === id)?.name || id;
  const getUserName = (id: string) => users.find((u) => u.id === id)?.name || id;

  const filtered = orders.filter((o) => {
    if (search && !o.order_id.toLowerCase().includes(search.toLowerCase()) &&
        !getUserName(o.sales_person_id).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterLocation && o.location_id !== filterLocation) return false;
    if (filterAgent && o.sales_person_id !== filterAgent) return false;
    if (filterDate && o.date !== filterDate) return false;
    return true;
  });

  const hasFilters = search || filterLocation || filterAgent || filterDate;

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // ── Order Detail ──
  if (selectedOrder) {
    const o = selectedOrder;
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => setSelectedOrder(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Order #{o.order_id}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {o.date} · {getUserName(o.sales_person_id)} · {getLocationName(o.location_id)} · {getPricelistName(o.pricelist_id)}
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
                  <th className="text-left py-3 px-4">Product</th>
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
                      <td className="py-3 px-4 font-medium">{v?.name || p.variant_id}</td>
                      <td className="py-3 px-4 text-muted-foreground">{pr?.name || "—"}</td>
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
                <span>{o.original_total?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Pricelist ({getPricelistName(o.pricelist_id)})</span>
                <span>{o.pricelist_total?.toLocaleString()}</span>
              </div>
              {o.order_discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Order Discount ({o.order_discount}%)</span>
                  <span className="text-destructive">-{(o.pricelist_total * o.order_discount / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-destructive">
                <span>Total Discount</span>
                <span>-{o.total_discount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-base border-t border-border pt-2 mt-2">
                <span>Net Amount</span>
                <span>{o.net_amount?.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">All sales orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{orders.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{orders.reduce((s, o) => s + (o.net_amount || 0), 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Discount</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-destructive">{orders.reduce((s, o) => s + (o.total_discount || 0), 0).toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Search order ID or agent..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
              <option value="">All Locations</option>
              {[...locations].sort((a, b) => a.name.localeCompare(b.name)).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
              <option value="">All Agents</option>
              {[...users].sort((a, b) => a.name.localeCompare(b.name)).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(""); setFilterLocation(""); setFilterAgent(""); setFilterDate(""); }}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">Showing {filtered.length} of {orders.length} orders</p>

      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No orders found.</p>
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
                {filtered.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(o)}>
                    <td className="py-3 px-4 font-mono font-medium">{o.order_id}</td>
                    <td className="py-3 px-4 text-muted-foreground">{o.date}</td>
                    <td className="py-3 px-4">{getUserName(o.sales_person_id)}</td>
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