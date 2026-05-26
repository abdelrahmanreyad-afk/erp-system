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

export default function WarehousesPage() {
  const [name, setName] = useState("");
  const [type, setType] = useState("standalone");
  const [branchId, setBranchId] = useState("");

  const [warehouses, setWarehouses] = useState([]);
  const [branches, setBranches] = useState([]);

  // 📥 Warehouses
  const fetchWarehouses = async () => {
    const snapshot = await getDocs(collection(db, "warehouses"));
    setWarehouses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // 📥 Branches
  const fetchBranches = async () => {
    const snapshot = await getDocs(collection(db, "branches"));
    setBranches(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // ➕ Add Warehouse
  const addWarehouse = async () => {
    if (!name) return;

    await addDoc(collection(db, "warehouses"), {
      name,
      type,
      branchId: type === "branch" ? branchId : "",
      createdAt: new Date(),
    });

    setName("");
    setType("standalone");
    setBranchId("");

    fetchWarehouses();
  };

  // 🗑 Delete
  const deleteWarehouse = async (id) => {
    await deleteDoc(doc(db, "warehouses", id));
    fetchWarehouses();
  };

  useEffect(() => {
    fetchWarehouses();
    fetchBranches();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Warehouses Module</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>

        <input
          placeholder="Warehouse Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        />

        {/* TYPE */}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ padding: 8, marginRight: 10 }}
        >
          <option value="standalone">Standalone Warehouse</option>
          <option value="branch">Branch Warehouse</option>
        </select>

        {/* BRANCH (only if branch type) */}
        {type === "branch" && (
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            style={{ padding: 8, marginRight: 10 }}
          >
            <option value="">Select Branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        <button onClick={addWarehouse} style={{ padding: 8 }}>
          Add Warehouse
        </button>
      </div>

      <hr />

      {/* LIST */}
      <h3>All Warehouses</h3>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {warehouses.map((w) => (
          <li
            key={w.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 10,
              border: "1px solid #ddd",
              marginBottom: 5,
            }}
          >
            <span>
              <b>{w.name}</b> — {w.type}
            </span>

            <button
              onClick={() => deleteWarehouse(w.id)}
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