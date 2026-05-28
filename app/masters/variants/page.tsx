"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

type Product = {
  id: string;
  name: string;
};

type Variant = {
  id: string; // MANUAL ID (PRIMARY KEY LOGICALLY)
  sku?: string;
  productId: string;
  type: "qty" | "serial";
  qty?: number;
  serials?: string[];
};

export default function VariantsPage() {
  const [id, setId] = useState("");
  const [sku, setSku] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"qty" | "serial" | "">("");
  const [qty, setQty] = useState<number>(0);
  const [serialInput, setSerialInput] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const productsRef = collection(db, "products");
  const variantsRef = collection(db, "variants");

  // 📥 fetch products + variants
  const fetchAll = async () => {
    const [pSnap, vSnap] = await Promise.all([
      getDocs(productsRef),
      getDocs(variantsRef),
    ]);

    setProducts(
      pSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );

    setVariants(
      vSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ➕ Add Variant
  const addVariant = async () => {
    if (!id || !productId || !type) return;

    let serials: string[] = [];

    if (type === "serial") {
      serials = serialInput
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    await addDoc(variantsRef, {
      id, // MANUAL ID stored
      sku,
      productId,
      type,
      qty: type === "qty" ? qty : 0,
      serials: type === "serial" ? serials : [],
      createdAt: new Date(),
    });

    setId("");
    setSku("");
    setProductId("");
    setType("");
    setQty(0);
    setSerialInput("");

    fetchAll();
  };

  // ❌ Delete
  const deleteVariant = async (docId: string) => {
    await deleteDoc(doc(db, "variants", docId));
    fetchAll();
  };

  return (
    <div>
      <h1>📦 Variants (Core Engine)</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        {/* Manual ID */}
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Variant ID (MANUAL)"
          style={{ padding: 8, marginRight: 10 }}
        />

        {/* SKU */}
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU (optional)"
          style={{ padding: 8, marginRight: 10 }}
        />

        {/* Product */}
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Select Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Type</option>
          <option value="qty">Qty</option>
          <option value="serial">Serial</option>
        </select>

        {/* Qty */}
        {type === "qty" && (
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            placeholder="Qty"
            style={{ padding: 8, marginRight: 10 }}
          />
        )}

        {/* Serial Input */}
        {type === "serial" && (
          <textarea
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            placeholder="Enter serials (one per line)"
            style={{ padding: 8, marginRight: 10, width: 200, height: 80 }}
          />
        )}

        <button onClick={addVariant}>Add</button>
      </div>

      {/* LIST */}
      <ul>
        {variants.map((v) => {
          const product = products.find((p) => p.id === v.productId);

          return (
            <li key={v.id}>
              <b>{v.id}</b> - {product?.name} - {v.type}{" "}
              {v.type === "qty" ? `(${v.qty})` : `(${v.serials?.length})`}
              <button onClick={() => deleteVariant(v.id)}>
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}