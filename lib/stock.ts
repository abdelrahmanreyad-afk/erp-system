import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
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
}

export interface Location {
  id: string;
  name: string;
  type?: string;
}

// جيب كل الستوك
export async function getStock(): Promise<StockItem[]> {
  const snap = await getDocs(collection(db, "stock"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockItem));
}

// جيب كل الـ variants
export async function getVariants(): Promise<Variant[]> {
  const snap = await getDocs(collection(db, "variants"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Variant));
}

// جيب كل الـ locations
export async function getLocations(): Promise<Location[]> {
  const snap = await getDocs(collection(db, "locations"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Location));
}

// ضيف ستوك جديد
export async function addStock(item: Omit<StockItem, "id">): Promise<void> {
  // تأكد مفيش ستوك لنفس الـ variant + location
  const q = query(
    collection(db, "stock"),
    where("variant_id", "==", item.variant_id),
    where("location_id", "==", item.location_id)
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error("هذا الـ variant موجود بالفعل في هذا الـ location");
  }
  await addDoc(collection(db, "stock"), item);
}

// عدل الكمية بس
export async function updateStockQuantity(id: string, quantity: number): Promise<void> {
  await updateDoc(doc(db, "stock", id), { quantity });
}

// امسح ستوك
export async function deleteStock(id: string): Promise<void> {
  await deleteDoc(doc(db, "stock", id));
}