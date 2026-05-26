"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function StockBalance() {
  const [tab, setTab] = useState("qty");

  const [stockLots, setStockLots] = useState([]);
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const fetchData = async () => {
    const [s, v, w] = await Promise.all([
      getDocs(collection(db, "stock_lots")),
      getDocs(collection(db, "variants")),
      getDocs(collection(db, "warehouses")),
    ]);

    setStockLots(s.docs.map(d => ({ id: d.id, ...d.data() })));
    setVariants(v.docs.map(d => ({ id: d.id, ...d.data() })));
    setWarehouses(w.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getVariant = (id) =>
    variants.find(v => v.id === id)?.name || "Unknown";

  const getWarehouse = (id) =>
    warehouses.find(w => w.id === id)?.name || "Unknown";

  // =========================
  // GROUP DATA
  // =========================
  const grouped = {};

  stockLots.forEach((item) => {
    const key = `${item.variantId}-${item.warehouseId}`;

    if (!grouped[key]) {
      grouped[key] = {
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        qty: 0,
        serials: [],
      };
    }

    if (item.type === "qty") {
      grouped[key].qty += item.qty;
    }

    if (item.type === "serial") {
      grouped[key].serials.push(...(item.serials || []));
      grouped[key].qty += (item.serials?.length || 0);
    }
  });

  const data = Object.values(grouped);

  return (
    <div style={{ padding: 20 }}>
      <h1>📦 Stock Balance</h1>

      {/* ================= TABS ================= */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setTab("qty")} style={{ padding: 10, marginRight: 10 }}>
          Qty View
        </button>

        <button onClick={() => setTab("serial")} style={{ padding: 10 }}>
          Serial View
        </button>
      </div>

      {/* ================= QTY TAB ================= */}
      {tab === "qty" && (
        <table border="1" cellPadding="10" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Variant</th>
              <th>Warehouse</th>
              <th>Total Qty</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item, i) => (
              <tr key={i}>
                <td>{getVariant(item.variantId)}</td>
                <td>{getWarehouse(item.warehouseId)}</td>
                <td><b>{item.qty}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ================= SERIAL TAB ================= */}
      {tab === "serial" && (
        <table border="1" cellPadding="10" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Variant</th>
              <th>Warehouse</th>
              <th>Serial</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item, i) => (
              <>
                {/* SERIAL ITEMS */}
                {item.serials.map((s, idx) => (
                  <tr key={`s-${i}-${idx}`}>
                    <td>{getVariant(item.variantId)}</td>
                    <td>{getWarehouse(item.warehouseId)}</td>
                    <td>{s}</td>
                  </tr>
                ))}

                {/* QTY ITEMS (no serial shown, repeated rows) */}
                {item.serials.length === 0 &&
                  Array.from({ length: item.qty }).map((_, idx) => (
                    <tr key={`q-${i}-${idx}`}>
                      <td>{getVariant(item.variantId)}</td>
                      <td>{getWarehouse(item.warehouseId)}</td>
                      <td></td>
                    </tr>
                  ))}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}