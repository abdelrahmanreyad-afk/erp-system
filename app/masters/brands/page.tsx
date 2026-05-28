"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
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

export default function BrandsPage() {
  const [name, setName] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);

  const brandsRef = collection(db, "brands");

  // 📥 Get Brands
  const fetchBrands = async () => {
    const snapshot = await getDocs(brandsRef);

    const data: Brand[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Brand, "id">),
    }));

    setBrands(data);
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // ➕ Add Brand
  const addBrand = async () => {
    if (!name) return;

    await addDoc(brandsRef, {
      name,
      createdAt: new Date(),
    });

    setName("");
    fetchBrands();
  };

  // ❌ Delete Brand
  const deleteBrand = async (id: string) => {
    await deleteDoc(doc(db, "brands", id));
    fetchBrands();
  };

  return (
    <div>
      <h1>🏷️ Brands</h1>

      {/* Add Form */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brand name"
          style={{ padding: 8, marginRight: 10 }}
        />

        <button onClick={addBrand}>
          Add
        </button>
      </div>

      {/* List */}
      <ul>
        {brands.map((b) => (
          <li key={b.id}>
            {b.name}{" "}
            <button onClick={() => deleteBrand(b.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}