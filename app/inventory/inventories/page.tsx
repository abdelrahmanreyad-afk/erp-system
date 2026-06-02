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
import { Loader2, MapPin, ChevronRight, ArrowLeft, Download, AlertTriangle, DollarSign } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  warehouse: "Warehouse", branch: "Branch", branch_warehouse: "Branch Warehouse",
};

type Pricelist = { id: string; name: string; isOriginal?: boolean };
type PriceItem = { id: string; pricelist_id: string; variant_id: string; price: number };

export default function InventoriesPage() {
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
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedPricelist, setSelectedPricelist] = useState("");

  // List filters
  const [filterArea, setFilterArea] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");

  // Detail filters
  const [detailFilterBrand, setDetailFilterBrand] = useState("");
  const [detailFilterLine, setDetailFilterLine] = useState("");
  const [detailFilterProduct, setDetailFilterProduct] = useState("");
  const [detailSearch, setDetailSearch] = useState("");

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
        // Default to original pricelist
        const original = pls.find((p) => p.isOriginal);
        if (original) setSelectedPricelist(original.id);
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const getVariant = (id: string) => variants.find((v) => v.id === id);
  const getProduct = (id: string) => products.find((p) => p.id === id);
  const getBrandById = (id: string) => brands.find((b) => b.id === id);
  const getLineById = (id: string) => lines.find((l) => l.id === id);
  const getAreaById = (id: string) => areas.find((a) => a.id === id);

  function getPrice(variantId: string) {
    if (!selectedPricelist) return 0;
    return priceItems.find((i) => i.pricelist_id === selectedPricelist && i.variant_id === variantId)?.price ?? 0;
  }

  function getLocationStock(locationId: string) {
    return stock.filter((s) => s.location_id === locationId);
  }

  function calcStockAmount(locationStock: StockItem[]) {
    return locationStock.reduce((sum, s) => sum + s.quantity * getPrice(s.variant_id), 0);
  }

  function downloadCSV(loc: Location) {
    const locationStock = getLocationStock(loc.id);
    const rows = [
      ["Variant", "Code", "Product", "Brand", "Line", "Quantity", "Price", "Amount"],
      ...locationStock.map((s) => {
        const v = getVariant(s.variant_id);
        const p = v?.productId ? getProduct(v.productId) : undefined;
        const b = p?.brandId ? getBrandById(p.brandId) : undefined;
        const l = p?.lineId ? getLineById(p.lineId) : undefined;
        const price = getPrice(s.variant_id);
        return [v?.name || "", v?.code || "", p?.name || "", b?.name || "", l?.name || "", s.quantity.toString(), price.toString(), (s.quantity * price).toString()];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${loc.name.replace(/\s+/g, "_")}_stock.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredLocations = useMemo(() => {
    return locations
      .filter((loc) => {
        if (filterArea && loc.area_id !== filterArea) return false;
        if (filterType && loc.type !== filterType) return false;
        if (search && !loc.name.toLowerCase().includes(search.toLowerCase()) &&
            !loc.code?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, filterArea, filterType, search]);

  const detailFilteredProducts = useMemo(() => {
    return [...products]
      .filter((p) => {
        if (detailFilterBrand && p.brandId !== detailFilterBrand) return false;
        if (detailFilterLine && p.lineId !== detailFilterLine) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, detailFilterBrand, detailFilterLine]);

  const detailStock = useMemo(() => {
    if (!selectedLocation) return [];
    return getLocationStock(selectedLocation.id).filter((s) => {
      const v = getVariant(s.variant_id);
      const p = v?.productId ? getProduct(v.productId) : undefined;
      if (detailFilterBrand && p?.brandId !== detailFilterBrand) return false;
      if (detailFilterLine && p?.lineId !== detailFilterLine) return false;
      if (detailFilterProduct && v?.productId !== detailFilterProduct) return false;
      if (detailSearch) {
        const b = p?.brandId ? getBrandById(p.brandId) : undefined;
        const l = p?.lineId ? getLineById(p.lineId) : undefined;
        const str = [v?.name, p?.name, b?.name, l?.name].filter(Boolean).join(" ").toLowerCase();
        if (!str.includes(detailSearch.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.quantity - a.quantity);
  }, [selectedLocation, stock, detailFilterBrand, detailFilterLine, detailFilterProduct, detailSearch, variants, products]);

  const hasListFilters = filterArea || filterType || search;
  const hasDetailFilters = detailFilterBrand || detailFilterLine || detailFilterProduct || detailSearch;

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="p-6 text-destructive">{error}</p>;

  // ── Location Detail View ──
  if (selectedLocation) {
    const allLocationStock = getLocationStock(selectedLocation.id);
    const totalUnits = allLocationStock.reduce((sum, s) => sum + s.quantity, 0);
    const totalAmount = calcStockAmount(allLocationStock);
    const lowStock = allLocationStock.filter((s) => s.quantity <= 10).length;
    const area = selectedLocation.area_id ? getAreaById(selectedLocation.area_id) : undefined;

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon-sm" onClick={() => { setSelectedLocation(null); setDetailFilterBrand(""); setDetailFilterLine(""); setDetailFilterProduct(""); setDetailSearch(""); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{selectedLocation.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {selectedLocation.code && <span className="text-xs text-muted-foreground font-mono">{selectedLocation.code}</span>}
                {selectedLocation.type && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{TYPE_LABELS[selectedLocation.type]}</span>}
                {area && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{area.name}</span>}
              </div>
            </div>
          </div>
          <Button onClick={() => downloadCSV(selectedLocation)}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
        </div>

        {/* Pricelist selector */}
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Units</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{totalUnits.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Variants</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{allLocationStock.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Stock Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{pricelists.find(p => p.id === selectedPricelist)?.name || "No pricelist"}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Low Stock</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{lowStock}</div>
              <p className="text-xs text-muted-foreground mt-1">Below 10 units</p>
            </CardContent>
          </Card>
        </div>

        {/* Detail Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Filters</CardTitle>
              {hasDetailFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setDetailFilterBrand(""); setDetailFilterLine(""); setDetailFilterProduct(""); setDetailSearch(""); }}>
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SearchableSelect
                options={[...brands].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ value: b.id, label: b.name }))}
                value={detailFilterBrand}
                onChange={(v) => { setDetailFilterBrand(v); setDetailFilterProduct(""); }}
                placeholder="All Brands"
              />
              <SearchableSelect
                options={[...lines].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ value: l.id, label: l.name }))}
                value={detailFilterLine}
                onChange={(v) => { setDetailFilterLine(v); setDetailFilterProduct(""); }}
                placeholder="All Lines"
              />
              <SearchableSelect
                options={detailFilteredProducts.map((p) => ({ value: p.id, label: p.name }))}
                value={detailFilterProduct}
                onChange={setDetailFilterProduct}
                placeholder="All Products"
              />
              <input placeholder="Search variant, product..." value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Stock Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Showing {detailStock.length} of {allLocationStock.length} records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailStock.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No records match your filters.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4">Variant</th>
                    <th className="text-left py-3 px-4">Product</th>
                    <th className="text-left py-3 px-4">Brand / Line</th>
                    <th className="text-left py-3 px-4">Qty</th>
                    <th className="text-left py-3 px-4">Price</th>
                    <th className="text-left py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detailStock.map((item) => {
                    const v = getVariant(item.variant_id);
                    const p = v?.productId ? getProduct(v.productId) : undefined;
                    const b = p?.brandId ? getBrandById(p.brandId) : undefined;
                    const l = p?.lineId ? getLineById(p.lineId) : undefined;
                    const price = getPrice(item.variant_id);
                    const isLow = item.quantity <= 10;
                    return (
                      <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium">{v?.name || item.variant_id}</td>
                        <td className="py-3 px-4">{p?.name || "—"}</td>
                        <td className="py-3 px-4">
                          {b && <div>{b.name}</div>}
                          {l && <div className="text-xs text-muted-foreground">{l.name}</div>}
                          {!b && !l && "—"}
                        </td>
                        <td className="py-3 px-4 font-medium">{item.quantity}</td>
                        <td className="py-3 px-4 text-muted-foreground">{price > 0 ? price.toLocaleString() : "—"}</td>
                        <td className="py-3 px-4 font-medium">{price > 0 ? (item.quantity * price).toLocaleString() : "—"}</td>
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

  // ── Locations List View ──
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventories</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a location to view its stock</p>
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

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <SearchableSelect
              options={[...areas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name }))}
              value={filterArea}
              onChange={setFilterArea}
              placeholder="All Areas"
            />
            <SearchableSelect
              options={[
                { value: "branch", label: "Branch" },
                { value: "warehouse", label: "Warehouse" },
                { value: "branch_warehouse", label: "Branch Warehouse" },
              ]}
              value={filterType}
              onChange={setFilterType}
              placeholder="All Types"
            />
            {hasListFilters && (
              <Button variant="outline" onClick={() => { setFilterArea(""); setFilterType(""); setSearch(""); }}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">Showing {filteredLocations.length} of {locations.length} locations</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocations.length === 0 ? (
          <p className="text-muted-foreground col-span-3 text-center py-10">No locations match your filters.</p>
        ) : (
          filteredLocations.map((location) => {
            const locationStock = getLocationStock(location.id);
            const totalUnits = locationStock.reduce((sum, s) => sum + s.quantity, 0);
            const totalAmount = calcStockAmount(locationStock);
            const lowCount = locationStock.filter((s) => s.quantity <= 10).length;
            const area = location.area_id ? getAreaById(location.area_id) : undefined;

            return (
              <Card key={location.id} className="cursor-pointer hover:border-border/80 transition-all hover:bg-muted/20" onClick={() => setSelectedLocation(location)}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-muted">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{location.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        {location.code && <p className="text-xs text-muted-foreground font-mono">{location.code}</p>}
                        {area && <p className="text-xs text-muted-foreground">· {area.name}</p>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Units</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div>
                        <p className="text-2xl font-bold">{locationStock.length}</p>
                        <p className="text-xs text-muted-foreground">Variants</p>
                      </div>
                      {selectedPricelist && (
                        <>
                          <div className="h-8 w-px bg-border" />
                          <div>
                            <p className="text-lg font-bold">{totalAmount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Amount</p>
                          </div>
                        </>
                      )}
                    </div>
                    {lowCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full">
                        <AlertTriangle className="h-3 w-3" /> {lowCount} low
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {location.type && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{TYPE_LABELS[location.type]}</span>}
                    {area && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1"><MapPin className="h-3 w-3" />{area.name}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}