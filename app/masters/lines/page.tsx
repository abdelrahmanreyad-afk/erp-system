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
  brandId: string;
  categoryId: string;
};

export default function LinesPage() {
  const [name, setName] = useState("");

  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const brandsRef = collection(db, "brands");
  const categoriesRef = collection(db, "categories");
  const linesRef = collection(db, "lines");

  // 📥 Brands
  const fetchBrands = async () => {
    const snap = await getDocs(brandsRef);

    setBrands(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Brand, "id">),
      }))
    );
  };

  // 📥 Categories
  const fetchCategories = async () => {
    const snap = await getDocs(categoriesRef);

    setCategories(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Category, "id">),
      }))
    );
  };

  // 📥 Lines
  const fetchLines = async () => {
    const snap = await getDocs(linesRef);

    setLines(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Line, "id">),
      }))
    );
  };

  useEffect(() => {
    fetchBrands();
    fetchCategories();
    fetchLines();
  }, []);

  // ➕ Add Line
  const addLine = async () => {
    if (!name || !brandId || !categoryId) return;

    await addDoc(linesRef, {
      name,
      brandId,
      categoryId,
      createdAt: new Date(),
    });

    setName("");
    setBrandId("");
    setCategoryId("");
    fetchLines();
  };

  // ❌ Delete Line
  const deleteLine = async (id: string) => {
    await deleteDoc(doc(db, "lines", id));
    fetchLines();
  };

  // filter categories by brand
  const filteredCategories = categories.filter(
    (c) => c.brandId === brandId
  );

  return (
    <div>
      <h1>📦 Lines</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Line name"
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
          <option value="">Select Brand</option>
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
          <option value="">Select Category</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button onClick={addLine}>
          Add
        </button>
      </div>

      {/* LIST */}
      <ul>
        {lines.map((l) => {
          const brand = brands.find((b) => b.id === l.brandId)?.name;
          const category = categories.find(
            (c) => c.id === l.categoryId
          )?.name;

          return (
            <li key={l.id}>
              {l.name} - {brand} / {category}
              <button onClick={() => deleteLine(l.id)}>
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}