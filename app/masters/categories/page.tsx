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

type Category = {
  id: string;
  name: string;
};

export default function CategoriesPage() {
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const categoriesRef = collection(db, "categories");

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
    fetchCategories();
  }, []);

  // ➕ Add Category
  const addCategory = async () => {
    if (!name) return;

    await addDoc(categoriesRef, {
      name,
      createdAt: new Date(),
    });

    setName("");
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

        <button onClick={addCategory}>
          Add
        </button>
      </div>

      {/* LIST */}
      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.name}
            <button
              onClick={() => deleteCategory(c.id)}
              style={{ marginLeft: 10 }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}