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

type Brand = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
  brandId: string;
};

type Line = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  brandId: string;
  categoryId: string;
  lineId: string;
};

export default function ProductsPage() {
  const [name, setName] = useState("");

  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lineId, setLineId] = useState("");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const brandsRef = collection(db, "brands");
  const categoriesRef = collection(db, "categories");
  const linesRef = collection(db, "lines");
  const productsRef = collection(db, "products");

  // 📥 Fetch all
  const fetchAll = async () => {
    const [b, c, l, p] = await Promise.all([
      getDocs(brandsRef),
      getDocs(categoriesRef),
      getDocs(linesRef),
      getDocs(productsRef),
    ]);

    setBrands(b.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setCategories(c.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setLines(l.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setProducts(p.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // 🧠 Auto Code Generator
  const generateCode = () => {
    const next = products.length + 1;
    return `PRD-${String(next).padStart(4, "0")}`;
  };

  // ➕ Add Product
  const addProduct = async () => {
    if (!name || !brandId || !categoryId || !lineId) return;

    const code = generateCode();

    await addDoc(productsRef, {
      name,
      code,
      brandId,
      categoryId,
      lineId,
      createdAt: new Date(),
    });

    setName("");
    setBrandId("");
    setCategoryId("");
    setLineId("");
    fetchAll();
  };

  // ❌ Delete
  const deleteProduct = async (id: string) => {
    await deleteDoc(doc(db, "products", id));
    fetchAll();
  };

  // Filters
  const filteredCategories = categories.filter(
    (c) => c.brandId === brandId
  );

  return (
    <div>
      <h1>📦 Products</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          style={{ padding: 8, marginRight: 10 }}
        />

        {/* Brand */}
        <select
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setCategoryId("");
          }}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Category */}
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Category</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Line */}
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

        <button onClick={addProduct}>
          Add
        </button>
      </div>

      {/* LIST */}
      <ul>
        {products.map((p) => {
          const brand = brands.find((b) => b.id === p.brandId)?.name;
          const category = categories.find((c) => c.id === p.categoryId)?.name;
          const line = lines.find((l) => l.id === p.lineId)?.name;

          return (
            <li key={p.id}>
              {p.code} - {p.name} ({brand} / {category} / {line})
              <button onClick={() => deleteProduct(p.id)}>
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}