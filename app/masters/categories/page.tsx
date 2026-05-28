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

export default function CategoriesPage() {
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const brandsRef = collection(db, "brands");
  const categoriesRef = collection(db, "categories");

  // 📥 Get Brands
  const fetchBrands = async () => {
    const snap = await getDocs(brandsRef);

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Brand, "id">),
    }));

    setBrands(data);
  };

  // 📥 Get Categories
  const fetchCategories = async () => {
    const snap = await getDocs(categoriesRef);

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Category, "id">),
    }));

    setCategories(data);
  };

  useEffect(() => {
    fetchBrands();
    fetchCategories();
  }, []);

  // ➕ Add Category
  const addCategory = async () => {
    if (!name || !brandId) return;

    await addDoc(categoriesRef, {
      name,
      brandId,
      createdAt: new Date(),
    });

    setName("");
    setBrandId("");
    fetchCategories();
  };

  // ❌ Delete Category
  const deleteCategory = async (id: string) => {
    await deleteDoc(doc(db, "categories", id));
    fetchCategories();
  };

  return (
    <div>
      <h1>📂 Categories</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          style={{ padding: 8, marginRight: 10 }}
        />

        {/* Brands Dropdown */}
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="">Select Brand</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <button onClick={addCategory}>
          Add
        </button>
      </div>

      {/* LIST */}
      <ul>
        {categories.map((c) => {
          const brandName = brands.find((b) => b.id === c.brandId)?.name;

          return (
            <li key={c.id}>
              {c.name} - ({brandName})
              <button onClick={() => deleteCategory(c.id)}>
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}