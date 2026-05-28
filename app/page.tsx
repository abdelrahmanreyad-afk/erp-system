export default function Home() {
  return (
    <div>
      <h1>📊 Dashboard</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          marginTop: 20,
        }}
      >
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>Total Stock</h2>
          <h1>0</h1>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>Products</h2>
          <h1>0</h1>
        </div>

        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 10,
          }}
        >
          <h2>Warehouses</h2>
          <h1>0</h1>
        </div>
      </div>
    </div>
  );
}