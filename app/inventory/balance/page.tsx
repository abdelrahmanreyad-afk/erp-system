"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  getStock, getVariants, getLocations, getProducts, getBrands, getLines, getAreas,
  StockItem, Variant, Location, Product, Brand, Line, Area,
} from "@/lib/stock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Loader2, Boxes, MapPin, AlertTriangle, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, DollarSign } from "lucide-react";

type Pricelist = { id: string; name: string; isOriginal?: boolean };
type PriceItem = { id: string; pricelist_id: string; variant_id: string; price: number };
type SortKey = "variant" | "location" | "area" | "quantity" | "amount";
type SortDir = "asc" | "desc";

export default function BalancePage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterLine, setFilterLine] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterVariant, setFilterVariant] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedPricelist, setSelectedPricelist] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [showLowOnly, setShowLowOnly] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("quantity");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [s, v, l, p, b, ln, a, plSnap, piSnap] = await Promise.all([
          getStock(), getVariants(), getLocations(), getProducts(),
          getBrands(), getLines(), getAreas(),
          getDocs(collection(db, "pricelists")),
          getDocs(collection(db, "pricelist_items")),
        ]);
        setStock(s); setVariants(v); setLocations(l); setProducts(p);
        setBrands(b); setLines(ln); setAreas(a);
        const pls = plSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pricelist));
        setPricelists(pls);
        setPriceItems(piSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceItem)));
        const original = pls.find((p) => p.isOriginal);
        if (original) setSelectedPricelist(original.id);
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getVariant = (id: string) => variants.find((v) => v.id === id);
  const getLocation = (id: string) => locations.find((l) => l.id === id);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getBrand = (id: string) => brands.find((b) => b.id === id);
  const getLine = (id: string) => lines.find((l) => l.id === id);
  const getArea = (id: string) => areas.find((a) => a.id === id);

  function getPrice(variantId: string) {
    if (!selectedPricelist) return 0;
    return priceItems.find((i) => i.pricelist_id === selectedPricelist && i.variant_id === variantId)?.price ?? 0;
  }

  // Stats
  const totalUnits = stock.reduce((sum, s) => sum + s.quantity, 0);
  const totalAmount = stock.reduce((sum, s) => sum + s.quantity * getPrice(s.variant_id), 0);
  const uniqueVariants = new Set(stock.map((s) => s.variant_id)).size;
  const uniqueLocations = new Set(stock.map((s) => s.location_id)).size;
  const lowStockCount = stock.filter((s) => s.quantity <= lowStockThreshold).length;

  // Cascading filters
  const filteredProducts = useMemo(() => {
    return [...products]
      .filter((p) => {
        if (filterBrand && p.brandId !== filterBrand) return false;
        if (filterLine && p.lineId !== filterLine) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filterBrand, filterLine]);

  const filteredVariantOptions = useMemo(() => {
    return [...variants]
      .filter((v) => {
        if (filterProduct) return v.productId === filterProduct;
        if (filterBrand || filterLine) {
          const p = v.productId ? getProduct(v.productId) : undefined;
          if (!p) return false;
          if (filterBrand && p.brandId !== filterBrand) return false;
          if (filterLine && p.lineId !== filterLine) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, filterProduct, filterBrand, filterLine]);

  const filteredLocationIds = useMemo(() => {
    return locations.filter((l) => {
      if (filterArea && l.area_id !== filterArea) return false;
      if (filterType && l.type !== filterType) return false;
      return true;
    }).map((l) => l.id);
  }, [locations, filterArea, filterType]);

  const filteredLocationOptions = useMemo(() => {
    return [...locations]
      .filter((l) => !filterArea && !filterType ? true : filteredLocationIds.includes(l.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, filteredLocationIds, filterArea, filterType]);

  // Main filtered + sorted
  const filtered = useMemo(() => {
    const filteredVariantIds = new Set(filteredVariantOptions.map((v) => v.id));

    let result = stock.filter((s) => {
      if ((filterBrand || filterLine || filterProduct) && !filteredVariantIds.has(s.variant_id)) return false;
      if (filterVariant && s.variant_id !== filterVariant) return false;
      if ((filterArea || filterType) && !filteredLocationIds.includes(s.location_id)) return false;
      if (filterLocation && s.location_id !== filterLocation) return false;
      if (showLowOnly && s.quantity > lowStockThreshold) return false;
      if (search) {
        const v = getVariant(s.variant_id);
        const l = getLocation(s.location_id);
        const p = v?.productId ? getProduct(v.productId) : undefined;
        const b = p?.brandId ? getBrand(p.brandId) : undefined;
        const ln = p?.lineId ? getLine(p.lineId) : undefined;
        const a = l?.area_id ? getArea(l.area_id) : undefined;
        const str = [v?.name, v?.code, l?.name, l?.code, p?.name, b?.name, ln?.name, a?.name]
          .filter(Boolean).join(" ").toLowerCase();
        if (!str.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortKey === "quantity") return sortDir === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity;
      if (sortKey === "amount") {
        const amtA = a.quantity * getPrice(a.variant_id);
        const amtB = b.quantity * getPrice(b.variant_id);
        return sortDir === "asc" ? amtA - amtB : amtB - amtA;
      }
      let valA = ""; let valB = "";
      if (sortKey === "variant") { valA = getVariant(a.variant_id)?.name || ""; valB = getVariant(b.variant_id)?.name || ""; }
      if (sortKey === "location") { valA = getLocation(a.location_id)?.name || ""; valB = getLocation(b.location_id)?.name || ""; }
      if (sortKey === "area") {
        valA = getArea(getLocation(a.location_id)?.area_id || "")?.name || "";
        valB = getArea(getLocation(b.location_id)?.area_id || "")?.name || "";
      }
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return result;
  }, [stock, filteredVariantOptions, filteredLocationIds, filterVariant, filterLocation, showLowOnly, lowStockThreshold, search, sortKey, sortDir, selectedPricelist]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  }

  function clearFilters() {
    setSearch(""); setFilterBrand(""); setFilterLine(""); setFilterProduct("");
    setFilterVariant(""); setFilterArea(""); setFilterType(""); setFilterLocation("");
    setShowLowOnly(false);
  }

  const hasFilters = search || filterBrand || filterLine || filterProduct || filterVariant || filterArea || filterType || filterLocation || showLowOnly;

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="p-6 text-destructive">{error}</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of all stock levels</p>
        </div>
        {pricelists.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Pricelist:</span>
            <SearchableSelect
              options={[...pricelists].sort((a, b) => a.name.localeCompare(b.name)).map((pl) => ({ value: pl.id, label: pl.name + (pl.isOriginal ? " (Original)" : "") }))}
              value={selectedPricelist}
              onChange={setSelectedPricelist}
              placeholder="Select pricelist"
              className="w-56"
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Units</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stock Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{pricelists.find(p => p.id === selectedPricelist)?.name || "No pricelist"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Variants</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{uniqueVariants}</div>
            <p className="text-xs text-muted-foreground mt-1">With stock records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{uniqueLocations}</div>
            <p className="text-xs text-muted-foreground mt-1">With stock records</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Below {lowStockThreshold} units</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SearchableSelect
              options={[...brands].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ value: b.id, label: b.name }))}
              value={filterBrand}
              onChange={(v) => { setFilterBrand(v); setFilterProduct(""); setFilterVariant(""); }}
              placeholder="All Brands"
            />
            <SearchableSelect
              options={[...lines].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ value: l.id, label: l.name }))}
              value={filterLine}
              onChange={(v) => { setFilterLine(v); setFilterProduct(""); setFilterVariant(""); }}
              placeholder="All Lines"
            />
            <SearchableSelect
              options={filteredProducts.map((p) => ({ value: p.id, label: p.name }))}
              value={filterProduct}
              onChange={(v) => { setFilterProduct(v); setFilterVariant(""); }}
              placeholder="All Products"
            />
            <SearchableSelect
              options={filteredVariantOptions.map((v) => ({ value: v.id, label: v.name }))}
              value={filterVariant}
              onChange={setFilterVariant}
              placeholder="All Variants"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SearchableSelect
              options={[...areas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name }))}
              value={filterArea}
              onChange={(v) => { setFilterArea(v); setFilterLocation(""); }}
              placeholder="All Areas"
            />
            <SearchableSelect
              options={[
                { value: "branch", label: "Branch" },
                { value: "branch_warehouse", label: "Branch Warehouse" },
                { value: "warehouse", label: "Warehouse" },
              ]}
              value={filterType}
              onChange={(v) => { setFilterType(v); setFilterLocation(""); }}
              placeholder="All Types"
            />
            <SearchableSelect
              options={filteredLocationOptions.map((l) => ({ value: l.id, label: l.name }))}
              value={filterLocation}
              onChange={setFilterLocation}
              placeholder="All Locations"
            />
            <input placeholder="Search anything..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowLowOnly(!showLowOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showLowOnly ? "bg-orange-500/10 border-orange-500/30 text-orange-500" : "bg-transparent border-border text-muted-foreground hover:text-foreground"}`}
            >
              <AlertTriangle className="h-4 w-4" /> Low Stock Only
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Threshold:</span>
              <input type="number" min={1} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Number(e.target.value))} style={{ width: 70, padding: "4px 8px" }} />
              <span className="text-xs text-muted-foreground">units</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Showing {filtered.length} of {stock.length} records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No records match your filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort("variant")}>
                      Variant <SortIcon k="variant" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">Product / Brand</th>
                  <th className="text-left py-3 px-4">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort("location")}>
                      Location <SortIcon k="location" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort("area")}>
                      Area <SortIcon k="area" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort("quantity")}>
                      Qty <SortIcon k="quantity" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">Price</th>
                  <th className="text-left py-3 px-4">
                    <button className="flex items-center hover:text-foreground transition-colors" onClick={() => toggleSort("amount")}>
                      Amount <SortIcon k="amount" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const v = getVariant(item.variant_id);
                  const l = getLocation(item.location_id);
                  const p = v?.productId ? getProduct(v.productId) : undefined;
                  const b = p?.brandId ? getBrand(p.brandId) : undefined;
                  const a = l?.area_id ? getArea(l.area_id) : undefined;
                  const price = getPrice(item.variant_id);
                  const amount = item.quantity * price;
                  const isLow = item.quantity <= lowStockThreshold;
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{v?.name || item.variant_id}</td>
                      <td className="py-3 px-4">
                        <div>{p?.name || "—"}</div>
                        {b && <div className="text-xs text-muted-foreground">{b.name}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div>{l?.name || item.location_id}</div>
                        {l?.code && <div className="text-xs text-muted-foreground font-mono">{l.code}</div>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {a ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.name}</span> : "—"}
                      </td>
                      <td className="py-3 px-4 font-medium">{item.quantity}</td>
                      <td className="py-3 px-4 text-muted-foreground">{price > 0 ? price.toLocaleString() : "—"}</td>
                      <td className="py-3 px-4 font-medium">{price > 0 ? amount.toLocaleString() : "—"}</td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Low
                          </span>
                        ) : (
                          <span className="inline-flex text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-full">OK</span>
                        )}
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