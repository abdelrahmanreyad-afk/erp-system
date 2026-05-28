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
  id: string; // manual ID
  sku?: string;
  name: string; // X6 - Rosegold
  productId: string;
  type: "qty" | "serial";
};

export default function VariantsPage() {
  const [id, setId] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");

  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"qty" | "serial" | "">("");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const productsRef = collection(db, "products");
  const variantsRef = collection(db, "variants");

  // 📥 Fetch data
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

  // ➕ Add Variant (DB ONLY)
  const addVariant = async () => {
    if (!id || !name || !productId || !type) return;

    await addDoc(variantsRef, {
      id,       // manual ID
      sku,      // optional
      name,     // X6 - Rosegold
      productId,
      type,
      createdAt: new Date(),
    });

    setId("");
    setSku("");
    setName("");
    setProductId("");
    setType("");

    fetchAll();
  };

  // ❌ Delete
  const deleteVariant = async (docId: string) => {
    await deleteDoc(doc(db, "variants", docId));
    fetchAll();
  };

  return (
    <div>
      <h1>📦 Variants (Database Only)</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Variant ID (manual)"
          style={{ padding: 8, marginRight: 10 }}
        />

        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU (optional)"
          style={{ padding: 8, marginRight: 10 }}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Variant Name (X6 - Rosegold)"
          style={{ padding: 8, marginRight: 10 }}
        />

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

        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Type</option>
          <option value="qty">Qty</option>
          <option value="serial">Serial</option>
        </select>

        <button onClick={addVariant}>Add</button>
      </div>

      {/* LIST */}
      <ul>
        {variants.map((v) => {
          const product = products.find((p) => p.id === v.productId);

          return (
            <li key={v.id}>
              <b>{v.name}</b> ({product?.name}) - {v.type}
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