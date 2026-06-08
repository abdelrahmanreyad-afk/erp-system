"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, query, where,
} from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Loader2, RefreshCw, CheckCircle2, AlertCircle,
  ChevronRight, X, TableProperties,
} from "lucide-react";

type Location = { id: string; name: string; code: string };
type SheetLink = {
  id: string; location_id: string; sheet_url: string; sheet_id: string;
  tab_name: string; header_row: number; active: boolean;
  column_mapping: {
    salesperson: string; location: string; date: string;
    order_id: string; variants: string;
  };
};

type PreviewRow = {
  row_num: number;
  order_id: string;
  date: string;
  salesperson_code: string;
  location_code: string;
  variant_codes: string[];
  raw: string[];
  status: "new" | "duplicate" | "error";
  error?: string;
  selected: boolean;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSynced: () => void;
}

function colLetter(col: string): number {
  return col.toUpperCase().charCodeAt(0) - 65;
}

export default function SheetSyncModal({ open, onClose, onSynced }: Props) {
  const [step, setStep] = useState<"select" | "preview" | "done">("select");

  // Step 1 state
  const [locations, setLocations] = useState<Location[]>([]);
  const [sheetLinks, setSheetLinks] = useState<SheetLink[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [loadingStep1, setLoadingStep1] = useState(false);
  const [step1Error, setStep1Error] = useState("");

  // Step 2 state
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelectedLocationId("");
    setFilterDate("");
    setPreview([]);
    setSyncResult(null);
    setStep1Error("");

    async function load() {
      const [locSnap, sheetSnap] = await Promise.all([
        getDocs(collection(db, "locations")),
        getDocs(collection(db, "branch_sheets")),
      ]);
      setLocations(locSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Location)));
      setSheetLinks(sheetSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as SheetLink))
        .filter((s) => s.active));
    }
    load();
  }, [open]);

  const activeLinks = sheetLinks.filter((s) => s.active !== false);
  const linkedLocationIds = new Set(activeLinks.map((s) => s.location_id));
  const availableLocations = locations.filter((l) => linkedLocationIds.has(l.id));
  const selectedLink = activeLinks.find((s) => s.location_id === selectedLocationId);

  // ── Fetch sheet data via Google Sheets CSV export ──
  async function fetchSheetData(link: SheetLink): Promise<string[][]> {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${link.sheet_id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(link.tab_name)}`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Failed to fetch sheet (${res.status}). Make sure the sheet is set to "Anyone with the link can view".`);
    const text = await res.text();
    // Parse CSV properly
    return text.trim().split("\n").map((row) => {
      const cells: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
          if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          cells.push(cur.trim()); cur = "";
        } else cur += ch;
      }
      cells.push(cur.trim());
      return cells;
    });
  }

  async function handleFetchPreview() {
    if (!selectedLocationId) { setStep1Error("Please select a branch."); return; }
    if (!selectedLink) { setStep1Error("No active sheet linked to this branch."); return; }

    setLoadingStep1(true);
    setStep1Error("");

    try {
      const rows = await fetchSheetData(selectedLink);
      const m = selectedLink.column_mapping;
      const headerRow = (selectedLink.header_row || 1) - 1; // 0-based
      const dataRows = rows.slice(headerRow + 1);

      // Fetch existing order_ids to detect duplicates
      const existingSnap = await getDocs(query(
        collection(db, "orders"),
        where("location_id", "==", selectedLocationId)
      ));
      const existingOrderIds = new Set(
        existingSnap.docs.map((d) => d.data().order_id?.toString().trim())
      );

      const previewRows: PreviewRow[] = [];

      dataRows.forEach((cells, i) => {
        const orderId = cells[colLetter(m.order_id)]?.trim() || "";
        const date = cells[colLetter(m.date)]?.trim() || "";
        const spCode = cells[colLetter(m.salesperson)]?.trim() || "";
        const locCode = cells[colLetter(m.location)]?.trim() || "";
        const variantsRaw = cells[colLetter(m.variants)]?.trim() || "";

        // Skip completely empty rows
        if (!orderId && !variantsRaw) return;

        // Filter by date if specified
        if (filterDate && date !== filterDate) return;

        const variantCodes = variantsRaw.split(",").map((v) => v.trim()).filter(Boolean);

        let status: PreviewRow["status"] = "new";
        let error = "";

        if (!orderId) { status = "error"; error = "Missing Order ID"; }
        else if (!variantsRaw) { status = "error"; error = "Missing variants"; }
        else if (existingOrderIds.has(orderId)) { status = "duplicate"; }

        previewRows.push({
          row_num: headerRow + 2 + i,
          order_id: orderId,
          date,
          salesperson_code: spCode,
          location_code: locCode,
          variant_codes: variantCodes,
          raw: cells,
          status,
          error,
          selected: status === "new",
        });
      });

      if (previewRows.length === 0) {
        setStep1Error(filterDate
          ? `No rows found for date ${filterDate}.`
          : "No data rows found in the sheet.");
        return;
      }

      setPreview(previewRows);
      setStep("preview");
    } catch (e: any) {
      setStep1Error(e.message);
    } finally {
      setLoadingStep1(false);
    }
  }

  async function handleSync() {
    if (!selectedLink) return;
    setSyncing(true);

    const toSync = preview.filter((r) => r.selected && r.status === "new");
    let added = 0;
    let skipped = 0;

    for (const row of toSync) {
      try {
        await addDoc(collection(db, "orders"), {
          order_id: row.order_id,
          date: row.date,
          salesperson_code: row.salesperson_code,
          location_id: selectedLocationId,
          location_code: row.location_code,
          type: "draft",
          source: "google_sheets",
          variant_codes: row.variant_codes,
          products: row.variant_codes.map((code) => ({
            variant_code: code,
            variant_id: "",
            quantity: 1,
            unit_price: 0,
            final_price: 0,
            product_discount: 0,
          })),
          payments: [],
          createdAt: new Date(),
        });
        added++;
      } catch { skipped++; }
    }

    setSyncResult({ added, skipped });
    setSyncing(false);
    setStep("done");
    onSynced();
  }

  const selectedCount = preview.filter((r) => r.selected && r.status === "new").length;
  const newCount = preview.filter((r) => r.status === "new").length;
  const dupCount = preview.filter((r) => r.status === "duplicate").length;
  const errCount = preview.filter((r) => r.status === "error").length;

  function toggleRow(i: number) {
    setPreview((prev) => prev.map((r, idx) =>
      idx === i && r.status === "new" ? { ...r, selected: !r.selected } : r
    ));
  }

  function toggleAll() {
    const allSelected = preview.filter((r) => r.status === "new").every((r) => r.selected);
    setPreview((prev) => prev.map((r) =>
      r.status === "new" ? { ...r, selected: !allSelected } : r
    ));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync Orders from Google Sheets
          </DialogTitle>
          {/* Steps indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
            <span className={step === "select" ? "text-foreground font-medium" : ""}>1. Select Branch</span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === "preview" ? "text-foreground font-medium" : ""}>2. Review Rows</span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === "done" ? "text-foreground font-medium" : ""}>3. Done</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Select ── */}
          {step === "select" && (
            <div className="space-y-4 py-2">
              {availableLocations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No active sheet links found.</p>
                  <p className="text-xs mt-1">Go to Masters → Sheet Links to configure.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Branch *</label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedLocationId}
                      onChange={(e) => { setSelectedLocationId(e.target.value); setStep1Error(""); }}
                    >
                      <option value="">Select branch...</option>
                      {availableLocations.sort((a, b) => a.name.localeCompare(b.name)).map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                      ))}
                    </select>
                  </div>

                  {selectedLink && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
                      <div className="flex items-center gap-2 font-medium text-sm mb-2">
                        <TableProperties className="h-3.5 w-3.5" />
                        Sheet Config
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <span>Tab: <span className="text-foreground">{selectedLink.tab_name}</span></span>
                        <span>Header Row: <span className="text-foreground">{selectedLink.header_row || 1}</span></span>
                        <span>Salesperson: <span className="text-foreground font-mono">Col {selectedLink.column_mapping?.salesperson}</span></span>
                        <span>Date: <span className="text-foreground font-mono">Col {selectedLink.column_mapping?.date}</span></span>
                        <span>Order ID: <span className="text-foreground font-mono">Col {selectedLink.column_mapping?.order_id}</span></span>
                        <span>Variants: <span className="text-foreground font-mono">Col {selectedLink.column_mapping?.variants}</span></span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Filter by Date <span className="text-muted-foreground text-xs">(optional)</span></label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty to fetch all rows from the sheet.</p>
                  </div>

                  {step1Error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{step1Error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-3 py-2">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/15 text-green-500 text-xs font-medium">
                  <CheckCircle2 className="h-3 w-3" /> {newCount} New
                </span>
                {dupCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-500 text-xs font-medium">
                    <AlertCircle className="h-3 w-3" /> {dupCount} Duplicate
                  </span>
                )}
                {errCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
                    <X className="h-3 w-3" /> {errCount} Error
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground self-center">
                  {selectedCount} selected to import
                </span>
              </div>

              {/* Table */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="border-b border-border">
                        <th className="py-2 px-3 text-left w-8">
                          <input type="checkbox"
                            checked={newCount > 0 && preview.filter((r) => r.status === "new").every((r) => r.selected)}
                            onChange={toggleAll}
                            className="rounded"
                          />
                        </th>
                        <th className="py-2 px-3 text-left text-muted-foreground font-medium">Row</th>
                        <th className="py-2 px-3 text-left text-muted-foreground font-medium">Order ID</th>
                        <th className="py-2 px-3 text-left text-muted-foreground font-medium">Date</th>
                        <th className="py-2 px-3 text-left text-muted-foreground font-medium">Salesperson</th>
                        <th className="py-2 px-3 text-left text-muted-foreground font-medium">Variants</th>
                        <th className="py-2 px-3 text-left text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.map((row, i) => (
                        <tr key={i}
                          onClick={() => row.status === "new" && toggleRow(i)}
                          className={`transition-colors ${
                            row.status === "new" ? "hover:bg-muted/20 cursor-pointer" : "opacity-50"
                          } ${row.selected && row.status === "new" ? "bg-green-500/5" : ""}`}
                        >
                          <td className="py-2 px-3">
                            {row.status === "new" && (
                              <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} className="rounded" onClick={(e) => e.stopPropagation()} />
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{row.row_num}</td>
                          <td className="py-2 px-3 font-mono font-medium">{row.order_id || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.date || "—"}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.salesperson_code || "—"}</td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {row.variant_codes.slice(0, 3).map((v, j) => (
                                <span key={j} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{v}</span>
                              ))}
                              {row.variant_codes.length > 3 && (
                                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs">+{row.variant_codes.length - 3}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {row.status === "new" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 text-xs">
                                <CheckCircle2 className="h-2.5 w-2.5" /> New
                              </span>
                            )}
                            {row.status === "duplicate" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 text-xs">
                                <AlertCircle className="h-2.5 w-2.5" /> Duplicate
                              </span>
                            )}
                            {row.status === "error" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs" title={row.error}>
                                <X className="h-2.5 w-2.5" /> {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                ⚠️ Variants will be imported as codes. You can link them to actual variants after import in the Orders page.
              </p>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && syncResult && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Sync Complete!</h3>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-500">{syncResult.added}</p>
                  <p className="text-xs text-muted-foreground">Orders added as Draft</p>
                </div>
                {syncResult.skipped > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-yellow-500">{syncResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-border pt-3 mt-2">
          {step === "select" && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleFetchPreview} disabled={loadingStep1 || !selectedLocationId}>
                {loadingStep1 ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Fetch & Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={handleSync} disabled={syncing || selectedCount === 0}>
                {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Import {selectedCount} Order{selectedCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}