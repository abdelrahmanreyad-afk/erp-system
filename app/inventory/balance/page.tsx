"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

type Stock = {
  id: string;
  variantCode: string;
  locationCode: string;
  qty: number;
};

type Variant = {
  id: string;
  name: string;
  code: string;
};

type Location = {
  id: string;
  name: string;
  code: string;
};

export default function StockDashboard() {
  const [stock, setStock] = useState<Stock[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const fetchAll = async () => {
    const [s, v, l] = await Promise.all([
      getDocs(collection(db, "stock")),
      getDocs(collection(db, "variants")),
      getDocs(collection(db, "locations")),
    ]);

    setStock(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setVariants(v.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setLocations(l.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // 🧠 GROUP BY LOCATION
  const grouped = stock.reduce((acc: any, item) => {
    const locName =
      locations.find((l) => l.code === item.locationCode)?.name ||
      item.locationCode;

    const varName =
      variants.find((v) => v.code === item.variantCode)?.name ||
      item.variantCode;

    if (!acc[locName]) {
      acc[locName] = {
        totalQty: 0,
        variants: {},
      };
    }

    acc[locName].totalQty += Number(item.qty);

    if (!acc[locName].variants[varName]) {
      acc[locName].variants[varName] = 0;
    }

    acc[locName].variants[varName] += Number(item.qty);

    return acc;
  }, {});

  return (
    <div style={{ padding: 20 }}>
      <h1>📊 Stock Overview</h1>

      {Object.keys(grouped).map((location) => (
        <div
          key={location}
          style={{
            border: "1px solid #ddd",
            padding: 10,
            marginBottom: 20,
          }}
        >
          <h2>📍 {location}</h2>

          <p>
            <b>Total Qty:</b> {grouped[location].totalQty}
          </p>

          <ul>
            {Object.entries(grouped[location].variants).map(
              ([variant, qty]: any) => (
                <li key={variant}>
                  {variant} → {qty}
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}