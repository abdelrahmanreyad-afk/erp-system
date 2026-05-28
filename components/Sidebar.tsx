"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <div
      style={{
        width: 250,
        height: "100vh",
        background: "#111827",
        color: "white",
        padding: 20,
      }}
    >
      <h2 style={{ marginBottom: 30 }}>
        🔥 RB DS Master
      </h2>

      {/* Dashboard */}
      <div style={{ marginBottom: 15 }}>
        <Link href="/" style={{ color: "white" }}>
          Dashboard
        </Link>
      </div>

      {/* Masters */}
      <h3 style={{ marginTop: 30 }}>Masters</h3>

      <div style={{ marginTop: 10 }}>
        <Link href="/masters/brands" style={{ color: "white" }}>
          Brands
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/masters/categories" style={{ color: "white" }}>
          Categories
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/masters/lines" style={{ color: "white" }}>
          Lines
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/masters/products" style={{ color: "white" }}>
          Products
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/masters/variants" style={{ color: "white" }}>
          Variants
        </Link>
      </div>

      {/* Inventory */}
      <h3 style={{ marginTop: 30 }}>Inventory</h3>

      <div style={{ marginTop: 10 }}>
        <Link href="/inventory/stock" style={{ color: "white" }}>
          Add Stock
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/inventory/balance" style={{ color: "white" }}>
          Stock Balance
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <Link href="/inventory/transfers" style={{ color: "white" }}>
          Transfers
        </Link>
      </div>
    </div>
  );
}