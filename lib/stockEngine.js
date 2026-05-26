import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";


// ========================
// ➕ ADD STOCK (QTY)
// ========================
export const addQtyStock = async ({
  variantId,
  warehouseId,
  qty,
}) => {
  if (!variantId || !warehouseId || qty <= 0) return;

  await addDoc(collection(db, "stock_lots"), {
    variantId,
    warehouseId,
    type: "qty",
    qty,
    createdAt: new Date(),
  });
};


// ========================
// ➕ ADD SERIAL STOCK
// ========================
export const addSerialStock = async ({
  variantId,
  warehouseId,
  serials,
}) => {
  if (!variantId || !warehouseId || !serials?.length) return;

  await addDoc(collection(db, "stock_lots"), {
    variantId,
    warehouseId,
    type: "serial",
    serials,
    qty: serials.length,
    createdAt: new Date(),
  });
};


// ========================
// 🔄 TRANSFER STOCK
// ========================
export const transferStock = async ({
  variantId,
  fromWarehouseId,
  toWarehouseId,
  qty,
}) => {
  if (!variantId || !fromWarehouseId || !toWarehouseId) return;

  const q = query(
    collection(db, "stock_lots"),
    where("variantId", "==", variantId),
    where("warehouseId", "==", fromWarehouseId)
  );

  const snapshot = await getDocs(q);

  let remaining = qty;

  for (let docSnap of snapshot.docs) {
    const data = docSnap.data();

    if (data.type === "qty") {
      const take = Math.min(data.qty, remaining);

      data.qty -= take;
      remaining -= take;

      await addDoc(collection(db, "stock_lots"), {
        variantId,
        warehouseId: toWarehouseId,
        type: "qty",
        qty: take,
        createdAt: new Date(),
      });

      if (data.qty === 0) {
        // optional: mark as consumed
      }
    }

    if (remaining <= 0) break;
  }
};