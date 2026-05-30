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

  // 📥 Fetch
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

    fetchAll();
  };

  // ❌ Delete Variant (FIXED)
  const deleteVariant = async (id: string) => {
    await deleteDoc(doc(db, "variants", id));
    fetchAll();
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
        />

        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Variant Name"
        />

        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
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