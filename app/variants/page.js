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

export default function VariantsPage() {
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);

  const [productId, setProductId] = useState("");

  // 🆕 Manual System Code
  const [systemCode, setSystemCode] = useState("");

  const [name, setName] = useState("");

  // 📥 Products
  const fetchProducts = async () => {
    const snapshot = await getDocs(collection(db, "products"));
    setProducts(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  // 📥 Variants
  const fetchVariants = async () => {
    const snapshot = await getDocs(collection(db, "variants"));
    setVariants(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  // ➕ Add Variant
  const addVariant = async () => {
    if (!productId || !systemCode || !name) return;

    await addDoc(collection(db, "variants"), {
      productId,
      systemCode, // 🆕 manual
      name,
      createdAt: new Date(),
    });

    setSystemCode("");
    setName("");

    fetchVariants();
  };

  // 🗑 Delete
  const deleteVariant = async (id) => {
    await deleteDoc(doc(db, "variants", id));
    fetchVariants();
  };

  useEffect(() => {
    fetchProducts();
    fetchVariants();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Variants Module</h1>

      {/* Product select */}
      <select
        onChange={(e) => setProductId(e.target.value)}
        style={{ padding: 8, marginRight: 10 }}
      >
        <option value="">Select Product</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.systemCode} - {p.name}
          </option>
        ))}
      </select>

      {/* System Code (Manual) */}
      <input
        placeholder="Variant System Code (e.g X6-RG)"
        value={systemCode}
        onChange={(e) => setSystemCode(e.target.value)}
        style={{ padding: 8, marginRight: 10 }}
      />

      {/* Variant Name */}
      <input
        placeholder="Variant Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: 8, marginRight: 10 }}
      />

      <button onClick={addVariant} style={{ padding: 8 }}>
        Add Variant
      </button>

      <hr />

      <h3>All Variants</h3>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {variants.map((v) => (
          <li
            key={v.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 10,
              border: "1px solid #ddd",
              marginBottom: 5,
            }}
          >
            <span>
              <b>{v.systemCode}</b> - {v.name}
            </span>

            <button
              onClick={() => deleteVariant(v.id)}
              style={{ color: "red" }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}