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

type Location = {
  id: string;
  name: string;
  type: "warehouse" | "branch";
};

export default function LocationsPage() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"warehouse" | "branch">("branch");

  const [locations, setLocations] = useState<Location[]>([]);

  const locationsRef = collection(db, "locations");

  // 📥 Fetch
  const fetchLocations = async () => {
    const snap = await getDocs(locationsRef);

    setLocations(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // ➕ Add
  const addLocation = async () => {
    if (!name) return;

    await addDoc(locationsRef, {
      name,
      type,
      createdAt: new Date(),
    });

    setName("");
    fetchLocations();
  };

  // ❌ Delete
  const deleteLocation = async (id: string) => {
    await deleteDoc(doc(db, "locations", id));
    fetchLocations();
  };

  return (
    <div>
      <h1>🏢 Master Locations</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Location name"
          style={{ marginRight: 10 }}
        />

        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value as "warehouse" | "branch")
          }
          style={{ marginRight: 10 }}
        >
          <option value="branch">Branch</option>
          <option value="warehouse">Warehouse</option>
        </select>

        <button onClick={addLocation}>Add</button>
      </div>

      {/* LIST */}
      <ul>
        {locations.map((l) => (
          <li key={l.id}>
            {l.name} - {l.type}

            <button
              onClick={() => deleteLocation(l.id)}
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