import "./globals.css";
import Sidebar from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{ display: "flex" }}>
          <Sidebar />

          <div
            style={{
              flex: 1,
              padding: 20,
              background: "#f3f4f6",
              minHeight: "100vh",
            }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}