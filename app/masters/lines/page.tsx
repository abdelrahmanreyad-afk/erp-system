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

type Line = {
  id: string;
  name: string;
};

export default function LinesPage() {
  const [name, setName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const linesRef = collection(db, "lines");

  const fetchLines = async () => {
    const snapshot = await getDocs(linesRef);

    const data: Line[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Line, "id">),
    }));

    setLines(data);
  };

  useEffect(() => {
    fetchLines();
  }, []);

  const addLine = async () => {
    if (!name) return;

    await addDoc(linesRef, {
      name,
      createdAt: new Date(),
    });

    setName("");
    fetchLines();
  };

  const deleteLine = async (id: string) => {
    await deleteDoc(doc(db, "lines", id));
    fetchLines();
  };

  return (
    <div>
      <h1>📦 Lines (Standalone)</h1>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Line name"
        style={{ padding: 8, marginRight: 10 }}
      />

      <button onClick={addLine}>Add</button>

      <ul>
        {lines.map((l) => (
          <li key={l.id}>
            {l.name}
            <button onClick={() => deleteLine(l.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}