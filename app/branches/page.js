"use client";

import Link from "next/link";

export default function InventoryPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>📦 Inventory Module</h1>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        
        <Link href="/inventory/test">
          <button style={{ padding: 15 }}>
            🧪 Test Engine
          </button>
        </Link>

        <Link href="/inventory/balance">
          <button style={{ padding: 15 }}>
            📊 Stock Balance
          </button>
        </Link>

      </div>
    </div>
  );
}