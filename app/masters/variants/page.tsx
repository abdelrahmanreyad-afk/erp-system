"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";

type Product = {
  id: string;
  name: string;
};

type Variant = {
  id: string;
  code: string;
  sku: string;
  name: string;
  productId: string;
};

export default function VariantsPage() {
  const [code, setCode] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const productsRef = collection(db, "products");
  const variantsRef = collection(db, "variants");

  // 🔥 REAL TIME LISTENER (ERP STYLE)
  useEffect(() => {
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      setProducts(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });

    const unsubVariants = onSnapshot(variantsRef, (snap) => {
      setVariants(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });

    return () => {
      unsubProducts();
      unsubVariants();
    };
  }, []);

  // ➕ Add Variant
  const addVariant = async () => {
    if (!code || !name || !productId) return;

    await addDoc(variantsRef, {
      code,
      sku,
      name,
      productId,
      createdAt: new Date(),
    });

    setCode("");
    setSku("");
    setName("");
    setProductId("");
  };

  // ❌ Delete Variant
  const deleteVariant = async (id: string) => {
    try {
      await deleteDoc(doc(db, "variants", id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  return (
    <div>
      <h1>📦 Variants</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Variant Code (RB-X6-RG)"
          style={{ marginRight: 8 }}
        />

        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          style={{ marginRight: 8 }}
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Variant Name"
          style={{ marginRight: 8 }}
        />

        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ marginRight: 8 }}
        >
          <option value="">Select Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button onClick={addVariant}>Add</button>
      </div>

      {/* LIST */}
      <ul>
        {variants.map((v) => {
          const product = products.find(
            (p) => p.id === v.productId
          )?.name;

          return (
            <li key={v.id}>
              <b>{v.code}</b> - {v.name} ({product})

              <button
                onClick={() => deleteVariant(v.id)}
                style={{ marginLeft: 10 }}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}