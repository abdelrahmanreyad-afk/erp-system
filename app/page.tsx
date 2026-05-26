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

export default function Home() {
  const [name, setName] = useState("");

  const [products, setProducts] = useState([]);

  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lines, setLines] = useState([]);

  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lineId, setLineId] = useState("");

  // 🆕 Product Type
  const [type, setType] = useState("qty");

  // 📥 fetch products
  const fetchProducts = async () => {
    const snapshot = await getDocs(collection(db, "products"));
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setProducts(data);
  };

  // 📥 dropdowns
  const fetchBrands = async () => {
    const snap = await getDocs(collection(db, "brands"));
    setBrands(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchCategories = async () => {
    const snap = await getDocs(collection(db, "categories"));
    setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchLines = async () => {
    const snap = await getDocs(collection(db, "lines"));
    setLines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // ➕ add product
  const addProduct = async () => {
    if (!name) return;

    const systemCode = `PRD-${Date.now()}`; // auto unique code 🔥

    await addDoc(collection(db, "products"), {
      systemCode,
      name,
      brandId,
      categoryId,
      lineId,
      type, // 🆕 مهم جدًا
      createdAt: new Date(),
    });

    setName("");
    setBrandId("");
    setCategoryId("");
    setLineId("");
    setType("qty");

    fetchProducts();
  };

  // 🗑 delete
  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, "products", id));
    fetchProducts();
  };

  useEffect(() => {
    fetchProducts();
    fetchBrands();
    fetchCategories();
    fetchLines();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Products Module</h1>

      {/* INPUTS */}
      <div style={{ marginBottom: 20 }}>

        <input
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        />

        {/* BRAND */}
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* CATEGORY */}
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* LINE */}
        <select
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Line</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {/* 🆕 TYPE */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="qty">Qty Product</option>
          <option value="serial">Serial Product</option>
        </select>

        <button onClick={addProduct} style={{ padding: 8 }}>
          Add Product
        </button>
      </div>

      <hr />

      {/* LIST */}
      <h3>All Products</h3>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {products.map((p) => (
          <li
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 10,
              border: "1px solid #ddd",
              marginBottom: 5,
            }}
          >
            <span>
              <b>{p.systemCode}</b> - {p.name}
              <small style={{ marginLeft: 10, color: "gray" }}>
                ({p.type})
              </small>
            </span>

            <button
              onClick={() => deleteProduct(p.id)}
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