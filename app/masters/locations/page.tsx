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
  code: string;
  type: "branch" | "warehouse";
};

export default function LocationsPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"branch" | "warehouse">("branch");

  const [locations, setLocations] = useState<Location[]>([]);

  const locationsRef = collection(db, "locations");

  // 📥 FETCH
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

  // ➕ CREATE LOCATION
  const addLocation = async () => {
    if (!name || !code) return;

    await addDoc(locationsRef, {
      name,
      code,
      type,
      createdAt: new Date(),
    });

    setName("");
    setCode("");
    setType("branch");

    fetchLocations();
  };

  // ❌ DELETE
  const deleteLocation = async (id: string) => {
    await deleteDoc(doc(db, "locations", id));
    fetchLocations();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>📍 Locations</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Location Name"
          style={{ marginRight: 10 }}
        />

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Location Code (e.g. CST-01)"
          style={{ marginRight: 10 }}
        />

        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value as "branch" | "warehouse")
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
            <b>{l.code}</b> - {l.name} ({l.type})

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