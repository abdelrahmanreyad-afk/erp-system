"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

import {
  addQtyStock,
  addSerialStock,
} from "@/lib/stockEngine";

export default function TestPage() {
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [variantId, setVariantId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");

  const [type, setType] = useState("qty");

  const [qty, setQty] = useState(0);
  const [serialsText, setSerialsText] = useState("");

  // 📥 load variants
  const fetchVariants = async () => {
    const snap = await getDocs(collection(db, "variants"));
    setVariants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // 📥 load warehouses
  const fetchWarehouses = async () => {
    const snap = await getDocs(collection(db, "warehouses"));
    setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchVariants();
    fetchWarehouses();
  }, []);

  // 🚀 HANDLE ADD STOCK
  const handleAddStock = async () => {
    if (!variantId || !warehouseId) return;

    // QTY PRODUCT
    if (type === "qty") {
      await addQtyStock({
        variantId,
        warehouseId,
        qty,
      });
    }

    // SERIAL PRODUCT
    if (type === "serial") {
      const serials = serialsText
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      await addSerialStock({
        variantId,
        warehouseId,
        serials,
      });
    }

    setQty(0);
    setSerialsText("");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🔥 Inventory Engine Test UI</h1>

      {/* ================= VARIANT ================= */}
      <h3>Variant</h3>

      <select
        value={variantId}
        onChange={(e) => setVariantId(e.target.value)}
        style={{ padding: 8, marginBottom: 10 }}
      >
        <option value="">Select Variant</option>
        {variants.map(v => (
          <option key={v.id} value={v.id}>
            {v.systemCode} - {v.name}
          </option>
        ))}
      </select>

      {/* ================= WAREHOUSE ================= */}
      <h3>Warehouse</h3>

      <select
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        style={{ padding: 8, marginBottom: 10 }}
      >
        <option value="">Select Warehouse</option>
        {warehouses.map(w => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      {/* ================= TYPE ================= */}
      <h3>Stock Type</h3>

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ padding: 8, marginBottom: 15 }}
      >
        <option value="qty">Qty Product</option>
        <option value="serial">Serial Product</option>
      </select>

      {/* ================= QTY ================= */}
      {type === "qty" && (
        <div style={{ marginBottom: 20 }}>
          <h3>➕ Qty Stock</h3>

          <input
            type="number"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{ padding: 8, marginRight: 10 }}
          />
        </div>
      )}

      {/* ================= SERIAL ================= */}
      {type === "serial" && (
        <div style={{ marginBottom: 20 }}>
          <h3>➕ Serial Stock</h3>

          <textarea
            placeholder={"Enter serials one per line\nS1\nS2\nS3"}
            value={serialsText}
            onChange={(e) => setSerialsText(e.target.value)}
            style={{ padding: 8, width: "60%", height: 120 }}
          />
        </div>
      )}

      {/* ================= BUTTON ================= */}
      <button
        onClick={handleAddStock}
        style={{ padding: 10, marginTop: 10 }}
      >
        🚀 Add Stock
      </button>
    </div>
  );
}