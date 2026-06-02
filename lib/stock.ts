import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface StockItem {
  id?: string;
  variant_id: string;
  location_id: string;
  quantity: number;
}

export interface Variant {
  id: string;
  name: string;
  code?: string;
  sku?: string;
  productId?: string;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
  type?: string;
  area_id?: string;
}

export interface Product {
  id: string;
  name: string;
  code?: string;
  brandId?: string;
  categoryId?: string;
  lineId?: string;
}

export interface Brand { id: string; name: string; }
export interface Category { id: string; name: string; }
export interface Line { id: string; name: string; }
export interface Area { id: string; name: string; }

export async function getStock(): Promise<StockItem[]> {
  const snap = await getDocs(collection(db, "stock"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockItem));
}

export async function getVariants(): Promise<Variant[]> {
  const snap = await getDocs(collection(db, "variants"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant));
}

export async function getLocations(): Promise<Location[]> {
  const snap = await getDocs(collection(db, "locations"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Location));
}

export async function getProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
}

export async function getBrands(): Promise<Brand[]> {
  const snap = await getDocs(collection(db, "brands"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Brand));
}

export async function getCategories(): Promise<Category[]> {
  const snap = await getDocs(collection(db, "categories"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

export async function getLines(): Promise<Line[]> {
  const snap = await getDocs(collection(db, "lines"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Line));
}

export async function getAreas(): Promise<Area[]> {
  const snap = await getDocs(collection(db, "areas"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Area));
}

export async function addStock(item: Omit<StockItem, "id">): Promise<void> {
  const q = query(
    collection(db, "stock"),
    where("variant_id", "==", item.variant_id),
    where("location_id", "==", item.location_id)
  );
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error("This variant already exists at this location.");
  await addDoc(collection(db, "stock"), item);
}

export async function updateStockQuantity(id: string, quantity: number): Promise<void> {
  await updateDoc(doc(db, "stock", id), { quantity });
}

export async function deleteStock(id: string): Promise<void> {
  await deleteDoc(doc(db, "stock", id));
}

export interface CSVRow {
  variant_code: string;
  location_code: string;
  quantity: number;
}

export interface ImportResult {
  success: number;
  failed: { row: number; reason: string }[];
}

export async function importStockFromCSV(
  rows: CSVRow[],
  variants: Variant[],
  locations: Location[]
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: [] };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const variant = variants.find((v) => v.code === row.variant_code);
    if (!variant) { result.failed.push({ row: rowNum, reason: `Variant code "${row.variant_code}" not found.` }); continue; }
    const location = locations.find((l) => l.code === row.location_code);
    if (!location) { result.failed.push({ row: rowNum, reason: `Location code "${row.location_code}" not found.` }); continue; }
    if (isNaN(row.quantity) || row.quantity < 0) { result.failed.push({ row: rowNum, reason: `Invalid quantity.` }); continue; }
    try {
      await addStock({ variant_id: variant.id, location_id: location.id, quantity: row.quantity });
      result.success++;
    } catch (e: any) {
      result.failed.push({ row: rowNum, reason: e.message });
    }
  }
  return result;
}

export function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split("\n");
  return lines.slice(1).map((line) => {
    const [variant_code, location_code, qty] = line.split(",").map((s) => s.trim());
    return { variant_code, location_code, quantity: Number(qty) };
  });
}